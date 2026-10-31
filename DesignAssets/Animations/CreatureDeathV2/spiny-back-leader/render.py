from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json
import math

folder=Path(__file__).resolve().parent
root=folder.parents[3]
work=root/'$Trash/death-v2-unique-20261029'
rig=json.loads((folder/'rig.json').read_text('utf-8'))
source=Image.open(folder/'Source/reference.png').convert('RGBA')
parts={p.stem:Image.open(p).convert('RGBA') for p in (folder/'Parts').glob('*.png')}
part_specs={item[0]:item for item in rig['parts']}

def smooth(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def translation(x,y):
    return np.array([[1,0,x],[0,1,y],[0,0,1]],float)

def rotation(pivot,degrees):
    radians=math.radians(degrees)
    c,s=math.cos(radians),math.sin(radians)
    return translation(*pivot)@np.array([[c,-s,0],[s,c,0],[0,0,1]])@translation(-pivot[0],-pivot[1])

def transformed(image,matrix):
    if np.max(np.abs(matrix-np.eye(3)))<.0000001:
        return image.copy()
    inverse=np.linalg.inv(matrix)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2,:].flatten()),Image.Resampling.BICUBIC)

def bottom(image):
    points=np.where(np.array(image.getchannel('A'))>128)
    return int(points[0].max())+1

ground=bottom(source)
body_final=transformed(parts['body'],rotation(rig['pivot'],rig['angle']))
final_drop=ground-bottom(body_final)
if rig['kind'] in ['shell','armor']:
    final_drop=rig.get('rootDropY',ground-bottom(parts['body']))
fixed=np.array(parts.get('body-original',parts['body']))
fixed_mask=fixed[:,:,3]>250
reference=np.array(source)

def pose(time):
    amount=smooth((time-140)/1050)
    follow=smooth((time-330)/1050)
    if rig['kind']=='shell':
        drop=round(final_drop*smooth((time-780)/620))
        body_matrix=translation(0,drop)
    elif rig['kind']=='armor':
        drop=round(final_drop*smooth((time-280)/1000))
        body_matrix=translation(0,drop)
    else:
        drop=final_drop*amount
        body_matrix=translation(rig['move'][0]*amount,drop)@rotation(rig['pivot'],rig['angle']*amount)
    world={'root':body_matrix,'body':body_matrix}
    for name,points,pivot,angle,offset,parent,order,radius in rig['parts']:
        local_amount=follow if name in ['tail','ear-left','ear-right','jaw-far','jaw-near'] else amount
        if rig['kind']=='shell':
            local_amount=smooth((time-220)/1040)
        parent_matrix=world[parent]
        local=translation(offset[0]*local_amount,offset[1]*local_amount)@rotation(pivot,angle*local_amount)
        world[name]=parent_matrix@local
    frame=Image.new('RGBA',(512,512),(0,0,0,0))
    moving_alpha=Image.new('RGBA',(512,512),(0,0,0,0))
    ordered=sorted(rig['parts'],**{'key':lambda item:item[6]})
    behind=[item for item in ordered if item[6]<5]
    front=[item for item in ordered if item[6]>=5]
    if rig['kind'] in ['shell','armor']:
        frame.alpha_composite(transformed(parts['body-underpaint'],body_matrix))
        behind=ordered
        front=[]
    for item in behind:
        name=item[0]
        layer=transformed(parts[name],world[name])
        frame.alpha_composite(layer)
        moving_alpha.alpha_composite(layer)
    if rig['kind']=='animal':
        frame.alpha_composite(transformed(parts['body'],body_matrix))
    else:
        frame.alpha_composite(transformed(parts['body-original'],body_matrix))
        data=np.array(frame)
        if drop>=0:
            y,x=np.where(fixed_mask)
            valid=y+drop<512
            data[y[valid]+drop,x[valid]]=fixed[y[valid],x[valid]]
        frame=Image.fromarray(data)
    for item in front:
        name=item[0]
        attachment=parts['head-closed'] if name=='head' and 'head-closed' in parts and time>=280 else parts[name]
        frame.alpha_composite(transformed(attachment,world[name]))
    return frame,world,moving_alpha,drop

times=list(range(0,1501,40))+[1600,1800]
durations=[b-a for a,b in zip(times,times[1:])]+[1000]
results=[pose(time) for time in times]
frames=[item[0] for item in results]
columns=8
atlas=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4})
for filename,dimension in [('preview.webp',256),('thumbnail.webp',64)]:
    pictures=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
relative=folder.relative_to(root).as_posix()
metadata={'name':folder.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+folder.name+'.png','image':relative+'/death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json','sourceParts':relative+'/Parts/'}
(folder/'death.json').write_bytes((json.dumps(metadata,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
board=Image.new('RGB',(1536,672),'#324340')
for column,index in enumerate([0,8,16,24,32,len(frames)-1]):
    frame=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    board.paste(frame,(column*256,0),frame)
    thumb=frames[index].resize((64,64),Image.Resampling.LANCZOS)
    board.paste(thumb,(column*256+96,280),thumb)
    ImageDraw.Draw(board).text((column*256+4,350),str(times[index])+' ms','white')
    overlay=Image.blend(source,frames[index],.5).resize((256,256),Image.Resampling.LANCZOS)
    board.paste(overlay,(column*256,392),overlay)
board.save(work/(folder.name+'-keyposes.png'))
evidence={'partCount':len(rig['parts'])+1,'bodyScale':[1,1],'allMatricesDeterminantMaximumError':max(abs(np.linalg.det(matrix[:2,:2])-1) for result in results for matrix in result[1].values()),'finalHoldIdentical':frames[-1].tobytes()==frames[-2].tobytes(),'rootDropY':final_drop,'initialGroundY':ground,'finalCompositeGroundY':bottom(frames[-1]),'finalBodyGroundY':bottom(body_final)+final_drop,'parts':{name:{'pivot':item[2],'scale':[1,1]} for name,item in part_specs.items()}}
if rig['kind'] in ['shell','armor']:
    differences=[]
    for frame,world,moving,drop in results:
        array=np.array(frame)
        y,x=np.where(fixed_mask)
        valid=y+drop<512
        differences.append(int(np.abs(array[y[valid]+drop,x[valid]].astype(int)-reference[y[valid],x[valid]].astype(int)).max()))
    evidence['rigidPixelDeltaAfterInverseRoot']=max(differences)
    final_moving=transformed(results[-1][2],translation(0,-results[-1][3]))
    hard_alpha=np.array(parts['body'].getchannel('A'))
    evidence['finalMovingPixelsOutsideBody']=int(((np.array(final_moving.getchannel('A'))>8)&(hard_alpha<16)).sum())
(work/(folder.name+'-evidence.json')).write_text(json.dumps(evidence,**{'indent':2}),'utf-8')
print(folder.name,json.dumps(evidence))
