import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from engine import affine,encode,rasterize,rotation,translation,write_json
from soft_flow import controls,deform,ease,projection,sample_curve,shell_at,simulate_support

HERE=Path(__file__).resolve().parent

def soft_mesh(image):
    alpha=np.asarray(image)[:,:,3]
    bounds=image.getchannel('A').getbbox()
    valid=np.flatnonzero(np.any(alpha>128,0))
    xs=list(range(bounds[0]-1,bounds[2]+2,5))
    if xs[-1]<bounds[2]+1:xs.append(bounds[2]+1)
    vertices=[]
    padding=[]
    rows=24
    for x in xs:
        column=int(valid[np.argmin(abs(valid-x))])
        opaque=np.flatnonzero(alpha[:,column]>128)
        whole=np.flatnonzero(alpha[:,column]>0)
        ys=np.r_[whole[0]-1,np.linspace(opaque[0],opaque[-1],rows-2),whole[-1]+1]
        vertices.extend([[x,float(y)] for y in ys])
        padding.extend([0]*(rows-1)+[float(whole[-1]+1-opaque[-1])])
    triangles=[]
    for col in range(len(xs)-1):
        for row in range(rows-1):
            n=col*rows+row
            triangles.extend([[n,n+rows,n+1],[n+rows,n+rows+1,n+1]])
    return {'vertices':vertices,'triangles':triangles,'floorPadding':padding,'method':'contour-aligned continuous soft tissue surface'}

def eye_pose(time,eye,source_curve,target_curve,settings,drop):
    center=np.asarray(eye['globeCenter'],float)
    base=np.asarray(eye['stalkBase'],float)
    inside=np.asarray(eye['insidePoint'],float)
    progress=float(ease((time-eye['release'][0])/(eye['release'][1]-eye['release'][0])))
    current=(1-progress)**3*center+3*(1-progress)**2*progress*(center+np.array([0,65]))+3*(1-progress)*progress**2*(inside+np.array([12,-24]))+progress**3*inside
    points=np.vstack([base,current])
    mapped=deform(projection(points,source_curve),source_curve,target_curve,time,settings)
    mapped[:,1]+=drop
    source_axis=center-base
    target_axis=mapped[1]-mapped[0]
    angle=math.atan2(target_axis[1],target_axis[0])-math.atan2(source_axis[1],source_axis[0])
    u=source_axis/np.linalg.norm(source_axis)
    scale=np.linalg.norm(target_axis)/np.linalg.norm(source_axis)
    directional=np.eye(2)+(scale-1)*np.outer(u,u)
    c,s=math.cos(angle),math.sin(angle)
    stalk=np.eye(3)
    stalk[:2,:2]=np.array([[c,-s],[s,c]])@directional
    stalk[:2,2]=mapped[0]-stalk[:2,:2]@base
    original=source_curve[1]-source_curve[0]
    posed=target_curve[1]-target_curve[0]
    head_angle=math.atan2(posed[1],posed[0])-math.atan2(original[1],original[0])
    globe=translation(mapped[1,0],mapped[1,1])@rotation([0,0],math.degrees(head_angle))@translation(-center[0],-center[1])
    return stalk,globe,{'base':mapped[0].tolist(),'globeCenter':mapped[1].tolist(),'globeScale':1,'invagination':progress}

def main():
    settings=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    mesh=soft_mesh(images['mantle'])
    source_axis=np.asarray(settings['sourceAxis'],float)
    source_curve=sample_curve(source_axis)
    parameters=projection(mesh['vertices'],source_curve)
    cloud=np.argwhere(np.asarray(images['mantle'])[:,:,3]>128)[::6,::-1]
    support=simulate_support(source_axis,source_curve,projection(cloud,source_curve),np.asarray(images['shell-front'])[:,:,3],settings)
    write_json(HERE/'physics-trace.json',support)
    mesh['projection']={'segment':parameters[0].tolist(),'fraction':parameters[1].tolist(),'offset':parameters[2].tolist()}
    frames=[]
    records=[]
    for index,time in enumerate(settings['timesMs']):
        drop=shell_at(time,support)
        root=translation(0,drop)
        curve=sample_curve(controls(time,source_axis,settings))
        positions=deform(parameters,source_curve,curve,time,settings)
        positions[:,1]+=drop
        positions[:,1]=np.minimum(positions[:,1],settings['ground']+np.asarray(mesh['floorPadding']))
        mantle,_=rasterize(images['mantle'],mesh,positions)
        frame=affine(images['cavity'],root)
        eyes={}
        for name in ['far-eye','near-eye']:
            stalk,globe,record=eye_pose(time,settings['eyes'][name],source_curve,curve,settings,drop)
            frame.alpha_composite(affine(images[name+'-stalk'],stalk))
            frame.alpha_composite(affine(images[name+'-globe'],globe))
            record['stalkMatrix']=stalk.tolist()
            record['globeMatrix']=globe.tolist()
            eyes[name]=record
        frame.alpha_composite(mantle)
        frame.alpha_composite(affine(images['shell-front'],root))
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'shell':root.tolist(),'softCenterline':curve.tolist(),'eyes':eyes,'alphaBounds':frame.getchannel('A').getbbox()})
    settings['durationsMs'][-1]=40
    settings['durationsMs'].append(1000)
    settings['timesMs'].append(settings['timesMs'][-1]+40)
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    terminal=json.loads(json.dumps(records[-1]))
    terminal['sourceTimeMs']=terminal['timeMs']
    terminal['timeMs']=settings['timesMs'][-1]
    terminal['terminalHold']=True
    records.append(terminal)
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,settings['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],settings['durationsMs'])
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,7,12,18,24,30,38,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(settings['timesMs'][index])+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    write_json(HERE/'mantle-surface.json',mesh)
    write_json(HERE/'landmarks.json',records)
    write_json(HERE/'rig.json',{'name':'bundle-snail','method':'Continuous contour-aligned mantle invagination with rigid eye globes, soft stalk contraction and rigid shell descent driven by remaining foot contact area','parts':['cavity','shell-front','mantle','near-eye-stalk','near-eye-globe','far-eye-stalk','far-eye-globe'],'rigidParts':['shell-front','cavity','near-eye-globe','far-eye-globe'],'softHeadCompression':[1,.68],'sourceAxis':settings['sourceAxis'],'controls':'motion.json','renderer':'render.py','spineCompatibilityVerified':False})
    prefix='DesignAssets/Animations/CreatureDeathV4/bundle-snail/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/bundle-snail.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':settings['durationsMs'],'durationMs':sum(settings['durationsMs']),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print('snail V4 exported',len(frames),frames[-1].getchannel('A').getbbox())

if __name__=='__main__':
    main()
