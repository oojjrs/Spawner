from pathlib import Path
from PIL import Image
from collections import deque
import numpy as np
import json

work=Path(__file__).resolve().parent/'Source/flight-v2'
raw=Image.open(work/'flight-raw.png').convert('RGBA')
seed=Image.open(work/'seed.png').convert('RGBA')

def components(mask):
    seen=np.zeros(mask.shape,bool)
    result=[]
    for y,x in zip(*np.where(mask)):
        if seen[y,x]:continue
        queue=deque([(int(x),int(y))]);seen[y,x]=True;points=[]
        while queue:
            px,py=queue.popleft();points.append((px,py))
            for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                if 0<=nx<mask.shape[1] and 0<=ny<mask.shape[0] and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;queue.append((nx,ny))
        result.append(points)
    return result

def eye(image):
    p=np.array(image)
    mask=(p[:,:,0]<65)&(p[:,:,1]<75)&(p[:,:,2]<65)&(p[:,:,3]>200)
    mask[:,int(image.width*.55):]=False
    choices=[]
    for points in components(mask):
        a=np.array(points);left,top=a.min(axis=0);right,bottom=a.max(axis=0)+1
        width,height=right-left,bottom-top
        if len(points)>40 and .6<width/height<1.5 and len(points)/(width*height)>.53 and width<image.width*.18:
            choices.append((len(points),float(a[:,0].mean()),float(a[:,1].mean()),int(width),int(height)))
    if not choices:raise Exception('Eye not found')
    return max(choices)

pixels=np.array(raw)
groups=[points for points in components(pixels[:,:,3]>128) if len(points)>12000]
if len(groups)!=16:raise Exception('Expected sixteen separate birds, found '+str(len(groups)))
groups=[points for _,points in sorted(((int(np.mean([p[1] for p in points])/(raw.height/4)),float(np.mean([p[0] for p in points]))),points) for points in groups)]
slots=[];bounds=[]
for points in groups:
    a=np.array(points);left,top=a.min(axis=0);right,bottom=a.max(axis=0)+1
    left=max(0,int(left)-4);top=max(0,int(top)-4);right=min(raw.width,int(right)+4);bottom=min(raw.height,int(bottom)+4)
    crop=pixels[top:bottom,left:right].copy()
    keep=np.zeros(crop.shape[:2],bool)
    for x,y in points:keep[y-top,x-left]=True
    for _ in range(3):
        spread=keep.copy();spread[1:]|=keep[:-1];spread[:-1]|=keep[1:];spread[:,1:]|=keep[:,:-1];spread[:,:-1]|=keep[:,1:]
        keep=spread
    crop[~keep]=0
    slots.append(Image.fromarray(crop));bounds.append([left,top,right,bottom])
reference=eye(seed)
eyes=[eye(slot) for slot in slots]
scale=float(np.median([reference[3]/e[3] for e in eyes]))
target=(reference[1]+64,reference[2]+64)
output=work/'normalized';output.mkdir(511,True,True)
frames=[]
for index,(slot,landmark) in enumerate(zip(slots,eyes)):
    transform=(1/scale,0,landmark[1]-target[0]/scale,0,1/scale,landmark[2]-target[1]/scale)
    frame=slot.transform((512,512),Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC)
    frames.append(frame)
neutral=Image.new('RGBA',(512,512));neutral.alpha_composite(seed,(64,64))
frames[8]=neutral.copy();frames[15]=neutral.copy()
for index,frame in enumerate(frames):frame.save(output/(str(index).zfill(2)+'.png'))
review=Image.new('RGBA',(1024,1024),(44,65,54,255))
for index,frame in enumerate(frames):review.alpha_composite(frame.resize((256,256),Image.Resampling.LANCZOS),(index%4*256,index//4*256))
review.save(work/'contact.png')
record={'frameSize':512,'viewSize':384,'pivotX':221.5,'pivotY':371.5,'sharedScale':scale,'eyeReference':reference,'eyeAnchors':eyes,'normalizedEye':target,'componentBounds':bounds,'frames':16,'provider':'built-in image_gen','source':'flight-raw.png'}
(work/'normalization.json').write_bytes((json.dumps(record)+'\n').replace('\n','\r\n').encode('utf8'))
print(json.dumps({'frames':16,'sharedScale':scale,'componentBounds':bounds}))
