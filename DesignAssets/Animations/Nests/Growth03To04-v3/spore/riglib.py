from pathlib import Path

from PIL import Image, ImageDraw

import numpy as np

import cv2

import json

import math

Y,X=np.mgrid[:512,:512].astype(np.float32)

def read(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a

def rgba(a):
    a=np.clip(a,0,1);rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8)
    pixels=np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255));pixels[pixels[:,:,3]==0,:3]=0;return Image.fromarray(pixels)

def over(front,back):
    return front+back*(1-front[:,:,3:4])

def ease(t):
    t=float(np.clip(t,0,1));return t*t*t*(10+t*(-15+6*t))

def matrix(origin,angle):
    t=math.radians(angle);c,s=math.cos(t),math.sin(t)
    return np.array([[c,-s,origin[0]],[s,c,origin[1]],[0,0,1]],float)

def apply(m,points):
    p=np.column_stack([points,np.ones(len(points))]);return (m@p.T).T[:,:2]

def affine(im,m):
    return cv2.warpAffine(im,m[:2].astype(np.float32),(512,512),None,cv2.INTER_LANCZOS4,cv2.BORDER_CONSTANT,(0,0,0,0))

def rigid(im,pivot,angle,shift):
    return affine(im,matrix((pivot[0]+shift[0],pivot[1]+shift[1]),angle)@matrix((-pivot[0],-pivot[1]),0))

def shift(im,offset):return rigid(im,(0,0),0,offset)

def contour(im,landmarks,counts):
    alpha=im[:,:,3]>.1;found=cv2.findContours(np.uint8(alpha),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0]
    curve=found[int(np.argmax([cv2.contourArea(c) for c in found]))][:,0,:].astype(float)
    if cv2.contourArea(curve.astype(np.float32),True)<0:curve=curve[::-1]
    indexes=[int(np.argmin(np.linalg.norm(curve-np.array(p),None,1))) for p in landmarks]
    if any((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve)==0 for k in range(len(indexes))):raise ValueError('Duplicate contour landmarks')
    total=sum((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve) for k in range(len(indexes)))
    if total!=len(curve):
        curve=curve[::-1];indexes=[len(curve)-1-v for v in indexes]
        total=sum((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve) for k in range(len(indexes)))
    if total!=len(curve):raise ValueError('Contour landmarks out of order: '+str(indexes))
    points=[]
    for k,count in enumerate(counts):
        start=indexes[k];length=(indexes[(k+1)%len(indexes)]-start)%len(curve)
        section=curve[(start+np.arange(length+1))%len(curve)]
        distances=np.r_[0,np.cumsum(np.linalg.norm(np.diff(section,1,0),None,1))]
        for d in np.linspace(0,distances[-1],count+1)[:-1]:
            j=min(len(distances)-2,int(np.searchsorted(distances,d,'right'))-1);f=(d-distances[j])/max(distances[j+1]-distances[j],1e-9)
            points.append(section[j]*(1-f)+section[j+1]*f)
    return np.array(points)

def paired_mesh(a,b):
    order=list(range(len(a)));triangles=[]
    area=np.sum(a[:,0]*np.roll(a[:,1],-1)-a[:,1]*np.roll(a[:,0],-1));sign=1 if area>0 else -1
    def cross(u,v):return u[0]*v[1]-u[1]*v[0]
    while len(order)>3:
        clipped=False
        for k in range(len(order)):
            i,j,l=order[k-1],order[k],order[(k+1)%len(order)];u,v,w=a[i],a[j],a[l]
            turn=cross(v-u,w-v)*sign
            if abs(turn)<=1e-6 and np.dot(v-u,w-v)>=0:
                triangles.append((i,j,l));order.pop(k);clipped=True;break
            if turn<=1e-6:continue
            occupied=False
            for m in order:
                if m in [i,j,l]:continue
                q=a[m]
                if min(cross(v-u,q-u)*sign,cross(w-v,q-v)*sign,cross(u-w,q-w)*sign)>=-1e-6:occupied=True;break
            if occupied:continue
            triangles.append((i,j,l));order.pop(k);clipped=True;break
        if not clipped:raise ValueError('Non-simple petal contour needs a new drawing')
    triangles.append(tuple(order));va=list(a);vb=list(b);result=[]
    for triangle in triangles:
        i,j,k=triangle;center=len(va);va.append(np.mean(a[list(triangle)],0));vb.append(np.mean(b[list(triangle)],0))
        result.extend([(i,j,center),(j,k,center),(k,i,center)])
    return np.array(va),np.array(vb),np.array(result,int)

def remap_mesh(im,source,destination,triangles):
    map_x=np.full((512,512),-100,np.float32);map_y=map_x.copy()
    for tri in triangles:
        a=source[tri];b=destination[tri]
        x0=max(0,int(np.floor(b[:,0].min())));x1=min(511,int(np.ceil(b[:,0].max())))
        y0=max(0,int(np.floor(b[:,1].min())));y1=min(511,int(np.ceil(b[:,1].max())))
        if x1<x0 or y1<y0:continue
        mat=np.vstack([b.T,np.ones(3)])
        if abs(np.linalg.det(mat))<1e-6:continue
        xx=X[y0:y1+1,x0:x1+1];yy=Y[y0:y1+1,x0:x1+1]
        weights=np.linalg.inv(mat)@np.vstack([xx.ravel(),yy.ravel(),np.ones(xx.size)])
        inside=np.all(weights>=-.0001,0).reshape(xx.shape)
        uv=(a.T@weights).reshape(2,*xx.shape)
        map_x[y0:y1+1,x0:x1+1][inside]=uv[0][inside];map_y[y0:y1+1,x0:x1+1][inside]=uv[1][inside]
    return cv2.remap(im,map_x,map_y,cv2.INTER_LANCZOS4,None,cv2.BORDER_CONSTANT,(0,0,0,0))

class Skeleton:
    def __init__(self):self.bones=[];self.bind={};self.current={}
    def add(self,name,parent,point,angle,length):
        world=matrix(point,angle);local=world if parent is None else np.linalg.inv(self.bind[parent])@world
        self.bones.append({'name':name,'parent':parent,'localBind':local.tolist(),'worldBind':world.tolist(),'length':length})
        self.bind[name]=world;self.current[name]=world.copy()
    def pose(self,angles,translations):
        for bone in self.bones:
            name=bone['name'];local=np.array(bone['localBind'])
            local=local@matrix((0,0),angles.get(name,0));local[:2,2]+=np.array(translations.get(name,(0,0)))
            self.current[name]=local if bone['parent'] is None else self.current[bone['parent']]@local
    def skin(self,vertices,weights):
        result=np.zeros_like(vertices)
        for name,values in weights.items():result+=apply(self.current[name]@np.linalg.inv(self.bind[name]),vertices)*np.array(values)[:,None]
        return result
