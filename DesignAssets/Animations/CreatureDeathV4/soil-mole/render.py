import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,_webp
from engine import affine,ease,encode,leg_matrices,make_mesh,mesh_render,rotation,scalar,translation,write_json

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
    states={}
    samples={}
    for name,joints in config.get('ears',{}).items():
        delta=np.asarray(joints[2])-np.asarray(joints[1])
        states[name]={'angle':math.atan2(delta[1],delta[0]),'speed':0,'tip':0,'tipSpeed':0,'anchor':np.asarray(joints[1],float),'velocity':np.zeros(2)}
    now=0
    for time in times:
        while now<time:
            next_time=min(time,now+1000/240)
            dt=(next_time-now)/1000
            values,body,head=poses(next_time,channels,config)
            head_angle=math.atan2(head[1,0],head[0,0])
            weakness=ease((next_time-160)/460)
            for name,joints in config.get('ears',{}).items():
                state=states[name]
                anchor=(head@np.array(joints[1]+[1]))[:2]
                velocity=(anchor-state['anchor'])/dt
                acceleration=(velocity-state['velocity'])/dt
                acceleration=np.clip(acceleration,-3000,3000)
                delta=np.asarray(joints[2])-np.asarray(joints[1])
                bind=math.atan2(delta[1],delta[0])
                rest=head_angle+bind
                length=np.linalg.norm(delta)
                force=(acceleration[0]*math.sin(state['angle'])+(motion['earGravity']*weakness-acceleration[1])*math.cos(state['angle']))/length
                stiffness=50*(1-weakness)+1.4*weakness
                state['speed']+=(force-stiffness*wrapped(state['angle']-rest)-motion['earDamping']*state['speed'])*dt
                state['angle']+=state['speed']*dt
                local=wrapped(state['angle']-rest)
                lower,upper=(-1.85,.2) if name=='far-ear' else (-.2,2.35)
                limited=max(lower,min(upper,local))
                if limited!=local:
                    state['angle']=rest+limited
                    state['speed']*=.2
                target=limited*.25
                state['tipSpeed']+=(30*(target-state['tip'])-6*state['tipSpeed'])*dt
                state['tip']+=state['tipSpeed']*dt
                state['anchor']=anchor
                state['velocity']=velocity
            now=next_time
        values,body,head=poses(time,channels,config)
        head_angle=math.atan2(head[1,0],head[0,0])
        samples[time]={}
        for name,joints in config.get('ears',{}).items():
            delta=np.asarray(joints[2])-np.asarray(joints[1])
            bend=wrapped(states[name]['angle']-head_angle-math.atan2(delta[1],delta[0]))
            middle=head@rotation(joints[1],math.degrees(bend))
            end=middle@rotation(joints[2],math.degrees(states[name]['tip']))
            samples[time][name]=[head,middle,end]
    return samples

def split_limb(image,joints,claws):
    pixels=np.array(image)
    y,x=np.mgrid[:512,:512]
    hip,knee,ankle=np.asarray(joints,float)
    upper_axis=(knee-hip)/np.linalg.norm(knee-hip)
    lower_axis=(ankle-knee)/np.linalg.norm(ankle-knee)
    before_knee=(x-knee[0])*upper_axis[0]+(y-knee[1])*upper_axis[1]
    after_ankle=(x-ankle[0])*lower_axis[0]+(y-ankle[1])*lower_axis[1]
    knee_circle=(x-knee[0])**2+(y-knee[1])**2<=18**2
    ankle_circle=(x-ankle[0])**2+(y-ankle[1])**2<=17**2
    masks=[(before_knee<=0)|knee_circle,((before_knee>=0)&(after_ankle<=0))|knee_circle|ankle_circle,(after_ankle>=0)|ankle_circle]
    if claws:
        c=pixels.astype(float)
        ivory=(c[:,:,0]>160)&(c[:,:,1]>c[:,:,0]*.8)&(c[:,:,2]>c[:,:,0]*.55)&(pixels[:,:,3]>8)
        ivory=np.asarray(Image.fromarray(np.uint8(ivory)*255).filter(ImageFilter.MaxFilter(5)))>0
        masks[0]&=~ivory
        masks[1]&=~ivory
        masks[2]|=ivory
    layers=[]
    for mask in masks:
        part=pixels.copy()
        part[~mask]=0
        layers.append(Image.fromarray(part))
    return layers

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
        legs={}
        for name,joints in config['legs'].items():
            matrices,landmarks=leg_matrices(joints,body,1,[values[name+'-targetX'],values[name+'-targetY']])
            layers[name]=Image.new('RGBA',(512,512),(0,0,0,0))
            for order in ([1,2,0] if 'hind' in name else [1,0,2]):
                part,matrix=limb_parts[name][order],matrices[order]
                layers[name].alpha_composite(affine(part,matrix))
            legs[name]=landmarks
        for name in config['backLayers']:
            frame.alpha_composite(layers[name])
        frame.alpha_composite(affine(images['body'],body))
        for name in config['frontLayers']:
            frame.alpha_composite(layers[name])
        ear_records={}
        for name,joints in config.get('ears',{}).items():
            layer,vertices=mesh_render(images[name],meshes[name],ears[time][name])
            frame.alpha_composite(layer)
            root=(head@np.array(joints[0]+[1]))[:2]
            rendered_root=(ears[time][name][0]@np.array(joints[0]+[1]))[:2]
            ear_records[name]={'headRoot':root.tolist(),'earRoot':rendered_root.tolist(),'anchorErrorPx':float(np.linalg.norm(root-rendered_root)),'matrices':[m.tolist() for m in ears[time][name]]}
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
