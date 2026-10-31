import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, _webp

HERE=Path(__file__).resolve().parent

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def main():
    metadata=json.loads((HERE/'death.json').read_text('utf-8'))
    frames=[Image.open(HERE/'Frames'/('cel-'+str(i).zfill(2)+'.png')).convert('RGBA') for i in range(metadata['frameCount'])]
    size=metadata['frameSize']
    columns=metadata['columns']
    sheet=Image.new('RGBA',(size*columns,size*math.ceil(len(frames)/columns)),(0,0,0,0))
    for i,frame in enumerate(frames):
        sheet.alpha_composite(frame,(i%columns*size,i//columns*size))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,metadata['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],metadata['durationsMs'])
    contact=Image.new('RGB',(1024,536),(35,42,37))
    draw=ImageDraw.Draw(contact)
    indices=[round(i*(len(frames)-1)/7) for i in range(8)]
    for i,index in enumerate(indices):
        cel=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=i%4*256,i//4*268
        contact.paste(cel,(x,y),cel)
        draw.text((x+8,y+254),str(index),(240,240,230))
    contact.save(HERE/'contact.jpg')
    print(json.dumps({'name':metadata['name'],'frameCount':len(frames),'durationMs':metadata['durationMs'],'dimensions':sheet.size}))

if __name__=='__main__':
    main()
