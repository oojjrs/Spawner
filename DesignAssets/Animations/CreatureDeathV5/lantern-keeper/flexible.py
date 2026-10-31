import math
import numpy as np
from engine import ease,rotation,translation

def wrapped(value):
    return (value+math.pi)%(2*math.pi)-math.pi

def binding(points,joints):
    points=np.asarray(points,float)
    delta=np.diff(joints,1,0)
    lengths=np.linalg.norm(delta,None,1)
    cumulative=np.r_[0,np.cumsum(lengths)]
    raw=points[:,None,:]-joints[None,:-1,:]
    fractions=np.clip(np.sum(raw*delta[None,:,:],2)/lengths[None,:]**2,0,1)
    nearest=joints[None,:-1,:]+fractions[:,:,None]*delta[None,:,:]
    indices=np.argmin(np.sum((points[:,None,:]-nearest)**2,2),1)
    progress=cumulative[indices]+fractions[np.arange(len(points)),indices]*lengths[indices]
    weights=np.zeros((len(points),len(joints)))
    pivots=np.zeros((len(points),2))
    for index,distance in enumerate(progress):
        section=int(np.searchsorted(cumulative[1:-1],distance))
        weights[index,section+1]=1
        pivots[index]=joints[section]
        root_extent=min(65,lengths[0]*.95)
        if distance<root_extent:
            weights[index]=0
            amount=ease((distance-7)/max(1,root_extent-7))
            weights[index,0]=1-amount
            weights[index,1]=amount
            pivots[index]=joints[0]
        else:
            for joint in range(1,len(joints)-1):
                extent=min(20,lengths[joint-1]*.45,lengths[joint]*.45)
                if abs(distance-cumulative[joint])<extent:
                    u=ease((distance-cumulative[joint]+extent)/(2*extent))
                    weights[index]=0
                    weights[index,joint]=1-u
                    weights[index,joint+1]=u
                    pivots[index]=joints[joint]
                    break
    return weights,pivots

def skin(points,weights,pivots,bones):
    points=np.asarray(points,float)
    bones=np.asarray(bones,float)
    targets=np.einsum('bij,vj->bvi',bones,np.c_[pivots,np.ones(len(pivots))])[:,:,:2]
    centers=np.einsum('vb,bvi->vi',weights,targets)
    c=weights@bones[:,0,0]
    s=weights@bones[:,1,0]
    denominator=np.maximum(1e-8,np.sqrt(c*c+s*s))
    c,s=c/denominator,s/denominator
    delta=points-pivots
    return centers+np.c_[c*delta[:,0]-s*delta[:,1],s*delta[:,0]+c*delta[:,1]]

def matrices(joints,particles,parent):
    bones=[parent]
    for index in range(len(joints)-1):
        source=joints[index+1]-joints[index]
        target=particles[index+1]-particles[index]
        angle=math.degrees(math.atan2(target[1],target[0])-math.atan2(source[1],source[0]))
        bones.append(translation(*particles[index])@rotation([0,0],angle)@translation(*(-joints[index])))
    return bones

def mesh(image,source_joints):
    joints=np.asarray(source_joints,float)
    bounds=image.getchannel('A').getbbox()
    xs=list(range(max(0,bounds[0]-8),min(512,bounds[2]+16),8))
    ys=list(range(max(0,bounds[1]-8),min(512,bounds[3]+16),8))
    points=np.asarray([[x,y] for y in ys for x in xs],float)
    weights,pivots=binding(points,joints)
    alpha=np.asarray(image)[:,:,3]
    triangles=[]
    for row in range(len(ys)-1):
        for col in range(len(xs)-1):
            if np.any(alpha[ys[row]:ys[row+1]+1,xs[col]:xs[col+1]+1]):
                n=row*len(xs)+col
                triangles.extend([[n,n+1,n+len(xs)],[n+1,n+len(xs)+1,n+len(xs)]])
    return {'vertices':points.tolist(),'weights':weights.tolist(),'blendPivots':pivots.tolist(),'triangles':triangles,'joints':joints.tolist(),'method':'joint-centered normalized rotation skinning'}

def boundary(image):
    alpha=np.asarray(image)[:,:,3]
    points=[]
    for x in range(0,512,5):
        ys=np.flatnonzero(alpha[:,x]>128)
        if len(ys):points.extend([[x,ys[0]],[x,ys[-1]]])
    for y in range(0,512,5):
        xs=np.flatnonzero(alpha[y]>128)
        if len(xs):points.extend([[xs[0],y],[xs[-1],y]])
    return np.asarray(points,float)

def solve(times,source_joints,parent_at,image,settings,obstacles_at):
    joints=np.asarray(source_joints,float)
    count=len(joints)
    lengths=np.linalg.norm(np.diff(joints,1,0),None,1)
    source_angles=np.arctan2(np.diff(joints,1,0)[:,1],np.diff(joints,1,0)[:,0])
    bends=np.diff(source_angles)
    surface=boundary(image)
    weights,pivots=binding(surface,joints)
    parent=parent_at(0)
    particles=(parent@np.c_[joints,np.ones(count)].T).T[:,:2]
    previous=particles.copy()
    now=0
    samples={}
    for time in times:
        touched=False
        while now<time:
            end=min(time,now+1000/240)
            dt=(end-now)/1000
            parent=parent_at(end)
            rest=(parent@np.c_[joints,np.ones(count)].T).T[:,:2]
            weak=ease((end-settings['release'][0])/(settings['release'][1]-settings['release'][0]))
            old=particles.copy()
            velocity=(particles-previous)*math.exp(-settings['damping']*dt)
            particles+=velocity+(np.array([0,settings['gravity']*weak])+(rest-particles)*(settings['stiffness']*(1-weak)+settings['slack']*weak))*dt*dt
            step_contact=False
            for iteration in range(12):
                particles[0]=rest[0]
                for segment,length in enumerate(lengths):
                    delta=particles[segment+1]-particles[segment]
                    correction=delta*(np.linalg.norm(delta)-length)/max(1e-8,np.linalg.norm(delta))
                    if segment==0:particles[1]-=correction
                    else:
                        particles[segment]+=correction*.5
                        particles[segment+1]-=correction*.5
                parent_angle=math.atan2(parent[1,0],parent[0,0])
                for segment in range(count-1):
                    delta=particles[segment+1]-particles[segment]
                    angle=math.atan2(delta[1],delta[0])
                    if segment==0:
                        reference=parent_angle+source_angles[0]
                        limit=math.radians(settings['rootLimit'])
                    else:
                        previous_delta=particles[segment]-particles[segment-1]
                        reference=math.atan2(previous_delta[1],previous_delta[0])+bends[segment-1]
                        limits=settings.get('bendLimits',[settings['bendLimit']]*(count-2))
                        limit=math.radians(limits[segment-1])
                    difference=wrapped(angle-reference)
                    if abs(difference)>limit:
                        angle=reference+max(-limit,min(limit,difference))
                        particles[segment+1]=particles[segment]+lengths[segment]*np.array([math.cos(angle),math.sin(angle)])
                for node in range(1,count):
                    for transform,center,radii in obstacles_at(end):
                        local=(np.linalg.inv(transform)@np.r_[particles[node],1])[:2]
                        difference=local-center
                        extent=radii+settings['collisionRadii'][node-1]
                        level=np.linalg.norm(difference/extent)
                        if 0<level<1:particles[node]=(transform@np.r_[center+difference/level,1])[:2]
                bones=matrices(joints,particles,parent)
                positions=skin(surface,weights,pivots,bones)
                active=int(np.argmax(positions[:,1]))
                depth=positions[active,1]-settings['ground']
                if depth>0:
                    touched=True
                    step_contact=True
                    gradient=np.zeros((count-1,2))
                    for node in range(count-1):
                        for axis in range(2):
                            trial=particles.copy()
                            trial[node+1,axis]+=.05
                            posed=skin(surface,weights,pivots,matrices(joints,trial,parent))
                            gradient[node,axis]=(posed[active,1]-positions[active,1])/.05
                    denominator=np.sum(gradient**2)
                    if denominator>1e-8:
                        correction=-depth*gradient/denominator
                        correction/=max(1,np.max(np.abs(correction))/3)
                        particles[1:]+=correction
            particles[0]=rest[0]
            retention=settings.get('contactVelocityRetention',math.exp(-settings['friction']*dt))
            previous=particles-(particles-old)*retention if step_contact else old
            now=end
        parent=parent_at(time)
        bones=matrices(joints,particles,parent)
        positions=skin(surface,weights,pivots,bones)
        samples[time]={'matrices':bones,'particles':particles.copy(),'materialBottom':float(positions[:,1].max()),'floorContact':touched,'anchorErrorPx':float(np.linalg.norm(particles[0]-(parent@np.r_[joints[0],1])[:2]))}
    return samples
