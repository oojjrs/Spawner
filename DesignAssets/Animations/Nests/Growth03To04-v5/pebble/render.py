from pathlib import Path
from PIL import Image,ImageDraw,WebPImagePlugin
import numpy as np
import cv2
import json
import math
import sys

ROOT=Path(__file__).parent
BIND=ROOT/'BindParts'
if not BIND.exists():
    BIND.mkdir()
SIZE=512
PHASES=[{'id': 'close', 'range': [0, 0.6], 'source': [0, 0.78]}, {'id': 'closed-hold', 'range': [0.6, 1.4], 'source': [0.78, 0.78]}, {'id': 'stone-growth', 'range': [1.4, 1.8], 'source': [0.78, 1.55]}, {'id': 'stone-hold', 'range': [1.8, 2.6], 'source': [1.55, 1.55]}, {'id': 'masonry-growth', 'range': [2.6, 3.0], 'source': [1.55, 2.25]}, {'id': 'masonry-hold', 'range': [3.0, 3.8], 'source': [2.25, 2.25]}, {'id': 'mechanism-growth', 'range': [3.8, 4.2], 'source': [2.25, 2.8]}, {'id': 'mechanism-hold', 'range': [4.2, 5.0], 'source': [2.8, 2.8]}, {'id': 'open', 'range': [5.0, 5.64], 'source': [2.8, 4.0]}, {'id': 'end-hold', 'range': [5.64, 6.32], 'source': [4.0, 4.0]}]


def source_time(elapsed):
    for phase in PHASES:
        start,end=phase['range']
        if elapsed<=end:
            p=float(np.clip((elapsed-start)/(end-start),0,1))
            a,b=phase['source']
            return a+(b-a)*p
    return 4.0



def rgba(a):
    a=np.clip(a,0,1)
    rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8)
    return Image.fromarray(np.uint8(np.clip(np.concatenate((rgb,a[:,:,3:4]),2)*255+.5,0,255)))


def read(path):
    a=np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a


def empty():
    return np.zeros((SIZE,SIZE,4),np.float32)


def over(a,b):
    return a+b*(1-a[:,:,3:4])


def smooth(t,a,b):
    q=float(np.clip((t-a)/(b-a),0,1))
    return q*q*(3-2*q)


def matrix(point,angle):
    r=math.radians(angle)
    c,s=math.cos(r),math.sin(r)
    return np.array([[c,-s,point[0]],[s,c,point[1]],[0,0,1]],float)


def affine(im,m):
    return cv2.warpAffine(im,m[:2].astype(np.float32),(SIZE,SIZE),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


class Rig:
    def __init__(self):
        self.nodes={}
        self.attachments={}
        self.bind={}
        self.current={}
        self.tracks={}
        self.add('root',None,(256,448))

    def add(self,name,parent,pivot):
        world=matrix(pivot,0)
        local=world if parent is None else np.linalg.inv(self.bind[parent])@world
        self.nodes[name]={'name':name,'parent':parent,'localBind':local.tolist(),'worldBind':world.tolist(),'pivot':list(pivot)}
        self.bind[name]=world
        self.current[name]=world.copy()
        self.tracks[name]=[]

    def attach(self,name,bone,source,limits,anchor,target):
        im=Image.open(ROOT/'Parts'/(source+'.png')).convert('RGBA')
        scale=min(limits[0]/im.width,limits[1]/im.height)
        w,h=round(im.width*scale),round(im.height*scale)
        im=im.resize((w,h),Image.Resampling.LANCZOS)
        x,y=target[0]-anchor[0]*w,target[1]-anchor[1]*h
        local=np.asarray(im).astype(np.float32)/255
        local[:,:,:3]*=local[:,:,3:4]
        m=np.array([[1,0,x],[0,1,y],[0,0,1]],float)
        registered=affine(local,m)
        rgba(registered).save(BIND/(name+'.png'))
        self.attachments[name]={'name':name,'bone':bone,'source':'Parts/'+source+'.png','registered':'BindParts/'+name+'.png','rect':[x,y,w,h],'weights':{bone:[1,1,1,1]},'image':registered}

    def point(self,attachment,u,v):
        part=self.attachments[attachment]
        x,y,w,h=part['rect']
        pos=np.array([x+w*u,y+h*v,1.0])
        m=self.current[part['bone']]@np.linalg.inv(self.bind[part['bone']])
        return (m@pos)[:2]

    def pose(self,t,translations,angles):
        for name,bone in self.nodes.items():
            local=np.array(bone['localBind'])
            local[:2,2]+=np.asarray(translations.get(name,(0,0)))
            local=local@matrix((0,0),angles.get(name,0))
            parent=bone['parent']
            self.current[name]=local if parent is None else self.current[parent]@local
            self.tracks[name].append({'time':round(t,4),'translation':list(translations.get(name,(0,0))),'rotation':angles.get(name,0),'scale':[1,1]})

    def draw(self,name):
        part=self.attachments[name]
        bone=part['bone']
        return affine(part['image'],self.current[bone]@np.linalg.inv(self.bind[bone]))


rig=Rig()
rock_specs=[
('crown','crown',(220,96),(261,275),(261,139)),
('old-crown','old-crown',(210,76),(261,195),(261,225)),
('lintel','rock-lintel',(240,85),(252,252),(256,205)),
('left-upper','rock-left-upper',(146,94),(123,266),(113,220)),
('right-upper','rock-right-upper',(146,94),(386,266),(398,226)),
('left-middle','rock-left-middle',(154,120),(103,338),(88,315)),
('right-middle','rock-right-middle',(154,120),(404,338),(423,315)),
('left-bottom','rock-left-bottom',(180,94),(108,407),(99,406)),
('right-bottom','rock-right-bottom',(180,94),(403,407),(414,406)),
('left-backing','spare-left',(108,76),(133,294),(130,266)),
('right-backing','rock-cover',(110,80),(375,296),(379,272)),
('left-low-backing','rock-cover',(104,78),(129,372),(132,371)),
('right-low-backing','spare-right',(106,78),(379,372),(383,371))
]
for name,source,limits,start,end in rock_specs:
    rig.add(name,'root',end)
    rig.attach(name,name,source,limits,(.5,.5),end)
rig.add('gate3','root',(256,421))
rig.attach('panel3','gate3','panel3',(240,190),(.5,1),(256,419))
rig.add('old-beam','gate3',(256,421))
rig.attach('beam3','old-beam','beam3',(190,55),(.5,.5),(256,421))
rig.add('old-machine','root',(380,265))
rig.add('old-wheel','old-machine',(332,244))
rig.add('old-weight','old-machine',(452,337))
rig.attach('wood-frame','old-machine','wood-frame',(145,116),(.5,.5),(380,262))
rig.attach('wood-pulley','old-wheel','wood-pulley',(49,49),(.5,.5),(332,244))
rig.attach('weight','old-weight','weight',(45,60),(.5,.5),(452,337))
rig.add('arch','root',(256,402))
rig.attach('arch','arch','arch',(220,178),(.5,1),(256,404))
rig.add('pillar-left','root',(111,437))
rig.attach('pillar-left','pillar-left','pillar-left',(153,215),(.5,1),(111,437))
rig.add('pillar-right','root',(411,437))
rig.attach('pillar-right','pillar-right','pillar-right',(153,215),(.5,1),(411,437))
rig.add('steps','root',(256,448))
rig.attach('steps','steps','stairs',(310,104),(.5,1),(256,448))
for side,center in [('left',(188,175)),('right',(335,175))]:
    parent='frame-'+side
    rig.add(parent,'root',center)
    rig.add('gear-'+side,parent,center)
    anchor=(.78,.2) if side=='left' else (.22,.2)
    rig.attach(parent,parent,parent,(76,112),anchor,center)
    rig.attach('gear-'+side,'gear-'+side,'gear-'+side,(52,52),(.5,.5),center)
rig.add('gate4','root',(261.5,365))
rig.attach('panel4','gate4','panel4',(190,197),(.5,1),(261.5,385))
rig.attach('beam4','gate4','beam4',(193,70),(.499,.55),(261.5,365))

source=Image.open(ROOT/'Source'/'reference-end.png').convert('RGBA')
a=np.asarray(source.getchannel('A'))
yy,xx=np.where(a>128)
source=source.crop((int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1))
source=source.resize((480,round(source.height*480/source.width)),Image.Resampling.LANCZOS)
ref=Image.new('RGBA',(512,512))
ref.paste(source,(16,448-source.height))
ref.save(ROOT/'reference-registered.png')
crop=ref.crop((220,290,300,382)).resize((236,219),Image.Resampling.BICUBIC)
cave=empty()
c=np.asarray(crop).astype(np.float32)/255
c[:,:,3]=1
c[:,:,:3]*=c[:,:,3:4]
cave[220:439,138:374]=c
bay=np.zeros((512,512,1),np.float32)
bay[220:439,138:374]=1


def strip(source,width,top,bottom):
    im=Image.open(ROOT/'Parts'/(source+'.png')).convert('RGBA')
    im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
    a=np.asarray(im).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a[round(a.shape[0]*top):round(a.shape[0]*bottom)]


rope=strip('rope',4,.2,.8)
chain=strip('chain',8,.28,.62)
procedural=[]


def tape(sample,p0,p1,phase):
    p0,p1=np.asarray(p0,float),np.asarray(p1,float)
    delta=p1-p0
    length=float(np.linalg.norm(delta))
    if length<1:
        return empty()
    direction=delta/length
    normal=np.array([direction[1],-direction[0]])
    count=math.ceil(length)+1
    indexes=(np.arange(count)+round(phase))%sample.shape[0]
    tile=sample[indexes]
    width=sample.shape[1]
    origin=p0-normal*width/2
    m=np.array([[normal[0],direction[0],origin[0]],[normal[1],direction[1],origin[1]],[0,0,1]],float)
    return affine(tile,m)


def clip_floor(image,y):
    result=image.copy()
    result[y:]=0
    return result


def render(elapsed):
    t=source_time(elapsed)
    close=smooth(t,.15,.75)
    growth=smooth(t,.78,1.55)
    translations={}
    angles={}
    for name,source,limits,start,end in rock_specs:
        progress=smooth(t,1.12,1.3) if name=='old-crown' else growth
        translations[name]=[(start[0]-end[0])*(1-progress),(start[1]-end[1])*(1-progress)]
        if name in ['left-bottom','right-bottom']:
            translations[name][1]-=26*smooth(t,1.55,2.25)
    translations['gate3']=[0,-114*(1-close)]
    translations['old-beam']=[0,74*smooth(t,1.85,2.15)]
    retire=smooth(t,1.0,1.55)
    translations['old-machine']=[-125*retire,100*retire]
    angles['old-machine']=15*retire
    angles['old-wheel']=90*close
    translations['old-weight']=[0,-57*close]
    for name,a,b in [('arch',1.6,2.22),('pillar-left',1.58,2.19),('pillar-right',1.64,2.25),('steps',1.55,2.12)]:
        p=smooth(t,a,b)
        minimum=rig.attachments[name]['rect'][1]
        translations[name]=[0,(452-minimum)*(1-p)]
    opening=smooth(t,2.82,3.7)
    install=smooth(t,2.23,2.8)
    translations['gate4']=[0,275*(1-install)-146*opening]
    for i,side in enumerate(['left','right']):
        p=smooth(t,2.24+i*.04,2.66+i*.04)
        translations['frame-'+side]=[(18 if i==0 else -18)*(1-p),310*(1-p)]
        angles['gear-'+side]=(-360 if i==0 else 360)*opening
    rig.pose(elapsed,translations,angles)
    step_delta=rig.current['steps'][1,2]-rig.bind['steps'][1,2]
    floor=min(449,math.ceil(rig.attachments['steps']['rect'][1]+step_delta+10))
    cave_visible=clip_floor(cave,floor)
    rocks=empty()
    for name in ['left-backing','right-backing','left-low-backing','right-low-backing','left-bottom','right-bottom','left-middle','right-middle','left-upper','right-upper','lintel']:
        rocks=over(rig.draw(name),rocks)
    pane3=rig.draw('panel3')*bay
    beam3=rig.draw('beam3')
    old_gate=over(beam3,pane3)
    for u in [.108,.894]:
        end=rig.point('beam3',u,.5)
        x=end[0]
        origin=rig.point('lintel',.19 if u<.5 else .83,.92)
        rope_im=tape(rope,origin,end,114*close)
        old_gate=over(rope_im,old_gate)
    out=over(rig.draw('crown'),cave_visible)
    out=over(rig.draw('old-crown'),out)
    old_gate=clip_floor(old_gate,floor)
    out=over(old_gate,out)
    if t>=2.8:
        out=over(cave_visible,out)
    panel4=clip_floor(rig.draw('panel4')*bay,floor)
    out=over(panel4,out)
    out=over(rocks,out)
    old_machine=over(rig.draw('wood-frame'),rig.draw('wood-pulley'))
    old_machine=over(rig.draw('weight'),old_machine)
    top=rig.point('wood-frame',.94,.14)
    bottom=rig.point('weight',.5,.045)
    old_machine=over(tape(rope,top,bottom,-57*close),old_machine)
    door_front=cave_visible if t>=2.8 else old_gate
    occlude=door_front[:,:,3:4]*(1-rocks[:,:,3:4])
    old_machine*=1-occlude
    out=over(clip_floor(old_machine,floor),out)
    out=over(clip_floor(rig.draw('arch'),floor),out)
    for side in ['left','right']:
        out=over(clip_floor(rig.draw('gear-'+side),floor),out)
    for side,u in [('left',.118),('right',.88)]:
        start=(rig.current['frame-'+side]@np.array([0,10,1]))[:2]
        end=rig.point('beam4',u,.55)
        out=over(clip_floor(tape(chain,start,end,-146*opening),floor),out)
        procedural.append({'time':round(elapsed,4),'name':'chain-'+side,'start':start.tolist(),'end':end.tolist(),'phase':-146*opening})
    for side in ['left','right']:
        out=over(clip_floor(rig.draw('frame-'+side),floor),out)
    out=over(clip_floor(rig.draw('beam4'),floor),out)
    for name in ['pillar-left','pillar-right','steps']:
        out=over(rig.draw(name),out)
    out[449:]=0
    return out


def save_json(path,data):
    path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))


def save_rig():
    attachments=[]
    for value in rig.attachments.values():
        attachments.append({k:v for k,v in value.items() if k!='image'})
    save_json(ROOT/'rig.json',{'format':'complete-part-rigid-rig','canvas':[512,512],'pivot':[256,448],'coordinateSystem':'image-x-right-y-down','bones':list(rig.nodes.values()),'attachments':attachments,'tracks':rig.tracks,'procedural':procedural,'opacityMotion':False,'timeMap':PHASES,'occlusionPlanes':[{'attachment':'steps','worldAxis':'y','offset':10,'targets':['cave','panel3','beam3','old-machine','panel4','arch','frame-left','frame-right','gear-left','gear-right','beam4','chains']}],'proceduralAttachments':{'rope':{'source':'Parts/rope.png','worldWidth':4,'cropY':[.2,.8]},'chain':{'source':'Parts/chain.png','worldWidth':8,'cropY':[.28,.62],'upperGuideBones':['frame-left','frame-right'],'lowerAttachment':'beam4'}}})


def encode(path,frames,durations,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'lossless':True,'loop':loop,'method':3}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0],f,'')


def export(mode):
    times=[i/25 for i in range(142)]
    if mode=='core-cadence':
        times=[1.2+i/25 for i in range(56)]
    if mode=='core-finish':
        times=[3.6+i/25 for i in range(52)]
    frames=[rgba(render(t)) for t in times]
    if mode.startswith('core-'):
        preview=[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames]
        encode(ROOT/(mode+'.webp'),preview,[40]*(len(preview)-1)+[400],0)
    else:
        sheet=Image.new('RGBA',(4096,9216))
        for i,im in enumerate(frames):
            sheet.alpha_composite(im,((i%8)*512,(i//8)*512))
        sheet.save(ROOT/'growth.png')
        keys=[0,15,35,40,45,64,65,70,75,94,95,100,105,124,133,141]
        board=Image.new('RGB',(1536,1616),'#233a34')
        d=ImageDraw.Draw(board)
        for k,i in enumerate(keys):
            x,y=(k%4)*384,(k//4)*404
            im=frames[i].resize((384,384),Image.Resampling.LANCZOS)
            board.paste(im,(x,y+20),im)
            d.text((x+8,y+4),str(round(i/25,2))+'s','white')
        board.save(ROOT/'keyframes.png')
        frames[0].save(ROOT/'start.png')
        frames[-1].save(ROOT/'end.png')
        durations=[40]*141+[680]
        encode(ROOT/'growth.webp',frames,durations,1)
        preview=[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames]
        encode(ROOT/'preview.webp',preview,durations,0)
        save_json(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':142,'columns':8,'rows':18,'durationsMs':durations,'durationMs':6320,'motionDurationMs':5640,'fps':25,'loop':False,'root':[256,448],'rootMotion':False,'method':'complete separate source parts with FK bones; three quantum growth intervals','phases':PHASES,'dependencies':['Pillow','numpy','opencv-python-headless'],'sources':{'rig':'rig.json','renderer':'render.py','parts':'Parts','bindParts':'BindParts','start':'start.png','end':'end.png','keyframes':'keyframes.png','partsMap':'parts.json','prompts':'generation-prompts.json'}})
    save_rig()
    print(mode,'exported',len(frames),'frames')


if __name__=='__main__':
    export(sys.argv[1] if len(sys.argv)>1 else 'full')
