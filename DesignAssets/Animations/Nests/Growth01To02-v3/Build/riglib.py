from pathlib import Path

from PIL import Image, ImageDraw, WebPImagePlugin

import numpy as np

import math

import json

import sys

import cv2

SIZE=512

Y,X=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)

def smooth(t):
    t=float(np.clip(t,0,1))
    return t*t*t*(10+t*(-15+6*t))

def premul(image):
    a=np.array(clean_matte(image)).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a

def rgba(a):
    alpha=np.clip(a[:,:,3:4],0,1)
    rgb=a[:,:,:3]/np.maximum(alpha,1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)),'RGBA')

def over(front,back):
    return front+back*(1-front[:,:,3:4])

def padded_material(layer):
    rgb=layer[:,:,:3]/np.maximum(layer[:,:,3:4],1e-6)
    rgb=cv2.inpaint(np.uint8(np.clip(rgb*255,0,255)),np.uint8(layer[:,:,3]<.95)*255,3,cv2.INPAINT_TELEA).astype(np.float32)/255
    return np.concatenate([rgb,np.ones((512,512,1),np.float32)],2)

def affine(layer,pivot,scale,angle,offset):
    radians=math.radians(angle)
    c=math.cos(radians)
    s=math.sin(radians)
    dx=X-pivot[0]-offset[0]
    dy=Y-pivot[1]-offset[1]
    xx=(dx*c+dy*s)/scale[0]+pivot[0]
    yy=(-dx*s+dy*c)/scale[1]+pivot[1]
    return cv2.remap(layer,xx.astype(np.float32),yy.astype(np.float32),cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)

def tps(layer,source,target):
    if np.max(np.abs(source-target))<1e-6:
        return layer.copy()
    target=np.array(target,np.float64)
    source=np.array(source,np.float64)
    delta=target[:,None,:]-target[None,:,:]
    rr=np.sum(delta*delta,2)
    kernel=rr*np.log(rr+1e-6)
    affine_part=np.column_stack([np.ones(len(target)),target])
    system=np.block([[kernel+np.eye(len(target))*.02,affine_part],[affine_part.T,np.zeros((3,3))]])
    weights=np.linalg.solve(system,np.concatenate([source,np.zeros((3,2))],0))
    left=max(0,int(np.min(target[:,0]))-7)
    top=max(0,int(np.min(target[:,1]))-7)
    right=min(512,int(np.max(target[:,0]))+8)
    bottom=min(512,int(np.max(target[:,1]))+8)
    yy,xx=np.mgrid[top:bottom,left:right].astype(np.float64)
    field=weights[-3]+xx[:,:,None]*weights[-2]+yy[:,:,None]*weights[-1]
    for point,weight in zip(target,weights[:-3]):
        radius=(xx-point[0])**2+(yy-point[1])**2
        field+=(radius*np.log(radius+1e-6))[:,:,None]*weight
    result=np.zeros_like(layer)
    border=cv2.BORDER_REPLICATE if layer[:,:,3].min()>.99 else cv2.BORDER_CONSTANT
    result[top:bottom,left:right]=cv2.remap(layer,field[:,:,0].astype(np.float32),field[:,:,1].astype(np.float32),cv2.INTER_LINEAR,border)
    if border==cv2.BORDER_CONSTANT:
        result*=contour_mask(target)[:,:,None]
    return result

def skin(points,root,joint,theta,phi,weight):
    theta=math.radians(theta)
    phi=math.radians(phi)
    r=np.array([[math.cos(theta),-math.sin(theta)],[math.sin(theta),math.cos(theta)]])
    r2=np.array([[math.cos(phi),-math.sin(phi)],[math.sin(phi),math.cos(phi)]])
    root=np.array(root)
    joint=np.array(joint)
    parent=(points-root)@r.T+root
    child=((points-joint)@r2.T+joint-root)@r.T+root
    return parent*(1-weight[:,None])+child*weight[:,None]

def morph(a,b,pa,pb,q,root,joint,angle):
    if q<=0:
        return a.copy()
    if q>=1:
        return b.copy()
    distance=np.linalg.norm(pa-np.array(root),None,1)
    weight=np.clip(distance/160,0,1)
    posed=skin(pa,root,joint,angle*q,-angle*.45*q,weight)
    end=skin(pa,root,joint,angle,-angle*.45,weight)
    posed+=(pb-end)*q
    aa=tps(a,pa,posed)
    bb=tps(b,pb,posed)
    return aa*(1-q)+bb*q

def branches(points,root,angle):
    root=np.array(root)
    delta=points-root
    factor=np.clip(np.abs(delta[:,0])/120,0,1)
    theta=np.radians(np.sign(delta[:,0])*angle*factor)
    c=np.cos(theta)
    s=np.sin(theta)
    return root+np.column_stack([delta[:,0]*c-delta[:,1]*s,delta[:,0]*s+delta[:,1]*c])

def morph_branches(a,b,pa,pb,q,root,angle):
    if q<=0:
        return a.copy()
    if q>=1:
        return b.copy()
    posed=branches(pa,root,angle*q)
    end=branches(pa,root,angle)
    posed+=(pb-end)*q
    return tps(a,pa,posed)*(1-q)+tps(b,pb,posed)*q

def phases(index):
    close=smooth(index/18) if index<=18 else 1
    growth=0 if index<=23 else smooth((index-23)/10)
    opened=0 if index<=33 else smooth((index-33)/27)
    return close,growth,opened

def export(frames,folder,metadata):
    frames=[clean_matte(frame) for frame in frames]
    folder=Path(folder)
    folder.mkdir(511,True,True)
    existing=folder/'animation.json'
    if existing.exists():
        attachments=json.loads(existing.read_text('utf-8'))
        for field in ['audio','markersMs']:
            if field in attachments:
                metadata[field]=attachments[field]
    durations=[500]+[40]*(len(frames)-2)+[900]
    frames[-1].save(folder/'level-02.png')
    pack(frames,folder/'growth.png',8)
    animated(frames,folder/'growth.webp',durations)
    project=folder.parents[4]
    preview_path=project/'DesignAssets/Planning/Previews/Nests'/(folder.name+'-stage-01-to-02-v3.webp')
    animated([preview(frame).resize((384,384),Image.Resampling.LANCZOS) for frame in frames],preview_path,durations)
    contact=Image.new('RGB',(1536,768),'#13201c')
    for i,index in enumerate([0,8,16,22,30,40,50,60]):
        contact.paste(preview(frames[index]).resize((384,384),Image.Resampling.LANCZOS),(i%4*384,i//4*384))
    scratch=project/'$Trash/NestGrowthConcept-v4'
    scratch.mkdir(511,True,True)
    contact.save(scratch/(folder.name+'-final-contact.png'))
    if 'markersMs' in metadata and 'markersMs' in attachments:
        metadata['markersMs']=metadata.get('phaseMarkers',metadata['markersMs'])
    metadata.pop('phaseMarkers',None)
    metadata.update({'frameSize':[512,512],'frameCount':len(frames),'columns':8,'rows':(len(frames)+7)//8,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True})
    json_write(folder/'animation.json',metadata)

def pack(frames,path,columns):
    sheet=Image.new('RGBA',(512*columns,512*((len(frames)+columns-1)//columns)))
    for i,frame in enumerate(frames):
        sheet.paste(frame,(i%columns*512,i//columns*512))
    sheet.save(path)

def animated(frames,path,durations):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
    with Path(path).open('wb') as stream:
        WebPImagePlugin._save_all(frames[0],stream,str(path))

def preview(frame):
    background=Image.new('RGB',(512,512),'#13201c')
    background.paste(frame,(0,0),frame)
    return background

def json_write(path,data):
    Path(path).write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def clean_matte(image):
    a=np.array(image.convert('RGBA')).copy()
    if a[:,:,3].min()>250 or a[:,:,3].max()==0:
        return image.convert('RGBA')
    core=np.uint8(a[:,:,3]>=140)
    core=cv2.medianBlur(core,3)
    core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    count,labels,stats,centers=cv2.connectedComponentsWithStats(core,8)
    keep=np.zeros(count,np.uint8)
    for label in range(1,count):
        if stats[label,4]>=12:
            keep[label]=1
    core=keep[labels]
    if not core.any():
        return Image.fromarray(np.zeros_like(a),'RGBA')
    inner=cv2.erode(core,np.ones((3,3),np.uint8))
    if not inner.any():
        inner=core
    distance,nearest=cv2.distanceTransformWithLabels(1-inner,cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
    colors=np.zeros((int(nearest.max())+1,3),np.uint8)
    colors[nearest[inner>0]]=a[:,:,:3][inner>0]
    rim=(a[:,:,3]<245)|(inner==0)
    a[:,:,:3][rim]=colors[nearest][rim]
    a[:,:,3]=np.uint8(np.clip(cv2.GaussianBlur(core.astype(np.float32),(3,3),.45)*255+.5,0,255))
    a[a[:,:,3]==0,:3]=0
    return Image.fromarray(a,'RGBA')

def contour_mask(controls):
    ring=np.array(controls[:-1],np.float32)
    samples=[]
    for i,p1 in enumerate(ring):
        p0=ring[(i-1)%len(ring)]
        p2=ring[(i+1)%len(ring)]
        p3=ring[(i+2)%len(ring)]
        for t in [0,.25,.5,.75]:
            samples.append(((1-t)**3*p0+(3*t**3-6*t*t+4)*p1+(-3*t**3+3*t*t+3*t+1)*p2+t**3*p3)/6)
    mask=np.zeros((512,512),np.uint8)
    cv2.fillPoly(mask,[np.int32(np.array(samples)*8)],255,cv2.LINE_AA,3)
    return cv2.dilate(mask,np.ones((3,3),np.uint8)).astype(np.float32)/255

def water_surface(layer,source,target):
    target=np.array(target,np.float64)
    source=np.array(source,np.float64)
    delta=target[:,None,:]-target[None,:,:]
    rr=np.sum(delta*delta,2)
    kernel=rr*np.log(rr+1e-6)
    ap=np.column_stack([np.ones(len(target)),target])
    system=np.block([[kernel+np.eye(len(target))*.02,ap],[ap.T,np.zeros((3,3))]])
    weights=np.linalg.solve(system,np.concatenate([source,np.zeros((3,2))],0))
    field=weights[-3]+X[:,:,None]*weights[-2]+Y[:,:,None]*weights[-1]
    for point,weight in zip(target,weights[:-3]):
        radius=(X-point[0])**2+(Y-point[1])**2
        field+=(radius*np.log(radius+1e-6))[:,:,None]*weight
    return cv2.remap(layer,field[:,:,0].astype(np.float32),field[:,:,1].astype(np.float32),cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)

def contour_points(layer,anchors):
    mask=np.uint8(layer[:,:,3]>.15)
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    curve=max(contours,key=cv2.contourArea)[:,0,:].astype(np.float64)
    choices=[]
    for direction in [1,-1]:
        cc=curve[::direction]
        indices=[int(np.argmin(np.sum((cc-np.array(a))**2,1))) for a in anchors]
        distance=sum((indices[(i+1)%len(indices)]-indices[i])%len(cc) for i in range(len(indices)))
        choices.append((distance,cc,indices))
    distance,curve,indices=min(choices,key=lambda x:x[0])
    if distance!=len(curve):
        raise ValueError(('noncyclic contour anchors',anchors,distance,len(curve)))
    result=[]
    for i,start in enumerate(indices):
        end=indices[(i+1)%len(indices)]
        count=(end-start)%len(curve)
        for value in np.linspace(0,count,9,False):
            at=start+value
            low=int(at)%len(curve)
            high=(low+1)%len(curve)
            fraction=at-math.floor(at)
            result.append(curve[low]*(1-fraction)+curve[high]*fraction)
    result=np.array(result)
    result=np.concatenate([result,np.mean(result,0)[None,:]],0)
    return result
