from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw,WebPImagePlugin
sys.path.insert(0,str(Path(__file__).parent))
import render as b
from meshlib import *
ROOT=b.ROOT
Y,X=np.mgrid[:512,:512]

def zero():return np.zeros((512,512,4),np.float32)

def auto_marks(source,root):
    c=cv2.findContours(np.uint8(source[:,:,3]>.1),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0]
    curve=c[int(np.argmax([cv2.contourArea(x) for x in c]))][:,0,:].astype(float)
    if cv2.contourArea(curve.astype(np.float32),True)<0:curve=curve[::-1]
    k=int(np.argmin(np.linalg.norm(curve-root,None,1)))
    return [curve[(k+int(len(curve)*f))%len(curve)].tolist() for f in [0,.2,.4,.6,.8]]

leaf_pairs=[(63,54),(64,55),(88,75),(91,68),(92,72),(93,74),(104,79),(105,84),(106,82)]
leaves=[]
for i,(a_id,c_id) in enumerate(leaf_pairs):
    a=read(ROOT/'Parts'/('level03-start-region-'+str(a_id)+'.png'))
    c=read(ROOT/'Parts'/('level04-end-region-'+str(c_id)+'.png'))
    ma=auto_marks(a,(260,375));mc=auto_marks(c,(259,324))
    part=b.FlowerPart('leaf-'+str(i),a,c,ma,mc,1 if i%2==0 else -1)
    rgba(a).save(ROOT/'Parts'/(part.name+'-a.png'));rgba(c).save(ROOT/'Parts'/(part.name+'-b.png'))
    leaves.append(part)
grow=b.Flower('growth','level03-closed','level04-closed')

class Module:
    def __init__(self,name,pivot,origin,start,finish,angle,curved):
        self.name=name;self.image=read(ROOT/'Parts'/('module-'+name+'.png'))
        self.pivot=np.array([pivot[0],pivot[1],0],float);self.origin=np.array([origin[0],origin[1],0],float)
        self.start=start;self.finish=finish;self.angle=angle;self.curved=curved;self.keys=[]
        y,x=np.where(self.image[:,:,3]>.01)
        xs=np.linspace(max(0,int(x.min())-2),min(511,int(x.max())+2),max(3,math.ceil((x.max()-x.min())/18)+1))
        ys=np.linspace(max(0,int(y.min())-2),min(511,int(y.max())+2),max(3,math.ceil((y.max()-y.min())/18)+1))
        self.uv=np.array([(u,v) for v in ys for u in xs],float)
        z=45*(1-((self.uv[:,0]-259)/210)**2)*(1-((self.uv[:,1]-290)/260)**2) if curved else np.zeros(len(self.uv))
        self.vertices=np.column_stack([self.uv,z])
        tris=[]
        for row in range(len(ys)-1):
            for col in range(len(xs)-1):
                k=row*len(xs)+col
                tris.extend([(k,k+1,k+len(xs)),(k+1,k+len(xs)+1,k+len(xs))])
        self.triangles=np.array(tris,int)
    def render(self,t):
        if t<self.start:return zero()
        p=ease((t-self.start)/(self.finish-self.start))
        if p>=1:return self.image
        yaw=math.radians(self.angle*(1-p));co=math.cos(yaw);si=math.sin(yaw)
        rotation=np.array([[co,0,si],[0,1,0],[-si,0,co]])
        origin=self.origin*(1-p)+self.pivot*p
        posed=(self.vertices-self.pivot)@rotation.T+origin
        self.keys.append({'seconds':t,'yawDegrees':math.degrees(yaw),'origin':origin.tolist()})
        return remap_mesh(self.image,self.uv,posed[:,:2],self.triangles)
    def data(self):
        return {'image':'Parts/module-'+self.name+'.png','rigid':True,'bindPivot':self.pivot.tolist(),'vertices3D':self.vertices.tolist(),'uv':self.uv.tolist(),'triangles':self.triangles.tolist(),'startSeconds':self.start,'finishSeconds':self.finish,'keys':self.keys,'opacityKeys':[]}

specs=[
 ('floor',(259,334),(259,382),1.5,2.08,90,False),
 ('pedestal-left',(139,380),(259,382),1.62,2.14,90,False),
 ('pedestal-right',(381,380),(259,382),1.72,2.2,-90,False),
 ('steps',(259,413),(259,385),1.83,2.2,90,False),
 ('machine-left',(91,287),(259,354),2.3,2.76,90,False),
 ('canopy-left',(259,292),(259,412),2.2,2.74,90,True),
 ('canopy-right',(259,292),(259,412),2.28,2.8,-90,True)]
modules={v[0]:Module(*v) for v in specs}

oldrim=[read(ROOT/'Parts'/('level03-start-region-'+str(i)+'.png')) for i in [77,78,94]]
newrim=zero()
for i in [60,61,73]:newrim=over(read(ROOT/'Parts'/('level04-end-region-'+str(i)+'.png')),newrim)
newrim_node=Module.__new__(Module)
newrim_node.name='rim';newrim_node.image=newrim
rgba(newrim).save(ROOT/'Parts'/'module-rim.png')
newrim_node=Module('rim',(259,319),(259,366),2.84,3.2,90,False)
modules['rim']=newrim_node

newarm_nodes=[]
for side,arm in enumerate(b.arms[True]):
    im=arm.render(b.newflower.parts[1+side].point(arm.tip,1),3.2)
    name='arm-'+str(side);rgba(im).save(ROOT/'Parts'/('module-'+name+'.png'))
    node=Module(name,tuple(arm.root),(259,340),2.5+side*.06,3.05,90 if side==0 else -90,False)
    newarm_nodes.append(node);modules[name]=node

newseed=b.newflower.seed
seedpixels=np.array(rgba(newseed));hsv=cv2.cvtColor(seedpixels[:,:,:3],cv2.COLOR_RGB2HSV)
green=(hsv[:,:,0]>32)&(hsv[:,:,1]>75)&(Y<226)
seed_base=newseed*(~green)[:,:,None]
seed_stem=newseed*(green&(np.abs(X-259)<5)&(Y>209))[:,:,None]
seed_left=newseed*(green&(X<259)&~((np.abs(X-259)<5)&(Y>209)))[:,:,None]
seed_right=newseed*(green&(X>=259)&~((np.abs(X-259)<5)&(Y>209)))[:,:,None]


def flower_image(family,front,rear,settle):
    value=zero()
    for i in [1,2]:value=over(family.parts[i].render(rear),value)
    if settle!=0 and family is b.newflower:
        core=over(seed_stem,seed_base)
        core=over(rigid(seed_left,(258,218),-2.5*settle,(0,0)),core)
        core=over(rigid(seed_right,(262,218),3*settle,(0,0)),core)
        value=over(core,value)
    else:value=over(family.seed,value)
    for i in [4,5]:
        m=family.parts[i]
        if settle!=0 and family is b.newflower:
            sign=1 if i==4 else -1
            m.rig.pose({m.name+'1':sign*.55*settle,m.name+'2':sign*.8*settle},{})
            posed=m.rig.skin(m.vertices,m.weights)
            im=remap_mesh(m.a,m.vertices,posed,m.triangles)
        else:im=m.render(front)
        value=over(im,value)
    return value


def settle_native(t):
    native=read(ROOT/'References'/'level04-end.png')
    phase=float(np.clip((t-4.2)/.4,0,1))
    wave=math.sin(phase*2*math.pi)*(1-phase)**2
    if abs(wave)<1e-8:return native
    mx=X.astype(np.float32).copy();my=Y.astype(np.float32).copy()
    specs=[(4,(199,192),(257,317),.7,34),(5,(320,192),(261,317),-.7,34),(3,(238,190),(259,218),-2.5,22),(3,(280,190),(261,218),3.,22)]
    for index,center,pivot,angle,radius in specs:
        source=b.layer('level04-end',index)
        weight=source[:,:,3]*np.exp(-((X-center[0])**2+(Y-center[1])**2)/(2*radius**2))
        q=math.radians(angle*wave);co=math.cos(q);si=math.sin(q)
        dx=X-pivot[0];dy=Y-pivot[1]
        mx+=((co-1)*dx+si*dy)*weight
        my+=(-si*dx+(co-1)*dy)*weight
    return cv2.remap(native,mx,my,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0))


def at(t):
    if t>=4.2:return settle_native(t)
    if t<=.6:return read(ROOT/'References'/'level03-start.png')
    if t>=4.6:return read(ROOT/'References'/'level04-end.png')
    progress=float(np.clip((t-2.8)/.4,0,1))
    if t<1.5:
        family=b.oldflower;front=float(np.clip((t-.6)/.84,0,1));rear=float(np.clip((t-.68)/.82,0,1))
    elif t<2.8:family=b.oldflower;front=1.;rear=1.
    elif t<3.2:family=grow;front=progress;rear=progress
    else:
        family=b.newflower;front=1-float(np.clip((t-3.2)/.9,0,1));rear=1-float(np.clip((t-3.28)/.92,0,1))
    settle=math.sin((t-4.2)/.4*2*math.pi)*max(0,1-(t-4.2)/.4)**2 if t>4.2 else 0
    value=zero()
    for name in ['canopy-left','canopy-right','floor','machine-left']:value=over(modules[name].render(t),value)
    legacy=b.layer('level03-start',0)
    gadget_mask=((X<141)&(Y<334))
    retract=ease((t-2.05)/.65)
    gadget=rigid(legacy*gadget_mask[:,:,None],(130,371),45*retract,(0,0))
    rest=shift(legacy*(~gadget_mask)[:,:,None],(0,-48*ease(progress)))
    value=over(rest,over(gadget,value))
    if t<3.05:
        for node in newarm_nodes:value=over(node.render(t),value)
    q=ease(progress)
    for i,part in enumerate(oldrim[:2]):value=over(rigid(part,(259,365),[20,-20][i]*q,(0,-48*q)),value)
    old_arm_images=[]
    if t<2.8:
        for side,arm in enumerate(b.arms[False]):
            target=b.oldflower.parts[1+side].point(arm.tip,rear)
            retire=ease((t-2.13)/.6)
            target=target*(1-retire)+np.array([253 if side==0 else 266,300])*retire
            old_arm_images.append(arm.render(target,t))
    if t>=2.13:
        for im in old_arm_images:value=over(im,value)
    value=over(flower_image(family,front,rear,settle),value)
    if t<2.13:
        for im in old_arm_images:value=over(im,value)
    for name in ['pedestal-left','pedestal-right','steps']:value=over(modules[name].render(t),value)
    if t>=3.05:
        for side,arm in enumerate(b.arms[True]):
            p=1 if t<3.2 else rear
            value=over(arm.render(b.newflower.parts[1+side].point(arm.tip,p),t),value)
    value=over(shift(oldrim[2],(0,-48*q)),value)
    for leaf in leaves:value=over(leaf.render(progress),value)
    value=over(modules['rim'].render(t),value)
    if t>=3.2:
        native=read(ROOT/'References'/'level04-end.png')
        dynamic=zero()
        for index in [1,2,3,4,5,6,7,8,9]:dynamic=over(b.layer('level04-end',index),dynamic)
        mask=cv2.dilate(np.uint8(dynamic[:,:,3]>.05),np.ones((9,9),np.uint8))>0
        value=np.where(mask[:,:,None],value,native)
        value*=native[:,:,3:4]
    return value


def sample_board(times,name):
    board=Image.new('RGBA',(2048,512*math.ceil(len(times)/4)),'#182923')
    for k,t in enumerate(times):
        im=rgba(at(t));board.alpha_composite(im,((k%4)*512,(k//4)*512))
        im.save(ROOT/('sample-'+str(round(t*100)).zfill(3)+'.png'))
    board.convert('RGB').save(ROOT/name)
    print('sample board',name,flush=True)


def draft():
    times=[0,.9,1.2,1.5,1.8,2.1,2.3,2.55,2.8,3.,3.2,3.55,3.9,4.2,4.4,4.6]
    sample_board(times,'growth-study.png')
    frames=[]
    for i in range(57):
        frames.append(rgba(at(i*.1)))
    frames[0].encoderinfo={'append_images':frames[1:],'duration':100,'lossless':True,'loop':0,'method':4}
    with (ROOT/'growth-study.webp').open('wb') as f:WebPImagePlugin._save_all(frames[0],f,'')
    print('draft playback ready',flush=True)

if __name__=='__main__':draft()