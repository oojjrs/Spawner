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

def make_neck(image,field):
    vertices,triangles=grid(image,6)
    values=np.asarray(field)[:,:,0]/255
    xy=np.clip(np.rint(vertices).astype(int),0,511)
    head=values[xy[:,1],xy[:,0]]
    return {'vertices':vertices.tolist(),'triangles':triangles,'weights':np.column_stack([1-head,head]).tolist()}

def render_surface(image,mesh,matrices):
    vertices=np.array(mesh['vertices']);points=np.column_stack([vertices,np.ones(len(vertices))]);weights=np.array(mesh['weights']);posed=np.zeros_like(vertices)
    for index,matrix in enumerate(matrices): posed+=(points@matrix.T)[:,:2]*weights[:,index:index+1]
    triangles=np.array(mesh['triangles']);order=np.argsort(weights[triangles,1].mean(1))
    return rasterize(image,vertices,posed,triangles[order].tolist())
