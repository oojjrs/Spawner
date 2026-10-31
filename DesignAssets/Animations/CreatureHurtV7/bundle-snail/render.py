from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
 path.write_bytes((json.dumps(value,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def main():
 settings=json.loads((FOLDER/'settings.json').read_bytes());size=settings['frameSize'];seed=Image.open(FOLDER/'Source/seed.png').convert('RGBA');half=Image.open(FOLDER/'Source/seed-half.png').convert('RGBA');shell=Image.open(FOLDER/'Layers/shell.png').convert('RGBA');hidden=Image.open(FOLDER/'Layers/hidden-back.png').convert('RGBA');cels={0:seed,1:half}
 for i in [2,3,4]:
  body=hidden.copy();body.alpha_composite(Image.open(FOLDER/'Drawings'/('%02d.png'%i)).convert('RGBA'));body.alpha_composite(shell);cels[i]=body
 sequence=[0,1,2,3,4,3,2,1,0,0,0,0,0,0,0,0];frames=[cels[i].copy() for i in sequence];sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256));options={'lossless':True,'method':4,'exact':True}
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*size,i//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=settings['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 poses=[{'frame':i,'durationMs':settings['durationsMs'][i],'source':'Source/seed.png' if cel==0 else 'Source/seed-half.png' if cel==1 else 'Drawings/%02d.png'%cel,'phase':'contact' if i<4 else 'soft-neck-contract-hold' if i==4 else 'recovery','drawnCel':cel,'shellLayer':'Layers/shell.png','rootRotation':0,'rootScale':1} for i,cel in enumerate(sequence)]
 save_json(FOLDER/'timeline.json',{'durationMs':760,'closedEyeHold':settings['closedEyeHold'],'poses':poses,'method':'Original rigid shell and bundle remain stationary. Jointly drawn soft head, neck and stalks contract backward/down above the registered broad muscular sole. Exact original half-eye bridges and neutral endpoints. Generated extended onset cel01 is calibration only.'})
 metadata={key:settings[key] for key in ['frameSize','columns','pivotX','pivotY','frameCount','durationsMs','durationMs','loop','closedEyeHold']};metadata.update({'image':'DesignAssets/Animations/CreatureHurtV7/bundle-snail/hurt.webp','source':'Source/seed.png','method':'New native-imagegen soft-body drawings under an exact original stationary shell/bundle layer. Actual head/neck contraction and stalk shortening above a registered broad muscular sole; no whole-image recoil transform. Original half-eye bridges and endpoints.','registration':'registration.json','timeline':'timeline.json','renderer':'render.py','generation':'Source/generation.json','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','drawnPoseCount':5,'previewPauseMs':900,'previousVersion':'DesignAssets/Animations/CreatureHurtV4/bundle-snail/hurt.webp'});save_json(FOLDER/'hurt.json',metadata)
 contact=Image.new('RGB',(size*4,(size+20)*2),(35,43,39));draw=ImageDraw.Draw(contact);markers=contact.copy();marker_draw=ImageDraw.Draw(markers)
 for number,i in enumerate([0,1,2,4,5,6,7,15]):
  x=number%4*size;y=number//4*(size+20);contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i)+' / cel '+str(sequence[i]),(240,245,230));markers.paste(frames[i],(x,y+20),frames[i]);marker_draw.text((x+5,y+5),'frame '+str(i),(240,245,230));marker_draw.line((x+175,y+329,x+252,y+329),(240,110,110),1);marker_draw.line((x+212,y+324,x+212,y+334),(240,110,110),1)
 contact.save(FOLDER/'hurt-contact.png');markers.save(FOLDER/'support-contact-markers.png');print('bundle-snail',len(frames),sum(settings['durationsMs']))

if __name__=='__main__':main()
