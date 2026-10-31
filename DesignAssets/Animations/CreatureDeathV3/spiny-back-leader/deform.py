import math
import numpy as np
from PIL import Image

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

def mesh_render(image,mesh,matrices):
    pixels=np.array(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    vertices=np.asarray(mesh['vertices'],float)
    homogeneous=np.column_stack((vertices,np.ones(len(vertices))))
    transformed=np.einsum('bij,vj->bvi',np.asarray(matrices),homogeneous)[:,:,:2]
    posed=np.einsum('vb,bvi->vi',np.asarray(mesh['weights']),transformed)
    output=np.zeros((512,512,4),float)
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
        output[y.ravel()[inside],x.ravel()[inside]]=sample(pixels,coordinates[0],coordinates[1])
    alpha=output[:,:,3:4]
    rgb=output[:,:,:3]/np.maximum(alpha,1/255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate((rgb,alpha),2)*255+.5,0,255))),posed

