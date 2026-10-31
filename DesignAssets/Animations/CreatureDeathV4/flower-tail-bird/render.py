import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from engine import affine,encode,leg_matrices,make_mesh,mesh_render,scalar,write_json
from physics import simulate,at_time
from appendage import solve

HERE=Path(__file__).resolve().parent

def leg_parts(image,joints):
    pixels=np.array(image)
    y,x=np.mgrid[:512,:512]
    hip,knee,ankle=np.asarray(joints,float)
    kc=(x-knee[0])**2+(y-knee[1])**2<=5**2
    ac=(x-ankle[0])**2+(y-ankle[1])**2<=5**2
    masks=[(y<=knee[1])|kc,((y>=knee[1])&(y<=ankle[1]))|kc|ac,(y>=ankle[1])|ac]
    output=[]
    for mask in masks:
        part=pixels.copy()
        part[~mask]=0
        output.append(Image.fromarray(part))
    return output

def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    config=rig['configuration']
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    trace=simulate(images,config,motion['physics'],motion['channels'])
    write_json(HERE/'physics-trace.json',trace)
    def parent(time):
        return at_time(time,trace)[0]
    meshes={name:make_mesh(images[name],joints,'ear') for name,joints in config['appendages'].items()}
    appendages={name:solve(motion['timesMs'],joints,parent,images[name],motion['appendages'][name]) for name,joints in config['appendages'].items()}
    legs={name:leg_parts(images[name],joints) for name,joints in config['legs'].items()}
    for name,parts in legs.items():
        for segment,part in zip(['upper','lower','paw'],parts):
            part.save(HERE/'Parts'/(name+'-'+segment+'.png'))
    frames=[]
    records=[]
    for index,time in enumerate(motion['timesMs']):
        body,head=at_time(time,trace)
        frame=Image.new('RGBA',(512,512),(0,0,0,0))
        limbs={}
        for name,joints in config['legs'].items():
            target=[scalar(time,motion['channels'][name+'-targetX']),scalar(time,motion['channels'][name+'-targetY'])]
            matrices,landmarks=leg_matrices(joints,body,1,target)
            for order in [1,0,2]:
                frame.alpha_composite(affine(legs[name][order],matrices[order]))
            limbs[name]=landmarks
        tail,_=mesh_render(images['tail'],meshes['tail'],appendages['tail'][time]['matrices'])
        frame.alpha_composite(tail)
        frame.alpha_composite(affine(images['body'],body))
        frame.alpha_composite(affine(images['head-closed'] if time>=motion['eyeCloseMs'] else images['head'],head))
        wing,_=mesh_render(images['wing'],meshes['wing'],appendages['wing'][time]['matrices'])
        frame.alpha_composite(wing)
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'body':body.tolist(),'head':head.tolist(),'legs':limbs,'appendages':{name:{'matrices':[m.tolist() for m in states[time]['matrices']],'particles':states[time]['particles'].tolist(),'floorContact':states[time]['floorContact'],'materialBottom':states[time]['materialBottom']} for name,states in appendages.items()},'alphaBounds':frame.getchannel('A').getbbox()})
    motion['durationsMs'][-1]=40
    motion['durationsMs'].append(1000)
    motion['timesMs'].append(motion['timesMs'][-1]+40)
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    terminal=json.loads(json.dumps(records[-1]))
    terminal['sourceTimeMs']=terminal['timeMs']
    terminal['timeMs']=motion['timesMs'][-1]
    terminal['terminalHold']=True
    records.append(terminal)
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,motion['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],motion['durationsMs'])
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,8,14,19,25,30,38,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(motion['timesMs'][index])+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    write_json(HERE/'landmarks.json',records)
    for name,mesh in meshes.items():
        write_json(HERE/(name+'-mesh.json'),mesh)
    prefix='DesignAssets/Animations/CreatureDeathV4/flower-tail-bird/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/flower-tail-bird.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':motion['durationsMs'],'durationMs':sum(motion['durationsMs']),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print('bird V4 exported',len(frames))

if __name__=='__main__':
    main()
