from pathlib import Path
from PIL import Image,ImageDraw
import json
import math

FOLDER=Path(__file__).resolve().parent

def affine(image,pivot,angle,lift):
 if abs(angle)+abs(lift)<1e-9:return image.copy()
 scale=3
 large=image.convert('RGBa').resize((image.width*scale,image.height*scale),Image.Resampling.LANCZOS)
 px,py=[v*scale for v in pivot];r=math.radians(angle);c=math.cos(r);s=math.sin(r);dy=-lift*scale
 inverse=[c,s,px-c*px-s*(py+dy),-s,c,py+s*px-c*(py+dy)]
 return large.transform(large.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).resize(image.size,Image.Resampling.LANCZOS).convert('RGBA')

def main():
 rig=json.loads((FOLDER/'rig.json').read_text('utf8'));timeline=json.loads((FOLDER/'timeline.json').read_text('utf8'));data=json.loads((FOLDER/'hurt.json').read_text('utf8'))
 sources={k:Image.open(FOLDER/v).convert('RGBA') for k,v in timeline['sources'].items()}
 bases={k:Image.open(FOLDER/('Parts/base-'+k+'.png')).convert('RGBA') for k in sources}
 attachments={k:{p['name']:Image.open(FOLDER/('Parts/'+p['name']+'-'+k+'.png')).convert('RGBA') for p in rig['attachments']} for k in sources}
 size=data['frameSize'];frames=[]
 for number,pose in enumerate(timeline['poses']):
  expression=pose['expression']
  if number in [0,15]:frame=sources['seed'].copy()
  else:
   frame=Image.new('RGBA',(size,size))
   for part in rig['attachments']:
    frame.alpha_composite(affine(attachments[expression][part['name']],part['pivot'],pose['localDegrees'][part['name']],0))
   frame.alpha_composite(bases[expression])
   frame=affine(frame,timeline['pivot'],pose['clockwiseDegrees'],pose['liftPixels'])
  frames.append(frame)
 sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
 for number,frame in enumerate(frames):
  sheet.paste(frame,(number%4*size,number//4*size));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(number%4*64,number//4*64))
 options={'lossless':True,'method':4,'exact':True}
 sheet.save(FOLDER/'hurt.webp','WEBP',**options);matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**options)
 durations=data['durationsMs'].copy();durations[-1]+=900
 options.update({'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0})
 frames[0].save(FOLDER/'hurt-preview.webp','WEBP',**options)
 small=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames];options['append_images']=small[1:]
 small[0].save(FOLDER/'hurt-thumbnail.webp','WEBP',**options)
 contact=Image.new('RGB',(size*4,(size+20)*2),(38,45,41));draw=ImageDraw.Draw(contact)
 for number,index in enumerate([0,2,4,5,7,9,12,15]):
  x=number%4*size;y=number//4*(size+20);contact.paste(frames[index],(x,y),frames[index]);draw.text((x+6,y+size+3),str(index),(230,240,230))
 contact.save(FOLDER/'hurt-contact.png')
 print(json.dumps({'species':FOLDER.name,'frames':len(frames),'attachments':len(rig['attachments'])}))

if __name__=='__main__':main()
