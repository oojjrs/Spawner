import math
import numpy as np

def matrix(pivot,angle,offset):
    c,s=math.cos(angle),math.sin(angle)
    x,y=pivot
    return np.array([[c,-s,x+offset[0]-c*x+s*y],[s,c,y+offset[1]-s*x-c*y],[0,0,1]],float)

def point(transform,value):
    return (transform@np.array([value[0],value[1],1]))[:2]

def geometry(image):
    a=np.asarray(image)[:,:,3].astype(float)/255
    yy,xx=np.mgrid[:a.shape[0],:a.shape[1]]
    weights=a*a
    center=np.array([(xx*weights).sum()/weights.sum(),(yy*weights).sum()/weights.sum()])
    inertia=(((xx-center[0])**2+(yy-center[1])**2)*weights).sum()/weights.sum()
    points=[]
    for x in range(0,512,3):
        ys=np.where(a[:,x]>.5)[0]
        if len(ys): points.extend([[x,int(ys[0])],[x,int(ys[-1])]])
    return center,float(inertia),np.array(points,float)

def support(time,interval):
    u=max(0,min(1,(time*1000-interval[0])/(interval[1]-interval[0])))
    return 1-u*u*(3-2*u)

def bottom(points,transform):
    p=(transform@np.column_stack((points,np.ones(len(points)))).T).T[:,:2]
    slope=GROUND['slope'];origin=GROUND['origin']
    depths=p[:,1]-slope*(p[:,0]-origin)
    maximum=float(depths.max())
    return maximum,p[depths>maximum-1].mean(0)

def solve_leg(joints,body,target,bend):
    hip,knee,ankle=np.array(joints,float)
    h=point(body,hip)
    length1=np.linalg.norm(knee-hip)
    length2=np.linalg.norm(ankle-knee)
    d=target-h
    distance=np.linalg.norm(d)
    max_length=length1+length2-.1
    if distance>max_length:
        dy=target[1]-h[1]
        if abs(dy)<max_length:
            target=np.array([h[0]+math.copysign(math.sqrt(max_length*max_length-dy*dy),d[0]),target[1]])
        else:
            target=h+d/distance*max_length
        d=target-h
    minimum=abs(length1-length2)+.1
    if np.linalg.norm(d)<minimum:
        dy=target[1]-h[1]
        target=np.array([h[0]+math.copysign(math.sqrt(max(0,minimum*minimum-dy*dy)),d[0]),target[1]])
        d=target-h
    distance=max(minimum,min(max_length,np.linalg.norm(d)))
    direction=math.atan2(d[1],d[0])
    offset=math.acos(np.clip((distance*distance+length1*length1-length2*length2)/(2*distance*length1),-1,1))
    angle=direction+bend*offset
    k=h+length1*np.array([math.cos(angle),math.sin(angle)])
    a=math.atan2(target[1]-k[1],target[0]-k[0])
    bind1=math.atan2(knee[1]-hip[1],knee[0]-hip[0])
    bind2=math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])
    first=matrix(hip,angle-bind1,h-hip)
    second=matrix(knee,a-bind2,k-knee)
    foot=matrix(ankle,0,target-ankle)
    return [first,second,foot],{'hip':h.tolist(),'knee':k.tolist(),'ankle':target.tolist(),'lengths':[float(length1),float(length2)]}

def chain_tick(state,parent,dt,gravity,muscle,floors,stiffness):
    bind=state['bind'];positions=state['positions'];previous=state['previous']
    locked=state.get('locked',0);old=positions.copy();lengths=state['lengths']
    for i in range(locked+1,len(bind)):
        positions[i]+=(positions[i]-previous[i])*math.exp(-5*dt)+np.array([0,gravity*(1-muscle)*dt*dt])
    for iteration in range(20):
        for i in range(locked+1): positions[i]=point(parent,bind[i])
        for i,length in enumerate(lengths):
            if i<locked: continue
            delta=positions[i+1]-positions[i];distance=max(.001,np.linalg.norm(delta))
            error=delta*(distance-length)/distance
            if i==locked: positions[i+1]-=error
            else:
                positions[i]+=.5*error;positions[i+1]-=.5*error
        elasticity=state.get('elasticity',0)
        if elasticity:
            for i in range(max(1,locked),len(bind)-1):
                a=positions[i]-positions[i-1];b=positions[i+1]-positions[i]
                turn=math.atan2(b[1],b[0])-math.atan2(a[1],a[0])
                error=(state['restAngles'][i-1]-turn+math.pi)%(2*math.pi)-math.pi
                first=np.array([-a[1],a[0]])/max(.001,np.dot(a,a))
                last=np.array([-b[1],b[0]])/max(.001,np.dot(b,b))
                gradients=[first,-first-last,last]
                free=[float(j>locked) for j in [i-1,i,i+1]]
                denominator=sum(weight*np.dot(gradient,gradient) for weight,gradient in zip(free,gradients))
                if denominator>.000001:
                    for j,weight,gradient in zip([i-1,i,i+1],free,gradients):
                        positions[j]+=weight*elasticity*error*gradient/denominator
        for i in range(locked+1,len(bind)):
            local_floor=floors[i]+GROUND['slope']*(positions[i,0]-state.get('floorOrigins',bind[:,0])[i])
            positions[i,1]=min(positions[i,1],local_floor)
    previous[:]=old
    for i in range(locked+1,len(bind)):
        local_floor=floors[i]+GROUND['slope']*(positions[i,0]-state.get('floorOrigins',bind[:,0])[i])
        if positions[i,1]>=local_floor-.01:
            previous[i,0]=positions[i,0]-(positions[i,0]-old[i,0])*.7
            previous[i,1]=positions[i,1]
    matrices=[parent]
    for i in range(len(bind)-1):
        source=bind[i+1]-bind[i];destination=positions[i+1]-positions[i]
        angle=math.atan2(destination[1],destination[0])-math.atan2(source[1],source[0])
        matrices.append(matrix(bind[i],angle,positions[i]-bind[i]))
    return matrices,positions.copy()

GROUND={'slope':0.0,'origin':0.0}

def simulate(rig,images):
    GROUND['slope']=rig.get('groundSlope',0.0);GROUND['origin']=rig.get('groundX',0.0)
    body_center,body_inertia,body_points=geometry(images['body'])
    head_center,head_inertia,head_points=geometry(images['head'])
    if 'bodyMassCenter' in rig: body_center=np.array(rig['bodyMassCenter'],float)
    if 'headMassCenter' in rig: head_center=np.array(rig['headMassCenter'],float)
    neck=np.array(rig['neckPivot'],float)
    head_arm=head_center-neck
    head_rot_inertia=head_inertia+np.dot(head_arm,head_arm)
    mh=rig['headMass']
    mass=1+mh
    inertia=body_inertia+mh*np.dot(head_center-body_center,head_center-body_center)
    com=(body_center+mh*head_center)/mass
    hips=[(name,np.array(joints[0],float)) for name,joints in rig['legs'].items()]
    front=[hip[0] for name,hip in hips if name.startswith('fore')]
    rear=[hip[0] for name,hip in hips if name.startswith('hind')]
    if not front:
        positions=sorted(hips,**{'key':lambda item:item[1][0]})
        front=[positions[0][1][0]]
        rear=[positions[-1][1][0]]
    fx,rx=float(np.mean(front)),float(np.mean(rear))
    front_share=np.clip((rx-com[0])/max(1,rx-fx),.1,.9)
    x=y=vy=angle=angular=head_angle=head_velocity=0.0
    gravity=rig['gravity']
    dt=1/240
    limbs={}
    for name,joints in rig['legs'].items():
        p=np.array(joints,float)
        cross=np.cross(p[1]-p[0],p[2]-p[0])
        bend=rig.get('legBends',{}).get(name,-1 if cross>0 else 1)
        limbs[name]={'foot':p[2].copy(),'bind':p,'bend':bend,'positions':p.copy(),'previous':p.copy(),'lengths':[np.linalg.norm(p[i+1]-p[i]) for i in range(2)]}
    parts={}
    for name,pivot in rig['accessories'].items():
        c,i,pts=geometry(images[name])
        arm=c-np.array(pivot)
        parts[name]={'pivot':pivot,'parent':'head','angle':0.0,'velocity':0.0,'center':c,'inertia':i+np.dot(arm,arm),'points':pts,'stiffness':1.3}
    for name,description in rig['extraParts'].items():
        c,i,pts=geometry(images[name]);pivot=description['pivot'];arm=c-np.array(pivot)
        parts[name]={'pivot':pivot,'parent':description['parent'],'angle':0.0,'velocity':0.0,'center':c,'inertia':i+np.dot(arm,arm),'points':pts,'stiffness':.9,'rigid':description.get('rigidToParent',False)}
    limb_surfaces={part:geometry(images[part])[2] for names in rig.get('jointParts',{}).values() for part in names[:2]}
    samples=[]
    soft={}
    for name,description in rig.get('softChains',{}).items():
        p=np.array(description['joints'],float)
        soft[name]={'bind':p,'positions':p.copy(),'previous':p.copy(),'lengths':[np.linalg.norm(p[i+1]-p[i]) for i in range(len(p)-1)]}
        directions=np.arctan2(np.diff(p,**{'axis':0})[:,1],np.diff(p,**{'axis':0})[:,0])
        soft[name]['restAngles']=(np.diff(directions)+math.pi)%(2*math.pi)-math.pi
        soft[name]['locked']=description.get('locked',0)
        soft[name]['elasticity']=description.get('bendElasticity',0)
    last_sample=-1
    previous_parent_velocity=0
    head_support=0.0
    steps=round(rig['durationActiveMs']/1000/dt)
    for step in range(steps+1):
        t=step*dt
        body=matrix(body_center,angle,[x,y])
        head=body@matrix(neck,head_angle,[0,0])
        head_world=point(head,head_center)
        torque=(head_world[0]-point(body,body_center)[0])*mh*gravity*(1-head_support)
        normal=0.0
        for index,(name,hip) in enumerate(hips):
            is_front=name.startswith('fore') or (not name.startswith('hind') and hip[0]<=com[0])
            group_count=sum(1 for _,h in hips if (h[0]<=com[0])==is_front) if not name.startswith(('fore','hind')) else sum(n.startswith('fore' if is_front else 'hind') for n,_ in hips)
            interval=rig['foreFailureMs'] if is_front else rig['hindFailureMs']
            shifted=[interval[0]+(index%2)*16,interval[1]+(index%2)*16]
            strength=support(t,shifted)
            force=mass*gravity*(front_share if is_front else 1-front_share)/max(1,group_count)*strength
            normal+=force
            torque-=(point(body,hip)[0]-point(body,body_center)[0])*force
        acceleration=(mass*gravity-normal-head_support*mh*gravity)/mass
        alpha=torque/inertia-3.8*angular
        vy+=acceleration*dt
        angular+=alpha*dt
        y+=vy*dt
        angle+=angular*dt
        limit=math.radians(rig['bodyAngleLimit'])
        if angle<limit: angle=limit;angular=max(0,angular)*.1
        if angle>math.radians(20): angle=math.radians(20);angular=min(0,angular)*.1
        body=matrix(body_center,angle,[x,y])
        maximum,contact=bottom(body_points,body)
        body_contact=maximum>rig['groundY']
        if body_contact:
            y-=maximum-rig['groundY']
            lever=contact[0]-point(body,body_center)[0]+GROUND['slope']*(contact[1]-point(body,body_center)[1])
            speed=vy+angular*lever
            if speed>0:
                impulse=-(1.03)*speed/(1/mass+lever*lever/inertia)
                vy+=impulse/mass
                angular+=lever*impulse/inertia
            vy=min(vy,0)
            angular*=math.exp(-11*dt)
            body=matrix(body_center,angle,[x,y])
        leg_transforms={};leg_records={}
        for name,joints in rig['legs'].items():
            state=limbs[name]
            front_leg=name.startswith('fore') or (not name.startswith('hind') and joints[0][0]<com[0])
            interval=rig['foreFailureMs'] if front_leg else rig['hindFailureMs']
            floors=[rig['groundY'],rig['groundY']-18,joints[2][1]]
            matrices,positions=chain_tick(state,body,dt,gravity,support(t,interval),floors,0)
            upper,lower=matrices[1:]
            foot=matrix(joints[2],0,positions[2]-np.array(joints[2]))
            record={'hip':positions[0].tolist(),'knee':positions[1].tolist(),'ankle':positions[2].tolist(),'lengths':[float(value) for value in state['lengths']]}
            leg_transforms[name]=[upper,lower,foot]
            leg_records[name]=record
        limb_contact=False
        if rig.get('limbSurfaceContact',False):
            for contact_iteration in range(8):
                for name,joints in rig['legs'].items():
                    matrices,record=solve_leg(joints,body,limbs[name]['positions'][2].copy(),limbs[name]['bend'])
                    leg_transforms[name]=matrices;leg_records[name]=record
                    limbs[name]['positions'][:]=np.array([record['hip'],record['knee'],record['ankle']])
                candidates=[]
                for name,matrices in leg_transforms.items():
                    for part,transform in zip(rig['jointParts'][name][:2],matrices[:2]):
                        maximum,contact=bottom(limb_surfaces[part],transform)
                        candidates.append((maximum,contact))
                maximum,contact=max(candidates,**{'key':lambda item:item[0]})
                penetration=maximum-rig['groundY']
                if penetration<.02: break
                limb_contact=True
                center=point(body,body_center)
                lever=contact[0]-center[0]+GROUND['slope']*(contact[1]-center[1])
                denominator=1/mass+lever*lever/inertia
                correction=-penetration/denominator
                y+=correction/mass;angle+=lever*correction/inertia
                speed=vy+angular*lever
                if speed>0:
                    impulse=-speed/denominator
                    vy+=impulse/mass;angular+=lever*impulse/inertia
                body=matrix(body_center,angle,[x,y])
            for name,joints in rig['legs'].items():
                matrices,record=solve_leg(joints,body,limbs[name]['positions'][2].copy(),limbs[name]['bend'])
                leg_transforms[name]=matrices;leg_records[name]=record
                limbs[name]['positions'][:]=np.array([record['hip'],record['knee'],record['ankle']])
        parent_alpha=(angular-previous_parent_velocity)/dt
        previous_parent_velocity=angular
        head=body@matrix(neck,head_angle,[0,0])
        world_arm=point(head,head_center)-point(body,neck)
        fatigue=1-support(t,rig['headFailureMs'])
        head_acc=world_arm[0]*gravity/head_rot_inertia*fatigue-3.3*head_velocity-parent_alpha
        head_velocity+=head_acc*dt
        head_angle+=head_velocity*dt
        lower,upper=[math.radians(value) for value in rig['headAngleLimit']]
        if head_angle<lower: head_angle=lower;head_velocity=max(0,head_velocity)*.1
        if head_angle>upper: head_angle=upper;head_velocity=min(0,head_velocity)*.1
        head=body@matrix(neck,head_angle,[0,0])
        maximum,contact=bottom(head_points,head)
        head_contact=maximum>rig['groundY']
        head_reaction=False
        if head_contact or (head_support>.7 and fatigue>.9 and maximum>rig['groundY']-2):
            head_contact=True
            for contact_iteration in range(8):
                maximum,contact=bottom(head_points,head)
                penetration=maximum-rig['groundY']
                if abs(penetration)<.01: break
                neck_world=point(body,neck)
                lever=contact[0]-neck_world[0]+GROUND['slope']*(contact[1]-neck_world[1])
                if abs(lever)>5:
                    head_angle=float(np.clip(head_angle-penetration/lever,lower,upper))
                    neck_velocity=vy+angular*(neck_world[0]-point(body,body_center)[0])
                    head_velocity=-neck_velocity/lever-angular
                    head=body@matrix(neck,head_angle,[0,0])
                maximum,contact=bottom(head_points,head)
                penetration=maximum-rig['groundY']
                if penetration>.01:
                    head_reaction=True
                    center=point(body,body_center)
                    lever=contact[0]-center[0]+GROUND['slope']*(contact[1]-center[1])
                    denominator=1/mass+lever*lever/inertia
                    correction=-penetration/denominator
                    y+=correction/mass;angle+=lever*correction/inertia
                    speed=vy+angular*lever
                    if speed>0:
                        impulse=-speed/denominator
                        vy+=impulse/mass;angular+=lever*impulse/inertia
                    body=matrix(body_center,angle,[x,y]);head=body@matrix(neck,head_angle,[0,0])
                maximum,contact=bottom(body_points,body)
                penetration=maximum-rig['groundY']
                if penetration>.01:
                    body_contact=True
                    center=point(body,body_center)
                    lever=contact[0]-center[0]+GROUND['slope']*(contact[1]-center[1])
                    correction=-penetration/(1/mass+lever*lever/inertia)
                    y+=correction/mass;angle+=lever*correction/inertia
                    body=matrix(body_center,angle,[x,y]);head=body@matrix(neck,head_angle,[0,0])
            if head_reaction:
                for name,joints in rig['legs'].items():
                    matrices,record=solve_leg(joints,body,limbs[name]['positions'][2].copy(),limbs[name]['bend'])
                    leg_transforms[name]=matrices;leg_records[name]=record
                    limbs[name]['positions'][:]=np.array([record['hip'],record['knee'],record['ankle']])
        if (body_contact or limb_contact) and head_contact and abs(vy)<4 and abs(angular)<.12:
            angular=math.copysign(max(0,abs(angular)-2*dt),angular)
        head_support+=(float(maximum>=rig['groundY']-1)-head_support)*min(1,dt*40)
        transforms={}
        chain_transforms={}
        for name,state in parts.items():
            parent=head if state['parent']=='head' else body
            if state.get('rigid',False):
                transforms[name]=parent
                continue
            if name in soft:
                description=rig['softChains'][name]
                floors=[rig['groundY']+GROUND['slope']*(joint[0]-GROUND['origin'])-radius for joint,radius in zip(description['joints'],description['radii'])]
                matrices,positions=chain_tick(soft[name],parent,dt,gravity,1-fatigue,floors,.15)
                chain_transforms[name]=matrices
                transforms[name]=parent
                continue
            arm=point(parent@matrix(state['pivot'],state['angle'],[0,0]),state['center'])-point(parent,state['pivot'])
            acc=arm[0]*gravity/state['inertia']*fatigue-state['stiffness']*state['angle']-4.7*state['velocity']
            state['velocity']+=acc*dt
            state['angle']+=state['velocity']*dt
            state['angle']=float(np.clip(state['angle'],-math.pi*.8,math.pi*.8))
            transform=parent@matrix(state['pivot'],state['angle'],[0,0])
            for contact_iteration in range(8):
                maximum,contact=bottom(state['points'],transform)
                if maximum<=rig['groundY']+.01: break
                lever=contact[0]-point(parent,state['pivot'])[0]+GROUND['slope']*(contact[1]-point(parent,state['pivot'])[1])
                if abs(lever)<=2: break
                state['angle']-=np.clip((maximum-rig['groundY'])/lever,-.15,.15)
                state['velocity']*=.2
                transform=parent@matrix(state['pivot'],state['angle'],[0,0])
            transforms[name]=transform
        index=round(t*1000/rig['sampleMs'])
        if index>last_sample and t*1000>=index*rig['sampleMs']-.01:
            samples.append({'timeMs':index*rig['sampleMs'],'body':body,'head':head,'parts':transforms.copy(),'chains':chain_transforms.copy(),'legs':leg_transforms.copy(),'landmarks':leg_records,'bodyContact':bool(body_contact),'limbContact':bool(limb_contact),'headContact':bool(head_contact),'velocity':[float(vy),float(angular),float(head_velocity)]})
            last_sample=index
    return samples
