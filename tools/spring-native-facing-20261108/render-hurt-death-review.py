from PIL import Image,ImageDraw,ImageFont
import json,pathlib
out=pathlib.Path('tools/spring-native-facing-20261108');root=pathlib.Path('.');a=json.loads((out/'hurt-death-catalog.json').read_text());keys=list(a)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
for start in range(0,len(keys),4):
 rows=[]
 for k in keys[start:start+4]:
  for action in ['hurt','death']:
   c=a[k]['actions'][action];n=c['frameCount'];frames=c.get('frames') or list(range(n)); ids=frames if n<=16 else [round(i*(n-1)/15) for i in range(16)]
   rows.append((k,action,c,ids))
 im=Image.new('RGB',(1920,len(rows)*145),(226,228,232));d=ImageDraw.Draw(im)
 for row,(k,action,c,ids) in enumerate(rows):
  y=row*145;d.text((6,y),f'{k} {action} meta={c["sourceFacing"]} frames={c["frameCount"]}',fill='black',font=font)
  src=Image.open(root/c['image']).convert('RGBA');fw=c['frameSize'];fh=c.get('frameHeight',fw);col=c['columns']
  for t,idx in enumerate(ids):
   p=src.crop(((idx%col)*fw,(idx//col)*fh,(idx%col+1)*fw,(idx//col+1)*fh));b=p.getbbox()
   if b:p=p.crop(b)
   p.thumbnail((115,115));im.paste(p,(120*t+(115-p.width)//2,y+23+(115-p.height)//2),p);d.text((120*t,y+130),str(idx),fill='black',font=font)
 im.save(out/f'hurt-death-{start//4}.jpg',quality=93)
