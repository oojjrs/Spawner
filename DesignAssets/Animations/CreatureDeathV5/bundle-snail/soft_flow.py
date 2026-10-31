import math
import numpy as np

def ease(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)

def sample_curve(points):
    points=np.asarray(points,float)
    result=[]
    extended=np.vstack([points[0],points,points[-1]])
    for segment in range(len(points)-1):
        a,b,c,d=extended[segment:segment+4]
        for u in np.arange(0,1,1/20):
            result.append(.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u))
    result.append(points[-1])
    return np.asarray(result)

def projection(points,curve):
    points=np.asarray(points,float)
    delta=np.diff(curve,1,0)
    relative=points[:,None,:]-curve[:-1]
    u=np.clip(np.einsum('nsi,si->ns',relative,delta)/np.sum(delta*delta,1),0,1)
    closest=curve[:-1]+u[:,:,None]*delta
    distances=np.sum((points[:,None,:]-closest)**2,2)
    index=np.argmin(distances,1)
    along=u[np.arange(len(points)),index]
    center=closest[np.arange(len(points)),index]
    return index,along,points-center

def controls(time,source,settings):
    output=[]
    for point,definition in zip(source,settings['waves']):
        progress=ease((time-definition['start'])/(definition['end']-definition['start']))
        a,b,c,d=point,np.asarray(definition['control1']),np.asarray(definition['control2']),np.asarray(definition['inside'])
        output.append((1-progress)**3*a+3*(1-progress)**2*progress*b+3*(1-progress)*progress**2*c+progress**3*d)
    return np.asarray(output)

def deform(parameters,source_curve,target_curve,time,settings):
    index,u,offset=parameters
    a=source_curve[index+1]-source_curve[index]
    b=target_curve[index+1]-target_curve[index]
    angle=np.arctan2(b[:,1],b[:,0])-np.arctan2(a[:,1],a[:,0])
    c,s=np.cos(angle),np.sin(angle)
    progress=(index+u)/(len(source_curve)-1)
    head=1-ease((progress-.12)/.25)
    compression=1-settings['headCompression']*ease((time-settings['compressInterval'][0])/(settings['compressInterval'][1]-settings['compressInterval'][0]))*head
    rotated=np.c_[c*offset[:,0]-s*offset[:,1],s*offset[:,0]+c*offset[:,1]]*compression[:,None]
    return target_curve[index]+(target_curve[index+1]-target_curve[index])*u[:,None]+rotated

def simulate_support(source_axis,source_curve,cloud_parameters,front_alpha,settings):
    ground=settings['ground']
    position=0
    speed=0
    initial=None
    records=[]
    for time in np.arange(0,settings['durationMs']+2,1000/240):
        curve=sample_curve(controls(time,source_axis,settings))
        points=deform(cloud_parameters,source_curve,curve,time,settings)
        x=np.clip(np.rint(points[:,0]).astype(int),0,511)
        y=np.clip(np.rint(points[:,1]).astype(int),0,511)
        contact=(points[:,1]+position>=ground-5)&(points[:,0]>settings['supportRange'][0])&(points[:,0]<settings['supportRange'][1])&(front_alpha[y,x]<128)
        area=int(contact.sum())
        if initial is None: initial=max(1,area)
        fraction=min(1,area/initial)
        force=settings['mass']*settings['gravity']-fraction*(settings['mass']*settings['gravity']+settings['supportSpring']*position+settings['supportDamping']*speed)
        dt=1/240
        speed+=force/settings['mass']*dt
        speed*=math.exp(-settings['airDamping']*dt)
        position+=speed*dt
        floor=False
        if position>settings['maximumDrop']:
            floor=True
            position=settings['maximumDrop']
            speed=-speed*settings['restitution'] if speed>20 else 0
        if position<0:
            position=0
            speed=max(0,speed)
        records.append({'timeMs':float(time),'translationY':float(position),'velocityY':float(speed),'softContactSamples':area,'supportFraction':float(fraction),'floorContact':floor})
    return records

def shell_at(time,trace):
    index=min(len(trace)-2,max(0,int(time*240/1000)))
    left,right=trace[index:index+2]
    u=max(0,min(1,(time-left['timeMs'])/(right['timeMs']-left['timeMs'])))
    return left['translationY']*(1-u)+right['translationY']*u
