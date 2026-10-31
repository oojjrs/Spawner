import numpy as np
from PIL import Image,ImageFilter
from surfaces import grid
from ribbon import rasterize

def make_actor(image,images,rig,pouch):
    vertices,triangles=grid(image,6);xy=np.clip(np.rint(vertices).astype(int),0,511)
    body=np.ones(len(vertices));weights=np.ones((len(vertices),1))
    pouch_uv=np.array(pouch['vertices']);pouch_faces=np.array(pouch['triangles']);binding=np.zeros((len(vertices),3),int);barycentric=np.zeros((len(vertices),3));bound=np.zeros(len(vertices),bool)
    for face in pouch_faces:
        a,b,c=pouch_uv[face];system=np.column_stack([b-a,c-a])
        if abs(np.linalg.det(system))<.001: continue
        local=(vertices-a)@np.linalg.inv(system).T;bary=np.column_stack([1-local.sum(1),local])
        chosen=(bary.min(1)>=-.00001)&~bound;binding[chosen]=face;barycentric[chosen]=bary[chosen];bound|=chosen
    best=np.full(len(vertices),np.inf)
    for face in pouch_faces:
        a,b,c=pouch_uv[face];system=np.column_stack([b-a,c-a])
        if abs(np.linalg.det(system))<.001: continue
        local=(vertices-a)@np.linalg.inv(system).T;bary=np.maximum(0,np.column_stack([1-local.sum(1),local]));bary/=np.maximum(.00001,bary.sum(1)[:,None])
        mapped=bary@pouch_uv[face];distance=np.linalg.norm(mapped-vertices,**{'axis':1});chosen=~bound&(distance<best)
        binding[chosen]=face;barycentric[chosen]=bary[chosen];best[chosen]=distance[chosen]
    alpha=np.asarray(images['pouch-mask'])[:,:,0]
    field=np.asarray(Image.fromarray(alpha).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(4)))/255
    soft=field[xy[:,1],xy[:,0]]*body
    root=np.array(rig['legs']['fore-near'][0])
    inner,outer=rig['nearShoulder']['anchorRadius']
    distance=np.linalg.norm(vertices-root,**{'axis':1})
    anchor=np.clip((distance-inner)/(outer-inner),0,1)
    anchor=anchor*anchor*(3-2*anchor)
    soft*=anchor
    depth=np.zeros(len(vertices))
    rest=(pouch_uv[binding]*barycentric[:,:,None]).sum(1)
    return {'vertices':vertices.tolist(),'triangles':triangles,'weights':weights.tolist(),'pouchBinding':binding.tolist(),'pouchBarycentric':barycentric.tolist(),'pouchRestPosition':rest.tolist(),'pouchWeight':soft.tolist(),'baseDepth':depth.tolist()}

def pose_actor(mesh,state,pouch,rig):
    vertices=np.array(mesh['vertices']);points=np.column_stack([vertices,np.ones(len(vertices))]);weights=np.array(mesh['weights']);matrices=[state['body']]
    posed=np.zeros_like(vertices)
    for index,matrix in enumerate(matrices): posed+=(points@matrix.T)[:,:2]*weights[:,index:index+1]
    mapped=(pouch[np.array(mesh['pouchBinding'])]*np.array(mesh['pouchBarycentric'])[:,:,None]).sum(1)
    rest=np.array(mesh['pouchRestPosition']);offset=vertices-rest;mapped[:,:2]+=offset@state['body'][:2,:2].T
    body=(points@state['body'].T)[:,:2];soft=np.array(mesh['pouchWeight'])
    posed+=(mapped[:,:2]-body)*soft[:,None]
    floor=rig['groundY']+rig['groundSlope']*(posed[:,0]-rig['groundX']);posed[:,1]=np.minimum(posed[:,1],floor)
    depth=np.array(mesh['baseDepth'])+mapped[:,2]*soft
    return posed,depth

def render_actor(image,mesh,state,pouch,rig):
    posed,depth=pose_actor(mesh,state,pouch,rig);vertices=np.array(mesh['vertices']);triangles=np.array(mesh['triangles']);order=np.argsort(depth[triangles].mean(1))
    return rasterize(image,vertices,posed,triangles[order].tolist())
