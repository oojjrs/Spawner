from pathlib import Path
from PIL import Image, ImageDraw, _webp
import numpy as np
import importlib.util
import json

HERE=Path(__file__).resolve().parent
PIPELINE=Path('D:/.codex/plugins/cache/openai-curated/game-studio/1dc19589/scripts/normalize_sprite_strip.py')
spec=importlib.util.spec_from_file_location('official_normalize',PIPELINE)
official=importlib.util.module_from_spec(spec)
spec.loader.exec_module(official)

def json_file(path,value):
 encoder=json.JSONEncoder()
 encoder.ensure_ascii=False
 encoder.indent=2
 path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def webp(path,picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,pictures,durations):
 encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
 timestamp=0
 for picture,duration in zip(pictures,durations):
  encoder.add(picture.getim(),timestamp,True,100.0,100.0,3)
  timestamp+=duration
 encoder.add(None,timestamp,True,100.0,100.0,0)
 path.write_bytes(encoder.assemble('','',''))

def main():
 raw=Image.open(HERE/'Source/walk-strip-raw.png').convert('RGBA')
 reference=Image.open(HERE/'Source/locked-neutral.png').convert('RGBA').resize((256,256),Image.Resampling.LANCZOS)
 bounds=[[22,266],[277,536],[547,802],[811,1067],[1078,1328],[1343,1610],[1615,1865],[1887,2134]]
 content_bounds=official.threshold_bbox(reference,16)
 scale=(content_bounds[2]-content_bounds[0])/(bounds[0][1]-bounds[0][0])
 source_anchor=[144,461]
 destination_anchor=[128,content_bounds[3]]
 pitch=266.5
 frames=[]
 (HERE/'Frames').mkdir(511,True,True)
 (HERE/'Source/Drawings').mkdir(511,True,True)
 for i,(left,right) in enumerate(bounds):
  art=raw.crop((left-1,0,right+1,raw.height))
  pixels=np.array(art)
  pixels[pixels[:,:,3]<16]=0
  art=Image.fromarray(pixels)
  art.save(HERE/'Source/Drawings'/('%02d.png'%(i+1)))
  resize=art.resize((round(art.width*scale),round(art.height*scale)),Image.Resampling.LANCZOS)
  frame=Image.new('RGBA',(256,256))
  x=round(destination_anchor[0]+(left-1-source_anchor[0]-i*pitch)*scale)
  y=round(destination_anchor[1]-source_anchor[1]*scale)
  frame.paste(resize,(x,y))
  frame.save(HERE/'Frames'/('%02d.png'%(i+1)))
  frames.append(frame)
 durations=[125]*8
 sheet=Image.new('RGBA',(1024,512))
 for i,frame in enumerate(frames):
  sheet.paste(frame,(i%4*256,i//4*256))
 webp(HERE/'walk.webp',sheet)
 animate(HERE/'preview.webp',frames,durations)
 animate(HERE/'thumb.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
 contact=Image.new('RGB',(256*4,286*3),(32,45,37))
 draw=ImageDraw.Draw(contact)
 for i,frame in enumerate([reference]+frames):
  x,y=i%4*256,i//4*286
  contact.paste(frame,(x,y),frame)
  draw.text((x+8,y+260),'LOCKED ORIGINAL' if i==0 else 'DRAWN PHASE '+str(i),(232,241,220))
 contact.save(HERE/'contact.png')
 normalization={'officialWorkflow':'Game Studio sprite-pipeline; build_sprite_edit_canvas.py and official threshold_bbox; fixed shared anchor adaptation instead of per-frame bottom-fit','sharedScale':scale,'sourceAnchor':source_anchor,'destinationAnchor':destination_anchor,'sourcePitch':pitch,'sourceObjectBoundsX':bounds,'perFrameScale':False,'perFrameTightRecenter':False,'facing':'left','frameSize':256,'baseline':content_bounds[3]}
 json_file(HERE/'normalization.json',normalization)
 metadata={'image':'DesignAssets/Animations/CreatureWalkV2/cotton-sheep/walk.webp','frameSize':256,'columns':4,'durationsMs':durations,'loop':True,'pivotX':128,'pivotY':224,'cyclesPerCell':2,'frameCount':8,'durationMs':1000,'method':'Eight distinct full-body walk drawings generated together from the locked approved seed through the official Game Studio sprite-pipeline. Shared scale and shared fixed anchor preserve original proportions and footfall trajectories. No warped or blended in-betweens.','source':'Source/walk-strip-raw.png','frames':'Frames','normalization':'normalization.json','preview':'preview.webp','thumbnail':'thumb.webp','rootMotion':False}
 json_file(HERE/'walk.json',metadata)
 print('cotton-sheep',len(frames),'drawn phases; common scale',scale,'baseline',content_bounds[3])

if __name__=='__main__':
 main()
