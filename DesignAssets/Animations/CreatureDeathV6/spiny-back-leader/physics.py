import math
import numpy as np

def wrap(value):
    return (value+math.pi)%(2*math.pi)-math.pi

def rotation(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def smooth(time,interval):
    value=np.clip((time-interval[0])/(interval[1]-interval[0]),0,1)
    return float(value*value*(3-2*value))

def boundary(image):
    alpha=np.array(image)[:,:,3]
    points=[]
    for x in range(image.width):
        ys=np.where(alpha[:,x]>128)[0]
        if len(ys):points.extend([[x,int(ys[0])],[x,int(ys[-1])]])
    return np.array(points,float)

def simulate(images,rig):
    names=['body']
    centers=[np.array(rig['bodyMassCenter'],float)]
    masses=[6.0]
    for leg in rig['legs']:
        joints=np.array(leg['joints'],float)
        for index,name in enumerate(leg['parts']):
            names.append(name)
            centers.append((joints[index]+joints[index+1])/2)
            masses.append(.24 if index==0 else .16)
    for jaw in rig['jaws']:
        name=jaw['id'];names.append(name)
        yy,xx=np.where(np.array(images[name])[:,:,3]>128)
        centers.append(np.array([xx.mean(),yy.mean()]))
        masses.append(.34)
    index={name:i for i,name in enumerate(names)}
    centers=np.array(centers)
    masses=np.array(masses)
    inverse_mass=1/masses
    inverse_inertia=[]
    hulls=[]
    floors=[]
    for i,name in enumerate(names):
        yy,xx=np.where(np.array(images[name])[:,:,3]>128)
        inertia=masses[i]*np.mean((xx-centers[i,0])**2+(yy-centers[i,1])**2)
        inverse_inertia.append(1/max(inertia,1))
        hulls.append(boundary(images[name])-centers[i])
        floors.append(rig['groundY'])
    pins=[];legs=[];jaws=[]
    for leg in rig['legs']:
        upper,lower=[index[name] for name in leg['parts']]
        points=np.array(leg['joints'],float)
        pins.append((0,upper,points[0]-centers[0],points[0]-centers[upper]))
        pins.append((upper,lower,points[1]-centers[upper],points[1]-centers[lower]))
        u=points[1]-points[0];v=points[2]-points[1]
        bind=wrap(math.atan2(v[1],v[0])-math.atan2(u[1],u[0]))
        sign=1 if bind>=0 else-1
        full=boundary(images[leg['parts'][1]])
        fraction=(full-points[1])@v/np.dot(v,v)
        foot=full[fraction>=.75]
        floor=float(foot[:,1].max())
        floors[upper]=floors[lower]=floor
        legs.append((upper,lower,bind,sign,-1 if 'near' in leg['id'] else 1,rig['supportFailureMs'][leg['id'].split('-')[0]]))
    for jaw in rig['jaws']:
        child=index[jaw['id']];pivot=np.array(jaw['pivot'],float)
        pins.append((0,child,pivot-centers[0],pivot-centers[child]))
        jaws.append(child)
    inverse_inertia=np.array(inverse_inertia)
    floors=np.array(floors)
    q=np.column_stack([centers,np.zeros(len(names))])
    velocity=np.zeros_like(q)
    history=[q.copy()]
    dt=1/240

    def angular(a,b,target,stiffness):
        error=wrap(q[b,2]-q[a,2]-target)
        change=stiffness*error/(inverse_inertia[a]+inverse_inertia[b])
        q[a,2]+=inverse_inertia[a]*change
        q[b,2]-=inverse_inertia[b]*change

    def pin(a,b,local_a,local_b):
        ra=rotation(q[a,2])@local_a;rb=rotation(q[b,2])@local_b
        error=q[b,:2]+rb-q[a,:2]-ra
        wa,wb=inverse_mass[a],inverse_mass[b]
        ia,ib=inverse_inertia[a],inverse_inertia[b]
        aa=wa+wb+ia*ra[1]**2+ib*rb[1]**2
        bb=-ia*ra[0]*ra[1]-ib*rb[0]*rb[1]
        dd=wa+wb+ia*ra[0]**2+ib*rb[0]**2
        determinant=aa*dd-bb*bb
        correction=np.array([(dd*error[0]-bb*error[1])/determinant,(-bb*error[0]+aa*error[1])/determinant])
        q[a,:2]+=wa*correction;q[b,:2]-=wb*correction
        q[a,2]+=ia*(ra[0]*correction[1]-ra[1]*correction[0])
        q[b,2]-=ib*(rb[0]*correction[1]-rb[1]*correction[0])

    steps=round(rig['durationActiveMs']/1000/dt)
    for step in range(1,steps+1):
        time=step*dt*1000
        old=q.copy()
        velocity[:,1]+=rig['gravity']*dt
        q+=velocity*dt
        touching=np.zeros(len(names),bool)
        for iteration in range(rig['jointIterations']):
            for upper,lower,bind,sign,side,interval in legs:
                failure=smooth(time,interval)
                angular(0,upper,side*math.radians(55)*failure,.5*(1-failure)+.012*failure)
                angular(upper,lower,(sign*math.radians(150)-bind)*failure,.55*(1-failure)+.035*failure)
                value=wrap(q[upper,2]-q[0,2])
                clipped=float(np.clip(value,-math.radians(95),math.radians(95)))
                if value!=clipped:angular(0,upper,clipped,1)
                value=sign*wrap(q[lower,2]-q[upper,2]+bind)
                clipped=float(np.clip(value,math.radians(5),math.radians(170)))
                if value!=clipped:angular(upper,lower,sign*clipped-bind,1)
            for child in jaws:
                failure=smooth(time,[70,190])
                angular(0,child,0,.3*(1-failure)+.001*failure)
                value=wrap(q[child,2]-q[0,2]);clipped=float(np.clip(value,-.5,.5))
                if value!=clipped:angular(0,child,clipped,1)
            for item in pins:pin(*item)
            for i,local in enumerate(hulls):
                rotated=local@rotation(q[i,2]).T
                values=rotated[:,1]+q[i,1]-floors[i]
                selected=int(np.argmax(values));penetration=float(values[selected])
                if penetration>0:
                    lever=rotated[selected,0]
                    impulse=-penetration/(inverse_mass[i]+inverse_inertia[i]*lever*lever)
                    q[i,1]+=inverse_mass[i]*impulse
                    q[i,2]+=inverse_inertia[i]*lever*impulse
                    touching[i]=True
        velocity=(q-old)/dt
        velocity[:,:2]*=math.exp(-.5*dt)
        velocity[:,2]*=math.exp(-2*dt)
        velocity[:,2]=np.clip(velocity[:,2],-20,20)
        for i in np.where(touching)[0]:
            velocity[i,0]*=.72
            velocity[i,1]=min(velocity[i,1],0)
            velocity[i,2]*=.9
        history.append(q.copy())
    return {'names':names,'centers':centers,'poses':history,'stepMs':1000/240,'pins':pins}

def matrices_at(result,time):
    location=np.clip(time/result['stepMs'],0,len(result['poses'])-1)
    index=int(location);next_index=min(index+1,len(result['poses'])-1)
    pose=result['poses'][index]*(1-(location-index))+result['poses'][next_index]*(location-index)
    matrices={}
    for i,name in enumerate(result['names']):
        matrix=np.eye(3);matrix[:2,:2]=rotation(pose[i,2]);matrix[:2,2]=pose[i,:2]-matrix[:2,:2]@result['centers'][i]
        matrices[name]=matrix
    return matrices
