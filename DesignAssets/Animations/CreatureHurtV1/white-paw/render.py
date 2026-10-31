from pathlib import Path
from PIL import Image
import numpy as np
import json
import math

folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
size = rig['canvas'][0]
neutral = Image.open(folder / 'Source/neutral.png').convert('RGBA')
weights = np.load(folder / 'Source/weights.npz')['weights'].astype(np.float32)
yy, xx = np.mgrid[:size,:size].astype(np.float32)
rgba = np.asarray(neutral).astype(np.float32)
rgba[:,:,:3] *= rgba[:,:,3:4] / 255

def control(keys, time):
    for (a,v0),(b,v1) in zip(keys, keys[1:]):
        if time <= b:
            t = max(0,min(1,(time-a)/(b-a)))
            t = t*t*(3-2*t)
            return v0+(v1-v0)*t
    return keys[-1][1]

def sample(pixels, x, y):
    valid=(x>=0)&(y>=0)&(x<size-1)&(y<size-1)
    x=np.clip(x,0,size-1.001); y=np.clip(y,0,size-1.001)
    ix=x.astype(np.int32); iy=y.astype(np.int32)
    u=(x-ix)[:,:,None]; v=(y-iy)[:,:,None]
    result=(pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v
    result*=valid[:,:,None]
    return result

def frame_at(time):
    if time == 0 or time >= 740:
        return neutral.copy()
    dx=np.zeros((size,size),np.float32); dy=dx.copy()
    for bone,weight in zip(rig['bones'],weights):
        amount=control(rig['tracks'][bone['track']],time)
        a=math.radians(bone['degrees']*amount)
        c=math.cos(a); s=math.sin(a)
        px,py=bone['pivot']
        tx,ty=bone['translation']
        dx+=((xx-px)*(c-1)-(yy-py)*s+tx*amount)*weight
        dy+=((xx-px)*s+(yy-py)*(c-1)+ty*amount)*weight
    sx=xx.copy(); sy=yy.copy()
    for iteration in range(5):
        ix=np.clip(np.rint(sx).astype(np.int32),0,size-1)
        iy=np.clip(np.rint(sy).astype(np.int32),0,size-1)
        sx=xx-dx[iy,ix]; sy=yy-dy[iy,ix]
    result=sample(rgba,sx,sy)
    result[:,:,:3]*=255/np.maximum(result[:,:,3:4],0.00001)
    result=np.uint8(np.clip(np.rint(result),0,255))
    result[result[:,:,3]==0]=0
    return Image.fromarray(result)

times=np.cumsum([0]+rig['durationsMs'][:-1]).tolist()
frames=[frame_at(t) for t in times]
frames[-1]=neutral.copy()
columns=4
sheet=Image.new('RGBA',(size*columns,size*4),(0,0,0,0))
matrix=Image.new('RGBA',(64*columns,64*4),(0,0,0,0))
for i,frame in enumerate(frames):
    sheet.paste(frame,(i%columns*size,i//columns*size))
    small=frame.resize((64,64),Image.Resampling.LANCZOS)
    matrix.paste(small,(i%columns*64,i//columns*64))
sheet.save(folder/'hurt.webp','WEBP',**{'lossless':True,'method':4})
matrix.save(folder/'hurt-matrix.webp','WEBP',**{'lossless':True,'method':4})
frames[0].save(folder/'hurt-preview.webp','WEBP',**{'save_all':True,'append_images':frames[1:],'duration':rig['durationsMs'],'loop':0,'lossless':True,'method':4,'minimize_size':False})
contact=Image.new('RGBA',(size*4,size*2),(32,39,46,255))
for j,i in enumerate([0,2,4,6,8,10,12,15]):
    contact.alpha_composite(frames[i],(j%4*size,j//4*size))
contact.convert('RGB').save(folder/'key-poses.jpg','JPEG',**{'quality':92})
print(folder.name, size, len(frames), sum(rig['durationsMs']))
