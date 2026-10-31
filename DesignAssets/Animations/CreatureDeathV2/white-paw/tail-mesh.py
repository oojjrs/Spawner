from PIL import Image
import numpy as np
import math
import json
from pathlib import Path

folder=Path(__file__).resolve().parent
authoring=json.loads((folder/'tail-rig.json').read_text('utf-8'))
texture=np.array(Image.open(folder/'Parts/tail.png').convert('RGBA')).astype(float)
texture[:,:,:3]*=texture[:,:,3:4]/255
bind=np.array(authoring['bindJointPositions'],float)
lengths=np.linalg.norm(bind[1:]-bind[:-1],2,1)
angles=np.arctan2((bind[1:]-bind[:-1])[:,1],(bind[1:]-bind[:-1])[:,0])
target=np.radians(np.array(authoring['targetAbsoluteAnglesDegrees']))
turn=(target-angles+np.pi)%(2*np.pi)-np.pi
vertices=np.array(authoring['vertices'],float)
weights=np.array(authoring['weights'],float)
triangles=authoring['triangles']

def render(amount):
    if amount<.000001:
        return Image.open(folder/'Parts/tail.png').convert('RGBA')
    current=angles+turn*amount
    points=[bind[0]+np.array(authoring['rootOffsetAtEnd'])*amount]
    for length,angle in zip(lengths,current):
        points.append(points[-1]+length*np.array([math.cos(angle),math.sin(angle)]))
    points=np.array(points)
    output=np.zeros(vertices.shape)
    for index in range(4):
        delta=current[index]-angles[index]
        c,s=math.cos(delta),math.sin(delta)
        matrix=np.array([[c,-s],[s,c]])
        transformed=(vertices-bind[index])@matrix.T+points[index]
        output+=transformed*weights[:,index:index+1]
    mx=np.full((512,512),-1.,np.float32)
    my=np.full((512,512),-1.,np.float32)
    for triangle in triangles:
        destination=output[triangle]
        source=vertices[triangle]
        x0=max(0,int(np.floor(destination[:,0].min())))
        x1=min(511,int(np.ceil(destination[:,0].max())))
        y0=max(0,int(np.floor(destination[:,1].min())))
        y1=min(511,int(np.ceil(destination[:,1].max())))
        if x1<x0 or y1<y0:
            continue
        yy,xx=np.mgrid[y0:y1+1,x0:x1+1]
        a,b,c=destination
        denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator)<.00001:
            continue
        wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
        wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
        wc=1-wa-wb
        inside=(wa>=-.0001)&(wb>=-.0001)&(wc>=-.0001)
        sx=wa*source[0,0]+wb*source[1,0]+wc*source[2,0]
        sy=wa*source[0,1]+wb*source[1,1]+wc*source[2,1]
        alpha=texture[np.clip(sy.round().astype(int),0,511),np.clip(sx.round().astype(int),0,511),3]
        inside&=alpha>1
        mx[y0:y1+1,x0:x1+1][inside]=sx[inside]
        my[y0:y1+1,x0:x1+1][inside]=sy[inside]
    outside=(mx<0)|(my<0)
    sx,sy=np.clip(mx,0,510.999),np.clip(my,0,510.999)
    ix,iy=sx.astype(int),sy.astype(int)
    u,v=(sx-ix)[:,:,None],(sy-iy)[:,:,None]
    sampled=(texture[iy,ix]*(1-u)+texture[iy,ix+1]*u)*(1-v)+(texture[iy+1,ix]*(1-u)+texture[iy+1,ix+1]*u)*v
    sampled[:,:,:3]*=255/np.maximum(sampled[:,:,3:4],.00001)
    sampled[outside]=0
    return Image.fromarray(np.clip(sampled,0,255).round().astype(np.uint8))
