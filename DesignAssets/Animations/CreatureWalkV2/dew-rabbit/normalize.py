from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, _webp
import numpy as np
import json

def components(mask):
 working=mask.copy()
 labels=np.zeros(mask.shape,np.int32)
 records=[]
 count=0
 for sy,sx in zip(*np.where(working)):
  if not working[sy,sx]:
   continue
  count+=1
  stack=[(int(sx),int(sy))]
  left,top,right,bottom=sx,sy,sx+1,sy+1
  area=0
  while stack:
   x,y=stack.pop()
   if not working[y,x]:
    continue
   missing=np.flatnonzero(~working[y,:x])
   lo=int(missing[-1]+1) if len(missing) else 0
   missing=np.flatnonzero(~working[y,x+1:])
   hi=int(x+1+missing[0]) if len(missing) else working.shape[1]
   working[y,lo:hi]=False
   labels[y,lo:hi]=count
   area+=hi-lo
   left=min(left,lo);top=min(top,y);right=max(right,hi);bottom=max(bottom,y+1)
   for ny in [y-1,y+1]:
    if ny<0 or ny>=working.shape[0]:
     continue
    strip=working[ny,lo:hi]
    starts=np.flatnonzero(strip&~np.concatenate(([False],strip[:-1])))
    stack.extend((int(lo+start),ny) for start in starts)
  records.append({'id':count,'bbox':[int(left),int(top),int(right),int(bottom)],'area':int(area)})
 return labels,records

def eye(image):
 pixels=np.asarray(image).astype(float)
 r,g,b,a=[pixels[:,:,i] for i in range(4)]
 mask=(a>128)&(g>r*1.15)&(g>b*1.03)&(g<150)
 unused,records=components(mask)
 alpha=np.where(a>128)
 minx,maxx=min(alpha[1]),max(alpha[1])
 miny,maxy=min(alpha[0]),max(alpha[0])
 options=[]
 for record in records:
  l,t,rr,bb=record['bbox'];w,h=rr-l,bb-t
  if w<4 or h<4 or w>0.3*(maxx-minx) or h>0.3*(maxy-miny) or not .55<w/h<1.65 or (l+rr)/2>minx+.7*(maxx-minx) or record['area']/(w*h)<.35:
   continue
  options.append(record)
 return sorted(options,key=lambda r:r['area'],reverse=True)[:3]

HERE=Path(__file__).resolve().parent
BASE=HERE.parent
CONFIG={
 'flower-tail-bird':{'size':388,'pivot':[194,339.5],'cycles':3,'durations':[80,80,80,90,90,80,80,87],'action':'Full shoulder/elbow wing opening, downstroke and folded recovery with newly drawn exposed feather surfaces.'},
 'dew-rabbit':{'size':417,'pivot':[208.5,364.875],'cycles':2,'durations':[100,80,100,180,100,100,150,190],'action':'Preparation, hindpaw push-off, airborne tuck, forepaw landing and recovery, preserving the drawn flight arc.'},
 'soil-mole':{'size':355,'pivot':[177.5,310.625],'cycles':3,'durations':[80,80,90,80,80,90,80,87],'action':'Alternating front-paw reach, planting, body pull and lifted recovery with redrawn elbow, wrist and claw silhouettes.'},
 'bundle-snail':{'size':398,'pivot':[199,348.25],'cycles':1,'durations':[200,250,250,250,300,250,250,250],'action':'Drawn soft-foot extension, anterior grip, compression, rear release and recovery under a rigid shell and load.'}
}

def json_file(path,value):
 encoder=json.JSONEncoder();encoder.ensure_ascii=False;encoder.indent=2
 path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def webp(path,picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,pictures,durations):
 encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
 timestamp=0
 for picture,duration in zip(pictures,durations):
  encoder.add(picture.getim(),timestamp,True,100.0,100.0,3);timestamp+=duration
 encoder.add(None,timestamp,True,100.0,100.0,0)
 path.write_bytes(encoder.assemble('','',''))

def fit_shift(minimum,maximum,size):
 span=maximum-minimum
 if span>size:
  raise RuntimeError('Shared body scale does not fit the original cell: '+str(span)+' > '+str(size))
 margin=min(2,max(0,(size-span)/2))
 shift=max(0,margin-minimum)
 if maximum+shift>size-margin:
  shift=size-margin-maximum
 return shift

def main(key):
 cfg=CONFIG[key];size=cfg['size'];folder=BASE/key
 raw=Image.open(folder/'Source/walk-strip-raw.png').convert('RGBA')
 ref=Image.open(folder/'Source/locked-neutral.png').convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)
 labels,records=components(np.array(raw)[:,:,3]>128)
 records=sorted(sorted(records,key=lambda r:r['area'],reverse=True)[:8],key=lambda r:r['bbox'][0])
 pictures=[]
 eyes=[]
 boxes=[]
 for record in records:
  mask=Image.fromarray(np.uint8(labels==record['id'])*255).filter(ImageFilter.MaxFilter(3))
  pixels=np.array(raw);pixels[np.asarray(mask)==0]=0;pixels[pixels[:,:,3]<16]=0
  picture=Image.fromarray(pixels)
  box=picture.getchannel('A').getbbox()
  pictures.append(picture.crop(box));boxes.append(box)
  features=eye(picture.crop(record['bbox']))
  if features:
   l,t,r,b=features[0]['bbox'];ox,oy=record['bbox'][:2]
   eyes.append([ox+(l+r)/2,oy+(t+b)/2,(r-l+b-t)/2])
  else:
   eyes.append(None)
 ref_eye=eye(ref)
 if eyes[0] and ref_eye and eyes[-1]:
  l,t,r,b=ref_eye[0]['bbox'];scale=((r-l+b-t)/2)/eyes[0][2]
  source_anchor=eyes[0][:2];destination_anchor=[(l+r)/2,(t+b)/2]
  pitch=(eyes[-1][0]-eyes[0][0])/7
 else:
  rb=ref.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
  first,last=records[0]['bbox'],records[-1]['bbox']
  scale=(rb[2]-rb[0])/(first[2]-first[0])
  source_anchor=[(first[0]+first[2])/2,first[3]];destination_anchor=[(rb[0]+rb[2])/2,rb[3]]
  pitch=((last[0]+last[2]-first[0]-first[2])/2)/7
 positions=[]
 for i,box in enumerate(boxes):
  x=destination_anchor[0]+(box[0]-source_anchor[0]-i*pitch)*scale
  y=destination_anchor[1]+(box[1]-source_anchor[1])*scale
  positions.append([x,y])
 root_xs=[]
 for i,picture in enumerate(pictures):
  if key=='flower-tail-bird':
   root_xs.append(eyes[i][0])
  elif key=='soil-mole':
   pixels=np.asarray(picture);alpha=pixels[:,:,3]>128
   ys,xs=np.where(alpha);core=alpha.copy();core[np.arange(core.shape[0])>float(ys.min())+.45*(ys.max()-ys.min()),:]=False
   unused,xx=np.where(core);root_xs.append(float(xx.mean())+boxes[i][0])
  elif key=='bundle-snail':
   pixels=np.asarray(picture).astype(float);r,g,b,a=[pixels[:,:,j] for j in range(4)]
   mask=(a>128)&(r>g*1.1)&(g>b*1.2);unused,xx=np.where(mask)
   root_xs.append(float(xx.mean())+boxes[i][0])
 horizontal_offsets=[]
 if root_xs:
  horizontal_offsets=[(root_xs[0]+i*pitch-root_xs[i])*scale for i in range(8)]
  for position,offset in zip(positions,horizontal_offsets):position[0]+=offset
 minx=min(v[0] for v in positions);maxx=max(v[0]+im.width*scale for v,im in zip(positions,pictures))
 miny=min(v[1] for v in positions);maxy=max(v[1]+im.height*scale for v,im in zip(positions,pictures))
 shift=[fit_shift(minx,maxx,size),fit_shift(miny,maxy,size)]
 padding=8 if key=='dew-rabbit' else 0
 output_size=size+padding*2
 output_shift=[shift[0]+padding,shift[1]+padding]
 frames=[]
 (folder/'Frames').mkdir(511,True,True);(folder/'Source/Drawings').mkdir(511,True,True)
 for i,(picture,position) in enumerate(zip(pictures,positions)):
  picture.save(folder/'Source/Drawings'/('%02d.png'%(i+1)))
  scaled=picture.resize((round(picture.width*scale),round(picture.height*scale)),Image.Resampling.LANCZOS)
  frame=Image.new('RGBA',(output_size,output_size));frame.paste(scaled,(round(position[0]+output_shift[0]),round(position[1]+output_shift[1])))
  frame.save(folder/'Frames'/('%02d.png'%(i+1)));frames.append(frame)
 sheet=Image.new('RGBA',(output_size*4,output_size*2))
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*output_size,i//4*output_size))
 webp(folder/'walk.webp',sheet)
 animate(folder/'preview.webp',[frame.resize((256,256),Image.Resampling.LANCZOS) for frame in frames],cfg['durations'])
 animate(folder/'thumb.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],cfg['durations'])
 contact=Image.new('RGB',(1024,858),(32,45,37));draw=ImageDraw.Draw(contact)
 for i,frame in enumerate([ref]+frames):
  x,y=i%4*256,i//4*286;im=frame.resize((256,256),Image.Resampling.LANCZOS)
  contact.paste(im,(x,y),im);draw.text((x+8,y+260),'LOCKED ORIGINAL' if i==0 else 'DRAWN PHASE '+str(i),(232,241,220))
 contact.save(folder/'contact.png')
 normal={'workflow':'Official Game Studio sprite-pipeline full-strip generation, 2D alpha-component extraction to prevent neighboring-pose cuts, one shared body scale and fixed source pitch/anchor. No per-frame tight fit or deformation.','sourceObjects':records,'sourceRootX':root_xs,'horizontalRegistrationOffsets':horizontal_offsets,'rootRegistration':'Horizontal translation only: bird fixed head/body root, mole upper torso silhouette, snail rigid shell/load. Rabbit lean and every vertical trajectory are preserved.','sharedScale':scale,'sourcePitch':pitch,'sourceAnchor':source_anchor,'destinationAnchor':destination_anchor,'commonRegistrationShift':output_shift,'outputPadding':padding,'logicalFrameSize':size,'unionBeforeShift':[minx,miny,maxx,maxy],'pivotShiftedBySameTranslation':True,'perFrameScale':False,'perFrameTightRecenter':False,'drawnAirborneYRetained':key=='dew-rabbit'}
 json_file(folder/'normalization.json',normal)
 metadata={'image':'DesignAssets/Animations/CreatureWalkV2/'+key+'/walk.webp','frameSize':output_size,'columns':4,'durationsMs':cfg['durations'],'loop':True,'pivotX':cfg['pivot'][0]+output_shift[0],'pivotY':cfg['pivot'][1]+output_shift[1],'cyclesPerCell':cfg['cycles'],'frameCount':8,'durationMs':sum(cfg['durations']),'method':'Eight full-body drawings generated together from the locked original through the official Game Studio sprite-pipeline. '+cfg['action']+' Uniform shared-scale registration; no warped, crossfaded or synthetic drawing in-betweens.','source':'Source/walk-strip-raw.png','frames':'Frames','normalization':'normalization.json','preview':'preview.webp','thumbnail':'thumb.webp','rootMotion':False}
 if padding:metadata['viewSize']=size
 json_file(folder/'walk.json',metadata)
 print(key,'sharedScale',round(scale,5),'shift',shift,'unionSize',[maxx-minx,maxy-miny],'period',metadata['durationMs'])

if __name__=='__main__':
 import sys
 for key in sys.argv[1:] or [HERE.name]:main(key)