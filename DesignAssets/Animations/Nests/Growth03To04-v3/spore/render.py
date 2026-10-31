import sys
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(sys.argv[1])
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'vendor'))
from riglib import read, rgba, over, ease, affine, rigid, shift, contour, paired_mesh, remap_mesh, Skeleton
import cv2

SOURCE = ROOT / 'Source'
PARTS = ROOT / 'Parts'
FRAMES = ROOT / 'Frames'
PARTS.mkdir(511, True, True)
FRAMES.mkdir(511, True, True)
OLD = SOURCE / 'InheritedParts'
Y, X = np.mgrid[:512, :512].astype(np.float32)
BLANK = np.zeros((512, 512, 4), np.float32)

def clean_cell(im):
    p = np.array(im.convert('RGBA'))
    n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(p[:, :, 3] > 200), 8)
    largest=int(stats[1:,4].max())
    keep=[i for i in range(1,n) if stats[i,4]>max(50,largest*.01)]
    solid = np.uint8(np.isin(labels,keep))
    curves = cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
    mask = np.zeros(solid.shape, np.uint8)
    cv2.drawContours(mask, curves, -1, 255, cv2.FILLED)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    p[:, :, 3] = np.minimum(p[:, :, 3], mask)
    q = Image.fromarray(p)
    return q.crop(q.getbbox())

def atlas(path, columns, rows):
    im = Image.open(path).convert('RGBA')
    p=np.array(im)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(p[:,:,3]>200),8)
    ids=[entry[2] for entry in sorted((int(centers[i,1]//(im.height/rows)),centers[i,0],i) for i in range(1,n) if stats[i,4]>10000)]
    result=[]
    for i in ids:
        x,y,w,h,area=stats[i]
        result.append(clean_cell(im.crop((max(0,x-2),max(0,y-2),min(im.width,x+w+2),min(im.height,y+h+2)))))
    return result

def isolated_parts(path):
    im=Image.open(path).convert('RGBA')
    p=np.array(im)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(p[:,:,3]>200),8)
    ids=[entry[1] for entry in sorted((centers[i,0],i) for i in range(1,n) if stats[i,4]>10000)]
    result=[]
    for i in ids:
        x,y,w,h,area=stats[i]
        result.append(clean_cell(im.crop((max(0,x-3),max(0,y-3),min(im.width,x+w+3),min(im.height,y+h+3)))))
    return result

def fitted(im, box):
    x, y, w, h = box
    out = Image.new('RGBA', (512, 512))
    out.alpha_composite(im.resize((w, h), Image.Resampling.LANCZOS), (x, y))
    a = np.array(out).astype(np.float32)/255
    a[:, :, :3] *= a[:, :, 3:4]
    return a

def load_old(name):
    return read(OLD / (name + '.png'))

def save_part(name, part):
    rgba(part).save(PARTS / (name + '.png'))
    return part

def draw_mask(points):
    im = Image.new('L', (512, 512))
    ImageDraw.Draw(im).polygon(points, 255)
    return np.array(im).astype(np.float32)/255

def split_pair(im, axis):
    return [im*(X <= axis)[:, :, None], im*(X > axis)[:, :, None]]

def segment(t, a, b):
    return ease((t-a)/(b-a))

def interpolate_keys(keys, t):
    if t <= keys[0][0]:
        return keys[0][1]
    for i in range(1, len(keys)):
        if t <= keys[i][0]:
            a, v = keys[i-1]
            b, w = keys[i]
            p = segment(t, a, b)
            return v*(1-p)+w*p
    return keys[-1][1]

organic = atlas(SOURCE / 'organic-atlas.png', 4, 3)
bodies = isolated_parts(SOURCE / 'body-cutaways.png')
caps = [load_old('old-cap'), fitted(organic[6], (35, 40, 426, 193)), load_old('new-cap')]
body = [fitted(bodies[0], (78, 219, 349, 226)), fitted(bodies[1], (110, 152, 273, 226)), fitted(bodies[2], (111, 153, 271, 224))]
opened = [fitted(organic[1], (95, 364, 310, 84)), fitted(organic[9], (112, 299, 275, 78))]
closed = [fitted(organic[2], (98, 335, 304, 113)), fitted(organic[5], (112, 267, 276, 111)), fitted(organic[10], (115, 269, 270, 108))]

class MeshPart:
    def __init__(self, name, source, key_shapes, marks, pivots, times):
        self.name = name
        self.source = save_part(name + '-bind', source)
        self.ribbon=name.startswith('lip-') or name in ['cap','stem-rear-bowl']
        if self.ribbon:
            self.targets=[]
            columns=41
            rows=9
            for shape in [source]+key_shapes:
                mask=np.uint8(shape[:,:,3]>.6)
                yy,xx=np.where(mask)
                lo,hi=int(xx.min()),int(xx.max())
                valid=np.array([x for x in range(lo,hi+1) if mask[:,x].any()])
                tops=np.array([np.where(mask[:,x])[0].min() for x in valid])
                bottoms=np.array([np.where(mask[:,x])[0].max() for x in valid])
                xs=np.linspace(lo,hi,columns)
                top=np.interp(xs,valid,tops)
                bottom=np.interp(xs,valid,bottoms)
                verts=[]
                for v in np.linspace(0,1,rows):
                    verts.extend(np.column_stack((xs,top*(1-v)+bottom*v)))
                self.targets.append(np.array(verts))
            self.vertices=self.targets.pop(0)
            self.triangles=[]
            for y in range(rows-1):
                for x in range(columns-1):
                    a=y*columns+x;b=a+1;c=a+columns;d=c+1
                    self.triangles.extend([(a,b,d),(a,d,c)])
            self.triangles=np.array(self.triangles)
            self.outline_ids=list(range(columns))+[y*columns+columns-1 for y in range(1,rows)]+list(range(rows*columns-2,(rows-1)*columns-1,-1))+[y*columns for y in range(rows-2,0,-1)]
            self.boundary_count=len(self.outline_ids)
        else:
            counts = [20] * len(marks[0])
            curves = [contour(shape, mark, counts) for shape, mark in zip(key_shapes, marks)]
            self.boundary_count = len(curves[0])
            self.vertices, _, self.triangles = paired_mesh(curves[0], curves[1])
            self.targets = []
            for boundary in curves:
                verts = np.zeros_like(self.vertices)
                verts[:self.boundary_count] = boundary
                for index in range(self.boundary_count, len(verts)):
                    neighbours = set()
                    for tri in self.triangles:
                        if index in tri:
                            neighbours.update(int(k) for k in tri if k < self.boundary_count)
                    verts[index] = np.mean(boundary[sorted(neighbours)], 0)
                self.targets.append(verts)
            self.outline_ids=list(range(self.boundary_count))
        self.timeline = list(zip(times, self.targets))
        self.skeleton = Skeleton()
        self.skeleton.add('root', None, (256, 448), 0, 0)
        self.skeleton.add(name + '-carrier', 'root', pivots[0], 0, 0)
        for i, point in enumerate(pivots):
            tip = pivots[min(i+1, len(pivots)-1)]
            angle = math.degrees(math.atan2(tip[1]-point[1], tip[0]-point[0]))
            length = float(np.linalg.norm(np.array(tip)-point))
            self.skeleton.add(name + '-' + str(i), name + '-carrier' if i == 0 else name + '-' + str(i-1), point, angle, length)
        distances = np.array([np.linalg.norm(self.vertices-np.array(p), None, 1) for p in pivots])
        weights = 1 / np.maximum(distances, 8)**2
        weights /= weights.sum(0)
        self.weights = {name + '-' + str(i): v.tolist() for i, v in enumerate(weights)}
        pixels = np.array(rgba(source))
        distance = cv2.distanceTransform(np.uint8(pixels[:, :, 3] > 127), cv2.DIST_L2, 5)
        mask = (pixels[:, :, 3] < 100) | ((distance < 3) & (pixels[:, :, :3].max(2) < 130))
        rgb = cv2.inpaint(pixels[:, :, :3], np.uint8(mask)*255, 4, cv2.INPAINT_TELEA).astype(np.float32)/255
        self.texture = np.concatenate((rgb, np.ones((512, 512, 1), np.float32)), 2)
        self.frame_keys = []

    def render(self, t):
        requested = interpolate_keys(self.timeline, t)
        first = self.vertices[0]
        last = requested[0]
        delta = last-first
        self.skeleton.pose({}, {self.name+'-carrier': delta})
        skinned = self.skeleton.skin(self.vertices, self.weights)
        corrective = requested-skinned
        current = skinned+corrective
        painted = remap_mesh(self.texture, self.vertices, current, self.triangles)
        mask = Image.new('L', (1024, 1024))
        ImageDraw.Draw(mask).polygon([tuple(p*2) for p in current[self.outline_ids]], 255)
        alpha = np.array(mask.resize((512, 512), Image.Resampling.LANCZOS)).astype(np.float32)/255
        dist = cv2.distanceTransform(np.uint8(alpha > .5), cv2.DIST_L2, 5)
        line = np.clip(2.0-dist, 0, 1)[:, :, None]
        rgb = painted[:, :, :3]*(1-line)+np.array([.095, .16, .14])*line
        self.frame_keys.append({'time': round(t, 4), 'carrierTranslation': delta.tolist(), 'correctiveVertices': corrective.tolist()})
        return np.concatenate((rgb*alpha[:, :, None], alpha[:, :, None]), 2)

    def data(self):
        return {'name': self.name, 'source': self.name+'-bind.png', 'bones': self.skeleton.bones, 'vertices': self.vertices.tolist(), 'triangles': self.triangles.tolist(), 'weights': self.weights, 'boundaryCount': self.boundary_count, 'poseTimes': [v[0] for v in self.timeline], 'poseVertices': [v[1].tolist() for v in self.timeline], 'keys': self.frame_keys, 'textureMixing': False}

marks_o3 = [(250,447), (158,446), (95,415), (130,364), (250,424)]
marks_c3 = [(250,447), (168,447), (98,394), (177,335), (250,356)]
marks_cm = [(250,377), (173,377), (112,325), (183,267), (250,288)]
marks_c4 = [(250,376), (176,376), (115,325), (186,269), (250,290)]
marks_o4 = [(250,376), (168,376), (112,345), (143,299), (250,355)]
lip_shapes = [opened[0], closed[0], shift(closed[0], (0,-60)), closed[1], closed[2], closed[2], opened[1], opened[1]]
lip_marks = [marks_o3, marks_c3, [(x,y-60) for x,y in marks_c3], marks_cm, marks_c4, marks_c4, marks_o4, marks_o4]
lip_times = [.6, 1.4, 2.2, 2.6, 3., 3.6, 4.24, 4.56]
lips=[]
for side in range(2):
    shapes=[split_pair(s,250)[side] for s in lip_shapes]
    marks=lip_marks if side==0 else [[(500-x,y) for x,y in m] for m in lip_marks]
    pivots=[(250,444),(190,424),(130,397)] if side==0 else [(250,444),(310,424),(370,397)]
    lips.append(MeshPart('lip-'+str(side),split_pair(closed[0],250)[side],shapes,marks,pivots,lip_times))

cap_marks = [[(246,113),(469,241),(450,324),(110,324),(28,241)], [(248,40),(461,167),(444,232),(108,232),(35,167)], [(250,51),(453,181),(440,227),(105,227),(43,181)]]
cap_shapes=[caps[0],shift(caps[0],(0,7)),shift(caps[0],(0,-34)),caps[1],shift(caps[2],(0,4)),shift(caps[2],(0,4)),caps[2],caps[2]]
cap_pose_marks=[cap_marks[0],[(x,y+7) for x,y in cap_marks[0]],[(x,y-34) for x,y in cap_marks[0]],cap_marks[1],[(x,y+4) for x,y in cap_marks[2]],[(x,y+4) for x,y in cap_marks[2]],cap_marks[2],cap_marks[2]]
cap=MeshPart('cap',caps[2],cap_shapes,cap_pose_marks,[(249,184),(135,178),(55,182)],lip_times)
body_marks=[[(249,219),(390,330),(420,439),(86,439),(113,329)],[(249,185),(372,295),(398,405),(102,405),(128,295)],[(249,153),(360,259),(376,370),(118,370),(139,259)]]
body_shapes=[body[0],body[0],shift(body[0],(0,-60)),body[1],body[2],body[2],body[2],body[2]]
body_pose_marks=[body_marks[0],body_marks[0],[(x,y-60) for x,y in body_marks[0]],body_marks[1],body_marks[2],body_marks[2],body_marks[2],body_marks[2]]
core=MeshPart('stem-rear-bowl',body[0],body_shapes,body_pose_marks,[(250,436),(250,330),(250,235)],lip_times)

hard={name:save_part(name,load_old(name)) for name in ['old-collar','old-posts','old-box','old-vent-0','old-vent-1','gold-collar','bowl-rim','left-column','right-column','pressure-machine','brass-vent-0','brass-vent-1','plinth']}
eggs_old=[save_part('egg-'+str(i),load_old('old-egg-'+str(i))) for i in range(3)]
eggs_new=[load_old('new-egg-'+str(i)) for i in range(3)]
platform=hard['plinth']
base_left=platform*(X<250)[:,:,None]
base_right=platform*(X>=250)[:,:,None]
steps_mask=draw_mask([(166,384),(332,384),(350,448),(147,448)])
steps=platform*steps_mask[:,:,None]
base_left*=1-steps_mask[:,:,None]
base_right*=1-steps_mask[:,:,None]
for n,p in [('base-left',base_left),('base-right',base_right),('steps',steps)]:save_part(n,p)

hard_keys=[]
neck_front=read(SOURCE/'start.png')*draw_mask([(207,218),(296,218),(296,241),(285,250),(220,249),(207,240)])[:,:,None]
fan_mask=np.float32(((X-386)/13)**2+((Y-320)/16.5)**2<=1)
fan=save_part('pressure-fan',hard['pressure-machine']*fan_mask[:,:,None])
fan_hub=hard['pressure-machine']*np.float32((X-386)**2+(Y-320)**2<=10)[:,:,None]
def hard_draw(name,t,pivot,start,end,origin,angle):
    p=segment(t,start,end)
    offset=(np.array(origin)-np.array(pivot))*(1-p)
    a=angle*(1-p)
    hard_keys.append({'name':name,'time':round(t,4),'translation':offset.tolist(),'rotation':a,'scale':[1,1]})
    return rigid(hard[name],pivot,a,offset)

def render(t):
    c=segment(t,.6,1.4)
    lift=segment(t,1.4,2.2)
    growth=segment(t,2.2,3.)
    build=segment(t,3.,3.6)
    opening=segment(t,3.6,4.24)
    value=BLANK.copy()
    if t>1.4:
        q=segment(t,1.4,2.2)
        for name,part,pivot,offset,angle in [('base-left',base_left,(250,392),(95*(1-q),52*(1-q)),-12*(1-q)),('base-right',base_right,(250,392),(-95*(1-q),52*(1-q)),12*(1-q)),('steps',steps,(250,390),(0,54*(1-q)),-9*(1-q))]:
            image=rigid(part,pivot,angle,offset)
            image[Y>448]=0
            value=over(image,value)
            hard_keys.append({'name':name,'time':round(t,4),'pivot':list(pivot),'translation':list(offset),'rotation':angle,'scale':[1,1]})
    retreat=segment(t,2.35,2.85)
    old_offset=(4*growth,-43*lift-32*growth)
    posts=shift(hard['old-posts'],old_offset)
    box=shift(hard['old-box'],(-70*segment(t,2.65,3.35),-35*lift-25*growth))
    value=over(posts,value)
    value=over(box,value)
    if t>=2.2:
        value=over(hard_draw('left-column',t,(142,340),2.2,2.6,(218,389),-10),value)
        value=over(hard_draw('right-column',t,(360,340),2.24,2.64,(294,389),10),value)
    if t>=3.0:
        value=over(hard_draw('pressure-machine',t,(414,375),3.,3.6,(347,410),12),value)
    if t>=4.24:
        p=segment(t,4.24,4.56)
        angle=360*p
        a=math.radians(angle)
        c0,s0=math.cos(a),math.sin(a)
        transform=np.array([[c0,-13/16.5*s0,0],[16.5/13*s0,c0,0],[0,0,1]])
        center=np.array([386,320])
        transform[:2,2]=center-transform[:2,:2]@center
        value=over(affine(fan,transform)*fan_mask[:,:,None],value)
        value=over(fan_hub,value)
        hard_keys.append({'name':'pressure-fan','parent':'pressure-machine','time':round(t,4),'pivot':[386,320],'rotation':angle,'scale':[1,1]})
    cap_image=cap.render(t)
    value=over(cap_image,value)
    core_image=core.render(t)
    core_image[Y<270-60*lift-9*growth]=0
    value=over(core_image,value)
    value=over(shift(neck_front,(4*growth,3*c-60*lift-9*growth)),value)
    if t>=3.:
        raw=body[2]
        pixels=np.array(rgba(raw))
        red=(pixels[:,:,0]>pixels[:,:,1]*1.35)&(pixels[:,:,0]>pixels[:,:,2]*1.25)&(Y>245)
        value=over(raw*red[:,:,None],value)
    collar=shift(hard['old-collar'],(4*growth,7*c-60*lift-9*growth-90*retreat))
    value=over(collar,value)
    cap_lift=interpolate_keys([(.6,0.),(1.4,7.),(2.2,-34.),(2.6,-73.),(3.,-58.),(3.6,-58.),(4.24,-62.)],t)
    front_y=221-.0023*(X-250)**2+cap_lift
    roof_front=cap_image*np.clip(front_y-Y+1,0,1)[:,:,None]
    value=over(roof_front,value)
    for i in range(2):
        side=1 if i==0 else -1
        vent=shift(hard['old-vent-'+str(i)],(side*9*growth,7*c-43*lift-32*growth))
        if build>0:
            center=np.array([99 if i==0 else 406,271])+np.array([side*9*growth,7*c-43*lift-32*growth])
            yaw=math.radians(70*build)
            mat=np.array([[math.cos(yaw),0,center[0]*(1-math.cos(yaw))],[0,1,0],[0,0,1]])
            vent=affine(vent,mat)
            cover=hard_draw('brass-vent-'+str(i),t,(143 if i==0 else 359,205),3.,3.6,(193 if i==0 else 309,236),side*14)
            value=over(vent,value)
            value=over(cover,value)
        else:
            value=over(vent,value)
    if t>=2.35:
        value=over(hard_draw('gold-collar',t,(250,200),2.35,2.8,(250,237),0),value)
    if t>=2.5:
        value=over(hard_draw('bowl-rim',t,(250,340),2.5,3.,(250,377),0),value)
    for i in range(3):
        if t<3.:
            egg=shift(eggs_old[i],(4*growth,([29,26,20][i]*c)-60*lift-9*growth))
        else:
            egg=shift(eggs_new[i],(0,[32,29,26][i]*(1-opening)))
        value=over(egg,value)
    for i,lip in enumerate(lips):
        local=t if t<=3.6 else max(3.6,t-(.035 if i==1 and t<4.24 else 0))
        value=over(lip.render(local),value)
    return np.clip(value,0,1)

def dump(path,data):
    path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def webp(path, frames, durations, loop):
    from PIL import WebPImagePlugin
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':loop,'lossless':True,'method':4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0],stream,'')

times=[.6]+[.6+(i-1)*.04 for i in range(1,100)]+[4.56]
selection=[0,11,21,31,41,51,61,71,76,81,91,99,100]
draft='--draft' in sys.argv
short='--short' in sys.argv
repack='--repack' in sys.argv
cached=json.loads((ROOT/'rig.json').read_text()) if repack else None
ids=range(93,101) if repack else list(range(22)) if short else selection if draft else range(101)
frames=[Image.open(FRAMES/(str(i).zfill(3)+'.png')).convert('RGBA') for i in range(93)] if repack else []
for i in ids:
    frame=rgba(render(times[i]))
    frames.append(frame)
    frame.save(FRAMES/(str(i).zfill(3)+'.png'))
    if i%10==0 or i==100: print('frame',i,flush=True)
if short:
    webp(ROOT/'closure-study.webp',frames,[600]+[40]*20+[800],0)
    selected=[0,5,9,13,17,21]
    contact=Image.new('RGBA',(3*384,2*410),(24,35,32,255))
    d=ImageDraw.Draw(contact)
    for n,i in enumerate(selected):
        x=(n%3)*384;y=(n//3)*410
        contact.alpha_composite(frames[i].resize((384,384),Image.Resampling.LANCZOS),(x,y))
        d.text((x+8,y+388),str(round(times[i],2))+' s',(230,230,220))
    contact.convert('RGB').save(ROOT/'closure-study.png')
elif draft:
    contact=Image.new('RGBA',(7*256,2*290),(24,35,32,255))
    d=ImageDraw.Draw(contact)
    for n,(i,frame) in enumerate(zip(ids,frames)):
        x=(n%7)*256;y=(n//7)*290
        contact.alpha_composite(frame.resize((256,256),Image.Resampling.LANCZOS),(x,y))
        d.text((x+8,y+261),str(round(times[i],2))+' s',(230,230,220))
    contact.convert('RGB').save(ROOT/'keyframes-draft.png')
else:
    durations=[600]+[40]*99+[1000]
    sheet=Image.new('RGBA',(4096,6656))
    for i,frame in enumerate(frames):sheet.alpha_composite(frame,((i%8)*512,(i//8)*512))
    sheet.save(ROOT/'growth.png')
    webp(ROOT/'growth.webp',frames,durations,1)
    small=[f.resize((384,384),Image.Resampling.LANCZOS) for f in frames]
    webp(ROOT/'preview.webp',small,durations,0)
    palette_board=Image.new('RGB',(8*96,13*96),(23,35,31))
    opaque=[]
    for i,frame in enumerate(small):
        bg=Image.new('RGBA',(384,384),(23,35,31,255))
        bg.alpha_composite(frame)
        bg=bg.convert('RGB')
        opaque.append(bg)
        palette_board.paste(bg.resize((96,96),Image.Resampling.LANCZOS),((i%8)*96,(i//8)*96))
    palette=palette_board.quantize(256,Image.Quantize.MEDIANCUT)
    gif_frames=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in opaque]
    from PIL import GifImagePlugin
    gif_frames[0].encoderinfo={'append_images':gif_frames[1:],'duration':durations,'loop':0,'disposal':2,'optimize':False}
    with (ROOT/'preview.gif').open('wb') as stream:
        GifImagePlugin._save_all(gif_frames[0],stream,'')
    frame_contract_extra=[]
    decoded=Image.open(ROOT/'growth.webp')
    for i in range(decoded.n_frames):
        decoded.seek(i)
        decoded.load()
        frame_contract_extra.append(decoded.info.get('duration',0))
    frame_contract={'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True,'textureMixing':False,'sources':{'parts':'Parts','rig':'rig.json','art':'Source'},'construction':'drawn key poses with separate weighted organic meshes and rigid mechanical attachments'}
    frame_contract['encodedFrameCount']=decoded.n_frames
    frame_contract['encodedDurationsMs']=frame_contract_extra
    frame_contract['approvedKeyframes']='Source/key-drawings.png'
    frame_contract['referenceStart']='Source/start.png'
    frame_contract['referenceEnd']='Source/end.png'
    dump(ROOT/'animation.json',frame_contract)
    meshes=[p.data() for p in [core,cap]+lips]
    if cached:
        for mesh in meshes:
            old_mesh=next(item for item in cached['meshes'] if item['name']==mesh['name'])
            mesh['keys']=[k for k in old_mesh['keys'] if k['time']<4.28]+mesh['keys']
        hard_keys=[k for k in cached['rigidKeys'] if k['time']<4.28]+hard_keys
    dump(ROOT/'rig.json',{'root':[256,448],'meshes':meshes,'rigidKeys':hard_keys,'timelineSeconds':[0,.6,1.4,2.2,2.6,3,3.6,4.24,4.56,5.56],'textureMixing':False})
