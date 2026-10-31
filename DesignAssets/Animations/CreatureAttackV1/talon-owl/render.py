import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
import cv2
import numpy as np
from PIL import Image, ImageDraw, _webp

HERE = Path(__file__).resolve().parent
SIZE = 512
YY, XX = np.mgrid[:SIZE, :SIZE].astype(np.float32)


def save_json(path, value):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))


def value_at(keys, time):
    for a,b in zip(keys,keys[1:]):
        if time <= b[0]:
            f=max(0,min(1,(time-a[0])/(b[0]-a[0])))
            f=f*f*(3-2*f)
            return np.array(a[1:])+(np.array(b[1:])-np.array(a[1:]))*f
    return np.array(keys[-1][1:])


def webp(path, picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(), True,100.0,100.0,'',4,1,b'',''))


def animate(path, frames, durations):
    enc=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        enc.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    enc.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(enc.assemble('','',''))


def render_mesh(texture, vertices, displaced, triangles):
    map_x=XX.copy()
    map_y=YY.copy()
    for indices in triangles:
        target=displaced[indices]
        source=vertices[indices]
        left=max(0,int(np.floor(target[:,0].min())))
        top=max(0,int(np.floor(target[:,1].min())))
        right=min(SIZE,int(np.ceil(target[:,0].max()))+1)
        bottom=min(SIZE,int(np.ceil(target[:,1].max()))+1)
        if left>=right or top>=bottom:
            continue
        matrix=cv2.getAffineTransform(target,source)
        if not np.any(matrix):
            continue
        yy,xx=np.mgrid[top:bottom,left:right].astype(np.float32)
        mask=np.zeros((bottom-top,right-left),np.uint8)
        polygon=np.int32(np.rint((target-np.array([left,top]))*256))
        cv2.fillConvexPoly(mask,polygon,255,cv2.LINE_8,8)
        selected=mask>0
        sx=matrix[0,0]*xx+matrix[0,1]*yy+matrix[0,2]
        sy=matrix[1,0]*xx+matrix[1,1]*yy+matrix[1,2]
        map_x[top:bottom,left:right][selected]=sx[selected]
        map_y[top:bottom,left:right][selected]=sy[selected]
    warped=cv2.remap(texture,map_x,map_y,cv2.INTER_LINEAR)
    warped[:,:,:3]/=np.maximum(warped[:,:,3:4],1/255)
    return Image.fromarray(np.uint8(np.clip(warped*255+.5,0,255)))


def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    neutral=Image.open(HERE/rig['source']).convert('RGBA')
    texture=np.array(neutral).astype(np.float32)/255
    texture[:,:,:3]*=texture[:,:,3:4]
    masks={name:np.array(weights,np.float32) for name,weights in rig['weights'].items()}
    total=sum(masks.values())
    norm=np.maximum(total,1)
    masks={name:weights/norm for name,weights in masks.items()}
    vertices=np.array(rig['vertices'],np.float32)
    columns=rig['meshColumns']
    triangles=[]
    for row in range(columns-1):
        for col in range(columns-1):
            a=row*columns+col
            triangles.append([a,a+1,a+columns])
            triangles.append([a+1,a+columns+1,a+columns])
    frames=[]
    for time in rig['frameTimesMs']:
        if time==0 or time==1200:
            frames.append(neutral.copy())
            continue
        dx=np.zeros(len(vertices),np.float32)
        dy=np.zeros(len(vertices),np.float32)
        for bone in rig['bones']:
            angle,tx,ty,sx,sy=value_at(rig['timeline'][bone['name']],time)
            angle=math.radians(angle)
            c,s=math.cos(angle),math.sin(angle)
            px,py=bone['pivot']
            weight=masks[bone['name']]
            vx,vy=vertices[:,0],vertices[:,1]
            dx+=(((vx-px)*sx*c-(vy-py)*sy*s+px+tx)-vx)*weight
            dy+=(((vx-px)*sx*s+(vy-py)*sy*c+py+ty)-vy)*weight
        displaced=vertices+np.stack([dx,dy],1)
        frames.append(render_mesh(texture,vertices,displaced,triangles))
    atlas=Image.new('RGBA',(512*5,512*5),(0,0,0,0))
    for i,frame in enumerate(frames):
        atlas.paste(frame,(i%5*512,i//5*512))
    webp(HERE/'attack.webp',atlas)
    animate(HERE/'attack-preview.webp',[f.resize((256,256),Image.Resampling.LANCZOS) for f in frames],rig['durationsMs'])
    thumb=ROOT/'DesignAssets/Planning/UnitPreviews'/rig['name']/'attack.webp'
    thumb.parent.mkdir(511,True,True)
    animate(thumb,[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],rig['durationsMs'])
    contact=Image.new('RGB',(256*5,280*2),(36,44,39))
    draw=ImageDraw.Draw(contact)
    for j,i in enumerate([0,3,5,7,9,11,13,16,20,24]):
        p=frames[i].resize((256,256),Image.Resampling.LANCZOS)
        contact.paste(p,(j%5*256,j//5*280),p)
        draw.text((j%5*256+8,j//5*280+258),str(rig['frameTimesMs'][i])+' ms',(255,255,255))
    contact.save(HERE/'contact.png','PNG')
    data={'name':rig['name'],'action':'attack','motion':rig['action'],'image':'DesignAssets/Animations/CreatureAttackV1/'+rig['name']+'/attack.webp','frameSize':512,'columns':5,'frameCount':len(frames),'durationsMs':rig['durationsMs'],'durationMs':sum(rig['durationsMs']),'loop':False,'rootMotion':False,'pivotX':rig['pivotX'],'pivotY':rig['pivotY'],'impactFrame':rig['impactFrame'],'facing':rig['facing'],'rig':'rig.json','renderer':'render.py','preview':'attack-preview.webp','contact':'contact.png','thumbnail':'DesignAssets/Planning/UnitPreviews/'+rig['name']+'/attack.webp','method':rig['method']}
    save_json(HERE/'attack.json',data)
    print(rig['name'],len(frames),sum(rig['durationsMs']),'ms',atlas.size)


if __name__=='__main__':
    main()
