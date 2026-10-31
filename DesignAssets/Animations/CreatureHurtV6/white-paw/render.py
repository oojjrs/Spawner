from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
 path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def main():
 settings=json.loads((FOLDER/'settings.json').read_text('utf8'));registration=json.loads((FOLDER/'registration.json').read_text('utf8'));size=settings['frameSize'];seed=Image.open(FOLDER/'Source/seed.png').convert('RGBA');cels={i:Image.open(FOLDER/'Drawings'/('%02d.png'%i)).convert('RGBA') for i in range(8)};sequence=[-1,1,2,3,4,4,5,5,6,6,7,-1,-1,-1,-1,-1];frames=[seed.copy() if i<0 else cels[i].copy() for i in sequence]
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*size,i//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 options={'lossless':True,'method':4,'exact':True};sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options);durations=settings['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames])]:images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 timeline={'durationMs':760,'closedEyeHold':settings['closedEyeHold'],'method':'Existing complete anatomical drawings registered to the actual planted near-hind-paw sole. Only integer root placement is corrected; no artwork scaling, rotation, redrawing, temporal blend or morphology change.','poses':[{'frame':i,'durationMs':settings['durationsMs'][i],'source':'Source/seed.png' if cel<0 else 'Drawings/%02d.png'%cel,'drawnCel':cel,'nearHindSupportPixels':registration['nearSupportTarget'] if cel<0 else registration['records'][cel]['nearHindSoleAfter'],'runtimeScale':1,'runtimeRotation':0} for i,cel in enumerate(sequence)]};save_json(FOLDER/'timeline.json',timeline)
 meta=dict(settings);meta.update({'image':'DesignAssets/Animations/CreatureHurtV6/white-paw/hurt.webp','source':'Source/seed.png','method':timeline['method'],'timeline':'timeline.json','registration':'registration.json','supportTrace':'support-trace.json','renderer':'render.py','registrationRenderer':'register.py','generation':'Source/generation.json','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','previewPauseMs':900,'artworkScale':1,'drawnPoseCount':7,'previousVersion':'CreatureHurtV5'});save_json(FOLDER/'hurt.json',meta)
 contact=Image.new('RGB',(size*4,(size+20)*2),(42,49,44));draw=ImageDraw.Draw(contact)
 for n,i in enumerate([0,1,2,4,6,8,10,15]):
  x=n%4*size;y=n//4*(size+20);contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i),(245,245,220))
 contact.save(FOLDER/'hurt-contact.png');print('white-paw V6: exact near hind support, 16 frames, 760 ms')

if __name__=='__main__':main()
