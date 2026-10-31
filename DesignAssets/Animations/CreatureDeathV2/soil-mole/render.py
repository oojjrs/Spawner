import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,_webp

BASE=Path(__file__).resolve().parent.parent

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

def leg_matrices(joints,body_matrix,bend):
    hip,knee,ankle=np.asarray(joints,float)
    first_delta=knee-hip
    end_delta=ankle-hip
    bend=-1 if first_delta[0]*end_delta[1]-first_delta[1]*end_delta[0]>0 else 1
    hip_now=(body_matrix@np.array([hip[0],hip[1],1]))[:2]
    target=ankle
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

CONFIGS={
'flower-tail-bird':{'bodyPivot':[256,330],'bodyDegrees':-8,'bodyDrop':34,'headPivot':[242,254],'headDegrees':-75,'legs':{'near-leg':[[247,345],[251,377],[247,403],-1],'far-leg':[[190,344],[190,370],[180,389],1]},'tailPivot':[345,309],'tailDegrees':22,'wingPivot':[254,270],'wingDegrees':14},
'dew-rabbit':{'bodyPivot':[300,350],'bodyDegrees':-8,'bodyDrop':31,'headPivot':[284,304],'headDegrees':-40,'legs':{'foreleg':[[231,340],[235,380],[232,418],-1],'foreleg-far':[[179,332],[183,372],[180,410],1],'hindleg':[[337,332],[356,378],[328,418],1]},'ears':{'near-ear':[[287,224],[308,163],[337,108],-115,-20],'far-ear':[[218,207],[189,165],[153,140],-30,-12]}},
'soil-mole':{'bodyPivot':[300,300],'bodyDegrees':-4,'bodyDrop':35,'headPivot':[262,276],'headDegrees':-32,'legs':{'near-paw':[[312,289],[292,326],[276,362],-1],'far-paw':[[151,298],[136,322],[118,347],1],'near-hind':[[427,310],[443,327],[451,342],1],'far-hind':[[427,254],[442,269],[450,282],1]}},
'bundle-snail':{'shellPivot':[310,340],'shellDegrees':0,'bodyDrop':0}
}

def render_animal(key):
    folder=BASE/key
    rig_path=folder/'rig.json'
    config=json.loads(rig_path.read_text('utf-8'))['configuration'] if rig_path.exists() else CONFIGS[key]
    images={p.stem:Image.open(p).convert('RGBA') for p in (folder/'Parts').glob('*.png')}
    if key=='soil-mole':
        collar_mask=Image.new('L',(512,512),0)
        ImageDraw.Draw(collar_mask).polygon([(277,158),(320,168),(370,215),(370,353),(282,353),(288,309),(302,275),(303,232)],255)
        collar_mask=collar_mask.filter(ImageFilter.GaussianBlur(3))
        collar=np.array(images['body'])
        collar[:,:,3]=(collar[:,:,3].astype(float)*np.asarray(collar_mask)/255).astype('uint8')
        images['neck-occluder']=Image.fromarray(collar)
        images['neck-occluder'].save(folder/'Parts/neck-occluder.png')
    meshes={}
    for name,values in config.get('legs',{}).items():
        mesh_path=folder/(name+'-mesh.json')
        meshes[name]=json.loads(mesh_path.read_text('utf-8')) if mesh_path.exists() else make_mesh(images[name],values[:3],'leg')
    for name,values in config.get('ears',{}).items():
        mesh_path=folder/(name+'-mesh.json')
        meshes[name]=json.loads(mesh_path.read_text('utf-8')) if mesh_path.exists() else make_mesh(images[name],values[:3],'ear')
    if key=='bundle-snail':
        mesh_path=folder/'mantle-mesh.json'
        meshes['mantle']=json.loads(mesh_path.read_text('utf-8')) if mesh_path.exists() else make_mesh(images['mantle'],[[180,370],[260,375],[350,390]],'mantle')
    (folder/'Frames').mkdir(511,True,True)
    times=list(range(0,1641,40))+[1680]
    durations=[40]*(len(times)-1)+[1000]
    frames=[]
    records=[]
    for index,time in enumerate(times):
        p=ease((time-220)/750)
        lag=ease((time-360)/850)
        frame=Image.new('RGBA',(512,512),(0,0,0,0))
        if key=='bundle-snail':
            shell_bottom=images['shell'].getchannel('A').getbbox()[3]
            original_ground=Image.open(folder/'reference.png').getchannel('A').getbbox()[3]
            settle=ease((time-1020)/450)*(original_ground-shell_bottom)
            body=translation(0,settle)
            front=translation(170*p,-60*p)
            middle=translation(70*p,-60*p)
            tail=translation(-90*p,-80*p)
            mantle,posed=mesh_render(images['mantle'],meshes['mantle'],[body@front,body@middle,body@tail])
            head=body@front
            for name,offset in [('far-eye',-8),('near-eye',0)]:
                retract=ease((time-120-offset)/470)
                eye=head@translation(12*retract,68*retract)
                frame.alpha_composite(affine(images[name],eye))
            frame.alpha_composite(mantle)
            frame.alpha_composite(affine(images['shell-front'],body))
            named={'shell':body.tolist(),'head':head.tolist(),'mantle-front':(body@front).tolist(),'mantle-tail':(body@tail).tolist(),'mantle-middle':(body@middle).tolist()}
        else:
            body=translation(0,config['bodyDrop']*p)@rotation(config['bodyPivot'],config['bodyDegrees']*p)
            head=body@rotation(config['headPivot'],config['headDegrees']*ease((time-300)/720))
            limb_outputs={}
            limb_records={}
            for name,values in config['legs'].items():
                matrices,positions=leg_matrices(values[:3],body,values[3])
                layer,posed=mesh_render(images[name],meshes[name],matrices)
                limb_outputs[name]=layer
                limb_records[name]=positions
            for name,layer in limb_outputs.items():
                frame.alpha_composite(layer)
            if key=='flower-tail-bird':
                tail=body@rotation(config['tailPivot'],config['tailDegrees']*lag)
                frame.alpha_composite(affine(images['tail'],tail))
            frame.alpha_composite(affine(images['body'],body))
            ear_matrices={}
            for name,values in config.get('ears',{}).items():
                source_joints=values[:3]
                bend=values[3]*ease((time-400)/780)
                follow=values[4]*ease((time-540)/780)
                m0=head@rotation(source_joints[0],bend)
                m1=m0@rotation(source_joints[1],follow)
                m2=m1@rotation(source_joints[2],follow*.35)
                layer,posed=mesh_render(images[name],meshes[name],[m0,m1,m2])
                frame.alpha_composite(layer)
                ear_matrices[name]=[m0.tolist(),m1.tolist(),m2.tolist()]
            face=images['head-closed'] if time>=320 else images['head']
            frame.alpha_composite(affine(face,head))
            if key=='flower-tail-bird':
                wing=body@rotation(config['wingPivot'],config['wingDegrees']*lag)
                frame.alpha_composite(affine(images['wing'],wing))
            if key=='soil-mole':
                frame.alpha_composite(affine(images['neck-occluder'],body))
            named={'body':body.tolist(),'head':head.tolist(),'legs':limb_records,'ears':ear_matrices}
        root_shift=0
        if key!='bundle-snail':
            source_alpha=np.asarray(Image.open(folder/'reference.png'))[:,:,3]
            ground=int(np.argwhere(source_alpha>128)[:,0].max())
            contact=int(np.argwhere(np.asarray(frame)[:,:,3]>128)[:,0].max())
            root_shift=ground-contact
            frame=affine(frame,translation(0,root_shift))
        if time>=1520 and frames:
            frame=frames[-1].copy()
        frames.append(frame)
        frame.save(folder/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        records.append({'frame':index,'timeMs':time,'transforms':named,'rigidScale':[1,1],'rootTranslation':[0,root_shift]})
    atlas=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):
        atlas.alpha_composite(frame,(index%4*512,index//4*512))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(atlas.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(folder/'preview.webp',frames,durations)
    encode(folder/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
    contact=Image.new('RGB',(1024,536),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for i,index in enumerate([0,7,13,19,24,29,35,len(frames)-1]):
        cel=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=i%4*256,i//4*268
        contact.paste(cel,(x,y),cel)
        draw.text((x+8,y+254),str(index),(240,240,230))
    contact.save(folder/'contact.jpg')
    frames[0].save(folder/'neutral-reassembled.png')
    write_json(folder/'landmarks.json',records)
    for name,mesh in meshes.items():
        write_json(folder/(name+'-mesh.json'),mesh)
    sources={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (folder/'Parts').glob('*.png')}
    rigid=['shell'] if key=='bundle-snail' else ['body','head']+(['wing','tail'] if key=='flower-tail-bird' else [])
    active=['shell','shell-front','mantle','near-eye','far-eye'] if key=='bundle-snail' else ['body','head','head-closed']+list(config['legs'])+list(config.get('ears',{}))+(['wing','tail'] if key=='flower-tail-bird' else [])+(['neck-occluder'] if key=='soil-mole' else [])
    order=['far-eye','near-eye','mantle','shell-front'] if key=='bundle-snail' else list(config['legs'])+(['tail'] if key=='flower-tail-bird' else [])+['body']+list(config.get('ears',{}))+['head']+(['wing'] if key=='flower-tail-bird' else [])+(['neck-occluder'] if key=='soil-mole' else [])
    bones=[{'name':'root','parent':None,'scale':[1,1]},{'name':'body' if key!='bundle-snail' else 'shell','parent':'root','pivot':config.get('bodyPivot',config.get('shellPivot')),'scale':[1,1]}]
    if key!='bundle-snail':
        bones.append({'name':'head','parent':'body','pivot':config['headPivot'],'scale':[1,1]})
    for name,values in config.get('legs',{}).items():
        bones.extend([{'name':name+'-upper','parent':'body','pivot':values[0],'end':values[1],'scale':[1,1]},{'name':name+'-lower','parent':name+'-upper','pivot':values[1],'end':values[2],'scale':[1,1]},{'name':name+'-target','parent':'root','pivot':values[2],'scale':[1,1]}])
    for name,values in config.get('ears',{}).items():
        bones.extend([{'name':name+'-base','parent':'head','pivot':values[0],'end':values[1],'scale':[1,1]},{'name':name+'-mid','parent':name+'-base','pivot':values[1],'end':values[2],'scale':[1,1]},{'name':name+'-tip','parent':name+'-mid','pivot':values[2],'scale':[1,1]}])
    method='Complete continuous soft-body attachment with a local withdrawal mesh and separate complete eye stalks; immutable rigid shell and pack lowered to the original ground.' if key=='bundle-snail' else 'Separate complete immutable body/head attachments with scale=1, local limb and ear meshes, anatomical FK/IK and explicit foreground occluders.'
    rig={'name':key,'method':method,'canvas':[512,512],'configuration':config,'sources':sources,'activeParts':active,'rigidParts':rigid,'drawOrder':order,'bones':bones,'timeline':'landmarks.json','meshParts':list(meshes),'renderer':'render.py','dependencies':['Python 3','numpy','Pillow 12.3'],'spineCompatibilityVerified':False}
    write_json(folder/'rig.json',rig)
    prefix='DesignAssets/Animations/CreatureDeathV2/'+key+'/'
    write_json(folder/'death.json',{'name':key,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+key+'.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','contact':prefix+'contact.jpg','rig':prefix+'rig.json','method':rig['method']})
    print(json.dumps({'key':key,'frames':len(frames),'durationMs':sum(durations)}))
    sys.stdout.flush()

if __name__=='__main__':
    render_animal(Path(__file__).resolve().parent.name)
