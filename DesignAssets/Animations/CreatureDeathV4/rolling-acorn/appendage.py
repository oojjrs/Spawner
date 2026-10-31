import math
import numpy as np

def ease(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def transform(source,target,angle):
    c,s=math.cos(angle),math.sin(angle)
    result=np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
    result[:2,2]=target-result[:2,:2]@source
    return result

def matrices(joints,particles,parent):
    result=[parent]
    for index in range(2):
        source=joints[index+1]-joints[index]
        posed=particles[index+1]-particles[index]
        angle=math.atan2(posed[1],posed[0])-math.atan2(source[1],source[0])
        result.append(transform(joints[index],particles[index],angle))
    return result

def material(image,joints):
    alpha=np.asarray(image)[:,:,3]
    points=[]
    for x in range(0,512,5):
        ys=np.flatnonzero(alpha[:,x]>128)
        if len(ys): points.extend([[x,ys[0]],[x,ys[-1]]])
    for y in range(0,512,5):
        xs=np.flatnonzero(alpha[y]>128)
        if len(xs): points.extend([[xs[0],y],[xs[-1],y]])
    points=np.asarray(points,float)
    weights=[]
    extent=np.linalg.norm(joints[1]-joints[0])
    for point in points:
        distance=np.linalg.norm(point-joints[0])
        a=ease((distance-5)/20)
        b=ease((distance-extent+10)/20)
        weights.append([1-a,a*(1-b),a*b])
    return np.c_[points,np.ones(len(points))],np.asarray(weights)

def solve(times,source_joints,parent_at,image,settings):
    joints=np.asarray(source_joints,float)
    parent=parent_at(0)
    particles=(parent@np.c_[joints,np.ones(3)].T).T[:,:2]
    previous=particles.copy()
    lengths=np.linalg.norm(np.diff(joints,1,0),None,1)
    source,weights=material(image,joints)
    bind_delta=np.diff(joints,1,0)
    bind_bend=math.atan2(bind_delta[1,1],bind_delta[1,0])-math.atan2(bind_delta[0,1],bind_delta[0,0])
    now=0
    samples={}
    for time in times:
        touched=False
        while now<time:
            end=min(time,now+1000/240)
            dt=(end-now)/1000
            parent=parent_at(end)
            rest=(parent@np.c_[joints,np.ones(3)].T).T[:,:2]
            weak=ease((end-settings['release'][0])/(settings['release'][1]-settings['release'][0]))
            velocity=(particles-previous)*math.exp(-settings['damping']*dt)
            old=particles.copy()
            particles+=velocity+(np.array([0,settings['gravity']*weak])+(rest-particles)*(settings['stiffness']*(1-weak)+settings['slack']*weak))*dt*dt
            for iteration in range(8):
                particles[0]=rest[0]
                for segment,length in enumerate(lengths):
                    delta=particles[segment+1]-particles[segment]
                    correction=delta*(np.linalg.norm(delta)-length)/max(1e-8,np.linalg.norm(delta))
                    if segment==0:
                        particles[1]-=correction
                    else:
                        particles[1]+=correction*.5
                        particles[2]-=correction*.5
                first,second=np.diff(particles,1,0)
                bend=(math.atan2(second[1],second[0])-math.atan2(first[1],first[0])-bind_bend+math.pi)%(2*math.pi)-math.pi
                limit=math.radians(settings['bendLimit'])
                if abs(bend)>limit:
                    angle=math.atan2(first[1],first[0])+bind_bend+max(-limit,min(limit,bend))
                    particles[2]=particles[1]+lengths[1]*np.array([math.cos(angle),math.sin(angle)])
                def skin(current):
                    bones=np.asarray(matrices(joints,current,parent))
                    posed=np.einsum('bij,vj->bvi',bones,source)[:,:,:2]
                    return np.einsum('vb,bvi->vi',weights,posed)
                surface=skin(particles)
                active=int(np.argmax(surface[:,1]))
                depth=surface[active,1]-settings['ground']
                if depth>0:
                    touched=True
                    gradient=np.zeros((2,2))
                    for node in range(2):
                        for axis in range(2):
                            trial=particles.copy()
                            trial[node+1,axis]+=.05
                            gradient[node,axis]=(skin(trial)[active,1]-surface[active,1])/.05
                    denominator=np.sum(gradient**2)
                    if denominator>1e-8:
                        correction=-depth*gradient/denominator
                        correction/=max(1,np.max(np.abs(correction))/3)
                        particles[1:]+=correction
            if touched:
                previous=particles-(particles-old)*math.exp(-settings['friction']*dt)
            else:
                previous=old
            now=end
        parent=parent_at(time)
        bones=matrices(joints,particles,parent)
        posed=np.einsum('bij,vj->bvi',np.asarray(bones),source)[:,:,:2]
        surface=np.einsum('vb,bvi->vi',weights,posed)
        samples[time]={'matrices':bones,'particles':particles.copy(),'floorContact':touched,'materialBottom':float(surface[:,1].max())}
    return samples
