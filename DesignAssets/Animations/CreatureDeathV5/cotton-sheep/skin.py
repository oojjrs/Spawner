import math
import numpy as np
from ribbon import rasterize

def make_skin(image,joints):
    alpha=np.asarray(image)[:,:,3]
    yy,xx=np.where(alpha>2)
    left=max(0,int(xx.min())-3);right=min(511,int(xx.max())+3)
    top=max(0,int(yy.min())-3);bottom=min(511,int(yy.max())+3)
    xs=np.linspace(left,right,max(2,math.ceil((right-left)/6)+1))
    ys=np.linspace(top,bottom,max(2,math.ceil((bottom-top)/6)+1))
    points=np.array(joints,float);length1=np.linalg.norm(points[1]-points[0]);length2=np.linalg.norm(points[2]-points[1])
    vertices=[];weights=[]
    direction=(points[2]-points[0])/np.linalg.norm(points[2]-points[0])
    total=length1+length2
    for y in ys:
        for x in xs:
            along=np.dot(np.array([x,y])-points[0],direction)
            lower=np.clip((along-length1+7)/14,0,1)
            foot=np.clip((along-total+18)/10,0,1)
            vertices.append([float(x),float(y)])
            weights.append([float((1-lower)*(1-foot)),float(lower*(1-foot)),float(foot)])
    triangles=[];columns=len(xs)
    for row in range(len(ys)-1):
        for col in range(columns-1):
            index=row*columns+col
            triangles.extend([[index,index+1,index+columns],[index+1,index+columns+1,index+columns]])
    return {'vertices':vertices,'weights':weights,'triangles':triangles,'joints':joints}

def render_skin(image,mesh,matrices):
    vertices=np.array(mesh['vertices']);homogeneous=np.column_stack([vertices,np.ones(len(vertices))])
    weights=np.array(mesh['weights']);posed=np.zeros_like(vertices)
    for index,transform in enumerate(matrices): posed+=(homogeneous@transform.T)[:,:2]*weights[:,index:index+1]
    return rasterize(image,vertices,posed,mesh['triangles'])
