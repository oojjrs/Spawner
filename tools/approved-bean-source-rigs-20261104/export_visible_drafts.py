#!/usr/bin/env python3
"""Export four real mesh/field motion drafts at their unchanged 512px camera."""
import json
import subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from build_visible_parts import FAMILY,HERE,ROOT,action_delta,render

fps=18;duration=4.8;masks=[0,8,18,30];sources=[]
for mask in masks:
    folder=FAMILY/f'{mask:02x}'/'Rig';rig=json.loads((folder/'visible-parts.json').read_text())
    rgba=np.array(Image.open(ROOT/rig['sourceImage']).convert('RGBA'))
    field=np.array(Image.open(folder/'body-weight.png'),dtype=float)/255
    sources.append((mask,rig,rgba,field))
out=HERE/'visible-idle-hurt-drafts.mp4'
command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24',
         '-video_size','1024x1024','-framerate',str(fps),'-i','pipe:0','-an','-c:v','libx264',
         '-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
process=subprocess.Popen(command,stdin=subprocess.PIPE)
font=ImageFont.truetype('DejaVuSans.ttf',18)
for frame_index in range(round(duration*fps)):
    seconds=frame_index/fps
    action='idle' if seconds<3.6 else 'hurt' if seconds<4.36 else 'neutral'
    t=seconds/3.6 if action=='idle' else (seconds-3.6)/.76 if action=='hurt' else 0
    sheet=Image.new('RGB',(1024,1024),'#1b2c22');draw=ImageDraw.Draw(sheet)
    for index,(mask,rig,rgba,field) in enumerate(sources):
        x,y=index%2*512,index//2*512
        draw.line((x+12,y+448,x+500,y+448),fill='#66815b')
        image=Image.fromarray(render(rgba,field,action_delta(action,t,rig['draftActions']['amplitudeScale'])))
        sheet.paste(image,(x,y),image)
        draw.text((x+18,y+18),f'bean {mask:02x} | {action} draft | fixed 512 camera',fill='#d8e5d4',font=font)
        draw.text((x+18,y+46),'own source only / feet + hard parts pinned',fill='#aabd9f',font=font)
    process.stdin.write(sheet.tobytes())
process.stdin.close();assert process.wait()==0
(HERE/'visible-draft-video.json').write_text(json.dumps({'path':str(out.relative_to(ROOT)),'frames':round(duration*fps),
    'fps':fps,'durationSeconds':round(duration*fps)/fps,'sourceMasks':masks,'cameraPerSource':[512,512],
    'scope':'Source-only conservative idle/hurt review drafts. No hidden art, production action registration or worldReady change.'},indent=2)+'\n')
print(json.dumps({'video':str(out.relative_to(ROOT)),'bytes':out.stat().st_size,'frames':round(duration*fps)}))
