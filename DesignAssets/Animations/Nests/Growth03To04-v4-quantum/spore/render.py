import sys
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, WebPImagePlugin, GifImagePlugin

ROOT=Path(sys.argv[1])
for folder in ['Parts','Frames']:
    (ROOT/folder).mkdir(511,True,True)
sys.path.insert(0,str(ROOT/'vendor'))
import cv2

Y,X=np.mgrid[:512,:512].astype(np.float32)
EMPTY=np.zeros((512,512,4),np.float32)
CONFIG={
    'level3-open':{'level':3,'top':113,'join':225,'capBottom':326,'bodyY':375,'closed':False,'left':[38,225,177,327],'right':[337,225,474,329],'collar':[184,241,317,300],'machine':[381,307,489,423]},
    'level3-closed':{'level':3,'top':125,'join':238,'capBottom':335,'bodyY':375,'closed':True,'left':[43,232,185,335],'right':[335,232,482,337],'collar':[189,249,325,313],'machine':[383,314,496,430]},
    'level4-closed':{'level':4,'top':37,'join':166,'capBottom':254,'bodyY':332,'closed':True,'left':[53,157,192,358],'right':[307,157,416,358],'collar':[192,183,316,234],'machine':[373,220,473,386]},
    'level4-open':{'level':4,'top':51,'join':158,'capBottom':233,'bodyY':325,'closed':False,'left':[53,148,192,354],'right':[307,148,416,354],'collar':[192,177,314,225],'machine':[366,218,473,384]}
}

def read(path):
    p=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    p[:,:,:3]*=p[:,:,3:4]
    return p

def rgba(p):
    p=np.clip(p,0,1)
    rgb=p[:,:,:3]/np.maximum(p[:,:,3:4],1e-8)
    result=np.uint8(np.clip(np.concatenate((rgb,p[:,:,3:4]),2)*255+.5,0,255))
    result[result[:,:,3]==0,:3]=0
    return Image.fromarray(result)

def over(front,back):
    return front+back*(1-front[:,:,3:4])

def rectangle(box):
    a,b,c,d=box
    return (X>=a)&(X<=c)&(Y>=b)&(Y<=d)

def filled(mask):
    curves=cv2.findContours(np.uint8(mask),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]
    out=np.zeros((512,512),np.uint8)
    for curve in curves:
        if cv2.contourArea(curve)>30:
            cv2.drawContours(out,[curve],-1,1,cv2.FILLED)
    return out>0

def matrix(point):
    m=np.eye(3)
    m[:2,2]=point
    return m

def transform(m,points):
    p=np.column_stack((points,np.ones(len(points))))
    return (m@p.T).T[:,:2]

class BoneRig:
    def __init__(self):
        self.bones=[]
        self.bind={}
        self.world={}
    def add(self,name,parent,point):
        world=matrix(point)
        local=world if parent is None else np.linalg.inv(self.bind[parent])@world
        self.bones.append({'name':name,'parent':parent,'localBind':local.tolist(),'worldBind':world.tolist(),'length':0})
        if name in ['cap-mid','cap-tip']:
            next(b for b in self.bones if b['name']==parent)['length']=float(np.linalg.norm(world[:2,2]-self.bind[parent][:2,2]))
        self.bind[name]=world
        self.world[name]=world.copy()
    def pose(self,offsets):
        for bone in self.bones:
            name=bone['name']
            local=np.array(bone['localBind'])
            local[:2,2]+=offsets.get(name,(0,0))
            self.world[name]=local if bone['parent'] is None else self.world[bone['parent']]@local
    def skin(self,vertices,weights):
        out=np.zeros_like(vertices)
        for name,w in weights.items():
            out+=transform(self.world[name]@np.linalg.inv(self.bind[name]),vertices)*w[:,None]
        return out

class Surface:
    def __init__(self,name,image,weights,rig):
        self.name=name
        self.image=image
        self.rig=rig
        yy,xx=np.where(image[:,:,3]>.01)
        self.xs=np.linspace(max(0,xx.min()-3),min(511,xx.max()+3),19)
        self.ys=np.linspace(max(0,yy.min()-3),min(511,yy.max()+3),11)
        self.vertices=np.array([(x,y) for y in self.ys for x in self.xs])
        self.weights=weights(self.vertices)
        self.cells=[]
        for y in range(10):
            for x in range(18):
                a=y*19+x
                self.cells.append([a,a+1,a+20,a+19])
        self.traces=[]
    def render(self,pressure,time):
        if pressure==0:
            return self.image.copy()
        current=self.rig.skin(self.vertices,self.weights).reshape((11,19,2))
        columns=np.arange(512)
        source_y=np.empty((512,512),np.float32)
        rows=np.arange(512)
        for x in columns:
            posed=np.array([np.interp(x,self.xs,current[r,:,1]) for r in range(11)])
            if np.any(np.diff(posed)<=0):
                raise RuntimeError('Folded mesh in '+self.name)
            source_y[:,x]=np.interp(rows,posed,self.ys)
            source_y[rows<posed[0],x]=-100
            source_y[rows>posed[-1],x]=-100
        out=cv2.remap(self.image,X,source_y,cv2.INTER_LANCZOS4,None,cv2.BORDER_CONSTANT,(0,0,0,0))
        out=np.clip(out,0,1)
        out[:,:,:3]=np.minimum(out[:,:,:3],out[:,:,3:4])
        self.traces.append({'time':round(time,4),'pressure':pressure})
        return out
    def data(self):
        return {'name':self.name,'source':'Parts/'+self.name+'.png','vertices':self.vertices.tolist(),'cells':self.cells,'weights':{k:v.tolist() for k,v in self.weights.items()},'sampling':'bilinear inverse sampling of vertically skinned quads','correctiveOverride':False}

class NestRig:
    def __init__(self,name,config):
        self.name=name
        self.config=config
        self.source=read(ROOT/'Source'/(name+'.png'))
        p=np.array(rgba(self.source))
        present=p[:,:,3]>0
        assigned=np.zeros((512,512),bool)
        masks={}
        if config['level']==4:
            masks['platform']=present&((Y>=384)|((Y>=338)&((X<122)|(X>390))))
            assigned|=masks['platform']
        for label,field in [('left-support','left'),('right-support','right'),('neck-collar','collar'),('pressure-machine','machine')]:
            mask=rectangle(config[field])&present&~assigned
            masks[label]=mask
            assigned|=mask
        red=(p[:,:,0]>p[:,:,1]*1.25)&(p[:,:,0]>p[:,:,2]*1.15)&(p[:,:,0]>55)&(Y<config['capBottom'])
        cap=filled(red)
        cap=cv2.dilate(np.uint8(cap),np.ones((7,7),np.uint8))>0
        cap&=present&~assigned
        masks['cap']=cap
        assigned|=cap
        if not config['closed']:
            positions=[(209,356,46,33),(291,366,44,32),(243,394,47,32)] if config['level']==3 else [(212,300,40,29),(292,301,40,30),(253,327,42,28)]
            for i,(x,y,rx,ry) in enumerate(positions):
                egg=((X-x)/rx)**2+((Y-y)/ry)**2<=1.05
                egg&=(p[:,:,0]>p[:,:,1]*1.25)&(p[:,:,0]>p[:,:,2]*1.15)
                egg=cv2.dilate(np.uint8(egg),np.ones((3,3),np.uint8))>0
                egg&=present&~assigned
                masks['egg-'+str(i)]=egg
                assigned|=egg
        masks['body']=present&~assigned
        self.parts={label:self.source*mask[:,:,None] for label,mask in masks.items()}
        self.rig=BoneRig()
        self.rig.add('root',None,(256,448))
        self.rig.add('body-carrier','root',(256,448))
        self.rig.add('body-soft','body-carrier',(250,config['bodyY']))
        self.rig.add('cap-base','body-carrier',(250,config['join']))
        middle=(config['top']+config['join'])/2
        self.rig.add('cap-mid','cap-base',(250,middle))
        self.rig.add('cap-tip','cap-mid',(250,config['top']))
        for label in self.parts:
            if label not in ['body','cap']:
                old=config['level']==3
                mounts={'platform':(256,448),'left-support':(146,325 if config['closed'] else 310) if old else (141,340),'right-support':(360,325 if config['closed'] else 310) if old else (360,340),'neck-collar':(250,281 if config['closed'] else 268) if old else (250,205),'pressure-machine':(416,377) if old else (414,375)}
                egg_mounts=[(209,389),(291,398),(243,426)] if old else [(212,329),(292,331),(253,355)]
                point=egg_mounts[int(label[-1])] if label.startswith('egg-') else mounts[label]
                self.rig.add(label,'root' if label=='platform' else 'body-carrier',point)
        hardware=np.zeros((512,512),bool)
        for label,mask in masks.items():
            if label not in ['body','cap']:
                hardware|=mask
        distance=cv2.distanceTransform(np.uint8(~hardware),cv2.DIST_L2,5)
        body_distance=cv2.distanceTransform(np.uint8(~(hardware|cap)),cv2.DIST_L2,5)
        def cap_weights(vertices):
            xx=np.clip(np.int32(np.round(vertices[:,0])),0,511)
            yy=np.clip(np.int32(np.round(vertices[:,1])),0,511)
            freedom=np.clip((distance[yy,xx]-5)/12,0,1)
            u=np.clip((config['join']-vertices[:,1])/(config['join']-config['top']),0,1)
            mid=(1-np.abs(2*u-1))*freedom
            tip=np.clip(2*u-1,0,1)*freedom
            return {'cap-base':1-mid-tip,'cap-mid':mid,'cap-tip':tip}
        def body_weights(vertices):
            xx=np.clip(np.int32(np.round(vertices[:,0])),0,511)
            yy=np.clip(np.int32(np.round(vertices[:,1])),0,511)
            freedom=np.clip((body_distance[yy,xx]-5)/12,0,1)
            q=np.maximum(0,1-np.abs(vertices[:,1]-config['bodyY'])/85)*freedom
            q*=np.clip((448-vertices[:,1])/25,0,1)
            return {'body-carrier':1-q,'body-soft':q}
        self.cap=Surface(name+'-cap',self.parts['cap'],cap_weights,self.rig)
        self.body=Surface(name+'-body',self.parts['body'],body_weights,self.rig)
        self.keys=[]
        for label,image in self.parts.items():
            rgba(image).save(ROOT/'Parts'/(name+'-'+label+'.png'))
        neutral=self.render(0,0)
        difference=np.abs(np.array(rgba(neutral)).astype(int)-np.array(rgba(self.source)).astype(int))
        if difference.max()>0:
            raise RuntimeError('Neutral reassembly differs: '+name)

    def render(self,pressure,time):
        offsets={'cap-mid':(0,3*pressure),'cap-tip':(0,3*pressure),'body-soft':(0,1.8*pressure)}
        self.rig.pose(offsets)
        result=EMPTY.copy()
        if 'platform' in self.parts:
            result=over(self.parts['platform'],result)
        result=over(self.cap.render(pressure,time),result)
        result=over(self.body.render(pressure,time),result)
        for label,image in self.parts.items():
            if label not in ['platform','cap','body']:
                result=over(image,result)
        self.keys.append({'time':round(time,4),'offsets':{k:list(v) for k,v in offsets.items()}})
        return result

    def data(self):
        return {'name':self.name,'source':'Source/'+self.name+'.png','level':self.config['level'],'bones':self.rig.bones,'meshes':[self.cap.data(),self.body.data()],'rigidAttachments':[{'name':label,'bone':label,'source':'Parts/'+self.name+'-'+label+'.png','weights':[1]} for label in self.parts if label not in ['body','cap']],'drawOrder':['platform','cap','body','left-support','right-support','neck-collar','pressure-machine','egg-0','egg-1','egg-2'],'keys':self.keys,'neutralReassemblyMaxError':0}

def smooth(t):
    t=float(np.clip(t,0,1))
    return t*t*(3-2*t)

def envelope(t,a,b):
    return smooth((t-a)/(b-a))

def state(t):
    if t<1.4:
        return 'level3-open',envelope(t,.6,1.4)
    if t<2.6:
        p=.5*envelope(t,1.6,1.84)+.9*envelope(t,2.2,2.6)
        return 'level3-closed',p
    if t<4.24:
        p=1.4*(1-envelope(t,2.6,2.96))+.35*envelope(t,3.92,4.24)
        return 'level4-closed',p
    return 'level4-open',.3*(1-envelope(t,4.24,4.56))

def webp(path,frames,durations,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':loop,'lossless':True,'method':4}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0],f,'')

def dump(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))

rigs={name:NestRig(name,cfg) for name,cfg in CONFIG.items()}
if '--rig-data-only' in sys.argv:
    existing=json.loads((ROOT/'rig.json').read_text())
    for name,rig in rigs.items():
        prior=existing['states'][name]['keys']
        existing['states'][name]=rig.data()
        existing['states'][name]['keys']=prior
    dump(ROOT/'rig.json',existing)
    print('Attachment pivots aligned to actual mounts.')
    sys.exit(0)
test='--rig-test' in sys.argv
if test:
    panels=[]
    for name,rig in rigs.items():
        frames=[rgba(rig.render(1.4*smooth(i/10),i/25)) for i in range(11)]
        webp(ROOT/(name+'-rig-test.webp'),frames,[80]*10+[400],0)
        panels.extend([rgba(rig.render(0,0)),rgba(rig.render(1.4,.4))])
    board=Image.new('RGBA',(4*320,2*350),(24,35,31,255))
    d=ImageDraw.Draw(board)
    for i,im in enumerate(panels):
        x=i%4*320;y=i//4*350
        board.alpha_composite(im.resize((320,320),Image.Resampling.LANCZOS),(x,y))
        d.text((x+8,y+326),list(rigs)[i//2]+(' neutral' if i%2==0 else ' maximum'),(230,235,220))
    board.convert('RGB').save(ROOT/'rig-reassembly.png')
    dump(ROOT/'rig.json',{'format':'independent-state-layered-rigs','canvas':[512,512],'root':[256,448],'states':{name:r.data() for name,r in rigs.items()},'crossfade':False,'vertexCorrectionOverride':False})
    print('Four neutral rigs reassemble exactly; maximum-pressure tests exported.')
    sys.exit(0)

times=[0]+[.6+(i-1)*.04 for i in range(1,100)]+[4.56]
durations=[600]+[40]*99+[1000]
frames=[]
tracks=[]
for i,t in enumerate(times):
    name,pressure=state(t)
    frame=rgba(rigs[name].render(pressure,t))
    frames.append(frame)
    frame.save(ROOT/'Frames'/(str(i).zfill(3)+'.png'))
    tracks.append({'frame':i,'time':round(t,4),'activeRig':name,'level':CONFIG[name]['level'],'pressure':pressure,'activeRigCount':1})
    if i%20==0:print('frame',i,flush=True)
sheet=Image.new('RGBA',(4096,6656))
for i,im in enumerate(frames):sheet.alpha_composite(im,((i%8)*512,(i//8)*512))
sheet.save(ROOT/'growth.png')
webp(ROOT/'growth.webp',frames,durations,1)
small=[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames]
webp(ROOT/'preview.webp',small,durations,0)
opaque=[]
pal_board=Image.new('RGB',(8*96,13*96),(24,35,31))
for i,im in enumerate(small):
    bg=Image.new('RGBA',(384,384),(24,35,31,255))
    bg.alpha_composite(im)
    q=bg.convert('RGB')
    opaque.append(q)
    pal_board.paste(q.resize((96,96),Image.Resampling.LANCZOS),((i%8)*96,(i//8)*96))
palette=pal_board.quantize(256,Image.Quantize.MEDIANCUT)
gif=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in opaque]
gif[0].encoderinfo={'append_images':gif[1:],'duration':durations,'loop':0,'disposal':2,'optimize':False}
with (ROOT/'preview.gif').open('wb') as stream:GifImagePlugin._save_all(gif[0],stream,'')
dump(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'quantumSwitchAtMs':2600,'poseCutsAtMs':[1400,4240],'construction':'independent approved pose rigs; one active rig per frame; single-frame level change','rig':'rig.json','source':'Source','crossfade':False,'states':tracks})
dump(ROOT/'rig.json',{'format':'independent-state-layered-rigs','canvas':[512,512],'root':[256,448],'states':{name:r.data() for name,r in rigs.items()},'crossfade':False,'vertexCorrectionOverride':False})
print('Quantum sequence exported.',flush=True)
