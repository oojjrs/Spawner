from pathlib import Path
from PIL import Image, WebPImagePlugin
import numpy as np
import cv2
import json, sys

BASE=Path(__file__).resolve().parent.parent
SOURCE=BASE/'Sources/DrawnRepairV5'
ROOT=next(p for p in [BASE,*BASE.parents] if (p/'client/nest-growth.mjs').exists())
WORK=ROOT/'$Trash/NestGrowthRepair-v5'
PREVIEW=WORK/'drawn-rendered'
PREVIEW.mkdir(511,True,True)
CONFIG=json.loads((SOURCE/'drawings.json').read_text('utf-8'))
KEY=sys.argv[1]
SPEC=CONFIG[KEY]
OUT=BASE/KEY
OUT.mkdir(511,True,True)


def matte(image,minimum):
 pixels=np.array(image.convert('RGBA')).copy()
 rgb=pixels[:,:,:3].astype(np.float32)
 core=np.uint8(pixels[:,:,3]>110)
 edge=core-cv2.erode(core,np.ones((5,5),np.uint8))
 keyed=((rgb[:,:,0]<30)&(rgb[:,:,1]>220)&(rgb[:,:,2]<80))|((rgb[:,:,0]<30)&(rgb[:,:,2]>210)&(rgb[:,:,1]<100))|((rgb[:,:,0]<25)&(rgb[:,:,1]>200)&(rgb[:,:,2]>200))
 core[(edge>0)&keyed]=0
 core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
 count,labels,stats,centers=cv2.connectedComponentsWithStats(core,8)
 keep=np.zeros(count,np.uint8)
 for i in range(1,count):
  if stats[i,4]>=minimum:
   keep[i]=1
 core=keep[labels]
 alpha=cv2.GaussianBlur(core.astype(np.float32),(3,3),.4)
 pixels[:,:,3]=np.uint8(np.clip(alpha*255+.5,0,255))
 pixels[pixels[:,:,3]<5]=0
 return Image.fromarray(pixels,'RGBA')


def bounds(image):
 a=np.array(image)[:,:,3]
 y,x=np.where(a>32)
 return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]


def canonical(name):
 im=Image.open(SOURCE/'References'/(KEY+'-'+name+'.png')).convert('RGBA')
 im=matte(im,200)
 return im.resize((512,512),Image.Resampling.LANCZOS)


def animate(frames,path,durations):
 frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
 with path.open('wb') as stream:
  WebPImagePlugin._save_all(frames[0],stream,str(path))


def extract(atlas,columns,rows,expected):
 pixels=np.array(atlas)
 count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(pixels[:,:,3]>110),8)
 large=[i for i in range(1,count) if stats[i,4]>500]
 large.sort(key=lambda i:centers[i,1])
 if len(large)<expected:
  raise ValueError(('missing complete drawings',KEY,len(large),expected))
 large=large[:expected]
 ordered=[]
 for row in range((expected+columns-1)//columns):
  ordered.extend(sorted(large[row*columns:row*columns+columns],key=lambda i:centers[i,0]))
 assignments={label:i for i,label in enumerate(ordered)}
 for label in range(1,count):
  if label in assignments or stats[label,4]<8:
   continue
  cx,cy=centers[label]
  distances=[]
  for main in ordered:
   x,y,w,h,area=stats[main]
   dx=max(x-cx,0,cx-(x+w))
   dy=max(y-cy,0,cy-(y+h))
   distances.append(dx*dx+dy*dy)
  nearest=int(np.argmin(distances))
  if distances[nearest]<30*30:
   assignments[label]=nearest
 cells=[]
 for i,main in enumerate(ordered):
  owns=np.array([label for label,index in assignments.items() if index==i])
  mask=np.isin(labels,owns)
  y,x=np.where(mask)
  crop=(int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1))
  part=pixels[crop[1]:crop[3],crop[0]:crop[2]].copy()
  part[:,:,3]*=mask[crop[1]:crop[3],crop[0]:crop[2]]
  cells.append(matte(Image.fromarray(part,'RGBA'),8 if KEY=='pebble' else 18))
 return cells


atlas=Image.open(SOURCE/SPEC['sheet']).convert('RGBA')
columns,rows=SPEC['grid']
primary=SPEC.get('primaryDrawings',24)
cells=extract(atlas,columns,rows,primary)
if 'settleSheet' in SPEC:
 settle_atlas=Image.open(SOURCE/SPEC['settleSheet']).convert('RGBA')
 sc,sr=SPEC['settleGrid']
 cells.extend(extract(settle_atlas,sc,sr,sc*sr))
first=bounds(cells[0])
last=bounds(cells[primary-1])
reference_start=canonical('start')
reference_end=canonical('end')
ra=bounds(reference_start)
rb=bounds(reference_end)
base_scale=(ra[2]-ra[0])/(first[2]-first[0])
end_scale=(rb[2]-rb[0])/(last[2]-last[0])
base_y=(ra[3]-ra[1])/(first[3]-first[1])
end_y=(rb[3]-rb[1])/(last[3]-last[1])
keys=[]
measurements=[]
for i,cell in enumerate(cells):
 b=bounds(cell)
 t=float(np.clip((i-5)/max(1,primary-9),0,1))
 t=t*t*(3-2*t)
 scale=base_scale+(end_scale-base_scale)*t
 scale_y=base_y+(end_y-base_y)*t
 if i>=primary:
  settle=bounds(cells[-1])
  scale=(rb[2]-rb[0])/(settle[2]-settle[0])
  scale_y=(rb[3]-rb[1])/(settle[3]-settle[1])
 resized=cell.resize((round(cell.width*scale),round(cell.height*scale_y)),Image.Resampling.LANCZOS)
 x=round(256-(b[0]+b[2])*scale/2)
 y=round(448-b[3]*scale_y)
 canvas=Image.new('RGBA',(512,512))
 canvas.paste(resized,(x,y))
 pixels2=np.array(canvas).copy()
 pixels2[pixels2[:,:,3]<6]=0
 count2,labels2,stats2,centers2=cv2.connectedComponentsWithStats(np.uint8(pixels2[:,:,3]>16),8)
 for label2 in range(1,count2):
  if stats2[label2,4]>=10:
   continue
  small=labels2==label2
  nearby=cv2.dilate(np.uint8(small),np.ones((3,3),np.uint8))>0
  protect=(labels2!=label2)&(pixels2[:,:,3]>16)
  pixels2[nearby&(~protect)]=0
 canvas=Image.fromarray(pixels2,'RGBA')
 keys.append(canvas)
 measurements.append({'key':i,'sourceBounds':b,'scale':[scale,scale_y],'translation':[x,y],'registeredBounds':bounds(canvas)})
keys[0]=reference_start
keys[-1]=reference_end
frames=[]
indices=[]
for i in range(61):
 index=round(i*23/60)
 frames.append(keys[index])
 indices.append(index)
frames[0]=keys[0]
frames[-1]=keys[-1]
DURATIONS=[500]+[40]*59+[900]
sheet=Image.new('RGBA',(4096,4096))
for i,frame in enumerate(frames):
 sheet.paste(frame,(i%8*512,i//8*512))
sheet.save(OUT/'growth.png')
frames[-1].save(OUT/'level-02.png')
animate(frames,OUT/'growth.webp',DURATIONS)
preview=[]
for frame in frames:
 bg=Image.new('RGB',(512,512),'#20282e')
 bg.paste(frame,(0,0),frame)
 preview.append(bg)
animate([im.resize((384,384),Image.Resampling.LANCZOS) for im in preview],PREVIEW/(KEY+'.webp'),DURATIONS)
contact=Image.new('RGB',(3072,2048),'#20282e')
for i,key in enumerate(keys):
 contact.paste(key,(i%6*512,i//6*512),key)
contact.save(PREVIEW/(KEY+'-all-keys.png'))
old=json.loads((ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3'/KEY/'animation.json').read_text('utf-8'))
references=json.loads((SOURCE/'References/references.json').read_text('utf-8'))
metadata={'method':'complete-drawn-animation-keys','source':str((SOURCE/SPEC['sheet']).relative_to(BASE)).replace('\\','/'),'frameSize':[512,512],'frameCount':61,'columns':8,'rows':8,'root':[256,448],'durationsMs':DURATIONS,'loop':False,'previewRepeats':True,'drawingCount':24,'runtimeKeyIndices':indices,'reference':references[KEY],'audio':old['audio'],'markersMs':SPEC.get('markersMs',old['markersMs'])}
(OUT/'animation.json').write_bytes((json.dumps(metadata)+'\r\n').encode('utf-8'))
(OUT/'rig.json').write_bytes((json.dumps({'canvas':[512,512],'root':[256,448],'method':'full-drawn-cels','drawingAtlas':SPEC['sheet'],'additionalDrawingAtlas':SPEC.get('settleSheet'),'primaryDrawingCount':SPEC.get('primaryDrawings',24),'drawingGrid':SPEC['grid'],'additionalDrawingGrid':SPEC.get('settleGrid'),'registration':measurements,'runtimeKeyIndices':indices,'sourceReferences':references[KEY]})+'\r\n').encode('utf-8'))
print(KEY,atlas.size,base_scale,[m['registeredBounds'] for m in measurements])