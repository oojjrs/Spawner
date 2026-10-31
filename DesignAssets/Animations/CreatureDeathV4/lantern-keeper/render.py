import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from engine import affine,ease,encode,leg_matrices,rasterize,rotation,write_json
from physics import simulate,at_time
from flexible import mesh,skin,solve

HERE=Path(__file__).resolve().parent

def tail_at_times(times,body_at,image,pivot):
    points=np.argwhere(np.asarray(image)[:,:,3]>128)[:,::-1]
    offset=points.mean(0)-pivot
    inertia=np.mean(np.sum((points-pivot)**2,1))
    angle=0
    velocity=0
    now=0
    output={}
    for time in times:
        while now<time:
            end=min(time,now+1000/240)
            dt=(end-now)/1000
            body=body_at(end)
            weak=ease((end-250)/650)
            world_angle=math.atan2(body[1,0],body[0,0])+angle
            horizontal=offset[0]*math.cos(world_angle)-offset[1]*math.sin(world_angle)
            acceleration=700*horizontal/inertia*weak-angle*(45*(1-weak)+.6*weak)-velocity*4
            velocity+=acceleration*dt
            angle=max(math.radians(-45),min(math.radians(110),angle+velocity*dt))
            now=end
        output[time]=body_at(time)@rotation(pivot,math.degrees(angle))
    return output

def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    config=rig['configuration']
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    trace=simulate(images,config,motion['physics'],motion['channels'])
    write_json(HERE/'physics-trace.json',trace)
    times=motion['timesMs']
    body_at=lambda t:at_time(t,trace)[0]
    head_at=lambda t:at_time(t,trace)[1]
    def obstacles(time):
        body,head=at_time(time,trace)
        return [(head,np.array([224,262]),np.array([72,56])),(body,np.array([303,336]),np.array([99,60]))]
    meshes={}
    dynamics={}
    definitions=dict(config['ears'])
    definitions['mane']=config['mane']
    for name,joints in definitions.items():
        meshes[name]=mesh(images[name],joints)
        parent=head_at if name in config['ears'] else body_at
        dynamics[name]=solve(times,joints,parent,images[name],motion['appendages'][name],obstacles if name in config['ears'] else lambda t:[])
    tails=tail_at_times(times,body_at,images['tail'],np.asarray(config['tailPivot'],float))
    frames=[]
    records=[]
    for index,time in enumerate(times):
        body,head=at_time(time,trace)
        layers={}
        limbs={}
        for name,joints in config['legs'].items():
            values=[]
            for axis in ['X','Y']:
                from engine import scalar
                values.append(scalar(time,motion['channels'][name+'-target'+axis]))
            bones,landmarks=leg_matrices(joints,body,1,values)
            layer=Image.new('RGBA',(512,512),(0,0,0,0))
            for part in [1,0,2]:
                segment=['upper','lower','paw'][part]
                layer.alpha_composite(affine(images[name+'-'+segment],bones[part]))
            layers[name]=layer
            limbs[name]=landmarks
        soft={}
        flex_records={}
        for name,data in meshes.items():
            record=dynamics[name][time]
            vertices=skin(data['vertices'],np.asarray(data['weights']),np.asarray(data['blendPivots']),record['matrices'])
            soft[name],_=rasterize(images[name],data,vertices)
            flex_records[name]={'particles':record['particles'].tolist(),'matrices':[m.tolist() for m in record['matrices']],'materialBottom':record['materialBottom'],'floorContact':record['floorContact'],'anchorErrorPx':record['anchorErrorPx']}
        frame=Image.new('RGBA',(512,512),(0,0,0,0))
        for name in config['backLayers']:frame.alpha_composite(layers[name])
        frame.alpha_composite(affine(images['tail'],tails[time]))
        for name in config['ears']:frame.alpha_composite(soft[name])
        frame.alpha_composite(affine(images['body'],body))
        for name in config['frontLayers']:frame.alpha_composite(layers[name])
        frame.alpha_composite(soft['mane'])
        frame.alpha_composite(affine(images['head-closed'] if time>=motion['eyeCloseMs'] else images['head'],head))
        frame.alpha_composite(affine(images['cheek-jewel'],head))
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'body':body.tolist(),'head':head.tolist(),'tail':tails[time].tolist(),'legs':limbs,'flexibleParts':flex_records,'alphaBounds':frame.getchannel('A').getbbox()})
    motion['durationsMs'][-1]=40
    motion['durationsMs'].append(1000)
    times.append(times[-1]+40)
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    terminal=json.loads(json.dumps(records[-1]))
    terminal['sourceTimeMs']=terminal['timeMs']
    terminal['timeMs']=times[-1]
    terminal['terminalHold']=True
    records.append(terminal)
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,motion['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],motion['durationsMs'])
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,8,16,24,32,40,55,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(times[index])+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    write_json(HERE/'landmarks.json',records)
    for name,data in meshes.items():write_json(HERE/(name+'-mesh.json'),data)
    prefix='DesignAssets/Animations/CreatureDeathV4/lantern-keeper/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/lantern-keeper.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':motion['durationsMs'],'durationMs':sum(motion['durationsMs']),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print('lantern V4',len(frames),sum(motion['durationsMs']))

if __name__=='__main__':
    main()
