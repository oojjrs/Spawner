from pathlib import Path
from PIL import Image,ImageDraw,WebPImagePlugin
import numpy as np
import cv2
import json,sys
BASE=Path(__file__).resolve().parent.parent
ROOT=next(p for p in [BASE,*BASE.parents] if (p/'client/nest-growth.mjs').exists())
SOURCE=BASE/'Sources/SupportedV8'
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
growth=[.76,.77,.80,.85,.91,.97,1,1,1,1]
frames=[];keys=[];attachments={}

def root_scale(im,scale):
 return local(im,[256,448],[256,448],scale,scale)

def front_replace(im,front):
 a=np.array(im).copy();b=np.array(front);mask=b[:,:,3]>0;a[mask]=b[mask];return Image.fromarray(a,'RGBA')

if KEY=='sprout':
 order=[8,9,6,7,0,10,4,5,1,2,3]
 def separated(reference,stage):
  sources={i:read(PARTS/(str(stage)+'-'+str(i)+'.png')) for i in order}
  full=Image.new('RGBA',(512,512))
  for i in order:full=over(sources[i],full)
  raw=full.getbbox();target=reference.getbbox();scale=(target[2]-target[0])/(raw[2]-raw[0])
  sources={i:root_scale(im,scale) for i,im in sources.items()}
  owner=np.zeros((512,512),np.uint8)
  for i in order:owner[np.array(sources[i])[:,:,3]>32]=i+1
  needed=np.array(reference)[:,:,3]>0
  for _ in range(48):
   empty=(owner==0)&needed
   if not empty.any():break
   grown=cv2.dilate(owner,np.ones((3,3),np.uint8));owner[empty]=grown[empty]
  pixels=np.array(reference);r,g,b=[pixels[:,:,i] for i in range(3)]
  material=np.uint8((pixels[:,:,3]>128)&(r>65)&(g>80)&(b>40))
  count,labels,stats,_=cv2.connectedComponentsWithStats(material,8)
  points=[(170,330),(342,330)] if stage==0 else [(153,300),(359,300)]
  selected=[int(labels[y,x]) for x,y in points]
  if 0 in selected or selected[0]==selected[1]:raise ValueError(('petal segmentation',stage,selected))
  front=cv2.dilate(np.uint8(np.isin(labels,selected)),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(17,17))).astype(np.float32)
  template_fore=np.isin(owner,[2,3,4,9,10])
  foreground_labels=[i for i in range(1,count) if i not in selected and np.count_nonzero(template_fore&(labels==i))>max(20,stats[i,4]*.25)]
  fore=cv2.dilate(np.uint8(np.isin(labels,foreground_labels)),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))).astype(np.float32)
  hidden=Image.new('RGBA',(512,512))
  for i in [6,7,0,10]:hidden=over(sources[i],hidden)
  background=clean(over(cut(reference,(1-front)*(1-fore)),cut(hidden,front)),200)
  foreground=clean(cut(reference,fore),100)
  original_front=cut(reference,front)
  return background,foreground,original_front,scale
 bg0,fg0,front0,scale0=separated(start,0)
 bg2,fg2,front2,scale2=separated(finish,2)
 for name,im in [('first-background',bg0),('first-foreground',fg0),('grown-background',bg2),('grown-foreground',fg2),('first-front',front0),('grown-front',front2)]:save_part(name,im)
 raw=read(SOURCE/'petal-pairs.png');cw,ch=raw.width//3,raw.height//2;drawings=[];pivots=[]
 for i in range(6):
  cell=raw.crop((i%3*cw,i//3*ch,(i%3+1)*cw,(i//3+1)*ch)).resize((512,512),Image.Resampling.LANCZOS)
  a=np.array(cell);mask=np.uint8(a[:,:,3]>110);mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)));a[:,:,3]=np.uint8(cv2.GaussianBlur(mask.astype(np.float32),(3,3),.4)*255)
  cell=save_part('petals-'+str(i),Image.fromarray(a,'RGBA'));box=cell.getbbox();a=np.array(cell)[:,:,3];yy,xx=np.where((a>110)&(np.indices(a.shape)[0]>=box[3]-5));pivot=[float(np.mean(xx)),float(box[3]-2)]
  drawings.append(cell);pivots.append(pivot)
  attachments['petals-'+str(i)]={'source':'Parts/petals-'+str(i)+'.png','pivot':pivot,'parent':'petal-hinge'}
 open_box=drawings[5].getbbox();target_box=front2.getbbox();drawing_scale=(target_box[2]-target_box[0])/(open_box[2]-open_box[0])
 ratio=(front0.getbbox()[2]-front0.getbbox()[0])/(target_box[2]-target_box[0])
 small_hinge=front0.getbbox()[3]+3;grown_hinge=front2.getbbox()[3]+3
 close=[5,4,3,2,1,0];opening=[0,1,1,2,3,3,4,5,5]
 for f in range(61):
  if f==0:frames.append(start.copy());keys.append({'frame':f,'phase':'actual-first'});continue
  if f>=40:frames.append(finish.copy());keys.append({'frame':f,'phase':'actual-finished'});continue
  if f<=12:
   scale=ratio;hinge=small_hinge;bg=bg0;fg=fg0;pose=close[f-1] if f<=6 else 0
  else:
   body_scale=growth[min(f-13,9)] if f<=22 else 1
   t=(body_scale-growth[0])/(1-growth[0]);scale=ratio+(1-ratio)*t;hinge=small_hinge+(grown_hinge-small_hinge)*t
   bg=root_scale(bg2,body_scale);fg=root_scale(fg2,body_scale);pose=0 if f<33 else opening[f-33]
  if f==1:petals=front0.copy()
  else:petals=local(drawings[pose],pivots[pose],[256,hinge],drawing_scale*scale,drawing_scale*scale)
  im=over(petals,bg);im=front_replace(im,fg);frames.append(clean(im,10))
  keys.append({'frame':f,'drawing':pose,'hinge':[256,hinge],'petalScale':drawing_scale*scale,'bodyScale':1 if f<=12 else body_scale})
 rig={'bones':[{'id':'root','parent':None,'pivot':[256,448]},{'id':'petal-hinge','parent':'root','pivot':[256,grown_hinge]}],'attachments':attachments,'keys':keys,'method':'drawn front-petal pairs over complete stationary background and foreground layers','fixed':['ground leaves and tendrils during closure and opening','gold core and rear leaves after growth'],'calibration':{'sourceScaleFirst':scale0,'sourceScaleGrown':scale2,'drawingScale':drawing_scale,'smallFrontRatio':ratio},'rootMotion':False}
 phases={'close':[1,6],'closedWait':[7,12],'closedGrowth':[13,22],'grownClosedWait':[23,32],'open':[33,39],'rest':[40,60]}
 markers={'closeStart':600,'closed':1080,'growthStart':1560,'growthEnd':2360,'openStart':3160,'openEnd':3720}
else:
 small_body_raw=read(PARTS/'0-0.png');small_cap_raw=read(PARTS/'0-complete-cap-v4.png')
 s0=(start.getbbox()[2]-start.getbbox()[0])/(small_cap_raw.getbbox()[2]-small_cap_raw.getbbox()[0])
 small_body=root_scale(small_body_raw,s0);small_cap=root_scale(small_cap_raw,s0)
 pixels=np.array(start);r,g,b=[pixels[:,:,i].astype(np.float32) for i in range(3)]
 red=np.uint8((pixels[:,:,3]>128)&(r>g*1.2)&(r>b*1.2))
 count,labels,stats,_=cv2.connectedComponentsWithStats(red,8);label=1+int(np.argmax(stats[1:,4]));core=np.uint8(labels==label)
 outline=cv2.dilate(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
 cap_mask=np.maximum(core,outline*np.uint8((r<110)&(g<110)&(b<110))).astype(np.float32)
 cap_mask=np.maximum(cap_mask,np.float32((Y<stats[label,1]+45)&(pixels[:,:,3]>0)))
 native_body=clean(cut(start,1-cap_mask),200);hidden=cut(small_cap,np.float32(np.array(native_body)[:,:,3]>128))
 small_cap=over(cut(start,cap_mask),hidden);small_body=native_body
 adult_body=read(PARTS/'body-complete.png');adult_cap=read(PARTS/'canopy.png');rear=over(read(PARTS/'rear-canopy.png'),read(PARTS/'rear-stem.png'))
 def split_stem(body,top,root):
  m=np.float32((Y>=top)&(Y<root)&(X>211)&(X<308));return cut(body,m),cut(body,1-m)
 small_top=round(448-(448-305)*s0);small_root=round(448-(448-345)*s0)
 small_stem,small_cradle=split_stem(small_body,small_top,small_root)
 adult_stem,adult_cradle=split_stem(adult_body,235,335)
 for name,im in [('small-stem',small_stem),('small-cradle',small_cradle),('small-cap',small_cap),('grown-stem',adult_stem),('grown-cradle',adult_cradle),('grown-cap',adult_cap),('grown-rear',rear)]:save_part(name,im)
 def compressed(stem,top,root,offset):
  sy=max(.05,(root-top-offset)/(root-top));return local(stem,[256,root],[256,root],1,sy)
 lower_keys=[0,3,11,25,38,43];lift_keys=[95,93,86,72,53,32,15,4,0]
 for f in range(61):
  if f==0:frames.append(start.copy());keys.append({'frame':f,'phase':'actual-first'});continue
  if f>=42:frames.append(finish.copy());keys.append({'frame':f,'phase':'actual-finished'});continue
  if f<=12:
   scale=1;offset=lower_keys[f-1] if f<=6 else 43
   im=over(small_cradle,compressed(small_stem,small_top,small_root,offset));im=over(move(small_cap,0,offset),im)
  else:
   scale=growth[min(f-13,9)] if f<=22 else 1
   offset=95 if f<33 else lift_keys[f-33]
   im=rear.copy();im=over(compressed(adult_stem,235,335,offset),im);im=over(adult_cradle,im);im=over(move(adult_cap,0,offset),im);im=root_scale(im,scale)
  frames.append(clean(im,10));keys.append({'frame':f,'growthScale':scale,'capY':offset,'neckRoot':small_root if f<=12 else 335,'cradleMovesDuringLift':False})
 rig={'bones':[{'id':'root','parent':None,'pivot':[256,448]},{'id':'cradle','parent':'root','pivot':[256,448]},{'id':'stem','parent':'root','pivot':[256,335]},{'id':'canopy','parent':'stem','pivot':[256,265]}],'attachments':{n:{'source':'Parts/'+n+'.png'} for n in ['small-stem','small-cradle','small-cap','grown-stem','grown-cradle','grown-cap','grown-rear']},'keys':keys,'method':'separate complete canopy, compressible stem, fixed cradle and rear mushroom','fixed':['cradle and eggs during cap lowering and lifting','ground'],'rootMotion':False,'smallScale':s0}
 phases={'lower':[1,6],'loweredWait':[7,12],'loweredGrowth':[13,22],'grownLoweredWait':[23,32],'lift':[33,41],'rest':[42,60]}
 markers={'lowerStart':600,'lowered':1080,'growthStart':1560,'growthEnd':2360,'liftStart':3160,'liftEnd':3880}

sheet=Image.new('RGBA',(4096,4096))
for i,frame in enumerate(frames):sheet.paste(frame,(i%8*512,i//8*512))
sheet.save(OUT/'growth.png');export_animation(frames,OUT/'growth.webp')
previews=[]
for frame in frames:
 bg=Image.new('RGB',(512,512),'#20282e');bg.paste(frame,(0,0),frame);previews.append(bg.resize((384,384),Image.Resampling.LANCZOS))
export_animation(previews,OUT/'preview.webp')
contact=Image.new('RGB',(384*6,384*3),'#20282e')
for j,i in enumerate([0,2,4,6,12,14,16,20,23,32,33,34,35,36,37,38,39,42]):contact.paste(previews[i],(j%6*384,j//6*384))
contact.save(OUT/'contact.png')
old=json.loads((ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3'/KEY/'animation.json').read_text('utf-8'))
old.update({'method':'registered-parts-and-drawn-local-poses','source':'Sources/SupportedV8/'+KEY+'/Parts','additionalSources':['Sources/SupportedV8/petal-pairs.png'] if KEY=='sprout' else [],'timeline':'rig.json','durationsMs':DURATIONS,'durationMs':6320,'phaseRanges':phases,'markersMs':markers})
old.pop('poseSchedule',None);old.pop('poseCount',None)
rig.update({'sourceRoot':'Sources/SupportedV8/'+KEY,'canvas':[512,512],'root':[256,448],'frameCount':61,'durationMs':6320,'phaseRanges':phases})
for name,obj in [('animation.json',old),('rig.json',rig)]:
 (OUT/name).write_bytes((json.dumps(obj)+'\r\n').encode('utf-8'))
print(KEY,'registered layered animation exported')
