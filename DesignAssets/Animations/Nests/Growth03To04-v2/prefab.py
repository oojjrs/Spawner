from riglib import *

def translate3(point):
    m=np.eye(4);m[:3,3]=point;return m

def yaw3(angle):
    r=math.radians(angle);c,s=math.cos(r),math.sin(r)
    return np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]],float)

class Prefab:
    def __init__(self,name,source,pivot,origin,start,finish,direction):
        self.name=name;self.source=source;self.pivot=np.array([pivot[0],pivot[1],0],float);self.origin=np.array([origin[0],origin[1],0],float)
        self.start=start;self.finish=finish;self.direction=direction;self.bind=translate3(self.pivot);self.keys=[]
        a=source[:,:,3];yy,xx=np.where(a>.1);self.vertices=np.array([[xx.min(),yy.min(),0],[xx.max(),yy.min(),0],[xx.max(),yy.max(),0],[xx.min(),yy.max(),0]],float)
    def render(self,frame):
        p=ease((frame-self.start)/(self.finish-self.start));angle=self.direction*90*(1-p);origin=self.origin*(1-p)+self.pivot*p
        world=translate3(origin)@yaw3(angle);skin=world@np.linalg.inv(self.bind)
        self.keys.append({'frame':frame,'local':(np.linalg.inv(translate3([256,448,0]))@world).tolist(),'yaw':angle})
        if abs(math.cos(math.radians(angle)))<.0001:return np.zeros_like(self.source)
        m=np.array([[skin[0,0],skin[0,1],skin[0,3]],[skin[1,0],skin[1,1],skin[1,3]],[0,0,1]],float)
        return affine(self.source,m)
    def data(self):
        return {'name':self.name,'parent':'root','rigid':True,'source':self.name+'.png','localBind':(np.linalg.inv(translate3([256,448,0]))@self.bind).tolist(),'vertices3D':self.vertices.tolist(),'triangles':[[0,1,2],[0,2,3]],'weights':[[1],[1],[1],[1]],'camera':'orthographic-xy','scale':[1,1,1],'start':self.start,'finish':self.finish,'keys':self.keys}

class ArmRig:
    def __init__(self,name,root,joint,tip,lower,barrel,slider):
        self.name=name;self.root=np.array(root,float);self.joint=np.array(joint,float);self.tip=np.array(tip,float);self.sources=[lower,barrel,slider];self.lengths=[float(np.linalg.norm(self.joint-self.root)),float(np.linalg.norm(self.tip-self.joint))];self.keys=[]
        a=math.degrees(math.atan2(self.joint[1]-self.root[1],self.joint[0]-self.root[0]));b=math.degrees(math.atan2(self.tip[1]-self.joint[1],self.tip[0]-self.joint[0]))
        self.bind=[matrix(self.root,a),matrix(self.joint,b),matrix(self.joint+(self.tip-self.joint)/self.lengths[1]*35,b)]
    def render(self,target,frame):
        target=np.array(target,float);a,base_b=self.lengths;v=target-self.root;extension=max(0,float(np.linalg.norm(v))-a-base_b+7);b=base_b+extension
        distance=np.clip(np.linalg.norm(v),abs(a-b)+.001,a+b-.001);theta=math.atan2(v[1],v[0]);offset=math.acos(np.clip((a*a+distance*distance-b*b)/(2*a*distance),-1,1))
        options=[self.root+a*np.array([math.cos(theta+sign*offset),math.sin(theta+sign*offset)]) for sign in [-1,1]]
        joint=options[int(np.argmin([np.linalg.norm(point-self.joint) for point in options]))]
        lower_angle=math.degrees(math.atan2(joint[1]-self.root[1],joint[0]-self.root[0]));upper_angle=math.degrees(math.atan2(target[1]-joint[1],target[0]-joint[0]))
        globals=[matrix(self.root,lower_angle),matrix(joint,upper_angle),matrix(joint+(target-joint)/b*(35+extension),upper_angle)]
        parents=[matrix((256,448),0),globals[0],globals[1]];locals=[(np.linalg.inv(parent)@world).tolist() for parent,world in zip(parents,globals)]
        self.keys.append({'frame':frame,'target':target.tolist(),'extension':extension,'locals':locals})
        images=[affine(source,world@np.linalg.inv(bind)) for source,world,bind in zip(self.sources,globals,self.bind)]
        return images
    def data(self):
        parents=[matrix((256,448),0),self.bind[0],self.bind[1]]
        return {'name':self.name,'bones':[{'name':self.name+'-'+str(i),'parent':'root' if i==0 else self.name+'-'+str(i-1),'localBind':(np.linalg.inv(parent)@world).tolist(),'length':self.lengths[min(i,1)]} for i,(parent,world) in enumerate(zip(parents,self.bind))],'attachments':[{'source':self.name+'-'+str(i)+'.png','bone':self.name+'-'+str(i),'rigid':True,'weights':[1,1,1,1]} for i in range(3)],'keys':self.keys}
