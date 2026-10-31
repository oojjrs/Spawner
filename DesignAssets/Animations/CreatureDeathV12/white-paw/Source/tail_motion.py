from pathlib import Path
import json
import numpy as np
from PIL import Image
folder=Path(__file__).resolve().parent
spec=json.loads((folder/'tail-flow.json').read_bytes())
poses=spec['poses']
times=np.array([v['at'] for v in poses])
textures=[np.array(Image.open(folder/v['image']).convert('RGBa')) for v in poses]
fields=[np.load(folder/'Tail'/('flow-'+str(i).zfill(2)+'.npz')) for i in range(len(poses)-1)]
base=[v['arr_0'] for v in fields]
refine=[v['arr_1'] for v in fields]
yy,xx=np.mgrid[0:512,0:512]
coarse=(np.arange(128)+.5)*4-.5
gx,gy=np.meshgrid(coarse,coarse)

def sample(array,x,y):
    height,width=array.shape[:2]
    valid=(x>=0)&(y>=0)&(x<=width-1)&(y<=height-1)
    x=np.clip(x,0,width-1)
    y=np.clip(y,0,height-1)
    x0=np.floor(x).astype(int)
    y0=np.floor(y).astype(int)
    x1=np.minimum(x0+1,width-1)
    y1=np.minimum(y0+1,height-1)
    fx=(x-x0)[:,:,None]
    fy=(y-y0)[:,:,None]
    result=array[y0,x0]*(1-fx)*(1-fy)+array[y0,x1]*fx*(1-fy)+array[y1,x0]*(1-fx)*fy+array[y1,x1]*fx*fy
    result[~valid]=0
    return result

def expand(array):
    return np.array(Image.fromarray(array.astype(np.float32)).resize((512,512),Image.Resampling.BICUBIC))

def tail_image(amount,root):
    index=min(len(poses)-2,max(0,int(np.searchsorted(times,amount,'right')-1)))
    local=np.clip((amount-times[index])/(times[index+1]-times[index]),0,1)
    side=0 if local<.5 else 1
    fraction=local if side==0 else 1-local
    x=gx.copy()
    y=gy.copy()
    for _ in range(12):
        flow=sample(base[index][side],x/4-.375,y/4-.375)
        x=(x+gx-fraction*flow[:,:,0])/2
        y=(y+gy-fraction*flow[:,:,1])/2
    px=xx+expand(x-gx)
    py=yy+expand(y-gy)
    pixels=sample(textures[index+side],px,py)
    correction=refine[index][side]
    dx=expand(correction[:,:,0])
    dy=expand(correction[:,:,1])
    pixels=sample(pixels,xx-fraction*dx,yy-fraction*dy)
    delta=np.array(root)-np.array(spec['root'])
    pixels=sample(pixels,xx-delta[0],yy-delta[1])
    pixels=np.clip(np.rint(pixels),0,255).astype(np.uint8)
    return Image.frombytes('RGBa',(512,512),pixels.tobytes()).convert('RGBA')