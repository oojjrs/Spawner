from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import cv2
import json
import math

Y,X=np.mgrid[:512,:512].astype(np.float32)

def read(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a

def rgba(a):
    a=np.clip(a,0,1);rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8)
    pixels=np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255));pixels[pixels[:,:,3]==0,:3]=0;return Image.fromarray(pixels)

def over(front,back):
    return front+back*(1-front[:,:,3:4])

def ease(t):
    t=float(np.clip(t,0,1));return t*t*t*(10+t*(-15+6*t))

def polygon(points):
    im=Image.new('L',(512,512));ImageDraw.Draw(im).polygon(points,255);return np.array(im)>0

def bezier(start,segments):
    points=[start];a=np.array(start,float)
    for c1,c2,b in segments:
        c1,c2,b=[np.array(v,float) for v in [c1,c2,b]]
        for t in np.linspace(0,1,24)[1:]:points.append(tuple((1-t)**3*a+3*(1-t)**2*t*c1+3*(1-t)*t*t*c2+t**3*b))
        a=b
    return polygon(points)

def mirror(mask):return mask[:,::-1]

def matrix(origin,angle):
    t=math.radians(angle);c,s=math.cos(t),math.sin(t)
    return np.array([[c,-s,origin[0]],[s,c,origin[1]],[0,0,1]],float)

def apply(m,points):
    p=np.column_stack([points,np.ones(len(points))]);return (m@p.T).T[:,:2]

def affine(im,m):
    return cv2.warpAffine(im,m[:2].astype(np.float32),(512,512),None,cv2.INTER_LANCZOS4,cv2.BORDER_CONSTANT,(0,0,0,0))

def rigid(im,pivot,angle,shift):
    return affine(im,matrix((pivot[0]+shift[0],pivot[1]+shift[1]),angle)@matrix((-pivot[0],-pivot[1]),0))

def shift(im,offset):return rigid(im,(0,0),0,offset)

def place_two(im,source_a,source_b,target_a,target_b):
    a,b,c,d=[np.array(p,float) for p in [source_a,source_b,target_a,target_b]]
    u=b-a;v=d-c;scale=np.linalg.norm(v)/np.linalg.norm(u)
    angle=math.degrees(math.atan2(v[1],v[0])-math.atan2(u[1],u[0]))
    s=np.diag([scale,scale,1]);return affine(im,matrix(c,angle)@s@matrix(-a,0))

def components(path,rows):
    image=read(path);original_alpha=image[:,:,3:4].copy();rgb=image[:,:,:3]/np.maximum(original_alpha,1e-8);alpha=np.where(original_alpha>.5,1,original_alpha);image=np.concatenate([rgb*alpha,alpha],2);n,l,stats,centers=cv2.connectedComponentsWithStats(np.uint8(image[:,:,3]>.2),8)
    ids=[i for i in range(1,n) if stats[i,4]>1000]
    ids=[entry[2] for entry in sorted((int(centers[i,1]//(image.shape[0]/rows)),centers[i,0],i) for i in ids)]
    result=[]
    for i in ids:
        x,y,w,h,area=stats[i];p=3;x0=max(0,x-p);y0=max(0,y-p);x1=min(image.shape[1],x+w+p);y1=min(image.shape[0],y+h+p)
        result.append(image[y0:y1,x0:x1].copy())
    return result

def contour(im,landmarks,counts):
    alpha=im[:,:,3]>.1;found=cv2.findContours(np.uint8(alpha),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0]
    curve=found[int(np.argmax([cv2.contourArea(c) for c in found]))][:,0,:].astype(float)
    if cv2.contourArea(curve.astype(np.float32),True)<0:curve=curve[::-1]
    indexes=[int(np.argmin(np.linalg.norm(curve-np.array(p),None,1))) for p in landmarks]
    if any((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve)==0 for k in range(len(indexes))):raise ValueError('Duplicate contour landmarks')
    total=sum((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve) for k in range(len(indexes)))
    if total!=len(curve):
        curve=curve[::-1];indexes=[len(curve)-1-v for v in indexes]
        total=sum((indexes[(k+1)%len(indexes)]-indexes[k])%len(curve) for k in range(len(indexes)))
    if total!=len(curve):raise ValueError('Contour landmarks out of order: '+str(indexes))
    points=[]
    for k,count in enumerate(counts):
        start=indexes[k];length=(indexes[(k+1)%len(indexes)]-start)%len(curve)
        section=curve[(start+np.arange(length+1))%len(curve)]
        distances=np.r_[0,np.cumsum(np.linalg.norm(np.diff(section,1,0),None,1))]
        for d in np.linspace(0,distances[-1],count+1)[:-1]:
            j=min(len(distances)-2,int(np.searchsorted(distances,d,'right'))-1);f=(d-distances[j])/max(distances[j+1]-distances[j],1e-9)
            points.append(section[j]*(1-f)+section[j+1]*f)
    return np.array(points)

def kernel_center(boundary,preferred):
    lo=np.floor(boundary.min(0)).astype(int);hi=np.ceil(boundary.max(0)).astype(int)
    yy,xx=np.mgrid[lo[1]:hi[1]+1:2,lo[0]:hi[0]+1:2];candidates=np.column_stack([xx.ravel(),yy.ravel()]).astype(float)
    edges=np.roll(boundary,-1,0)-boundary
    area=np.sum(boundary[:,0]*np.roll(boundary[:,1],-1)-boundary[:,1]*np.roll(boundary[:,0],-1));sign=1 if area>0 else -1
    for point,edge in zip(boundary,edges):
        values=(edge[0]*(candidates[:,1]-point[1])-edge[1]*(candidates[:,0]-point[0]))*sign
        candidates=candidates[values>=-.5]
        if not len(candidates):raise ValueError('The petal needs a non-fan mesh: no silhouette kernel')
    return candidates[int(np.argmin(np.linalg.norm(candidates-np.array(preferred),None,1)))]

def fan_mesh(boundary,center):
    n=len(boundary);verts=[np.array(center,float)];triangles=[]
    for amount in [.33,.66,1.0]:verts.extend(center+(boundary-center)*amount)
    for i in range(n):triangles.append((0,1+i,1+(i+1)%n))
    for ring in range(2):
        inner=1+ring*n;outer=inner+n
        for i in range(n):
            j=(i+1)%n;triangles.extend([(inner+i,outer+i,outer+j),(inner+i,outer+j,inner+j)])
    return np.array(verts),np.array(triangles,int)

def paired_mesh(a,b):
    order=list(range(len(a)));triangles=[]
    area=np.sum(a[:,0]*np.roll(a[:,1],-1)-a[:,1]*np.roll(a[:,0],-1));sign=1 if area>0 else -1
    def cross(u,v):return u[0]*v[1]-u[1]*v[0]
    while len(order)>3:
        clipped=False
        for k in range(len(order)):
            i,j,l=order[k-1],order[k],order[(k+1)%len(order)];u,v,w=a[i],a[j],a[l]
            turn=cross(v-u,w-v)*sign
            if abs(turn)<=1e-6 and np.dot(v-u,w-v)>=0:
                triangles.append((i,j,l));order.pop(k);clipped=True;break
            if turn<=1e-6:continue
            occupied=False
            for m in order:
                if m in [i,j,l]:continue
                q=a[m]
                if min(cross(v-u,q-u)*sign,cross(w-v,q-v)*sign,cross(u-w,q-w)*sign)>=-1e-6:occupied=True;break
            if occupied:continue
            triangles.append((i,j,l));order.pop(k);clipped=True;break
        if not clipped:raise ValueError('Non-simple petal contour needs a new drawing')
    triangles.append(tuple(order));va=list(a);vb=list(b);result=[]
    for triangle in triangles:
        i,j,k=triangle;center=len(va);va.append(np.mean(a[list(triangle)],0));vb.append(np.mean(b[list(triangle)],0))
        result.extend([(i,j,center),(j,k,center),(k,i,center)])
    return np.array(va),np.array(vb),np.array(result,int)

def remap_mesh(im,source,destination,triangles):
    map_x=np.full((512,512),-100,np.float32);map_y=map_x.copy()
    for tri in triangles:
        a=source[tri];b=destination[tri]
        x0=max(0,int(np.floor(b[:,0].min())));x1=min(511,int(np.ceil(b[:,0].max())))
        y0=max(0,int(np.floor(b[:,1].min())));y1=min(511,int(np.ceil(b[:,1].max())))
        if x1<x0 or y1<y0:continue
        mat=np.vstack([b.T,np.ones(3)])
        if abs(np.linalg.det(mat))<1e-6:continue
        xx=X[y0:y1+1,x0:x1+1];yy=Y[y0:y1+1,x0:x1+1]
        weights=np.linalg.inv(mat)@np.vstack([xx.ravel(),yy.ravel(),np.ones(xx.size)])
        inside=np.all(weights>=-.0001,0).reshape(xx.shape)
        uv=(a.T@weights).reshape(2,*xx.shape)
        map_x[y0:y1+1,x0:x1+1][inside]=uv[0][inside];map_y[y0:y1+1,x0:x1+1][inside]=uv[1][inside]
    return cv2.remap(im,map_x,map_y,cv2.INTER_LANCZOS4,None,cv2.BORDER_CONSTANT,(0,0,0,0))

class Skeleton:
    def __init__(self):self.bones=[];self.bind={};self.current={}
    def add(self,name,parent,point,angle,length):
        world=matrix(point,angle);local=world if parent is None else np.linalg.inv(self.bind[parent])@world
        self.bones.append({'name':name,'parent':parent,'localBind':local.tolist(),'worldBind':world.tolist(),'length':length})
        self.bind[name]=world;self.current[name]=world.copy()
    def pose(self,angles,translations):
        for bone in self.bones:
            name=bone['name'];local=np.array(bone['localBind'])
            local=local@matrix((0,0),angles.get(name,0));local[:2,2]+=np.array(translations.get(name,(0,0)))
            self.current[name]=local if bone['parent'] is None else self.current[bone['parent']]@local
    def skin(self,vertices,weights):
        result=np.zeros_like(vertices)
        for name,values in weights.items():result+=apply(self.current[name]@np.linalg.inv(self.bind[name]),vertices)*np.array(values)[:,None]
        return result

class Petal:
    def __init__(self,name,start,end,landmarks_a,landmarks_b,center_a,center_b,pivots,angles):
        self.name=name;self.start=start;self.end=end;counts=[24,24,16,20,20] if len(landmarks_a)==5 else [18]*len(landmarks_a)
        self.clean=[]
        for source in [start,end]:
            pixels=np.array(rgba(source));ink=((pixels[:,:,:3].max(2)<115)&(pixels[:,:,3]>20))|(pixels[:,:,3]<250)
            clean=cv2.inpaint(pixels[:,:,:3],np.uint8(ink)*255,3,cv2.INPAINT_TELEA).astype(np.float32)/255
            a=np.ones((512,512,1),np.float32);self.clean.append(np.concatenate([clean,a],2))
        ca=contour(start,landmarks_a,counts);cb=contour(end,landmarks_b,counts)
        self.boundaryCount=len(ca);self.vertices,self.target,self.triangles=paired_mesh(ca,cb)
        self.skeleton=Skeleton();self.skeleton.add('root',None,(256,448),0,0);self.skeleton.add(name+'-carrier','root',(256,320),0,0);self.translations={}
        for i,point in enumerate(pivots):
            other=pivots[min(i+1,len(pivots)-1)];angle=math.degrees(math.atan2(other[1]-point[1],other[0]-point[0])) if i<2 else 0
            self.skeleton.add(name+str(i),name+'-carrier' if i==0 else name+str(i-1),point,angle,float(np.linalg.norm(np.array(other)-point)))
        distances=np.linalg.norm(self.vertices-np.array(pivots[0]),None,1);q=np.clip(distances/max(np.linalg.norm(np.array(pivots[-1])-pivots[0]),1)*2,0,2)
        self.weights={name+str(i):np.clip(1-np.abs(q-i),0,1).tolist() for i in range(3)}
        self.angles={name+str(i):angles[i] for i in range(3)};self.skeleton.pose(self.angles,{})
        self.correction=self.target-self.skeleton.skin(self.vertices,self.weights)
        self.skeleton.pose({},{});self.minimum_area=1.0
    def preserve_texture(self):
        self.clean=[]
        for source in [self.start,self.end]:
            pixels=np.array(rgba(source));distance=cv2.distanceTransform(np.uint8(pixels[:,:,3]>127),cv2.DIST_L2,5);dark=pixels[:,:,:3].max(2)<130;mask=(pixels[:,:,3]<250)|((distance<5)&dark);rgb=cv2.inpaint(pixels[:,:,:3],np.uint8(mask)*255,5,cv2.INPAINT_TELEA).astype(np.float32)/255;self.clean.append(np.concatenate([rgb,np.ones((512,512,1),np.float32)],2))
    def motion(self,delta):
        self.translations={self.name+'-carrier':list(delta)};self.skeleton.pose(self.angles,self.translations);self.correction=self.target-self.skeleton.skin(self.vertices,self.weights)
    def positions(self,progress):
        p=ease(progress);self.skeleton.pose({k:v*p for k,v in self.angles.items()},{k:np.array(v)*p for k,v in self.translations.items()})
        return self.skeleton.skin(self.vertices,self.weights)+self.correction*p
    def render(self,progress):
        if progress<=0:return self.start
        if progress>=1:return self.end
        p=ease(progress);current=self.positions(progress)
        a=remap_mesh(self.clean[0],self.vertices,current,self.triangles);b=remap_mesh(self.clean[1],self.target,current,self.triangles)
        texture=a*(1-p)+b*p;rgb=texture[:,:,:3]/np.maximum(texture[:,:,3:4],1e-7)
        outline=current[:self.boundaryCount]
        alpha=Image.new('L',(1024,1024));ImageDraw.Draw(alpha).polygon([tuple(point*2) for point in outline],255)
        alpha=np.array(alpha.resize((512,512),Image.Resampling.LANCZOS)).astype(np.float32)/255
        distance=cv2.distanceTransform(np.uint8(alpha>.5),cv2.DIST_L2,5)
        line=np.clip(3.4-distance,0,1)[:,:,None];rgb=rgb*(1-line)+np.array([.11,.22,.17])*line
        return np.concatenate([rgb*alpha[:,:,None],alpha[:,:,None]],2)
    def data(self):
        return {'boundaryCount':self.boundaryCount,'bones':self.skeleton.bones,'vertices':self.vertices.tolist(),'closedVertices':self.target.tolist(),'triangles':self.triangles.tolist(),'weights':self.weights,'closedTranslations':self.translations,'closedAngles':self.angles,'correctiveVertices':self.correction.tolist()}

def save_json(path,data):path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
