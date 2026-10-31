from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
import math
import json
import sys

folder=Path(__file__).resolve().parent
from mesh_render import rigid

def phase(time,start,duration):
    value=max(0,min(1,(time-start)/duration))
    return value*value*(3-2*value)

def rotation(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def align(image,source,target,scale,angle):
    matrix=rotation(angle)*scale
    translation=np.array(target)-matrix@np.array(source)
    inverse=np.linalg.inv(matrix)
    offset=-inverse@translation
    output=image.transform((512,512),Image.Transform.AFFINE,(inverse[0,0],inverse[0,1],offset[0],inverse[1,0],inverse[1,1],offset[1]),Image.Resampling.BICUBIC)
    return output,matrix,translation

def centreline(image,values):
    alpha=np.array(image)[:,:,3]
    result=[]
    for x in values:
        ys=np.where(alpha[:,x]>128)[0]
        result.append([x,float((int(ys[0])+int(ys[-1]))/2)])
    return np.array(result,float)

def state(bind):
    bind=np.array(bind,float)
    return {'bind':bind,'positions':bind.copy(),'previous':bind.copy(),'lengths':np.linalg.norm(np.diff(bind,**{'axis':0}),**{'axis':1}),'internal':np.zeros(len(bind),bool),'fold':0.}

rig=json.loads((folder/'rig.json').read_text('utf-8'))
anterior=Image.open(folder/'Parts/body.png').convert('RGBA')
posterior=Image.open(folder/'Parts/body.png').convert('RGBA')
front_bind=np.array([[321,392.5],[270,420],[210,410.5],[190,410]],float)
rear_bind=np.array([[280,417],[345,416],[399,398]],float)
front=state(front_bind)
rear=state(rear_bind)
stalks={}
registrations={}
specifications=[(name,rig['sourceStalks'][name][0],rig['sourceStalks'][name][-1],rig['stalkRegistrations'][name]['radius'],rig['stalkStartMs'][name]) for name in ['near','far']]
approved=Image.open(folder/'Source/reference.png').convert('RGBA')
for name,target,source_ball,radius,start in specifications:
    ball=np.array(source_ball,float)
    mask=Image.new('L',(512,512),0)
    draw=ImageDraw.Draw(mask)
    draw.ellipse((ball[0]-radius,ball[1]-radius,ball[0]+radius,ball[1]+radius),255)
    line=[tuple(target),tuple(np.array(target)*.55+ball*.45),tuple(ball)]
    draw.line(line,255,16)
    draw.ellipse((target[0]-9,target[1]-9,target[0]+9,target[1]+9),255)
    image=Image.open(folder/'Parts'/('stalk-'+name+'.png')).convert('RGBA')
    bind=np.array(rig['sourceStalks'][name],float)
    stalks[name]=state(bind)
    stalks[name]['rootShift']=np.zeros(2)
    stalks[name]['rootVelocity']=np.zeros(2)
    stalks[name]['radius']=radius
    stalks[name]['start']=start
    mask=Image.new('L',(512,512),0)
    ImageDraw.Draw(mask).ellipse((ball[0]-radius,ball[1]-radius,ball[0]+radius,ball[1]+radius),255)
    a=np.array(image)
    sphere=a.copy()
    sphere[:,:,3]=(sphere[:,:,3].astype(float)*np.array(mask)/255).round().astype(np.uint8)
    sphere[sphere[:,:,3]==0]=0
    Image.fromarray(sphere).save(folder/'Parts'/('eye-'+name+'.png'))
    tube=a.copy()
    yy,xx=np.mgrid[:512,:512]
    tube[(xx-ball[0])**2+(yy-ball[1])**2<(radius-4)**2]=0
    Image.fromarray(tube).save(folder/'Parts'/('tube-'+name+'.png'))
    image.save(folder/'Parts'/('stalk-'+name+'-registered.png'))
    registrations[name]={'source':'Source/reference.png','root':target,'ball':ball.tolist(),'radius':radius,'sphereSource':'approved neutral pixels','tubeMaskWidth':16,'rootMaskRadius':9}
head_mask=Image.new('L',(512,512),0)
ImageDraw.Draw(head_mask).polygon([(0,0),(184,0),(194,385),(192,450),(0,512)],255)
skull=np.array(anterior)
skull[:,:,3]=(skull[:,:,3].astype(float)*np.array(head_mask)/255).round().astype(np.uint8)
skull[skull[:,:,3]==0]=0
Image.fromarray(skull).save(folder/'Parts/head-blob.png')
neck=np.array(anterior)
softmask=Image.new('L',(512,512),255)
ImageDraw.Draw(softmask).rectangle((0,0,178,511),0)
neck[:,:,3]=(neck[:,:,3].astype(float)*np.array(softmask)/255).round().astype(np.uint8)
neck[neck[:,:,3]==0]=0
Image.fromarray(neck).save(folder/'Parts/front-mantle.png')
head_points=np.column_stack(np.where(skull[:,:,3]>128)[::-1]).astype(float)[::2]
shell=np.array(Image.open(folder/'Parts/shell.png').convert('RGBA'))
solid=Image.fromarray((shell[:,:,3]>240).astype(np.uint8)*255)
inside_masks={radius:np.array(solid.filter(ImageFilter.MinFilter(radius*2+1)))>240 for radius in [45,20,28,25,18,14,8,30,15]}
drop=448-float(np.where(shell[:,:,3]>128)[0].max())
dt=1/240
dy=vertical=head_angle=head_velocity=0.
records=[]
last=-1

def free_chain(model,shift,goals,muscle,gravity,radii,ground):
    points=model['positions']
    old=points.copy()
    wall_contacts=np.zeros(len(points),bool)
    for index in range(len(points)):
        velocity=(points[index]-model['previous'][index])*math.exp(-8*dt)
        points[index]+=velocity+np.array([0,gravity*dt*dt])
        points[index]+=(model['bind'][index]+shift-points[index])*(1-muscle)*100*dt*dt
        delta=goals[index]+shift-points[index]
        stiffness=rig['retractionStiffness']['headAttachment'] if len(points)==4 and index==3 else rig['retractionStiffness']['mantle']
        points[index]+=delta*stiffness*muscle*dt*dt
    for index,radius in enumerate(radii):
        local=np.clip(np.round(points[index]-shift).astype(int),0,511)
        if muscle>.5 and shell[local[1],local[0],3]>240:
            model['internal'][index]=True
    desired=rig['internalDepthFoldMaximum']*muscle if len(points)==4 and model['internal'][0] and model['internal'][1] else 0
    model['fold']+=(desired-model['fold'])*min(1,dt*rig['internalDepthFoldRate'])
    lengths=model['lengths'].copy()
    lengths[0]*=1-model['fold']
    for iteration in range(24):
        for index,length in enumerate(lengths):
            delta=points[index+1]-points[index]
            distance=max(.001,np.linalg.norm(delta))
            correction=delta*(distance-length)/distance
            weight=.25 if index==len(model['lengths'])-1 else .5
            points[index]+=correction*(1-weight)
            points[index+1]-=correction*weight
        for index,radius in enumerate(radii):
            points[index,1]=min(points[index,1],ground-radius)
            local=points[index]-shift
            if muscle>.6 and model['internal'][index] and local[1]>330+71-radius:
                points[index,1]=330+71-radius+shift[1]
                wall_contacts[index]=True
            if muscle>.6 and local[0]>310:
                value=(local[1]-330)/(71-radius)
                if abs(value)<1:
                    wall=310+(66-radius)*math.sqrt(max(0,1-value*value))
                    if points[index,0]>wall+shift[0]:
                        points[index,0]=wall+shift[0]
                        wall_contacts[index]=True
        for first in range(len(points)):
            for second in range(first+2,len(points)):
                delta=points[second]-points[first]
                distance=max(.001,np.linalg.norm(delta))
                minimum=.6*(radii[first]+radii[second])
                if distance<minimum:
                    correction=delta*(minimum-distance)/distance*.5
                    points[first]-=correction
                    points[second]+=correction
    model['previous']=old
    model['previous'][wall_contacts]=points[wall_contacts]
    for index,radius in enumerate(radii):
        if points[index,1]>=ground-radius-.05:
            model['previous'][index,1]=points[index,1]
            model['previous'][index,0]=points[index,0]-(points[index,0]-old[index,0])*.65
    return points

for step in range(round(2600/1000/dt)+1):
    time=step*dt*1000
    fore_support=1-phase(time,600,700)
    rear_support=1-phase(time,850,650)
    normal=(900+90*dy-15*vertical)*(.55*fore_support+.45*rear_support)
    vertical+=(900-max(0,normal)-6*vertical)*dt
    dy+=vertical*dt
    if dy>drop:
        dy=drop
        vertical=-vertical*.05 if vertical>12 else 0
    dy=max(0,dy)
    shift=np.array([0,dy])
    front_muscle=phase(time,700,900)
    rear_muscle=phase(time,500,850)
    head_attachment_goal=np.array(rig['headRetractionAnchor'],float)+rotation(head_angle)@(np.array(rig['sourceHeadAttachment'])-np.array(rig['sourceHeadPosition']))
    front_goals=np.vstack([np.array(rig['frontRetractionAnchors'],float),head_attachment_goal])
    front_points=free_chain(front,shift,front_goals,front_muscle,650*(1-fore_support),[45,20,28,25],448)
    rear_points=free_chain(rear,shift,np.array(rig['rearRetractionAnchors'],float),rear_muscle,700*(1-rear_support),[30,30,15],448)
    fatigue=phase(time,700,600)
    head_velocity+=(-4*fatigue-6*head_velocity-head_angle*40*(1-fatigue))*dt
    head_angle+=head_velocity*dt
    head_angle=max(-math.pi/5,min(math.pi/12,head_angle))
    head_position=front_points[-1]-rotation(head_angle)@(np.array(rig['sourceHeadAttachment'])-np.array(rig['sourceHeadPosition']))
    transformed=(head_points-np.array([137,380]))@rotation(head_angle).T+head_position
    maximum=transformed[:,1].max()
    if maximum>448:
        front_points[-1,1]-=maximum-448
        head_position=front_points[-1]-rotation(head_angle)@(np.array(rig['sourceHeadAttachment'])-np.array(rig['sourceHeadPosition']))
        head_velocity*=.2
    stalk_records={}
    for name,model in stalks.items():
        activation=phase(time,model['start']+150,550)
        model['rootVelocity']+=((np.array([30,50])-model['rootShift'])*30*activation-model['rootShift']*100*(1-activation)-10*model['rootVelocity'])*dt
        model['rootShift']+=model['rootVelocity']*dt
        source_root=model['bind'][0]+model['rootShift']
        root=(source_root-np.array([137,380]))@rotation(head_angle).T+head_position
        points=model['positions']
        old=points.copy()
        skin_contacts=np.zeros(len(points),bool)
        muscle=1-phase(time,model['start'],300)
        for index in [1,2]:
            velocity=(points[index]-model['previous'][index])*math.exp(-7*dt)
            points[index]+=velocity+np.array([0,900*(1-muscle)*dt*dt])
            rest=(model['bind'][index]-np.array([137,380]))@rotation(head_angle).T+head_position
            points[index]+=(rest-points[index])*muscle*120*dt*dt
        for iteration in range(20):
            points[0]=root
            for index,length in enumerate(model['lengths']):
                delta=points[index+1]-points[index]
                distance=max(.001,np.linalg.norm(delta))
                correction=delta*(distance-length)/distance
                if index==0:
                    points[index+1]-=correction
                else:
                    points[index]+=.5*correction
                    points[index+1]-=.5*correction
            for index,radius in [(1,7),(2,model['radius'])]:
                local=(points[index]-head_position)@rotation(head_angle)+np.array([137,380])
                if activation>.3 and local[1]>380:
                    bounds=np.array([62-radius,60-radius],float)
                    relative=(local-np.array([137,380]))/bounds
                    distance=np.linalg.norm(relative)
                    if distance>1:
                        local=np.array([137,380])+relative/distance*bounds
                        points[index]=(local-np.array([137,380]))@rotation(head_angle).T+head_position
                        skin_contacts[index]=True
        model['previous']=old
        model['previous'][skin_contacts]=points[skin_contacts]
        stalk_records[name]={'joints':points.tolist(),'rootShift':model['rootShift'].tolist()}
    index=round(time/40)
    if index>last and time>=index*40-.01:
        records.append({'timeMs':index*40,'shellY':dy,'shellVelocity':vertical,'anterior':front_points.tolist(),'posterior':rear_points.tolist(),'headPosition':head_position.tolist(),'headAngle':head_angle,'stalks':stalk_records,'foreSupport':fore_support,'rearSupport':rear_support})
        last=index
output={'canvas':[512,512],'pivot':[256,448],'groundY':448,'gravity':900,'dt':dt,'shellDrop':drop,'sourceAnterior':front_bind.tolist(),'sourcePosterior':rear_bind.tolist(),'sourceHeadPosition':[137,380],'sourceHeadAttachment':[190,410],'sourceStalks':{name:model['bind'].tolist() for name,model in stalks.items()},'stalkRegistrations':registrations,'frames':records}
(folder/'motion.json').write_bytes((json.dumps(output,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
print(json.dumps({'frames':len(records),'drop':drop,'last':records[-1]}))
