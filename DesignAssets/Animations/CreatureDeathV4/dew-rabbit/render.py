import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,_webp
from engine import affine,ease,encode,leg_matrices,make_mesh,mesh_render,rasterize,rotation,scalar,translation,write_json

from physics import simulate,at_time

HERE=Path(__file__).resolve().parent
PHYSICS=[]

def poses(time,channels,config):
    values={name:scalar(time,keys) for name,keys in channels.items()}
    body,head=at_time(time,PHYSICS)
    return values,body,head

def wrapped(value):
    return (value+math.pi)%(2*math.pi)-math.pi

def ears_at_times(times,channels,config,motion):
    global EAR_PARTICLES
    EAR_PARTICLES={}
    positions={name:np.asarray(joints,float).copy() for name,joints in config.get('ears',{}).items()}
    previous={name:value.copy() for name,value in positions.items()}
    lengths={name:np.linalg.norm(np.diff(value,1,0),None,1) for name,value in positions.items()}
    now=0
    samples={}
    for time in times:
        while now<time:
            end=min(time,now+1000/240)
            dt=(end-now)/1000
            _,body,head=poses(end,channels,config)
            weakness=ease((end-160)/460)
            for name,joints in config.get('ears',{}).items():
                current=positions[name]
                rest=(head@np.c_[np.asarray(joints),np.ones(3)].T).T[:,:2]
                velocity=(current-previous[name])*math.exp(-2.8*dt)
                old=current.copy()
                acceleration=np.array([0,motion['earGravity']*weakness])+(rest-current)*(65*(1-weakness)+.4*weakness)
                current+=velocity+acceleration*dt*dt
                current[0]=rest[0]
                for iteration in range(10):
                    current[0]=rest[0]
                    for segment,length in enumerate(lengths[name]):
                        delta=current[segment+1]-current[segment]
                        distance=max(1e-8,np.linalg.norm(delta))
                        correction=delta*(distance-length)/distance
                        if segment==0:
                            current[1]-=correction
                        else:
                            current[1]+=correction*.5
                            current[2]-=correction*.5
                    first=current[1]-current[0]
                    second=current[2]-current[1]
                    relative=wrapped(math.atan2(second[1],second[0])-math.atan2(first[1],first[0]))
                    limit=math.radians(72)
                    if abs(relative)>limit:
                        angle=math.atan2(first[1],first[0])+max(-limit,min(limit,relative))
                        current[2]=current[1]+lengths[name][1]*np.array([math.cos(angle),math.sin(angle)])
                    for particle in [1,2]:
                        for transform,center,radii in [(head,np.array([217,258]),np.array([84,70])),(body,np.array([287,335]),np.array([108,58]))]:
                            local=(np.linalg.inv(transform)@np.r_[current[particle],1])[:2]
                            delta=local-center
                            level=np.linalg.norm(delta/(radii+8))
                            if 0<level<1:
                                local=center+delta/level
                                current[particle]=(transform@np.r_[local,1])[:2]
                        radius=([28,30] if name=='far-ear' else [32,24])[particle-1]
                        current[particle,1]=min(current[particle,1],motion['physics']['groundPlanes'][1]-radius)
                previous[name]=old
                positions[name]=current
            now=end
        _,body,head=poses(time,channels,config)
        samples[time]={}
        EAR_PARTICLES[time]={}
        for name,joints in config.get('ears',{}).items():
            current=positions[name]
            matrices=[head]
            for segment in range(2):
                source=np.asarray(joints[segment+1])-np.asarray(joints[segment])
                destination=current[segment+1]-current[segment]
                angle=math.atan2(destination[1],destination[0])-math.atan2(source[1],source[0])
                matrices.append(translation(current[segment,0],current[segment,1])@rotation([0,0],math.degrees(angle))@translation(-joints[segment][0],-joints[segment][1]))
            samples[time][name]=matrices
            EAR_PARTICLES[time][name]=current.tolist()
    return samples

def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    config=rig['configuration']
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    meshes={}
    limb_parts={name:[images[name+'-'+segment] for segment in ['upper','lower','paw']] for name in config['legs']}
    meshes.update({name:make_mesh(images[name],joints,'ear') for name,joints in config.get('ears',{}).items()})
    global PHYSICS
    PHYSICS=simulate(images,config,motion['physics'],motion['channels'])
    write_json(HERE/'physics-trace.json',PHYSICS)
    times=motion['timesMs']
    ears=ears_at_times(times,motion['channels'],config,motion)
    frames=[]
    records=[]
    for index,time in enumerate(times):
        values,body,head=poses(time,motion['channels'],config)
        frame=Image.new('RGBA',(512,512),(0,0,0,0))
        layers={}
        segment_layers={}
        legs={}
        for name,joints in config['legs'].items():
            matrices,landmarks=leg_matrices(joints,body,1,[values[name+'-targetX'],values[name+'-targetY']])
            layers[name]=Image.new('RGBA',(512,512),(0,0,0,0))
            segment_layers[name]=[affine(part,matrix) for part,matrix in zip(limb_parts[name],matrices)]
            for order in ([1,2,0] if name=='hindleg' else [1,0,2]):
                part,matrix=limb_parts[name][order],matrices[order]
                layers[name].alpha_composite(affine(part,matrix))
            legs[name]=landmarks
        for name in config['backLayers']:
            if name in config['pawForeground']:
                for segment in [1,0]:frame.alpha_composite(segment_layers[name][segment])
            else:
                frame.alpha_composite(layers[name])
        frame.alpha_composite(affine(images['body'],body))
        for name in config['frontLayers']:
            frame.alpha_composite(layers[name])
        for name in config['pawForeground']:
            frame.alpha_composite(segment_layers[name][2])
        ear_records={}
        for name,joints in config.get('ears',{}).items():
            layer,vertices=mesh_render(images[name],meshes[name],ears[time][name])
            frame.alpha_composite(layer)
            root=(head@np.array(joints[0]+[1]))[:2]
            rendered_root=(ears[time][name][0]@np.array(joints[0]+[1]))[:2]
            ear_records[name]={'headRoot':root.tolist(),'earRoot':rendered_root.tolist(),'anchorErrorPx':float(np.linalg.norm(root-rendered_root)),'particles':EAR_PARTICLES[time][name],'matrices':[m.tolist() for m in ears[time][name]]}
        frame.alpha_composite(affine(images['head-closed'] if time>=motion['eyeCloseMs'] else images['head'],head))
        frames.append(frame)
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        records.append({'timeMs':time,'body':body.tolist(),'head':head.tolist(),'legs':legs,'ears':ear_records,'alphaBounds':frame.getchannel('A').getbbox()})
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
    columns=4
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/columns)),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%columns*512,index//columns*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    durations=motion['durationsMs']
    encode(HERE/'preview.webp',frames,durations)
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
    frames[-1].save(HERE/'final.png')
    frames[0].save(HERE/'neutral-reassembled.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,8,14,19,25,30,38,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(times[index])+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    write_json(HERE/'landmarks.json',records)
    for name,mesh in meshes.items():
        write_json(HERE/(name+'-mesh.json'),mesh)
    prefix='DesignAssets/Animations/CreatureDeathV4/'+HERE.name+'/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+HERE.name+'.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print(HERE.name,len(frames),sum(durations))

if __name__=='__main__':
    main()
