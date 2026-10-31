import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SIZE=512


def smooth(value):
    u=max(0.0,min(1.0,float(value)))
    return u*u*(3-2*u)


def matrix(pivot,angle,translation):
    theta=math.radians(angle)
    rotation=np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
    result=np.eye(3)
    result[:2,:2]=rotation
    result[:2,2]=np.array(pivot)+np.array(translation)-rotation@np.array(pivot)
    return result


def transform(image,pose):
    inverse=np.linalg.inv(pose)
    return image.convert('RGBa').transform((SIZE,SIZE),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')


def premultiply(image):
    values=np.array(image).astype(np.float32)/255
    values[:,:,:3]*=values[:,:,3:4]
    return values


def to_image(values):
    alpha=np.clip(values[:,:,3:4],0,1)
    rgb=np.clip(values[:,:,:3],0,alpha)/np.maximum(alpha,1/255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+0.5,0,255)))


def at_time(rig,time):
    keys=rig['keys']
    for first,last in zip(keys,keys[1:]):
        if time<=last['timeMs']:
            u=smooth((time-first['timeMs'])/(last['timeMs']-first['timeMs']))
            return {name:np.array(first[name])+(np.array(last[name])-np.array(first[name]))*u for name in ['head','body','pressure','headAngle','bodyAngle']}
    return {name:np.array(keys[-1][name]) for name in ['head','body','pressure','headAngle','bodyAngle']}


def solve(joints,root,hand):
    a,b,c=np.array(joints)
    upper,lower=np.linalg.norm(b-a),np.linalg.norm(c-b)
    delta=hand-root
    distance=max(0.001,min(float(np.linalg.norm(delta)),upper+lower-0.001))
    direction=delta/max(0.001,float(np.linalg.norm(delta)))
    along=(upper*upper-lower*lower+distance*distance)/(2*distance)
    height=math.sqrt(max(0,upper*upper-along*along))
    orientation=np.sign((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))
    elbow=root+direction*along+np.array([-direction[1],direction[0]])*height*orientation
    points=[root,elbow,hand]
    transforms=[]
    for index in range(2):
        source=[a,b,c][index:index+2]
        target=points[index:index+2]
        angle=math.atan2(*(target[1]-target[0])[::-1])-math.atan2(*(source[1]-source[0])[::-1])
        rotation=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])
        pose=np.eye(3)
        pose[:2,:2]=rotation
        pose[:2,2]=target[0]-rotation@source[0]
        transforms.append(pose)
    return points,transforms


def make_skin(image,limb):
    alpha=np.array(image)[:,:,3]
    ys,xs=np.where(alpha>2)
    left,right=max(0,int(xs.min())-3),min(511,int(xs.max())+3)
    top,bottom=max(0,int(ys.min())-3),min(511,int(ys.max())+3)
    xx=np.linspace(left,right,max(3,math.ceil((right-left)/4)+1))
    yy=np.linspace(top,bottom,max(3,math.ceil((bottom-top)/4)+1))
    a,b,c=np.array(limb['joints'])
    upper,lower=np.linalg.norm(b-a),np.linalg.norm(c-b)
    vertices,weights=[],[]
    for y in yy:
        for x in xx:
            point=np.array([x,y])
            axis=(b-a)/upper+(c-b)/lower
            axis/=np.linalg.norm(axis)
            along=float(np.dot(point-b,axis))
            weight=smooth((along+limb['blendWidth']/2)/limb['blendWidth'])
            vertices.append([float(x),float(y)])
            weights.append([1-weight,weight])
    triangles=[]
    for y in range(len(yy)-1):
        for x in range(len(xx)-1):
            i=y*len(xx)+x
            for face in [[i,i+1,i+len(xx)],[i+1,i+len(xx)+1,i+len(xx)]]:
                points=np.array([vertices[j] for j in face])
                lo=np.floor(points.min(0)).astype(int)
                hi=np.ceil(points.max(0)).astype(int)
                if alpha[lo[1]:hi[1]+1,lo[0]:hi[0]+1].max()>2:
                    triangles.append(face)
    return {'vertices':vertices,'weights':weights,'triangles':triangles}


def dual_skin(mesh,transforms):
    real,dual=[],[]
    for pose in transforms:
        angle=math.atan2(pose[1,0],pose[0,0])
        w,z=math.cos(angle/2),math.sin(angle/2)
        tx,ty=pose[:2,2]
        real.append([w,z])
        dual.append([0.5*(tx*w+ty*z),0.5*(ty*w-tx*z)])
    for index in range(1,len(real)):
        if np.dot(real[0],real[index])<0:
            real[index]=(-np.array(real[index])).tolist()
            dual[index]=(-np.array(dual[index])).tolist()
    weights=np.array(mesh['weights'])
    q=weights@np.array(real)
    d=weights@np.array(dual)
    norm=np.sqrt((q*q).sum(1))[:,None]
    q/=norm
    d/=norm
    cosine=q[:,0]**2-q[:,1]**2
    sine=2*q[:,0]*q[:,1]
    x,y=np.array(mesh['vertices']).T
    tx=2*(d[:,0]*q[:,0]-d[:,1]*q[:,1])
    ty=2*(d[:,1]*q[:,0]+d[:,0]*q[:,1])
    return np.column_stack([cosine*x-sine*y+tx,sine*x+cosine*y+ty])


def draw_skin(image,mesh,posed):
    vertices=np.array(mesh['vertices'])
    uv=np.full((SIZE,SIZE,2),-1000,np.float32)
    reversals=[]
    for face in mesh['triangles']:
        target,source=posed[face],vertices[face]
        ab,ac=target[1]-target[0],target[2]-target[0]
        determinant=ab[0]*ac[1]-ab[1]*ac[0]
        if determinant<=0:
            reversals.append([int(v) for v in face])
        lo=np.maximum(0,np.floor(target.min(0)).astype(int))
        hi=np.minimum(511,np.ceil(target.max(0)).astype(int))
        system=np.vstack([target.T,np.ones(3)])
        if np.any(hi<lo) or abs(np.linalg.det(system))<0.001:
            continue
        gx,gy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
        bary=np.linalg.inv(system)@np.array([gx.ravel(),gy.ravel(),np.ones(gx.size)])
        inside=np.all(bary>=-0.00001,0)
        uv[gy.ravel()[inside],gx.ravel()[inside]]=(source.T@bary[:,inside]).T
    sampled=cv2.remap(premultiply(image),uv,None,cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    return to_image(sampled),reversals


def eyelids(head,images,time):
    gy,gx=np.mgrid[:SIZE,:SIZE]
    progress=smooth(time/180)
    result=head.copy()
    for side,(left,top,right,bottom) in [('near',(202,196,266,257)),('far',(132,183,182,232))]:
        image=images['eyelid-'+side]
        values=np.array(image)
        edge=top+(bottom-top)*progress
        coverage=np.clip(edge-gy+0.5,0,1)
        if progress<=0:
            coverage*=0
        values[:,:,3]=np.rint(values[:,:,3]*coverage).astype(np.uint8)
        result.alpha_composite(Image.fromarray(values))
    return result


def draw_pouch(image,head,pressure,attachment):
    gy,gx=np.mgrid[:SIZE,:SIZE].astype(np.float32)
    release=1-float(pressure)
    width=1-0.16*release
    source_x=300+(gx-head[0]-300)/width
    top=np.interp(source_x.ravel(),np.arange(512),attachment).reshape(source_x.shape)
    factor=np.maximum(0.15,(435-top-head[1])/(435-top))
    source_y=top+(gy-top-head[1])/factor
    u=np.clip((source_x-73)/236,0,1)
    v=np.clip((source_y-top)/(435-top),0,1)
    fold=release*release*np.sin(math.pi*u)**2
    crease=0.35+0.12*(u-0.5)
    source_y+=3.5*fold*np.exp(-((v-crease)/0.10)**2)
    values=cv2.remap(premultiply(image),source_x.astype(np.float32),source_y.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    shade=1-0.16*fold*np.exp(-((v-crease)/0.025)**2)+0.07*fold*np.exp(-((v-crease-0.045)/0.04)**2)
    values[:,:,:3]*=shade[:,:,None]
    return to_image(values)


def chest_weights(point,rig):
    x,y=point
    core=max(smooth((x-278)/22),1-smooth((y-315)/100))
    return [core,0.0,1-core]


def build_skins(images,rig):
    skins={side:make_skin(images['arm-'+side],rig['limbs'][side]) for side in ['near','far']}
    mesh=make_skin(images['torso'],{'joints':[[0,0],[1,0],[2,0]],'blendWidth':1})
    mesh['weights']=[chest_weights(point,rig) for point in mesh['vertices']]
    skins['neck']=mesh
    for name,skin in skins.items():
        skin['boneNames']=rig['meshBones'][name]
    return skins


def insert_root(arm,background,root):
    pixels=np.array(arm)
    under=np.array(background)
    gy,gx=np.mgrid[:SIZE,:SIZE]
    local=(gx-root[0])**2+(gy-root[1])**2<24**2
    distance=cv2.distanceTransform(np.uint8(pixels[:,:,3]>128),cv2.DIST_L2,3)
    edge=1-np.clip((distance-0.5)/2.5,0,1)
    ink=np.clip((140-pixels[:,:,1].astype(np.float32))/65,0,1)
    coverage=under[:,:,3]/255*local
    pixels[:,:,3]=np.rint(pixels[:,:,3]*(1-edge*ink*coverage)).astype(np.uint8)
    return Image.fromarray(pixels)


def render_frame(rig,images,skins,time):
    state=at_time(rig,time)
    body=matrix([0,0],float(state['bodyAngle']),state['body'])
    head=matrix([0,0],float(state['headAngle']),state['head'])
    neck_layer,neck_bad=draw_skin(images['torso'],skins['neck'],dual_skin(skins['neck'],[body,head,np.eye(3)]))
    layers={
        'torso':neck_layer,
        'pouch':draw_pouch(images['pouch'],(head@np.array([230,260,1]))[:2]-np.array([230,260]),state['pressure'],rig['pouchAttachmentY']),
        'head':transform(eyelids(images['head'],images,time),head),
        'hand-near':images['hand-near'],'hand-far':images['hand-far']}
    relax=smooth((time-650)/420)
    layers['hind-near']=transform(images['hind-near'],matrix([390,439],-2*relax,[0,0]))
    layers['hind-far']=transform(images['hind-far'],matrix([417,431],1.5*relax,[0,0]))
    data={'timeMs':time,'headMatrix':head.tolist(),'bodyMatrix':body.tolist(),'limbs':{},'reversed':{'neck':len(neck_bad)}}
    for side in ['near','far']:
        limb=rig['limbs'][side]
        root=(body@np.array(limb['shoulder']+[1.0]))[:2]
        if side=='far':
            root=np.array(limb['shoulder'])+np.array([0,min(12.0,max(0.0,float(state['head'][1]))*0.115)])
        points,poses=solve(limb['joints'],root,np.array(limb['hand']))
        posed=dual_skin(skins[side],poses)
        layers['arm-'+side],bad=draw_skin(images['arm-'+side],skins[side],posed)
        data['limbs'][side]={'joints':[p.tolist() for p in points],'boneMatrices':[pose.tolist() for pose in poses]}
        data['reversed'][side]=len(bad)
    base=Image.new('RGBA',(SIZE,SIZE))
    for name in rig['drawOrder']:
        if name=='arm-near':
            layers[name]=insert_root(layers[name],layers['torso'],np.array(data['limbs']['near']['joints'][0]))
        base.alpha_composite(layers[name])
    return base,data,layers


def render_frames(folder,meta):
    source=folder/'Source'
    rig=json.loads((source/'rig.json').read_text('utf-8'))
    images={name:Image.open(source/path).convert('RGBA') for name,path in rig['parts'].items()}
    skins=build_skins(images,rig)
    time=0
    frames,samples=[],[]
    for index,duration in enumerate(meta['durationsMs']):
        frame,state,layers=render_frame(rig,images,skins,time)
        frame.save(folder/meta['sourceFrames'][index])
        frames.append(frame)
        samples.append(state)
        time+=duration
    encoder=json.JSONEncoder()
    encoder.indent=2
    encoder.item_separator=','
    for name,data in [('samples.json',samples),('skins.json',skins)]:
        (source/name).write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))
    return frames
