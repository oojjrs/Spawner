import math
import numpy as np
from engine import leg_matrices,scalar

def rot(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def smooth(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def matrix(center,bind,angle):
    result=np.eye(3)
    result[:2,:2]=rot(angle)
    result[:2,2]=center-result[:2,:2]@bind
    return result

def boundary(image):
    alpha=np.asarray(image)[:,:,3]
    points=[]
    for x in range(0,512,5):
        y=np.flatnonzero(alpha[:,x]>128)
        if len(y): points.extend([[x,float(y[0])],[x,float(y[-1])]])
    for y in range(0,512,5):
        x=np.flatnonzero(alpha[y]>128)
        if len(x): points.extend([[float(x[0]),y],[float(x[-1]),y]])
    return np.asarray(points)

def simulate(images,config,settings,channels):
    names=['body','head-closed']
    centers=[]
    inverse=[]
    outlines=[]
    masses=settings['masses']
    for index,name in enumerate(names):
        pixels=np.argwhere(np.asarray(images[name])[:,:,3]>128)[:,::-1]
        center=np.asarray(settings['centers'][index],float) if 'centers' in settings else pixels.mean(0)
        inertia=masses[index]*np.mean(np.sum((pixels-center)**2,1))
        centers.append(center)
        inverse.extend([1/masses[index],1/masses[index],1/inertia])
        outlines.append(boundary(images[name])-center)
    inverse=np.asarray(inverse)
    q=np.r_[centers[0],0,centers[1],0].astype(float)
    velocity=np.zeros(6)
    neck=np.asarray(config['headPivot'],float)
    neck_offsets=[neck-center for center in centers]
    legs=config['legs']
    hips={name:np.asarray(points[0],float) for name,points in legs.items()}
    total=sum(masses)
    if 'supportLoads' in settings:
        loads={name:total*value/sum(settings['supportLoads'].values()) for name,value in settings['supportLoads'].items()}
    else:
        fore=[name for name in legs if 'hind' not in name]
        rear=[name for name in legs if 'hind' in name]
        com=(centers[0][0]*masses[0]+centers[1][0]*masses[1])/total
        fore_x=np.mean([hips[name][0] for name in fore])
        rear_x=np.mean([hips[name][0] for name in rear])
        fore_mass=total*(rear_x-com)/(rear_x-fore_x)
        loads={name:(fore_mass/len(fore) if name in fore else (total-fore_mass)/len(rear)) for name in legs}
    limb_outlines={name:boundary(images[name+'-upper']) for name in settings['limbColliders']}
    times=np.arange(0,settings['durationMs']+1000/240/2,1000/240)
    records=[]
    for index,time in enumerate(times):
        dt=1/240
        forces=np.zeros(6)
        gravity=settings['gravity']
        forces[1]=masses[0]*gravity
        forces[4]=masses[1]*gravity
        strengths={}
        body_rotation=rot(q[2])
        for name,hip in hips.items():
            start,end=settings['supportIntervals'][name]
            strength=1-smooth((time-start)/(end-start))
            strengths[name]=strength
            arm=body_rotation@(hip-centers[0])
            world=q[:2]+arm
            speed=velocity[1]+velocity[2]*arm[0]
            upward=strength*max(0,loads[name]*gravity+settings['supportStiffness']*(world[1]-hip[1])+settings['supportDamping']*speed)
            forces[1]-=upward
            forces[2]-=arm[0]*upward
        start,end=settings['neckInterval']
        neck_strength=1-smooth((time-start)/(end-start))
        difference=(q[5]-q[2]+math.pi)%(2*math.pi)-math.pi
        inertia=1/inverse[5]
        tonic=masses[1]*gravity*(neck[0]-centers[1][0])
        torque=neck_strength*(tonic-inertia*settings['neckStiffness']*difference-inertia*settings['neckDamping']*(velocity[5]-velocity[2]))
        forces[5]+=torque
        forces[2]-=torque
        previous=q.copy()
        if time>=settings['releaseMs']:
            velocity+=forces*inverse*dt
            velocity*=math.exp(-settings['airDamping']*dt)
            q+=velocity*dt
        contacts=[False,False]
        corrections=np.zeros(2)
        limb_contacts={name:False for name in limb_outlines}
        for iteration in range(10):
            arms=[rot(q[2])@neck_offsets[0],rot(q[5])@neck_offsets[1]]
            for axis in range(2):
                error=q[axis]+arms[0][axis]-q[axis+3]-arms[1][axis]
                gradient=np.zeros(6)
                gradient[axis]=1
                gradient[axis+3]=-1
                gradient[2]=(-arms[0][1] if axis==0 else arms[0][0])
                gradient[5]=(arms[1][1] if axis==0 else -arms[1][0])
                multiplier=-error/np.sum(inverse*gradient**2)
                q+=inverse*gradient*multiplier
            difference=(q[5]-q[2]+math.pi)%(2*math.pi)-math.pi
            limited=max(math.radians(settings['neckLimits'][0]),min(math.radians(settings['neckLimits'][1]),difference))
            if limited!=difference:
                multiplier=-(difference-limited)/(inverse[2]+inverse[5])
                q[2]-=inverse[2]*multiplier
                q[5]+=inverse[5]*multiplier
            for part in range(2):
                offset=part*3
                points=outlines[part]@rot(q[offset+2]).T
                penetration=points[:,1]+q[offset+1]-settings['groundPlanes'][part]
                point=int(np.argmax(penetration))
                depth=float(penetration[point])
                if depth>0:
                    contacts[part]=True
                    gradient=points[point,0]
                    multiplier=-depth/(inverse[offset+1]+gradient*gradient*inverse[offset+2])
                    q[offset+1]+=inverse[offset+1]*multiplier
                    q[offset+2]+=inverse[offset+2]*gradient*multiplier
                    corrections[part]+=abs(multiplier)
            for name,outline in limb_outlines.items():
                target=[scalar(time,channels[name+'-targetX']),scalar(time,channels[name+'-targetY'])]
                def surface(current):
                    transform=matrix(current[:2],centers[0],current[2])
                    bones,_=leg_matrices(legs[name],transform,1,target)
                    return (bones[0]@np.c_[outline,np.ones(len(outline))].T).T[:,:2]
                points=surface(q)
                point=int(np.argmax(points[:,1]))
                depth=points[point,1]-settings['limbGround']
                if depth>0:
                    limb_contacts[name]=True
                    gradient=[]
                    for axis,epsilon in enumerate([.1,.1,.001]):
                        trial=q.copy()
                        trial[axis]+=epsilon
                        gradient.append((surface(trial)[point,1]-points[point,1])/epsilon)
                    gradient=np.asarray(gradient)
                    denominator=np.sum(inverse[:3]*gradient**2)
                    if denominator>1e-9:
                        multiplier=-depth/denominator
                        correction=inverse[:3]*gradient*multiplier
                        size=max(1,abs(correction[0])/4,abs(correction[1])/4,abs(correction[2])/.05)
                        q[:3]+=correction/size
        velocity=(q-previous)/dt
        for part in range(2):
            if contacts[part]:
                velocity[part*3]*=math.exp(-settings['friction']*dt)
                velocity[part*3+2]*=math.exp(-settings['friction']*dt)
        body=matrix(q[:2],centers[0],q[2])
        head=matrix(q[3:5],centers[1],q[5])
        neck_error=np.linalg.norm((body@np.r_[neck,1])[:2]-(head@np.r_[neck,1])[:2])
        records.append({'timeMs':float(time),'q':q.tolist(),'velocity':velocity.tolist(),'body':body.tolist(),'head':head.tolist(),'supports':strengths,'contacts':contacts,'limbContacts':limb_contacts,'normalImpulse':(corrections/dt).tolist(),'neckErrorPx':float(neck_error)})
    return records

def at_time(time,records):
    index=min(len(records)-2,max(0,int(time*240/1000)))
    left,right=records[index:index+2]
    u=max(0,min(1,(time-left['timeMs'])/(right['timeMs']-left['timeMs'])))
    q=np.asarray(left['q'])*(1-u)+np.asarray(right['q'])*u
    first=np.asarray(left['body'])
    second=np.asarray(left['head'])
    body_center=first[:2,:2].T@(np.asarray(left['q'][:2])-first[:2,2])
    head_center=second[:2,:2].T@(np.asarray(left['q'][3:5])-second[:2,2])
    body=matrix(q[:2],body_center,q[2])
    head=matrix(q[3:5],head_center,q[5])
    return body,head
