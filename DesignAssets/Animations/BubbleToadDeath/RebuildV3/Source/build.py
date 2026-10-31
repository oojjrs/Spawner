import json
import math
import shutil
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
import render

folder=Path(__file__).resolve().parent.parent
frames_folder=folder/'Frames'
frames_folder.mkdir(0o777,True,True)
original=Image.open(render.keys/'start.png').convert('RGBA')
size=512
gy,gx=np.mgrid[:size,:size]


def frame_at(time):
    if time==1070:
        return render.final.copy()
    frame=render.render(time)
    if time>=180:
        return frame
    progress=render.smooth((time-60)/120)
    mask=np.zeros((size,size),float)
    for left,top,right,bottom in [(202,196,266,258),(132,183,182,232)]:
        cx,cy=(left+right)/2,(top+bottom)/2
        radius=((gx-cx)/((right-left)/2))**2+((gy-cy)/((bottom-top)/2))**2
        ellipse=np.clip((1-radius)*min(right-left,bottom-top)/2,0,1)
        edge=top+(bottom-top)*progress
        mask=np.maximum(mask,ellipse*np.clip(gy-edge+.5,0,1))
    values=np.array(original)
    values[:,:,3]=np.uint8(values[:,:,3]*mask+.5)
    patch=Image.fromarray(values)
    rotation,translation,inflation,body_y=render.state(time)
    a=render.angles[2]
    initial=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    initial_t=render.centers[2]-initial@render.origin
    pose=np.column_stack([rotation@initial,rotation@initial_t+translation])
    inverse=np.linalg.inv(np.vstack([pose,[0,0,1]]))[:2]
    patch=patch.convert('RGBa').transform((size,size),Image.Transform.AFFINE,tuple(inverse.ravel()),Image.Resampling.BICUBIC).convert('RGBA')
    frame.alpha_composite(patch)
    return frame


def encode(path,images,durations,dimensions):
    writer=_webp.WebPAnimEncoder(dimensions,0,0,False,9,17,False,False)
    time=0
    for frame,duration in zip(images,durations):
        writer.add(frame.getim(),time,True,100.,100.,4)
        time+=duration
    writer.add(None,time,True,100.,100.,0)
    path.write_bytes(writer.assemble('','',''))


def build():
    times=[0,60,100,140]+list(range(180,620,40))+list(range(650,1030,40))+[1070]
    durations=[b-a for a,b in zip(times,times[1:])]+[1000]
    frames=[]
    for index,time in enumerate(times):
        frame=frame_at(time)
        path=frames_folder/(str(index).zfill(3)+'.png')
        if time==1070:
            shutil.copyfile(render.keys/'settled-revision2.png',path)
        else:
            frame.save(path)
        frames.append(frame)
    columns=4
    sheet=Image.new('RGBA',(columns*size,((len(frames)+columns-1)//columns)*size))
    for index,frame in enumerate(frames):sheet.paste(frame,((index%columns)*size,(index//columns)*size))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.,100.,'',4,1,b'', ''))
    runtime=Image.new('RGBA',(columns*256,((len(frames)+columns-1)//columns)*256))
    for index,frame in enumerate(frames):
        scaled=frame.convert('RGBa').resize((256,256),Image.Resampling.LANCZOS).convert('RGBA')
        runtime.paste(scaled,((index%columns)*256,(index//columns)*256))
    (folder/'runtime.webp').write_bytes(_webp.WebPEncode(runtime.getim(),True,100.,100.,'',4,1,b'', ''))
    encode(folder/'preview.webp',frames,durations,(size,size))
    encode(folder/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations,(64,64))
    meta={'name':'bubble-toad','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/bubble-toad.png','image':'DesignAssets/Animations/BubbleToadDeath/RebuildV3/death.webp','frameSize':size,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'timesMs':times,'sourceFrames':['Frames/'+str(i).zfill(3)+'.png' for i in range(len(frames))],'approvedFinal':'Source/Keys/settled-revision2.png','skinSource':'Source/Parts/head-neck-frontbody.png'}
    encoder=json.JSONEncoder();encoder.indent=2;encoder.item_separator=','
    (folder/'death.json').write_bytes((encoder.encode(meta)+'\n').replace('\n','\r\n').encode('utf-8'))
    board=Image.new('RGB',(6*256,5*192),'#263631')
    for index,frame in enumerate(frames):
        crop=frame.crop((32,160,480,496)).resize((256,192),Image.Resampling.LANCZOS)
        x,y=(index%6)*256,(index//6)*192
        board.paste(crop,(x,y),crop)
        ImageDraw.Draw(board).text((x+4,y+4),str(times[index]),'white')
    board.save(folder.parent/'full-contact.png')


if __name__=='__main__':
    build()
