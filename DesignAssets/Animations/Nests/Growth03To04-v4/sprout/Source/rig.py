from pathlib import Path
import sys,math,json
from PIL import Image,ImageDraw
import numpy as np
import cv2
ROOT=Path(__file__).resolve().parent.parent
Y,X=np.mgrid[:512,:512].astype(np.float32)
def read(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a
def rgba(a):
    a=np.clip(a,0,1);rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8)
    data=np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255));data[data[:,:,3]==0,:3]=0
    return Image.fromarray(data)
def ease(x):
    q=float(np.clip(x,0,1));return q*q*q*(10+q*(-15+6*q))
def over(a,b):return a+b*(1-a[:,:,3:4])
def cross(a,b):return a[...,0]*b[...,1]-a[...,1]*b[...,0]
def warp(source,uv,points,tris):
    mx=np.full((512,512),-20,np.float32);my=mx.copy()
    for tri in tris:
        a=uv[tri];b=points[tri];mat=np.vstack([b.T,np.ones(3)])
        if abs(np.linalg.det(mat))<1e-7:continue
        x0=max(0,int(np.floor(b[:,0].min())));x1=min(511,int(np.ceil(b[:,0].max())))
        y0=max(0,int(np.floor(b[:,1].min())));y1=min(511,int(np.ceil(b[:,1].max())))
        if x1<x0 or y1<y0:continue
        xx=X[y0:y1+1,x0:x1+1];yy=Y[y0:y1+1,x0:x1+1]
        w=np.linalg.inv(mat)@np.vstack([xx.ravel(),yy.ravel(),np.ones(xx.size)])
        inside=np.all(w>=-.0001,0).reshape(xx.shape)
        value=(a.T@w).reshape(2,*xx.shape)
        mx[y0:y1+1,x0:x1+1][inside]=value[0][inside];my[y0:y1+1,x0:x1+1][inside]=value[1][inside]
    return cv2.remap(source,mx,my,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def bezier(start,segments):
    result=[np.array(start,float)];a=np.array(start,float)
    for c,d,e in segments:
        c,d,e=[np.array(v,float) for v in [c,d,e]]
        for t in np.linspace(0,1,32)[1:]:result.append((1-t)**3*a+3*(1-t)**2*t*c+3*(1-t)*t*t*d+t**3*e)
        a=e
    return np.array(result)
def mask_from_curve(curve):
    image=Image.new('L',(1024,1024));ImageDraw.Draw(image).polygon([tuple(v*2) for v in curve],255)
    alpha=np.array(image.resize((512,512),Image.Resampling.LANCZOS)).astype(np.float32)/255
    return np.concatenate([np.ones((512,512,3),np.float32)*alpha[:,:,None],alpha[:,:,None]],2)
