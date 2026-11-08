#!/usr/bin/env python3
"""Read HEAD/source proof and render labeled before/after audit crops only."""
from pathlib import Path
import io,json,subprocess,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
s=json.loads((HERE/'bean-spore-plan-registry.json').read_text());p=json.loads((HERE/'bean-spore-technical-plan.json').read_text());proof=json.loads((HERE/'bean-spore-image-changes.json').read_text());font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
def picks(c):
 seq=c.get('frames') or list(range(c['frameCount']));time=c.get('hitTimeMs',c.get('hitAtMs',c.get('launchAtMs')));peak=len(seq)//2
 if time is not None:
  elapsed=0
  for i,d in enumerate(c.get('durationsMs',[])):
   elapsed+=d
   if elapsed>time:peak=i;break
 return [seq[0],seq[min(len(seq)-1,peak)],seq[-1]]
def crop_at(im,c,i):
 w=c['frameSize'];h=c.get('frameHeight',w);cols=c['columns'];out=im.crop((i%cols*w,i//cols*h,(i%cols+1)*w,(i//cols+1)*h)).convert('RGBA');b=out.getbbox();out=out.crop(b) if b else out;out.thumbnail((122,112),Image.Resampling.LANCZOS);return out
for page in range(2):
 keys=p['candidateForms'][page*14:(page+1)*14];board=Image.new('RGB',(1024,158*len(keys)),(231,235,237));d=ImageDraw.Draw(board)
 for row,key in enumerate(keys):
  definition=s['UNIT_ACTION_ART'][key];idle=definition['actions']['idle'];action='attack' if 'attack' in definition['actions'] else 'ranged' if 'ranged' in definition['actions'] else 'walk';attack=definition['actions'][action];items=[('idle',idle,[(idle.get('frames')or[0])[0]]),(action,attack,picks(attack))];column=0;y=row*158;d.text((4,y+2),key,fill=(10,10,10),font=font)
  for label,c,ids in items:
   name=c['image'];record=proof['changes'][name];before=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT);assert hashlib.sha256(before).hexdigest()==record['beforeSha256'];cropped=[]
   with Image.open(io.BytesIO(before)) as image:cropped.append([crop_at(image,c,i) for i in ids])
   with Image.open(ROOT/record['newImage']) as image:cropped.append([crop_at(image,c,i) for i in ids])
   for n,i in enumerate(ids):
    for side in range(2):
     x=column*128;d.text((x+3,y+20),f'{label} {i} '+('BEFORE' if side==0 else 'AFTER'),fill=(90,90,90) if side==0 else (0,95,45),font=font);im=cropped[side][n];board.paste(im,(x+(128-im.width)//2,y+39+(112-im.height)//2),im);column+=1
 board.save(HERE/f'bean-spore-post-normalization-contact-{page}.jpg',quality=95)
 print('contact page',page,'ready',flush=True)
