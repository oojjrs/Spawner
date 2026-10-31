import math
import numpy as np

def matrix(q,center):
    c,s=math.cos(q[2]),math.sin(q[2])
    result=np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
    result[:2,2]=q[:2]-result[:2,:2]@center
    return result

def simulate(image,settings):
    alpha=np.asarray(image)[:,:,3]
    center=np.asarray(settings['center'],float)
    points=[]
    for x in range(0,512,2):
        ys=np.flatnonzero(alpha[:,x]>128)
        if len(ys): points.extend([[x,ys[0]],[x,ys[-1]]])
    for y in range(0,512,2):
        xs=np.flatnonzero(alpha[y]>128)
        if len(xs): points.extend([[xs[0],y],[xs[-1],y]])
    points=np.asarray(points,float)
    pixels=np.argwhere(alpha>128)[:,::-1]
    inertia=settings['mass']*np.mean(np.sum((pixels-center)**2,1))
    inverse=np.array([1/settings['mass'],1/settings['mass'],1/inertia])
    q=np.r_[center,0]
    velocity=np.zeros(3)
    trace=[]
    for time in np.arange(0,settings['durationMs']+2,1000/240):
        dt=1/240
        before=q.copy()
        if time>=settings['releaseMs']:
            velocity[1]+=settings['gravity']*dt
            velocity*=math.exp(-settings['airDamping']*dt)
            q+=velocity*dt
        impulse=0
        arm=np.zeros(2)
        for iteration in range(8):
            transform=matrix(q,center)
            surface=(transform@np.c_[points,np.ones(len(points))].T).T[:,:2]
            active=int(np.argmax(surface[:,1]))
            depth=surface[active,1]-settings['ground']
            if depth>0:
                arm=surface[active]-q[:2]
                gradient=np.array([0,1,arm[0]])
                multiplier=-depth/np.sum(inverse*gradient**2)
                q+=inverse*gradient*multiplier
                impulse+=abs(multiplier)/dt
        velocity=(q-before)/dt
        if impulse>0:
            normal_speed=velocity[1]+velocity[2]*arm[0]
            if normal_speed>0:
                normal=-normal_speed/(inverse[1]+arm[0]*arm[0]*inverse[2])
                velocity[1]+=inverse[1]*normal
                velocity[2]+=inverse[2]*arm[0]*normal
            slip=velocity[0]-velocity[2]*arm[1]
            tangent=-slip/(inverse[0]+arm[1]*arm[1]*inverse[2])
            tangent=max(-settings['friction']*impulse,min(settings['friction']*impulse,tangent))
            velocity[0]+=inverse[0]*tangent
            velocity[2]-=inverse[2]*arm[1]*tangent
            resistance=settings['rollingFrictionArm']*impulse*inverse[2]
            velocity[2]=math.copysign(max(0,abs(velocity[2])-resistance),velocity[2])
        trace.append({'timeMs':float(time),'q':q.tolist(),'velocity':velocity.tolist(),'matrix':matrix(q,center).tolist(),'normalImpulse':float(impulse),'contact':bool(impulse>0)})
    return trace

def at_time(time,trace,center):
    index=min(len(trace)-2,max(0,int(time*240/1000)))
    left,right=trace[index:index+2]
    u=max(0,min(1,(time-left['timeMs'])/(right['timeMs']-left['timeMs'])))
    q=np.asarray(left['q'])*(1-u)+np.asarray(right['q'])*u
    return matrix(q,np.asarray(center,float))
