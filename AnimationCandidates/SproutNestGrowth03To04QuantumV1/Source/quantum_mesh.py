from pathlib import Path
import sys,math,json
import numpy as np
from PIL import Image,ImageDraw
import cv2
ROOT=Path(__file__).resolve().parent.parent
Y,X=np.mgrid[:512,:512].astype(np.float32)

def read(file):
    a=np.array(Image.open(file).convert('RGBA')).astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a
def rgba(a):
    a=np.clip(a,0,1);rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8);p=np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255));p[p[:,:,3]==0,:3]=0;return Image.fromarray(p)
def over(a,b):return a+b*(1-a[:,:,3:4])
def cross(a,b):return a[...,0]*b[...,1]-a[...,1]*b[...,0]
def apply(m,p):return np.array(p)@m[:2,:2].T+m[:2,2]
def smooth(t):
    t=float(np.clip(t,0,1));return t*t*t*(10-15*t+6*t*t)
def area(p):return float(np.sum(cross(p,np.roll(p,-1,0)))/2)
def contour(texture):
    a=np.uint8(texture[:,:,3]>.15);a=cv2.dilate(a,np.ones((3,3),np.uint8));curves=cv2.findContours(a,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]
    c=curves[int(np.argmax([cv2.contourArea(v) for v in curves]))];p=cv2.approxPolyDP(c,.62,True)[:,0,:].astype(float)
    if area(p)<0:p=p[::-1]
    i=int(np.argmin(np.linalg.norm(p-[255,365],None,1)));return np.roll(p,-i,0)
def inside(points,a,b,c):
    den=cross(b-a,c-a);u=cross(points-a,c-a)/den;v=cross(b-a,points-a)/den
    return (u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)
def triangulate(poly,texture):
    nodes=list(range(len(poly)));tris=[]
    while len(nodes)>3:
        found=False
        for j,b in enumerate(nodes):
            a=nodes[j-1];c=nodes[(j+1)%len(nodes)]
            if cross(poly[b]-poly[a],poly[c]-poly[b])<1e-5:continue
            test=[n for n in nodes if n not in [a,b,c]]
            if len(test) and np.any(inside(poly[test],poly[a],poly[b],poly[c])):continue
            tris.append([a,b,c]);nodes.pop(j);found=True;break
        if not found:raise RuntimeError('Non-simple petal contour')
    tris.append(nodes);uv=poly.tolist();distance=cv2.distanceTransform(np.uint8(texture[:,:,3]>.3),cv2.DIST_L2,3)
    for y in np.arange(202.37,360,10.8):
        for x in np.arange(101.23,270,10.8):
            if distance[int(y),int(x)]<4:continue
            pt=np.array([x,y]);verts=np.array(uv);triangles=np.array(tris);v=verts[triangles]
            den=cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);u=cross(pt-v[:,0],v[:,2]-v[:,0])/den;w=cross(v[:,1]-v[:,0],pt-v[:,0])/den
            ids=np.where((u>1e-5)&(w>1e-5)&(u+w<1-1e-5))[0]
            if not len(ids):continue
            k=int(ids[0]);a,b,c=tris[k];n=len(uv);uv.append([x,y]);tris[k]=[a,b,n];tris.extend([[b,c,n],[c,a,n]])
    uv=np.array(uv,float);tris=np.array(tris,int)
    def quality(t):
        a,b,c=uv[t];return abs(cross(b-a,c-a))/(np.sum((b-a)**2)+np.sum((c-b)**2)+np.sum((a-c)**2))
    def oriented(t):
        if cross(uv[t[1]]-uv[t[0]],uv[t[2]]-uv[t[0]])<0:t=[t[0],t[2],t[1]]
        return t
    for iteration in range(25):
        edges={}
        for i,tri in enumerate(tris):
            for a,b,c in [(tri[0],tri[1],tri[2]),(tri[1],tri[2],tri[0]),(tri[2],tri[0],tri[1])]:edges.setdefault(tuple(sorted([int(a),int(b)])),[]).append((i,int(c)))
        changed=0;used=set()
        for (a,b),adj in edges.items():
            if len(adj)!=2:continue
            (i,c),(j,d)=adj
            if i in used or j in used:continue
            if cross(uv[d]-uv[c],uv[a]-uv[c])*cross(uv[d]-uv[c],uv[b]-uv[c])>=-1e-7:continue
            t1=oriented([c,d,a]);t2=oriented([d,c,b])
            if min(quality(t1),quality(t2))>min(quality(tris[i]),quality(tris[j]))+1e-5:
                tris[i]=t1;tris[j]=t2;used.update([i,j]);changed+=1
        if changed==0:break
    return uv,tris
def harmonic_matrix(uv,tris,boundary_count):
    neighbors=[set() for p in uv]
    for tri in tris:
        for i in tri:neighbors[i].update(int(j) for j in tri if j!=i)
    count=len(uv)-boundary_count;a=np.eye(count);b=np.zeros((count,boundary_count))
    for i in range(boundary_count,len(uv)):
        ids=np.array(list(neighbors[i]),int);v=uv[ids]-uv[i];angles=np.arctan2(v[:,1],v[:,0]);order=np.argsort(angles);ids=ids[order];v=v[order];angles=angles[order]
        delta=(np.roll(angles,-1)-angles)%(2*math.pi);tangent=np.tan(delta/2);weights=(np.roll(tangent,1)+tangent)/np.linalg.norm(v,None,1);weights/=weights.sum()
        if np.any(weights<0):raise RuntimeError('Invalid petal one-ring')
        for j,w in zip(ids,weights):
            if j<boundary_count:b[i-boundary_count,j]+=w
            else:a[i-boundary_count,j-boundary_count]-=w
    return np.linalg.solve(a,b)
def bezier(a,c,d,b,t):
    a,c,d,b=[np.array(v,float) for v in [a,c,d,b]];t=np.array(t)[:,None];return (1-t)**3*a+3*(1-t)**2*t*c+3*(1-t)*t*t*d+t**3*b
def closed_boundary(poly):
    anchors=[[255,365],[101,286],[180,198],[207,214],[187,230],[255,309]]
    ids=[int(np.argmin(np.linalg.norm(poly-p,None,1))) for p in anchors]
    if not all(ids[i]<ids[i+1] for i in range(len(ids)-1)):raise RuntimeError('Petal landmark order '+str(ids))
    endpoints=[[255,365],[119,290],[245,185],[281,191],[281,215],[274,307]]
    controls=[[[188,353],[113,337]],[[123,250],[210,194]],[[251,182],[278,183]],[[281,199],[281,208]],[[281,245],[278,279]],[[274,335],[260,356]]]
    out=np.empty_like(poly)
    for i in range(6):
        start=ids[i];end=ids[i+1] if i<5 else len(poly);j=np.arange(start,end);arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(poly[start:end+1] if end<len(poly) else np.vstack([poly[start:],poly[0]]),1,0),None,1))]
        t=arc[:len(j)]/arc[-1];out[j]=bezier(endpoints[i],*controls[i],endpoints[(i+1)%6],t)
    return out
def warp_detail(texture,uv,vertices,tris,preserve_edge):
    mx=np.full((512,512),-20,np.float32);my=mx.copy()
    for tri in tris:
        p=vertices[tri];source=uv[tri];x0=max(0,int(math.floor(p[:,0].min())));x1=min(511,int(math.ceil(p[:,0].max())));y0=max(0,int(math.floor(p[:,1].min())));y1=min(511,int(math.ceil(p[:,1].max())))
        if x1<x0 or y1<y0:continue
        matrix=np.vstack([p.T,np.ones(3)])
        if abs(np.linalg.det(matrix))<1e-8:continue
        xx=X[y0:y1+1,x0:x1+1];yy=Y[y0:y1+1,x0:x1+1];w=np.linalg.solve(matrix,np.vstack([xx.ravel(),yy.ravel(),np.ones(xx.size)]));keep=np.all(w>=-.0001,0).reshape(xx.shape);values=(source.T@w).reshape(2,*xx.shape)
        mx[y0:y1+1,x0:x1+1][keep]=values[0][keep];my[y0:y1+1,x0:x1+1][keep]=values[1][keep]
    value=np.clip(cv2.remap(texture,mx,my,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0)),0,1)
    if preserve_edge:
        mask=np.uint8(texture[:,:,3]>.5);sd=cv2.distanceTransform(mask,cv2.DIST_L2,5)-cv2.distanceTransform(1-mask,cv2.DIST_L2,5);world=cv2.distanceTransform(np.uint8(value[:,:,3]>.5),cv2.DIST_L2,5);source=cv2.remap(sd,mx,my,cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,0);gx=cv2.Sobel(sd,cv2.CV_32F,1,0);gy=cv2.Sobel(sd,cv2.CV_32F,0,1);gx=cv2.remap(gx,mx,my,cv2.INTER_LINEAR);gy=cv2.remap(gy,mx,my,cv2.INTER_LINEAR);length=np.maximum(np.sqrt(gx*gx+gy*gy),1e-6);adjust=(world-source)*np.clip((8-world)/3,0,1)*(value[:,:,3]>.001)*(gy>=0);paint=np.clip(cv2.remap(texture,mx+gx/length*adjust,my+gy/length*adjust,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0)),0,1);value[:,:,:3]=paint[:,:,:3]/np.maximum(paint[:,:,3:4],1e-6)*value[:,:,3:4]
    value[:,:,:3]=np.minimum(value[:,:,:3],value[:,:,3:4]);return value
def warp(texture,uv,vertices,tris):return warp_detail(texture,uv,vertices,tris,False)
def warp_petal(texture,uv,vertices,tris):return warp_detail(texture,uv,vertices,tris,True)

