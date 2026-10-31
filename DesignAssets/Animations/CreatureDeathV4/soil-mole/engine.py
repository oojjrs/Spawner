import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,_webp

HERE=Path(__file__).resolve().parent

def write_json(path,data):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    path.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def translation(x,y):
    return np.array([[1,0,x],[0,1,y],[0,0,1]],float)

def rotation(pivot,degrees):
    angle=math.radians(degrees)
    c,s=math.cos(angle),math.sin(angle)
    x,y=pivot
    return np.array([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1]],float)

def affine(image,matrix):
    inverse=np.linalg.inv(matrix)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC)

def sample(pixels,x,y):
    x=np.clip(x,0,510.9999)
    y=np.clip(y,0,510.9999)
    ix,iy=x.astype(int),y.astype(int)
    u,v=(x-ix)[:,None],(y-iy)[:,None]
    return (pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v

def make_mesh(image,joints,kind):
    bounds=image.getchannel('A').getbbox()
    xs=list(range(max(0,bounds[0]-8),min(512,bounds[2]+16),8))
    ys=list(range(max(0,bounds[1]-8),min(512,bounds[3]+16),8))
    vertices=[[x,y] for y in ys for x in xs]
    weights=[]
    for x,y in vertices:
        if kind=='leg':
            a=ease((y-joints[1][1]+8)/16)
            b=ease((y-joints[2][1]+3)/6)
            weights.append([1-a,a*(1-b),a*b])
        elif kind=='ear':
            distance=np.linalg.norm(np.array([x,y])-np.array(joints[0]))
            a=ease((distance-20)/35)
            extent=np.linalg.norm(np.array(joints[2])-np.array(joints[0]))
            b=ease((distance-extent+10)/25)
            weights.append([1-a,a*(1-b),a*b])
        else:
            tail=max(0,min(1,(x-87)/367))
            weights.append([1-tail,0,tail])
    triangles=[]
    alpha=np.asarray(image)[:,:,3]
    for row in range(len(ys)-1):
        for col in range(len(xs)-1):
            if np.any(alpha[ys[row]:ys[row+1]+1,xs[col]:xs[col+1]+1]):
                n=row*len(xs)+col
                triangles.extend([[n,n+1,n+len(xs)],[n+1,n+len(xs)+1,n+len(xs)]])
    return {'vertices':vertices,'weights':weights,'triangles':triangles,'joints':joints,'kind':kind,'step':8}

def mesh_render(image,mesh,matrices):
    vertices=np.asarray(mesh['vertices'],float)
    homogeneous=np.column_stack((vertices,np.ones(len(vertices))))
    transformed=np.einsum('bij,vj->bvi',np.asarray(matrices),homogeneous)[:,:,:2]
    posed=np.einsum('vb,bvi->vi',np.asarray(mesh['weights']),transformed)
    return rasterize(image,mesh,posed)

def leg_matrices(joints,body_matrix,bend,target_offset):
    hip,knee,ankle=np.asarray(joints,float)
    first_delta=knee-hip
    end_delta=ankle-hip
    bend=-1 if first_delta[0]*end_delta[1]-first_delta[1]*end_delta[0]>0 else 1
    hip_now=(body_matrix@np.array([hip[0],hip[1],1]))[:2]
    target=ankle+np.asarray(target_offset,float)
    delta=target-hip_now
    length1=np.linalg.norm(knee-hip)
    length2=np.linalg.norm(ankle-knee)
    distance=min(length1+length2-.01,max(abs(length1-length2)+.01,np.linalg.norm(delta)))
    direction=math.atan2(delta[1],delta[0])
    offset=math.acos(max(-1,min(1,(distance*distance+length1*length1-length2*length2)/(2*distance*length1))))
    target=hip_now+distance*np.array([math.cos(direction),math.sin(direction)])
    angle=direction+bend*offset
    elbow=hip_now+length1*np.array([math.cos(angle),math.sin(angle)])
    lower=math.atan2(target[1]-elbow[1],target[0]-elbow[0])
    bind1=math.atan2(knee[1]-hip[1],knee[0]-hip[0])
    bind2=math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])
    first=translation(hip_now[0],hip_now[1])@rotation((0,0),math.degrees(angle-bind1))@translation(-hip[0],-hip[1])
    second=translation(elbow[0],elbow[1])@rotation((0,0),math.degrees(lower-bind2))@translation(-knee[0],-knee[1])
    foot=translation(target[0]-ankle[0],target[1]-ankle[1])
    return [first,second,foot],{'hip':hip_now.tolist(),'knee':elbow.tolist(),'ankle':target.tolist(),'upperLength':float(np.linalg.norm(elbow-hip_now)),'lowerLength':float(np.linalg.norm(target-elbow))}

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))


def scalar(time,keys):
    if time<=keys[0][0]:
        return keys[0][1]
    for left,right in zip(keys,keys[1:]):
        if time<=right[0]:
            u=(time-left[0])/(right[0]-left[0])
            if right[2]=='accelerate':
                u=u*u
            elif right[2]=='smooth':
                u=ease(u)
            return left[1]+(right[1]-left[1])*u
    return keys[-1][1]

def rasterize(image,mesh,posed):
    pixels=np.array(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    vertices=np.asarray(mesh['vertices'],float)
    output=np.zeros((512,512,4),float)
    source_map=np.full((512,512,2),np.nan,float)
    for indices in mesh['triangles']:
        destination=posed[indices]
        source=vertices[indices]
        lower=np.maximum(np.floor(destination.min(0)).astype(int),0)
        upper=np.minimum(np.ceil(destination.max(0)).astype(int),511)
        if np.any(upper<lower):
            continue
        x,y=np.meshgrid(np.arange(lower[0],upper[0]+1),np.arange(lower[1],upper[1]+1))
        system=np.vstack((destination.T,np.ones(3)))
        if abs(np.linalg.det(system))<0.01:
            continue
        barycentric=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
        inside=np.all(barycentric>=-0.00001,0)
        coordinates=source.T@barycentric[:,inside]
        rows=y.ravel()[inside]
        columns=x.ravel()[inside]
        color=sample(pixels,coordinates[0],coordinates[1])
        previous=source_map[rows,columns]
        different=np.isnan(previous[:,0])|np.any(abs(previous-coordinates.T)>0.0001,1)
        visible=(color[:,3]>0)&different
        rows,columns=rows[visible],columns[visible]
        color=color[visible]
        output[rows,columns]=color+output[rows,columns]*(1-color[:,3:4])
        source_map[rows,columns]=coordinates.T[visible]
    alpha=output[:,:,3:4]
    rgb=output[:,:,:3]/np.maximum(alpha,1/255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate((rgb,alpha),2)*255+.5,0,255))),posed

