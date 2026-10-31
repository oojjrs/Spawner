from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).parent))
from quantum_mesh import read,rgba,over,apply,cross,warp,warp_petal,smooth,cv2,Y,X
ROOT=Path(__file__).resolve().parent.parent

def frame(p,direction):
    d=np.array(direction,float);d/=max(np.linalg.norm(d),1e-8)
    return np.array([[d[0],-d[1],p[0]],[d[1],d[0],p[1]],[0,0,1]],float)
def rotation(degrees):
    a=math.radians(degrees);c=math.cos(a);s=math.sin(a);return np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
def sprout_parent(level,q):
    parent=np.eye(3);parent[1,2]=34*smooth(q)+(20*q**6 if level==4 else 0);return parent
def bone_frames(points):return np.array([frame(p,points[min(i+1,len(points)-1)]-p if i<len(points)-1 else p-points[i-1]) for i,p in enumerate(points)])
def weights(vertices,points,count):
    best=np.full(len(vertices),np.inf);coordinate=np.zeros(len(vertices))
    for i in range(len(points)-1):
        a,b=points[i:i+2];d=b-a;q=np.clip(((vertices-a)@d)/(d@d),0,1);distance=np.linalg.norm(vertices-a-q[:,None]*d,None,1);use=distance<best;best[use]=distance[use];coordinate[use]=i+q[use]
    coordinate=np.minimum(coordinate,count-1);return np.maximum(0,1-np.abs(coordinate[:,None]-np.arange(count)))
def material_points(uv,vertices,tris,points):
    v=uv[tris];den=cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);result=[]
    for p in points:
        u=cross(p-v[:,0],v[:,2]-v[:,0])/den;w=cross(v[:,1]-v[:,0],p-v[:,0])/den;ids=np.where((u>=-1e-6)&(w>=-1e-6)&(u+w<=1+1e-6))[0]
        if len(ids):i=int(ids[0]);result.append(np.array([1-u[i]-w[i],u[i],w[i]])@vertices[tris[i]])
        else:result.append(vertices[int(np.argmin(np.linalg.norm(uv-p,None,1)))])
    return np.array(result)
def grid(texture,step):
    yy,xx=np.where(texture[:,:,3]>.05);xs=np.linspace(max(0,xx.min()-2),min(511,xx.max()+2),int(math.ceil((xx.max()-xx.min()+4)/step))+1);ys=np.linspace(max(0,yy.min()-2),min(511,yy.max()+2),int(math.ceil((yy.max()-yy.min()+4)/step))+1)
    uv=np.array([[x,y] for y in ys for x in xs]);tris=[]
    for j in range(len(ys)-1):
        for i in range(len(xs)-1):
            k=j*len(xs)+i;tris.extend([[k,k+1,k+len(xs)],[k+1,k+len(xs)+1,k+len(xs)]])
    return uv,np.array(tris,int)

class DeformMesh:
    def __init__(self,name,texture,uv,tris,opened,closed,controls):
        self.name=name;self.texture=texture;self.uv=uv;self.triangles=tris;self.bind_vertices=opened;self.states=[opened,closed];self.coordinates=[0,1];self.controls=controls;self.bone_points=[material_points(uv,v,tris,controls) for v in self.states];self.bind=bone_frames(self.bone_points[0]);self.globals=[bone_frames(p) for p in self.bone_points];self.weights=weights(opened,self.bone_points[0],len(self.bind));self.corrective=[v-self.skin(g) for v,g in zip(self.states,self.globals)];self.last=None
    def add_midpoint(self,vertices,q):
        self.states.insert(1,vertices);self.coordinates.insert(1,q);points=material_points(self.uv,vertices,self.triangles,self.controls);g=bone_frames(points);self.bone_points.insert(1,points);self.globals.insert(1,g);self.corrective.insert(1,vertices-self.skin(g))
    def skin(self,globals):
        value=np.zeros_like(self.bind_vertices)
        for i in range(len(self.bind)):value+=apply(globals[i]@np.linalg.inv(self.bind[i]),self.bind_vertices)*self.weights[:,i,None]
        return value
    def pose(self,q,offsets):
        j=min(max(int(np.searchsorted(self.coordinates,q,'right'))-1,0),len(self.coordinates)-2);u=(q-self.coordinates[j])/(self.coordinates[j+1]-self.coordinates[j]);expected=self.globals[j]*(1-u)+self.globals[j+1]*u;local=[expected[0]]+[np.linalg.inv(expected[i-1])@expected[i] for i in range(1,len(expected))];actual=[]
        for i,m in enumerate(local):actual.append((actual[i-1] if i else np.eye(3))@m@offsets[i])
        v=self.skin(actual)+self.corrective[j]*(1-u)+self.corrective[j+1]*u;self.last={'q':q,'localMatrices':[m.tolist() for m in local]};return v,np.array(actual)
    def render(self,q):
        v,g=self.pose(q,np.repeat(np.eye(3)[None],len(self.bind),0));renderer=warp_petal if self.name.startswith('front-') and self.name.endswith('-04') else warp;return renderer(self.texture,self.uv,v,self.triangles)
    def data(self):
        return {'name':self.name,'uv':self.uv.tolist(),'triangles':self.triangles.tolist(),'bindVertices':self.bind_vertices.tolist(),'parents':[-1]+list(range(len(self.bind)-1)),'bindGlobal':self.bind.tolist(),'bindLocal':[self.bind[0].tolist()]+[(np.linalg.inv(self.bind[i-1])@self.bind[i]).tolist() for i in range(1,len(self.bind))],'weights':self.weights.tolist(),'stateGlobalMatrices':[g.tolist() for g in self.globals],'worldDeformationKeys':[v.tolist() for v in self.corrective],'states':['open','early-open','closed'] if len(self.states)==3 else ['open','closed'],'stateClosureCoordinates':self.coordinates,'texture':'Parts/'+self.name+'.png'}

class FkMesh:
    def __init__(self,name,texture,uv,tris,world,controls,parent_bind):
        self.name=name;self.texture=texture;self.uv=uv;self.triangles=tris;self.bind_vertices=apply(world,uv);points=apply(world,np.array(controls));self.bind=bone_frames(points)[:2];self.weights=weights(self.bind_vertices,points,2);self.local=[np.linalg.inv(parent_bind)@self.bind[0],np.linalg.inv(self.bind[0])@self.bind[1]];self.last=None
    def pose(self,angles,parent):
        g=[parent@self.local[0]@rotation(angles[0])];g.append(g[0]@self.local[1]@rotation(angles[1]));v=np.zeros_like(self.bind_vertices)
        for i in range(2):v+=apply(g[i]@np.linalg.inv(self.bind[i]),self.bind_vertices)*self.weights[:,i,None]
        self.last={'angles':angles,'parentMatrix':parent.tolist()};return v,np.array(g)
    def render(self,angles,parent):
        v,g=self.pose(angles,parent);return warp(self.texture,self.uv,v,self.triangles),g
    def data(self):return {'name':self.name,'uv':self.uv.tolist(),'triangles':self.triangles.tolist(),'bindVertices':self.bind_vertices.tolist(),'weights':self.weights.tolist(),'parents':[-1,0],'bindGlobal':self.bind.tolist(),'bindLocal':[v.tolist() for v in self.local],'texture':'Parts/'+self.name+'.png'}

class Plant:
    def __init__(self,level,topology,transform):
        self.level=level;self.front=[];self.rear=[];self.stem=None;self.leaves=[];self.parts={p.stem:read(p) for p in (ROOT/'Parts').glob('*.png')};self.last={}
        controls=np.array([[255,365],[181,307],[151,251],[194,213]],float)
        for side in [0,1]:
            raw=topology['front-'+str(side)];uv=np.array(raw['uv']);tris=np.array(raw['triangles']);opened=np.array(raw['open'+str(level).zfill(2)]);closed=np.array(raw['closed'+str(level).zfill(2)]);name='front-'+str(side)+'-'+str(level).zfill(2);self.front.append(DeformMesh(name,self.parts[name],uv,tris,opened,closed,controls))
            if level==4:self.front[-1].add_midpoint(np.array(raw['mid04']),.55)
            name='rear-'+str(level)+'-'+str(side);texture=self.parts[name];uv,tri=grid(texture,9);y_clamp=198 if level==3 else 247;top=135 if level==3 else 143;q=np.clip((y_clamp-uv[:,1])/(y_clamp-top),0,1);q=q*q*(3-2*q) if level==3 else q;closed=uv.copy();closed[:,0]+=(13 if level==3 else 31)*(1 if side==0 else -1)*q;closed[:,1]+=(0 if level==3 else 6)*q
            points=np.array([[244,303],[176,198],[187,135]] if level==3 else [[245,245],[187,176],[204,143]],float)
            if side:points[:,0]=(520 if level==3 else 518)-points[:,0]
            self.rear.append(DeformMesh(name,texture,uv,tri,uv,closed,points))
        world=np.eye(3) if level==3 else np.array(transform['sprout04']);texture=self.parts['sprout-'+str(level)+'-stem'];uv,tri=grid(texture,5);self.stem=FkMesh('sprout-'+str(level)+'-stem',texture,uv,tri,world,[[260,247],[260,234],[261,220]],np.eye(3))
        for side in [0,1]:
            name='sprout-'+str(level)+'-leaf-'+('l' if side==0 else 'r');texture=self.parts[name];uv,tri=grid(texture,6);points=[[257,220],[234,202],[212,187]] if side==0 else [[265,220],[286,202],[308,187]];self.leaves.append(FkMesh(name,texture,uv,tri,world,points,self.stem.bind[1]))
    def render(self,q):
        front_parts=[m.render(q) for m in self.front];center=(256+4*q*np.clip((365-Y)/170,0,1)) if self.level==3 else np.full((512,512),258.5);left=np.clip(center-X+.5,0,1);front=front_parts[0]*left[:,:,None]+front_parts[1]*(1-left[:,:,None])
        contact=np.minimum(front_parts[0][:,:,3],front_parts[1][:,:,3])*q*q*np.exp(-((X-center)/.75)**2);front[:,:,:3]*=(1-.72*contact)[:,:,None]
        rear=np.zeros((512,512,4),np.float32)
        for part in self.rear:rear=over(part.render(q),rear)
        rear=over(self.parts['seed-'+str(self.level).zfill(2)],rear)
        parent=sprout_parent(self.level,q);stem,g=self.stem.render([0,0],parent);sprout=np.zeros_like(rear)
        for side,part in enumerate(self.leaves):
            sign=1 if side==0 else -1;value,unused=part.render([sign*54*q,sign*8*q],g[1]);sprout=over(value,sprout)
        sprout=over(stem,sprout)
        shadow=np.maximum(front[:,:,3],sprout[:,:,3]*.3);shadow=cv2.GaussianBlur(shadow,(0,0),1.15);shadow=cv2.warpAffine(shadow,np.float32([[1,0,1],[0,1,2]]),(512,512));strength=.12 if self.level==3 else .06;rear[:,:,:3]*=(1-shadow*strength)[:,:,None]
        if self.level==3:
            back=self.parts['lining-03'].copy();back[:,:,:3]*=(1-shadow*.12)[:,:,None];foreground=self.parts['foreground-03']
        else:back=self.parts['background-04'];foreground=self.parts['foreground-04']
        value=over(rear,back);value=over(sprout,value);value=over(front,value);value=over(foreground,value)
        self.last={'closure':q,'deformMeshes':{m.name:m.last for m in self.front+self.rear},'fkMeshes':{m.name:m.last for m in [self.stem]+self.leaves}}
        return value
    def data(self):
        fk=[m.data() for m in [self.stem]+self.leaves]
        for i,data in enumerate(fk):data['externalParent']='sprout-retraction' if i==0 else self.stem.name+'/1'
        return {'level':self.level,'deformMeshes':[m.data() for m in self.front+self.rear],'fkMeshes':fk,'foreground':'Parts/foreground-'+str(self.level).zfill(2)+'.png','seed':'Parts/seed-'+str(self.level).zfill(2)+'.png','background':'Parts/'+('lining-03' if self.level==3 else 'background-04')+'.png','drawOrder':['background','rear-left','rear-right','seed','sprout-leaf-left','sprout-leaf-right','sprout-stem','front-pair-contact-clip','foreground'],'rootMotion':False,'rigidFrameAnimated':False}

def spline(t,ts,ys):
    if t<=ts[0]:return ys[0]
    if t>=ts[-1]:return ys[-1]
    sec=np.diff(ys)/np.diff(ts);slope=np.zeros(len(ts))
    for i in range(1,len(ts)-1):
        if sec[i-1]*sec[i]>0:slope[i]=2/(1/sec[i-1]+1/sec[i])
    i=int(np.searchsorted(ts,t,'right'))-1;h=ts[i+1]-ts[i];u=(t-ts[i])/h
    return float((2*u**3-3*u*u+1)*ys[i]+(u**3-2*u*u+u)*h*slope[i]+(-2*u**3+3*u*u)*ys[i+1]+(u**3-u*u)*h*slope[i+1])

class Scene:
    def __init__(self):
        topology=json.loads((ROOT/'topology.json').read_text('utf-8'));transform=json.loads((ROOT/'part-transforms.json').read_text('utf-8'));self.plants={3:Plant(3,topology,transform),4:Plant(4,topology,transform)};self.cels={i:read(ROOT/'References'/('K'+str(i)+'.png')) for i in [3,4]};self.keys=[]
    def render(self,t):
        if t<1.7:
            q=spline(t,[.4,.8,1.25],[0,.53,1]);value=self.plants[3].render(q);self.keys.append({'seconds':t,'stage':0,'plant':self.plants[3].last})
        elif t<2.5:value=self.cels[3];self.keys.append({'seconds':t,'stage':1,'cel':'References/K3.png'})
        elif t<3.3:value=self.cels[4];self.keys.append({'seconds':t,'stage':2,'cel':'References/K4.png'})
        else:
            q=spline(t,[3.7,4.05,4.7],[1,.55,0]);value=self.plants[4].render(q);self.keys.append({'seconds':t,'stage':3,'plant':self.plants[4].last})
        return np.clip(value,0,1)
    def data(self):return {'format':'Spawner.LocalLayeredRig.1','frameSize':[512,512],'pivot':[256,448],'renderer':'Source/quantum_scene.py','method':'per-petal-skinning-and-drawn-exclusive-quantum-states','plants':[p.data() for p in self.plants.values()],'timeline':self.keys,'quantumEvents':[1.7,2.5,3.3],'opacityKeys':[],'spineCompatibilityVerified':False,'unityImported':False}

def pilot():
    scene=Scene();board=Image.new('RGBA',(2048,1536),'#14251f');draw=ImageDraw.Draw(board)
    times=[0,.6,.8,1,1.25,1.7,2.5,3.3,3.9,4.05,4.35,4.7]
    for i,t in enumerate(times):
        im=rgba(scene.render(t));board.alpha_composite(im,((i%4)*512,(i//4)*512));draw.text(((i%4)*512+12,(i//4)*512+12),str(t),'white')
    board.convert('RGB').save(ROOT/'scene-pilot.png')
    print('pilot rendered')

if __name__=='__main__':pilot()
