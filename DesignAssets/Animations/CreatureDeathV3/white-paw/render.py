from pathlib import Path
from PIL import Image,ImageDraw
import json
import math

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
frames=[]
durations=[]
for phase in rig['phases']:
    if 'source' in phase:
        frames.append(Image.open(folder/phase['source']).convert('RGBA'))
        durations.append(phase['durationMs'])
    elif 'sources' in phase:
        for source in phase['sources']:
            frames.append(Image.open(folder/source).convert('RGBA'))
            durations.append(phase['durationMs']//len(phase['sources']))
    else:
        body=Image.open(folder/phase['body']).convert('RGBA')
        for source,duration in zip(phase['tails'],phase['tailDurationsMs']):
            frame=Image.open(folder/source).convert('RGBA')
            frame.alpha_composite(body)
            frames.append(frame)
            durations.append(duration)
frames.append(frames[-1].copy())
durations.append(rig['finalHoldMs'])
columns=6
atlas=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for filename,dimension in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((dimension,dimension),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
relative='DesignAssets/Animations/CreatureDeathV3/'+folder.name
metadata={'name':folder.name,'action':'death','sourceImage':rig['approvedDesign'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json'}
(folder/'death.json').write_bytes((json.dumps(metadata,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
board=Image.new('RGB',(1536,math.ceil(len(frames)/6)*300),'#324340')
for index,frame in enumerate(frames):
    resized=frame.resize((256,256),Image.Resampling.LANCZOS)
    x=index%6*256
    y=index//6*300
    board.paste(resized,(x,y),resized)
    ImageDraw.Draw(board).text((x+8,y+270),str(index)+' / '+str(durations[index])+' ms','white')
board.save(folder/'contact.png')
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'durations':durations}))
