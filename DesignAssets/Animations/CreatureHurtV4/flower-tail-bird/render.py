from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
import math

FOLDER=Path(__file__).resolve().parent

def rotation(point,degrees):
 angle=math.radians(degrees);c=math.cos(angle);s=math.sin(angle);x,y=point
 return np.asarray([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1]],float)

def warp_texture(texture,part,pose,scale):
 size=texture.width*scale
 image=texture.convert('RGBa').resize((size,size),Image.Resampling.BILINEAR)
 pixels=np.asarray(image).astype(float)
 source=np.asarray(part['mesh']['vertices'],float)
 weights=np.asarray(part['mesh']['weights'],float)
 vertices=np.column_stack([source,np.ones(len(source))])
 base=rotation(part['root'],pose['baseDegrees']);tip=base@rotation(part['joint'],pose['tipDegrees'])
 destination=source*weights[:,:1]+(vertices@base.T)[:,:2]*weights[:,1:2]+(vertices@tip.T)[:,:2]*weights[:,2:3]
 destination*=scale;source*=scale
 result=np.zeros((size,size,4),float)
 for triangle in part['mesh']['triangles']:
  points=destination[triangle];sample=source[triangle]
  x0=max(0,int(np.floor(points[:,0].min())));x1=min(size,int(np.ceil(points[:,0].max()))+1)
  y0=max(0,int(np.floor(points[:,1].min())));y1=min(size,int(np.ceil(points[:,1].max()))+1)
  if x0>=x1 or y0>=y1:continue
  matrix=np.asarray([[points[0,0],points[1,0],points[2,0]],[points[0,1],points[1,1],points[2,1]],[1,1,1]],float)
  if abs(np.linalg.det(matrix))<1e-7:continue
  yy,xx=np.mgrid[y0:y1,x0:x1]
  bary=np.linalg.inv(matrix)@np.stack([xx.reshape(-1),yy.reshape(-1),np.ones(xx.size)])
  inside=np.all(bary>=-.00001,axis=0)
  mapped=sample.T@bary
  sx=np.clip(mapped[0],0,size-1.001);sy=np.clip(mapped[1],0,size-1.001)
  ix=np.floor(sx).astype(int);iy=np.floor(sy).astype(int);fx=(sx-ix)[:,None];fy=(sy-iy)[:,None]
  colors=(pixels[iy,ix]*(1-fx)+pixels[iy,ix+1]*fx)*(1-fy)+(pixels[iy+1,ix]*(1-fx)+pixels[iy+1,ix+1]*fx)*fy
  target=result[y0:y1,x0:x1].reshape(-1,4).copy();target[inside]=colors[inside];result[y0:y1,x0:x1]=target.reshape(y1-y0,x1-x0,4)
 return Image.fromarray(np.uint8(np.clip(result+.5,0,255)),'RGBa').convert('RGBA')

def render():
 rig=json.loads((FOLDER/'rig.json').read_bytes());meta=json.loads((FOLDER/'hurt.json').read_bytes());timeline=json.loads((FOLDER/'timeline.json').read_bytes())
 size=rig['canvas'][0];scale=rig['supersample'];large=size*scale
 sources={expression:Image.open(FOLDER/'Source'/(expression+'.png')).convert('RGBA') for expression in ['neutral','half','pain']}
 bodies={expression:Image.open(FOLDER/rig['body'].format(**{'expression':expression})).convert('RGBa').resize((large,large),Image.Resampling.BILINEAR).convert('RGBA') for expression in sources}
 textures={(part['name'],expression):Image.open(FOLDER/part['texture'].format(**{'expression':expression})).convert('RGBA') for part in rig['parts'] for expression in sources}
 occluders={(part['name'],expression):Image.open(FOLDER/part['occluderTexture'].format(**{'expression':expression})).convert('RGBa').resize((large,large),Image.Resampling.BILINEAR).convert('RGBA') for part in rig['parts'] for expression in sources}
 frames=[]
 for index,pose in enumerate(timeline['poses']):
  expression=pose['expression']
  if index in [0,15]:
   frames.append(sources['neutral'].copy());continue
  body=bodies[expression].copy()
  for part in rig['parts']:body.alpha_composite(warp_texture(textures[(part['name'],expression)],part,pose['parts'][part['name']],scale))
  for part in rig['parts']:body.alpha_composite(occluders[(part['name'],expression)])
  angle=math.radians(pose['clockwiseDegrees']);c=math.cos(angle);s=math.sin(angle);px,py=[v*scale for v in rig['pivot']];dx,dy=[v*scale for v in pose['translationPixels']]
  inverse=[c,s,px-c*(px+dx)-s*(py+dy),-s,c,py+s*(px+dx)-c*(py+dy)]
  body=body.convert('RGBa').transform((large,large),Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)
  frames.append(body)
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):
  sheet.paste(frame,(i%4*size,i//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 options={'lossless':True,'method':4,'exact':True}
 sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options)
 durations=meta['durationsMs'].copy();durations[-1]+=900
 frames[0].save(FOLDER/'hurt-preview.webp','WEBP',**{'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,**options})
 small=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames]
 small[0].save(FOLDER/'hurt-thumbnail.webp','WEBP',**{'save_all':True,'append_images':small[1:],'duration':durations,'loop':0,**options})
 contact=Image.new('RGB',(size*4,size*2),(42,48,42));draw=ImageDraw.Draw(contact)
 for column,frame_index in enumerate([0,2,4,6,8,10,12,15]):
  frame=frames[frame_index];x=column%4*size;y=column//4*size;contact.paste(frame,(x,y),frame);draw.text((x+4,y+4),str(frame_index),(255,255,255))
 contact.save(FOLDER/'hurt-contact.png')
 layers=Image.new('RGB',(size*(2+len(rig['parts'])),size),(42,48,42))
 layers.paste(sources['neutral'],(0,0),sources['neutral']);body=Image.open(FOLDER/rig['body'].format(**{'expression':'neutral'})).convert('RGBA');layers.paste(body,(size,0),body)
 for i,part in enumerate(rig['parts']):
  image=textures[(part['name'],'neutral')];layers.paste(image,((i+2)*size,0),image)
 layers.save(FOLDER/'layer-contact.png')
 print(rig['species'],len(frames),sum(meta['durationsMs']))

if __name__=='__main__':render()
