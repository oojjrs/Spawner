import json
import math
import numpy as np
from PIL import Image, _webp


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
    output=np.zeros((512,512,4),np.uint8)
    bounds=image.getchannel('A').getbbox()
    if bounds is None:return Image.fromarray(output)
    corners=np.array([[bounds[0],bounds[1],1],[bounds[2],bounds[1],1],[bounds[0],bounds[3],1],[bounds[2],bounds[3],1]],float)
    transformed=(matrix@corners.T).T[:,:2]
    lower=np.maximum(0,np.floor(transformed.min(0)).astype(int)-2)
    upper=np.minimum(512,np.ceil(transformed.max(0)).astype(int)+2)
    if np.any(upper<=lower):return Image.fromarray(output)
    pixels=np.asarray(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    inverse=np.linalg.inv(matrix)
    y,x=np.indices((upper[1]-lower[1],upper[0]-lower[0]))
    y+=lower[1]
    x+=lower[0]
    coordinates=inverse@np.stack((x.ravel()+.5,y.ravel()+.5,np.ones(x.size)))
    xx,yy=coordinates[0]-.5,coordinates[1]-.5
    values=sample(pixels,xx,yy)
    values[(xx<0)|(yy<0)|(xx>511)|(yy>511)]=0
    rgb=values[:,:3]/np.maximum(1e-10,values[:,3:4])
    result=np.concatenate((rgb,values[:,3:4]),1).reshape(y.shape[0],y.shape[1],4)
    output[lower[1]:upper[1],lower[0]:upper[0]]=np.uint8(np.clip(result*255+.5,0,255))
    return Image.fromarray(output)


def sample(pixels,x,y):
    x=np.clip(x,0,510.9999)
    y=np.clip(y,0,510.9999)
    ix,iy=x.astype(int),y.astype(int)
    u,v=(x-ix)[:,None],(y-iy)[:,None]
    return (pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v


def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))
