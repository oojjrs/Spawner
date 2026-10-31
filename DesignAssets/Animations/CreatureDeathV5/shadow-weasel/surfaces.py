import math
import numpy as np
from ribbon import rasterize

def grid(image,spacing):
    alpha=np.asarray(image)[:,:,3];yy,xx=np.where(alpha>2)
    xs=np.linspace(max(0,int(xx.min())-2),min(511,int(xx.max())+2),max(2,math.ceil((xx.max()-xx.min()+4)/spacing)+1))
    ys=np.linspace(max(0,int(yy.min())-2),min(511,int(yy.max())+2),max(2,math.ceil((yy.max()-yy.min()+4)/spacing)+1))
    vertices=np.array([[x,y] for y in ys for x in xs]);triangles=[];columns=len(xs)
    for row in range(len(ys)-1):
        for col in range(columns-1):
            region=alpha[max(0,int(ys[row])):min(512,math.ceil(ys[row+1])+1),max(0,int(xs[col])):min(512,math.ceil(xs[col+1])+1)]
            if not region.size or region.max()<2: continue
            index=row*columns+col;triangles.extend([[index,index+1,index+columns],[index+1,index+columns+1,index+columns]])
    return vertices,triangles

def make_neck(image):
    vertices,triangles=grid(image,8);head=np.clip((236-vertices[:,0])/54,0,1)
    return {'vertices':vertices.tolist(),'triangles':triangles,'weights':np.column_stack([1-head,head]).tolist()}

def make_tail(image,joints):
    vertices,triangles=grid(image,6);points=np.array(joints,float);weights=np.zeros((len(vertices),len(points)))
    for index,vertex in enumerate(vertices):
        if vertex[0]<376 and vertex[1]<341: weights[index,0]=1;continue
        choices=[]
        for segment,(start,end) in enumerate(zip(points[:-1],points[1:])):
            delta=end-start;u=float(np.clip(np.dot(vertex-start,delta)/np.dot(delta,delta),0,1));distance=np.linalg.norm(vertex-start-delta*u);choices.append((distance,segment,u))
        _,segment,u=min(choices);bone=segment+1
        if u<.35:
            t=.5+.5*u/.35;weights[index,bone]=t;weights[index,max(0,bone-1)]=1-t
        elif u>.65 and bone<len(points)-1:
            t=.5*(u-.65)/.35;weights[index,bone]=1-t;weights[index,bone+1]=t
        else: weights[index,bone]=1
    return {'vertices':vertices.tolist(),'triangles':triangles,'weights':weights.tolist(),'joints':joints}

def render_surface(image,mesh,matrices):
    vertices=np.array(mesh['vertices']);points=np.column_stack([vertices,np.ones(len(vertices))]);weights=np.array(mesh['weights']);posed=np.zeros_like(vertices)
    for index,matrix in enumerate(matrices): posed+=(points@matrix.T)[:,:2]*weights[:,index:index+1]
    return rasterize(image,vertices,posed,mesh['triangles'])
