from pathlib import Path
from PIL import Image,_webp
import json,math

folder=Path(__file__).resolve().parent
asset=folder.parent
project=asset.parents[3]
meta=json.loads((asset/'death.json').read_text('utf-8'))
reference=json.loads((folder/'runtime_reference.json').read_text('utf-8'))
frame_size=256
frames=[Image.open(asset/path).convert('RGBA').resize((frame_size,frame_size),Image.Resampling.LANCZOS) for path in meta['sourceFrames']]
idle=Image.open(project/reference['image']).crop((0,0,reference['frameSize'],reference['frameSize']))
bounds=lambda image:image.getchannel('A').point(lambda alpha:255 if alpha>=16 else 0).getbbox()
a=bounds(idle);b=bounds(frames[0])
reference_extent=max(a[2]-a[0],a[3]-a[1]);extent=max(b[2]-b[0],b[3]-b[1]);ratio=extent/reference_extent
view_size=reference['frameSize']*ratio
pivot_x=(b[0]+b[2])/2-((a[0]+a[2])/2-reference['pivotX'])*ratio
pivot_y=b[3]-(a[3]-reference['pivotY'])*ratio
columns=meta['columns'];rows=math.ceil(len(frames)/columns)
sheet=Image.new('RGBA',(frame_size*columns,frame_size*rows))
for index,frame in enumerate(frames):sheet.paste(frame,(index%columns*frame_size,index//columns*frame_size))
(asset/'runtime.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
runtime={'name':meta['name'],'action':'death','image':meta['image'].replace('/death.webp','/runtime.webp'),'frameSize':frame_size,'viewSize':view_size,'pivotX':pivot_x,'pivotY':pivot_y,'columns':columns,'frameCount':len(frames),'durationsMs':meta['durationsMs'],'durationMs':meta['durationMs'],'loop':False}
policy=json.loads((project/'DesignAssets/image-sizes.json').read_text('utf-8'))
scale=reference['frameSize']/512*480/reference_extent
display=policy['baseZoom']*1.4*scale*frame_size/view_size
runtime['displaySize']=display
runtime['alignment']={'reference':reference,'referenceBounds':list(a),'runtimeFirstBounds':list(b),'method':'match neutral maximum extent, horizontal center and floor contact'}
(asset/'runtime.json').write_bytes((json.dumps(runtime,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))
print(json.dumps({key:runtime[key] for key in ['frameSize','viewSize','pivotX','pivotY','frameCount','durationMs','displaySize']}))