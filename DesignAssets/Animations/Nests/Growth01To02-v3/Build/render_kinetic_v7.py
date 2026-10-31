from pathlib import Path
from PIL import Image,ImageDraw,WebPImagePlugin
import numpy as np
import cv2
import json,sys
BASE=Path(__file__).resolve().parent.parent
ROOT=next(p for p in [BASE,*BASE.parents] if (p/'client/nest-growth.mjs').exists())
SOURCE=BASE/'Sources/KineticV7'
KEY=sys.argv[1]
OUT=Path(sys.argv[2])/KEY
OUT.mkdir(511,True,True)
FOLDER=SOURCE/KEY
PARTS=FOLDER/'Parts'
DURATIONS=[600]+[80]*59+[1000]
Y,X=np.mgrid[0:512,0:512]

def read(path):
 return Image.open(path).convert('RGBA')

def clean(im,area):
 a=np.array(im).copy()
 n,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>16),8)
 keep=np.zeros(n,np.uint8)
 for i in range(1,n):
  if stats[i,4]>=area:keep[i]=1
 mask=cv2.dilate(keep[labels],np.ones((3,3),np.uint8))>0
 a[~mask]=0
 a[a[:,:,3]<6]=0
 return Image.fromarray(a,'RGBA')

def cut(im,mask):
 a=np.array(im).copy();a[:,:,3]=np.uint8(a[:,:,3].astype(np.float32)*mask);a[a[:,:,3]==0]=0
 return Image.fromarray(a,'RGBA')

def over(front,back):
 return Image.alpha_composite(back,front)

def move(im,dx,dy):
 out=Image.new('RGBA',(512,512));out.alpha_composite(im,(round(dx),round(dy)));return out

def local(im,pivot,target,sx,sy):
 out=Image.new('RGBA',(512,512))
 resized=im.resize((round(512*sx),round(512*sy)),Image.Resampling.LANCZOS)
 out.alpha_composite(resized,(round(target[0]-pivot[0]*sx),round(target[1]-pivot[1]*sy)))
 return out

def fitted(im,box):
 b=im.getbbox();piece=im.crop(b)
 out=Image.new('RGBA',(512,512));piece=piece.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
 out.alpha_composite(piece,(box[0],box[1]));return out

def save_part(name,im):
 im=clean(im,10);im.save(PARTS/(name+'.png'));return im

def schedule(keys,frame):
 before=keys[0]
 for key in keys:
  if frame<key[0]:break
  before=key
 return before[1]

def export_animation(frames,path):
 frames[0].encoderinfo={'append_images':frames[1:],'duration':DURATIONS,'loop':0,'lossless':True,'method':4}
 with path.open('wb') as f:WebPImagePlugin._save_all(frames[0],f,str(path))

start=read(FOLDER/'start.png');finish=read(FOLDER/'end.png')
keys=[];attachments={};bones=[]
if KEY=='pebble':
 def rock_masks(im,seeds):
  a=np.array(im);r,g,b=[a[:,:,i] for i in range(3)]
  yellow=np.uint8((a[:,:,3]>128)&(r>55)&(g>45)&(r>b*.98))
  n,labels,stats,_=cv2.connectedComponentsWithStats(yellow,8)
  result={}
  for name,(x,y) in seeds.items():
   label=int(labels[y,x])
   if label==0:raise ValueError(('missing rigid stone',name,x,y))
   core=np.uint8(labels==label)
   edge=cv2.dilate(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
   result[name]=(core|((edge>0)&(r<80)&(g<80)&(b<80))).astype(np.float32)
  return result
 oldmask=rock_masks(start,{'roof':(256,330)})['roof']
 oldroof=save_part('first-roof',cut(start,oldmask))
 oldbody=save_part('first-ground',cut(start,1-oldmask))
 masks=rock_masks(finish,{'base-left':(115,404),'base-right':(392,411),'upper-left':(125,343),'upper-right':(394,351),'roof':(270,280),'cap':(300,222)})
 layers={name:save_part(name,cut(finish,mask)) for name,mask in masks.items()}
 union=np.maximum.reduce(list(masks.values()))
 complete_room=fitted(read(PARTS/'growth-0.png'),(131,264,383,439))
 room_mask=np.float32((X>=190)&(X<=323)&(Y>=333)&(Y<=439))*(1-union)
 back=save_part('interior',over(cut(finish,room_mask),complete_room))
 ground=save_part('ground',cut(finish,np.float32(Y>=420)*(1-masks['base-left'])*(1-masks['base-right'])))
 roof_native=read(PARTS/'idle-roof.png')
 cap_near=cv2.dilate(np.uint8(masks['cap']>0),np.ones((11,11),np.uint8))
 roof_fill=fitted(read(PARTS/'growth-1.png'),(85,225,448,343))
 roof_fill=cut(roof_fill,np.float32(np.array(roof_native)[:,:,3]>16))
 roof_complete=over(cut(roof_native,1-cap_near),roof_fill)
 layers['roof']=save_part('roof-complete',roof_complete)
 bone_names=['base-left','base-right','upper-left','upper-right','first-roof','roof','cap']
 pivots={'base-left':[125,435],'base-right':[390,439],'upper-left':[177,374],'upper-right':[339,381],'first-roof':[256,370],'roof':[265,320],'cap':[322,252]}
 for name in bone_names:
  bones.append({'id':name,'parent':'root','pivot':pivots[name]})
  attachments[name]={'source':'Parts/'+('first-roof' if name=='first-roof' else 'roof-complete' if name=='roof' else name)+'.png','rigid':True,'weight':1,'scale':[1,1]}
 frames=[]
 first_roof_keys=[(0,0),(10,-4),(11,-16),(12,-34),(13,-43),(14,-27),(15,-13),(16,-16),(26,-19),(27,-32),(28,-51),(29,-68),(30,-61),(31,-52),(32,-54)]
 base_left=[(0,100),(10,85),(11,58),(12,27),(13,5),(14,0)]
 base_right=[(0,100),(11,90),(12,62),(13,24),(14,4),(15,0)]
 left_keys=[(0,100),(26,90),(27,53),(28,13),(29,-20),(30,-11),(31,2),(32,0)]
 right_keys=[(0,100),(27,90),(28,57),(29,19),(30,-17),(31,-9),(32,2),(33,0)]
 roof_keys=[(0,180),(44,125),(45,82),(46,29),(47,-13),(48,-28),(49,-18),(50,-5),(51,2),(52,0)]
 cap_keys=[(0,170),(46,130),(47,75),(48,20),(49,-31),(50,-53),(51,-31),(52,-7),(53,3),(54,0)]
 for f in range(61):
  state={'frame':f,'root':[256,448],'baseLeftY':schedule(base_left,f),'baseRightY':schedule(base_right,f),'upperLeftY':schedule(left_keys,f),'upperRightY':schedule(right_keys,f),'firstRoofY':schedule(first_roof_keys,f),'roofY':schedule(roof_keys,f),'capY':schedule(cap_keys,f)}
  keys.append(state)
  if f<10:frames.append(start.copy());continue
  if f>=55:frames.append(finish.copy());continue
  roof_y=state['firstRoofY']
  ceiling=round(351+roof_y) if f<47 else 285
  im=cut(back,np.float32(Y>=ceiling))
  if f<15:im=over(oldbody,im)
  for name,value in [('base-left',state['baseLeftY']),('base-right',state['baseRightY'])]:
   layer=move(layers[name],0,value);layer=cut(layer,np.float32(Y<448));im=over(layer,im)
  if f>=26:
   for name,value in [('upper-left',state['upperLeftY']),('upper-right',state['upperRightY'])]:im=over(move(layers[name],0,value),im)
  if f<47:im=over(move(oldroof,0,roof_y),im)
  if f>=44:
   if f<49:im=over(move(layers['cap'],0,state['capY']),im)
   im=over(move(layers['roof'],0,state['roofY']),im)
   if f>=49:im=over(move(layers['cap'],0,state['capY']),im)
  if f>=15:im=over(ground,im)
  frames.append(clean(im,10))
 phases={'foundationRise':[10,15],'foundationHold':[16,25],'supportRise':[26,33],'supportHold':[34,43],'roofAndCapRise':[44,54],'rest':[55,60]}
 markers={'foundationStart':1320,'foundationLanded':1720,'supportsStart':2600,'supportsLanded':3160,'roofStart':4040,'capLanded':4840}
 rig={'bones':[{'id':'root','parent':None,'pivot':[256,448]}]+bones,'attachments':attachments,'drawOrder':['interior','first-ground','base-left','base-right','upper-left','upper-right','first-roof','cap-behind-roof','roof','cap','ground'],'keys':keys,'fixed':['floor','ground pebbles after foundation contact'],'rigidScale':[1,1],'rootMotion':False}
else:
 upper_mask=np.zeros((512,512),np.uint8)
 polygon=np.array([[90,285],[249,285],[271,330],[281,347],[262,364],[111,365],[84,341]],np.int32)
 cv2.fillPoly(upper_mask,[polygon],1)
 curtain_mask=np.zeros((512,512),np.uint8)
 cv2.fillPoly(curtain_mask,[np.array([[191,331],[250,330],[270,355],[260,364],[195,359]],np.int32)],1)
 pool_atlas=read(SOURCE/'complete-pools.png');ap=np.array(pool_atlas)
 n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(ap[:,:,3]>110),8)
 ids=sorted([i for i in range(1,n) if stats[i,4]>5000],key=lambda i:centers[i,0])
 if len(ids)!=2:raise ValueError(('complete pool layer count',len(ids)))
 complete=[]
 for i in ids:
  piece=ap.copy();piece[:,:,3]*=np.uint8(labels==i);piece=clean(Image.fromarray(piece,'RGBA'),40);complete.append(piece.crop(piece.getbbox()))
 generated_upper=fitted(complete[1],(103,292,263,361))
 native_top=upper_mask*np.float32(Y<332)*np.float32(np.array(generated_upper)[:,:,3]>230)
 upper=save_part('upper-basin',over(cut(finish,native_top),generated_upper))
 curtain=save_part('curtain',cut(finish,curtain_mask))
 fill=fitted(complete[0],(54,336,458,448))
 lower=save_part('lower-pool',fill)
 stage_front=save_part('stage-front',cut(lower,np.float32(Y>=405)))
 front=save_part('lower-front',cut(finish,np.float32(Y>=405)))
 first_front=save_part('first-front',cut(start,np.float32(Y>=401)))
 raw=read(SOURCE/'water-actions.png');cw,ch=raw.width//2,raw.height//2
 water={};pivots={}
 for i,name in enumerate(['dome','jet','globule','crown']):
  cell=raw.crop((i%2*cw,i//2*ch,(i%2+1)*cw,(i//2+1)*ch)).resize((512,512),Image.Resampling.LANCZOS)
  a=np.array(cell);core=np.uint8(a[:,:,3]>110)
  core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
  a[:,:,3]=np.uint8(cv2.GaussianBlur(core.astype(np.float32),(3,3),.4)*255)
  cell=save_part('water-'+name,Image.fromarray(a,'RGBA'))
  box=cell.getbbox();pivot=[(box[0]+box[2])/2,box[3]-8]
  if name=='globule':pivot=[(box[0]+box[2])/2,box[1]+(box[2]-box[0])*.5]
  pivots[name]=pivot;water[name]=cell
  attachments[name]={'source':'Parts/water-'+name+'.png','pivot':pivot,'parent':'splash-root','registration':'one fixed pivot per drawing','scale':.65}
 def action(name,target,sx,sy):
  keys[-1]['actions'].append({'drawing':name,'pivot':pivots[name],'position':list(target),'scale':[sx*.65,sy*.65]})
  return local(water[name],pivots[name],target,sx*.65,sy*.65)
 def impact(frame,start_at,target):
  age=frame-start_at
  if age<0 or age>8:return None,None
  names=['dome','dome','jet','globule','globule','crown','crown','dome','dome']
  scales=[(.8,.65),(1,.8),(.8,.84),(1,1),(.95,1.08),(1,.9),(.98,.6),(.9,.46),(.75,.22)]
  offsets=[0,-3,0,-140,-74,-3,0,0,0]
  name=names[age];sx,sy=scales[age]
  return action(name,(target[0],target[1]+offsets[age]),sx,sy),name
 frames=[]
 bowl_keys=[(0,100),(28,-68),(29,-48),(30,-20),(31,6),(32,-3),(33,0)]
 for f in range(61):
  state={'frame':f,'root':[256,448],'lowerPool':f>=14,'upperBasinY':schedule(bowl_keys,f),'curtainVisible':f>=33,'splash':None,'actions':[]};keys.append(state)
  if f<9:frames.append(start.copy());continue
  if f>=55:frames.append(finish.copy());continue
  im=finish.copy() if f>=33 else lower.copy() if f>=14 else start.copy()
  if f>=28 and f<33:im=over(move(upper,0,state['upperBasinY']),im)
  first,name=impact(f,9,(256,389))
  if first is not None:im=over(first,im);state['splash']='first-'+name
  second,name=impact(f,25,(188,352 if f<29 else 323))
  if second is not None:im=over(second,im);state['splash']='upper-'+name
  third,name=impact(f,43,(278,385))
  if third is not None:im=over(third,im);state['splash']='flow-'+name
  im=over(front if f>=33 else stage_front if f>=14 else first_front,im)
  frames.append(clean(im,10))
 phases={'firstLaunch':[9,13],'firstLand':[14,17],'lowerHold':[18,24],'upperLaunch':[25,30],'upperLand':[31,33],'upperHold':[34,42],'flowLaunchAndLand':[43,51],'rest':[55,60]}
 markers={'firstLaunch':1240,'firstLand':1640,'upperLaunch':2520,'upperLanded':3160,'flowLaunch':3960,'flowLanded':4680}
 rig={'bones':[{'id':'root','parent':None,'pivot':[256,448]},{'id':'lower-pool','parent':'root','pivot':[256,448]},{'id':'upper-basin','parent':'root','pivot':[188,352]},{'id':'splash-root','parent':'root','pivot':[256,389]}],'attachments':attachments,'drawOrder':['lower-pool','upper-basin','curtain','water-action','lower-front'],'keys':keys,'fixed':['lower pool held between growth beats','front lip held within each growth stage','ground'],'rootMotion':False,'upperBasinSource':'Parts/upper-basin.png','lowerPoolSource':'Parts/lower-pool.png','curtainSource':'Parts/curtain.png','keySpace':'canvas'}

rig['sourceRoot']='Sources/KineticV7/'+KEY
if KEY=='pebble':
 for name in ['first-ground','interior','ground']:
  attachments[name]={'source':'Parts/'+name+'.png','parent':'root','fixed':True}
else:
 for name,parent in [('lower-pool','lower-pool'),('upper-basin','upper-basin'),('curtain','upper-basin'),('lower-front','root'),('stage-front','root')]:
  attachments[name]={'source':'Parts/'+name+'.png','parent':parent,'fixed':name in ['lower-pool','lower-front','stage-front']}

sheet=Image.new('RGBA',(4096,4096))
for i,frame in enumerate(frames):sheet.paste(frame,(i%8*512,i//8*512))
sheet.save(OUT/'growth.png')
export_animation(frames,OUT/'growth.webp')
previews=[]
for frame in frames:
 bg=Image.new('RGB',(512,512),'#20282e');bg.paste(frame,(0,0),frame);previews.append(bg.resize((384,384),Image.Resampling.LANCZOS))
export_animation(previews,OUT/'preview.webp')
contact=Image.new('RGB',(384*6,384*4),'#20282e')
for j,i in enumerate([0,10,11,12,13,14,15,16,25,27,28,29,30,31,32,33,43,45,46,47,48,50,54,60]):contact.paste(previews[i],(j%6*384,j//6*384))
contact.save(OUT/'contact.png')
old=json.loads((ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3'/KEY/'animation.json').read_text('utf-8'))
old.update({'method':'layered-rigid-stones-and-drawn-local-water-actions','source':'Sources/KineticV7/'+KEY+'/Parts','additionalSources':['Sources/KineticV7/water-actions.png','Sources/KineticV7/complete-pools.png'] if KEY=='spring' else [],'timeline':'rig.json','durationsMs':DURATIONS,'durationMs':6320,'phaseRanges':phases,'markersMs':markers})
old.pop('poseSchedule',None);old.pop('poseCount',None)
rig.update({'canvas':[512,512],'root':[256,448],'frameCount':61,'durationMs':6320,'phaseRanges':phases,'reference':{'start':'Sources/KineticV7/'+KEY+'/start.png','end':'Sources/KineticV7/'+KEY+'/end.png'}})
for name,obj in [('animation.json',old),('rig.json',rig)]:
 (OUT/name).write_bytes((json.dumps(obj)+'\r\n').encode('utf-8'))
print(KEY,'layered motion exported',len(frames),'frames')
