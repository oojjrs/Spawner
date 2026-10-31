from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw,WebPImagePlugin
sys.path.insert(0,'H:/Spawner/$Trash/NestGrowth03To04-v1/vendor')
import cv2
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(Path(__file__).parent))
from meshlib import *
OLD=ROOT/'Source'/'Reusable'/'Parts'
REG=np.array(json.loads((ROOT/'registration.json').read_text())['level04Transform'])
REG=np.vstack([REG,[0,0,1]])

def dump(path,data):path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def layer(stage,index):
    p=ROOT/'Parts'/(stage+'-'+str(index)+'-complete.png')
    return read(p if p.exists() else ROOT/'Parts'/(stage+'-'+str(index)+'.png'))

class FlowerPart:
    def __init__(self,name,a,b,marks_a,marks_b,sign):
        self.name=name;self.a=a;self.b=b;self.counts=[16,16,12,12,12] if name.startswith('leaf-') else [24,24,16,20,20]
        ca=contour(a,marks_a,self.counts);cb=contour(b,marks_b,self.counts)
        try:
            ka=kernel_center(ca,np.mean(ca,0));kb=kernel_center(cb,np.mean(cb,0))
            va,tri=fan_mesh(ca,ka);vb,unused=fan_mesh(cb,kb)
            n=len(ca);order=np.r_[1+2*n+np.arange(n),0,1+np.arange(2*n)]
            inverse=np.argsort(order)
            self.vertices=va[order];self.target=vb[order];self.triangles=inverse[tri]
        except ValueError:
            self.vertices,self.target,self.triangles=paired_mesh(ca,cb)
        self.boundary=len(ca)
        self.rig=Skeleton();self.rig.add('root',None,(256,448),0,0)
        origin=np.array(marks_a[0],float);finish=np.array(marks_b[0],float)
        self.rig.add(name+'-carrier','root',origin,0,0)
        points=[origin,(np.array(marks_a[1])+marks_a[4])/2,np.array(marks_a[2])]
        self.points=np.array(points)
        for i,point in enumerate(points):
            tip=points[min(i+1,2)];v=tip-point
            self.rig.add(name+str(i),name+'-carrier' if i==0 else name+str(i-1),point,math.degrees(math.atan2(v[1],v[0])) if i<2 else 0,float(np.linalg.norm(v)))
        distances=np.linalg.norm(self.vertices-origin,None,1)
        u=np.clip(distances/max(float(np.linalg.norm(points[2]-origin)),1)*2,0,2)
        self.weights={name+str(i):np.clip(1-np.abs(u-i),0,1).tolist() for i in range(3)}
        self.angles={name+str(i):sign*[10,-6,3][i] for i in range(3)}
        self.delta=finish-origin
        self.rig.pose(self.angles,{name+'-carrier':self.delta})
        self.corrective=self.target-self.rig.skin(self.vertices,self.weights)
        self.clean=[]
        for source in [a,b]:
            pixels=np.array(rgba(source))
            valid=pixels[:,:,3]>220
            nearest=cv2.distanceTransformWithLabels(np.uint8(~valid),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)[1]
            yy,xx=np.where(valid);lookup=np.zeros((len(yy)+1,3),np.uint8)
            lookup[nearest[yy,xx]]=pixels[yy,xx,:3]
            padded=lookup[nearest]
            padded=cv2.GaussianBlur(padded,(3,3),.5)
            rgb=np.where(valid[:,:,None],pixels[:,:,:3],padded).astype(np.float32)/255
            self.clean.append(np.concatenate([rgb,np.ones((512,512,1),np.float32)],2))
        self.keys=[]
    def positions(self,p):
        e=ease(p)
        self.rig.pose({n:v*e for n,v in self.angles.items()},{self.name+'-carrier':self.delta*e})
        return self.rig.skin(self.vertices,self.weights)+self.corrective*e
    def point(self,point,p):
        i=int(np.argmin(np.linalg.norm(self.vertices-point,None,1)))
        return np.array(point)+self.positions(p)[i]-self.vertices[i]
    def render(self,p):
        p=float(np.clip(p,0,1))
        if p<1e-8:return self.a
        if p>1-1e-8:return self.b
        current=self.positions(p)
        source,uv=(self.clean[0],self.vertices) if p<.5 else (self.clean[1],self.target)
        texture=remap_mesh(source,uv,current,self.triangles)
        if self.name.startswith('leaf-'):
            actual=self.a if p<.5 else self.b
            return remap_mesh(actual,uv,current,self.triangles)
        alpha=Image.new('L',(1024,1024))
        ImageDraw.Draw(alpha).polygon([tuple(v*2) for v in current[:self.boundary]],255)
        alpha=np.array(alpha.resize((512,512),Image.Resampling.LANCZOS)).astype(np.float32)/255
        distance=cv2.distanceTransform(np.uint8(alpha>.5),cv2.DIST_L2,5)
        line=np.clip(3.0-distance,0,1)[:,:,None]
        rgb=texture[:,:,:3]
        return np.concatenate([rgb*alpha[:,:,None],alpha[:,:,None]],2)
    def data(self):
        return {'sourceA':self.name+'-a.png','sourceB':self.name+'-b.png','vertices':self.vertices.tolist(),'targetVertices':self.target.tolist(),'triangles':self.triangles.tolist(),'bones':self.rig.bones,'weights':self.weights,'endAngles':self.angles,'carrierDelta':self.delta.tolist(),'correctiveVertices':self.corrective.tolist(),'textureSelection':'nearest-authored-keyframe','opacityKeys':[]}

MARKS={
 'level03-start':{4:[(255,365),(103,284),(180,197),(211,222),(251,314)],5:[(259,365),(410,287),(333,198),(306,225),(263,314)],1:[(241,267),(157,208),(187,139),(224,178),(241,226)],2:[(279,267),(364,208),(335,139),(299,178),(279,226)]},
 'level03-closed':{4:[(255,364),(122,282),(238,182),(252,220),(251,309)],5:[(261,364),(393,280),(278,182),(258,220),(266,311)],1:[(241,270),(163,208),(224,136),(260,186),(264,248)],2:[(279,270),(347,207),(294,136),(258,186),(256,248)]},
 'level04-end':{4:[(257,317),(141,254),(199,186),(222,211),(255,280)],5:[(261,317),(378,254),(320,186),(295,211),(263,280)],1:[(244,236),(182,201),(204,143),(232,171),(246,213)],2:[(274,236),(337,201),(314,143),(287,171),(273,213)]},
 'level04-closed':{4:[(257,313),(171,252),(246,180),(254,211),(255,281)],5:[(262,313),(347,252),(273,180),(262,211),(263,281)],1:[(244,240),(185,196),(236,158),(257,184),(265,223)],2:[(274,240),(332,196),(279,158),(261,184),(256,223)]}
}

class Flower:
    def __init__(self,name,first,second):
        self.name=name;self.first=first;self.second=second;self.parts={}
        for index in [1,2,4,5]:
            self.parts[index]=FlowerPart(name+'-'+str(index),layer(first,index),layer(second,index),MARKS[first][index],MARKS[second][index],1 if index in [1,4] else -1)
            rgba(self.parts[index].a).save(ROOT/'Parts'/(self.parts[index].name+'-a.png'))
            rgba(self.parts[index].b).save(ROOT/'Parts'/(self.parts[index].name+'-b.png'))
        self.seed=layer(first if first.endswith('start') or first.endswith('end') else second,3)
    def render(self,p):
        value=np.zeros((512,512,4),np.float32)
        for index in [1,2]:value=over(self.parts[index].render(p),value)
        value=over(self.seed,value)
        for index in [4,5]:value=over(self.parts[index].render(p),value)
        return value

class Arm:
    def __init__(self,name,source_new,side):
        self.name=name;self.keys=[]
        self.root=np.array([155,321] if side==0 else [359,321],float) if source_new else np.array([137,361] if side==0 else [384,361],float)
        self.joint=np.array([131,268] if side==0 else [383,268],float) if source_new else np.array([102,309] if side==0 else [420,309],float)
        self.tip=np.array([170,158] if side==0 else [344,158],float) if source_new else np.array([153,198] if side==0 else [367,198],float)
        self.sources=[read(OLD/(('new' if source_new else 'old')+'-arm-'+str(side)+'-'+str(k)+'.png')) for k in range(3)]
        if source_new:
            self.root=apply(REG,[self.root])[0];self.joint=apply(REG,[self.joint])[0];self.tip=apply(REG,[self.tip])[0]
            self.sources=[affine(im,REG) for im in self.sources]
        self.lengths=[float(np.linalg.norm(self.joint-self.root)),float(np.linalg.norm(self.tip-self.joint))]
        lower=math.degrees(math.atan2(*(self.joint-self.root)[::-1]));upper=math.degrees(math.atan2(*(self.tip-self.joint)[::-1]))
        self.bind=[matrix(self.root,lower),matrix(self.joint,upper),matrix(self.joint+(self.tip-self.joint)/self.lengths[1]*35,upper)]
    def render(self,target,t):
        a,b=self.lengths;v=target-self.root
        extension=max(0,float(np.linalg.norm(v))-a-b+5);b+=extension
        d=float(np.clip(np.linalg.norm(v),abs(a-b)+.001,a+b-.001))
        theta=math.atan2(v[1],v[0]);offset=math.acos(float(np.clip((a*a+d*d-b*b)/(2*a*d),-1,1)))
        choices=[self.root+a*np.array([math.cos(theta+s*offset),math.sin(theta+s*offset)]) for s in [-1,1]]
        joint=choices[int(np.argmin([np.linalg.norm(j-self.joint) for j in choices]))]
        lo=math.degrees(math.atan2(*(joint-self.root)[::-1]));hi=math.degrees(math.atan2(*(target-joint)[::-1]))
        worlds=[matrix(self.root,lo),matrix(joint,hi),matrix(joint+(target-joint)/b*(35+extension),hi)]
        parents=[matrix((256,448),0),worlds[0],worlds[1]]
        self.keys.append({'seconds':t,'target':target.tolist(),'extension':extension,'localMatrices':[(np.linalg.inv(parent)@world).tolist() for parent,world in zip(parents,worlds)]})
        parts=[affine(im,world@np.linalg.inv(bind)) for im,world,bind in zip(self.sources,worlds,self.bind)]
        value=np.zeros_like(parts[0])
        for index in [2,1,0]:value=over(parts[index],value)
        return value

oldflower=Flower('close03','level03-start','level03-closed')
newflower=Flower('open04','level04-end','level04-closed')
arms={False:[Arm('old-arm-'+str(s),False,s) for s in range(2)],True:[Arm('new-arm-'+str(s),True,s) for s in range(2)]}

def steady(flower,p,t):
    stage=flower.first
    value=over(layer(stage,11),layer(stage,0))
    value=over(flower.render(p),value)
    for side,arm in enumerate(arms[stage.startswith('level04')]):
        target=flower.parts[1+side].point(arm.tip,p)
        value=over(arm.render(target,t),value)
    value=over(layer(stage,10),value);value=over(layer(stage,12),value)
    return value

def study():
    samples=[0,.15,.3,.45,.55,.7,.85,1]
    board=Image.new('RGBA',(2048,1024),'#182923')
    for k,p in enumerate(samples):
        image=rgba(steady(oldflower,p,p*.9+.6));board.alpha_composite(image,((k%4)*512,(k//4)*512))
    board.convert('RGB').save(ROOT/'closure-study.png')
    board=Image.new('RGBA',(2048,1024),'#182923')
    for k,p in enumerate(samples):
        image=rgba(steady(newflower,1-p,3.2+p));board.alpha_composite(image,((k%4)*512,(k//4)*512))
    board.convert('RGB').save(ROOT/'opening-study.png')
    images=[rgba(steady(oldflower,k/27,.6+k/30)) for k in range(28)]
    images[0].encoderinfo={'append_images':images[1:],'duration':[33,34,33]*9+[400],'lossless':True,'loop':0,'method':4}
    with (ROOT/'closure-study.webp').open('wb') as f:WebPImagePlugin._save_all(images[0],f,'')
    print('study rendered')

if __name__=='__main__':study()