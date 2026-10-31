from pathlib import Path
import math,json,sys
import numpy as np
from PIL import Image,ImageDraw
from bloom_assets import read,rgba,warp,over,write,cv2,X,Y,seed_mask
ROOT=Path(__file__).resolve().parent.parent

def matrix(x,y,angle,scale):
    a=math.radians(angle);c=math.cos(a)*scale;s=math.sin(a)*scale;return np.array([[c,-s,x],[s,c,y],[0,0,1]],float)

def smooth(q):return q*q*q*(10-15*q+6*q*q)

def interpolate(t,times,poses):
    if t<=times[0]:return np.array(poses[0],float)
    if t>=times[-1]:return np.array(poses[-1],float)
    i=int(np.searchsorted(times,t,'right'))-1;q=smooth((t-times[i])/(times[i+1]-times[i]));return np.array(poses[i])*(1-q)+np.array(poses[i+1])*q

def gold(a,floor_y):
    p=np.array(rgba(a));h=cv2.cvtColor(p[:,:,:3],cv2.COLOR_RGB2HSV);m=(p[:,:,3]>150)&(h[:,:,0]>10)&(h[:,:,0]<35)&(h[:,:,1]>130)&(p[:,:,0]>180)&(p[:,:,0]>p[:,:,1]*1.06)&(p[:,:,1]>p[:,:,2]*1.25)&(X>205)&(X<309)&(Y>floor_y)&(Y<310);yy,xx=np.where(m);return [float(xx.min()),float(yy.min()),float(xx.max()),float(yy.max())]

class SeedRig:
    def __init__(self):
        self.bind=[matrix(256,448,0,1),matrix(256,163,0,1),matrix(253,149,0,1),matrix(259,149,0,1)];self.parents=[-1,0,1,1];self.names=['root','seed','leaf-left','leaf-right'];self.local=[self.bind[0]]+[np.linalg.inv(self.bind[self.parents[i]])@self.bind[i] for i in range(1,4)];self.parts=[read(ROOT/'Parts'/(n+'.png')) for n in ['seed-body','seed-leaf-left','seed-leaf-right']];self.last=None
    def render(self,p):
        x,y,s,ls,la,ra,tilt=p;local=[self.bind[0],np.linalg.inv(self.bind[0])@matrix(x,y,tilt,s),self.local[2]@matrix(0,0,la,ls),self.local[3]@matrix(0,0,ra,ls)];g=[]
        for i,m in enumerate(local):g.append((np.eye(3) if self.parents[i]<0 else g[self.parents[i]])@m)
        layers=[warp(tex,g[i+1]@np.linalg.inv(self.bind[i+1])) for i,tex in enumerate(self.parts)];self.last={'pose':p.tolist(),'localMatrices':[v.tolist() for v in local]};return over(layers[0],over(layers[2],layers[1]))
    def data(self):
        bones=[{'id':name,'parent':self.parents[i],'bindWorld':self.bind[i].tolist(),'bindLocal':self.local[i].tolist()} for i,name in enumerate(self.names)];attachments=[{'file':'Parts/'+n+'.png','bone':i+1,'type':'rigid-region','weight':1,'canvas':[512,512]} for i,n in enumerate(['seed-body','seed-leaf-left','seed-leaf-right'])];return {'format':'custom-affine-rig-v1','coordinates':'image-x-right-y-down','pivot':[256,448],'bones':bones,'attachments':attachments,'drawOrder':[1,2,0],'activeSeconds':[.65,2.9]}

class Scene:
    def __init__(self):
        self.rig=SeedRig();self.plates=[read(ROOT/'Parts'/('hover-'+str(i)+'.png')) for i in [1,2,3,4]];self.takeoff=[read(ROOT/'Cels'/('takeoff-'+str(i)+'.png')) for i in range(6)];self.landing=[read(ROOT/'Cels'/('landing-'+str(i)+'.png')) for i in range(6)];self.times=[.65,1.05,1.35,2.05,2.7,2.85];self.poses=[[256,163,1,1,0,0,0]];canonical=gold(read(ROOT/'Parts'/'floating-seed.png'),155);cw=canonical[2]-canonical[0]+1;ch=canonical[3]-canonical[1]+1
        for i in [1,2,3,4]:
            bounds=seed_mask(read(ROOT/'References'/('K'+str(i)+'.png')),i)[1]['goldBounds'];x0,y0,x1,y1=bounds;s=math.sqrt((x1-x0+1)*(y1-y0+1)/(cw*ch));self.poses.append([(x0+x1)/2,y0-(canonical[1]-163)*s,s,1,0,0,0])
        x0,y0,x1,y1=gold(read(ROOT/'Parts'/'landing-complete-flower-1.png'),160);s=math.sqrt((x1-x0+1)*(y1-y0+1)/(cw*ch));self.poses.append([(x0+x1)/2,y0-(canonical[1]-163)*s,s,1,0,0,0]);self.last=None
    def render(self,index):
        t=index/20
        if index<13:
            cell=0 if index<4 else min(5,(index-2)//2);value=self.takeoff[cell];info={'method':'drawn-contact','cel':'Cels/takeoff-'+str(cell)+'.png'}
        elif index<58:
            stage=1 if index<27 else 2 if index<41 else 3 if index<54 else 4;p=interpolate(t,self.times,self.poses);q=math.sin(math.pi*min(1,max(0,(t-.65)/2.2)))**2;p[4]=1.3*math.sin(t*5)*q;p[5]=-1.3*math.sin(t*5+.4)*q;value=over(self.rig.render(p),self.plates[stage-1]);info={'method':'local-rig','stage':stage,'seed':self.rig.last}
        else:
            cell=min(5,1+(index-58)//3);value=self.landing[cell];info={'method':'drawn-contact' if cell<5 else 'final-hold','cel':'Cels/landing-'+str(cell)+'.png'}
        fx=self.effects(t);self.last={'frame':index,'seconds':t,**info};return over(fx,value)
    def effects(self,t):
        im=Image.new('RGBA',(1024,1024));d=ImageDraw.Draw(im)
        for event in [1.35,2.05,2.7]:
            q=(t-event)/.3
            if 0<=q<1:
                a=int(200*(1-q));r=120+75*q;cy=425-18*q;d.ellipse((2*(256-r),2*(cy-10),2*(256+r),2*(cy+10)),None,(177,255,171,a),3)
                for j in range(8):
                    angle=math.pi*2*j/8+.2;x=256+math.cos(angle)*(150+20*q);y=275+math.sin(angle)*(100+20*q)-22*q;size=3*(1-q);d.polygon([(2*x,2*(y-size)),(2*(x+size),2*y),(2*x,2*(y+size)),(2*(x-size),2*y)],(255,241,145,a))
        a=np.array(im.resize((512,512),Image.Resampling.LANCZOS)).astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a

def save_animation(images,path,loop):
    import PIL.WebPImagePlugin
    class Encoder:
        encoderinfo={'append_images':images[1:],'duration':[50]*len(images),'loop':loop,'lossless':True,'quality':80,'method':0,'background':(0,0,0,0)}
    first=images[0].copy();first.encoderinfo=Encoder.encoderinfo
    with open(path,'wb') as f:PIL.WebPImagePlugin._save_all(first,f,str(path))

def pilot():
    scene=Scene();indices=list(range(10,17))+list(range(54,72));images=[rgba(scene.render(i)) for i in indices];board=Image.new('RGBA',(2560,2560),'#edf0e7');d=ImageDraw.Draw(board)
    for j,(im,i) in enumerate(zip(images,indices)):
        x=j%5*512;y=j//5*512;board.alpha_composite(im,(x,y));d.text((x+12,y+12),str(i/20),(40,70,50,255))
    board.convert('RGB').save(ROOT/'contact-pilot.png');write(ROOT/'rig.json',scene.rig.data());save_animation(images,ROOT/'contact-pilot.webp',0);print({'pilotFrames':len(images),'poseKnots':scene.poses})

if __name__=='__main__':pilot()
