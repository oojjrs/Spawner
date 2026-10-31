from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import math
import json

FOLDER=Path(__file__).resolve().parent

def affine(image,pivot,degrees,delta):
 if abs(degrees)+sum(abs(v) for v in delta)<1e-8:return image.copy()
 scale=3;large=image.convert('RGBa').resize((image.width*scale,image.height*scale),Image.Resampling.BILINEAR);px,py=[v*scale for v in pivot];dx,dy=[v*scale for v in delta];r=math.radians(degrees);c=math.cos(r);s=math.sin(r);inverse=[c,s,px-c*(px+dx)-s*(py+dy),-s,c,py+s*(px+dx)-c*(py+dy)]
 return large.transform(large.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).resize(image.size,Image.Resampling.LANCZOS).convert('RGBA')

def soft_neck(texture,mesh,amount,delta):
 size=texture.width;scale=3;rgba=np.asarray(texture).astype(float);rgba[:,:,:3]*=rgba[:,:,3:4]/255;source=np.asarray(mesh['vertices'],float);weight=np.asarray(mesh['weights'],float)[:,1:2];destination=(source+weight*np.asarray(delta)*amount)*scale;result=np.zeros((size*scale,size*scale,4),float)
 for triangle in mesh['triangles']:
  points=destination[triangle];sample=source[triangle];x0=max(0,int(np.floor(points[:,0].min())));x1=min(size*scale,int(np.ceil(points[:,0].max()))+1);y0=max(0,int(np.floor(points[:,1].min())));y1=min(size*scale,int(np.ceil(points[:,1].max()))+1)
  if x0>=x1 or y0>=y1:continue
  matrix=np.vstack([points.T,np.ones(3)])
  if abs(np.linalg.det(matrix))<1e-8:continue
  yy,xx=np.mgrid[y0:y1,x0:x1];bary=np.linalg.inv(matrix)@np.stack([xx.reshape(-1),yy.reshape(-1),np.ones(xx.size)]);inside=np.all(bary>=-.00001,axis=0);mapped=sample.T@bary;sx=np.clip(mapped[0],0,size-1.001);sy=np.clip(mapped[1],0,size-1.001);ix=np.floor(sx).astype(int);iy=np.floor(sy).astype(int);fx=(sx-ix)[:,None];fy=(sy-iy)[:,None];colors=(rgba[iy,ix]*(1-fx)+rgba[iy,ix+1]*fx)*(1-fy)+(rgba[iy+1,ix]*(1-fx)+rgba[iy+1,ix+1]*fx)*fy;target=result[y0:y1,x0:x1].reshape(-1,4).copy();target[inside]=colors[inside];result[y0:y1,x0:x1]=target.reshape(y1-y0,x1-x0,4)
 return Image.fromarray(np.uint8(np.clip(result+.5,0,255)),'RGBa').convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)

def main():
 rig=json.loads((FOLDER/'rig.json').read_text('utf8'));meta=json.loads((FOLDER/'hurt.json').read_text('utf8'));timeline=json.loads((FOLDER/'timeline.json').read_text('utf8'));size=meta['frameSize'];sources={key:Image.open(FOLDER/path).convert('RGBA') for key,path in rig['sources'].items()};frames=[]
 for index,pose in enumerate(timeline['poses']):
  state=pose['expression']
  if index in [0,15]:frames.append(sources['seed'].copy());continue
  if rig['method']=='soft-neck-retraction':
   amount=pose['neckRetraction'];delta=[v*amount for v in rig['neckTranslationPixels']];frame=Image.new('RGBA',(size,size))
   for part in rig['attachments']:
    texture=Image.open(FOLDER/('Parts/'+part['name']+'-'+state+'.png')).convert('RGBA');frame.alpha_composite(affine(texture,part['pivot'],pose['localDegrees'][part['name']],delta))
   neck=Image.open(FOLDER/('Parts/neck-'+state+'.png')).convert('RGBA');frame.alpha_composite(soft_neck(neck,rig['neckMesh'],amount,rig['neckTranslationPixels']));frame.alpha_composite(Image.open(FOLDER/('Parts/planted-body-'+state+'.png')).convert('RGBA'))
  else:
   if rig['attachments']:
    frame=Image.new('RGBA',(size,size))
    for part in rig['attachments']:
     texture=Image.open(FOLDER/('Parts/'+part['name']+'-'+state+'.png')).convert('RGBA');frame.alpha_composite(affine(texture,part['pivot'],pose['localDegrees'][part['name']],[0,0]))
    frame.alpha_composite(Image.open(FOLDER/('Parts/base-'+state+'.png')).convert('RGBA'))
   else:frame=sources[state].copy()
   frame=affine(frame,rig['support'],pose['clockwiseDegrees'],[0,0])
  frames.append(frame)
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*size,i//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 options={'lossless':True,'method':4,'exact':True};sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=meta['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 contact=Image.new('RGB',(size*4,(size+20)*2),(42,49,44));draw=ImageDraw.Draw(contact)
 for n,i in enumerate([0,1,2,4,6,8,10,15]):
  x=n%4*size;y=n//4*(size+20);contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i),(245,245,220))
 contact.save(FOLDER/'hurt-contact.png');print(FOLDER.name,rig['method'],'16 frames / 760 ms')

if __name__=='__main__':main()
