import math
import numpy as np
from PIL import Image
from deform import sample

CONTACT=None

def configure_surface(ground,slope,origin):
    global CONTACT
    CONTACT=(ground,slope,origin)

def section(points,parameter):
    last=len(points)-1
    if parameter<0:
        delta=points[1]-points[0]
        return points[0]+delta*parameter,delta
    if parameter>last:
        delta=points[-1]-points[-2]
        return points[-1]+delta*(parameter-last),delta
    i=min(last-1,int(parameter));u=parameter-i
    delta=points[i+1]-points[i];length=np.linalg.norm(delta)
    a=delta/max(.001,length)
    if i>0:
        v=points[i]-points[i-1];a+=v/max(.001,np.linalg.norm(v))
    b=delta/max(.001,length)
    if i+2<len(points):
        v=points[i+2]-points[i+1];b+=v/max(.001,np.linalg.norm(v))
    a=a/max(.001,np.linalg.norm(a))*length
    b=b/max(.001,np.linalg.norm(b))*length
    position=(2*u**3-3*u*u+1)*points[i]+(u**3-2*u*u+u)*a+(-2*u**3+3*u*u)*points[i+1]+(u**3-u*u)*b
    tangent=(6*u*u-6*u)*points[i]+(3*u*u-4*u+1)*a+(-6*u*u+6*u)*points[i+1]+(3*u*u-2*u)*b
    return position,tangent

def make_ribbon(image,joints):
    points=np.array(joints,float)
    yy,xx=np.where(np.array(image)[:,:,3]>2)
    pixels=np.column_stack([xx,yy])
    first=points[1]-points[0];last=points[-1]-points[-2]
    before=max(8,-float(((pixels-points[0])@first/np.linalg.norm(first)).min())+4)
    after=max(8,float(((pixels-points[-1])@last/np.linalg.norm(last)).max())+4)
    parameters=np.linspace(-before/np.linalg.norm(first),0,max(2,math.ceil(before/4)),False).tolist()
    for i in range(len(points)-1):
        parameters.extend(np.linspace(i,i+1,max(2,math.ceil(np.linalg.norm(points[i+1]-points[i])/4)),False).tolist())
    parameters.extend(np.linspace(len(points)-1,len(points)-1+after/np.linalg.norm(last),max(2,math.ceil(after/4))+1).tolist())
    centers=np.array([section(points,p)[0] for p in parameters])
    radius=0.0
    for start in range(0,len(pixels),1024):
        distances=np.linalg.norm(pixels[start:start+1024,None,:]-centers[None,:,:],**{'axis':2})
        radius=max(radius,float(distances.min(1).max()))
    radius+=5
    vertices=[];chart=[]
    for parameter in parameters:
        position,tangent=section(points,parameter)
        tangent=tangent/max(.001,np.linalg.norm(tangent));normal=np.array([-tangent[1],tangent[0]])
        for offset in np.linspace(-radius,radius,9):
            vertices.append((position+normal*offset).tolist());chart.append([parameter,float(offset)])
    triangles=[]
    for row in range(len(parameters)-1):
        for col in range(8):
            a=row*9+col
            triangles.extend([[a,a+1,a+9],[a+1,a+10,a+9]])
    return {'vertices':vertices,'triangles':triangles,'chart':chart,'joints':joints,'kind':'source-aligned-curved-ribbon','radius':radius}

def render_ribbon(image,mesh,matrices):
    points=np.array(mesh['joints'],float)
    moved=[]
    for i,point in enumerate(points):
        transform=matrices[min(i+1,len(matrices)-1)]
        moved.append((transform@np.r_[point,1])[:2])
    moved=np.array(moved)
    scale=np.linalg.norm(matrices[0][0,:2])
    cache={}
    destination=[]
    for parameter,offset in mesh['chart']:
        if parameter not in cache:
            position,tangent=section(moved,parameter)
            tangent=tangent/max(.001,np.linalg.norm(tangent))
            cache[parameter]=(position,np.array([-tangent[1],tangent[0]]))
        position,normal=cache[parameter]
        vertex=position+normal*offset*scale
        if CONTACT is not None:
            ground,slope,origin=CONTACT
            vertex[1]=min(vertex[1],ground+slope*(vertex[0]-origin))
        destination.append(vertex)
    return rasterize(image,np.array(mesh['vertices']),np.array(destination),mesh['triangles']),np.array(destination)

def rasterize(image,vertices,posed,triangles):
    pixels=np.array(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    output=np.zeros((512,512,4),float)
    uv=np.full((512,512,2),-1000.0)
    for indices in triangles:
        target=posed[indices];source=vertices[indices]
        lower=np.maximum(np.floor(target.min(0)).astype(int),0)
        upper=np.minimum(np.ceil(target.max(0)).astype(int),511)
        if np.any(upper<lower): continue
        system=np.vstack([target.T,np.ones(3)])
        if abs(np.linalg.det(system))<.001: continue
        x,y=np.meshgrid(np.arange(lower[0],upper[0]+1),np.arange(lower[1],upper[1]+1))
        bary=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
        inside=np.all(bary>=-.000001,0)
        coords=source.T@bary[:,inside]
        xx=x.ravel()[inside];yy=y.ravel()[inside]
        fragment=sample(pixels,coords[0],coords[1])
        different=np.linalg.norm(uv[yy,xx]-coords.T,**{'axis':1})>.001
        keep=different&(fragment[:,3]>.00001)
        xx=xx[keep];yy=yy[keep];fragment=fragment[keep]
        output[yy,xx]=fragment+output[yy,xx]*(1-fragment[:,3:4])
        uv[yy,xx]=coords.T[keep]
    alpha=output[:,:,3:4];rgb=output[:,:,:3]/np.maximum(alpha,1/255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)))
