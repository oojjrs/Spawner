import json
from pathlib import Path
from PIL import Image,_webp

folder=Path(__file__).resolve().parent.parent
meta=json.loads((folder/'death.json').read_text('utf-8'))
size=meta['frameSize']
frames=[Image.open(folder/name).convert('RGBA') for name in meta['openingFrames']]
body=Image.open(folder/meta['bodyLayer']).convert('RGBA')
for name in meta['tailParts']:
    tail=Image.open(folder/name).convert('RGBA')
    frames.append(Image.alpha_composite(tail,body))
for frame,name in zip(frames,meta['sourceFrames']):frame.save(folder/name)
columns=meta['columns']
rows=(len(frames)+columns-1)//columns
sheet=Image.new('RGBA',(columns*size,rows*size))
for index,frame in enumerate(frames):sheet.paste(frame,(index%columns*size,index//columns*size))
atlas=_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'','')
for name in ['death.webp',Path(meta['image']).name]:(folder/name).write_bytes(atlas)

def encode(images,dimensions):
    writer=_webp.WebPAnimEncoder(dimensions,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(images,meta['durationsMs']):
        writer.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    writer.add(None,timestamp,True,100.0,100.0,0)
    return writer.assemble('','','')

preview=encode(frames,(size,size))
thumbnail=encode([frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],(64,64))
for name in ['preview.webp',Path(meta['preview']).name]:(folder/name).write_bytes(preview)
for name in ['thumbnail.webp',Path(meta['thumbnail']).name]:(folder/name).write_bytes(thumbnail)
contact=Image.new('RGB',(columns*256,rows*256),'#252c29')
for index,frame in enumerate(frames):
    small=frame.resize((256,256),Image.Resampling.LANCZOS)
    contact.paste(small,(index%columns*256,index//columns*256),small)
contact.save(folder/'contact.png')
