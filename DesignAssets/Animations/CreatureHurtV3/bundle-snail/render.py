from pathlib import Path
from PIL import Image, ImageFilter, _webp
import numpy as np
import math
import json

def webp(path,picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',4,1,b'', ''))

def animated(path,frames,durations):
 encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
 time=0
 for frame,duration in zip(frames,durations):
  encoder.add(frame.getim(),time,True,100.0,100.0,3)
  time+=duration
 encoder.add(None,time,True,100.0,100.0,0)
 path.write_bytes(encoder.assemble('','',''))

def repair_eye(seed,donor,eye,donor_eye):
 size=seed.width
 original=np.asarray(seed).copy()
 x,y,rx,ry=eye
 yy,xx=np.mgrid[:size,:size].astype(float)
 r=np.sqrt(((xx-x)/rx)**2+((yy-y)/ry)**2)
 ring=(r>1.05)&(r<1.45)&(original[:,:,:3].max(2)>115)&(original[:,:,3]>250)
 nx=(xx-x)/rx;ny=(yy-y)/ry
 features=np.stack([np.ones_like(nx),nx,ny,nx*ny,nx*nx,ny*ny],-1)
 coefficients=np.linalg.lstsq(features[ring],original[:,:,:3][ring].astype(float),None)[0]
 surface=np.clip(features@coefficients,0,255)
 safe=np.asarray(seed.getchannel('A').filter(ImageFilter.MinFilter(3)))>245
 mask=np.clip((1.05-r)/.15,0,1)*safe
 pixels=original.astype(float)
 pixels[:,:,:3]=pixels[:,:,:3]*(1-mask[:,:,None])+surface*mask[:,:,None]
 clean=Image.fromarray(np.uint8(pixels+.5))
 mx,my,mrx,mry=donor_eye
 box=(int(mx-mrx),int(my-mry),int(mx+mrx),int(my+mry))
 crop=donor.crop(box)
 cp=np.asarray(crop).copy()
 coverage=np.clip((125-cp[:,:,:3].max(2).astype(float))/40,0,1)*cp[:,:,3]/255
 cp[:,:,3]=np.uint8(coverage*255+.5)
 line=Image.fromarray(cp)
 bbox=line.getbbox()
 if bbox:
  line=line.crop(bbox)
  factor=min(1,rx*1.65/line.width)
  line=line.resize((round(line.width*factor),round(line.height*factor)),Image.Resampling.LANCZOS)
 pain_layer=Image.new('RGBA',seed.size)
 pain_layer.alpha_composite(line,(round(x-line.width/2),round(y-line.height/2)))
 pain=clean.copy();pain.alpha_composite(pain_layer)
 ex=int(math.floor(x-rx));ey=int(math.floor(y-ry))
 eye_crop=seed.crop((ex,ey,int(math.ceil(x+rx)),int(math.ceil(y+ry))))
 ep=np.asarray(eye_crop).copy()
 eyy,exx=np.mgrid[:ep.shape[0],:ep.shape[1]].astype(float)
 er=np.sqrt(((exx+ex-x)/rx)**2+((eyy+ey-y)/ry)**2)
 ep[:,:,3]=np.uint8(np.clip((.88-er)/.10,0,1)*ep[:,:,3]+.5)
 half_eye=Image.fromarray(ep).resize((ep.shape[1],round(ep.shape[0]*.46)),Image.Resampling.LANCZOS)
 half_layer=Image.new('RGBA',seed.size)
 half_layer.alpha_composite(half_eye,(ex,round(y-half_eye.height/2)))
 half=clean.copy();half.alpha_composite(half_layer)
 return clean,pain,half,pain_layer,half_layer,Image.fromarray(np.uint8(mask*255+.5))

def render(folder):
 data=json.loads((folder/'hurt.json').read_bytes())
 timeline=json.loads((folder/'timeline.json').read_bytes())
 textures={state:Image.open(folder/'Source'/(state+'.png')).convert('RGBA') for state in ['neutral','half','pain']}
 size=data['frameSize'];pivot=np.asarray([data['pivotX'],data['pivotY']])
 frames=[]
 for pose in timeline['poses']:
  image=textures[pose['expression']]
  angle=math.radians(pose['clockwiseDegrees']);c=math.cos(angle);s=math.sin(angle)
  dx,dy=pose['translationPixels']
  px,py=pivot
  inverse=[c,s,px-c*(px+dx)-s*(py+dy),-s,c,py+s*(px+dx)-c*(py+dy)]
  if abs(angle)+abs(dx)+abs(dy)<1e-8:
   frame=image.copy()
  else:
   frame=image.convert('RGBa').transform((size,size),Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).convert('RGBA')
  frames.append(frame)
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):
  sheet.paste(frame,((i%4)*size,(i//4)*size))
  matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),((i%4)*64,(i//4)*64))
 webp(folder/'hurt.webp',sheet);webp(folder/'hurt-matrix.webp',matrix)
 durations=data['durationsMs'].copy();durations[-1]+=900
 animated(folder/'hurt-preview.webp',frames,durations)
 animated(folder/'hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
 contact=Image.new('RGB',(size*4,size*2),(225,231,221))
 for j,i in enumerate([0,1,2,4,6,8,10,15]):
  contact.paste(frames[i],((j%4)*size,(j//4)*size),frames[i])
 contact.save(folder/'hurt-contact.png')
 return frames


if __name__ == "__main__":
 render(Path(__file__).resolve().parent)
