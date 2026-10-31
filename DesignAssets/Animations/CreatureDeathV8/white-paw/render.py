from pathlib import Path
from PIL import Image,ImageDraw,_webp
import numpy as np
import math,json,sys
from mesh import lattice,warp

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
names=rig['parts']
images={name:Image.open(folder/'Parts'/(name+'.png')).convert('RGBA') for name in names}
pivot=np.array(rig['bodyPivot'],float)
neck=np.array(rig['neckPivot'],float)
limbs=rig['limbs']
fine_tail=np.array(rig['tailCurve'],float)
fine_lengths=np.sqrt(np.sum(np.diff(fine_tail,1,0)**2,1))
fine_arc=np.r_[0,np.cumsum(fine_lengths)]
tail_arc=np.linspace(0,fine_arc[-1],6)
tail_bind=np.column_stack([np.interp(tail_arc,fine_arc,fine_tail[:,axis]) for axis in range(2)])
tail_lengths=np.sqrt(np.sum(np.diff(tail_bind,1,0)**2,1))
tail_angles=np.arctan2(np.diff(tail_bind,1,0)[:,1],np.diff(tail_bind,1,0)[:,0])
meshes={name:lattice(images[name],6) for name in ['tail','ruff-foreground']}
weights={}

def along_curve(vertices,points):
    lengths=np.sqrt(np.sum(np.diff(points,1,0)**2,1))
    best=np.full(len(vertices),np.inf)
    result=np.zeros(len(vertices))
    distance=0
    for index,length in enumerate(lengths):
        delta=points[index+1]-points[index]
        fraction=np.clip((vertices-points[index])@delta/(length*length),0,1)
        nearest=points[index]+fraction[:,None]*delta
        error=np.sum((vertices-nearest)**2,1)
        closer=error<best
        result[closer]=distance+fraction[closer]*length
        best[closer]=error[closer]
        distance+=length
    return result,lengths

attachments={}
(folder/'Attachments').mkdir(511,False,True)
for limb in limbs:
    name=limb['id']
    image=images[name]
    yy,xx=np.mgrid[0:512,0:512]
    pixels=np.column_stack((xx.ravel(),yy.ravel()))
    distance,lengths=along_curve(pixels,np.array(limb['bind'],float))
    distance=distance.reshape(512,512)
    bind=np.array(limb['bind'],float)
    distances=[]
    for bone in range(2):
        direction=bind[bone+1]-bind[bone]
        ratio=np.clip((pixels-bind[bone])@direction/(direction@direction),0,1)
        nearest=bind[bone]+ratio[:,None]*direction
        distances.append(np.sqrt(np.sum((pixels-nearest)**2,1)).reshape(512,512))
    radius=22 if name=='fore-near' else 20 if name=='hind-near' else 15
    regions=[(distance<=lengths[0]+14)&(distances[0]<=radius),(distance>=lengths[0]-14)&(yy<=limb['pawY']+10)&(distances[1]<=16),yy>=limb['pawY']-10]
    parts=[]
    for index,region in enumerate(regions):
        part=image.copy()
        alpha=np.array(part.getchannel('A'))
        alpha[~region]=0
        part.putalpha(Image.fromarray(alpha))
        part=Image.alpha_composite(Image.new('RGBA',(512,512)),part)
        part.save(folder/'Attachments'/(name+'-'+str(index)+'.png'))
        parts.append(part)
    attachments[name]=parts

vertices,_=meshes['tail']
distance,_=along_curve(vertices,fine_tail)
centres=(tail_arc[:-1]+tail_arc[1:])/2
weights['tail']=np.zeros((len(vertices),5))
for row,value in enumerate(distance):
    if value<=centres[0]:weights['tail'][row,0]=1
    elif value>=centres[-1]:weights['tail'][row,-1]=1
    else:
        index=int(np.searchsorted(centres,value)-1)
        fraction=(value-centres[index])/(centres[index+1]-centres[index])
        weights['tail'][row,index]=1-fraction
        weights['tail'][row,index+1]=fraction
for name in ['ruff-foreground']:
    vertices,_=meshes[name]
    head=np.clip((190-vertices[:,0])/70,0,1)
    weights[name]=np.column_stack([1-head,head])

def ease(time,start,end):
    value=max(0,min(1,(time-start)/(end-start)))
    return value*value*value*(value*(6*value-15)+10)

def matrix(source,target,angle):
    c,s=math.cos(angle),math.sin(angle)
    rotation=np.array([[c,-s],[s,c]])
    translation=np.array(target)-rotation@np.array(source)
    return np.array([[c,-s,translation[0]],[s,c,translation[1]],[0,0,1]])

def points(transform,vertices):
    return np.column_stack((vertices,np.ones(len(vertices))))@transform[:2].T

def rigid(image,transform):
    inverse=np.linalg.inv(transform)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')

def skin(name,transforms):
    vertices,triangles=meshes[name]
    moved=np.zeros_like(vertices)
    for index,transform in enumerate(transforms):moved+=points(transform,vertices)*weights[name][:,index,None]
    return warp(images[name],vertices,moved,triangles)

def skin_limb(name,bind,target):
    result=Image.new('RGBA',(512,512))
    for index,part in enumerate(attachments[name]):
        if name+'-'+str(index) in rig['hiddenRigidAttachments']:continue
        if index<2:
            initial=bind[index+1]-bind[index]
            current=target[index+1]-target[index]
            angle=math.atan2(current[1],current[0])-math.atan2(initial[1],initial[0])
        else:angle=0
        transform=matrix(bind[index],target[index],angle)
        result=Image.alpha_composite(result,rigid(part,transform))
    return result

def ik(bind,root,target):
    lengths=np.sqrt(np.sum(np.diff(bind,1,0)**2,1))
    delta=target-root
    distance=np.linalg.norm(delta)
    direction=delta/max(.00001,distance)
    distance=max(abs(lengths[0]-lengths[1])+.0001,min(lengths.sum()-.0001,distance))
    along=(lengths[0]**2-lengths[1]**2+distance**2)/(2*distance)
    height=math.sqrt(max(0,lengths[0]**2-along**2))
    perpendicular=np.array([-direction[1],direction[0]])
    initial=bind[2]-bind[0]
    initial/=np.linalg.norm(initial)
    side=np.sign(np.dot(bind[1]-bind[0],np.array([-initial[1],initial[0]])))
    elbow=root+direction*along+perpendicular*height*side
    return np.array([root,elbow,target])

output_scale=1.4182825484764543/1.5547703180212014
output_shift=np.array([0.,111.])-output_scale*np.array([-29.30035335689047,161.92226148409895])
output_matrix=np.array(rig['outputMatrix'],float)

def frame_at(time):
    progress=ease(time,rig['timingKeysMs'][1],rig['timingKeysMs'][2])
    body_angle=math.radians(rig['bodyAngleDegrees'])*progress
    body=matrix(pivot,pivot+np.array([0,rig['bodyDrop']*progress]),body_angle)
    head=body@matrix(neck,neck,math.radians(rig['headAngleDegrees'])*progress)
    posed={}
    landmarks={}
    for limb in limbs:
        name=limb['id']
        bind=np.array(limb['bind'],float)
        target=ik(bind,points(body,bind[:1])[0],bind[2])
        transforms=[]
        for index in range(2):
            initial=bind[index+1]-bind[index]
            current=target[index+1]-target[index]
            angle=math.atan2(current[1],current[0])-math.atan2(initial[1],initial[0])
            transforms.append(matrix(bind[index],target[index],angle))
        transforms.append(matrix(bind[2],target[2],0))
        posed[name]=skin_limb(name,bind,target)
        landmarks[name]={'bind':bind.tolist(),'current':target.tolist(),'matrices':[value.tolist() for value in transforms]}
    tail_points=[points(body,tail_bind[:1])[0]]
    tail_transforms=[]
    offsets=rig['tailOffsetsDegrees']
    delays=rig['tailDelaysMs']
    for index,(angle,length) in enumerate(zip(tail_angles,tail_lengths)):
        amount=ease(time,rig['timingKeysMs'][2]+delays[index],rig['timingKeysMs'][3])
        current_angle=angle+body_angle+math.radians(offsets[index])*amount
        tail_transforms.append(matrix(tail_bind[index],tail_points[index],current_angle-angle))
        tail_points.append(tail_points[-1]+length*np.array([math.cos(current_angle),math.sin(current_angle)]))
    posed['tail']=skin('tail',tail_transforms)
    posed['body-core']=rigid(images['body-core'],body)
    posed['ruff-foreground']=skin('ruff-foreground',[body,head])
    posed['head']=rigid(images['head-skull' if time<rig['eyesClosedAtMs'] else 'head-closed-skull'],head)
    order=rig['order']
    result=Image.new('RGBA',(512,512))
    for name in order:result=Image.alpha_composite(result,posed[name])
    result=rigid(result,output_matrix)
    result=Image.alpha_composite(Image.new('RGBA',(512,512)),result)
    return result,{'timeMs':time,'body':body.tolist(),'head':head.tolist(),'limbs':landmarks,'tailJoints':np.array(tail_points).tolist(),'tailMatrices':[value.tolist() for value in tail_transforms]}

if __name__=='__main__':
    start,body_start,body_end,tail_end,total=rig['timingKeysMs']
    times=[start,body_start]+list(range(body_start+40,body_end,40))+[body_end]+list(range(body_end+40,tail_end,40))+[tail_end]
    durations=[b-a for a,b in zip(times,times[1:]+[total])]
    frames=[]
    records=[]
    for index,time in enumerate(times):
        frame,record=frame_at(time)
        frame.save(folder/'Frames'/(str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append(record)
    columns=4
    rows=(len(frames)+columns-1)//columns
    sheet=Image.new('RGBA',(columns*512,rows*512))
    for index,frame in enumerate(frames):sheet.paste(frame,(index%columns*512,index//columns*512))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    for name,dimensions,images_out in [('preview.webp',(512,512),frames),('thumbnail.webp',(64,64),[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])]:
        writer=_webp.WebPAnimEncoder(dimensions,0,0,False,9,17,False,False)
        timestamp=0
        for frame,duration in zip(images_out,durations):
            writer.add(frame.getim(),timestamp,True,100.0,100.0,3)
            timestamp+=duration
        writer.add(None,timestamp,True,100.0,100.0,0)
        (folder/name).write_bytes(writer.assemble('','',''))
    contact=Image.new('RGB',(columns*256,rows*256),'#354340')
    for index,frame in enumerate(frames):
        small=frame.resize((256,256),Image.Resampling.LANCZOS)
        contact.paste(small,(index%columns*256,index//columns*256),small)
    contact.save(folder/'contact.png')
    (folder/'timeline.json').write_bytes((json.dumps(records)+'\r\n').encode('utf-8'))
    arrays={}
    for name,(vertices,triangles) in meshes.items():
        arrays[name+'-vertices']=vertices
        arrays[name+'-triangles']=triangles
        arrays[name+'-weights']=weights[name]
    np.savez_compressed(folder/'meshes.npz',*arrays.values())
    (folder/'mesh-layout.json').write_bytes((json.dumps(list(arrays))+'\r\n').encode('utf-8'))
    prefix='DesignAssets/Animations/CreatureDeathV8/white-paw/'
    meta={'name':'white-paw','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/white-paw.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','renderer':prefix+'render.py','sourceAuthoring':prefix+'rig.json','sourceFrames':['Frames/'+str(index).zfill(3)+'.png' for index in range(len(frames))]}
    (folder/'death.json').write_bytes((json.dumps(meta)+'\r\n').encode('utf-8'))
    print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'output':str(folder)}))
