from pathlib import Path
from PIL import Image, _webp
import numpy as np
import json
import math

def write_webp(path, picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(), True, 100.0, 100.0, '', 4, 1, b'', ''))

def animation(path, pictures, durations):
 encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
 time=0
 for picture,duration in zip(pictures,durations):
  encoder.add(picture.getim(),time,True,100.0,100.0,3)
  time+=duration
 encoder.add(None,time,True,100.0,100.0,0)
 path.write_bytes(encoder.assemble('','',''))

def track(keys,time):
 if time<=keys[0][0]:return keys[0][1]
 for (t0,v0),(t1,v1) in zip(keys,keys[1:]):
  if time<=t1:
   t=(time-t0)/(t1-t0)
   t=t*t*(3-2*t)
   return v0+(v1-v0)*t
 return keys[-1][1]

def sample(pixels,x,y):
 h,w=pixels.shape[:2]
 good=(x>=0)&(x<=w-1)&(y>=0)&(y<=h-1)
 x=np.clip(x,0,w-1.001);y=np.clip(y,0,h-1.001)
 ix=x.astype(int);iy=y.astype(int)
 dx=(x-ix)[...,None];dy=(y-iy)[...,None]
 result=(pixels[iy,ix]*(1-dx)+pixels[iy,ix+1]*dx)*(1-dy)+(pixels[iy+1,ix]*(1-dx)+pixels[iy+1,ix+1]*dx)*dy
 return result*good[...,None]

def render(folder):
 rig=json.loads((folder/'rig.json').read_bytes())
 neutral=Image.open(folder/'Source/neutral.png').convert('RGBA')
 size=neutral.width
 yy,xx=np.mgrid[:size,:size].astype(float)
 texture=np.asarray(neutral).astype(float)/255
 texture[:,:,:3]*=texture[:,:,3:4]
 weights=[]
 for bone in rig['bones']:
  grid=Image.fromarray(np.asarray(bone['weights'],np.float32))
  expanded=grid.resize((size,size),Image.Resampling.BILINEAR)
  weights.append(np.asarray(expanded))
 combined=np.asarray(weights)
 total=combined.sum(0)
 combined/=np.maximum(total,1)[None,:,:]
 frames=[];time=0
 for duration in rig['durationsMs']:
  values=[track(rig['impulse'],time-bone['delayMs']) for bone in rig['bones']]
  if max(abs(v) for v in values)<1e-7:
   frame=neutral.copy()
  else:
   dx=np.zeros((size,size));dy=np.zeros((size,size))
   for bone,weight,value in zip(rig['bones'],combined,values):
    angle=np.deg2rad(bone['peak'][0]*value)
    c=math.cos(angle);s=math.sin(angle)
    px,py=bone['pivot']
    dx+=((xx-px)*(c-1)-(yy-py)*s+bone['peak'][1]*value)*weight
    dy+=((xx-px)*s+(yy-py)*(c-1)+bone['peak'][2]*value)*weight
   field=np.stack((dx,dy),-1)
   sx=xx.copy();sy=yy.copy()
   for j in range(5):
    displacement=sample(field,sx,sy)
    sx=xx-displacement[:,:,0];sy=yy-displacement[:,:,1]
   pixels=sample(texture,sx,sy)
   pixels[:,:,:3]/=np.maximum(pixels[:,:,3:4],1/255)
   frame=Image.fromarray(np.uint8(np.clip(pixels*255+.5,0,255)))
  frames.append(frame)
  time+=duration
 sheet=Image.new('RGBA',(size*4,size*4))
 matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):
  sheet.paste(frame,((i%4)*size,(i//4)*size))
  matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),((i%4)*64,(i//4)*64))
 write_webp(folder/'hurt.webp',sheet)
 write_webp(folder/'hurt-matrix.webp',matrix)
 animation(folder/'hurt-preview.webp',frames,rig['durationsMs'])
 contact=Image.new('RGB',(size*4,size*2),(232,235,228))
 for j,i in enumerate([0,2,3,4,6,8,11,15]):
  contact.paste(frames[i],((j%4)*size,(j//4)*size),frames[i])
 contact.thumbnail((1280,640))
 contact.save(folder/'hurt-contact.jpg')
 return frames


if __name__ == "__main__":
 render(Path(__file__).resolve().parent)
