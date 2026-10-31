from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import math
import json

folder = Path(__file__).resolve().parent
rig = json.loads((folder/'rig.json').read_text('utf8'))
image = Image.open(folder/'Source/neutral.png').convert('RGBA')
size = rig['size']
yy,xx = np.mgrid[:size,:size].astype(float)
xn,yn = xx*256/size,yy*256/size
scale = size/256
raw=np.array(image).astype(float)
raw[:,:,:3]*=raw[:,:,3:4]/255

def smooth(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)

def limb_weight(joint,tip,width):
    jx,jy=joint
    tx,ty=tip
    vx,vy=tx-jx,ty-jy
    along=((xn-jx)*vx+(yn-jy)*vy)/(vx*vx+vy*vy)
    lateral=np.abs((xn-jx)*vy-(yn-jy)*vx)/math.hypot(vx,vy)
    cap=smooth((1.55-along)/.35)
    return smooth(along/.72)*smooth((width-lateral)/(width*.28))*cap

weights=[limb_weight(*leg[:3]) for leg in rig.get('legs',[])]

def rotation(pivot,tip,width,angle):
    weight=limb_weight(pivot,tip,width)
    px,py=pivot
    u,v=xn-px,yn-py
    c,s=math.cos(angle),math.sin(angle)
    return (c*u-s*v-u)*weight,(s*u+c*v-v)*weight

def sample(data,x,y):
    inside=(x>=0)&(x<=size-1)&(y>=0)&(y<=size-1)
    x,y=np.clip(x,0,size-1.000001),np.clip(y,0,size-1.000001)
    ix,iy=x.astype(int),y.astype(int)
    u,v=(x-ix)[:,:,None],(y-iy)[:,:,None]
    result=(data[iy,ix]*(1-u)+data[iy,ix+1]*u)*(1-v)+(data[iy+1,ix]*(1-u)+data[iy+1,ix+1]*u)*v
    return result*inside[:,:,None]

def fields(phase):
    dx,dy=np.zeros((size,size)),np.zeros((size,size))
    gait=rig['gait']
    if gait=='rabbit-hop':
        lift=math.sin(math.pi*phase/.78)**2 if phase<.78 else 0
        dy-=14*lift
        for i,(leg,weight) in enumerate(zip(rig['legs'],weights)):
            tuck=math.sin(math.pi*min(1,phase/.78))
            dx+=weight*(5 if i<2 else -3)*tuck
            dy+=weight*(-5 if i<2 else -2)*tuck
        for pivot,tip,width,angle in rig['ears']:
            rx,ry=rotation(pivot,tip,width,angle*math.sin(2*math.pi*(phase-.12)))
            dx+=rx
            dy+=ry
    elif gait=='snail-crawl':
        sole=smooth((yn-185)/23)*smooth((225-yn)/7)*smooth((xn-43)/15)*smooth((219-xn)/18)
        wave=2*math.pi*(phase-(xn-50)/140)
        dy+=sole*2.9*np.sin(wave)
        dx+=sole*3.5*np.cos(wave)
        reach=smooth((125-xn)/40)*smooth((yn-156)/14)*smooth((205-yn)/12)
        dx+=reach*2.8*math.sin(phase*2*math.pi)
        for pivot,tip,width,angle in [[[59,177],[47,147],15,.065],[[82,178],[73,145],15,-.06]]:
            rx,ry=rotation(pivot,tip,width,angle*math.sin(phase*2*math.pi+.6))
            dx+=rx
            dy+=ry
    else:
        stride={'bird-step':6.5,'heavy-walk':5.2,'quadruped-trot':7.2,'beetle-walk':5.8}[gait]
        height={'bird-step':5,'heavy-walk':4,'quadruped-trot':5.8,'beetle-walk':5.5}[gait]
        for leg,weight in zip(rig['legs'],weights):
            phase_leg=(phase+leg[3])%1
            if phase_leg<.58:
                xoffset=stride*(1-2*phase_leg/.58)
                yoffset=0
            else:
                swing=(phase_leg-.58)/.42
                xoffset=stride*(-1+2*float(smooth(swing)))
                yoffset=-height*math.sin(math.pi*swing)
            dx+=weight*xoffset
            dy+=weight*yoffset
        bob={'bird-step':1.4,'heavy-walk':.85,'quadruped-trot':1.25,'beetle-walk':.75}[gait]*(1-math.cos(phase*4*math.pi))*.5
        dy-=bob
        if weights:
            dy+=np.maximum.reduce(weights)*bob
        if 'tail' in rig:
            pivot,amplitude=rig['tail']
            tip=[204,139] if gait=='bird-step' else [208,125]
            width=57 if gait=='bird-step' else 40
            rx,ry=rotation(pivot,tip,width,amplitude*math.sin(2*math.pi*(phase-.16)))
            dx+=rx
            dy+=ry
    return np.stack((dx*scale,dy*scale),2)

def frame(phase):
    displacement=fields(phase)
    sx,sy=xx.copy(),yy.copy()
    for iteration in range(5):
        sampled=sample(displacement,sx,sy)
        sx,sy=xx-sampled[:,:,0],yy-sampled[:,:,1]
    result=sample(raw,sx,sy)
    result[:,:,:3]*=255/np.maximum(result[:,:,3:4],.00001)
    result=np.clip(result,0,255).round().astype(np.uint8)
    result[result[:,:,3]==0]=0
    return Image.fromarray(result)

count=24
columns=6
frames=[frame(i/count) for i in range(count)]
sheet=Image.new('RGBA',(columns*size,4*size),(0,0,0,0))
thumb=[]
preview=[]
duration=rig['duration']
delays=[round((i+1)*duration/count)-round(i*duration/count) for i in range(count)]
for index,drawn in enumerate(frames):
    sheet.paste(drawn,(index%columns*size,index//columns*size))
    thumb.append(drawn.resize((64,64),Image.Resampling.LANCZOS))
    preview.append(drawn.resize((256,256),Image.Resampling.LANCZOS))
sheet.save(folder/'walk.webp','WEBP',**{'lossless':True,'method':4})
thumb[0].save(folder/'thumb.webp','WEBP',**{'save_all':True,'append_images':thumb[1:],'duration':delays,'loop':0,'lossless':True,'method':4})
preview[0].save(folder/'preview.webp','WEBP',**{'save_all':True,'append_images':preview[1:],'duration':delays,'loop':0,'lossless':True,'method':4})
record={'image':'DesignAssets/Animations/CreatureWalkV1/'+folder.name+'/walk.webp','frameSize':size,'columns':columns,'durationsMs':delays,'loop':True,'pivotX':rig['pivot'][0],'pivotY':rig['pivot'][1],'cyclesPerCell':1,'method':rig['method'],'rootMotion':False,'airborneTrajectory':rig['gait']=='rabbit-hop','source':'Source/neutral.png','rig':'rig.json','renderer':'render.py'}
(folder/'walk.json').write_bytes((json.dumps(record,**{'ensure_ascii':False,'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
timeline={'durationMs':duration,'frames':[{'phase':i/count,'durationMs':delays[i]} for i in range(count)],'contactFraction':.58,'rootTravel':'Stationary in cell; game applies path translation; rabbit has an intentional vertical hop.'}
(folder/'timeline.json').write_bytes((json.dumps(timeline,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
for i,weight in enumerate(weights):
    Image.fromarray((np.clip(weight,0,1)*255).astype(np.uint8)).save(folder/'Source'/('leg-'+str(i)+'-weight.png'))
np.savez_compressed(folder/'Source/weights.npz',**{'weights':np.stack(weights) if weights else np.empty((0,size,size))})
axis=np.append(np.arange(0,size,8),size-1)
vertices=np.array([[int(x),int(y)] for y in axis for x in axis])
triangles=[]
row=len(axis)
for y in range(row-1):
    for x in range(row-1):
        a=y*row+x
        triangles.extend([[a,a+1,a+row],[a+1,a+row+1,a+row]])
vertex_weights=np.stack([weight[vertices[:,1],vertices[:,0]] for weight in weights],1) if weights else np.empty((len(vertices),0))
np.savez_compressed(folder/'Source/mesh.npz',**{'vertices':vertices,'triangles':np.array(triangles),'weights':vertex_weights})
board=Image.new('RGB',(size*4,size),(35,43,46))
for column,index in enumerate([0,6,12,18]):
    board.paste(frames[index],(column*size,0),frames[index])
board.save(folder/'key-poses.png')
print(folder.name,len(frames),size,duration,flush=True)
