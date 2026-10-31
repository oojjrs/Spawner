from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json,math

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
images={file.stem:Image.open(file).convert('RGBA') for file in (folder/'Parts').glob('*.png')}
center=np.array(rig['bodyMassCenter'],float)
ground=rig['groundY'];slope=rig['groundSlope'];origin=rig['groundX']

def matrix(pivot,angle,target):
    c,s=math.cos(angle),math.sin(angle);x,y=pivot;dx,dy=target
    return np.array([[c,-s,dx-c*x+s*y],[s,c,dy-s*x-c*y],[0,0,1]],float)

def point(transform,p):
    return (transform@np.r_[p,1])[:2]

def hull(image):
    a=np.array(image)[:,:,3];points=[]
    for x in range(512):
        y=np.where(a[:,x]>128)[0]
        if len(y): points.extend([[x,int(y[0])],[x,int(y[-1])]])
    return np.array(points,float)

def contact(points,transform,offset):
    world=(transform@np.column_stack([points,np.ones(len(points))]).T).T[:,:2]
    depth=world[:,1]-slope*(world[:,0]-origin)-offset
    i=int(np.argmax(depth))
    return float(depth[i]-ground),world[i]

def loss(time,interval):
    u=np.clip((time*1000-interval[0])/(interval[1]-interval[0]),0,1)
    return float(u*u*(3-2*u))

def draw(image,transform):
    inverse=np.linalg.inv(transform)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')

def leg_pose(leg,body,target):
    bind=np.array(leg['joints'],float);h=point(body,bind[0]);knee=bind[1];end=bind[2]
    l1=np.linalg.norm(knee-bind[0]);l2=np.linalg.norm(end-knee);target=target.copy()
    d=target-h;distance=np.linalg.norm(d);maximum=l1+l2-.1;minimum=abs(l1-l2)+.1
    if distance>maximum or distance<minimum:
        radius=maximum if distance>maximum else minimum;dy=target[1]-h[1]
        if abs(dy)<radius:
            target[0]=h[0]+math.copysign(math.sqrt(radius*radius-dy*dy),d[0])
        else: target=h+d/max(.001,distance)*radius
        d=target-h;distance=np.linalg.norm(d)
    distance=np.clip(distance,minimum,maximum)
    direction=math.atan2(d[1],d[0])
    u=knee-bind[0];v=end-bind[0]
    bend=-1 if u[0]*v[1]-u[1]*v[0]>0 else 1
    offset=math.acos(np.clip((distance*distance+l1*l1-l2*l2)/(2*distance*l1),-1,1))
    angle=direction+bend*offset
    k=h+l1*np.array([math.cos(angle),math.sin(angle)])
    q=math.atan2(target[1]-k[1],target[0]-k[0])
    old1=math.atan2(*(bind[1]-bind[0])[::-1]);old2=math.atan2(*(bind[2]-bind[1])[::-1])
    transforms=[matrix(bind[0],angle-old1,h),matrix(bind[1],q-old2,k)]
    return transforms,np.array([h,k,target])

surfaces={name:hull(image) for name,image in images.items() if name not in ['body-closed','body-visible','body-visible-closed']}
foot_surfaces={}
leg_surfaces={}
for leg in rig['legs']:
    points=surfaces[leg['parts'][1]];bind=np.array(leg['joints']);axis=bind[2]-bind[1]
    fraction=(points-bind[1])@axis/np.dot(axis,axis)
    foot_surfaces[leg['id']]=points[fraction>=.82]
    leg_surfaces[leg['parts'][0]]=surfaces[leg['parts'][0]]
    leg_surfaces[leg['parts'][1]]=points[fraction<.82]

def grounded_leg(leg,body,target):
    target=target.copy()
    for _ in range(4):
        transforms,posed=leg_pose(leg,body,target)
        penetration,_=contact(foot_surfaces[leg['id']],transforms[1],depths[leg['id']])
        if abs(penetration)<.01: break
        target[1]-=penetration
    return leg_pose(leg,body,target)

alpha=np.array(images['body'])[:,:,3];yy,xx=np.where(alpha>128)
inertia=float(np.mean((xx-center[0])**2+(yy-center[1])**2))
hips=np.array([leg['joints'][0][0] for leg in rig['legs']],float)
weights=np.ones(len(hips))/len(hips)+(center[0]-hips.mean())*(hips-hips.mean())/np.sum((hips-hips.mean())**2)
weights=np.maximum(.01,weights);weights/=weights.sum()
feet={leg['id']:np.array(leg['joints'][2],float) for leg in rig['legs']}
depths={}
for leg in rig['legs']:
    points=foot_surfaces[leg['id']]
    depths[leg['id']]=float(np.max(points[:,1]-slope*(points[:,0]-origin))-ground)
jaws={}
for part in rig['jaws']:
    image=np.array(images[part['id']]);y,x=np.where(image[:,:,3]>128);pivot=np.array(part['pivot'],float)
    com=np.array([x.mean(),y.mean()]);moment=float(np.mean((x-pivot[0])**2+(y-pivot[1])**2))
    jaws[part['id']]={'pivot':pivot,'center':com,'inertia':moment,'angle':0.,'velocity':0.}
y=vy=angle=angular=0.;dt=1/240;sleep=0;asleep=False;samples=[]
steps=round(rig['durationActiveMs']/1000/dt)
last_sample=-1
for step in range(steps+1):
    time=step*dt
    body=matrix(center,angle,center+[0,y])
    if not asleep:
        normal=torque=0.
        for index,leg in enumerate(rig['legs']):
            strength=1-loss(time,rig['supportFailureMs'][leg['id'].split('-')[0]])
            force=rig['gravity']*weights[index]*strength
            normal+=force;torque-=(point(body,leg['joints'][0])[0]-center[0])*force
        vy+=(rig['gravity']-normal)*dt
        angular+=(torque/inertia-3.8*angular)*dt
        y+=vy*dt;angle+=angular*dt
    body=matrix(center,angle,center+[0,y])
    for name,state in jaws.items():
        transform=body@matrix(state['pivot'],state['angle'],state['pivot'])
        arm=point(transform,state['center'])-point(body,state['pivot'])
        state['velocity']+=(arm[0]*rig['gravity']/state['inertia']*loss(time,rig['jawFailureMs'])-5*state['velocity'])*dt
        state['angle']+=state['velocity']*dt
        lo,hi=np.radians(rig['jawLimitsDegrees'])
        clipped=float(np.clip(state['angle'],lo,hi))
        if clipped!=state['angle']: state['velocity']=0.
        state['angle']=clipped
    supported=False
    for iteration in range(8):
        candidates=[contact(surfaces['body'],body,0)]
        transforms={};landmarks={}
        for leg in rig['legs']:
            matrices,posed=grounded_leg(leg,body,feet[leg['id']])
            transforms[leg['id']]=matrices;landmarks[leg['id']]=posed
            if 'near' in leg['id']:
                for part,transform in zip(leg['parts'],matrices):
                    candidates.append(contact(leg_surfaces[part],transform,depths[leg['id']]))
        for name,state in jaws.items():
            transform=body@matrix(state['pivot'],state['angle'],state['pivot'])
            for _ in range(6):
                penetration,where=contact(surfaces[name],transform,0)
                if penetration<.01: break
                root=point(body,state['pivot']);lever=where[0]-root[0]+slope*(where[1]-root[1])
                if abs(lever)<2: break
                state['angle']=float(np.clip(state['angle']-np.clip(penetration/lever,-.15,.15),lo,hi))
                state['velocity']*=.2
                transform=body@matrix(state['pivot'],state['angle'],state['pivot'])
            candidates.append(contact(surfaces[name],transform,0))
        penetration,where=candidates[int(np.argmax(np.array([item[0] for item in candidates]))) ]
        if penetration<.02:
            supported=supported or penetration>-.15
            break
        supported=True
        lever=where[0]-center[0]+slope*(where[1]-(center[1]+y))
        denominator=1+lever*lever/inertia;correction=-penetration/denominator
        y+=correction;angle+=lever*correction/inertia
        speed=vy+angular*lever
        if speed>0:
            impulse=-1.02*speed/denominator
            vy+=impulse;angular+=lever*impulse/inertia
        body=matrix(center,angle,center+[0,y])
    if supported:
        angular*=math.exp(-10*dt)
        if abs(angular)<.1: angular=math.copysign(max(0,abs(angular)-dt),angular)
    if supported and abs(vy)<2 and abs(angular)<.02 and all(loss(time,v)==1 for v in rig['supportFailureMs'].values()) and all(abs(j['velocity'])<.02 for j in jaws.values()): sleep+=1
    else: sleep=0
    if sleep>36: asleep=True;vy=angular=0.
    sample_index=round(time*1000/rig['sampleMs'])
    if sample_index>last_sample and time*1000>=sample_index*rig['sampleMs']-.01:
        last_sample=sample_index
        transforms={};landmarks={}
        for leg in rig['legs']:
            matrices,posed=grounded_leg(leg,body,feet[leg['id']])
            transforms[leg['id']]=matrices;landmarks[leg['id']]=posed.tolist()
        jaw_transforms={name:body@matrix(state['pivot'],state['angle'],state['pivot']) for name,state in jaws.items()}
        samples.append({'timeMs':round(time*1000),'body':body.copy(),'legs':transforms,'landmarks':landmarks,'jaws':jaw_transforms,'bodyContact':supported,'asleep':asleep,'velocity':[vy,angular]})

frames=[];open_body=np.array(images['body-base']);closed_body=open_body.copy()
for sample in samples:
    layers={}
    for leg in rig['legs']:
        layers[leg['id']]=[draw(images[part],transform) for part,transform in zip(leg['parts'],sample['legs'][leg['id']])]
    frame=Image.new('RGBA',(512,512))
    for leg in rig['legs']:
        if 'far' in leg['id']:
            for layer in layers[leg['id']]: frame.alpha_composite(layer)
    blink=loss(sample['timeMs']/1000,[40,140])
    pixels=open_body.copy();pixels[:,:,:3]=np.rint(open_body[:,:,:3]*(1-blink)+closed_body[:,:,:3]*blink).astype(np.uint8)
    frame.alpha_composite(draw(Image.fromarray(pixels),sample['body']))
    for leg in rig['legs']:
        if 'near' in leg['id']:
            for layer in layers[leg['id']]: frame.alpha_composite(layer)
    for name,transform in sample['jaws'].items(): frame.alpha_composite(draw(images[name],transform))
    front=np.array(images['body-visible']);front_closed=np.array(images['body-visible-closed']);front[:,:,:3]=np.rint(front[:,:,:3]*(1-blink)+front_closed[:,:,:3]*blink).astype('uint8')
    frame.alpha_composite(draw(Image.fromarray(front),sample['body']))
    frames.append(frame)
frames.append(frames[-1].copy())
durations=[rig['sampleMs']]*(len(frames)-1)+[rig['finalHoldMs']]
columns=6;atlas=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
for i,frame in enumerate(frames):
    frame.save(folder/'Frames'/('frame-'+str(i).zfill(3)+'.png'))
    atlas.alpha_composite(frame,(i%columns*512,i//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for filename,size in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((size,size),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
base='DesignAssets/Animations/CreatureDeathV5/spiny-back-leader'
metadata={'name':rig['name'],'action':'death','sourceImage':rig['approvedImage'],'image':base+'/death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':base+'/preview.webp','thumbnail':base+'/thumbnail.webp','rig':base+'/rig.json','renderer':base+'/render.py','prepare':base+'/prepare.py','sourceAuthoring':base+'/Source/authoring.json','construction':'Fixed complete rigid carapace with locked eye expression patch, six independently articulated two-piece legs, support loss, surface contacts and gravity-driven mandibles.'}
records=[]
for sample in samples:
    records.append({**{key:value for key,value in sample.items() if key not in ['body','legs','jaws']},'body':sample['body'].tolist(),'legs':{name:[m.tolist() for m in matrices] for name,matrices in sample['legs'].items()},'jaws':{name:m.tolist() for name,m in sample['jaws'].items()}})
for filename,data in [('death.json',metadata),('motion.json',records)]:
    (folder/filename).write_bytes((json.dumps(data,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
board=Image.new('RGB',(2048,350),'#263631')
for col,index in enumerate([0,4,8,12,18,25,35,len(frames)-1]):
    image=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    board.paste(image,(col*256,0),image);ImageDraw.Draw(board).text((col*256+8,270),str(index*rig['sampleMs'])+' ms','white')
    little=frames[index].resize((64,64),Image.Resampling.LANCZOS);board.paste(little,(col*256+96,285),little)
board.save(folder/'contact.png');frames[-1].save(folder/'final.png')
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'finalBounds':frames[-1].getchannel('A').getbbox(),'finalVelocity':samples[-1]['velocity'],'asleep':samples[-1]['asleep']}))
