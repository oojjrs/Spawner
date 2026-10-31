from pathlib import Path
from PIL import Image,ImageDraw
import json
import hashlib

folder=Path(__file__).resolve().parent
timeline=json.loads((folder/'timeline.json').read_text('utf8'))
size=timeline['canvas'][0]
supersample=timeline['supersample']
originals={key:Image.open(folder/value).convert('RGBA') for key,value in timeline['sources'].items()}
sources={key:value.resize((size*supersample,size*supersample),Image.Resampling.LANCZOS) for key,value in originals.items()}
frames=[]
for pose in timeline['poses']:
 image=originals[pose['expression']]
 angle=pose['rotationDegrees']
 lift=pose['liftPixels']
 if angle or lift:
  center=tuple(v*supersample for v in timeline['groundPivot'])
  image=sources[pose['expression']].rotate(angle,Image.Resampling.BICUBIC,False,center,(0,-lift*supersample),(0,0,0,0))
  image=image.resize((size,size),Image.Resampling.LANCZOS)
 frames.append(image)
sheet=Image.new('RGBA',(size*4,size*4),(0,0,0,0))
matrix=Image.new('RGBA',(256,256),(0,0,0,0))
for index,image in enumerate(frames):
 sheet.paste(image,(index%4*size,index//4*size))
 matrix.paste(image.resize((64,64),Image.Resampling.LANCZOS),(index%4*64,index//4*64))
sheet.save(folder/'hurt.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
matrix.save(folder/'hurt-matrix.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
durations=[pose['durationMs'] for pose in timeline['poses']]
preview_durations=durations.copy()
preview_durations[-1]+=timeline['previewPauseMs']
frames[0].save(folder/'hurt-preview.webp','WEBP',**{'save_all':True,'append_images':frames[1:],'duration':preview_durations,'loop':0,'lossless':True,'method':4,'exact':True})
small=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames]
small[0].save(folder/'hurt-thumbnail.webp','WEBP',**{'save_all':True,'append_images':small[1:],'duration':preview_durations,'loop':0,'lossless':True,'method':4,'exact':True})
contact=Image.new('RGB',(size*4,size*2),(35,42,48))
draw=ImageDraw.Draw(contact)
for number,index in enumerate([0,1,2,4,6,8,9,15]):
 frame=frames[index]
 contact.paste(frame,(number%4*size,number//4*size),frame)
 draw.text((number%4*size+5,number//4*size+5),str(index),(255,255,255))
contact.save(folder/'hurt-contact.png')
metadata={'image':'DesignAssets/Animations/CreatureHurtV3/'+timeline['species']+'/hurt.webp','frameSize':size,'columns':4,'pivotX':timeline['pivot'][0],'pivotY':timeline['pivot'][1],'durationsMs':durations,'frameCount':len(frames),'durationMs':sum(durations),'loop':False,'closedEyeHold':timeline['closedEyeHold'],'method':timeline['method'],'source':'Source/seed.png','timeline':'timeline.json','renderer':'render.py','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','sourceSeedSha256':hashlib.sha256((folder/'Source/seed.png').read_bytes()).hexdigest()}
(folder/'hurt.json').write_bytes((json.dumps(metadata,indent=2)+'\n').replace('\n','\r\n').encode('utf8'))
print(timeline['species'],len(frames),sum(durations),size)
