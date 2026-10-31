from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import math
import json
from mesh_render import *
import tail_mesh

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
samples=json.loads((folder/'physics-samples.json').read_text('utf-8'))
tail_model=json.loads((folder/'tail-physics.json').read_text('utf-8'))
images={name:Image.open(folder/path).convert('RGBA') for name,path in [('body',rig['body']['image']),('head','Parts/head-skull.png'),('closed','Parts/head-closed-skull.png'),('ruff','Parts/neck-ruff.png'),('tail','Parts/tail.png')]+[(limb['id'],limb['image']) for limb in rig['limbs']]}
meshes={name:lattice(image,8) for name,image in images.items() if name not in ['body','head','closed']}
source_tail=np.array(tail_model['bind'],float)
tail_base=Image.open(folder/'Parts/tail-connector.png').convert('RGBA')
tail_tip=Image.open(folder/'Parts/tail-curl.png').convert('RGBA')
base_vertices,base_triangles,base_weights=tail_mesh.ribbon(source_tail,tail_model['radii'],0,2)
tip_vertices,tip_triangles,tip_weights=tail_mesh.ribbon(source_tail,tail_model['radii'],2,len(source_tail)-1)
limb_mesh=next(limb for limb in rig['limbs'] if limb['id']=='hind-near')
yy,xx=np.mgrid[:512,:512]
paw_arc,paw_lengths=arc_data(np.column_stack([xx.ravel(),yy.ravel()]),limb_mesh['bind'])
paw=np.array(images['hind-near'])
paw[paw_arc.reshape(512,512)<sum(paw_lengths[:2])-1]=0
paw=Image.fromarray(paw)
capmask=Image.new('L',(512,512),0)
for limb in rig['limbs']:
    if 'near' in limb['id']:
        x,y=limb['bind'][0]
        ImageDraw.Draw(capmask).ellipse((x-28,y-28,x+28,y+12),255)
cap=np.array(images['body'])
cap[:,:,3]=(cap[:,:,3].astype(float)*np.array(capmask)/255).round().astype(np.uint8)
cap[cap[:,:,3]==0]=0
cap=Image.fromarray(cap)

def transform_point(matrix,points):
    return np.column_stack([points,np.ones(len(points))])@matrix[:2].T

def transformed(image,matrix):
    return rigid(image,[0,0],matrix[:2,2],math.atan2(matrix[1,0],matrix[0,0]))

frames=[]
records=[]
entries=[]
for entry in tail_model['frames']:
    body_entry=samples[min(len(samples)-1,round(entry['timeMs']/40))]
    entries.append(dict(body_entry,**{'timeMs':entry['timeMs']}))
entries.append(dict(entries[-1],**{'timeMs':entries[-1]['timeMs']+40}))
for entry in entries:
    time=entry['timeMs']
    body=np.array(entry['body'],float)
    head=np.array(entry['head'],float)
    body_angle=math.atan2(body[1,0],body[0,0])
    head_angle=math.atan2(head[1,0],head[0,0])
    legs={}
    near_hind_paw=None
    for limb in rig['limbs']:
        name=limb['id']
        state=entry['landmarks'][name]
        joints=np.array([state['hip'],state['knee'],state['ankle']])
        vertices,triangles=meshes[name]
        moved=bend_limb(vertices,limb['bind'],joints,0)
        legs[name]=warp(images[name],vertices,moved,triangles)
        if name=='hind-near':
            near_hind_paw=warp(paw,vertices,moved,triangles)
    tail_points=np.array(tail_model['frames'][min(len(tail_model['frames'])-1,round(time/40))]['joints'])
    moved=tail_mesh.deform(tail_points,base_weights,448)
    base_frame=warp(tail_base,base_vertices,moved,base_triangles)
    moved=tail_mesh.deform(tail_points,tip_weights,448)
    tip_frame=warp(tail_tip,tip_vertices,moved,tip_triangles)
    neck=np.array(rig['body']['neckSocket'],float)
    neck_world=transform_point(body,np.array([neck]))[0]
    vertices,triangles=meshes['ruff']
    weight=np.clip((170-vertices[:,0])/30,0,1)*np.clip((390-vertices[:,1])/40,0,1)
    angles=body_angle+shortest(head_angle-body_angle)*weight
    delta=vertices-neck
    c,s=np.cos(angles),np.sin(angles)
    moved=neck_world+np.column_stack([c*delta[:,0]-s*delta[:,1],s*delta[:,0]+c*delta[:,1]])
    lower=moved[:,1]>438
    moved[lower,1]=438+10*np.tanh((moved[lower,1]-438)/10)
    ruff_frame=warp(images['ruff'],vertices,moved,triangles)
    image=Image.new('RGBA',(512,512),(0,0,0,0))
    layers=[base_frame,legs['hind-far'],legs['fore-far'],transformed(images['body'],body),legs['hind-near'],legs['fore-near'],transformed(cap,body),ruff_frame,tip_frame,near_hind_paw,transformed(images['closed'] if time>=440 else images['head'],head)]
    for part in layers:
        image.alpha_composite(part)
    frames.append(image)
    records.append({'timeMs':time,'body':entry['body'],'head':entry['head'],'limbs':entry['landmarks'],'tailJoints':tail_points.tolist(),'bodyContact':entry['bodyContact'],'headContact':entry['headContact']})
    if time==0:
        image.save(folder/'neutral-physics.png')
durations=[40]*(len(frames)-1)+[1000]
columns=8
atlas=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
for index,image in enumerate(frames):
    atlas.alpha_composite(image,(index%columns*512,index//columns*512))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for filename,size in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[image.resize((size,size),Image.Resampling.LANCZOS) for image in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
contact=Image.new('RGB',(2048,300),'#324340')
indices=[0,5,10,15,20,25,32,len(frames)-1]
for column,index in enumerate(indices):
    image=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    contact.paste(image,(column*256,0),image)
    ImageDraw.Draw(contact).text((column*256+6,270),str(entries[index]['timeMs'])+' ms','white')
contact.save(folder/'contact.png')
(folder/'physics-timeline.json').write_bytes((json.dumps({'frames':records,'durationsMs':durations},**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'finalIdentical':frames[-1].tobytes()==frames[-2].tobytes(),'folder':str(folder)}))
