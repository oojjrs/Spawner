from pathlib import Path
from PIL import Image
import json,math
import numpy as np
from deform import affine
from motion import simulate
from skin import make_skin,render_skin
from surfaces import make_neck,make_tail,render_surface

folder=Path(__file__).resolve().parent
root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'))
images={path.stem:Image.open(path).convert('RGBA') for path in (folder/'Parts').glob('*.png')}
meshes={name:make_skin(images[name],joints) for name,joints in rig['legs'].items()}
soft_meshes={name:make_tail(images[name],description['joints']) for name,description in rig.get('softChains',{}).items()}
neck_mesh=make_neck(images['skin'])
states=simulate(rig,images)

def extra_part(name,image,state):
    if name in state['chains']: return render_surface(image,soft_meshes[name],state['chains'][name])
    return affine(image,state['parts'][name])
frames=[];records=[]
for state in states:
    rendered={name:render_skin(images[name+'-cap'] if name in rig.get('foregroundLimbs',[]) else images[name],meshes[name],matrices) for name,matrices in state['legs'].items()}
    frame=Image.new('RGBA',(512,512))
    for name,transform in state['parts'].items():
        if name not in rig['accessories']: frame.alpha_composite(extra_part(name,images[name+'-cap'] if name in rig.get('foregroundExtraParts',[]) else images[name],state))
    for name,image in rendered.items(): frame.alpha_composite(image)
    selected='skin-closed' if state['timeMs']>=160 else 'skin'
    frame.alpha_composite(render_surface(images[selected],neck_mesh,[state['body'],state['head']]))
    for name in rig.get('foregroundExtraParts',[]): frame.alpha_composite(extra_part(name,images[name+'-visible'],state))
    for name in rig.get('foregroundLimbs',[]): frame.alpha_composite(render_skin(images[name+'-visible'],meshes[name],state['legs'][name]))
    for name in rig['accessories']:
        if 'far' in name: frame.alpha_composite(affine(images[name],state['parts'][name]))
    for name in rig['accessories']:
        if 'far' not in name: frame.alpha_composite(affine(images[name],state['parts'][name]))
    frames.append(frame)
    record={key:value for key,value in state.items() if key not in ['body','head','parts','legs','chains']}
    record['body']=state['body'].tolist();record['head']=state['head'].tolist()
    record['parts']={name:matrix.tolist() for name,matrix in state['parts'].items()}
    record['chains']={name:[matrix.tolist() for matrix in matrices] for name,matrices in state['chains'].items()}
    records.append(record)
frames.append(frames[-1].copy())
durations=[rig['sampleMs']]*(len(frames)-1)+[rig['finalHoldMs']]
columns=6;sheet=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)))
(folder/'Frames').mkdir(**{'exist_ok':True})
for index,frame in enumerate(frames):
    sheet.alpha_composite(frame,(index%columns*512,index//columns*512))
    frame.save(folder/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
sheet.save(folder/'death.webp','WEBP',**{'lossless':True,'exact':True,'method':4})
for filename,size in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((size,size),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/filename,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'exact':True,'method':4})
relative=folder.relative_to(root).as_posix()
metadata={'name':folder.name,'action':'death','sourceImage':rig['approvedImage'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','renderer':relative+'/render.py','sourceAuthoring':relative+'/Source/authoring.json','rig':relative+'/rig.json','prepare':relative+'/prepare.py'}
for name,data in [('death.json',metadata),('motion.json',records),('skin-meshes.json',{'limbs':meshes,'neck':neck_mesh,'tail':soft_meshes})]:
    (folder/name).write_bytes((json.dumps(data,**{'indent': 2})+'\n').replace('\n','\r\n').encode('utf-8'))
frames[-1].save(folder/'final.png')
board=Image.new('RGB',(2048,512),'#263631')
for slot,index in enumerate([0,4,8,12,18,26,40,len(frames)-1]):
    picture=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    board.paste(picture,(slot*256,0),picture)
    picture=frames[index].resize((64,64),Image.Resampling.LANCZOS)
    board.paste(picture,(slot*256+96,300),picture)
board.save(folder/'contact.png')
print(json.dumps({'name':folder.name,'frames':len(frames),'bounds':frames[-1].getbbox(),'endVelocity':records[-1]['velocity']}))
