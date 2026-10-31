from pathlib import Path
import sys,math,numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).parent))
from rig import read,rgba,warp,ease,over,Y,X,cross,ROOT,cv2
def path(ts,points,t):
    ts=np.array(ts,float);p=np.array(points,float);t=np.array(t,float)
    slopes=np.diff(p,1,0)/np.diff(ts)[:,None]
    tangent=np.vstack([slopes[0],(slopes[:-1]+slopes[1:])/2,slopes[-1]])
    for i in range(1,len(ts)-1):
        for axis in [0,1]:
            if slopes[i-1,axis]*slopes[i,axis]<=0:tangent[i,axis]=0
            else:tangent[i,axis]=math.copysign(min(abs(tangent[i,axis]),3*min(abs(slopes[i-1,axis]),abs(slopes[i,axis]))),tangent[i,axis])
    out=[]
    for v in t:
        i=min(len(ts)-2,max(0,int(np.searchsorted(ts,v,'right'))-1));h=ts[i+1]-ts[i];u=(v-ts[i])/h
        out.append((2*u**3-3*u*u+1)*p[i]+(u**3-2*u*u+u)*h*tangent[i]+(-2*u**3+3*u*u)*p[i+1]+(u**3-u*u)*h*tangent[i+1])
    return np.array(out)
def matrix6(source,target):return cv2.getAffineTransform(np.float32(source),np.float32(target)).astype(float)
def apply(m,points):return np.array(points)@m[:,:2].T+m[:,2]
def affine(source,m):return cv2.warpAffine(source,m.astype(np.float32),(512,512),None,cv2.INTER_CUBIC,cv2.BORDER_CONSTANT,(0,0,0,0))
class FrontPetal:
    def __init__(self,side,texture):
        self.side=side;self.texture=texture;self.keys=[]
        self.rows=np.r_[np.linspace(253,258,4),np.linspace(258,365,54)[1:]]
        mask=texture[:,:,3]>.35;native=[]
        for y in range(253,366):
            x=np.where(mask[y])[0];native.append([x.min(),x.max()])
        native=np.array(native)
        left=np.interp(self.rows,np.arange(253,366),native[:,0]);right=np.interp(self.rows,np.arange(253,366),native[:,1])
        self.cols=11
        self.uv=np.array([[l*(1-u)+r*u,y] for y,l,r in zip(self.rows,left,right) for u in np.linspace(0,1,self.cols)])
        tri=[]
        for j in range(len(self.rows)-1):
            for i in range(self.cols-1):
                k=j*self.cols+i;tri.extend([(k,k+1,k+self.cols),(k+1,k+self.cols+1,k+self.cols)])
        self.triangles=np.array(tri,int)
        identity=np.array([[1,0,0],[0,1,0]],float)
        left_closed=matrix6([[180,197],[187,237],[130,225]],[[254,184],[268,216],[196,211]])
        mirror=np.array([[-1,0,520],[0,1,0],[0,0,1]],float)
        closed=left_closed if side==0 else (mirror@np.vstack([left_closed,[0,0,1]])@mirror)[:2]
        small_closed=np.array([[.68,0,258-.68*257],[0,.73,314-.73*366],[0,0,1]],float)
        small_open=np.array([[.76,0,259-.76*260],[0,.785,318-.785*365],[0,0,1]],float)
        self.cap_states={'open03':identity,'closed03':closed,'closed04':(small_closed@np.vstack([closed,[0,0,1]]))[:2],'open04':small_open[:2]}
        joint=apply(closed,self.uv).reshape(len(self.rows),self.cols,2)
        lower=self.rows>258
        row0=int(np.where(self.rows==258)[0][0])
        s=(self.rows[lower]-258)/107
        if side==0:
            lc=path([0,.25,.65,1],[joint[row0,0],[122,282],[145,337],[256,366]],s)
            rc=path([0,.25,.65,1],[joint[row0,-1],[265,266],[264,329],[260,366]],s)
        else:
            lc=path([0,.25,.65,1],[joint[row0,0],[255,266],[256,329],[260,366]],s)
            rc=path([0,.25,.65,1],[joint[row0,-1],[398,282],[375,337],[264,366]],s)
        for row,l,r in zip(np.where(lower)[0],lc,rc):
            joint[row]=[l*(1-u)+r*u for u in np.linspace(0,1,self.cols)]
        closed_vertices=joint.reshape(-1,2)
        self.states={'open03':self.uv,'closed03':closed_vertices,'closed04':apply(small_closed[:2],closed_vertices),'open04':apply(small_open[:2],self.uv)}
        self.cap=texture*(Y<=255)[:,:,None]
    def pose(self,a,b,p):
        q=ease(p);vertices=self.states[a]*(1-q)+self.states[b]*q;cap=self.cap_states[a]*(1-q)+self.cap_states[b]*q
        return vertices,cap
    def render(self,a,b,p):
        vertices,cap=self.pose(a,b,p)
        body=warp(self.texture,self.uv,vertices,self.triangles)
        top=affine(self.cap,cap)
        mask=X<=260 if self.side==0 else X>=260
        return over(top,body)*mask[:,:,None]
