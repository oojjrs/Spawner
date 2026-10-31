from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json
import math

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
cache={path:Image.open(folder/path).convert('RGBA') for path in rig['attachments'].values()}

def translation(x,y):
    return np.array([[1,0,x],[0,1,y],[0,0,1]],float)

def rotation(pivot,degrees):
    angle=math.radians(degrees)
    c,s=math.cos(angle),math.sin(angle)
    return translation(*pivot)@np.array([[c,-s,0],[s,c,0],[0,0,1]])@translation(-pivot[0],-pivot[1])

def transformed(image,matrix):
    if np.max(np.abs(matrix[:2,:2]-np.eye(2)))<.000001 and abs(matrix[0,2]-round(matrix[0,2]))<.000001 and abs(matrix[1,2]-round(matrix[1,2]))<.000001:
        result=Image.new('RGBA',(512,512),(0,0,0,0))
        result.alpha_composite(image,(round(matrix[0,2]),round(matrix[1,2])))
        return result
    inverse=np.linalg.inv(matrix)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2,:].flatten()),Image.Resampling.BICUBIC)

frames=[]
durations=[]
for entry in rig['frames']:
    world={}
    for bone in rig['bones']:
        control=entry['controls'][bone['id']]
        local=translation(*control['translation'])@rotation(bone['pivot'],control['rotation'])
        world[bone['id']]=local if bone['parent'] is None else world[bone['parent']]@local
    image=Image.new('RGBA',(512,512),(0,0,0,0))
    for attachment,bone in entry['layers']:
        image.alpha_composite(transformed(cache[rig['attachments'][attachment]],world[bone]))
    frames.append(image)
    durations.append(entry['durationMs'])
columns=rig['columns']
atlas=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
for index,image in enumerate(frames):
    atlas.alpha_composite(image,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for filename,dimension in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[image.resize((dimension,dimension),Image.Resampling.LANCZOS) for image in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
relative='DesignAssets/Animations/CreatureDeathV3/'+folder.name
metadata={'name':folder.name,'action':'death','sourceImage':rig['approvedDesign'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json'}
(folder/'death.json').write_bytes((json.dumps(metadata,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
indices=list(dict.fromkeys([0,len(frames)//7,len(frames)*2//7,len(frames)*3//7,len(frames)*4//7,len(frames)*5//7,len(frames)*6//7,len(frames)-1]))
board=Image.new('RGB',(2048,300),'#324340')
for column,index in enumerate(indices):
    image=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    board.paste(image,(column*256,0),image)
    ImageDraw.Draw(board).text((column*256+5,270),str(index)+' / '+str(sum(durations[:index]))+'ms','white')
board.save(folder/'contact.png')
print(json.dumps({'name':folder.name,'frames':len(frames),'durationMs':sum(durations),'finalHoldIdentical':frames[-1].tobytes()==frames[-2].tobytes()}))
