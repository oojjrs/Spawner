import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,_webp

HERE=Path(__file__).resolve().parent

def write_json(path,data):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    path.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def translation(x,y):
    return np.array([[1,0,x],[0,1,y],[0,0,1]],float)

def rotation(pivot,degrees):
    angle=math.radians(degrees)
    c,s=math.cos(angle),math.sin(angle)
    x,y=pivot
    return np.array([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1]],float)

def affine(image,matrix):
    inverse=np.linalg.inv(matrix)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC)

def sample(pixels,x,y):
    x=np.clip(x,0,510.9999)
    y=np.clip(y,0,510.9999)
    ix,iy=x.astype(int),y.astype(int)
    u,v=(x-ix)[:,None],(y-iy)[:,None]
    return (pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v

def make_mesh(image,joints,kind):
    bounds=image.getchannel('A').getbbox()
    xs=list(range(max(0,bounds[0]-8),min(512,bounds[2]+16),8))
    ys=list(range(max(0,bounds[1]-8),min(512,bounds[3]+16),8))
    vertices=[[x,y] for y in ys for x in xs]
    weights=[]
    for x,y in vertices:
        if kind=='leg':
            a=ease((y-joints[1][1]+8)/16)
            b=ease((y-joints[2][1]+6)/12)
            weights.append([1-a,a*(1-b),a*b])
        elif kind=='ear':
            distance=np.linalg.norm(np.array([x,y])-np.array(joints[0]))
            a=ease((distance-38)/50)
            b=ease((distance-88)/50)
            weights.append([1-a,a*(1-b),a*b])
        else:
            tail=max(0,min(1,(x-87)/367))
            weights.append([1-tail,0,tail])
    triangles=[]
    alpha=np.asarray(image)[:,:,3]
    for row in range(len(ys)-1):
        for col in range(len(xs)-1):
            if np.any(alpha[ys[row]:ys[row+1]+1,xs[col]:xs[col+1]+1]):
                n=row*len(xs)+col
                triangles.extend([[n,n+1,n+len(xs)],[n+1,n+len(xs)+1,n+len(xs)]])
    return {'vertices':vertices,'weights':weights,'triangles':triangles,'joints':joints,'kind':kind,'step':8}

def mesh_render(image,mesh,matrices):
    pixels=np.array(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    vertices=np.asarray(mesh['vertices'],float)
    homogeneous=np.column_stack((vertices,np.ones(len(vertices))))
    transformed=np.einsum('bij,vj->bvi',np.asarray(matrices),homogeneous)[:,:,:2]
    posed=np.einsum('vb,bvi->vi',np.asarray(mesh['weights']),transformed)
    output=np.zeros((512,512,4),float)
    for indices in mesh['triangles']:
        destination=posed[indices]
        source=vertices[indices]
        lower=np.maximum(np.floor(destination.min(0)).astype(int),0)
        upper=np.minimum(np.ceil(destination.max(0)).astype(int),511)
        if np.any(upper<lower):
            continue
        x,y=np.meshgrid(np.arange(lower[0],upper[0]+1),np.arange(lower[1],upper[1]+1))
        system=np.vstack((destination.T,np.ones(3)))
        if abs(np.linalg.det(system))<0.01:
            continue
        barycentric=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
        inside=np.all(barycentric>=-0.00001,0)
        coordinates=source.T@barycentric[:,inside]
        output[y.ravel()[inside],x.ravel()[inside]]=sample(pixels,coordinates[0],coordinates[1])
    alpha=output[:,:,3:4]
    rgb=output[:,:,:3]/np.maximum(alpha,1/255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate((rgb,alpha),2)*255+.5,0,255))),posed

def leg_matrices(joints,body_matrix,bend,target_offset):
    hip,knee,ankle=np.asarray(joints,float)
    first_delta=knee-hip
    end_delta=ankle-hip
    bend=-1 if first_delta[0]*end_delta[1]-first_delta[1]*end_delta[0]>0 else 1
    hip_now=(body_matrix@np.array([hip[0],hip[1],1]))[:2]
    target=ankle+np.asarray(target_offset,float)
    delta=target-hip_now
    length1=np.linalg.norm(knee-hip)
    length2=np.linalg.norm(ankle-knee)
    distance=min(length1+length2-.01,max(abs(length1-length2)+.01,np.linalg.norm(delta)))
    direction=math.atan2(delta[1],delta[0])
    offset=math.acos(max(-1,min(1,(distance*distance+length1*length1-length2*length2)/(2*distance*length1))))
    angle=direction+bend*offset
    elbow=hip_now+length1*np.array([math.cos(angle),math.sin(angle)])
    lower=math.atan2(target[1]-elbow[1],target[0]-elbow[0])
    bind1=math.atan2(knee[1]-hip[1],knee[0]-hip[0])
    bind2=math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])
    first=translation(hip_now[0],hip_now[1])@rotation((0,0),math.degrees(angle-bind1))@translation(-hip[0],-hip[1])
    second=translation(elbow[0],elbow[1])@rotation((0,0),math.degrees(lower-bind2))@translation(-knee[0],-knee[1])
    foot=translation(target[0]-ankle[0],target[1]-ankle[1])
    return [first,second,foot],{'hip':hip_now.tolist(),'knee':elbow.tolist(),'ankle':target.tolist(),'upperLength':float(length1),'lowerLength':float(length2)}

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))


def scalar(time,keys):
    if time<=keys[0][0]:
        return keys[0][1]
    for left,right in zip(keys,keys[1:]):
        if time<=right[0]:
            u=(time-left[0])/(right[0]-left[0])
            if right[2]=='accelerate':
                u=u*u
            elif right[2]=='smooth':
                u=ease(u)
            return left[1]+(right[1]-left[1])*u
    return keys[-1][1]

def main():
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    leaf=images['leaf']
    path=HERE/'leaf-mesh.json'
    if path.exists():
        mesh=json.loads(path.read_text('utf-8'))
    else:
        mesh=make_mesh(leaf,[[330,145],[368,148],[407,167]],'ear')
    source_body=np.argwhere(np.asarray(images['body'])[:,:,3]>128)[:,::-1]
    source_body=np.column_stack((source_body,np.ones(len(source_body))))
    ground=float(source_body[:,1].max())
    frames=[]
    records=[]
    times=list(range(0,1441,40))
    durations=[40]*(len(times)-1)+[1000]
    for index,time in enumerate(times):
        values={name:scalar(time,keys) for name,keys in motion['channels'].items()}
        body=rotation([245,286],values['bodyAngle'])
        body[1,2]+=ground-float((body@source_body.T)[1].max())
        body[0,2]+=values['bodyX']
        base_angle=values['leafBase']
        def pose_leaf(angle):
            m0=body@rotation([330,145],angle)
            m1=m0@rotation([368,148],values['leafMid'])
            m2=m1@rotation([407,167],values['leafTip'])
            image,posed=mesh_render(leaf,mesh,[m0,m1,m2])
            maximum=float(np.where(np.asarray(image)[:,:,3]>128)[0].max())
            return image,posed,[m0,m1,m2],maximum
        moving,posed,matrices,maximum=pose_leaf(base_angle)
        if maximum>ground:
            lower=base_angle
            upper=base_angle+90
            for attempt in range(7):
                trial=(lower+upper)/2
                candidate,vertices,candidate_matrices,bottom=pose_leaf(trial)
                if bottom>ground:
                    lower=trial
                else:
                    upper=trial
                    moving,posed,matrices,maximum=candidate,vertices,candidate_matrices,bottom
            base_angle=upper
        m0,m1,m2=matrices
        values['leafBaseSolved']=base_angle
        frame=affine(images['body-closed'] if time>=120 else images['body'],body)
        frame.alpha_composite(moving)
        if time>=1400 and frames:
            frame=frames[-1].copy()
        frames.append(frame)
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        records.append({'frame':index,'timeMs':time,'channels':values,'body':body.tolist(),'leafBones':[m0.tolist(),m1.tolist(),m2.tolist()],'ground':ground})
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,durations)
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
    contact=Image.new('RGB',(1024,536),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for i,index in enumerate([0,5,10,13,17,21,29,len(frames)-1]):
        cell=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=i%4*256,i//4*268
        contact.paste(cell,(x,y),cell)
        draw.text((x+8,y+254),str(times[index]),(240,240,230))
    contact.save(HERE/'contact.jpg')
    frames[0].save(HERE/'neutral-reassembled.png')
    write_json(HERE/'landmarks.json',records)
    write_json(HERE/'leaf-mesh.json',mesh)
    prefix='DesignAssets/Animations/CreatureDeathV3/rolling-acorn/'
    write_json(HERE/'death.json',{'name':'rolling-acorn','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/rolling-acorn.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    write_json(HERE/'rig.json',{'name':'rolling-acorn','method':'Original rigid acorn body rolls onto its side with physical lower support projection, local leaf-only FK mesh lags then droops, approved idle eye expression.','controls':'motion.json','timeline':'landmarks.json','renderer':'render.py','canvas':[512,512],'rigidParts':['body'],'meshParts':['leaf'],'sourceEyeDrawing':'Source/approved-idle-closed.png','spineCompatibilityVerified':False})
    print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'finalAlphaBounds':frames[-1].getchannel('A').getbbox()}))

if __name__=='__main__':
    main()
