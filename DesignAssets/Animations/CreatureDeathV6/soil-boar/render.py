from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw
from sampling import affine

root=Path(__file__).resolve().parent
timeline=json.loads((root/'timeline.json').read_text('utf-8'))
frames=[]
for record in timeline['frames']:
    image=Image.open(root/record['source']).convert('RGBA')
    frames.append(affine(image,np.array(record['matrix']),(512,512)))
folder=root/'Frames'
folder.mkdir(511,True,True)
for index,frame in enumerate(frames):frame.save(folder/str('frame-'+str(index).zfill(3)+'.png'))
columns=4
sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
for index,frame in enumerate(frames):sheet.alpha_composite(frame,(index%columns*512,index//columns*512))
sheet.save(root/'death.webp',**{'lossless':True,'method':4})
durations=timeline['durationsMs']
frames[0].save(root/'preview.webp',**{'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
small=[]
for frame in frames:
    pixels=np.array(frame,float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    pixels=pixels.reshape(64,8,64,8,4).mean((1,3))
    pixels[:,:,:3]/=np.maximum(pixels[:,:,3:4],1e-8)
    small.append(Image.fromarray(np.uint8(np.clip(pixels*255+.5,0,255))))
small[0].save(root/'thumbnail.webp',**{'save_all':True,'append_images':small[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
frames[-1].save(root/'final.png')
board=Image.new('RGBA',(2048,1060),(38,53,49,255))
for index,frame in enumerate(frames):
    x,y=index%4*512,index//4*530
    board.alpha_composite(frame,(x,y))
    ImageDraw.Draw(board).text((x+8,y+512),str(timeline['frames'][index]['timeMs'])+'ms',(255,255,255))
board.save(root/'contact.png')
prefix='DesignAssets/Animations/CreatureDeathV6/soil-boar/'
metadata={'sourceImage':'DesignAssets/CreatureConcepts/v3/soil-boar.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'sourceCanvasPlacement':json.loads((root/'Source/placement.json').read_text('utf-8')),'timeline':prefix+'timeline.json','prepare':prefix+'prepare.py','renderer':prefix+'render.py','sourceAuthoring':prefix+'Source/authoring.json','construction':'Drawn collapse poses with localized joint, ear and tail drawings; rigid root motion; fixed landed body.'}
(root/'death.json').write_bytes(json.dumps(metadata,**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'sheet':list(sheet.size)}))
