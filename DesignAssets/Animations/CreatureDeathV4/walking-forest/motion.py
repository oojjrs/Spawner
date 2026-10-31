from pathlib import Path
from PIL import Image
import numpy as np
import json
import math
import sys

folder=Path(__file__).resolve().parent
key=folder.name
from mesh_render import arc_data
rig=json.loads((folder/'rig.json').read_text('utf-8'))
legs=rig['sourceLegs']
toes=rig['sourceToes']
neck=rig['sourceNeck']
head_com=rig['sourceHeadMassCenter']
tail=rig['sourceTail']
starts=rig['startsMs']
goals=rig['retractorAnchors']
states={}
for name,bind in legs.items():
    bind=np.array(bind,float)
    states[name]={'bind':bind,'positions':bind.copy(),'previous':bind.copy(),'lengths':np.linalg.norm(np.diff(bind,**{'axis':0}),**{'axis':1}),'angle':0.,'velocity':0.}
    image=np.array(Image.open(folder/'Parts'/(name+'.png')).convert('RGBA'))
    y,x=np.where(image[:,:,3]>128)
    points=np.column_stack([x,y]).astype(float)
    source=np.vstack([bind,np.array(toes[name],float)])
    along,lengths=arc_data(points,source)
    paw=points[along>sum(lengths[:2])-3][::2]
    centre=paw.mean(0)
    inertia=float(np.mean(np.sum((paw-centre)**2,1))+np.sum((centre-bind[-1])**2))
    states[name]['paw']=paw
    states[name]['pawCOM']=centre
    states[name]['pawInertia']=inertia
    states[name]['ground']=float(paw[:,1].max())
neck=np.array(neck,float)
head_root=neck[-1].copy()
head_angle=head_velocity=0.
neck_state={'bind':neck,'positions':neck.copy(),'previous':neck.copy(),'lengths':np.linalg.norm(np.diff(neck,**{'axis':0}),**{'axis':1})}
tail=np.array(tail,float)
tail_state={'bind':tail,'positions':tail.copy(),'previous':tail.copy(),'lengths':np.linalg.norm(np.diff(tail,**{'axis':0}),**{'axis':1})}
head=np.array(Image.open(folder/'Parts/head.png').convert('RGBA'))
yy,xx=np.where(head[:,:,3]>128)
head_points=np.column_stack([xx,yy]).astype(float)[::2]
shell=np.array(Image.open(folder/'Parts/shell.png').convert('RGBA'))
ys,xs=np.where(shell[:,:,3]>128)
drop=448-float(ys.max())
cavity_floor=np.full(512,np.nan)
for column in range(512):
    rows=np.where(shell[:,column,3]>240)[0]
    if len(rows):
        cavity_floor[column]=float(rows[-1])-2
dy=vertical=0.
dt=1/240
records=[]
last=-1

def phase(time,start,duration):
    value=max(0,min(1,(time-start)/duration))
    return value*value*(3-2*value)

def rotation(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def tick(state,root,goal,release,floor,gravity,hold):
    positions=state['positions']
    old=positions.copy()
    bind=state['bind']
    for index in [1,2]:
        velocity=(positions[index]-state['previous'][index])*math.exp(-7*dt)
        positions[index]+=velocity+np.array([0,gravity*dt*dt])
        rest=bind[index]+root-bind[0]
        positions[index]+=(rest-positions[index])*(1-release)*80*dt*dt
    delta=goal-positions[2]
    distance=max(1,np.linalg.norm(delta))
    positions[2]+=delta/distance*6000*release*dt*dt
    for iteration in range(22):
        positions[0]=root
        for index,length in enumerate(state['lengths']):
            delta=positions[index+1]-positions[index]
            distance=max(.001,np.linalg.norm(delta))
            correction=delta*(distance-length)/distance
            if index==0:
                positions[index+1]-=correction
            else:
                positions[index]+=.5*correction
                positions[index+1]-=.5*correction
        positions[1,1]=min(positions[1,1],448-22)
        positions[2,1]=min(positions[2,1],floor)
        if hold:
            positions[2]=bind[2]
    state['previous']=old
    for index in [1,2]:
        limit=448-22 if index==1 else floor
        if positions[index,1]>=limit-.05:
            state['previous'][index,0]=positions[index,0]-(positions[index,0]-old[index,0])*.65
            state['previous'][index,1]=positions[index,1]
    return positions

for step in range(round(2400/1000/dt)+1):
    time=step*dt*1000
    strengths={name:1-phase(time,starts[name],340) for name in states}
    normal=sum((900/4+65*dy-12*vertical)*strength for strength in strengths.values())
    acceleration=900-max(0,normal)-6*vertical
    vertical+=acceleration*dt
    dy+=vertical*dt
    if dy>drop:
        dy=drop
        vertical=-vertical*.06 if vertical>12 else 0
    dy=max(0,dy)
    shift=np.array([0,dy])
    leg_records={}
    for name,state in states.items():
        release=phase(time,starts[name]+80,600)
        joints=tick(state,state['bind'][0]+shift,np.array(goals[name])+shift,release,state['bind'][2,1],900*(1-strengths[name]),strengths[name]>.65)
        arm=(state['pawCOM']-state['bind'][-1])@rotation(state['angle']).T
        state['velocity']+=(arm[0]*900/state['pawInertia']-5*state['velocity']-state['angle']*45*strengths[name])*dt
        state['angle']+=state['velocity']*dt
        state['angle']=max(-math.pi/3,min(math.pi/4,state['angle']))
        if release>.55:
            for iteration in range(8):
                surface=(state['paw']-state['bind'][-1])@rotation(state['angle']).T+joints[2]
                columns=np.clip(np.round(surface[:,0]).astype(int),0,511)
                floors=cavity_floor[columns]+dy
                valid=np.isfinite(floors)
                penetration=np.where(valid,surface[:,1]-floors,-10000)
                worst=int(np.argmax(penetration))
                if penetration[worst]<=.05:
                    break
                lever=surface[worst,0]-joints[2,0]
                if abs(lever)>3:
                    state['angle']-=np.clip(penetration[worst]/lever,-.03,.03)
                    state['velocity']*=.3
        surface=(state['paw']-state['bind'][-1])@rotation(state['angle']).T+joints[2]
        maximum=surface[:,1].max()
        if maximum>state['ground']:
            contact=surface[surface[:,1]>maximum-1].mean(0)
            lever=contact[0]-joints[2,0]
            if abs(lever)>1:
                state['angle']-=(maximum-state['ground'])/lever
                state['velocity']*=.2
        leg_records[name]={'joints':joints.tolist(),'pawAngle':state['angle'],'support':strengths[name],'retractor':release}
    neck_release=phase(time,280,650)
    head_root=tick(neck_state,neck[0]+shift,neck[0]+np.array([65,-70])+shift,neck_release,448,600*(1-phase(time,0,180)),False)[2]
    arm=rotation(head_angle)@(np.array(head_com)-neck[-1])
    fatigue=phase(time,180,300)
    head_velocity+=(arm[0]*900/9000*fatigue-5*head_velocity-head_angle*55*(1-fatigue))*dt
    head_angle+=head_velocity*dt
    head_angle=max(-math.pi/4,min(math.pi/12,head_angle))
    transformed=(head_points-neck[-1])@rotation(head_angle).T+head_root
    maximum=float(transformed[:,1].max())
    if maximum>448:
        contact=transformed[transformed[:,1]>maximum-1].mean(0)
        lever=contact[0]-head_root[0]
        if abs(lever)>5:
            head_angle-=np.clip((maximum-448)/lever,-.04,.04)
            head_velocity*=.3
    tail_release=phase(time,900,450)
    tail_points=tick(tail_state,tail[0]+shift,tail[0]+np.array([-38,-22])+shift,tail_release,448-10,800,False)
    index=round(time/40)
    if index>last and time>=index*40-.01:
        records.append({'timeMs':index*40,'shellY':dy,'shellVelocity':vertical,'legs':leg_records,'neck':neck_state['positions'].tolist(),'headRoot':head_root.tolist(),'headAngle':head_angle,'tail':tail_points.tolist()})
        last=index
model={'canvas':[512,512],'pivot':[256,448],'groundY':448,'gravity':900,'dt':dt,'sourceHeadRoot':neck[-1].tolist(),'sourceHeadMassCenter':head_com,'sourceNeck':neck.tolist(),'sourceTail':tail.tolist(),'sourceLegs':legs,'sourceToes':toes,'startsMs':starts,'shellDrop':drop,'frames':records}
(folder/'motion.json').write_bytes((json.dumps(model,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
print(json.dumps({'id':key,'frames':len(records),'drop':drop,'last':records[-1]}))
