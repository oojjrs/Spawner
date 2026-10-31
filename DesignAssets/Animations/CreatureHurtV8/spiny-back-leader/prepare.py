from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
P=Path('H:/Spawner/DesignAssets/Animations/CreatureHurtV8/spiny-back-leader')
OLD=Path('H:/Spawner/DesignAssets/Animations/CreatureHurtV7/spiny-back-leader')
SIZE=256

def save_json(path,data):
 path.write_bytes((json.dumps(data,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def polygon(points):
 m=Image.new('L',(SIZE*4,SIZE*4));ImageDraw.Draw(m).polygon([(x*4,y*4)for x,y in points],255)
 return np.asarray(m.resize((SIZE,SIZE),Image.Resampling.LANCZOS)).astype(float)/255

def layer(image,alpha):
 a=np.asarray(image).copy();a[:,:,3]=np.uint8(np.rint(a[:,:,3].astype(float)*np.clip(alpha,0,1)));a[a[:,:,3]==0]=0
 return Image.fromarray(a)

def merged(bottom,top):return Image.alpha_composite(bottom,top)

legs=[
 {'name':'far-left','hip':[38,146],'knee':[27,162],'toe':[23.5,184.5],'depth':'behind','upper':[[27,143],[36,138],[45,140],[48,147],[43,155],[34,165],[27,170],[21,165],[20,157]],'lower':[[22,157],[30,156],[33,162],[29,170],[28,178],[24,185],[20,184],[17,176],[17,168]]},
 {'name':'near-front','hip':[131,170],'knee':[138,188],'toe':[122.5,223.5],'depth':'front','upper':[[119,161],[130,160],[142,164],[148,173],[150,182],[146,190],[140,192],[132,187],[124,188],[120,179]],'lower':[[131,184],[142,183],[148,188],[148,198],[140,208],[125,224],[119,224],[116,216],[119,205],[124,195],[127,189]]},
 {'name':'middle','hip':[167,174],'knee':[179,190],'toe':[186.5,215.5],'depth':'front','upper':[[160,168],[169,167],[179,169],[186,176],[190,187],[187,194],[178,198],[170,192],[162,190],[157,179]],'lower':[[173,187],[181,186],[188,191],[193,201],[194,207],[189,216],[184,217],[179,211],[172,207],[168,199],[169,191]]},
 {'name':'rear','hip':[212,163],'knee':[224,177],'toe':[228,200.5],'depth':'front','upper':[[204,156],[214,154],[222,158],[229,163],[232,174],[228,181],[220,183],[212,177],[205,170]],'lower':[[220,173],[228,172],[234,178],[239,186],[241,194],[234,201],[226,202],[224,193],[219,188],[216,181]]}
]
claws=[]
for name,pivot,angle in [('mandible-far',[52,156],-10),('mandible-near',[88,164],9)]:
 mask=np.asarray(Image.open(OLD/'Masks'/(name+'.png')).convert('L')).astype(float)/255
 if name=='mandible-far':
  original_mask=mask.copy()
  original=np.asarray(Image.open(P/'Source/seed.png').convert('RGBA')).astype(float);rgb=original[:,:,:3]
  material=(rgb[:,:,1]-rgb[:,:,2]>8)&(rgb[:,:,0]-rgb[:,:,1]<60)&(rgb[:,:,1]>50)&(mask>.5)
  component=np.zeros((SIZE,SIZE),np.uint8);pending=[(40,170)]
  while pending:
   x,y=pending.pop()
   if x<0 or x>=SIZE or y<0 or y>=SIZE or not material[y,x]or component[y,x]:continue
   component[y,x]=255
   pending.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1),(x-1,y-1),(x+1,y+1),(x+1,y-1),(x-1,y+1)])
  mask*=np.asarray(Image.fromarray(component).filter(ImageFilter.MaxFilter(3))).astype(float)/255
  inner_edge=np.zeros((SIZE,SIZE),float);inner_edge[175:206,32:58]=1
  mask=np.maximum(mask,original_mask*inner_edge)
 if name=='mandible-near':mask[202:217,55:96]=1
 claws.append({'name':name,'pivot':pivot,'peakDegrees':angle,'mask':mask})
claw_union=np.maximum(claws[0]['mask'],claws[1]['mask'])
headmask=polygon([[47,139],[58,143],[65,150],[75,152],[88,146],[101,141],[115,145],[118,154],[112,165],[100,171],[85,174],[79,180],[68,178],[62,168],[57,158],[49,154],[45,147]])
original=np.asarray(Image.open(P/'Source/seed.png').convert('RGBA')).astype(float);rgb=original[:,:,:3];yy,xx=np.indices((SIZE,SIZE));leg_region=np.maximum(polygon(legs[0]['upper']),polygon(legs[0]['lower']))
purple=(rgb[:,:,2]-rgb[:,:,1]>6)&(rgb[:,:,0]-rgb[:,:,1]>8)&(rgb[:,:,0]-rgb[:,:,2]<45)&(leg_region>.2)&(original[:,:,3]>100)
queries=np.argwhere((xx>=13)&(xx<=64)&(yy>=156)&(yy<=210));white_seeds=np.argwhere(component>0);purple_seeds=np.argwhere(purple)
white_distance=np.min(np.sum((queries[:,None,:]-white_seeds[None,:,:])**2,2),1);purple_distance=np.min(np.sum((queries[:,None,:]-purple_seeds[None,:,:])**2,2),1)
owned=np.zeros((SIZE,SIZE),float);owned[queries[:,0],queries[:,1]]=(white_distance<purple_distance)
red=(rgb[:,:,0]-rgb[:,:,1]>45)&(rgb[:,:,0]-rgb[:,:,2]>45)
owned*=1-headmask;owned[red]=0
owned[(xx>=17)&(xx<=26)&(yy>=180)&(yy<=188)]=0
far_lower_padding=np.zeros((SIZE,SIZE),float);far_lower_padding[queries[:,0],queries[:,1]]=(purple_distance<=white_distance)
far_lower_padding*=((xx>=13)&(xx<=36)&(yy>=165)&(yy<=190))
far_lower_padding[(xx>=17)&(xx<=26)&(yy>=180)&(yy<=188)]=1
claws[0]['mask']=np.maximum(claws[0]['mask'],owned)
claw_union=np.maximum(claws[0]['mask'],claws[1]['mask'])
removal=np.zeros((SIZE,SIZE),float)
for leg in legs:
 for key in ['upper','lower']:
  m=polygon(leg[key])
  if leg['name']=='far-left'and key=='lower':m=np.maximum(m,far_lower_padding)
  m=m*(1-claw_union)*(1-headmask);leg[key+'Mask']=m;removal=np.maximum(removal,m)
  Image.fromarray(np.uint8(np.rint(m*255))).save(P/'Masks'/(leg['name']+'-'+key+'.png'))
for claw in claws:
 removal=np.maximum(removal,claw['mask']);Image.fromarray(np.uint8(np.rint(claw['mask']*255))).save(P/'Masks'/(claw['name']+'.png'))
removal=np.maximum(removal,headmask)
Image.fromarray(np.uint8(np.rint(headmask*255))).save(P/'Masks/head.png')
Image.fromarray(np.uint8(np.rint(removal*255))).save(P/'Masks/independent-parts-removal.png')
body_donor=Image.open(P/'Source/hidden-generated.png').convert('RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
socket_donor=Image.open(P/'Source/socket-generated.png').convert('RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
s=.83;tx=25;ty=11
socket_donor=socket_donor.transform((SIZE,SIZE),Image.Transform.AFFINE,[1/s,0,-tx/s,0,1/s,-ty/s],Image.Resampling.BICUBIC)
body_donor.save(P/'Source/hidden-registered.png');socket_donor.save(P/'Source/socket-registered.png')
body_boundary=polygon([[34,138],[40,124],[67,99],[91,78],[125,50],[179,30],[209,40],[185,77],[204,89],[223,84],[234,111],[243,137],[238,152],[220,166],[204,174],[187,183],[162,184],[137,181],[116,174],[98,170],[76,175],[52,167],[36,155]])
claw_union=np.maximum(claws[0]['mask'],claws[1]['mask'])
for state in ['seed','half','pain']:
 original=Image.open(P/'Source'/(state+'.png')).convert('RGBA')
 visible=layer(original,1-removal)
 hidden=layer(body_donor,body_boundary*removal*(1-headmask))
 hidden=merged(hidden,layer(socket_donor,body_boundary*headmask))
 body=merged(hidden,visible)
 body.save(P/'Parts'/('body-under-'+state+'.png'));visible.save(P/'Parts'/('carapace-foreground-'+state+'.png'))
 head=layer(original,headmask*(1-claw_union))
 head.save(P/'Parts'/('head-'+state+'.png'))
 for claw in claws:layer(original,claw['mask']).save(P/'Parts'/(claw['name']+'-'+state+'.png'))
 for leg in legs:
  for key in ['upper','lower']:
   m=leg[key+'Mask'];part=layer(original,m)
   if key=='upper':
    hip=leg['hip'];disk=Image.new('L',(SIZE*4,SIZE*4));ImageDraw.Draw(disk).ellipse(((hip[0]-6)*4,(hip[1]-6)*4,(hip[0]+6)*4,(hip[1]+6)*4),255)
    pad=np.asarray(disk.resize((SIZE,SIZE),Image.Resampling.LANCZOS)).astype(float)/255
    part=merged(layer(body_donor,pad),part)
   part.save(P/'Parts'/(leg['name']+'-'+key+'-'+state+'.png'))
attachments=[]
for leg in legs:
 h=np.array(leg['hip'],float);k=np.array(leg['knee'],float);t=np.array(leg['toe'],float);u=(t-h)/np.linalg.norm(t-h);perp=np.array([-u[1],u[0]])
 leg['bendSign']=1 if np.dot(k-h,perp)>0 else -1
 leg['lengths']=[float(np.linalg.norm(k-h)),float(np.linalg.norm(t-k))]
 for key in ['upper','lower']:
  attachments.append({'name':leg['name']+'-'+key,'bone':leg['name']+'-'+key,'sourcePattern':'Parts/'+leg['name']+'-'+key+'-{expression}.png','mask':'Masks/'+leg['name']+'-'+key+'.png','binding':{'type':'rigid-region','weights':[[leg['name']+'-'+key,1]]},'slot':leg['depth'],'scale':1})
 del leg['upperMask'];del leg['lowerMask']
for claw in claws:
 del claw['mask'];attachments.append({'name':claw['name'],'bone':claw['name'],'sourcePattern':'Parts/'+claw['name']+'-{expression}.png','pivot':claw['pivot'],'binding':{'type':'rigid-region','weights':[[claw['name'],1]]},'scale':1})
rig={'species':'spiny-back-leader','method':'four independently articulated rigid leg chains with fixed world toe IK, rigid lowering carapace, retracting head and closing mandibles','canvas':[256,256],'worldPivot':[128,224],'coordinateSystem':'image x right/y down; bind points in original 256 canvas','bodyTranslationAtPeak':[2,7],'bodyRotationDegrees':0,'bodyScale':[1,1],'headPivot':[78,154],'headRetractionAtPeak':[3,-1.2],'headPeakDegrees':-2,'legs':legs,'mandibles':claws,'attachments':attachments,'sources':{'seed':'Source/seed.png','half':'Source/half.png','pain':'Source/pain.png'},'drawOrder':['far-left leg','completed body underside','three near leg chains','mandibles','head foreground','original rigid shell foreground'],'hiddenSurfaces':{'legs':'Source/hidden-registered.png','headSocket':'Source/socket-registered.png','socketRegistration':{'uniformScale':s,'translation':[tx,ty]},'method':'native-generated complete missing underside/socket pixels masked only into articulated part vacancies; original visible shell and horn pixels stay in foreground'},'compatibility':'Project-local rigid attachment renderer; no Spine compatibility claim'}
save_json(P/'rig.json',rig)
meta=json.loads((OLD/'hurt.json').read_text('utf-8'));meta['image']='DesignAssets/Animations/CreatureHurtV8/spiny-back-leader/hurt.webp';meta['method']=rig['method'];meta['rig']='rig.json';meta['timeline']='timeline.json';meta['renderer']='render.py'
save_json(P/'hurt.json',meta)
markers=Image.new('RGB',(1024,1024),(35,45,38));seed=Image.open(P/'Source/seed.png').convert('RGBA').resize((1024,1024),Image.Resampling.NEAREST);markers.paste(seed,(0,0),seed);d=ImageDraw.Draw(markers)
for leg in legs:
 x,y=leg['toe'];d.ellipse((x*4-7,y*4-7,x*4+7,y*4+7),None,(70,255,110),3);d.text((x*4-50,y*4+11),leg['name']+' '+str(leg['toe']),(240,255,230))
markers.save(P/'support-markers-source.png')
print('prepared independent articulated parts',len(attachments))
