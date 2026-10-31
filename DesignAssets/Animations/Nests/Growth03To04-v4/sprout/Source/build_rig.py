from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).parent/'Source'))
from rig import ROOT,read,rgba,over,ease,cross,warp,bezier,mask_from_curve,Y,X,cv2
from grid_rig import FrontPetal,affine,apply,path

def mat3(m):return np.vstack([m,[0,0,1]]) if m.shape==(2,3) else m
def translation(x,y):return np.array([[1,0,x],[0,1,y],[0,0,1]],float)
def rotation(angle,point):
    a=math.radians(angle);c=math.cos(a);s=math.sin(a);r=np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
    return translation(*point)@r@translation(*(-np.array(point)))
def frame(center,direction):
    d=np.array(direction,float);d/=np.linalg.norm(d)
    return np.array([[d[0],-d[1],center[0]],[d[1],d[0],center[1]],[0,0,1]],float)
def phase(t,start,end):return ease((t-start)/(end-start))
def save_json(file,data):file.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

class Skin:
    def __init__(self,name,uv,triangles,states,cols,rows,cap_states):
        self.name=name;self.uv=uv;self.triangles=triangles;self.states=states;self.cols=cols;self.rows=rows
        self.indices=[len(rows)-1,int(len(rows)*.7),int(len(rows)*.35),0]
        self.globals={};self.locals={};self.correctives={}
        grid=uv.reshape(len(rows),cols,2);bind_centers=np.array([grid[i].mean(0) for i in self.indices])
        self.bind=np.array([frame(c,bind_centers[min(i+1,3)]-c if i<3 else c-bind_centers[2]) for i,c in enumerate(bind_centers)])
        if cap_states is not None:self.bind[3]=frame(grid[0].mean(0),[0,-1])
        s=np.linspace(0,1,len(rows));bs=s[self.indices];weights=[]
        for v in s:
            weight=np.zeros(4)
            for j in range(3):
                if bs[j]>=v>=bs[j+1]:
                    q=(bs[j]-v)/(bs[j]-bs[j+1]);weight[j]=1-q;weight[j+1]=q;break
            weights.extend([weight]*cols)
        self.weights=np.array(weights)
        if cap_states is not None:self.weights[np.repeat(rows<=258,cols)]=[0,0,0,1]
        self.bind_local=np.array([self.bind[0]]+[np.linalg.inv(self.bind[i-1])@self.bind[i] for i in range(1,4)])
        for key,vertices in states.items():
            grid=vertices.reshape(len(rows),cols,2);centers=np.array([grid[i].mean(0) for i in self.indices])
            g=np.array([frame(c,centers[min(i+1,3)]-c if i<3 else c-centers[2]) for i,c in enumerate(centers)])
            if cap_states is not None:g[3]=mat3(cap_states[key])@self.bind[3]
            self.globals[key]=g;self.locals[key]=np.array([g[0]]+[np.linalg.inv(g[i-1])@g[i] for i in range(1,4)])
            self.correctives[key]=vertices-self.skin(g)
    def skin(self,globals):
        result=np.zeros_like(self.uv)
        for i in range(4):result+=apply((globals[i]@np.linalg.inv(self.bind[i]))[:2],self.uv)*self.weights[:,i,None]
        return result
    def pose(self,a,b,p,offsets):
        q=ease(p);desired=self.globals[a]*(1-q)+self.globals[b]*q
        locals=np.array([desired[0]]+[np.linalg.inv(desired[i-1])@desired[i] for i in range(1,4)])
        actual=[]
        for i in range(4):actual.append((actual[i-1] if i else np.eye(3))@locals[i]@offsets[i])
        value=self.skin(np.array(actual))+self.correctives[a]*(1-q)+self.correctives[b]*q
        return value,np.array(actual),locals
    def data(self):
        return {'name':self.name,'parents':[-1,0,1,2],'uv':self.uv.tolist(),'triangles':self.triangles.tolist(),'weights':self.weights.tolist(),'bindGlobal':self.bind.tolist(),'bindLocal':self.bind_local.tolist(),'localMatrixKeys':{k:v.tolist() for k,v in self.locals.items()},'worldDeformationKeys':{k:v.tolist() for k,v in self.correctives.items()}}

class Front:
    def __init__(self,side):
        self.side=side;self.part=FrontPetal(side,read(ROOT/'Parts'/('front-'+('left' if side==0 else 'right')+'.png')))
        p=self.part;self.skin=Skin('front-'+str(side),p.uv,p.triangles,p.states,p.cols,p.rows,p.cap_states)
        rgba(p.cap).save(ROOT/'Parts'/('front-cap-'+str(side)+'.png'))
    def pose(self,a,b,p,angle):
        offsets=np.repeat(np.eye(3)[None],4,0);offsets[3]=rotation(angle,[0,0])
        vertices,g,local=self.skin.pose(a,b,p,offsets);cap=g[3]@np.linalg.inv(self.skin.bind[3])
        return vertices,cap
    def render(self,a,b,p,angle):
        vertices,cap=self.pose(a,b,p,angle);part=self.part
        body=warp(part.texture,part.uv,vertices,part.triangles);top=affine(part.cap,cap[:2]);q=ease(p)
        centers={'open03':260,'closed03':260,'closed04':260.04,'open04':259}
        center=centers[a]*(1-q)+centers[b]*q;mask=X<=center if self.side==0 else X>center
        return over(top,body)*mask[:,:,None]

def rear_outline(key,side):
    shapes={
      'open03':((187,138),[[[179,170],[152,193],[157,213]],[[158,242],[201,261],[241,270]],[[252,255],[255,235],[246,209]],[[225,182],[206,156],[187,138]]]),
      'closed03':((224,136),[[[204,156],[170,185],[163,210]],[[165,242],[208,261],[241,270]],[[267,267],[278,242],[270,216]],[[266,181],[247,151],[224,136]]]),
      'open04':((204,143),[[[197,162],[179,185],[182,202]],[[185,224],[216,237],[245,241]],[[253,232],[255,220],[250,204]],[[233,176],[218,156],[204,143]]]),
      'closed04':((236,158),[[[215,175],[189,191],[185,207]],[[187,228],[220,241],[245,241]],[[265,237],[269,225],[265,207]],[[260,185],[247,166],[236,158]]])}
    start,segments=shapes[key];curve=bezier(start,segments)
    if side:curve[:,0]=(520 if key.endswith('03') else 518)-curve[:,0]
    return curve

def silhouette_rows(curve,n,cols):
    mask=mask_from_curve(curve)[:,:,3]>.4;yy,xx=np.where(mask);ys=np.linspace(yy.min(),yy.max(),n);left=[];right=[]
    for y in range(yy.min(),yy.max()+1):
        xs=np.where(mask[y])[0]
        left.append(xs.min() if len(xs) else left[-1]);right.append(xs.max() if len(xs) else right[-1])
    ls=np.interp(ys,np.arange(yy.min(),yy.max()+1),left);rs=np.interp(ys,np.arange(yy.min(),yy.max()+1),right)
    rs=np.maximum(rs,ls+.7)
    return np.array([[l+(r-l)*u,y] for y,l,r in zip(ys,ls,rs) for u in np.linspace(0,1,cols)])

class Rear:
    def __init__(self,side):
        self.side=side;self.n=60;self.cols=9;self.states={k:silhouette_rows(rear_outline(k,side),self.n,self.cols) for k in ['open03','closed03','closed04','open04']}
        self.uv=self.states['open03'];tris=[]
        for j in range(self.n-1):
            for i in range(self.cols-1):
                n=j*self.cols+i;tris.extend([(n,n+1,n+self.cols),(n+1,n+self.cols+1,n+self.cols)])
        self.triangles=np.array(tris,int)
        raw=read(ROOT/'Source'/'Raw'/('petal-'+str(2+side)+'.png'));full=np.zeros((512,512,4),np.float32);h,w=raw.shape[:2]
        scale=min(440/w,440/h);im=cv2.resize(raw,(int(w*scale),int(h*scale)),None,0,0,cv2.INTER_AREA);full[20:20+im.shape[0],20:20+im.shape[1]]=im
        curves=cv2.findContours(np.uint8(full[:,:,3]>.4),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0];poly=curves[int(np.argmax([cv2.contourArea(c) for c in curves]))][:,0,:]
        source=silhouette_rows(poly,self.n,self.cols)
        self.texture=warp(full,source,self.uv,self.triangles);rgba(self.texture).save(ROOT/'Parts'/('rear-'+str(side)+'.png'))
        self.skin=Skin('rear-'+str(side),self.uv,self.triangles,self.states,self.cols,np.arange(self.n),None)
    def vertices(self,a,b,p):return self.skin.pose(a,b,p,np.repeat(np.eye(3)[None],4,0))[0]
    def render(self,a,b,p):return warp(self.texture,self.uv,self.vertices(a,b,p),self.triangles)
    def contact(self,a,b,p,family):
        t=(198-138)/(270-138) if family=='old' else (176-143)/(241-143)
        r=int(round(t*(self.n-1)));j=0 if self.side==0 else self.cols-1
        source=self.uv.reshape(self.n,self.cols,2);v=self.vertices(a,b,p).reshape(self.n,self.cols,2)
        desired=np.array(([153,198] if self.side==0 else [367,198]) if family=='old' else ([177,176] if self.side==0 else [341,176]),float)
        reference=self.states['open03' if family=='old' else 'open04'].reshape(self.n,self.cols,2)
        offset=desired-reference[r,j];old=reference[r+1,j]-reference[r-1,j];now=v[r+1,j]-v[r-1,j]
        angle=math.atan2(now[1],now[0])-math.atan2(old[1],old[0]);co=math.cos(angle);si=math.sin(angle)
        return v[r,j]+np.array([[co,-si],[si,co]])@offset

class Arm:
    def __init__(self,name,spec):
        self.name=name;self.root=np.array(spec['root'],float);self.joint=np.array(spec['joint'],float);self.tip=np.array(spec['tip'],float)
        self.lower=read(ROOT/spec['lower']);self.upper=read(ROOT/spec['upper']);self.lengths=[float(np.linalg.norm(self.joint-self.root)),float(np.linalg.norm(self.tip-self.joint))]
        self.sign=1 if cross(self.tip-self.root,self.joint-self.root)>0 else -1
        self.bind=[frame(self.root,self.joint-self.root),frame(self.joint,self.tip-self.joint)];self.max_error=0;self.clamped=0
    def solve(self,root,goal):
        delta=goal-root;distance=np.linalg.norm(delta);l1,l2=self.lengths;d=float(np.clip(distance,abs(l1-l2)+.001,l1+l2-.001))
        if abs(d-distance)>.01:self.clamped+=1
        u=delta/max(distance,1e-8);along=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-along*along))
        joint=root+u*along+np.array([-u[1],u[0]])*height*self.sign;tip=root+u*d
        g=[frame(root,joint-root),frame(joint,tip-joint)];self.max_error=max(self.max_error,float(np.linalg.norm(tip-goal)))
        low=affine(self.lower,(g[0]@np.linalg.inv(self.bind[0]))[:2]);up=affine(self.upper,(g[1]@np.linalg.inv(self.bind[1]))[:2])
        return over(up,low),{'root':root.tolist(),'joint':joint.tolist(),'tip':tip.tolist(),'global':[v.tolist() for v in g],'local':[g[0].tolist(),(np.linalg.inv(g[0])@g[1]).tolist()]}
    def data(self):return {'name':self.name,'parents':['root',self.name+'-lower'],'bindGlobal':[g.tolist() for g in self.bind],'bindLocal':[self.bind[0].tolist(),(np.linalg.inv(self.bind[0])@self.bind[1]).tolist()],'lengths':self.lengths,'bendSign':self.sign,'stretch':False}

def compose(layers):
    values=np.stack([v for v,z in layers]);z=np.stack([np.broadcast_to(depth,(512,512)) for v,depth in layers]);z=np.where(values[:,:,:,3]>.00001,z,-1e6)
    order=np.argsort(z,0,'stable');output=np.zeros((512,512,4),np.float32);yi,xi=np.mgrid[:512,:512]
    for i in range(len(layers)):
        value=values[order[i],yi,xi];output=over(value,output)
    return np.clip(output,0,1)*(Y<=448)[:,:,None]

class Scene:
    def __init__(self):
        self.front=[Front(0),Front(1)];self.rear=[Rear(0),Rear(1)]
        self.parts={p.stem:read(p) for p in (ROOT/'Parts').glob('*.png')}
        specs=json.loads((ROOT/'arm-bind.json').read_text());self.arms={k:Arm(k,v) for k,v in specs.items()};self.records=[]
        sprout=self.parts['sprout'];left=((X<261)&(Y<226));right=((X>=261)&(Y<226));stem=((X>=254)&(X<=269)&(Y>=217))
        self.sprout_parts=[sprout*stem[:,:,None],sprout*left[:,:,None],sprout*right[:,:,None]]
    def interval(self,t,side):
        delay=.09*side
        if t<1.5+delay:return 'open03','closed03',float(np.clip((t-.6-delay)/(.68),0,1))
        if t<2.8:return 'closed03','closed03',0
        if t<3.2:return 'closed03','closed04',(t-2.8)/.4
        return 'closed04','open04',float(np.clip((t-3.2-delay)/(.8),0,1))
    def settle(self,t,side):
        s=float(np.clip((t-4.05)/.55,0,1));return (.8 if side==0 else -.8)*math.sin(3*math.pi*s)*math.sin(math.pi*s)**2
    def render(self,t):
        layers=[];rigid_keys={};p=self.parts;growth=phase(t,2.8,3.2);base_lift=405*(1-phase(t,1.5,2.2));dome_lift=405*(1-phase(t,2.2,2.8))
        def add(name,m,depth):
            image=affine(p[name],m[:2]);image=image*floor_void[:,:,None] if name.startswith('old-rim') or name in ['crank','canopy','pressure-vessel'] else image;layers.append((image,depth));rigid_keys[name]={'global':m.tolist(),'depth':depth}
        base=translation(0,base_lift);dome=translation(0,dome_lift);old_sink=260*phase(t,2.2,2.8)
        surface_x=np.array([50,80,135,190,330,385,438,468],float);surface_y=np.array([370,345,322,318,318,322,345,370],float)+base_lift
        floor_void=~((X>=50)&(X<=468)&(Y>=np.interp(X,surface_x,surface_y)))
        for name,m,depth in [('foundation-back',base,0),('foundation-front',base,42),('canopy',dome,-30),('pressure-vessel',dome,-29)]:add(name,m,depth)
        fan=np.array([[1-.23*growth,0,259*growth+260*(1-growth)-(1-.23*growth)*260],[0,1-.333*growth,375-51*growth-(1-.333*growth)*375],[0,0,1]],float)
        add('leaf-fan',fan,36)
        for side in range(2):
            source=np.array([137,361] if side==0 else [384,361]);target=np.array([163,329] if side==0 else [355,329]);scale=np.diag([1-.28*growth,1-.22*growth,1]);vine=translation(*(source*(1-growth)+target*growth))@scale@translation(*(-source))
            add('vine-'+('left' if side==0 else 'right'),vine,37)
        for side in range(2):
            a,b,q=self.interval(t-.1,side);rear=self.rear[side];layers.append((rear.render(a,b,q),2))
        a,b,q=self.interval(t,0);g=phase(t,2.8,3.2)
        plant=np.array([[1-.24*g,0,259*g+260*(1-g)-(1-.24*g)*260],[0,1-.215*g,365-47*g-(1-.215*g)*365],[0,0,1]],float)
        add('seed',plant,5)
        tuck=phase(t,.72,1.43)*(1-phase(t,3.2,4.05));stem=plant@rotation(78*tuck,[260,247]);leaf_left=stem@rotation(-112*tuck,[257,219]);leaf_right=stem@rotation(112*tuck,[264,219])
        for name,source,m in zip(['sprout-stem','sprout-leaf-left','sprout-leaf-right'],self.sprout_parts,[stem,leaf_left,leaf_right]):
            rgba(source).save(ROOT/'Parts'/(name+'.png'));layers.append((affine(source,m[:2]),6));rigid_keys[name]={'global':m.tolist(),'depth':6}
        for side in range(2):
            a,b,q=self.interval(t,side);front=self.front[side].render(a,b,q,self.settle(t,side))
            extent=170*(1-growth)+130*growth;center=260-growth
            local=np.clip(abs(X-center)/extent,0,1);depth=8+14*np.sin(np.pi*local)
            layers.append((front,depth))
        fold=phase(t,1.6,2.55)
        for side in range(2):
            shift=translation(0,-51*growth+old_sink);hinge=[232,375] if side==0 else [288,375]
            m=shift@rotation((-48 if side==0 else 48)*fold,hinge)
            add('old-rim-'+str(side),m,8-14*fold)
            add('new-rim-'+str(side),base,8)
        old_cup=translation(0,-51*growth+35*phase(t,3.02,3.2)+old_sink)
        add('old-rim-cup',old_cup,4-19*phase(t,3.0,3.2));add('new-rim-cup',base,4)
        arm_records={}
        for side in range(2):
            a,b,q=self.interval(t-.1,side);rear=self.rear[side]
            old=self.arms['old-arm-'+str(side)];attach=rear.contact(a,b,q,'old');retreat=phase(t,1.7,2.5);fold_goal=np.array([253,300] if side==0 else [267,300],float)
            goal=attach*(1-retreat)+fold_goal*retreat
            value,record=old.solve(old.root+np.array([0,old_sink]),goal+np.array([0,old_sink]));layers.append((value*floor_void[:,:,None],24-42*retreat));arm_records[old.name]=record
            new=self.arms['new-arm-'+str(side)];attach=rear.contact(a,b,q,'new');unfold=phase(t,2.0,2.55)
            root=new.root+np.array([0,base_lift]);fold_goal=new.root+np.array([80 if side==0 else -80,-50]);goal=fold_goal*(1-unfold)+attach*unfold+np.array([0,base_lift*(1-unfold)])
            value,record=new.solve(root,goal);layers.append((value,-10+55*phase(t,2.2,2.55)));arm_records[new.name]=record
        crank=translation(0,old_sink)@rotation(45*phase(t,1.7,2.55),[130,371]);add('crank',crank,-40)
        self.records.append({'time':t,'base':base.tolist(),'canopy':dome.tolist(),'fan':fan.tolist(),'plant':plant.tolist(),'arms':arm_records,'rigidParts':rigid_keys,'settleCurlDegrees':[self.settle(t,0),self.settle(t,1)],'oldChassisSink':old_sink})
        return compose(layers)
    def data(self):
        return {'format':'Spawner.LayerRig.1','canvas':[512,512],'origin':[256,448],'coordinateSystem':'image-x-right-y-down','rootMotion':False,'meshes':[p.skin.data() for p in self.front+self.rear],'arms':[p.data() for p in self.arms.values()],'keys':self.records,'opacityKeys':[],'groundClipY':448,'boneParentRules':{'base':'root','canopy':'root','fan':'plant','sproutStem':'plant','sproutLeafLeft':'sproutStem','sproutLeafRight':'sproutStem','curl':'front-upper'},'partFiles':sorted('Parts/'+p.name for p in (ROOT/'Parts').glob('*.png'))}

def sample():
    scene=Scene();times=[0,.76,1.0,1.25,1.5,1.85,2.15,2.45,2.8,3,3.2,3.45,3.7,4.0,4.2,4.6];images=[]
    board=Image.new('RGBA',(2048,2048),'#182923');draw=ImageDraw.Draw(board)
    for i,t in enumerate(times):
        im=rgba(scene.render(t));images.append(im);x=(i%4)*512;y=(i//4)*512;board.alpha_composite(im,(x,y));draw.text((x+15,y+15),str(t),'white')
        print('sample',t)
    board.convert('RGB').save(ROOT/'rig-assembly-study.png');save_json(ROOT/'rig-pilot.json',scene.data())
    print('IK max errors',[(k,v.max_error,v.clamped) for k,v in scene.arms.items()])

if __name__=='__main__':sample()
