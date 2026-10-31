from pathlib import Path
from PIL import Image
import json
import math

folder=Path(__file__).resolve().parent
source=folder/'Source'
raw=Image.open(source/'walk-raw.png').convert('RGBA')
anchor=Image.open(source/'original.png').convert('RGBA')
count=6
size=288
columns=6
step=raw.width/count
boundaries=[0,217,429,630,835,1044,1254]
alpha=raw.getchannel('A').point(lambda a:255 if a>32 else 0)
first=alpha.crop((0,0,boundaries[1],raw.height)).getbbox()
anchor_box=anchor.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
scale=(anchor_box[2]-anchor_box[0])/(first[2]-first[0])
root_x=(anchor_box[0]+anchor_box[2])/2
root_y=anchor_box[3]
raw_root_x=114.5
root_spacing=206.5
raw_root_y=first[3]
durations=[110,85,125,110,85,125]
frames=[]
(folder/'Frames').mkdir(511,True,True)
registrations=[]
for index in range(count):
    slot=raw.crop((boundaries[index],0,boundaries[index+1],raw.height))
    source_root=raw_root_x+index*root_spacing-boundaries[index]
    frame=slot.transform((size,size),Image.Transform.AFFINE,(1/scale,0,source_root-root_x/scale,0,1/scale,raw_root_y-root_y/scale),Image.Resampling.BICUBIC)
    cleanup=source/('speck-mask-'+str(index+1).zfill(2)+'.png')
    if cleanup.exists():
        frame.paste((0,0,0,0),(0,0,size,size),Image.open(cleanup).convert('L'))
    frame.save(folder/'Frames'/(str(index+1).zfill(2)+'.png'))
    frames.append(frame)
    registrations.append({'slot':index,'sourceSlotX':boundaries[index],'sharedScale':scale,'rootX':root_x,'groundY':root_y,'sourceNominalRootX':raw_root_x+index*root_spacing,'cropBoundary':boundaries[index:index+2]})
sheet=Image.new('RGBA',(columns*size,size),(0,0,0,0))
for index,frame in enumerate(frames):
    sheet.paste(frame,(index*size,0))
sheet.save(folder/'walk.webp','WEBP',**{'lossless':True,'method':4})
for name,dimension in [('thumb.webp',64),('preview.webp',256)]:
    resized=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    resized[0].save(folder/name,'WEBP',**{'save_all':True,'append_images':resized[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
record={'image':'DesignAssets/Animations/CreatureWalkV2/white-paw/walk.webp','frameSize':size,'columns':columns,'durationsMs':durations,'loop':True,'pivotX':192.5,'pivotY':242,'cyclesPerCell':2.5,'method':'Six complete hand-drawn-style gait phases generated in one built-in imagegen edit from the shipped seed, following the official Game Studio sprite-pipeline. Each phase has newly drawn articulated paws. One shared affine scale, horizontal slot anchor and ground baseline preserve drawing registration; no whole-image warp, no synthetic in-between frames.','rootMotion':False,'source':'Source/walk-raw.png','frames':'Frames','normalization':'pack.py'}
timeline={'phases':['near-front-contact','near-front-support-far-front-swing','opposite-front-reach','opposite-contact','opposite-support-near-front-swing','near-front-reach'],'durationsMs':durations,'sourceFrameCount':6,'registrations':registrations,'officialScriptOutputs':'Source/official-normalized','sourceScaleLocked':True,'registration':'The same affine map is applied to all slots; never crop, scale or center each frame independently.'}
for name,data in [('walk.json',record),('timeline.json',timeline)]:
    (folder/name).write_bytes((json.dumps(data,**{'ensure_ascii':False,'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
print('white-paw',count,'drawn phases',scale,'shared scale',root_x,root_y)
