from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import math,subprocess,json,hashlib
p=Path(__file__).parent
sheet=Image.open(p/'source-sheet.png').convert('RGBA')
old=Image.open(p.parent/'healing-vfx-v1-20261106/healing-surge.png').convert('RGBA')
keys=[]
for i in range(16):
 x=i%4;y=i//4
 # Exclude the generated divider and preserve identical canvas size/coordinates.
 box=(round(x*sheet.width/4)+7,round(y*sheet.height/4)+7,round((x+1)*sheet.width/4)-7,round((y+1)*sheet.height/4)-7)
 keys.append(sheet.crop(box).resize((384,384),Image.Resampling.LANCZOS))
# Independent particles use the generated final sparkle, not a new painted stand-in.
spark=keys[15].crop((155,75,215,145))
spark=spark.crop(spark.getchannel('A').point(lambda a:255 if a>40 else 0).getbbox())
spark.save(p/'spark.png')
blank=Image.new('RGBA',(384,384))
# Timeline of actual redraws; rise, curl, split and dissipation.
times=[0,.08,.16,.24,.33,.42,.52,.62,.73,.84,.96,1.08,1.21,1.34,1.47,1.60]
def new_frame(t):
 if t<0 or t>1.85:return blank.copy()
 idx=max(i for i,v in enumerate(times) if v<=min(t,times[-1]))
 if idx<15:
  im=keys[idx].copy()  # Crisp keyframe hold, no crossfade ghosting
 else:
  im=keys[-1].copy(); im.putalpha(im.getchannel('A').point(lambda a:int(a*max(0,(1.85-t)/.25))))
 if t<.08:im.putalpha(im.getchannel('A').point(lambda a:int(a*t/.08)))
 for j in range(8):
  birth=.24+j*.09; q=(t-birth)/.66
  if not 0<=q<=1:continue
  side=1 if j%2 else -1
  x=192+side*(65+22*math.sin(q*math.pi+j*.5));y=305-235*q
  n=int((13+(j%3)*4)*math.sin(math.pi*q)**.5)
  if n<2:continue
  s=spark.resize((n,n),Image.Resampling.LANCZOS);s.putalpha(s.getchannel('A').point(lambda a:int(a*math.sin(math.pi*q))))
  im.alpha_composite(s,(int(x-n/2),int(y-n/2)))
 return im
frames=[]
for i in range(60):
 im=new_frame(i/30); im.save(p/'frames'/f'{i:03}.png');frames.append(im)
atlas=Image.new('RGBA',(384*10,384*6))
for i,im in enumerate(frames):atlas.alpha_composite(im,((i%10)*384,(i//10)*384))
atlas.save(p/'healing-v2-atlas.png')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
proc=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','1280x720','-framerate','30','-i','-','-an','-c:v','libx264','-crf','17','-pix_fmt','yuv420p',str(p/'healing-v2-comparison.mp4')],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for f in range(360):
 t=f/30;phase=t%2.4
 im=Image.new('RGBA',(1280,720),(25,34,46,255));d=ImageDraw.Draw(im)
 d.text((35,24),'HEALING / REDRAWN ANIMATION STUDY',font=font,fill='white')
 d.text((35,65),'All views at normal speed (1x)  |  Repeats every 2.4 seconds',font=small,fill=(180,205,220))
 for cx,cy,size,which,label in [(245,375,375,'old','V1 / single-image motion'),(710,375,430,'new','V2 / changing ribbon + rising motes'),(1110,390,190,'new','V2 / small scale')]:
  d.ellipse((cx-size*.26,cy+size*.28,cx+size*.26,cy+size*.38),fill=(40,53,67))
  d.rounded_rectangle((cx-size*.12,cy-size*.05,cx+size*.12,cy+size*.29),radius=13,fill=(83,102,121))
  if which=='old':
   q=phase/1.8;a=min(1,q/.13,max(0,(1-q)/.3));scale=.72+.28*min(1,q/.2)+.12*max(0,q-.5)
   n=max(1,int(size*scale));layer=old.resize((n,n),Image.Resampling.LANCZOS);layer.putalpha(layer.getchannel('A').point(lambda v:int(v*a)))
  else:
   n=size;layer=new_frame(phase).resize((size,size),Image.Resampling.LANCZOS)
  im.alpha_composite(layer,(cx-n//2,cy-n//2))
  tw=d.textbbox((0,0),label,font=small)[2];d.text((cx-tw/2,620),label,font=small,fill='white')
 d.text((35,675),'Standalone transparent asset. Gray silhouettes are scale guides, not in-game playback.',font=small,fill=(160,185,205))
 if f in [8,18,27,38,45]:im.convert('RGB').save(p/f'preview-{f:02}.jpg')
 proc.stdin.write(im.convert('RGB').tobytes())
proc.stdin.close();assert proc.wait()==0
report={'source_keyframes':16,'output_frames':60,'fps':30,'duration':2,'frame_size':[384,384],'atlas_grid':[10,6],'timeline':times,'unique_frame_hashes':len({hashlib.sha256(im.tobytes()).hexdigest() for im in frames}),'alpha_bounds':[im.getchannel('A').getbbox() for im in frames],'game_integration':False,'approved':False}
(p/'checks.json').write_text(json.dumps(report,indent=2))
