from pathlib import Path
from PIL import Image,ImageDraw
import json
import math

folder=Path(__file__).resolve().parent
root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'))
frames=[]
durations=[]
for phase in rig['phases']:
    if 'source' in phase:
        frame=Image.open(folder/phase['source']).convert('RGBA')
    else:
        frame=Image.open(folder/phase['farEar']).convert('RGBA')
        frame.alpha_composite(Image.open(folder/phase['body']).convert('RGBA'))
        frame.alpha_composite(Image.open(folder/phase['nearEar']).convert('RGBA'))
    frames.append(frame)
    durations.append(phase['durationMs'])
columns=6
atlas=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for filename,dimension in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
relative=folder.relative_to(root).as_posix()
metadata={'name':folder.name,'action':'death','sourceImage':rig['approvedDesign'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json','renderer':relative+'/render.py','method':rig['method'],'spineCompatibilityVerified':False}
(folder/'death.json').write_bytes((json.dumps(metadata,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
board=Image.new('RGB',(1536,math.ceil(len(frames)/6)*290),'#324340')
for index,frame in enumerate(frames):
    picture=frame.resize((256,256),Image.Resampling.LANCZOS)
    x=index%6*256
    y=index//6*290
    board.paste(picture,(x,y),picture)
    ImageDraw.Draw(board).text((x+8,y+265),str(index)+' / '+str(durations[index])+' ms','white')
board.save(folder/'contact.png')
frames[-1].save(folder/'final.png')
print(json.dumps({'frames':len(frames),'durationMs':sum(durations)}))
