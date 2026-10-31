from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, _webp

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
import cv2
SIZE=512


def write_json(path,value):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    path.write_bytes((encoder.encode(value).replace("\n","\r\n")+"\r\n").encode("utf-8"))


def curve(keys,time):
    for left,right in zip(keys,keys[1:]):
        if time<=right[0]:
            v=max(0,min(1,(time-left[0])/(right[0]-left[0])))
            v=v*v*(3-2*v)
            return np.asarray(left[1:])+(np.asarray(right[1:])-left[1:])*v
    return np.asarray(keys[-1][1:])


def matrix(pivot,control):
    degrees,dx,dy=control
    a=math.radians(degrees)
    c,s=math.cos(a),math.sin(a)
    x,y=pivot
    return np.array([[c,-s,x-c*x+s*y+dx],[s,c,y-s*x-c*y+dy],[0,0,1]],np.float32)


def render(rig,neutral,time):
    controls=[curve(bone['keys'],time) for bone in rig['bones']]
    if max(float(np.max(np.abs(control))) for control in controls)<0.00001:
        return neutral.copy(),1.0
    vertices=np.asarray(rig['vertices'],np.float32)
    weights=np.asarray(rig['weights'],np.float32)
    homogeneous=np.column_stack((vertices,np.ones(len(vertices),np.float32)))
    matrices={'root':np.eye(3,3,0,np.float32)}
    displacement=np.zeros((len(vertices),2),np.float32)
    for index,bone in enumerate(rig['bones']):
        transform=matrices[bone['parent']]@matrix(bone['pivot'],controls[index])
        matrices[bone['name']]=transform
        displacement+=((homogeneous@transform.T)[:,:2]-vertices)*weights[:,index+1:index+2]
    delta=displacement.reshape((33,33,2))
    field=cv2.resize(delta,(513,513),None,0,0,cv2.INTER_LINEAR)[:512,:512]
    yy,xx=np.mgrid[:512,:512].astype(np.float32)
    fx,fy=field[:,:,0],field[:,:,1]
    dxx=np.gradient(fx)[1]
    dxy=np.gradient(fx)[0]
    dyx=np.gradient(fy)[1]
    dyy=np.gradient(fy)[0]
    determinant=(1+dxx)*(1+dyy)-dxy*dyx
    minimum=float(determinant.min())
    if minimum<=0.05:
        raise RuntimeError('Non-invertible weighted mesh '+str(time)+' '+str(minimum))
    sx,sy=xx.copy(),yy.copy()
    for iteration in range(8):
        dx=cv2.remap(fx,sx,sy,cv2.INTER_LINEAR)
        dy=cv2.remap(fy,sx,sy,cv2.INTER_LINEAR)
        sx=xx-dx
        sy=yy-dy
    texture=np.asarray(neutral).astype(np.float32)/255
    texture[:,:,:3]*=texture[:,:,3:4]
    posed=cv2.remap(texture,sx,sy,cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    posed[:,:,:3]/=np.maximum(posed[:,:,3:4],1/255)
    pixels=np.uint8(np.clip(posed*255+.5,0,255))
    pixels[pixels[:,:,3]==0]=0
    return Image.fromarray(pixels),minimum


def webp(path,picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,"",6,1,b"",""))


def animate(path,pictures,durations):
    encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for picture,duration in zip(pictures,durations):
        encoder.add(picture.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble("","",""))


def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    neutral=Image.open(HERE/'Source/neutral.png').convert('RGBA')
    frames=[]
    minimum=1.0
    for time in rig['timesMs']:
        frame,jacobian=render(rig,neutral,time)
        minimum=min(minimum,jacobian)
        frames.append(frame)
    atlas=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)))
    for index,frame in enumerate(frames):
        atlas.paste(frame,((index%4)*512,(index//4)*512))
    webp(HERE/'attack.webp',atlas)
    animate(HERE/'attack-preview.webp',frames,rig['durationsMs'])
    thumb=ROOT/'DesignAssets/Planning/UnitPreviews'/rig['name']/'attack.webp'
    thumb.parent.mkdir(511,True,True)
    animate(thumb,[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],rig['durationsMs'])
    contact=Image.new('RGB',(256*4,280*2),(33,43,37))
    for slot,index in enumerate([0,2,4,6,8,10,12,15]):
        picture=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=(slot%4)*256,(slot//4)*280+24
        contact.paste(picture,(x,y),picture)
        ImageDraw.Draw(contact).text((x+8,y-20),str(index)+' / '+str(rig['timesMs'][index])+' ms',(245,245,238))
    contact.save(HERE/'contact.png')
    metadata={'name':rig['name'],'action':'attack','motion':rig['action'],'image':'DesignAssets/Animations/CreatureAttackV1/'+rig['name']+'/attack.webp','frameSize':512,'columns':4,'frameCount':len(frames),'durationsMs':rig['durationsMs'],'durationMs':sum(rig['durationsMs']),'loop':False,'pivotX':256,'pivotY':448,'impactFrame':7,'facing':'left','rootMotion':False,'rig':'rig.json','preview':'attack-preview.webp','thumbnail':'DesignAssets/Planning/UnitPreviews/'+rig['name']+'/attack.webp','method':'original continuous textured mesh with weighted local bone controls','minimumJacobian':minimum,'neutralEndpointsIdentical':frames[0].tobytes()==frames[-1].tobytes(),'spineCompatibilityVerified':False}
    write_json(HERE/'attack.json',metadata)
    print(rig['name'],len(frames),sum(rig['durationsMs']),minimum,metadata['neutralEndpointsIdentical'])


if __name__=='__main__':
    main()
