from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
 path.write_bytes((json.dumps(value,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def main():
 settings=json.loads((FOLDER/'settings.json').read_bytes());size=settings['frameSize'];cels={0:Image.open(FOLDER/'Source/seed.png').convert('RGBA')}
 for index in range(1,5):cels[index]=Image.open(FOLDER/'Drawings'/('%02d.png'%index)).convert('RGBA')
 cels[8]=Image.open(FOLDER/'Source/seed-half.png').convert('RGBA')
 sequence=[0,1,2,3,4,3,2,1,1,8,0,0,0,0,0,0];frames=[cels[index].copy() for index in sequence]
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for index,frame in enumerate(frames):sheet.paste(frame,(index%4*size,index//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(index%4*64,index//4*64))
 options={'lossless':True,'method':4,'exact':True};sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options)
 preview=settings['durationsMs'].copy();preview[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':preview,'loop':0,**options})
 poses=[{'frame':index,'durationMs':settings['durationsMs'][index],'source':'Source/seed.png' if cel==0 else 'Source/seed-half.png' if cel==8 else 'Drawings/%02d.png'%cel,'phase':'contact' if index<4 else 'pain-hold' if index==4 else 'recovery','drawnPose':cel,'scale':1,'runtimeRotation':0} for index,cel in enumerate(sequence)]
 save_json(FOLDER/'timeline.json',{'durationMs':760,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'poses':poses,'method':'Complete jointly drawn body and joint poses, one common scale and planted hind-foot registration. No temporal crossfade, cutout rig or whole-image animation transform.'})
 meta={key:settings[key] for key in ['frameSize','columns','pivotX','pivotY','frameCount','durationsMs','durationMs','loop','closedEyeHold']};meta.update({'image':'DesignAssets/Animations/CreatureHurtV5/'+FOLDER.name+'/hurt.webp','source':'Source/seed.png','method':'Authored curled key plus jointly drawn whole-body transitions inside an eight-slot exact-original reference canvas. Four contact poses are selected and played in reverse on recovery; neutral and final half-eye bridge use approved original body. One common anatomical scale, planted hind-foot registration. No rig, mesh, temporal crossfade or whole-image recoil transform.','timeline':'timeline.json','registration':'registration.json','renderer':'render.py','generation':'Source/generation.json','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','previewPauseMs':900,'drawnPoseCount':6,'artworkScale':1})
 save_json(FOLDER/'hurt.json',meta)
 contact=Image.new('RGB',(size*4,(size+20)*2),(35,43,39));draw=ImageDraw.Draw(contact)
 for number,index in enumerate([0,1,2,4,6,7,9,15]):
  x=number%4*size;y=number//4*(size+20);contact.paste(frames[index],(x,y+20),frames[index]);draw.text((x+5,y+5),'frame '+str(index)+' / cel '+str(sequence[index]),(240,245,230))
 contact.save(FOLDER/'hurt-contact.png');print(FOLDER.name,len(frames),sum(settings['durationsMs']))

if __name__=='__main__':main()
