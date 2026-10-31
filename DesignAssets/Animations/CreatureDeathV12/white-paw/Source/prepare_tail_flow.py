from pathlib import Path
import json
import numpy as np
from PIL import Image
import cv2
f=Path(__file__).resolve().parent
spec=json.loads((f/'tail-flow.json').read_bytes())
rows=[(v['at'],v['image']) for v in spec['poses']]
images=[np.array(Image.open(f/name).convert('RGBa')) for _,name in rows]
yy,xx=np.mgrid[0:512,0:512]
root=np.sqrt((xx-349)**2+(yy-295)**2)
anchor=np.clip((root-17)/24,0,1)
def represent(image):
    mask=(image[:,:,3]>=128).astype(np.uint8)
    inside=cv2.distanceTransform(mask,cv2.DIST_L2,5)
    outside=cv2.distanceTransform(1-mask,cv2.DIST_L2,5)
    sdf=np.clip(127+(inside-outside)*3,0,255)
    rgb=image[:,:,:3]+np.array([53,67,64])*(1-image[:,:,3:]/255)
    gray=cv2.cvtColor(np.clip(rgb,0,255).astype(np.uint8),cv2.COLOR_RGB2GRAY)
    return np.rint(sdf*.8+gray*.2).astype(np.uint8)
def flow_between(a,b):
    engine=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    engine.setFinestScale(0)
    engine.setGradientDescentIterations(100)
    engine.setVariationalRefinementIterations(30)
    flow=engine.calc(represent(a),represent(b),None)
    flow=cv2.GaussianBlur(flow,(5,5),1)
    length=np.sqrt((flow*flow).sum(2))
    return flow*np.minimum(1,110/(length+1e-6))[:,:,None]*anchor[:,:,None]
def remap(array,x,y):
    return cv2.remap(array,x.astype(np.float32),y.astype(np.float32),cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)
def warp(image,flow,amount):
    x=xx.astype(float)
    y=yy.astype(float)
    for _ in range(16):
        current=remap(flow,x,y)
        x=(x+xx-amount*current[:,:,0])/2
        y=(y+yy-amount*current[:,:,1])/2
    return remap(image,x,y)
def small(flow):
    return np.stack([np.array(Image.fromarray(flow[:,:,c].astype(np.float32)).resize((128,128),Image.Resampling.BILINEAR)) for c in range(2)],2)
for i in range(len(rows)-1):
    a,b=images[i:i+2]
    base=[flow_between(a,b),flow_between(b,a)]
    half=[warp(a,base[0],.5),warp(b,base[1],.5)]
    refine=[flow_between(half[0],half[1]),flow_between(half[1],half[0])]
    np.savez_compressed(f/'Tail'/('flow-'+str(i).zfill(2)+'.npz'),np.array([small(v) for v in base]),np.array([small(v) for v in refine]))
print(json.dumps({'tailPoses':len(rows),'fields':len(rows)-1,'fieldSize':128}))