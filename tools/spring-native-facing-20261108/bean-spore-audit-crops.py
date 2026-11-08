from PIL import Image,ImageDraw,ImageFont
import json,math
from pathlib import Path
root=Path.cwd();out=root/'tools/spring-native-facing-20261108';a=json.load(open(out/'bean-spore-audit-registry.json'));font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def crops(c,ids):
 s=Image.open(root/c['image']).convert('RGBA');w=c['frameSize'];h=c.get('frameHeight',w);cols=c['columns'];ret=[]
 for i in ids:
  x=i%cols*w;y=i//cols*h;p=s.crop((x,y,x+w,y+h));b=p.getbbox();ret.append(p.crop(b) if b else p)
 return ret
for tribe in ['bean','spore']:
 keys=[k for k in a if k.startswith(tribe+'/')]
 for page in range(3):
  group=keys[page*6:page*6+6];rows=[]
  for k in group:
   v=a[k]['actions'];neutral=[]
   for act in ['idle','walk']:
    c=v[act];ids=c.get('frames')or list(range(c['frameCount']));neutral.extend([(act+':'+str(i),p)for i,p in zip([ids[0],ids[-1]],crops(c,[ids[0],ids[-1]]))])
   rows.append((k+' NEUTRAL',neutral))
   for act in ['attack','ranged']:
    if act not in v:continue
    c=v[act];ids=c.get('frames')or list(range(c['frameCount']));ps=crops(c,ids)
    for offset in range(0,len(ids),16):rows.append((k+' '+act,[(str(i),p)for i,p in zip(ids[offset:offset+16],ps[offset:offset+16])]))
  im=Image.new('RGB',(1280,len(rows)*120),(228,232,235));d=ImageDraw.Draw(im)
  for ri,(label,ps) in enumerate(rows):
   y=ri*120;d.text((2,y),label,fill='black',font=font)
   for j,(idx,p)in enumerate(ps):
    p.thumbnail((76,88));x=j*80;im.paste(p,(x+(76-p.width)//2,y+30+(88-p.height)//2),p);d.text((x,y+15),idx,fill='black',font=font)
  im.save(out/f'{tribe}-facing-full-{page}.jpg',quality=96)
