from pathlib import Path
import json
from PIL import Image,_webp
folder=Path(__file__).resolve().parent
timeline=json.loads((folder/'timeline.json').read_bytes())
frames=[]
durations=[]
for index,key in enumerate(timeline):
    frame=Image.open(folder/key['source']).convert('RGBA')
    frame.save(folder/'Frames'/(str(index).zfill(3)+'.png'))
    frames.append(frame)
    durations.append(key['durationMs'])
columns=4
rows=(len(frames)+columns-1)//columns
sheet=Image.new('RGBA',(columns*512,rows*512))
for index,frame in enumerate(frames):
    sheet.paste(frame,(index%columns*512,index//columns*512))
(folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
for name,size in [('preview.webp',512),('thumbnail.webp',64)]:
    images=[im if size==512 else im.resize((size,size),Image.Resampling.LANCZOS) for im in frames]
    writer=_webp.WebPAnimEncoder((size,size),0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(images,durations):
        writer.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    writer.add(None,timestamp,True,100.0,100.0,0)
    (folder/name).write_bytes(writer.assemble('','',''))
contact=Image.new('RGB',(columns*256,rows*256),'#354340')
for index,frame in enumerate(frames):
    small=frame.resize((256,256),Image.Resampling.LANCZOS)
    contact.paste(small,(index%columns*256,index//columns*256),small)
contact.save(folder/'contact.png')
prefix='DesignAssets/Animations/CreatureDeathV9/white-paw/'
meta={'name':'white-paw','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/white-paw.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','renderer':prefix+'render.py','sourceAuthoring':prefix+'timeline.json','sourceFrames':['Frames/'+str(i).zfill(3)+'.png' for i in range(len(frames))],'construction':'whole-character drawn frames','approvedKeyFrames':[0,5,10]}
(folder/'death.json').write_bytes((json.dumps(meta)+'\r\n').encode('utf-8'))
print(json.dumps({'frameCount':len(frames),'durationMs':sum(durations),'sheetSize':sheet.size}))
