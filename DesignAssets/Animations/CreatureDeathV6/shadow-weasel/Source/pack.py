import json
from pathlib import Path
from PIL import Image,ImageDraw,_webp
from stabilize import stabilize_frames

folder=Path(__file__).resolve().parent.parent
meta=json.loads((folder/'death.json').read_text('utf-8'))
frames=stabilize_frames(folder)
columns=meta['columns']
sheet=Image.new('RGBA',(columns*512,((len(frames)+columns-1)//columns)*512))
for index,frame in enumerate(frames):sheet.paste(frame,((index%columns)*512,(index//columns)*512))
(folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))

def encode(path,images,size):
    writer=_webp.WebPAnimEncoder(size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(images,meta['durationsMs']):
        writer.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    writer.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(writer.assemble('','',''))

encode(folder/'preview.webp',frames,(512,512))
encode(folder/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],(64,64))

contact=Image.new('RGB',(1536,1620),(35,43,39))
timestamp=0
for index,frame in enumerate(frames):
    x,y=(index%3)*512,(index//3)*540
    contact.paste(frame,(x,y),frame)
    ImageDraw.Draw(contact).text((x+8,y+518),f'{index} / {timestamp}ms',(255,255,255))
    timestamp+=meta['durationsMs'][index]
contact.save(folder/'contact.png')

registration=json.loads((folder/'Source/registration.json').read_text('utf-8'))['runtime']
runtimeSize=registration['frameSize']
ratio=runtimeSize/512
sourceScale=registration['sourceToReferenceScale']
referencePivot=registration['referencePivot']
sourceOffset=registration['sourceToReferenceTranslation']
runtime={"name":meta['name'],"action":meta['action'],"image":"DesignAssets/Animations/CreatureDeathV6/shadow-weasel/runtime.webp",
    "frameSize":runtimeSize,"viewSize":registration['referenceFrameSize']/sourceScale*ratio,
    "pivotX":(referencePivot[0]-sourceOffset[0])/sourceScale*ratio,
    "pivotY":(referencePivot[1]-sourceOffset[1])/sourceScale*ratio,
    "columns":columns,"frameCount":len(frames),"durationsMs":meta['durationsMs'],"durationMs":meta['durationMs'],"loop":False}
runtimeSheet=Image.new('RGBA',(columns*runtimeSize,((len(frames)+columns-1)//columns)*runtimeSize))
for index,frame in enumerate(frames):
    runtimeFrame=frame.resize((runtimeSize,runtimeSize),Image.Resampling.LANCZOS)
    runtimeSheet.paste(runtimeFrame,((index%columns)*runtimeSize,(index//columns)*runtimeSize))
(folder/'runtime.webp').write_bytes(_webp.WebPEncode(runtimeSheet.getim(),True,100.0,100.0,'',4,1,b'',''))
(folder/'runtime.json').write_bytes((json.dumps(runtime)+'\r\n').encode('utf-8'))
