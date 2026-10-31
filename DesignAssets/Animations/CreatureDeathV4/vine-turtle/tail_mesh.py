import numpy as np
import math

def section(points,parameter):
    last=len(points)-1
    if parameter<0:
        delta=points[1]-points[0]
        return points[0]+delta*parameter,delta
    if parameter>last:
        delta=points[-1]-points[-2]
        return points[-1]+delta*(parameter-last),delta
    index=min(last-1,int(parameter))
    value=parameter-index
    a=points[max(0,index-1)]
    b=points[index]
    c=points[index+1]
    d=points[min(last,index+2)]
    position=.5*((2*b)+(-a+c)*value+(2*a-5*b+4*c-d)*value**2+(-a+3*b-3*c+d)*value**3)
    tangent=.5*((-a+c)+2*(2*a-5*b+4*c-d)*value+3*(-a+3*b-3*c+d)*value**2)
    return position,tangent

def ribbon(points,radii,start,end):
    points=np.array(points,float)
    radii=np.array(radii,float)
    parameters=[]
    for index in range(start,end):
        count=max(3,math.ceil(np.linalg.norm(points[index+1]-points[index])/7))
        parameters.extend(np.linspace(index,index+1,count,False).tolist())
    parameters.append(float(end))
    parameters=[start-.45,start-.25]+parameters
    parameters.extend([end+.25,end+.55])
    vertices=[]
    weights=[]
    for parameter in parameters:
        position,tangent=section(points,parameter)
        tangent=tangent/max(.0001,np.linalg.norm(tangent))
        normal=np.array([-tangent[1],tangent[0]])
        radius=np.interp(parameter,np.arange(len(points)),radii)+10
        for fraction in np.linspace(-1,1,9):
            vertices.append(position+normal*radius*fraction)
            weights.append([parameter,radius*fraction])
    triangles=[]
    for row in range(len(parameters)-1):
        for column in range(8):
            a=row*9+column
            triangles.extend([[a,a+1,a+9],[a+1,a+10,a+9]])
    return np.array(vertices),np.array(triangles),np.array(weights)

def deform(points,weights,ground):
    points=np.array(points,float)
    result=[]
    for parameter,offset in weights:
        position,tangent=section(points,parameter)
        tangent=tangent/max(.0001,np.linalg.norm(tangent))
        normal=np.array([-tangent[1],tangent[0]])
        point=position+normal*offset
        point[1]=min(point[1],ground)
        result.append(point)
    return np.array(result)
