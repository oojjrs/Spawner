import json
from pathlib import Path
from PIL import Image,ImageDraw,_webp

folder=Path(__file__).resolve().parent.parent
meta=json.loads((folder/'death.json').read_text('utf-8'))
registration=json.loads((folder/'Source/stabilization.json').read_text('utf-8'))
sources=[Image.open(folder/name).convert('RGBA') for name in meta['sourceFrames']]
frames=[]
for index,offset in zip(registration['sourceFrameIndices'],registration['translationsPx']):
    frame=Image.new('RGBA',sources[index].size)
    frame.alpha_composite(sources[index],tuple(offset))
    frames.append(frame)
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

frames[-1].save(folder/'final.png')
contact=Image.new('RGB',(1536,1620),'#232a25')
timestamp=0
for index,frame in enumerate(frames):
    x=index%3*512;y=index//3*540
    contact.paste(frame,(x,y),frame)
    ImageDraw.Draw(contact).text((x+8,y+518),str(index)+' / '+str(timestamp)+'ms','white')
    timestamp+=meta['durationsMs'][index]
contact.save(folder/'contact.png')
comparison=Image.new('RGB',(1536,512),'#232a25')
for column,index in enumerate([0,3,7]):
    comparison.paste(frames[index],(column*512,0),frames[index])
comparison.save(folder/'design-comparison.png')
