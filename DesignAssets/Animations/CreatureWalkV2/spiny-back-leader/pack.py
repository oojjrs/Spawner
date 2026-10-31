from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json

folder=Path(__file__).resolve().parent
config=json.loads((folder/'pack.json').read_text('utf8'))
raw=Image.open(folder/'Source/walk-raw.png').convert('RGBA')
anchor=Image.open(folder/'Source/original.png').convert('RGBA')
count=6
size=anchor.width
step=raw.width/count
mask=np.array(raw.getchannel('A'))>128
occupancy=np.sum(mask,axis=0)
boundaries=[0]
for index in range(1,count):
    expected=index*step
    start=max(boundaries[-1]+1,round(expected-step*.2))
    end=min(raw.width-1,round(expected+step*.2))
    scores=occupancy[start:end]
    candidates=np.where(scores==scores.min())[0]+start
    boundary=int(candidates[np.argmin(np.abs(candidates-expected))])
    boundaries.append(boundary)
boundaries.append(raw.width)
first=raw.crop((0,0,boundaries[1],raw.height)).getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
anchor_box=anchor.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
raw_root_x=(first[0]+first[2])/2
last=raw.crop((boundaries[-2],0,boundaries[-1],raw.height)).getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
last_root_x=boundaries[-2]+(last[0]+last[2])/2
root_spacing=(last_root_x-raw_root_x)/(count-1)
raw_root_y=first[3]
root_x=(anchor_box[0]+anchor_box[2])/2
root_y=anchor_box[3]
scale=min((anchor_box[2]-anchor_box[0])/(first[2]-first[0]),(anchor_box[3]-anchor_box[1])/(first[3]-first[1]))
extremes=[]
for index in range(count):
    slot=raw.crop((boundaries[index],0,boundaries[index+1],raw.height))
    bounds=slot.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    nominal=raw_root_x+index*root_spacing-boundaries[index]
    extremes.append([bounds[0]-nominal,bounds[1]-raw_root_y,bounds[2]-nominal,bounds[3]-raw_root_y])
max_left=max(-bounds[0] for bounds in extremes)
max_right=max(bounds[2] for bounds in extremes)
max_up=max(-bounds[1] for bounds in extremes)
max_down=max(bounds[3] for bounds in extremes)
scale=min(scale,(root_x-4)/max_left,(size-root_x-4)/max_right,(root_y-4)/max_up)
if max_down>0:
    scale=min(scale,(size-root_y-4)/max_down)
frames=[]
registrations=[]
(folder/'Frames').mkdir(511,True,True)
for index in range(count):
    slot=raw.crop((boundaries[index],0,boundaries[index+1],raw.height))
    pixels=np.array(slot)
    pixels[pixels[:,:,3]<8]=0
    slot=Image.fromarray(pixels)
    source_root=raw_root_x+index*root_spacing-boundaries[index]
    frame=slot.transform((size,size),Image.Transform.AFFINE,(1/scale,0,source_root-root_x/scale,0,1/scale,raw_root_y-root_y/scale),Image.Resampling.BICUBIC)
    frame.save(folder/'Frames'/(str(index+1).zfill(2)+'.png'))
    frames.append(frame)
    registrations.append({'frame':index+1,'sourceBoundary':boundaries[index:index+2],'sourceNominalRootX':raw_root_x+index*root_spacing,'sharedScale':scale,'rootX':root_x,'groundY':root_y})
if config.get('stableJawFrame'):
    index=config['stableJawFrame']-1
    jaw_mask=Image.new('L',(size,size),0)
    ImageDraw.Draw(jaw_mask).polygon([tuple(point) for point in config['stableJawPolygon']],255)
    jaw_mask=jaw_mask.filter(ImageFilter.GaussianBlur(.5))
    frames[index]=Image.composite(frames[0],frames[index],jaw_mask)
    frames[index].save(folder/'Frames'/(str(index+1).zfill(2)+'.png'))
sheet=Image.new('RGBA',(size*count,size),(0,0,0,0))
for index,frame in enumerate(frames):
    sheet.paste(frame,(index*size,0))
sheet.save(folder/'walk.webp','WEBP',**{'lossless':True,'method':4})
durations=config['durationsMs']
for name,dimension in [('preview.webp',256),('thumb.webp',64)]:
    sequence=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    sequence[0].save(folder/name,'WEBP',**{'save_all':True,'append_images':sequence[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
record={'image':'DesignAssets/Animations/CreatureWalkV2/'+folder.name+'/walk.webp','frameSize':size,'columns':count,'durationsMs':durations,'loop':True,'pivotX':config['pivot'][0],'pivotY':config['pivot'][1],'cyclesPerCell':config['cyclesPerCell'],'method':'Six complete drawn movement phases from one built-in imagegen edit of the shipped seed, following official Game Studio sprite-pipeline. A single shared affine scale and nominal slot root register the entire strip; no per-frame rescale or tight-box recenter, no warped or interpolated filler.','rootMotion':False,'airborneTrajectory':config.get('airborne',False),'source':'Source/walk-raw.png','frames':'Frames','normalization':'pack.py'}
timeline={'durationMs':sum(durations),'phases':config['phases'],'durationsMs':durations,'sourceFrameCount':count,'registrations':registrations,'normalizationNote':'The same scale and ground map is used for every source slot. Bounds only separate neighboring sprites and prevent clipping; pose-dependent vertical flight remains intact.'}
if config.get('stableJawFrame'):
    record['attachmentRepair']='Phase five reuses only the accepted phase-one mandibular pixels through the saved polygon mask, correcting an unwanted pointed dark mandible while retaining its walking legs.'
    timeline['attachmentRepair']={'frame':config['stableJawFrame'],'sourceFrame':1,'polygon':config['stableJawPolygon']}
for name,data in [('walk.json',record),('timeline.json',timeline)]:
    (folder/name).write_bytes((json.dumps(data,**{'ensure_ascii':False,'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
print(folder.name,'shared-scale',round(scale,5),'cuts',boundaries,'6 drawn phases')
