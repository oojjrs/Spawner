import json
import shutil
from pathlib import Path
from PIL import Image, _webp

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[2]
ENTRIES=[('vine-turtle','V2','idle-v2.webp'),('shadow-weasel','V2','idle-v2.webp'),('snare-vine','V1','idle-twirl-v1.webp')]


def write_json(path,value):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    encoder.item_separator=','
    content=encoder.encode(value)+'\n'
    path.write_bytes(content.replace('\n','\r\n').encode('utf-8'))


def write_webp(path,picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))


def animate(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for picture,duration in zip(frames,durations):
        encoder.add(picture.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))


def pack(key,version,thumbnail_name):
    folder=HERE/version/key
    rig=json.loads((folder/'rig.json').read_text('utf-8'))
    pictures=[]
    durations=[]
    source_indices=[]
    last=None
    for index,duration in enumerate(rig['durationsMs']):
        frame=Image.open(folder/'Frames'/('%03d.png'%index)).convert('RGBA')
        pixels=frame.tobytes()
        if pixels==last:
            durations[-1]+=duration
        else:
            pictures.append(frame)
            durations.append(duration)
            source_indices.append(index)
            last=pixels
    columns=8
    atlas=Image.new('RGBA',(512*columns,512*((len(pictures)+columns-1)//columns)))
    for index,picture in enumerate(pictures):
        atlas.paste(picture,(index%columns*512,index//columns*512))
    write_webp(folder/'idle.webp',atlas)
    alpha=pictures[0].getchannel('A').point(lambda a:255 if a>=16 else 0)
    left,top,right,bottom=alpha.getbbox()
    display_scale=480/max(right-left,bottom-top)
    pivot_x=(left+right)/2
    pivot_y=bottom-(496-.95*512)/display_scale
    metadata={'name':key,'action':'idle','revision':int(version[1:]),'runtimeAtlas':'idle.webp','frameSize':512,'columns':columns,'frameCount':len(pictures),'durationsMs':durations,'sourceFrames':source_indices,'durationMs':sum(durations),'pivotX':pivot_x,'pivotY':pivot_y,'loop':True,'rootMotion':False,'preview':'idle-preview.webp','gif':'idle-preview.gif','rig':'rig.json','thumbnail':'idle-thumbnail.webp'}
    write_json(folder/'idle.json',metadata)
    preview_path=PROJECT/'DesignAssets/UnitPreviews'/key/thumbnail_name
    if not preview_path.exists():
        animate(preview_path,[p.resize((64,64),Image.Resampling.LANCZOS) for p in pictures],durations)
    shutil.copyfile(preview_path,folder/'idle-thumbnail.webp')
    print(key,len(pictures),'frames',sum(durations),'ms',atlas.size,'pivot',pivot_x,pivot_y)


if __name__=='__main__':
    for entry in ENTRIES:
        pack(*entry)
