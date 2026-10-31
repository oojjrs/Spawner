from pathlib import Path
import json, math
from PIL import Image
FOLDER=Path(__file__).resolve().parent

def write_json(path,value):
    text=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))


def main():
    registration=json.loads((FOLDER/'registration.json').read_text('utf-8'))
    size=registration['canvas'][0]
    scale=registration['sharedScale']
    pivot=registration['pivot']
    frames=[]
    (FOLDER/'Frames').mkdir(511,True,True)
    for i,entry in enumerate(registration['frames']):
        source=Image.open(FOLDER/entry['drawing']).convert('RGBA')
        x,y=entry['sourceRoot']
        matrix=(1/scale,0,x-pivot[0]/scale,0,1/scale,y-pivot[1]/scale)
        frame=source.transform((size,size),Image.Transform.AFFINE,matrix,Image.Resampling.BICUBIC)
        frame.save(FOLDER/'Frames'/(str(i+1).zfill(2)+'.png'))
        frames.append(frame)
    durations=registration['durationMs']
    columns=registration['columns']
    atlas=Image.new('RGBA',(size*columns,size*math.ceil(len(frames)/columns)))
    for i,frame in enumerate(frames):atlas.paste(frame,((i%columns)*size,(i//columns)*size))
    atlas.save(FOLDER/'walk.webp','WEBP',**{'lossless':True,'method':4})
    for name,images in [('preview.webp',[frame.resize((256,256),Image.Resampling.LANCZOS) for frame in frames]),('thumb.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])]:
        images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'minimize_size':False})
    metadata={'image':'DesignAssets/Animations/CreatureWalkV2/'+FOLDER.name+'/walk.webp','frameSize':size,'columns':columns,'durationsMs':durations,'loop':True,'pivotX':pivot[0],'pivotY':pivot[1],'cyclesPerCell':registration.get('cyclesPerCell',2),'method':registration['method'],'frameCount':len(frames),'durationMs':sum(durations),'source':'walk-raw-strip.png','editableDrawings':'Drawings/','normalization':'registration.json','renderer':'render.py','preview':'preview.webp','thumbnail':'thumb.webp'}
    if 'viewSize' in registration:metadata['viewSize']=registration['viewSize']
    if 'scale' in registration:metadata['scale']=registration['scale']
    write_json(FOLDER/'walk.json',metadata)
    print(json.dumps({'name':FOLDER.name,'frames':len(frames),'durationMs':sum(durations),'method':'drawn full strip'}))


if __name__=='__main__':
    main()
