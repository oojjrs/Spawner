import importlib.util
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
support_spec = importlib.util.spec_from_file_location('preview_support', HERE.parent / 'V1' / 'render-previews.py')
support = importlib.util.module_from_spec(support_spec)
support_spec.loader.exec_module(support)
support.HERE = HERE
cv2 = support.cv2
SIZE = 512
YY, XX = np.mgrid[:SIZE, :SIZE].astype(np.float32)


def polygon(points, scale, offset):
    pts = np.array(points, np.float32) * scale + offset
    mask = np.zeros((SIZE, SIZE), np.uint8)
    cv2.fillPoly(mask, [np.int32(pts)], 255)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)
    return mask.astype(np.float32) / 255


def build_bone(name, parent, pivot, weight, scale, offset):
    return {'name': name, 'parent': parent, 'pivot': np.array(pivot) * scale + offset, 'weights': weight}


def skin(texture, bones, controls):
    fx = np.zeros((SIZE, SIZE), np.float32)
    fy = np.zeros((SIZE, SIZE), np.float32)
    for bone in bones:
        degrees, dx, dy = controls[bone['name']]
        angle = math.radians(degrees)
        c, s = math.cos(angle), math.sin(angle)
        x, y = bone['pivot']
        w = bone['weights']
        fx += ((XX-x)*(c-1) - (YY-y)*s + dx) * w
        fy += ((XX-x)*s + (YY-y)*(c-1) + dy) * w
    sx, sy = XX.copy(), YY.copy()
    for i in range(5):
        sx = XX - cv2.remap(fx, sx, sy, cv2.INTER_LINEAR)
        sy = YY - cv2.remap(fy, sx, sy, cv2.INTER_LINEAR)
    out = cv2.remap(texture, sx, sy, cv2.INTER_LINEAR)
    out[:, :, :3] /= np.maximum(out[:, :, 3:4], 1/255)
    return Image.fromarray(np.uint8(np.clip(out * 255 + .5, 0, 255)))


def make_rig(key, original, scale, offset, bones, timelines, duration, action):
    neutral = support.transform(original, [[scale,0,offset[0]],[0,scale,offset[1]]], (SIZE,SIZE))
    support.png(HERE/key/'Source'/'neutral.png', neutral)
    texture = np.array(neutral).astype(np.float32)/255
    texture[:, :, :3] *= texture[:, :, 3:4]
    frames=[]
    for controls in timelines:
        frames.append(skin(texture,bones,controls))
    grid=np.stack(np.meshgrid(np.arange(0,513,8),np.arange(0,513,8)),axis=-1).reshape(-1,2)
    weights={bone['name']: bone['weights'][np.minimum(grid[:,1],511),np.minimum(grid[:,0],511)].round(5).tolist() for bone in bones}
    rig={'method':'original continuous textured mesh with weighted local bone controls; no alternate artwork or whole-image wobble','source':'Source/neutral.png','designReference':'Source/original.png','meshStep':8,'meshColumns':65,'vertices':grid.tolist(),'weights':weights,'bones':[{'name':b['name'],'parent':b['parent'],'pivot':b['pivot'].tolist()} for b in bones],'timeline':timelines,'durationSeconds':duration,'action':action,'stationary':'Grounded paws; rigid turtle shell or lower weasel limbs. Flexible head, leaves, torso or tail use only their local weights.'}
    support.export(key,frames,[50]*len(frames),rig)


def turtle():
    key='vine-turtle'
    original=support.load(key,'original.png')
    s=.35
    off=np.array([-15,19])
    x,y=(XX-off[0])/s,(YY-off[1])/s
    head=polygon([(255,966),(272,846),(330,785),(468,766),(580,791),(658,825),(727,907),(738,994),(695,1055),(615,1084),(462,1084),(351,1057),(294,1017)],s,off)
    head*=1-support.ease((x-595)/145)
    left=polygon([(383,540),(389,440),(479,399),(618,393),(742,447),(795,534),(808,654),(683,639),(548,609),(479,541)],s,off)
    top=polygon([(754,502),(777,409),(860,352),(956,345),(1041,383),(1037,437),(974,438),(937,550),(841,649),(797,663)],s,off)
    front=polygon([(786,643),(842,537),(940,486),(1081,504),(1166,564),(1219,702),(1122,699),(1045,667),(921,654),(850,652)],s,off)
    for w in [left,top,front]:
        w*=support.ease((675-y)/125)
    leaf_sum=np.maximum(left+top+front,1)
    bones=[build_bone('head','root',(700,965),head,s,off),build_bone('leaf-left','root',(790,651),left/leaf_sum,s,off),build_bone('leaf-upright','root',(801,649),top/leaf_sum,s,off),build_bone('leaf-front','root',(805,652),front/leaf_sum,s,off)]
    duration=7.2
    timeline=[]
    for i in range(144):
        t=i*.05
        lift=support.track([(0,0),(.8,0),(1.85,1),(2.5,1),(3.7,0),(7.2,0)],t)
        breath=math.sin(t*math.tau/2.4)
        envelope=support.ease((t-1.35)/.45)*(1-support.ease((t-4.4)/1.0))
        leaf=envelope*math.sin((t-1.35)*math.tau/1.7)
        after=envelope*math.sin((t-1.55)*math.tau/1.9)
        timeline.append({'head':[3.7*lift+.18*breath,0,-.75*breath], 'leaf-left':[-3.8*leaf,0,0], 'leaf-upright':[2.9*after,0,0], 'leaf-front':[3.0*leaf,0,0]})
    make_rig(key,original,s,off,bones,timeline,duration,'small head lift, quiet breath, delayed leaf sway, rest')


def weasel():
    key='shadow-weasel'
    original=support.load(key,'original.png')
    s=.28
    off=np.array([-13,170])
    x,y=(XX-off[0])/s,(YY-off[1])/s
    head=polygon([(233,797),(245,642),(278,548),(327,469),(470,459),(601,488),(672,543),(712,621),(808,655),(814,755),(683,799),(535,825),(389,828)],s,off)
    head*=1-support.ease((x-595)/235)
    near=polygon([(523,554),(543,513),(588,499),(635,515),(665,562),(661,609),(620,653),(571,630)],s,off)
    near*=1-support.ease((y-566)/80)
    far=polygon([(292,516),(305,482),(347,471),(380,494),(397,551),(360,594),(319,584)],s,off)
    far*=1-support.ease((y-535)/65)
    tail=polygon([(1306,446),(1445,478),(1626,529),(1706,602),(1743,693),(1725,791),(1661,856),(1544,908),(1387,920),(1445,858),(1500,805),(1543,735),(1506,666),(1434,617),(1343,592)],s,off)
    distance=np.sqrt((x-1340)**2+(y-520)**2)
    mid=tail*support.ease((distance-15)/330)
    tip=tail*support.ease((y-695)/155)
    chest=np.exp(-((x-1040)/330)**2-((y-498)/230)**2).astype(np.float32)
    chest*=support.ease((x-660)/180)*(1-support.ease((y-670)/110))
    bones=[build_bone('chest','root',(1020,740),chest,s,off),build_bone('head','root',(780,714),head,s,off),build_bone('ear-near','head',(611,625),near,s,off),build_bone('ear-far','head',(353,575),far,s,off),build_bone('tail-middle','root',(1390,570),mid,s,off),build_bone('tail-tip','tail-middle',(1610,720),tip,s,off)]
    duration=6.4
    timeline=[]
    for i in range(128):
        t=i*.05
        lift=support.track([(0,0),(.7,0),(1.12,1),(1.75,1),(2.9,0),(6.4,0)],t)
        sniff=math.exp(-((t-1.22)/.085)**2)+math.exp(-((t-1.53)/.085)**2)
        near_twitch=math.exp(-((t-1.84)/.11)**2)-.35*math.exp(-((t-2.01)/.11)**2)
        far_twitch=math.exp(-((t-2.14)/.13)**2)
        tail_envelope=support.ease((t-2.3)/.4)*(1-support.ease((t-3.5)/.8))
        wag=tail_envelope*math.sin((t-2.3)*math.tau/1.4)
        follow=tail_envelope*math.sin((t-2.5)*math.tau/1.4)
        breath=math.sin(t*math.tau/3.2)
        timeline.append({'chest':[0,0,-.85*breath],'head':[2.5*lift,0,-1.25*sniff-.28*breath],'ear-near':[-7.5*near_twitch,0,0],'ear-far':[5*far_twitch,0,0],'tail-middle':[2.2*wag,0,0],'tail-tip':[4.8*follow,0,0]})
    make_rig(key,original,s,off,bones,timeline,duration,'two small sniffs, ear reaction, delayed tail-tip flick, rest')


if __name__=='__main__':
    turtle()
    weasel()
