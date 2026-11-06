from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',24)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
checks={}
for kind in ['bleed','drain']:
 src=Image.open(p/f'{kind}-sheet.png').convert('RGBA'); fs=[]
 out=p/(kind+'-frames');out.mkdir(exist_ok=True)
 for n in range(16):
  x=n%4;y=n//4
  frame=src.crop((round(x*src.width/4),round(y*src.height/4),round((x+1)*src.width/4),round((y+1)*src.height/4))).resize((320,320),Image.Resampling.LANCZOS)
  frame.save(out/f'{n:02}.png');fs.append(frame)
 checks[kind]={'frames':16,'unique_frames':len(set(hashlib.sha256(x.tobytes()).hexdigest() for x in fs)),'alpha':src.getchannel('A').getextrema(),'fps':12,'source_size':src.size}
 proc=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','1120x720','-framerate','30','-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(p/f'{kind}-animated-v2.mp4')],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
 for f in range(360):
  t=f/30;slow=t>=6;phase=((t-6)*.4 if slow else t)%2.2;n=int(phase*12)
  im=Image.new('RGBA',(1120,720),(25,34,46,255));d=ImageDraw.Draw(im)
  d.text((35,25),kind.upper()+' V2 / FRAME ANIMATION',font=font,fill='white')
  d.text((35,65),'0.4x playback' if slow else 'Normal playback / 12 unique frames per second',font=small,fill=(185,205,222))
  for cx,cy,sz in [(315,370,450),(860,370,200)]:
   d.rounded_rectangle((cx-45,cy-30,cx+45,cy+100),radius=20,fill=(77,91,111))
   d.ellipse((cx-65,cy+100,cx+65,cy+120),fill=(40,53,69))
   if n<16:
    frame=fs[n].resize((sz,sz),Image.Resampling.LANCZOS);im.alpha_composite(frame,(cx-sz//2,cy-sz//2))
  d.text((150,645),'Large / neutral scale guide',font=small,fill='white');d.text((740,645),'Small readability',font=small,fill='white')
  if f==18:im.convert('RGB').save(p/f'{kind}-preview.jpg')
  proc.stdin.write(im.convert('RGB').tobytes())
 proc.stdin.close();assert proc.wait()==0
(p/'checks.json').write_text(json.dumps(checks,indent=2))
