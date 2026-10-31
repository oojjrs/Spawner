from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw
from sampling import affine

root=Path(__file__).resolve().parent
reference=Image.open(root/'Source/reference.png').convert('RGBA')
times=[0,40,80,120,160,200,240,280,320,360,400,560,800]
frames=[]
for time in times:
    if time<120:
        t=time/1000
        matrix=np.array([[1,0,300*t*t],[0,1,2200*t*t],[0,0,1.]])
        image=affine(reference,matrix,(512,512))
    else:image=Image.open(root/'Parts'/('pose-'+str(time)+'.png')).convert('RGBA')
    frames.append(image)
(root/'Frames').mkdir(511,True,True)
for i,image in enumerate(frames):image.save(root/'Frames'/('frame-'+str(i).zfill(3)+'.png'))
columns=4
durations=[times[i+1]-time for i,time in enumerate(times[:-1])]+[900]
sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
for i,image in enumerate(frames):sheet.alpha_composite(image,((i%columns)*512,(i//columns)*512))
sheet.save(root/'death.webp',**{'lossless':True,'method':4,'exact':True})
frames[0].save(root/'preview.webp',**{'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
small=[]
for image in frames:
    pixels=np.array(image).astype(float)/255;pixels[:,:,:3]*=pixels[:,:,3:4]
    pixels=pixels.reshape(64,8,64,8,4).mean((1,3));pixels[:,:,:3]/=np.maximum(pixels[:,:,3:4],1e-12)
    small.append(Image.fromarray(np.uint8(np.clip(pixels*255+.5,0,255))))
small[0].save(root/'thumbnail.webp',**{'save_all':True,'append_images':small[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
frames[-1].save(root/'final.png')
board=Image.new('RGBA',(2048,1024),(38,53,49,255))
for i,time in enumerate([0,120,200,240,320,400,560,800]):
    board.alpha_composite(frames[times.index(time)],((i%4)*512,(i//4)*512))
    ImageDraw.Draw(board).text(((i%4)*512+10,(i//4)*512+10),str(time)+'ms',(255,255,255,255))
board.save(root/'contact.png')
prefix='DesignAssets/Animations/CreatureDeathV6/talon-owl/'
meta=json.loads((root/'death.json').read_text('utf-8'))
meta.update({'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'wingTransitions':prefix+'Source/wing-transitions.json'})
(root/'death.json').write_bytes(json.dumps(meta,**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
(root/'timeline.json').write_bytes(json.dumps({'timesMs':times,'durationsMs':durations,'loop':False},**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
print(json.dumps({'frames':len(frames),'durationMs':sum(durations)}))
