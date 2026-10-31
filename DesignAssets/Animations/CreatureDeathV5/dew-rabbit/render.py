import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from engine import affine,encode,leg_matrices,make_mesh,rasterize,scalar,write_json
from physics import simulate,at_time
from flexible import mesh,skin,solve
HERE=Path(__file__).resolve().parent
def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    config=rig['configuration']
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    visible_images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Source/VisibleParts').glob('*.png')}
    face_mask=np.asarray(Image.open(HERE/config['depthMasks']['head']).convert('L')).astype(float)/255
    front_heads={}
    for name in ['head','head-closed']:
        pixels=np.array(visible_images[name])
        pixels[:,:,3]=np.uint8(pixels[:,:,3]*face_mask+.5)
        front_heads[name]=Image.fromarray(pixels)
    leaf_mask=np.asarray(Image.open(HERE/config['depthMasks']['near-ear']).convert('L')).astype(float)/255
    selector=np.array(visible_images['near-ear'])
    selector[:,:,3]=np.uint8(selector[:,:,3]*leaf_mask+.5)
    selector=Image.fromarray(selector)
    underpaint={}
    for name in ['head','head-closed','far-ear','near-ear']:
        pixels=np.array(images[name])
        alpha=np.asarray(visible_images[name])[:,:,3]
        if name.startswith('head'):pixels[(alpha>0)&(alpha<200),3]=0
        else:pixels[alpha>0,3]=0
        underpaint[name]=Image.fromarray(pixels)
    physics_images=dict(images)
    physics_images['body']=images['body'].copy()
    physics_images['body'].alpha_composite(images['ruff'])
    trace=simulate(physics_images,config,motion['physics'],motion['channels'])
    write_json(HERE/'physics-trace.json',trace)
    times=motion['timesMs']
    head_at=lambda t:at_time(t,trace)[1]
    def obstacles(time):
        body,head=at_time(time,trace)
        return [(head,np.array(config['headObstacle'][0]),np.array(config['headObstacle'][1])),(body,np.array(config['bodyObstacle'][0]),np.array(config['bodyObstacle'][1]))]
    meshes={}
    dynamics={}
    for name,joints in config['ears'].items():
        meshes[name]=mesh(images[name],joints)
        dynamics[name]=solve(times,joints,head_at,images[name],motion['appendages'][name],obstacles)
    for name,joints in config['legs'].items():
        data=make_mesh(images[name],joints,'leg')
        data['blendPivots']=[joints[1] if v[1]<joints[2][1]-8 else joints[2] for v in data['vertices']]
        meshes[name]=data
    frames=[]
    records=[]
    for index,time in enumerate(times):
        body,head=at_time(time,trace)
        layers={}
        rear_layers={}
        limbs={}
        appendages={}
        for name,joints in config['legs'].items():
            target=[scalar(time,motion['channels'][name+'-target'+axis]) for axis in ['X','Y']]
            bones,landmarks=leg_matrices(joints,body,1,target)
            if name=='hindleg':
                layers[name]=affine(images['hindleg-lower'],bones[1])
                rear_layers[name]=Image.new('RGBA',(512,512))
                for segment,bone in [('paw',bones[2]),('haunch',bones[0])]:
                    complete=images['hindleg-'+segment]
                    visible=visible_images['hindleg-'+segment]
                    pixels=np.array(complete)
                    pixels[np.asarray(visible_images['hindleg-'+segment])[:,:,3]>0,3]=0
                    rear_layers[name].alpha_composite(affine(Image.fromarray(pixels),bone))
                    layers[name].alpha_composite(affine(visible,bone))
            else:
                data=meshes[name]
                vertices=skin(data['vertices'],np.asarray(data['weights']),np.asarray(data['blendPivots']),bones)
                pixels=np.array(images[name])
                pixels[np.asarray(visible_images[name])[:,:,3]>0,3]=0
                rear_layers[name],_=rasterize(Image.fromarray(pixels),data,vertices)
                layers[name],_=rasterize(visible_images[name],data,vertices)
            limbs[name]=landmarks
        for name in config['ears']:
            record=dynamics[name][time]
            data=meshes[name]
            vertices=skin(data['vertices'],np.asarray(data['weights']),np.asarray(data['blendPivots']),record['matrices'])
            layers[name],_=rasterize(images[name],data,vertices)
            if name=='near-ear':
                selected,_=rasterize(selector,data,vertices)
                whole=np.maximum(1,np.asarray(layers[name])[:,:,3].astype(float))
                near_depth=Image.fromarray(np.uint8(np.clip(np.asarray(selected)[:,:,3]/whole*255,0,255)))
            appendages[name]={'particles':record['particles'].tolist(),'anchorErrorPx':record['anchorErrorPx'],'materialBottom':record['materialBottom'],'matrices':[m.tolist() for m in record['matrices']]}
        layers['body']=affine(images['body'],body)
        layers['tail']=affine(images['tail'],body)
        layers['ruff']=affine(images['ruff'],body)
        layers['head']=affine(images['head-closed'] if time>=motion['eyeCloseMs'] else images['head'],head)
        head_name='head-closed' if time>=motion['eyeCloseMs'] else 'head'
        full_head=affine(images[head_name],head)
        selected=affine(front_heads[head_name],head)
        coverage=np.maximum(1,np.asarray(full_head)[:,:,3].astype(float))
        head_depth=Image.fromarray(np.uint8(np.clip(np.asarray(selected)[:,:,3]/coverage*255,0,255)))
        def compose(front,front_head):
            result=Image.new('RGBA',(512,512))
            if not front_head:result.alpha_composite(full_head)
            for layer in rear_layers.values():result.alpha_composite(layer)
            for name in config['layerOrder']:
                if name=='foreleg-far' or (front and name=='near-ear'):continue
                if name=='body':
                    result.alpha_composite(layers[name])
                    result.alpha_composite(layers['foreleg-far'])
                elif name=='head':
                    if front_head:result.alpha_composite(full_head)
                else:result.alpha_composite(layers[name])
            if front:result.alpha_composite(layers['near-ear'])
            return result
        back=Image.composite(compose(False,True),compose(False,False),head_depth)
        front=Image.composite(compose(True,True),compose(True,False),head_depth)
        frame=Image.composite(front,back,near_depth)
        if time in [0,920,2200]:
            folder=HERE/'LayerPoses'/str(time)
            folder.mkdir(511,True,True)
            for name,layer in layers.items():layer.save(folder/str(name+'.png'))
        frame.save(HERE/'Frames'/str('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'body':body.tolist(),'head':head.tolist(),'legs':limbs,'ears':appendages})
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/str('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    durations=motion['durationsMs']+[1000]
    records.append(dict(records[-1]))
    records[-1]['sourceTimeMs']=records[-1]['timeMs']
    records[-1]['timeMs']=records[-1]['timeMs']+40
    records[-1]['terminalHold']=True
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)))
    for index,frame in enumerate(frames):sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,durations)
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,8,14,20,26,32,42,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(index*40)+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    comparison=Image.new('RGB',(2048,512),(35,42,37))
    for cell,frame in enumerate([Image.open(HERE/'reference.png').convert('RGBA'),frames[0],frames[23],frames[-1]]):comparison.paste(frame,(cell*512,0),frame)
    comparison.save(HERE/'design-comparison.png')
    neutral=Image.new('RGB',(1536,512),(35,42,37))
    reference=Image.open(HERE/'reference.png').convert('RGBA')
    for cell,frame in enumerate([reference,frames[0],Image.blend(reference,frames[0],.5)]):neutral.paste(frame,(cell*512,0),frame)
    neutral.save(HERE/'neutral-comparison.png')
    write_json(HERE/'landmarks.json',records)
    for name,data in meshes.items():write_json(HERE/str(name+'-mesh.json'),data)
    prefix='DesignAssets/Animations/CreatureDeathV5/'+HERE.name+'/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+HERE.name+'.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print(HERE.name,len(frames),sum(durations))
if __name__=='__main__':main()
