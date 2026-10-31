from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json
import math
import sys

folder=Path(__file__).resolve().parent
from mesh_render import warp,rigid,lattice
import tail_mesh

rig=json.loads((folder/'rig.json').read_text('utf-8'))
model=json.loads((folder/'motion.json').read_text('utf-8'))
images={name:Image.open(folder/'Parts'/(name+'.png')).convert('RGBA') for name in ['shell','head-blob','front-mantle','posterior','tube-near','tube-far','eye-near','eye-far']}
front_vertices,front_triangles=lattice(images['front-mantle'],rig['mantleGridStep'])
parameters=np.linspace(-.8,3.8,700)
curve=[tail_mesh.section(np.array(model['sourceAnterior'],float),value) for value in parameters]
positions=np.array([value[0] for value in curve])
tangents=np.array([value[1]/max(.0001,np.linalg.norm(value[1])) for value in curve])
normals=np.column_stack([-tangents[:,1],tangents[:,0]])
distance=np.sum((front_vertices[:,None,:]-positions[None,:,:])**2,2)
nearest=np.argmin(distance,1)
offset=front_vertices-positions[nearest]
front_weights=np.column_stack([parameters[nearest],np.sum(offset*normals[nearest],1),np.sum(offset*tangents[nearest],1)])
rear_vertices,rear_triangles,rear_weights=tail_mesh.ribbon(model['sourcePosterior'],[22,18,8],0,2)
tubes={}
for name,bind in model['sourceStalks'].items():
    tubes[name]=tail_mesh.ribbon(bind,[6,7,8],0,2)

def rotation(angle):
    c,s=math.cos(angle),math.sin(angle)
    return np.array([[c,-s],[s,c]])

def front_deform(points,weights):
    points=np.array(points,float)
    moved=[]
    for parameter,normal_offset,tangent_offset in weights:
        position,tangent=tail_mesh.section(points,parameter)
        tangent=tangent/max(.0001,np.linalg.norm(tangent))
        normal=np.array([-tangent[1],tangent[0]])
        point=position+normal*normal_offset+tangent*tangent_offset
        point[1]=min(point[1],448)
        moved.append(point)
    return np.array(moved)

frames=[]
entries=list(model['frames'])+[dict(model['frames'][-1],**{'timeMs':model['frames'][-1]['timeMs']+40})]
for entry in entries:
    shell=rigid(images['shell'],[0,0],[0,entry['shellY']],0)
    head=rigid(images['head-blob'],model['sourceHeadPosition'],entry['headPosition'],entry['headAngle'])
    moved=front_deform(entry['anterior'],front_weights)
    rigid_points=(front_vertices-np.array(model['sourceHeadPosition']))@rotation(entry['headAngle']).T+np.array(entry['headPosition'])
    weight=np.clip((220-front_vertices[:,0])/20,0,1)
    moved=moved*(1-weight[:,None])+rigid_points*weight[:,None]
    front=warp(images['front-mantle'],front_vertices,moved,front_triangles)
    rear=warp(images['posterior'],rear_vertices,tail_mesh.deform(entry['posterior'],rear_weights,428),rear_triangles)
    eyes={}
    for name,bind in model['sourceStalks'].items():
        points=np.array(entry['stalks'][name]['joints'],float)
        vertices,triangles,weights=tubes[name]
        tube=warp(images['tube-'+name],vertices,tail_mesh.deform(points,weights,448),triangles)
        source=np.array(bind,float)
        delta=points[-1]-points[-2]
        original=source[-1]-source[-2]
        angle=math.atan2(delta[1],delta[0])-math.atan2(original[1],original[0])
        sphere=rigid(images['eye-'+name],source[-1],points[-1],angle)
        tube.alpha_composite(sphere)
        eyes[name]=tube
    canvas=Image.new('RGBA',(512,512),(0,0,0,0))
    for part in [rear,eyes['far'],eyes['near'],front,head,shell]:
        canvas.alpha_composite(part)
    frames.append(canvas)
    if entry is entries[-1]:
        canvas.save(folder/'final.png')
        a=np.array(canvas)
        b=np.array(shell)
        outside=(b[:,:,3]<32)&(a[:,:,3]>128)
        print(json.dumps({'outsideSoftPixels':int(outside.sum())}))
        exposure=np.zeros((512,512,4),np.uint8)
        exposure[outside]=[255,0,255,255]
        Image.fromarray(exposure).save(folder/'final-soft-exposure.png')
    if entry['timeMs']==0:
        canvas.save(folder/'neutral.png')
durations=[40]*(len(frames)-1)+[1000]
columns=8
atlas=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for name,size in [('preview.webp',512),('thumbnail.webp',64)]:
    resized=[frame.resize((size,size),Image.Resampling.LANCZOS) for frame in frames]
    resized[0].save(folder/name,'WEBP',**{'save_all':True,'append_images':resized[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
contact=Image.new('RGB',(2048,300),'#324340')
indices=[0,6,12,18,24,32,44,len(frames)-1]
for column,index in enumerate(indices):
    frame=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    contact.paste(frame,(column*256,0),frame)
    ImageDraw.Draw(contact).text((column*256+6,270),str(entries[index]['timeMs'])+' ms','white')
contact.save(folder/'contact.png')
(folder/'physics-timeline.json').write_bytes((json.dumps({'durationsMs':durations,'frames':entries},**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'finalIdentical':frames[-1].tobytes()==frames[-2].tobytes()}))
