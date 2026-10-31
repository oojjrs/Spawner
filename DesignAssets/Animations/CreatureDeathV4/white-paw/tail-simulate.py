from pathlib import Path
from PIL import Image
import numpy as np
import json
import math

folder=Path(__file__).resolve().parent
samples=json.loads((folder/'physics-samples.json').read_text('utf-8'))
body_image=np.array(Image.open(folder/'Parts/torso.png').convert('RGBA'))
body_mask=body_image[:,:,3]>192
interior=body_mask&np.roll(body_mask,1,0)&np.roll(body_mask,-1,0)&np.roll(body_mask,1,1)&np.roll(body_mask,-1,1)
boundary=np.column_stack(np.where(body_mask&~interior)[::-1]).astype(float)[::2]
bind=np.array([[387,310],[388,333],[390,367],[422,361],[441,340],[441,311],[438,280],[416,254],[396,239],[368,241],[334,241],[303,242]],float)
positions=bind.copy()
previous=bind.copy()
lengths=np.linalg.norm(np.diff(bind,**{'axis':0}),**{'axis':1})
chords=np.linalg.norm(bind[2:]-bind[:-2],**{'axis':1})
radii=np.array([12,13,20,26,32,34,39,42,44,38,35,16],float)
dt=1/240
times=np.array([entry['timeMs'] for entry in samples])
angles=np.unwrap(np.array([math.atan2(entry['body'][1][0],entry['body'][0][0]) for entry in samples]))
centres=np.array([(np.array(entry['body'])@np.array([280,314,1]))[:2] for entry in samples])
records=[]
last=-1

def body_transform(time):
    angle=np.interp(time,times,angles)
    centre=np.array([np.interp(time,times,centres[:,0]),np.interp(time,times,centres[:,1])])
    c,s=math.cos(angle),math.sin(angle)
    rotation=np.array([[c,-s],[s,c]])
    translation=centre-rotation@np.array([280,314])
    return rotation,translation

def support(time):
    value=max(0,min(1,(time-240)/380))
    return 1-value*value*(3-2*value)

for step in range(round(2000/1000/dt)+1):
    time=step*dt*1000
    rotation,translation=body_transform(time)
    root=rotation@bind[0]+translation
    old=positions.copy()
    muscle=support(time)
    for index in range(1,len(bind)):
        velocity=(positions[index]-previous[index])*math.exp(-6.5*dt)
        positions[index]+=velocity+np.array([0,900*(1-muscle)*dt*dt])
        positions[index]+=(rotation@bind[index]+translation-positions[index])*muscle*dt*14
    for iteration in range(16):
        positions[0]=root
        for index,length in enumerate(lengths):
            delta=positions[index+1]-positions[index]
            distance=max(.0001,np.linalg.norm(delta))
            error=delta*(distance-length)/distance
            if index==0:
                positions[index+1]-=error
            else:
                positions[index]+=.5*error
                positions[index+1]-=.5*error
        stiffness=.045*muscle+.006
        for index,chord in enumerate(chords,1):
            delta=positions[index+1]-positions[index-1]
            distance=max(.0001,np.linalg.norm(delta))
            error=delta*(distance-chord)/distance*stiffness
            if index>1:
                positions[index-1]+=.5*error
            positions[index+1]-=.5*error
        for first in range(1,len(bind)):
            for second in range(first+3,len(bind)):
                delta=positions[second]-positions[first]
                distance=max(.0001,np.linalg.norm(delta))
                minimum=.5*(radii[first]+radii[second])
                if distance<minimum:
                    correction=delta*(minimum-distance)/distance*.5
                    positions[first]-=correction
                    positions[second]+=correction
        for index in range(1,len(bind)):
            positions[index,1]=min(positions[index,1],448-radii[index])
            if index<3:
                continue
            local=rotation.T@(positions[index]-translation)
            x,y=np.clip(np.round(local).astype(int),0,511)
            inside=body_mask[y,x]
            distances=np.sum((boundary-local)**2,1)
            point=boundary[int(np.argmin(distances))]
            distance=max(.0001,math.sqrt(float(distances.min())))
            radius=radii[index]*.45
            if inside or distance<radius:
                direction=(point-local)/distance if inside else (local-point)/distance
                local=point+direction*radius
                positions[index]=rotation@local+translation
    positions[0]=root
    previous=old
    for index in range(1,len(bind)):
        if positions[index,1]>=448-radii[index]-.05:
            previous[index,0]=positions[index,0]-(positions[index,0]-old[index,0])*.75
            previous[index,1]=positions[index,1]
    sample=round(time/40)
    if sample>last and time>=sample*40-.01:
        records.append({'timeMs':sample*40,'joints':positions.tolist()})
        last=sample
model={'bind':bind.tolist(),'radii':radii.tolist(),'lengths':lengths.tolist(),'dt':dt,'gravity':900,'bodyCollider':'Parts/torso.png','groundY':448,'frames':records}
(folder/'tail-physics.json').write_bytes((json.dumps(model,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
print(json.dumps({'frames':len(records),'first':records[0],'last':records[-1]}))
