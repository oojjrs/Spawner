from pathlib import Path
from PIL import Image
import json,math
import numpy as np
from deform import affine
from motion import simulate
from skin import make_skin,render_skin
from surfaces import make_neck,render_surface

folder=Path(__file__).resolve().parent
root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'))
images={path.stem:Image.open(path).convert('RGBA') for path in (folder/'Parts').glob('*.png')}
meshes={name:make_skin(images[name],joints) for name,joints in rig['legs'].items()}
states=simulate(rig,images)
surface=make_neck(images['skin'],images['head-field'])
frames=[];records=[]
for state in states:
    rendered={name:affine(images[name],matrices[2]) if rig.get('limbRendering')=='short-stub' else render_skin(images[name],meshes[name],matrices) for name,matrices in state['legs'].items()}
    frame=Image.new('RGBA',(512,512))
    for name,image in rendered.items(): frame.alpha_composite(image)
    selected='skin-closed' if state['timeMs']>=160 else 'skin'
    frame.alpha_composite(render_surface(images[selected],surface,[state['body'],state['head']]))
    frames.append(frame)
    record={key:value for key,value in state.items() if key not in ['body','head','parts','legs','chains']}
    record['body']=state['body'].tolist();record['head']=state['head'].tolist()
    record['parts']={name:matrix.tolist() for name,matrix in state['parts'].items()}
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
for name,data in [('death.json',metadata),('motion.json',records),('skin-meshes.json',{'limbs':meshes,'continuousFleece':surface})]:
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
