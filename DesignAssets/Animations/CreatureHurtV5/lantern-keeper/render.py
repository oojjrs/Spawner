from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
 path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def main():
 settings=json.loads((FOLDER/'settings.json').read_text('utf8'));size=settings['frameSize'];seed=Image.open(FOLDER/'Source/seed.png').convert('RGBA');cels={index:Image.open(FOLDER/'Drawings'/('%02d.png'%index)).convert('RGBA') for index in range(8)}
 sequence=[-1,1,2,3,4,4,5,5,6,6,7,-1,-1,-1,-1,-1];frames=[seed.copy() if index<0 else cels[index].copy() for index in sequence]
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for index,frame in enumerate(frames):sheet.paste(frame,(index%4*size,index//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(index%4*64,index//4*64))
 options={'lossless':True,'method':4,'exact':True};sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=settings['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 timeline={'durationMs':760,'closedEyeHold':settings['closedEyeHold'],'method':'Complete jointly drawn anatomical body poses. Shared original-head scale and planted supporting hind-paw registration; no full-image animation rotation, scaling, mesh or crossfade.','poses':[{'frame':i,'durationMs':settings['durationsMs'][i],'source':'Source/seed.png' if cel<0 else 'Drawings/%02d.png'%cel,'drawnCel':cel,'runtimeScale':1,'runtimeRotation':0} for i,cel in enumerate(sequence)]};save_json(FOLDER/'timeline.json',timeline)
 metadata=dict(settings);metadata.update({'image':'DesignAssets/Animations/CreatureHurtV5/'+FOLDER.name+'/hurt.webp','source':'Source/seed.png','method':timeline['method'],'timeline':'timeline.json','registration':'registration.json','renderer':'render.py','generation':'Source/generation.json','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','drawnPoseCount':7,'previewPauseMs':900,'artworkScale':1});save_json(FOLDER/'hurt.json',metadata)
 contact=Image.new('RGB',(size*4,(size+20)*2),(45,52,46));draw=ImageDraw.Draw(contact)
 for n,i in enumerate([0,1,2,4,6,8,10,15]):
  x=n%4*size;y=n//4*(size+20);contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i)+' / cel '+str(sequence[i]),(255,255,225))
 contact.save(FOLDER/'hurt-contact.png');print(FOLDER.name,'16 frames / 760 ms / drawn body curl')

if __name__=='__main__':main()
