from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import subprocess,shutil
D=Path(__file__).resolve().parent;R=D.parent.parent
src=R/'generated_images/exec-7b3ca4b9-bc71-4a7f-bd54-bd0d66f52f45.png';shutil.copy(src,D/'birth-sheet.png');im=Image.open(src).convert('RGBA');cw=im.width/4;ch=im.height/2;new=[]
for i in range(8):
 c=im.crop((round(i%4*cw),round(i//4*ch),round((i%4+1)*cw),round((i//4+1)*ch)));b=c.getchannel('A').point(lambda a:255 if a>150 else 0).getbbox();c=c.crop(b);sc=320/(cw*.84);c=c.resize((round(c.width*sc),round(c.height*sc)),Image.Resampling.LANCZOS);f=Image.new('RGBA',(420,420));f.alpha_composite(c,((420-c.width)//2,390-c.height));f.save(D/f'birth-{i:02}.png');new.append(f)
roll=new
rise=[Image.open(R/f'art-review/pebble-stand-birth-v2/birth-{i:02}.png') for i in range(8)]
new=roll+roll+rise
import json
m=next(x for x in json.load(open(R/'art-review/pebble-minor-review-20261106/manifest.json')) if x['action']=='birth')
raw=Image.open(R/'Spawner-publish-current'/m['source']).convert('RGBA');sz=raw.width//8
old=[raw.crop((i%8*sz,i//8*sz,(i%8+1)*sz,(i//8+1)*sz)).resize((420,420),Image.Resampling.LANCZOS) for i in range(48)]
oldends=[];oe=0
for dt in m['durationsMs']:oe+=dt/1000;oldends.append(oe)
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',23);small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',18)
# Crouch/anticipation, foot placement, fast upward push, settling and a clear terminal hold.
durs=[.20]+[.08]*7+[.08]*7+[.16]+[.04,.04,.08,.04,.04,.06,.14,.70];ends=[];s=0
for d in durs:s+=d;ends.append(s)
p=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-pix_fmt','rgb24','-s','840x550','-r','30','-i','-','-an','-c:v','libx264','-crf','19','-pix_fmt','yuv420p',str(D/'pebble-roll-rise-comparison.mp4')],stdin=subprocess.PIPE,stderr=open(D/'render.log','w'))
for n in range(300):
 t=n/30;phase=t%3.2;idx=next((i for i,e in enumerate(ends) if phase<e),len(new)-1);oi=next((i for i,e in enumerate(oldends) if phase<e),47);o=Image.new('RGB',(840,550),(35,42,49));dr=ImageDraw.Draw(o);dr.text((20,12),'몽돌 발형 탄생 | 기본형처럼 구른 다음 기립',font=font,fill='white');dr.text((20,60),'기본형 실제 프레임',font=small,fill='white');dr.text((440,60),'돌발형: 앞구르기 → 기립',font=small,fill='white');o.paste(old[oi],(0,90),old[oi]);o.paste(new[idx],(420,90),new[idx]);dr.text((20,525),'정상 속도 · 전체 프레임 신규 원화 · 게임 미적용',font=small,fill=(185,195,205));p.stdin.write(o.tobytes())
p.stdin.close();assert p.wait()==0
