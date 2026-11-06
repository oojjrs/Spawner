from PIL import Image,ImageDraw,ImageFont
import math,subprocess,json
from pathlib import Path
p=Path(__file__).parent
src=Image.open(p/'star.png').convert('RGBA')
# Native animation assembly from separately generated sprite; original art stays unchanged.
star=src.resize((180,120),Image.Resampling.LANCZOS)
halo=Image.open(p/'halo.png').convert('RGBA').resize((380,160),Image.Resampling.LANCZOS)
N=72; frames=[];coords=[]
for f in range(N):
 t=f/N; im=Image.new('RGBA',(512,320));im.alpha_composite(halo,(66,77));d=ImageDraw.Draw(im)
 items=[]
 for j in range(3):
  a=math.tau*(t+j/3);x=256+166*math.cos(a);y=157+55*math.sin(a);depth=math.sin(a)
  items.append((depth,j,a,x,y))
 for depth,j,a,x,y in sorted(items):
  for k in range(18,0,-1):
   b=a-k*.025;xx=256+166*math.cos(b);yy=157+55*math.sin(b)
   r=1.5+2.5*(1-k/19);d.ellipse((xx-r,yy-r,xx+r,yy+r),fill=(255,190,40,int(110*(1-k/19))))
  sz=.77+.2*depth
  obj=star.resize((int(180*sz),int(120*sz)),Image.Resampling.LANCZOS).rotate(12*math.sin(a*2+j),Image.Resampling.BICUBIC,expand=True)
  im.alpha_composite(obj,(round(x-obj.width/2),round(y-obj.height/2)))
  coords.append([f,j,x,y])
 im.save(p/'frames'/f'{f:03}.png');frames.append(im)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
proc=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1120x720','-r','30','-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(p/'stun-orbit-review.mp4')],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for f in range(360):
 tm=f/30;phase=tm if tm<6 else (tm-6)*.4;idx=int(phase*30)%N
 im=Image.new('RGBA',(1120,720),(25,34,46,255));d=ImageDraw.Draw(im)
 d.text((35,25),'STUN V3 / GOLDEN HALO + ORBITING STARS',font=font,fill='white')
 d.text((35,65),'Normal speed' if tm<6 else 'Slow motion (0.4x)',font=small,fill=(180,200,218))
 for cx,sz in [(330,560),(875,250)]:
  cy=325;d.rounded_rectangle((cx-int(sz*.13),cy+35,cx+int(sz*.13),cy+int(sz*.38)),radius=25,fill=(90,106,124))
  lay=frames[idx].resize((sz,round(sz*320/512)),Image.Resampling.LANCZOS)
  im.alpha_composite(lay,(cx-lay.width//2,cy-lay.height//2))
 d.text((140,600),'Large review',font=small,fill='white');d.text((790,600),'Small review',font=small,fill='white')
 d.text((35,665),'Restored golden halo; star orbit and timing unchanged. Asset-only preview.',font=small,fill=(180,200,218))
 if f in (0,18,36,54):im.convert('RGB').save(p/f'review-{f:02}.jpg')
 proc.stdin.write(im.convert('RGB').tobytes())
proc.stdin.close();assert proc.wait()==0
(p/'motion.json').write_text(json.dumps({'fps':30,'frames':N,'loop_seconds':2.4,'canvas':[512,320],'positions':coords},indent=2))
