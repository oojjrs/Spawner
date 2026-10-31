from pathlib import Path
import json
import math
import numpy as np
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parent
rig=json.loads((root/'rig.json').read_text('utf-8'))
bind=np.array([item['com'] for item in rig['nodes']],float)
mass=np.array([item['mass'] for item in rig['nodes']],float)
inverse_mass=1/mass
inverse_inertia=1/np.array([item['inertia'] for item in rig['nodes']],float)
textures={}
for name,part in rig['parts'].items():
    textures[name]={kind:Image.open(root/part[kind]).convert('RGBA') for kind in ['hidden','visible','complete']}
textures['head']['closed']=Image.open(root/'Parts/head-closed.png').convert('RGBA')

def rotate(points,angle):
    c=math.cos(angle)
    s=math.sin(angle)
    return np.asarray(points)@np.array([[c,s],[-s,c]])

def world(points,index,state):
    return rotate(np.asarray(points)-bind[index],state[index,2])+state[index,:2]

def hull(points):
    values=sorted(set(map(tuple,points)))
    def cross(a,b,c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower=[]
    for p in values:
        while len(lower)>1 and cross(lower[-2],lower[-1],p)<=0:
            lower.pop()
        lower.append(p)
    upper=[]
    for p in reversed(values):
        while len(upper)>1 and cross(upper[-2],upper[-1],p)<=0:
            upper.pop()
        upper.append(p)
    return np.array(lower[:-1]+upper[:-1],float)

colliders=[]
def skin_weights(part,points):
    distance=(points-np.array(part['elbow']))@np.array(part['axis'])
    width=part['blendWidth']
    t=np.clip((distance+width/2)/width,0,1)
    t=t*t*(3-2*t)
    if 'rigidY' in part:
        t[points[:,1]>=part['rigidY']]=1
    if 'rigidX' in part:
        t[points[:,0]<=part['rigidX']]=1
    return t

for name,part in rig['parts'].items():
    alpha=np.array(textures[name]['complete'])[:,:,3]
    y,x=np.where(alpha>128)
    points=np.stack([x+0.5,y+0.5],1)
    if len(part['nodes'])==1:
        points=hull(points)
        weights=np.ones((len(points),1))
    else:
        solid=alpha>128
        padded=np.pad(solid,1)
        interior=np.ones_like(solid)
        for dy in range(3):
            for dx in range(3):
                interior&=padded[dy:dy+512,dx:dx+512]
        y,x=np.where(solid&~interior)
        points=np.stack([x+0.5,y+0.5],1)
        vertices=np.array(part['vertices'],float)
        valid=np.clip(np.rint(vertices).astype(int),0,511)
        points=np.concatenate([points,vertices[solid[valid[:,1],valid[:,0]]]])
        weights=np.zeros((len(points),2))
        locals=np.zeros((len(points),2,2))
        assigned=np.zeros(len(points),bool)
        vertex_weights=np.array(part['weights'])
        for triangle in part['triangles']:
            uv=vertices[triangle]
            matrix=np.column_stack([uv[1]-uv[0],uv[2]-uv[0]])
            bary=(points-uv[0])@np.linalg.inv(matrix).T
            select=(bary[:,0]>=-1e-6)&(bary[:,1]>=-1e-6)&(bary.sum(1)<=1+1e-6)&~assigned
            if not select.any():
                continue
            full=np.column_stack([1-bary[select].sum(1),bary[select]])
            weights[select]=full@vertex_weights[triangle]
            for column,index in enumerate(part['nodes']):
                locals[select,column]=full@(vertex_weights[triangle,column,None]*(uv-bind[index]))
            assigned[select]=True
        colliders.append((part['nodes'],locals,weights))
        continue
    locals=np.stack([points-bind[index] for index in part['nodes']],1)*weights[:,:,None]
    colliders.append((part['nodes'],locals,weights))

def smooth(value):
    t=np.clip(value,0,1)
    return t*t*(3-2*t)

def solve_pin(state,link):
    a=link['parent']
    b=link['child']
    anchor=np.array(link['anchor'])
    ra=rotate(anchor-bind[a],state[a,2])
    rb=rotate(anchor-bind[b],state[b,2])
    ja=np.array([-ra[1],ra[0]])
    jb=np.array([-rb[1],rb[0]])
    error=state[a,:2]+ra-state[b,:2]-rb
    k=np.eye(2)*(inverse_mass[a]+inverse_mass[b])+inverse_inertia[a]*np.outer(ja,ja)+inverse_inertia[b]*np.outer(jb,jb)
    impulse=np.linalg.solve(k,-error)
    state[a,:2]+=impulse*inverse_mass[a]
    state[b,:2]-=impulse*inverse_mass[b]
    state[a,2]+=inverse_inertia[a]*np.dot(ja,impulse)
    state[b,2]-=inverse_inertia[b]*np.dot(jb,impulse)
    angle=state[b,2]-state[a,2]
    target=np.clip(angle,*link['angleLimits'])
    correction=(target-angle)/(inverse_inertia[a]+inverse_inertia[b])
    state[a,2]-=correction*inverse_inertia[a]
    state[b,2]+=correction*inverse_inertia[b]

def floor_contacts(state):
    touched=set()
    for indices,locals,weights in colliders:
        arms=[rotate(locals[:,column],state[index,2]) for column,index in enumerate(indices)]
        positions=sum(arms[column]+state[index,:2]*weights[:,column,None] for column,index in enumerate(indices))
        order=np.argsort(positions[:,1])[-1:]
        for row in order:
            depth=positions[row,1]-rig['ground']
            if depth<=0:
                continue
            effective=sum(weights[row,column]**2*inverse_mass[index]+arms[column][row,0]**2*inverse_inertia[index] for column,index in enumerate(indices))
            impulse=-depth/effective
            for column,index in enumerate(indices):
                w=weights[row,column]
                state[index,1]+=impulse*w*inverse_mass[index]
                state[index,2]+=impulse*arms[column][row,0]*inverse_inertia[index]
                if w>0.01:
                    touched.add(index)
    return touched

def simulate():
    state=np.column_stack([bind,np.zeros(len(bind))])
    state[:,1]-=12
    velocity=np.zeros_like(state)
    frames=[state.copy()]
    dt=1/250
    steps=round(rig['actionMs']/1000/dt)
    trace=[]
    for step in range(steps):
        time=step*dt
        previous=state.copy()
        lost=smooth((time-0.10)/0.26)
        velocity[:,1]+=rig['gravity']*lost*dt
        for link in rig['links']:
            a=link['parent']
            b=link['child']
            release=smooth((time-(0.17 if b==1 else 0.10))/0.3)
            stiffness=link['passiveStiffness']+link['activeStiffness']*(1-release)
            target=link['relaxedAngle']*release
            angle=state[b,2]-state[a,2]
            reduced_inertia=1/(inverse_inertia[a]+inverse_inertia[b])
            damping=1.6*math.sqrt(stiffness*reduced_inertia)
            torque=stiffness*math.sin(target-angle)-damping*(velocity[b,2]-velocity[a,2])
            velocity[a,2]-=torque*inverse_inertia[a]*dt
            velocity[b,2]+=torque*inverse_inertia[b]*dt
        velocity*=math.exp(-0.35*dt)
        state+=velocity*dt
        touched=set()
        for iteration in range(18):
            for link in rig['links']:
                solve_pin(state,link)
            touched.update(floor_contacts(state))
        velocity=(state-previous)/dt
        for index in touched:
            velocity[index,0]*=math.exp(-16*dt)
            velocity[index,2]*=math.exp(-9*dt)
        if (step+1)%round(rig['stepMs']/1000/dt)==0:
            frames.append(state.copy())
            trace.append({'ms':round((step+1)*dt*1000),'state':state.tolist(),'velocity':velocity.tolist(),'contactNodes':sorted(touched)})
    return frames,trace

def rigid(image,index,state):
    angle=state[index,2]
    c=math.cos(angle)
    s=math.sin(angle)
    matrix=np.array([[c,-s],[s,c]])
    translation=state[index,:2]-matrix@bind[index]
    inverse=matrix.T
    coefficients=np.column_stack([inverse,-inverse@translation]).reshape(-1)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(coefficients),Image.Resampling.BICUBIC)

def mesh(image,part,state):
    vertices=np.array(part['vertices'],float)
    weights=np.array(part['weights'],float)
    target=sum(world(vertices,index,state)*weights[:,column,None] for column,index in enumerate(part['nodes']))
    source=np.array(image,float)/255
    source[:,:,:3]*=source[:,:,3:4]
    output=np.zeros((512,512,4),float)
    for triangle in part['triangles']:
        uv=vertices[triangle]
        u0,v0=np.maximum(np.floor(uv.min(0)).astype(int)-1,0)
        u1,v1=np.minimum(np.ceil(uv.max(0)).astype(int)+2,512)
        if not source[v0:v1,u0:u1,3].any():
            continue
        dst=target[triangle]
        x0,y0=np.maximum(np.floor(dst.min(0)).astype(int),0)
        x1,y1=np.minimum(np.ceil(dst.max(0)).astype(int),512)
        if x1<=x0 or y1<=y0:
            continue
        matrix=np.column_stack([dst[1]-dst[0],dst[2]-dst[0]])
        if abs(np.linalg.det(matrix))<0.01:
            continue
        yy,xx=np.mgrid[y0:y1,x0:x1]
        coordinates=np.stack([xx+0.5,yy+0.5],-1)
        bary=(coordinates-dst[0])@np.linalg.inv(matrix).T
        inside=(bary[:,:,0]>=-1e-6)&(bary[:,:,1]>=-1e-6)&(bary.sum(2)<=1+1e-6)
        if not inside.any():
            continue
        sampled=uv[0]+bary[:,:,0,None]*(uv[1]-uv[0])+bary[:,:,1,None]*(uv[2]-uv[0])-0.5
        sx=np.clip(sampled[:,:,0],0,511)
        sy=np.clip(sampled[:,:,1],0,511)
        ix=np.floor(sx).astype(int)
        iy=np.floor(sy).astype(int)
        fx=(sx-ix)[:,:,None]
        fy=(sy-iy)[:,:,None]
        jx=np.minimum(ix+1,511)
        jy=np.minimum(iy+1,511)
        rgba=(source[iy,ix]*(1-fx)+source[iy,jx]*fx)*(1-fy)+(source[jy,ix]*(1-fx)+source[jy,jx]*fx)*fy
        region=output[y0:y1,x0:x1]
        selected=inside&(rgba[:,:,3]>0)
        region[selected]=rgba[selected]
    output[:,:,:3]/=np.maximum(output[:,:,3:4],1e-8)
    return Image.fromarray(np.uint8(np.clip(output*255+0.5,0,255)))

def render(state,time):
    result=Image.new('RGBA',(512,512))
    closed=time>=180
    for name in rig['drawOrder']:
        part=rig['parts'][name]
        texture=textures[name]['closed' if name=='head' and closed else 'complete']
        layer=rigid(texture,part['nodes'][0],state) if len(part['nodes'])==1 else mesh(texture,part,state)
        result.alpha_composite(layer)
    return result

if __name__=='__main__':
    states,trace=simulate()
    (root/'Frames').mkdir(0o777,True,True)
    images=[]
    for index,state in enumerate(states):
        image=render(state,index*rig['stepMs'])
        image.save(root/'Frames'/('frame-'+str(index)+'.png'))
        images.append(image)
    durations=[rig['stepMs']]*(len(images)-1)+[rig['holdMs']]
    columns=8
    sheet=Image.new('RGBA',(512*columns,512*math.ceil(len(images)/columns)))
    for index,image in enumerate(images):
        sheet.alpha_composite(image,(index%columns*512,index//columns*512))
    sheet.save(root/'death.webp', **{'lossless':True,'method':4})
    images[0].save(root/'preview.webp', **{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
    small=[image.resize((64,64),Image.Resampling.LANCZOS) for image in images]
    small[0].save(root/'thumbnail.webp', **{'save_all':True,'append_images':small[1:],'duration':durations,'loop':0,'lossless':True,'method':4})
    images[-1].save(root/'final.png')
    contact=Image.new('RGBA',(1536,1024),(38,53,49,255))
    for slot,index in enumerate([0,6,12,20,35,len(states)-1]):
        contact.alpha_composite(images[index],(slot%3*512,slot//3*512))
    contact.save(root/'contact.png')
    prefix='DesignAssets/Animations/CreatureDeathV5/talon-owl/'
    metadata={'sourceImage':'DesignAssets/CreatureConcepts/v3/talon-owl.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(images),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'sourceCanvasPlacement':rig['sourceCanvasPlacement'],'rig':prefix+'rig.json','renderer':prefix+'render.py','prepare':prefix+'prepare.py','sourceRegistration':prefix+'Source/authoring-registration.json'}
    for name,value in [['death.json',metadata],['Source/motion.json',trace]]:
        (root/name).write_bytes(json.dumps(value, **{'indent':2}).replace('\n','\r\n').encode('utf-8'))
    print('rendered',len(images),sum(durations),'ms')
