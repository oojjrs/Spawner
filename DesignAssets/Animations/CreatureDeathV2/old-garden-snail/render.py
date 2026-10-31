from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np
import math
import json

folder=Path(__file__).resolve().parent
root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'))
parts={p.stem:Image.open(p).convert('RGBA') for p in (folder/'Parts').glob('*.png')}

def smooth(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def move(image,scale_x,scale_y,pivot,offset):
    px,py=pivot
    dx,dy=offset
    return image.transform((512,512),Image.Transform.AFFINE,(1/scale_x,0,px-(px+dx)/scale_x,0,1/scale_y,py-(py+dy)/scale_y),Image.Resampling.BICUBIC)

def rigid(image,pivot,destination,degrees):
    angle=math.radians(degrees)
    c,s=math.cos(angle),math.sin(angle)
    px,py=pivot
    tx,ty=destination
    return image.transform((512,512),Image.Transform.AFFINE,(c,s,px-c*tx-s*ty,-s,c,py+s*tx-c*ty),Image.Resampling.BICUBIC)

def pose(time):
    fold=smooth((time-180)/380)
    retract=smooth((time-350)/970)
    sx,sy=1-.78*retract,1-.65*retract
    offset=(0,-25*retract)
    frame=parts['shell-underpaint'].copy()
    living=Image.new('RGBA',(512,512),(0,0,0,0))
    for key,pivot,angle in [('eye-left',[120,343],115),('eye-right',[157,345],125)]:
        destination=[264+(pivot[0]-264)*sx,376+(pivot[1]-376)*sy+offset[1]]
        living.alpha_composite(rigid(parts[key],pivot,destination,angle*fold))
    living.alpha_composite(move(parts['body'],sx,sy,[264,376],offset))
    frame.alpha_composite(living)
    frame.alpha_composite(parts['shell-original'])
    data=np.array(frame)
    fixed=np.array(parts['shell-original'])
    protected=np.array(Image.open(folder/'Source/rigid-mask.png'))>0
    data[protected]=fixed[protected]
    frame=Image.fromarray(data)
    settle=round(32*smooth((time-780)/620))
    settled=Image.new('RGBA',(512,512),(0,0,0,0))
    settled.alpha_composite(frame,(0,settle))
    return settled,living,settle

times=list(range(0,1501,40))+[1600,1800]
durations=[b-a for a,b in zip(times,times[1:])]+[1000]
frames=[]
living=[]
settles=[]
for time in times:
    frame,soft,settle=pose(time)
    frames.append(frame)
    living.append(soft)
    settles.append(settle)
columns=8
sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
for index,frame in enumerate(frames):
    sheet.alpha_composite(frame,(index%columns*512,index//columns*512))
sheet.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4})
for name,dimension in [('preview.webp',256),('thumbnail.webp',64)]:
    previews=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    previews[0].save(folder/name,'WEBP',**{'save_all':True,'append_images':previews[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
relative=folder.relative_to(root).as_posix()
record={'name':folder.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+folder.name+'.png','image':relative+'/death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json'}
(folder/'death.json').write_bytes((json.dumps(record,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
work=root/'$Trash/death-v2-unique-20261029'
board=Image.new('RGB',(1536,672),'#324340')
for column,index in enumerate([0,8,16,24,32,len(frames)-1]):
    frame=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    board.paste(frame,(column*256,0),frame)
    thumb=frames[index].resize((64,64),Image.Resampling.LANCZOS)
    board.paste(thumb,(column*256+96,280),thumb)
    ImageDraw.Draw(board).text((column*256+4,350),str(times[index])+' ms','white')
    overlay=Image.blend(Image.open(folder/'Source/reference.png').convert('RGBA'),frames[index],.5).resize((256,256),Image.Resampling.LANCZOS)
    board.paste(overlay,(column*256,392),overlay)
board.save(work/'snail-keyposes.png')
frames[-1].save(work/'snail-final.png')
reference=np.array(Image.open(folder/'Source/reference.png'))
rigid_mask=np.array(Image.open(folder/'Source/rigid-mask.png'))>0
rigid_delta=[]
for frame,settle in zip(frames,settles):
    inverse=Image.new('RGBA',(512,512),(0,0,0,0))
    inverse.alpha_composite(frame,(0,-settle))
    rigid_delta.append(int(np.abs(np.array(inverse).astype(int)[rigid_mask]-reference.astype(int)[rigid_mask]).max()))
hard_alpha=np.array(Image.alpha_composite(parts['shell-underpaint'],parts['shell-original']).getchannel('A'))
visible_soft=(np.array(living[-1].getchannel('A'))>8)&(hard_alpha<16)
evidence={'rigidPixelMaximumDeltaAfterInverseRoot':max(rigid_delta),'finalSoftOutsideShellPixelsOver8':int(visible_soft.sum()),'finalHoldEqual':frames[-1].tobytes()==frames[-2].tobytes(),'rootSettleY':settles,'eyes':{'leftBindLength':68,'leftScale':[1,1],'rightBindLength':55,'rightScale':[1,1]},'referenceDifferenceMean':float(np.abs(np.array(frames[0]).astype(float)-reference).mean())}
(work/'snail-evidence.json').write_text(json.dumps(evidence,**{'indent':2}),'utf-8')
print(json.dumps(evidence))
