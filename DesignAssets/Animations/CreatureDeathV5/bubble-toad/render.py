from pathlib import Path
from PIL import Image
import json,math
import numpy as np
from deform import affine
from motion import simulate
from skin import make_skin,render_skin
from pouch import make_pouch,simulate_pouch,render_pouch
from surface import make_actor,render_actor
from scene import prepare_scene,render_scene

folder=Path(__file__).resolve().parent;root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'));images={path.stem:Image.open(path).convert('RGBA') for path in (folder/'Parts').glob('*.png')}
meshes={name:make_skin(images[name],joints) for name,joints in rig['legs'].items()}
for name,mesh in meshes.items():
    for index,point in enumerate(mesh['vertices']):
        if name=='hind-near' and point[1]<411: mesh['weights'][index]=[1,0,0]
        if name=='fore-near' and point[1]<387: mesh['weights'][index]=[1,0,0]
        if name=='fore-near' and point[1]>418: mesh['weights'][index]=[0,0,1]
        if name=='hind-near' and point[1]>422: mesh['weights'][index]=[0,0,1]
        if name=='fore-far' and point[1]>402: mesh['weights'][index]=[0,0,1]
        if name=='hind-far' and point[1]<389: mesh['weights'][index]=[1,0,0]
        if name=='hind-far' and point[1]>414: mesh['weights'][index]=[0,0,1]
states=simulate(rig,images);pouch_mesh=make_pouch(images['pouch'],rig);pouch_states=simulate_pouch(pouch_mesh,states,rig);frames=[];records=[]
actor=make_actor(images['skin'],images,rig,pouch_mesh)
scene=prepare_scene(images,actor,meshes,rig)
for state,pouch_state in zip(states,pouch_states):
    selected='skin-closed' if state['timeMs']>=160 else 'skin';frame=render_scene(scene,actor,meshes,state,pouch_state,rig,selected)
    frames.append(frame);records.append({'timeMs':state['timeMs'],'body':state['body'].tolist(),'pouchVertices':pouch_state.tolist(),'landmarks':state['landmarks']})
frames.append(frames[-1].copy());durations=[rig['sampleMs']]*(len(frames)-1)+[rig['finalHoldMs']];columns=6
sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512));(folder/'Frames').mkdir(**{'exist_ok':True})
for index,frame in enumerate(frames): sheet.alpha_composite(frame,(index%columns*512,index//columns*512));frame.save(folder/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
sheet.save(folder/'death.webp','WEBP',**{'lossless':True,'exact':True,'method':4})
for filename,size in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((size,size),Image.Resampling.LANCZOS) for frame in frames];pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'exact':True,'method':4})
relative=folder.relative_to(root).as_posix();meta={'name':folder.name,'action':'death','sourceImage':rig['approvedImage'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','renderer':relative+'/render.py','sourceAuthoring':relative+'/Source/authoring.json','rig':relative+'/rig.json','prepare':relative+'/prepare.py'}
for name,data in [('death.json',meta),('motion.json',records),('pouch-mesh.json',pouch_mesh),('surface-mesh.json',actor),('limb-meshes.json',meshes)]: (folder/name).write_bytes((json.dumps(data,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))
frames[-1].save(folder/'final.png');board=Image.new('RGB',(2048,512),'#263631')
for slot,index in enumerate([0,4,8,12,18,26,40,len(frames)-1]):
    picture=frames[index].resize((256,256),Image.Resampling.LANCZOS);board.paste(picture,(slot*256,0),picture);little=frames[index].resize((64,64),Image.Resampling.LANCZOS);board.paste(little,(slot*256+96,300),little)
board.save(folder/'contact.png');print(json.dumps({'name':folder.name,'frames':len(frames),'pouchVertices':len(pouch_mesh['vertices'])}))
