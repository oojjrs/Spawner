from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,subprocess,math,numpy as np
p=Path(__file__).parent;tim=json.load(open(p/'birth-runtime-samples.json'))['frames'];font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',22);small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',16)
forms=['base','antenna','feet'];dur=[.12,.1,.14,.12,.14,.1,.12,.6];clips={}
for form in forms:
 for action,count in [('birth',13),('death',8)]:
  imgs=[Image.open(p/(f'{action}-{i}.png' if form=='base' else f'{form}-{action}/{i:03}.png')).convert('RGBA').resize((512,512)) for i in range(count)]
  clips[form,action]=imgs
X,Y=np.meshgrid(np.arange(512),np.arange(512));previews={}
for form in forms:
 result=[]
 for sample in tim:
  m=sample['motion'];v=sample['placement'];im=clips[form,'birth'][v['frame']];s=v['scale']*236/512;ax=m['anchorX']*512/236;ay=m['anchorY']*512/236;
  row=(Y-v['y']-ay*s)/(s*m['scaleY'])+ay
  depth=np.clip((row-448+224)/224,0,1);width=1+m['bulge']*np.sin(depth*np.pi);shift=m['sway']*224*np.sin(depth*np.pi*2)
  col=((X-v['x']-ax*s)/(s*m['scaleX'])+320*width-320+ax-shift)/width
  a=np.array(im);xx=np.floor(col).astype(int);yy=np.floor(row).astype(int);u=col-xx;vv=row-yy;valid=(xx>=0)&(xx<511)&(yy>=0)&(yy<511);xx=np.clip(xx,0,510);yy=np.clip(yy,0,510)
  out=(a[yy,xx]*(1-u)[...,None]*(1-vv)[...,None]+a[yy,xx+1]*u[...,None]*(1-vv)[...,None]+a[yy+1,xx]*(1-u)[...,None]*vv[...,None]+a[yy+1,xx+1]*u[...,None]*vv[...,None]);out[~valid]=0
  result.append(Image.fromarray(np.uint8(np.clip(out,0,255))))
 previews[form,'birth']=result
 previews[form,'death']=clips[form,'death']
 # all birth playback contacts, not just cels
 grid=Image.new('RGB',(1200,8*155),'#273640');d=ImageDraw.Draw(grid)
 for i,im in enumerate(result):
  z=im.resize((150,150));grid.paste(z,(i%8*150,i//8*155),z);d.text((i%8*150,i//8*155),str(i))
 grid.save(p/(form+'-birth-playback.jpg'))
W,H=1440,1010;proc=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','30','-i','-','-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(p/'spring-lifecycle-base-matched-v3.mp4')],stdin=subprocess.PIPE)
for n in range(360):
 out=Image.new('RGB',(W,H),'#17242f');d=ImageDraw.Draw(out);d.text((20,10),'샘방울 · 기본형 원본과 탄생 / 사망 비교',font=font,fill='white');d.text((20,44),'원본 13 / 8프레임·시간 유지 · 몸체 보존 / 부속지만 수정 · 탄생 낙하·착지 변형 포함',font=small,fill='#b3cbd4')
 for k,form in enumerate(forms):
  d.text((k*480+30,76),{'base':'기준: 기본형','antenna':'시안: 안테나형','feet':'시안: 발형'}[form],font=font,fill='#a8e2f5')
  bi=min(n%75,59);b=previews[form,'birth'][bi].resize((440,440));out.paste(b,(k*480+20,104),b)
  t=(n/30)%1.94;i=0
  for j,dt in enumerate(dur):
   i=j
   if t<dt:break
   t-=dt
  z=previews[form,'death'][i].resize((440,440));out.paste(z,(k*480+20,550),z)
 d.text((20,109),'탄생',font=font,fill='white');d.text((20,554),'사망',font=font,fill='white');proc.stdin.write(out.tobytes())
proc.stdin.close();assert proc.wait()==0
