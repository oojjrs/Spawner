from pathlib import Path
from PIL import Image
import json
import numpy as np
import math

folder=Path(__file__).resolve().parent
records=json.loads((folder/'motion.json').read_text('utf8'))
rig=json.loads((folder/'Source/crest-rig.json').read_text('utf8'))
states=[]
for index,origin in enumerate(rig['roots']):
    source=np.array(Image.open(folder/'Parts'/('crest-'+str(index)+'.png')))
    yy,xx=np.where(source[:,:,3]>128)
    material=np.column_stack([xx,yy]).astype(float)
    root=np.array(origin,float)
    center=material.mean(0)
    inertia=float(np.mean(np.sum((material-root)**2,1)))
    selected=material[::2]
    states.append({'root':root,'center':center,'inertia':inertia,'points':selected,'angle':0.,'velocity':0.,'pivot':None,'pivotVelocity':np.zeros(2),'acceleration':np.zeros(2),'parentAngle':0.,'parentVelocity':0.,'parentAcceleration':0.})
times=np.array([r['timeMs'] for r in records])
angles=np.unwrap([math.atan2(r['head'][1][0],r['head'][0][0]) for r in records])
translations=np.array([np.array(r['head'])[:2,2] for r in records])

def rotation(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def parent(time):
    angle=float(np.interp(time,times,angles))
    value=np.eye(3)
    value[:2,:2]=rotation(angle)
    value[:2,2]=[np.interp(time,times,translations[:,0]),np.interp(time,times,translations[:,1])]
    return value,angle

dt=1/240
output=[]
last=-1
for step in range(481):
    time=step*dt*1000
    matrix,parent_angle=parent(time)
    release=np.clip((time-rig['releaseMs'][0])/(rig['releaseMs'][1]-rig['releaseMs'][0]),0,1)
    release=release*release*(3-2*release)
    matrices=[]
    for index,state in enumerate(states):
        root=state['root']
        pivot=(matrix@np.r_[root,1])[:2]
        if state['pivot'] is None:
            state['pivot']=pivot.copy()
            state['parentAngle']=parent_angle
        velocity=(pivot-state['pivot'])/dt
        state['acceleration']+=.12*((velocity-state['pivotVelocity'])/dt-state['acceleration'])
        parent_velocity=(parent_angle-state['parentAngle'])/dt
        state['parentAcceleration']+=.12*((parent_velocity-state['parentVelocity'])/dt-state['parentAcceleration'])
        arm=rotation(parent_angle+state['angle'])@(state['center']-root)
        acceleration=np.array([0.,950])-state['acceleration']
        torque=(arm[0]*acceleration[1]-arm[1]*acceleration[0])/state['inertia']
        passive=rig['passiveElasticity'][index]
        rest=math.radians(rig['passiveFoldDegrees'][index])
        elastic=passive*(rest-state['angle'])
        erector=-passive*rest*(1-release)-80*(1-release)*state['angle']
        angular=(torque-state['parentAcceleration'])*release+elastic+erector-5*state['velocity']
        state['velocity']+=angular*dt
        state['angle']+=state['velocity']*dt
        low,high=np.radians(rig['flexionLimitsDegrees'][index])
        if state['angle']<low: state['angle']=float(low);state['velocity']=max(0,state['velocity'])*.1
        if state['angle']>high: state['angle']=float(high);state['velocity']=min(0,state['velocity'])*.1
        for iteration in range(3):
            local=rotation(state['angle'])
            current=(state['points']-root)@local.T+root
            world=np.column_stack([current,np.ones(len(current))])@matrix[:2].T
            maximum=float(world[:,1].max())
            if maximum<=448: break
            contact=world[world[:,1]>maximum-.5].mean(0)
            lever=contact[0]-pivot[0]
            if abs(lever)>3: state['angle']-=float(np.clip((maximum-448)/lever,-.05,.05))
            state['velocity']*=.4
        local=np.eye(3)
        local[:2,:2]=rotation(state['angle'])
        local[:2,2]=root-local[:2,:2]@root
        matrices.append((matrix@local).tolist())
        state['pivot']=pivot.copy()
        state['pivotVelocity']=velocity
        state['parentAngle']=parent_angle
        state['parentVelocity']=parent_velocity
    index=round(time/40)
    if index>last and time>=index*40-.01:
        output.append({'timeMs':index*40,'matrices':matrices,'flexion':[state['angle'] for state in states]})
        last=index
(folder/'crest-motion.json').write_bytes((json.dumps(output,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
print(json.dumps({'lastFlexionDegrees':np.degrees(output[-1]['flexion']).tolist()}))
