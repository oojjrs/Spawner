from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,_webp
folder=Path(__file__).resolve().parent
sys.path.insert(0,str(folder/'Source'))
import authoring

def encode(path,frames,durations,size):
    writer=_webp.WebPAnimEncoder((size,size),0,0,False,9,17,False,False)
    timestamp=0
    for image,duration in zip(frames,durations):
        writer.add(image.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    writer.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(writer.assemble('','',''))

def write(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))

def render():
    times=[0]+[round(200+i*850/52) for i in range(53)]
    durations=[b-a for a,b in zip(times,times[1:])]+[920]
    amounts=[0]+[float(authoring.ease(max(1,t-200)/850)) for t in times[1:]]
    amounts[times.index(625)]=.5
    amounts[-1]=1
    frames=[authoring.frame(v) for v in amounts]
    sheet=Image.new('RGBA',(2048,math.ceil(len(frames)/4)*512))
    for i,image in enumerate(frames):
        image.save(folder/'Frames'/(str(i).zfill(3)+'.png'))
        sheet.paste(image,(i%4*512,i//4*512))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(folder/'preview.webp',frames,durations,512)
    thumbs=[im.convert('RGBa').resize((64,64),Image.Resampling.LANCZOS).convert('RGBA') for im in frames]
    encode(folder/'thumbnail.webp',thumbs,durations,64)
    indices=[0,8,14,20,27,34,40,46,53]
    contact=Image.new('RGB',(1152,1152),'#354340')
    for pos,index in enumerate(indices):
        image=frames[index].resize((384,384),Image.Resampling.LANCZOS)
        contact.paste(image,(pos%3*384,pos//3*384),image)
    contact.save(folder/'contact.png')
    base='DesignAssets/Animations/CreatureDeathV12/white-paw/'
    meta={'name':'white-paw','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/white-paw.png','image':base+'death.webp','frameSize':512,'columns':4,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':base+'preview.webp','thumbnail':base+'thumbnail.webp','renderer':base+'render.py','sourceAuthoring':base+'Source/motion.json','sourceFrames':['Frames/'+str(i).zfill(3)+'.png' for i in range(len(frames))],'construction':'registered body and tail raster deformation','approvedKeyFrames':[0,times.index(625),len(frames)-1]}
    write(folder/'death.json',meta)
    write(folder/'Source/timeline.json',{'timesMs':times,'progress':amounts,'durationsMs':durations})
    print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'approvedKeyFrames':meta['approvedKeyFrames']}))

if __name__=='__main__':render()