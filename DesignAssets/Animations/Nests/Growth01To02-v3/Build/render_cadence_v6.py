from pathlib import Path
from PIL import Image,WebPImagePlugin
import numpy as np
import cv2
import json,sys
BASE=Path(__file__).resolve().parent.parent
ROOT=next(p for p in [BASE,*BASE.parents] if (p/'client/nest-growth.mjs').exists())
SOURCE=ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3/Sources/DrawnRepairV5'
CADENCE=BASE/'Sources/CadenceV6'
DRAWINGS=json.loads((SOURCE/'drawings.json').read_text('utf-8'))
TIMELINE=json.loads((CADENCE/'timelines.json').read_text('utf-8'))
KEY=sys.argv[1]
SPEC=DRAWINGS[KEY]
PLAN=TIMELINE['tribes'][KEY]
OUT=Path(sys.argv[2])/KEY
OUT.mkdir(511,True,True)
PREVIEW=ROOT/'$Trash/NestGrowthCadence-v6/rendered'
PREVIEW.mkdir(511,True,True)

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

def placed(image,sx,sy,dy):
 b=bounds(image)
 resized=image.resize((round(image.width*sx),round(image.height*sy)),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(512,512))
 x=round(256-(b[0]+b[2])*sx/2)
 y=round(448-b[3]*sy+dy)
 canvas.paste(resized,(x,y))
 return purified(canvas)


def purified(image):
 p=np.array(image).copy()
 p[p[:,:,3]<6]=0
 n,lab,st,ct=cv2.connectedComponentsWithStats(np.uint8(p[:,:,3]>16),8)
 for i in range(1,n):
  if st[i,4]>=10:
   continue
  tiny=lab==i
  around=cv2.dilate(np.uint8(tiny),np.ones((3,3),np.uint8))>0
  protect=(lab!=i)&(p[:,:,3]>16)
  p[around&(~protect)]=0
 return Image.fromarray(p,'RGBA')


atlas=Image.open(SOURCE/SPEC['sheet']).convert('RGBA')
c,r=SPEC['grid']
primary=SPEC.get('primaryDrawings',24)
cells=extract(atlas,c,r,primary)
settle=[]
if 'settleSheet' in SPEC:
 settle_atlas=Image.open(SOURCE/SPEC['settleSheet']).convert('RGBA')
 sc,sr=SPEC['settleGrid']
 settle=extract(settle_atlas,sc,sr,sc*sr)
 cells.extend(settle)
start=Image.open(CADENCE/'References'/(KEY+'-start.png')).convert('RGBA')
finish=Image.open(CADENCE/'References'/(KEY+'-end.png')).convert('RGBA')
a,b=bounds(start),bounds(finish)
f,l=bounds(cells[0]),bounds(cells[primary-1])
small_scale=((a[2]-a[0])/(f[2]-f[0]),(a[3]-a[1])/(f[3]-f[1]))
grown_scale=((b[2]-b[0])/(l[2]-l[0]),(b[3]-b[1])/(l[3]-l[1]))
spore=[]
if KEY=='spore':
 spore_atlas=Image.open(CADENCE/'spore-lowered-growth.png').convert('RGBA')
 spore=extract(spore_atlas,3,2,6)
 adult=bounds(spore[5])
 spore_scale=((b[2]-b[0])/(adult[2]-adult[0]),(b[3]-b[1])/(adult[3]-adult[1]))
poses={}
registration={}
for name,p in PLAN['poses'].items():
 source=p['source']
 image=start if source=='start' else finish if source=='end' else spore[p['cel']] if source=='sporeGrowth' else cells[p['cel']]
 mode=p['scale']
 if mode=='copy':
  pose_image=image.copy()
  factors=[1,1]
 else:
  if mode=='small':
   sx,sy=small_scale
  elif mode=='grown':
   sx,sy=grown_scale
  elif mode=='settle':
   sb=bounds(cells[-1])
   sx,sy=(b[2]-b[0])/(sb[2]-sb[0]),(b[3]-b[1])/(sb[3]-sb[1])
  elif mode=='sporeGrown':
   sx,sy=spore_scale
  else:
   ib=bounds(image)
   sx=p['width']/(ib[2]-ib[0])
   sy=p['height']/(ib[3]-ib[1]) if 'height' in p else sx
  pose_image=placed(image,sx,sy,p['offsetY'])
  factors=[sx,sy]
 poses[name]=pose_image
 registration[name]={'source':p,'scale':factors,'bounds':bounds(pose_image)}
frames=[poses[name] for name in PLAN['frames']]
durations=TIMELINE['durationsMs']
sheet=Image.new('RGBA',(4096,4096))
for i,frame in enumerate(frames):
 sheet.paste(frame,(i%8*512,i//8*512))
sheet.save(OUT/'growth.png')
animate(frames,OUT/'growth.webp',durations)
preview=[]
for frame in frames:
 bg=Image.new('RGB',(512,512),'#20282e')
 bg.paste(frame,(0,0),frame)
 preview.append(bg.resize((384,384),Image.Resampling.LANCZOS))
animate(preview,PREVIEW/(KEY+'.webp'),durations)
names=list(poses)
contact=Image.new('RGB',(512*5,512*((len(names)+4)//5)),'#20282e')
for i,name in enumerate(names):
 contact.paste(poses[name],(i%5*512,i//5*512),poses[name])
contact.save(PREVIEW/(KEY+'-poses.png'))
old=json.loads((ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3'/KEY/'animation.json').read_text('utf-8'))
metadata=dict(old)
metadata.update({'method':'held-poses-staged-growth-impacts','durationsMs':durations,'durationMs':sum(durations),'poseSchedule':PLAN['frames'],'phaseRanges':PLAN['phaseRanges'],'markersMs':PLAN['markersMs'],'timeline':'Sources/CadenceV6/timelines.json'})
metadata['audio']=dict(old['audio'])
metadata['audio']['startMs']=600
metadata.pop('runtimeKeyIndices',None)
metadata.pop('drawingCount',None)
metadata['poseCount']=len(poses)
metadata['additionalSources']=['Sources/CadenceV6/spore-lowered-growth.png'] if KEY=='spore' else []
(OUT/'animation.json').write_bytes((json.dumps(metadata)+'\r\n').encode('utf-8'))
(OUT/'rig.json').write_bytes((json.dumps({'canvas':[512,512],'root':[256,448],'method':'explicit-held-poses','timeline':'Sources/CadenceV6/timelines.json','poses':registration,'poseSchedule':PLAN['frames'],'phaseRanges':PLAN['phaseRanges'],'durationMs':sum(durations)})+'\r\n').encode('utf-8'))
print(KEY,'duration',sum(durations),'poses',len(poses),'phases',PLAN['phaseRanges'])
