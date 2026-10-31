from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
 path.write_bytes((json.dumps(value,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def lock_feet(image,seed,mask,settings):
 pixels=np.array(image);original=np.array(seed);core=np.array(mask)>0;x0,y0,x1,y1=settings['clearRect'];clear=np.zeros(core.shape,bool);clear[y0:y1,x0:x1]=True
 preserve=(original[:,:,3]>8)&~core;pixels[clear&~preserve]=0;pixels[core]=original[core]
 return Image.fromarray(pixels)

def main():
 settings=json.loads((FOLDER/'settings.json').read_bytes());size=settings['frameSize'];seed=Image.open(FOLDER/'Source/seed.png').convert('RGBA');mask=Image.open(FOLDER/'Source/feet-fixed-mask.png').convert('L');cels={0:seed,8:Image.open(FOLDER/'Source/seed-half.png').convert('RGBA')}
 for i in range(1,5):cels[i]=lock_feet(Image.open(FOLDER/'Drawings'/('%02d.png'%i)).convert('RGBA'),seed,mask,settings['feet'])
 sequence=[0,1,2,3,4,3,2,1,1,8,0,0,0,0,0,0];frames=[cels[i].copy() for i in sequence];sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256));options={'lossless':True,'method':4,'exact':True}
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*size,i//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=settings['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 poses=[{'frame':i,'durationMs':settings['durationsMs'][i],'source':'Source/seed.png' if cel==0 else 'Source/seed-half.png' if cel==8 else 'Drawings/%02d.png'%cel,'phase':'contact' if i<4 else 'head-down-hold' if i==4 else 'recovery','drawnCel':cel,'fixedFootPlate':True,'rootScale':1,'rootRotation':0} for i,cel in enumerate(sequence)]
 save_json(FOLDER/'timeline.json',{'durationMs':760,'closedEyeHold':settings['closedEyeHold'],'poses':poses,'method':'Whole-body drawn head/neck downward bob and slight bilateral wing opening above exact original stationary feet and toe/claw grip. No whole-image recoil transform.'})
 metadata={key:settings[key] for key in ['frameSize','columns','pivotX','pivotY','frameCount','durationsMs','durationMs','loop','closedEyeHold']};metadata.update({'image':'DesignAssets/Animations/CreatureHurtV6/'+FOLDER.name+'/hurt.webp','source':'Source/seed.png','method':'Jointly generated full body poses from eight-slot exact-original edit canvas and an authored head-bob peak; original stationary feet/claws composited with a fixed alpha mask. Head lowers into breast with modest wing spread while feet keep exact original coordinates and grip. Four contact cels played in reverse for recovery, with original half-eye bridge and exact neutral endpoints. No rig, root rotation, global animation scaling or new support prop.','registration':'registration.json','timeline':'timeline.json','renderer':'render.py','generation':'Source/generation.json','feetMask':'Source/feet-fixed-mask.png','feetPlate':'Source/feet-original.png','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','drawnPoseCount':6,'previewPauseMs':900});save_json(FOLDER/'hurt.json',metadata)
 contact=Image.new('RGB',(size*4,(size+20)*2),(35,43,39));drawing=ImageDraw.Draw(contact)
 markers=Image.new('RGB',(size*4,(size+20)*2),(35,43,39));marker_draw=ImageDraw.Draw(markers)
 for number,i in enumerate([0,1,2,4,6,7,9,15]):
  x=number%4*size;y=number//4*(size+20);contact.paste(frames[i],(x,y+20),frames[i]);drawing.text((x+5,y+5),'frame '+str(i)+' / cel '+str(sequence[i]),(240,245,230));markers.paste(frames[i],(x,y+20),frames[i]);marker_draw.text((x+5,y+5),'frame '+str(i),(240,245,230))
  for px,py in settings['feet']['markers']:marker_draw.line((x+px-4,y+20+py,x+px+4,y+20+py),(240,110,110),1);marker_draw.line((x+px,y+20+py-4,x+px,y+20+py+4),(240,110,110),1)
 contact.save(FOLDER/'hurt-contact.png');markers.save(FOLDER/'feet-contact-markers.png');print(FOLDER.name,len(frames),sum(settings['durationsMs']))

if __name__=='__main__':main()
