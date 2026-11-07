from pathlib import Path
from PIL import Image,ImageDraw
from scipy.ndimage import label,find_objects
import numpy as np,json,math,hashlib,shutil
D=Path(__file__).resolve().parent;S=631;G=Path('/workspace/scratch/cdf786db13f9/generated_images/exec-df767941-6744-4fbd-bb83-53863520faef.png');shutil.copy2(G,D/'Sources/birth-wholebody-generated.png');source=Image.open(G).convert('RGBA');a=np.array(source);lab,n=label(a[:,:,3]>32);sz=np.bincount(lab.ravel());boxes=[]
for i,o in enumerate(find_objects(lab)):
 if sz[i+1]<1000:continue
 y,x=o;boxes.append([x.start,y.start,x.stop,y.stop])
boxes.sort(key=lambda b:(int((b[1]+b[3])/2/(source.height/4)),b[0]));assert len(boxes)==16
neutral=Image.open(D/'Sources/approved-idle-frame0.png').convert('RGBA');b=boxes[-1];scale=math.sqrt((201/(b[2]-b[0]))*(247/(b[3]-b[1])));frames=[];records=[];(D/'body-poses').mkdir(exist_ok=True)
for i,b in enumerate(boxes):
 if i==15:frame=neutral.copy();record={'index':i,'exactRegisteredIdleFrame0':True}
 else:
  l,t,r,bt=b;l=max(0,l-4);t=max(0,t-4);r=min(source.width,r+4);bt=min(source.height,bt+4);im=source.crop((l,t,r,bt));im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);arr=np.array(im);y,x=np.where(arr[:,:,3]>=16);center=(x.min()+x.max()+1)/2;floor=y.max()+1;dx=round(315.5-center);dy=int(554-floor);frame=Image.new('RGBA',(S,S));frame.paste(im,(dx,dy));record={'index':i,'sourceRect':[l,t,r,bt],'fixedWholeCelScale':scale,'wholeCelTranslation':[dx,dy]}
 frame.save(D/'body-poses'/f'{i:03d}.png');frames.append(frame);records.append(record)
sheet=Image.new('RGBA',(S*8,S*2))
for i,im in enumerate(frames):sheet.paste(im,(i%8*S,i//8*S))
sheet.save(D/'bean-base-birth-body-v1-sheet.png');dur=[40,25,35,50,30,60,60,70,70,90,90,60,70,70,200,240];assert sum(dur)==1260
frames[0].save(D/'bean-base-birth-body-v1-preview.webp',save_all=True,append_images=frames[1:],duration=dur,lossless=True,loop=0)
contact=Image.new('RGB',(4*256,4*282),(238,240,229));draw=ImageDraw.Draw(contact);at=2590
for i,im in enumerate(frames):
 crop=im.crop((175,280,456,565));bg=Image.new('RGBA',crop.size,(238,240,229,255));bg.alpha_composite(crop);bg=bg.convert('RGB').resize((250,253),Image.Resampling.LANCZOS);contact.paste(bg,(i%4*256,i//4*282));draw.text((i%4*256+7,i//4*282+260),f'{i}: {at} ms'+(' actual idle'if i==15 else ''),fill=(20,45,25));at+=dur[i]
contact.save(D/'body-contact.jpg',quality=95)
meta={'tribe':'bean','form':'base','action':'birth-body','frameSize':631,'frameHeight':631,'columns':8,'frameCount':16,'durationsMs':dur,'durationMs':1260,'appearanceAtMs':2590,'totalSceneDurationMs':3850,'loop':False,'pivotX':315.5,'pivotY':553.268115942029,'referenceLength':247,'sourceFacing':'right','source':'Sources/approved-idle-frame0.png','sourceRegisteredIdle':'DesignAssets/Tribes/sprout/AnimationStudies/idle-v2/idle-v2.webp','sourceRegisteredIdleFrame':0,'sheet':'bean-base-birth-body-v1-sheet.png','preview':'bean-base-birth-body-v1-preview.webp','records':records,'method':'Sixteen complete imagegen-painted bodies. Only complete-cel cropping, one fixed uniform scale and whole-cel registration. Final body is the exact current registered idle frame0. No body-part extraction, rigging, warping, code leaf rotation, recombination or interpolation.'}
(D/'body-manifest.json').write_text(json.dumps(meta,indent=2)+'\n');(D/'source-layout.json').write_text(json.dumps(boxes,indent=2)+'\n');print('body ready scale',scale,'duration',sum(dur),'frames',len(frames))
