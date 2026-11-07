from pathlib import Path
from PIL import Image,ImageDraw
import json,sys
D=Path(__file__).resolve().parent;m=json.loads((D/'complete-scene-manifest.json').read_text());n=m['frameCount'];mode=sys.argv[1]
if mode=='sheet':
 sheet=Image.new('RGBA',(512*8,512*((n+7)//8)))
 for i in range(n):
  with Image.open(D/'complete-frames'/f'{i:03d}.png') as f:sheet.paste(f,(i%8*512,i//8*512))
 sheet.save(D/'bean-base-birth-complete-v1-sheet.png');print('sheet done',sheet.size)
elif mode=='webp':
 frames=[Image.open(D/'complete-frames'/f'{i:03d}.png').convert('RGBA') for i in range(n)];frames[0].save(D/'bean-base-birth-complete-v1-preview.webp',save_all=True,append_images=frames[1:],duration=m['durationsMs'],lossless=True,loop=0,method=3);print('webp done')
else:
 frames=[]
 for i in range(n):
  im=Image.open(D/'complete-frames'/f'{i:03d}.png').convert('RGBA');bg=Image.new('RGBA',(512,512),(35,42,43,255));bg.alpha_composite(im);frames.append(bg.convert('RGB').resize((384,384),Image.Resampling.LANCZOS))
 edges=[round(t/10)*10 for t in m['timesMs']]+[3850];dur=[b-a for a,b in zip(edges,edges[1:])];assert sum(dur)==3850 and min(dur)>0
 frames[0].save(D/'bean-base-birth-complete-v1-preview.gif',save_all=True,append_images=frames[1:],duration=dur,loop=0,disposal=2,optimize=False)
 samples=[0,300,520,720,1180,1600,1780,2320,2500,2570,2590,2770,2890,3210,3270,3840];c=Image.new('RGB',(4*256,4*282),(35,42,43));draw=ImageDraw.Draw(c)
 for j,t in enumerate(samples):
  i=min(range(n),key=lambda k:abs(m['timesMs'][k]-t));c.paste(frames[i].resize((256,256),Image.Resampling.LANCZOS),(j%4*256,j//4*282));draw.text((j%4*256+7,j//4*282+260),f'{m["timesMs"][i]}ms',fill='white')
 c.save(D/'complete-scene-contact.jpg',quality=95);print('gif/contact done')
