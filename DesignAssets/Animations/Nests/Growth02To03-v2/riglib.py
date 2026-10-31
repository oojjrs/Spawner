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
    a=np.array(image.convert('RGBA')).astype(np.float32)/255
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

def poly(points):
    mask=Image.new('L',(SIZE,SIZE))
    ImageDraw.Draw(mask).polygon(points,255)
    return np.array(mask)>0

def bounds(image):
    return image.getchannel('A').point(lambda x:255 if x>24 else 0).getbbox()

def normalize(image,box):
    crop=image.crop(bounds(image))
    width=box[2]-box[0]
    height=box[3]-box[1]
    crop=crop.convert('RGBa').resize((width,height),Image.Resampling.LANCZOS).convert('RGBA')
    result=Image.new('RGBA',(512,512))
    result.alpha_composite(crop,(box[0],box[1]))
    return premul(result)

def affine(layer,pivot,scale,angle,offset):
    radians=math.radians(angle)
    c=math.cos(radians)
    s=math.sin(radians)
    dx=X-pivot[0]-offset[0]
    dy=Y-pivot[1]-offset[1]
    xx=(dx*c+dy*s)/scale[0]+pivot[0]
    yy=(-dx*s+dy*c)/scale[1]+pivot[1]
    return cv2.remap(layer,xx.astype(np.float32),yy.astype(np.float32),cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)

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
        for value in np.linspace(0,count,32,False):
            at=start+value
            low=int(at)%len(curve)
            high=(low+1)%len(curve)
            fraction=at-math.floor(at)
            result.append(curve[low]*(1-fraction)+curve[high]*fraction)
    result=np.array(result)
    result=np.concatenate([result,np.mean(result,0)[None,:]],0)
    return result

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
    result[top:bottom,left:right]=cv2.remap(layer,field[:,:,0].astype(np.float32),field[:,:,1].astype(np.float32),cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)
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
    distance=np.linalg.norm(pa-np.array(root),axis=1)
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

def opaque_image(path):
    pixels=np.array(Image.open(path).convert('RGBA'))
    pixels[:,:,3][pixels[:,:,3]>240]=255
    return Image.fromarray(pixels,'RGBA')

_ATLAS_CACHE={}

def part_from_grid(path,columns,rows,column,row):
    cache_key=(str(path),columns,rows)
    if cache_key not in _ATLAS_CACHE:
        image=Image.open(path).convert('RGBA')
        pixels=np.array(image)
        if np.min(pixels[:,:,3])<100:
            total,labels,stats,centers=cv2.connectedComponentsWithStats((pixels[:,:,3]>128).astype(np.uint8),8)
            entries=[]
            for label in range(1,total):
                if stats[label,4]>500:
                    entries.append((centers[label],labels==label))
        else:
            rgb=pixels[:,:,:3].astype(float)
            edge=((rgb[:,:,1]>rgb[:,:,0]*1.10)&(rgb[:,:,2]>rgb[:,:,0]*1.05)&(rgb[:,:,0]<90)&(rgb[:,:,1]<170)).astype(np.uint8)
            edge=cv2.morphologyEx(edge,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
            contours,_=cv2.findContours(edge,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            entries=[]
            for contour in contours:
                if cv2.contourArea(contour)>500:
                    mask=np.zeros(edge.shape,np.uint8)
                    cv2.drawContours(mask,[contour],0,1,-1)
                    x,y,w,h=cv2.boundingRect(contour)
                    entries.append((np.array([x+w/2,y+h/2]),mask>0))
        _ATLAS_CACHE[cache_key]=(image,pixels,entries)
    image,pixels,entries=_ATLAS_CACHE[cache_key]
    selected=[mask for center,mask in entries if column*image.width/columns<=center[0]<(column+1)*image.width/columns and row*image.height/rows<=center[1]<(row+1)*image.height/rows]
    if selected:
        mask=np.any(np.stack(selected),0)
        yy,xx=np.where(mask)
        x0=max(0,int(xx.min())-2)
        y0=max(0,int(yy.min())-2)
        x1=min(image.width,int(xx.max())+3)
        y1=min(image.height,int(yy.max())+3)
        result=pixels[y0:y1,x0:x1].copy()
        selected_alpha=cv2.dilate(mask.astype(np.uint8),np.ones((3,3),np.uint8))[y0:y1,x0:x1]
        if np.min(pixels[:,:,3])<100:
            result[:,:,3]*=selected_alpha
        else:
            result[:,:,3]=selected_alpha*255
        return Image.fromarray(result,'RGBA')
    return image.crop((round(column*image.width/columns),round(row*image.height/rows),round((column+1)*image.width/columns),round((row+1)*image.height/rows)))

def atlas_part(path,column,row,rows):
    return part_from_grid(path,4,rows,column,row)

def legacy_atlas_part(path,column,row,rows):
    atlas=Image.open(path).convert('RGBA')
    cell=atlas.crop((round(column*atlas.width/4),round(row*atlas.height/rows),round((column+1)*atlas.width/4),round((row+1)*atlas.height/rows)))
    a=np.array(cell)
    if np.min(a[:,:,3])>200:
        r=a[:,:,0].astype(float)
        g=a[:,:,1].astype(float)
        b=a[:,:,2].astype(float)
        edge=((g>r*1.10)&(b>r*1.05)&(r<90)&(g<170)).astype(np.uint8)
        edge=cv2.morphologyEx(edge,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
        contours,_=cv2.findContours(edge,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            mask=np.zeros_like(edge)
            cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],0,255,-1)
            a[:,:,3]=mask
            cell=Image.fromarray(a,'RGBA')
    return cell

def phases(index):
    close=smooth(index/18) if index<=18 else 1
    growth=0 if index<=23 else smooth((index-23)/10)
    opened=0 if index<=33 else smooth((index-33)/27)
    return close,growth,opened

def export(frames,folder,metadata):
    folder=Path(folder)
    folder.mkdir(511,True,True)
    durations=[500]+[40]*(len(frames)-2)+[900]
    pack(frames,folder/'growth.png',8)
    animated(frames,folder/'growth.webp',durations)
    animated([preview(frame).resize((384,384),Image.Resampling.LANCZOS) for frame in frames],folder/'preview.webp',durations)
    contact=Image.new('RGB',(1536,768),'#13201c')
    for i,index in enumerate([0,8,16,22,30,40,50,60]):
        contact.paste(preview(frames[index]).resize((384,384),Image.Resampling.LANCZOS),(i%4*384,i//4*384))
    contact.save(folder/'contact.png')
    metadata.update({'frameSize':[512,512],'frameCount':len(frames),'columns':8,'rows':(len(frames)+7)//8,'durationsMs':durations,'root':[256,448],'loop':False})
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
