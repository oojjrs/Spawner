import math
import numpy as np
from PIL import Image

def mesh(image,part,matrices):
    vertices=np.array(part['vertices'],float)
    weights=np.array(part['weights'],float)
    upper,lower=[np.array(matrices[name]) for name in part['bones']]
    knee=np.array(part['knee'])
    anchor=(upper@np.r_[knee,1])[:2]
    a=math.atan2(upper[1,0],upper[0,0])
    b=math.atan2(lower[1,0],lower[0,0])
    delta=(b-a+math.pi)%(2*math.pi)-math.pi
    angle=a+delta*weights[:,1]
    relative=vertices-knee
    target=np.stack([relative[:,0]*np.cos(angle)-relative[:,1]*np.sin(angle),relative[:,0]*np.sin(angle)+relative[:,1]*np.cos(angle)],1)+anchor
    source=np.array(image,float)/255
    source[:,:,:3]*=source[:,:,3:4]
    output=np.zeros((512,512,4),float)
    for triangle in part['triangles']:
        uv=vertices[triangle]
        u0,v0=np.maximum(np.floor(uv.min(0)).astype(int)-1,0)
        u1,v1=np.minimum(np.ceil(uv.max(0)).astype(int)+2,512)
        if not source[v0:v1,u0:u1,3].any():
            continue
        dst=target[triangle]
        x0,y0=np.maximum(np.floor(dst.min(0)).astype(int),0)
        x1,y1=np.minimum(np.ceil(dst.max(0)).astype(int),512)
        if x1<=x0 or y1<=y0:
            continue
        matrix=np.column_stack([dst[1]-dst[0],dst[2]-dst[0]])
        if abs(np.linalg.det(matrix))<0.01:
            continue
        yy,xx=np.mgrid[y0:y1,x0:x1]
        coordinates=np.stack([xx+0.5,yy+0.5],-1)
        bary=(coordinates-dst[0])@np.linalg.inv(matrix).T
        inside=(bary[:,:,0]>=-1e-6)&(bary[:,:,1]>=-1e-6)&(bary.sum(2)<=1+1e-6)
        if not inside.any():
            continue
        sampled=uv[0]+bary[:,:,0,None]*(uv[1]-uv[0])+bary[:,:,1,None]*(uv[2]-uv[0])-0.5
        sx=np.clip(sampled[:,:,0],0,511)
        sy=np.clip(sampled[:,:,1],0,511)
        ix=np.floor(sx).astype(int)
        iy=np.floor(sy).astype(int)
        fx=(sx-ix)[:,:,None]
        fy=(sy-iy)[:,:,None]
        jx=np.minimum(ix+1,511)
        jy=np.minimum(iy+1,511)
        rgba=(source[iy,ix]*(1-fx)+source[iy,jx]*fx)*(1-fy)+(source[jy,ix]*(1-fx)+source[jy,jx]*fx)*fy
        region=output[y0:y1,x0:x1]
        selected=inside&(rgba[:,:,3]>0)
        region[selected]=rgba[selected]
    output[:,:,:3]/=np.maximum(output[:,:,3:4],1e-8)
    return Image.fromarray(np.uint8(np.clip(output*255+0.5,0,255)))

