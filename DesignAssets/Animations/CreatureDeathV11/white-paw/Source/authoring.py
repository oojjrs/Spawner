from pathlib import Path
import json
import numpy as np
from PIL import Image,_webp
folder=Path(__file__).resolve().parent
data=json.loads((folder/'motion.json').read_bytes())
images=[Image.open(folder/name).convert('RGBA') for name in data['keyImages']]
bodies=[np.array(Image.open(folder/'Parts'/('body-'+str(i)+'.png')).convert('RGBa')) for i in range(3)]
yy,xx=np.mgrid[0:512,0:512]
corrections=[[np.load(folder/('correspondence-'+str(i)+'-'+str(j)+'.npz'))['arr_0'] for j in range(2)] for i in range(2)]

def sample(array,x,y):
    height,width=array.shape[:2]
    valid=(x>=0)&(y>=0)&(x<=width-1)&(y<=height-1)
    x=np.clip(x,0,width-1)
    y=np.clip(y,0,height-1)
    x0=np.floor(x).astype(int)
    y0=np.floor(y).astype(int)
    x1=np.minimum(x0+1,width-1)
    y1=np.minimum(y0+1,height-1)
    fx=(x-x0)[...,None]
    fy=(y-y0)[...,None]
    values=array[y0,x0]*(1-fx)*(1-fy)+array[y0,x1]*fx*(1-fy)+array[y1,x0]*(1-fx)*fy+array[y1,x1]*fx*fy
    values[~valid]=0
    return np.clip(np.rint(values),0,255).astype(np.uint8)

def ease(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)

def kernel(a,b):
    diff=a[:,None,:]-b[None,:,:]
    radius=np.sum(diff*diff,2)
    return radius*np.log(radius+1e-12)

def body_at(interval,amount):
    record=data['intervals'][interval]
    select=interval if amount<.5 else interval+1
    first=np.array(record['first'],float)/512
    second=np.array(record['second'],float)/512
    current=(1-amount)*first+amount*second
    eye0=np.array(record['eyeFirst'],float)
    eye1=np.array(record['eyeSecond'],float)
    eyes=(1-amount)*eye0+amount*eye1
    close=amount if interval==0 else ease(amount/.6)
    for i in range(4):
        gap=(1-close)*(eye0[i+4,1]-eye0[i,1])+close*(eye1[i+4,1]-eye1[i,1])
        eyes[i,1]=eyes[i+4,1]-gap
    current=np.vstack([current,eyes/512])
    origin=np.vstack([first if amount<.5 else second,(eye0 if amount<.5 else eye1)/512])
    n=len(current)
    affine=np.column_stack([np.ones(n),current])
    matrix=np.block([[kernel(current,current)+np.eye(n)*.00004,affine],[affine.T,np.zeros((3,3))]])
    coef=np.linalg.solve(matrix,np.vstack([origin-current,np.zeros((3,2))]))
    coords=(np.arange(128)+.5)*4-.5
    gx,gy=np.meshgrid(coords,coords)
    query=np.column_stack([gx.ravel()/512,gy.ravel()/512])
    evaluation=np.column_stack([kernel(query,current),np.ones(len(query)),query])
    delta=(evaluation@coef).reshape((128,128,2))*512
    dx=np.array(Image.fromarray(delta[:,:,0].astype(np.float32)).resize((512,512),Image.Resampling.BICUBIC))
    dy=np.array(Image.fromarray(delta[:,:,1].astype(np.float32)).resize((512,512),Image.Resampling.BICUBIC))
    result=sample(bodies[select],xx+dx,yy+dy)
    correction=corrections[interval][0 if amount<.5 else 1]
    weight=amount if amount<.5 else 1-amount
    result=sample(result,xx-weight*correction[:,:,0],yy-weight*correction[:,:,1])
    return Image.frombytes('RGBa',(512,512),result.tobytes()).convert('RGBA')

def tail_at(amount):
    interval=0 if amount<.5 else 1
    local=amount*2-interval
    roots=np.array(data['roots'],float)
    root=(1-local)*roots[interval]+local*roots[interval+1]
    index=0
    for i,slot in enumerate(data['tailSlots']):
        if slot['at']<=amount:index=i
    slot=data['tailSlots'][index]
    image=Image.open(folder/slot['image']).convert('RGBA')
    scale=slot['scale']
    point=np.array(slot['root'])
    finish=data['tailSlots'][index+1]['at'] if index+1<len(data['tailSlots']) else 1
    phase=(amount-slot['at'])/max(.00001,finish-slot['at'])
    angle=np.deg2rad(slot['settleAngleDegrees']*ease(phase))
    c=np.cos(angle)/scale
    s=np.sin(angle)/scale
    matrix=(c,s,point[0]-c*root[0]-s*root[1],-s,c,point[1]+s*root[0]-c*root[1])
    image=image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,matrix,Image.Resampling.BICUBIC).convert('RGBA')
    return image

def frame(amount):
    if amount<=0:return images[0].copy()
    if amount>=1:return images[2].copy()
    if abs(amount-.5)<1e-8:return images[1].copy()
    interval=0 if amount<.5 else 1
    local=amount*2-interval
    return Image.alpha_composite(tail_at(amount),body_at(interval,local))

def encode(path,frames,durations):
    writer=_webp.WebPAnimEncoder((512,512),0,0,False,9,17,False,False)
    timestamp=0
    for image,duration in zip(frames,durations):
        writer.add(image.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    writer.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(writer.assemble('','',''))
