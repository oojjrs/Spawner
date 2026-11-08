from PIL import Image,ImageDraw,ImageFont
import json
from pathlib import Path
root=Path.cwd();out=root/'tools/spring-native-facing-20261108';a=json.load(open(out/'bean-spore-remaining-registry.json'));font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def crops(c,ids):
 s=Image.open(root/c['image']).convert('RGBA');w=c['frameSize'];h=c.get('frameHeight',w);cols=c['columns'];ret=[]
 for i in ids:
  x=i%cols*w;y=i//cols*h;p=s.crop((x,y,x+w,y+h));b=p.getbbox();ret.append(p.crop(b)if b else p)
 return ret
def add(rows,label,c,ids=None):
 ids=ids if ids is not None else (c.get('frames')or list(range(c['frameCount'])));ps=crops(c,ids)
 for off in range(0,len(ids),16):rows.append((label,[(str(i),p)for i,p in zip(ids[off:off+16],ps[off:off+16])]))
def save(rows,name):
 im=Image.new('RGB',(1280,len(rows)*120),(228,232,235));d=ImageDraw.Draw(im)
 for ri,(label,ps)in enumerate(rows):
  y=ri*120;d.text((2,y),label,fill='black',font=font)
  for j,(idx,p)in enumerate(ps):
   p.thumbnail((76,88));x=j*80;im.paste(p,(x+(76-p.width)//2,y+30+(88-p.height)//2),p);d.text((x,y+15),idx,fill='black',font=font)
 im.save(out/name,quality=96)
keys=list(a)
for page in range(7):
 rows=[]
 for k in keys[page*4:page*4+4]:
  d=a[k];c=d['reference'];first=crops(c,[0])[0];ps=[('idle',first)]
  if d.get('portrait'):
   p=Image.open(root/d['portrait']).convert('RGBA');b=p.getbbox();ps.append(('portrait',p.crop(b)if b else p))
  rows.append((k+' neutral comparison',ps))
  for act in ['hurt','death']:add(rows,k+' '+act,d['actions'][act])
  b=d['actions']['birth'];layers=b.get('sceneLayers',{}).get('layers',[])
  if layers:
   for l in layers:
    if l['role']=='body':add(rows,k+' birth-body',l)
   add(rows,k+' birth-composite sample',b,[0,b['frameCount']//2,b['frameCount']-1])
  else:add(rows,k+' birth',b)
  used={c['image']for ac,c in d['actions'].items()if ac not in ['harvest','carry','throw']}
  for act in ['harvest','carry','throw']:
   c=d['actions'].get(act)
   if c and c['image']not in used:add(rows,k+' '+act,c);used.add(c['image'])
 save(rows,f'bean-spore-remaining-{page}.jpg')
envs={l['image']:l for d in a.values()for l in d['actions']['birth'].get('sceneLayers',{}).get('layers',[])if l['role']=='environment'}
for i,(p,c)in enumerate(envs.items()):
 rows=[];add(rows,p,c);save(rows,f'bean-spore-environment-{i}.jpg')
