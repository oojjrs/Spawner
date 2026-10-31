from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import math,json,sys,hashlib

FOLDER=Path(__file__).resolve().parent
SIZE=512

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    x=max(0,min(1,value))
    return x*x*(3-2*x)

def matrix(pivot,angle,translation):
    theta=math.radians(angle);c,s=math.cos(theta),math.sin(theta)
    out=np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
    out[:2,2]=np.asarray(pivot)+np.asarray(translation)-out[:2,:2]@np.asarray(pivot)
    return out

def posed(image,transform):
    inverse=np.linalg.inv(transform)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].reshape(-1)),Image.Resampling.BICUBIC).convert('RGBA')

def ribbon(points,radii):
    tang=np.gradient(points,axis=0);normal=np.column_stack((-tang[:,1],tang[:,0]));normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],.01)
    return np.stack((points+normal*radii[:,None],points-normal*radii[:,None]),1)

def sample(texture,uv):
    h,w=texture.shape[:2];x=np.clip(uv[0],0,w-1.001);y=np.clip(uv[1],0,h-1.001);ix=x.astype(int);iy=y.astype(int);u=(x-ix)[:,None];v=(y-iy)[:,None]
    return (texture[iy,ix]*(1-u)+texture[iy,ix+1]*u)*(1-v)+(texture[iy+1,ix]*(1-u)+texture[iy+1,ix+1]*u)*v

def mesh(texture,source,destination):
    canvas=np.zeros((512,512,4),np.float32);src=source.reshape(-1,2);dst=destination.reshape(-1,2)
    for i in range(len(source)-1):
        for ids in [[2*i,2*i+1,2*i+2],[2*i+1,2*i+3,2*i+2]]:
            a=src[ids];b=dst[ids];lo=np.maximum(np.floor(b.min(0)).astype(int)-1,0);hi=np.minimum(np.ceil(b.max(0)).astype(int)+1,511)
            if np.any(hi<lo):continue
            x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));system=np.vstack((b.T,np.ones(3)))
            if abs(np.linalg.det(system))<.0001:continue
            bc=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)]);inside=np.all(bc>=-.00001,0)
            if not np.any(inside):continue
            pix=sample(texture,a.T@bc[:,inside]);canvas[y.ravel()[inside],x.ravel()[inside]]=pix
    alpha=canvas[:,:,3:4];canvas[:,:,:3]=canvas[:,:,:3]*255/np.maximum(alpha,.00001);canvas[canvas[:,:,3]==0]=0
    return Image.fromarray(np.uint8(np.clip(canvas,0,255)+.5))

def simulate(rest,radii,times,ground,drop):
    positions=rest.copy();previous=positions.copy();lengths=np.linalg.norm(np.diff(rest,axis=0),axis=1);saved=[];errors=[];clock=0
    for time in times:
        target=min(time,1750)
        while clock<target:
            clock+=10;amount=ease((clock-160)/900);root=rest[0]+[0,drop*ease((clock-350)/800)]
            velocity=(positions-previous)*.93;previous=positions.copy();positions+=velocity+np.array([0,.11])*amount
            for iteration in range(80):
                positions[0]=root
                delta=np.diff(positions,axis=0);d=np.maximum(np.linalg.norm(delta,axis=1),.0001);correction=delta*((d-lengths)/d)[:,None]
                for j in range(len(lengths)):
                    if j==0:positions[j+1]-=correction[j]
                    else:positions[j]+=.5*correction[j];positions[j+1]-=.5*correction[j]
                positions[:,0]=np.clip(positions[:,0],30+radii,482-radii);positions[:,1]=np.minimum(positions[:,1],ground-radii)
            previous[0]=root
        saved.append(positions.copy());errors.append(float(np.max(np.abs(np.linalg.norm(np.diff(positions,axis=0),axis=1)-lengths))))
    return saved,errors,lengths

def main():
    rig=json.loads((FOLDER/'rig.json').read_bytes());times=rig['timesMs'];neutral=Image.open(FOLDER/'Source/neutral.png').convert('RGBA');body=Image.open(FOLDER/'Parts/bulb.png').convert('RGBA');closed=Image.open(FOLDER/'Parts/bulb-closed.png').convert('RGBA');foot=Image.open(FOLDER/'Parts/foot.png').convert('RGBA')
    parts={p['name']:Image.open(FOLDER/p['image']).convert('RGBA') for p in rig['parts']};strip=np.asarray(Image.open(FOLDER/'Source/main-tendril-unwrapped.png').convert('RGBA')).astype(float);strip[:,:,:3]*=strip[:,:,3:4]/255
    original=np.asarray(neutral).astype(float);original[:,:,:3]*=original[:,:,3:4]/255
    main=np.array(rig['mainCenterline']);side=np.array(rig['sideCenterline']);mr=np.array(rig['mainRadius']);sr=np.array(rig['sideRadius']);mframes,me,ml=simulate(main,mr,times,rig['groundY'],rig['rootDrop']);sframes,se,sl=simulate(side,sr,times,rig['groundY'],rig['rootDrop'])
    uv=np.zeros((len(main),2,2));uv[:,1,0]=63;uv[:,:,1]=np.linspace(0,511,len(main))[:,None];sideuv=ribbon(side,sr);frames=[];states=[]
    for index,time in enumerate(times):
        drop=rig['rootDrop']*ease((time-350)/800);frame=Image.new('RGBA',(512,512));frame.alpha_composite(mesh(strip,uv,ribbon(mframes[index],mr)));frame.alpha_composite(mesh(original,sideuv,ribbon(sframes[index],sr)))
        footamount=ease((time-100)/750)
        for offset,pivot in [([0,0],[195,448]),([50,9],[245,457]),([102,-4],[297,444])]:
            bind=matrix([0,0],0,offset);local=matrix(pivot,(-56 if offset[0]<80 else 48)*footamount,[0,drop-20*footamount]);frame.alpha_composite(posed(foot,local@bind))
        matrices={}
        for p in rig['parts']:
            amount=ease((time-p['delay'])/1000);mat=matrix(p['pivot'],p['angle']*amount,[0,drop]);matrices[p['name']]=mat.tolist();image=closed if p['name']=='bulb' and time>=250 else parts[p['name']];frame.alpha_composite(posed(image,mat))
        frames.append(frame);states.append({'timeMs':time,'matrices':matrices,'rootY':drop,'mainCenterline':mframes[index].tolist(),'sideCenterline':sframes[index].tolist()})
    columns=rig['columns'];sheet=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)))
    for i,frame in enumerate(frames):sheet.paste(frame,(i%columns*512,i//columns*512))
    sheet.save(FOLDER/'death.webp','WEBP',**{'lossless':True,'method':4});options={'save_all':True,'append_images':frames[1:],'duration':rig['durationsMs'],'loop':0,'lossless':True,'method':4};frames[0].save(FOLDER/'preview.webp','WEBP',**options);small=[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames];small[0].save(FOLDER/'thumbnail.webp','WEBP',**{**options,'append_images':small[1:]})
    contact=Image.new('RGB',(1024,560),'#27352f');pen=ImageDraw.Draw(contact)
    for cell,i in enumerate([0,6,10,15,20,25,30,len(frames)-1]):
        im=frames[i].resize((256,256),Image.Resampling.LANCZOS);x,y=cell%4*256,cell//4*280;contact.paste(im,(x,y),im);pen.text((x+8,y+257),str(times[i])+' ms','#e6eedc')
    contact.save(FOLDER/'contact.png');Image.blend(neutral,frames[0],.5).save(FOLDER/'source-overlay.png');save_json(FOLDER/'poses.json',states)
    identity={'rigidSources':{p['name']:{'image':p['image'],'sha256':hashlib.sha256((FOLDER/p['image']).read_bytes()).hexdigest(),'scale':[1,1]} for p in rig['parts']},'mainSegmentLengths':ml.tolist(),'sideSegmentLengths':sl.tolist(),'maxSegmentErrorPx':max(me+se),'sourceCanvas':[512,512],'runtimeScale':[1,1],'rootFinalDropPx':rig['rootDrop'],'groundY':rig['groundY'],'construction':'One fixed source per complete rigid part. Two original textured tendrils simulate independently with gravity and fixed segment lengths. Eyelids are local expression patches.'};save_json(FOLDER/'identity-check.json',identity)
    prefix='DesignAssets/Animations/CreatureDeathV2/snare-vine/';save_json(FOLDER/'death.json',{'name':rig['name'],'action':'death','sourceImage':rig['sourceImage'],'sourceAnimation':rig['sourceAnimation'],'image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':rig['pivotX'],'pivotY':rig['pivotY'],'durationsMs':rig['durationsMs'],'durationMs':sum(rig['durationsMs']),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','rig':prefix+'rig.json','renderer':prefix+'render.py','contact':prefix+'contact.png','sourceOverlay':prefix+'source-overlay.png','identityCheck':prefix+'identity-check.json','sourceCanvas':[512,512],'sourcePlacement':{'scale':[1,1],'translation':[0,0],'groundY':rig['groundY']},'method':rig['method'],'previewLoop':0,'spineCompatibilityVerified':False});print(json.dumps(identity))

if __name__=='__main__':
    main()
