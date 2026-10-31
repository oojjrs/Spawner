from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw
from physics import simulate,at_time,matrix,rot,ease
from mesh import mesh
from sampling import affine

root=Path(__file__).resolve().parent
rig=json.loads((root/'rig.json').read_text('utf-8'))
collision={name:Image.open(root/path).convert('RGBA') for name,path in rig['parts'].items()}
collision.update({name+'-skin':Image.open(root/rig['skinMeshes'][name]['complete']).convert('RGBA') for name in rig['legs']})
records=simulate(collision,rig,rig['actionMs'])
textures={}
for name in rig['drawOrder']:
    if name in rig['skinMeshes']:
        textures[name]={'complete':Image.open(root/rig['skinMeshes'][name]['complete']).convert('RGBA')}
    else:
        textures[name]={'complete':Image.open(root/'Parts'/(name+'.png')).convert('RGBA')}
textures['head']['closed']=Image.open(root/'Parts/head-closed.png').convert('RGBA')
head_hidden=Image.open(root/'Parts/head-hidden.png').convert('RGBA')
original_paint={}
for name in rig['drawOrder']:
    if name=='body-core':
        continue
    path='Parts/'+name+'-skin-visible.png' if name in rig['legs'] else 'Parts/'+name+'-visible.png'
    original_paint[name]=Image.open(root/path).convert('RGBA')
original_paint['closed']=Image.open(root/'Parts/head-closed-visible.png').convert('RGBA')
appendages={}
for name,spec in rig['appendages'].items():
    image=Image.open(root/'Parts'/(name+'.png')).convert('RGBA')
    pivot=np.array(spec['root'])
    pixels=np.argwhere(np.array(image)[:,:,3]>128)[:,::-1]
    lever=pixels.mean(0)-pivot
    inertia=np.mean(np.sum((pixels-pivot)**2,1))
    angle,speed=0,0
    previous=None
    previous_speed=np.zeros(2)
    values=[]
    for record in records:
        parent=np.array(record['matrices'][spec['parent']])
        point=(parent@np.r_[pivot,1])[:2]
        dt=1/240
        root_speed=(point-previous)/dt if previous is not None else np.zeros(2)
        acceleration=np.clip((root_speed-previous_speed)/dt,-1800,1800)
        world_lever=parent[:2,:2]@rot(angle)@lever
        gravity=(world_lever[0]*(900-acceleration[1])+world_lever[1]*acceleration[0])/inertia
        active=1-ease((record['timeMs']-spec['release'][0])/(spec['release'][1]-spec['release'][0]))
        speed+=(gravity-spec['stiffness']*active*angle-11*speed)*dt
        angle+=speed*dt
        limited=max(spec['range'][0],min(spec['range'][1],angle))
        if limited!=angle:
            speed=0
            angle=limited
        values.append(angle)
        previous,previous_speed=point,root_speed
    appendages[name]=values

def transform(image,value):
    return affine(image,value,(512,512))

def frame(time):
    matrices=at_time(time,records)
    index=max(0,min(len(records)-1,round(time*240/1000)))
    for name,spec in rig['appendages'].items():
        pivot=np.array(spec['root'])
        matrices[name]=np.array(matrices[spec['parent']])@matrix(pivot,pivot,appendages[name][index])
    output=Image.new('RGBA',(512,512))
    for name in rig['drawOrder']:
        if name=='mane':
            output.alpha_composite(transform(head_hidden,np.array(matrices['head-open'])))
        texture=textures[name]['closed' if name=='head' and time>=160 else 'complete']
        if name=='head':
            texture=original_paint['closed' if time>=160 else 'head']
        if name in rig['skinMeshes']:
            layer=mesh(texture,rig['skinMeshes'][name],matrices)
        else:
            target='head-open' if name=='head' else 'body' if name=='body-core' else name
            layer=transform(texture,np.array(matrices[target]))
        output.alpha_composite(layer)
    pixels=np.array(output,float)
    for name in rig['drawOrder']:
        if name=='body-core':
            continue
        source=original_paint['closed' if name=='head' and time>=160 else name]
        if name in rig['skinMeshes']:
            layer=mesh(source,rig['skinMeshes'][name],matrices)
        else:
            target='head-open' if name=='head' else name
            layer=transform(source,np.array(matrices[target]))
        paint=np.array(layer,float)
        coverage=np.clip((paint[:,:,3]-204)/51,0,1)[:,:,None]
        pixels[:,:,:3]=pixels[:,:,:3]*(1-coverage)+paint[:,:,:3]*coverage
    output=Image.fromarray(np.uint8(np.clip(pixels+0.5,0,255)))
    return output

if __name__=='__main__':
    times=list(range(0,rig['actionMs']+1,rig['stepMs']))
    frames=[frame(time) for time in times]
    durations=[rig['stepMs']]*(len(frames)-1)+[rig['holdMs']]
    (root/'Frames').mkdir(0o777,True,True)
    for index,image in enumerate(frames):
        image.save(root/'Frames'/('frame-'+str(index)+'.png'))
    sheet=Image.new('RGBA',(4096,512*math.ceil(len(frames)/8)))
    for index,image in enumerate(frames):
        sheet.alpha_composite(image,(index%8*512,index//8*512))
    sheet.save(root/'death.webp', **{'lossless':True,'method':4})
    frames[0].save(root/'preview.webp', **{'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
    small=[image.resize((64,64),Image.Resampling.LANCZOS) for image in frames]
    small[0].save(root/'thumbnail.webp', **{'save_all':True,'append_images':small[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
    frames[-1].save(root/'final.png')
    contact=Image.new('RGBA',(1536,1024),(38,53,49,255))
    for slot,index in enumerate([0,5,10,18,32,len(frames)-1]):
        contact.alpha_composite(frames[index],(slot%3*512,slot//3*512))
    contact.save(root/'contact.png')
    prefix='DesignAssets/Animations/CreatureDeathV5/soil-boar/'
    metadata={'sourceImage':'DesignAssets/CreatureConcepts/v3/soil-boar.png','image':prefix+'death.webp','frameSize':512,'columns':8,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'sourceCanvasPlacement':rig['sourceCanvasPlacement'],'rig':prefix+'rig.json','renderer':prefix+'render.py','prepare':prefix+'prepare.py'}
    for name,value in [['death.json',metadata],['Source/motion.json',records]]:
        (root/name).write_bytes(json.dumps(value, **{'indent':2}).replace('\n','\r\n').encode('utf-8'))
    print(json.dumps({'frames':len(frames),'duration':sum(durations),'maximumJointError':max(row['jointErrorPx'] for row in records)}))
