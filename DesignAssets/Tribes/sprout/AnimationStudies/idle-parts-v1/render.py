from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import json
import math
import sys
import shutil
import subprocess

folder = Path(__file__).parent
work = folder.parents[4]/'$Trash/bean-layered-idle-20261025'
work.mkdir(511,True,True)
rig = json.loads((folder/'rig.json').read_text('utf-8'))
body = Image.open(folder/rig['body']).convert('RGBA')
size = tuple(rig['canvas'])
bones = rig['bones']
indices = {bone['name']:number for number,bone in enumerate(bones)}
textures = {}
for name,mesh in rig['meshes'].items():
    rgba = np.asarray(Image.open(folder/mesh['texture']).convert('RGBA')).astype(np.float32)/255
    rgba[:,:,:3] *= rgba[:,:,3:4]
    textures[name] = rgba

def smooth(value):
    return value*value*(3-2*value)

def driver(time):
    time %= rig['periodMs']/1000
    keys = rig['driverKeys']
    for number in range(len(keys)-1):
        first,second = keys[number],keys[number+1]
        if first[0] <= time <= second[0]:
            value = smooth((time-first[0])/(second[0]-first[0]))
            return first[1]+(second[1]-first[1])*value
    return 0

def value(time,skin,delay):
    lag = skin['lagSeconds']
    if lag:
        return skin['amplitude']*(0.6*driver(time-delay-lag)+0.28*driver(time-delay-lag*2)+0.12*driver(time-delay-lag*3))
    return skin['amplitude']*driver(time-delay)

def matrices(time,skin):
    result = []
    degrees = rig['motionDegrees']
    for bone in bones:
        name = bone['name']
        angle = 0
        if name in ['stem-base','stem-tip']:
            angle = degrees[name]*value(time,skin,0.06 if name=='stem-tip' else 0)
        if name.startswith('leaf-'):
            joint = name.split('-')[-1]
            sign = 1 if '-left-' in name else -1
            delay = {'base':0,'middle':0.055,'tip':0.105}[joint]
            angle = sign*degrees['leaf-'+joint]*value(time,skin,delay)
        if name.startswith('antenna-'):
            delay = {'antenna-base':0,'antenna-neck':0.055,'antenna-dish':0.11}[name]
            angle = degrees[name]*value(time,skin,delay)
        angle *= math.pi/180
        c,s = math.cos(angle),math.sin(angle)
        parent = indices[bone['parent']] if bone['parent'] is not None else None
        position = np.array(bone['pivot'],np.float64)
        relative = position-np.array(bones[parent]['pivot'],np.float64) if parent is not None else position
        local = np.array([[c,-s,relative[0]],[s,c,relative[1]],[0,0,1]],np.float64)
        world = result[parent]@local if parent is not None else local
        result.append(world)
    return result

def positions(mesh,world):
    transformed = []
    for vertex,influences in zip(mesh['vertices'],mesh['weights']):
        result = np.zeros(2,np.float64)
        for bone,weight in influences:
            pivot = bones[bone]['pivot']
            result += (world[bone]@np.array([vertex[0]-pivot[0],vertex[1]-pivot[1],1]))[:2]*weight
        transformed.append(result)
    return np.array(transformed)

def warp(name,world):
    mesh = rig['meshes'][name]
    source = np.array(mesh['vertices'],np.float64)
    destination = positions(mesh,world)
    texture = textures[name]
    result = np.zeros((size[1],size[0],4),np.float32)
    for triangle in mesh['triangles']:
        target = destination[triangle]
        original = source[triangle]
        x0,y0 = np.floor(target.min(0)).astype(int)
        x1,y1 = np.ceil(target.max(0)).astype(int)
        x0,y0,x1,y1 = max(0,x0),max(0,y0),min(size[0]-1,x1),min(size[1]-1,y1)
        if x1<x0 or y1<y0:
            continue
        base = np.column_stack((target[1]-target[0],target[2]-target[0]))
        if abs(np.linalg.det(base))<0.00001:
            continue
        yy,xx = np.mgrid[y0:y1+1,x0:x1+1]
        barycentric = (np.stack((xx-target[0,0],yy-target[0,1]),-1)@np.linalg.inv(base).T)
        first,second = barycentric[:,:,0],barycentric[:,:,1]
        inside = (first>=-0.00001)&(second>=-0.00001)&(first+second<=1.00001)
        if not np.any(inside):
            continue
        uv = original[0]+first[:,:,None]*(original[1]-original[0])+second[:,:,None]*(original[2]-original[0])
        u,v = np.clip(uv[:,:,0],0,510.999),np.clip(uv[:,:,1],0,510.999)
        ix,iy = np.floor(u).astype(int),np.floor(v).astype(int)
        fx,fy = (u-ix)[:,:,None],(v-iy)[:,:,None]
        sampled = texture[iy,ix]*(1-fx)*(1-fy)+texture[iy,ix+1]*fx*(1-fy)+texture[iy+1,ix]*(1-fx)*fy+texture[iy+1,ix+1]*fx*fy
        block = result[y0:y1+1,x0:x1+1]
        block[inside] = sampled[inside]
    alpha = result[:,:,3:4]
    rgb = np.divide(result[:,:,:3],np.maximum(alpha,0.000001))
    rgba = np.concatenate((rgb,alpha),2)
    return Image.fromarray(np.clip(np.rint(rgba*255),0,255).astype(np.uint8))

def frame(skin_name,index):
    skin = rig['skins'][skin_name]
    time = index*rig['frameDurationMs']/1000
    world = matrices(time,skin)
    canvas = Image.new('RGBA',size,(0,0,0,0))
    for name in skin['attachments']:
        canvas.alpha_composite(warp(name,world))
    canvas.alpha_composite(body)
    return canvas

mode = sys.argv[1] if len(sys.argv)>1 else 'all'
selected = [mode] if mode in rig['skins'] else list(rig['skins'])
frames = rig['frameCount']
frame_indices = [0,24,45,55,86,127] if mode=='keys' else list(range(frames))
for name in selected:
    target = work/'Frames'/name
    target.mkdir(511,True,True)
    for index in frame_indices:
        frame(name,index).save(target/(str(index).zfill(3)+'.png'))
    print(name+' rendered '+str(len(frame_indices))+' frames',flush=True)

if mode=='keys':
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
    sheet = Image.new('RGB',(6*256,3*284),'#26332b')
    for row,name in enumerate(selected):
        for column,index in enumerate(frame_indices):
            image = Image.open(work/'Frames'/name/(str(index).zfill(3)+'.png')).convert('RGBA').resize((256,256),Image.Resampling.LANCZOS)
            sheet.paste(image,(column*256,row*284),image)
            ImageDraw.Draw(sheet).text((column*256+12,row*284+258),rig['skins'][name]['name']+' '+str(index*50)+'ms','#e2edde',font)
    sheet.save(work/'key-poses.png')
