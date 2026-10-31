from pathlib import Path

from PIL import Image,ImageDraw

import numpy as np,json,math

FOLDER=Path(__file__).resolve().parent

SCALE=3



def mesh_image(texture,mesh,amount):

 size=texture.width;rgba=np.asarray(texture).astype(float);rgba[:,:,:3]*=rgba[:,:,3:4]/255;source=np.asarray(mesh['vertices'],float);destination=(source+np.asarray(mesh['peakDelta'])*amount)*SCALE;result=np.zeros((size*SCALE,size*SCALE,4),float)

 for triangle in mesh['triangles']:

  points=destination[triangle];sample=source[triangle];x0=max(0,int(np.floor(points[:,0].min())));x1=min(size*SCALE,int(np.ceil(points[:,0].max()))+1);y0=max(0,int(np.floor(points[:,1].min())));y1=min(size*SCALE,int(np.ceil(points[:,1].max()))+1)

  if x0>=x1 or y0>=y1:continue

  matrix=np.vstack([points.T,np.ones(3)])

  if abs(np.linalg.det(matrix))<1e-8:continue

  yy,xx=np.mgrid[y0:y1,x0:x1];bary=np.linalg.inv(matrix)@np.stack([xx.reshape(-1),yy.reshape(-1),np.ones(xx.size)]);inside=np.all(bary>=-.00001,axis=0);mapped=sample.T@bary;sx=np.clip(mapped[0],0,size-1.001);sy=np.clip(mapped[1],0,size-1.001);ix=np.floor(sx).astype(int);iy=np.floor(sy).astype(int);fx=(sx-ix)[:,None];fy=(sy-iy)[:,None];colors=(rgba[iy,ix]*(1-fx)+rgba[iy,ix+1]*fx)*(1-fy)+(rgba[iy+1,ix]*(1-fx)+rgba[iy+1,ix+1]*fx)*fy;target=result[y0:y1,x0:x1].reshape(-1,4).copy();target[inside]=colors[inside];result[y0:y1,x0:x1]=target.reshape(y1-y0,x1-x0,4)

 return Image.fromarray(np.uint8(np.clip(result+.5,0,255)),'RGBa').convert('RGBA')



def rigid_image(texture,delta):

 large=texture.convert('RGBa').resize((768,768),Image.Resampling.BILINEAR);dx,dy=np.asarray(delta)*SCALE

 return large.transform(large.size,Image.Transform.AFFINE,[1,0,-dx,0,1,-dy],Image.Resampling.BICUBIC).convert('RGBA')



def main():

 rig=json.loads((FOLDER/'rig.json').read_text('utf8'));meta=json.loads((FOLDER/'hurt.json').read_text('utf8'));timeline=json.loads((FOLDER/'timeline.json').read_text('utf8'));seed=Image.open(FOLDER/'Source/seed.png').convert('RGBA');parts={entry['name']:entry for entry in rig['attachments']};textures={(name,state):Image.open(FOLDER/part['texturePattern'].replace('{expression}',state)).convert('RGBA') for name,part in parts.items() for state in ['seed','half','pain']};frames=[]

 for index,pose in enumerate(timeline['poses']):

  amount=pose['load'];state=pose['expression']

  if amount==0:frames.append(seed.copy());continue

  large=Image.new('RGBA',(768,768))

  for name in rig['slots']:

   part=parts[name];texture=textures[name,state]

   layer=rigid_image(texture,np.asarray(part['translationAtPeak'])*amount) if part['binding']=='rigid' else mesh_image(texture,part['mesh'],pose['neck'] if name=='head-neck' else amount)

   large.alpha_composite(layer)

  frame=large.convert('RGBa').resize((256,256),Image.Resampling.LANCZOS).convert('RGBA');result=np.asarray(frame).copy();original=np.asarray(seed)

  for contact in rig['fixedContactAttachments']:

   x0,y0,x1,y1=contact['region'];fixed=np.asarray(Image.open(FOLDER/contact['texture']).convert('RGBA'));result[y0:y1,x0:x1]=fixed[y0:y1,x0:x1]

  frames.append(Image.fromarray(result))

 sheet=Image.new('RGBA',(1024,1024));matrix=Image.new('RGBA',(256,256))

 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*256,i//4*256));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))

 options={'lossless':True,'method':4,'exact':True};sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=meta['durationsMs'].copy();durations[-1]+=900

 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})

 contact=Image.new('RGB',(1024,552),(42,49,44));draw=ImageDraw.Draw(contact)

 for n,i in enumerate([0,1,2,4,6,8,10,15]):

  x=n%4*256;y=n//4*276;contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i),(245,245,220))

 contact.save(FOLDER/'hurt-contact.png');print('walking-forest: three fixed supports, rigid rock translation, independent neck/leg local meshes, 16 frames/760ms')



if __name__=='__main__':main()

