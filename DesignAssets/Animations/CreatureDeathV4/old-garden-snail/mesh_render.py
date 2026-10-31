from PIL import Image
import numpy as np
import math

def smooth(time,start,end):
    value=max(0,min(1,(time-start)/(end-start)))
    return value*value*(3-2*value)

def rotate(points,angle):
    c,s=math.cos(angle),math.sin(angle)
    return points@np.array([[c,s],[-s,c]])

def shortest(value):
    return (value+math.pi)%(2*math.pi)-math.pi

def arc_data(vertices,points):
    points=np.array(points,float)
    lengths=np.linalg.norm(np.diff(points,**{'axis':0}),**{'axis':1})
    best=np.full(len(vertices),np.inf)
    along=np.zeros(len(vertices))
    total=0
    for index,length in enumerate(lengths):
        delta=points[index+1]-points[index]
        weight=np.clip((vertices-points[index])@delta/(length*length),0,1)
        distance=np.linalg.norm(vertices-(points[index]+weight[:,None]*delta),**{'axis':1})
        closer=distance<best
        along[closer]=total+weight[closer]*length
        best[closer]=distance[closer]
        total+=length
    return along,lengths

def lattice(image,step):
    box=image.getchannel('A').getbbox()
    xs=np.linspace(max(0,box[0]-2),min(511,box[2]+2),math.ceil((box[2]-box[0]+4)/step)+1)
    ys=np.linspace(max(0,box[1]-2),min(511,box[3]+2),math.ceil((box[3]-box[1]+4)/step)+1)
    vertices=np.array([[x,y] for y in ys for x in xs])
    triangles=[]
    width=len(xs)
    for row in range(len(ys)-1):
        for column in range(width-1):
            a=row*width+column
            triangles.extend([(a,a+1,a+width),(a+1,a+width+1,a+width)])
    return vertices,np.array(triangles)

def warp(image,vertices,moved,triangles):
    texture=np.array(image).astype(float)/255
    texture[:,:,:3]*=texture[:,:,3,None]
    output=np.zeros((512,512,4),float)
    for triangle in triangles:
        a,b,c=moved[triangle]
        low=np.maximum(np.floor(np.minimum(np.minimum(a,b),c)).astype(int),0)
        high=np.minimum(np.ceil(np.maximum(np.maximum(a,b),c)).astype(int),511)
        if np.any(high<low):
            continue
        denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator)<.00001:
            continue
        yy,xx=np.mgrid[low[1]:high[1]+1,low[0]:high[0]+1]
        wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
        wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
        wc=1-wa-wb
        inside=(wa>=-.000001)&(wb>=-.000001)&(wc>=-.000001)
        if not np.any(inside):
            continue
        source=wa[:,:,None]*vertices[triangle[0]]+wb[:,:,None]*vertices[triangle[1]]+wc[:,:,None]*vertices[triangle[2]]
        u=np.clip(source[:,:,0],0,511)
        v=np.clip(source[:,:,1],0,511)
        x0=np.floor(u).astype(int)
        y0=np.floor(v).astype(int)
        x1=np.minimum(x0+1,511)
        y1=np.minimum(y0+1,511)
        fu=(u-x0)[:,:,None]
        fv=(v-y0)[:,:,None]
        sampled=(texture[y0,x0]*(1-fu)+texture[y0,x1]*fu)*(1-fv)+(texture[y1,x0]*(1-fu)+texture[y1,x1]*fu)*fv
        patch=output[low[1]:high[1]+1,low[0]:high[0]+1]
        patch[inside]=sampled[inside]+patch[inside]*(1-sampled[inside,3,None])
    output[:,:,:3]/=np.maximum(output[:,:,3,None],.000001)
    return Image.fromarray(np.clip(output*255,0,255).round().astype(np.uint8))

def rigid(image,source,target,angle):
    c,s=math.cos(angle),math.sin(angle)
    tx=target[0]-c*source[0]+s*source[1]
    ty=target[1]-s*source[0]-c*source[1]
    return image.transform((512,512),Image.Transform.AFFINE,(c,s,-c*tx-s*ty,-s,c,s*tx-c*ty),Image.Resampling.BICUBIC)

def bend_limb(vertices,bind,current,paw_angle):
    along,lengths=arc_data(vertices,bind)
    source=np.array(bind,float)
    upper=math.atan2(*(current[1]-current[0])[::-1])-math.atan2(*(source[1]-source[0])[::-1])
    lower=math.atan2(*(current[2]-current[1])[::-1])-math.atan2(*(source[2]-source[1])[::-1])
    result=np.zeros_like(vertices)
    for index,point in enumerate(vertices):
        distance=along[index]
        if distance<lengths[0]-7:
            result[index]=current[1]+rotate(np.array([point-source[1]]),upper)[0]
        elif distance<lengths[0]+7:
            amount=(distance-lengths[0]+7)/14
            angle=upper+shortest(lower-upper)*amount
            result[index]=current[1]+rotate(np.array([point-source[1]]),angle)[0]
        elif distance<lengths[0]+lengths[1]-4:
            result[index]=current[2]+rotate(np.array([point-source[2]]),lower)[0]
        elif distance<lengths[0]+lengths[1]+4:
            amount=(distance-lengths[0]-lengths[1]+4)/8
            angle=lower+shortest(paw_angle-lower)*amount
            result[index]=current[2]+rotate(np.array([point-source[2]]),angle)[0]
        else:
            result[index]=current[2]+rotate(np.array([point-source[2]]),paw_angle)[0]
    return result
