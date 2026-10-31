from pathlib import Path
import json
import math
import subprocess
import sys
sys.dont_write_bytecode=True
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from raster import premultiplied,rasterize

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[2]


def smooth(value):
    value=float(np.clip(value,0,1))
    return value*value*value*(value*(value*6-15)+10)


def translated(image,offset):
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,(1,0,-offset[0],0,1,-offset[1]),Image.Resampling.BICUBIC).convert('RGBA')


def execute(command):
    result=subprocess.run(command)
    if result.returncode: raise RuntimeError('Media export failed: '+command[0])


def load(name):
    folder=ROOT/name
    rig=json.loads((folder/'rig.json').read_text('utf-8'))
    rig['fillImage']=Image.open(folder/rig['bodyFill']).convert('RGBA')
    assembly=Image.open(folder/rig['bodyVisible']).convert('RGBA')
    head_alpha=np.zeros((512,512),np.uint8)
    legs=[]
    for attachment in rig['attachments']:
        image=Image.open(folder/attachment['image']).convert('RGBA')
        x0,y0,x1,y1=attachment['bounds']
        if attachment['id'] in ['head','tail']:
            assembly.alpha_composite(image,(x0,y0))
            if attachment['id']=='head': head_alpha[y0:y1,x0:x1]=np.array(image)[:,:,3]
            continue
        attachment['texture']=premultiplied(image)
        attachment['sourceArray']=np.array(attachment['sourceVertices'],float)
        attachment['verticesArray']=np.array(attachment['vertices'],float)
        attachment['weightsArray']=np.array(attachment['weights'],float)
        legs.append(attachment)
    rig['legs']=legs
    eye_states=[]
    for state in ['open','half','closed']:
        image=assembly.copy()
        if state!='closed':
            for eye in rig['eyes']:
                patch=Image.open(folder/eye['image']).convert('RGBA')
                x0,y0,x1,y1=eye['target'];w,h=patch.size
                mask=Image.new('L',(w*4,h*4))
                ImageDraw.Draw(mask).rounded_rectangle((0,0,w*4-1,h*4-1),20,255)
                mask=np.array(mask.resize((w,h),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))).astype(float)/255
                if state=='half':
                    mask[:round(h*0.48)]=0
                pixels=np.array(patch)
                pixels[:,:,3]=np.round(pixels[:,:,3]*mask*head_alpha[y0:y1,x0:x1]/255).astype(np.uint8)
                image.alpha_composite(Image.fromarray(pixels),(x0,y0))
        eye_states.append(image)
    rig['assemblies']=eye_states
    return rig


def pose(attachment,body_y,remaining):
    vertices=attachment['verticesArray']
    weights=attachment['weightsArray']
    result=np.zeros(vertices.shape)
    for index,control in enumerate(attachment['controls']):
        center=np.array(control['bind'],float)
        offset=np.array(control['startOffset'])*remaining
        offset[1]+=body_y*control['bodyInfluence']
        scale=1+(control['startScaleX']-1)*remaining
        deformed=vertices.copy()
        deformed[:,0]=(vertices[:,0]-center[0])*scale+center[0]+offset[0]
        deformed[:,1]+=offset[1]
        result+=deformed*weights[:,index:index+1]
    return result


def frame_at(rig,time):
    progress=smooth((time-rig['blinkMs'][0])/(rig['endMs']-rig['blinkMs'][0]))
    remaining=1-progress
    body_y=-rig['drop']*remaining
    frame=translated(rig['fillImage'],[0,body_y])
    part_counts={}
    for attachment in rig['legs']:
        vertices=pose(attachment,body_y,remaining)
        pixels,coordinates=rasterize(attachment['texture'],attachment['sourceArray'],vertices,attachment['triangles'])
        part_counts[attachment['id']]=int(np.count_nonzero(pixels[:,:,3]>128))
        frame.alpha_composite(Image.fromarray(pixels))
    blink=(time-rig['blinkMs'][0])/(rig['blinkMs'][1]-rig['blinkMs'][0])
    state=0 if blink<0.35 else 1 if blink<0.8 else 2
    frame.alpha_composite(translated(rig['assemblies'][state],[0,body_y]))
    return frame,{'timeMs':time,'progress':round(progress,6),'bodyY':round(body_y,6),'eyeState':state,'partPixels':part_counts}


def gif(paths,durations,destination,palette):
    sample=[paths[round(i*(len(paths)-1)/7)] for i in range(8)]
    execute(['magick']+[str(p) for p in sample]+['-background','#26352f','-alpha','remove','-alpha','off','+append','-colors','255','-unique-colors',str(palette)])
    command=['magick'];elapsed=0;ticks=0
    for path,duration in zip(paths,durations):
        elapsed+=duration
        target=round(elapsed/10)
        command+=['-delay',str(max(1,target-ticks)),'(',str(path),')']
        ticks=target
    execute(command+['-background','#26352f','-alpha','remove','-alpha','off','-remap',str(palette),'-loop','0',str(destination)])


def render(name,until,tag):
    rig=load(name)
    work=PROJECT/'$Trash/slump-connect-v12'/name/tag
    work.mkdir(511,True,True)
    times=sorted(set(min(until,round(i*1000/rig['fps'])) for i in range(math.ceil(until*rig['fps']/1000)+1)))
    paths=[];frames=[];records=[]
    for index,time in enumerate(times):
        frame,record=frame_at(rig,time)
        path=work/f'{index:03d}.png'
        frame.save(path)
        paths.append(path);frames.append(frame);records.append(record)
    durations=[b-a for a,b in zip(times,times[1:])]+[rig['holdMs'] if tag=='full' else 400]
    gif(paths,durations,work/'preview.gif',work/'palette.png')
    board=Image.new('RGBA',(2048,1024),'#26352f')
    for slot in range(8):
        image=frames[round(slot*(len(frames)-1)/7)]
        board.alpha_composite(image,(slot%4*512,slot//4*512))
    board.convert('RGB').save(work/'contact.png')
    (work/'motion.json').write_bytes((json.dumps(records)+'\r\n').encode('utf-8'))
    (work/'timing.json').write_bytes((json.dumps(durations)+'\r\n').encode('utf-8'))
    print(json.dumps({'name':name,'frames':len(frames),'durationMs':sum(durations),'first':records[0],'last':records[-1],'contact':str(work/'contact.png'),'gif':str(work/'preview.gif')}))


if __name__=='__main__':
    render(sys.argv[1],int(sys.argv[2]),sys.argv[3])
