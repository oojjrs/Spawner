from pathlib import Path
from PIL import Image,ImageDraw
import json,math
import numpy as np
from deform import affine
from motion import simulate
from ribbon import make_ribbon,render_ribbon,configure_surface


folder=Path(__file__).resolve().parent
root=folder.parents[3]
rig=json.loads((folder/'rig.json').read_text('utf-8'))
images={file.stem:Image.open(file).convert('RGBA') for file in (folder/'Parts').glob('*.png')}
scale=rig.get('viewScale',1.0)
view=np.array([[scale,0,256*(1-scale)],[0,scale,448*(1-scale)],[0,0,1]],float)
configure_surface(448+(rig['groundY']-448)*scale,rig.get('groundSlope',0),256+(rig.get('groundX',0)-256)*scale)

def draw_part(image,transform):
    return affine(image,view@transform)

meshes={}
soft_meshes={name:make_ribbon(images[name],description['joints']) for name,description in rig.get('softChains',{}).items()}
states=simulate(rig,images)
frames=[]
records=[]
for state in states:
    layers={}
    for name,matrices in state['legs'].items():
        layers[name]=[draw_part(images[part],transform) for part,transform in zip(rig['jointParts'][name],matrices)]
    frame=Image.new('RGBA',(512,512),(0,0,0,0))
    soft_layers={name:render_ribbon(images[name],soft_meshes[name],[view@matrix for matrix in matrices])[0] for name,matrices in state['chains'].items()}
    for name,transform in state['parts'].items():
        if name in rig['extraParts'] and name!='wing-near' and name not in rig.get('frontParts',[]): frame.alpha_composite(soft_layers[name] if name in soft_layers else draw_part(images[name],transform))
    for name,parts in layers.items():
        frame.alpha_composite(parts[0])
        if 'far' in name:
            frame.alpha_composite(parts[1]);frame.alpha_composite(parts[2])
    frame.alpha_composite(draw_part(images['body'],state['body']))
    for name in rig.get('frontParts',[]): frame.alpha_composite(soft_layers[name] if name in soft_layers else draw_part(images[name],state['parts'][name]))
    for name,parts in layers.items():
        if 'far' not in name:
            frame.alpha_composite(parts[1]);frame.alpha_composite(parts[2])
    if 'wing-near' in state['parts']: frame.alpha_composite(draw_part(images['wing-near'],state['parts']['wing-near']))
    for name in rig['accessories']:
        if 'far' in name: frame.alpha_composite(soft_layers[name] if name in soft_layers else draw_part(images[name],state['parts'][name]))
    selected=rig.get('closedHead','head-alternate') if state['timeMs']>=140 else rig.get('openHead','head')
    frame.alpha_composite(draw_part(images[selected],state['head']))
    for name in rig['accessories']:
        if 'far' not in name: frame.alpha_composite(soft_layers[name] if name in soft_layers else draw_part(images[name],state['parts'][name]))
    frames.append(frame)
    record={key:value for key,value in state.items() if key not in ['body','head','parts','legs','chains']}
    record['body']=state['body'].tolist();record['head']=state['head'].tolist()
    record['parts']={key:value.tolist() for key,value in state['parts'].items()}
    record['chains']={key:[matrix.tolist() for matrix in value] for key,value in state['chains'].items()}
    records.append(record)
frames.append(frames[-1].copy())
durations=[rig['sampleMs']]*(len(frames)-1)+[rig['finalHoldMs']]
columns=6
atlas=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%columns*512,index//columns*512))
    frame.save(folder/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
atlas.save(folder/'death.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
for file,size in [('preview.webp',512),('thumbnail.webp',64)]:
    pictures=[frame.resize((size,size),Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder/file,'WEBP',**{'save_all':True,'append_images':pictures[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'exact':True})
relative=folder.relative_to(root).as_posix()
meta={'name':folder.name,'action':'death','sourceImage':rig['approvedImage'],'image':relative+'/death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':relative+'/preview.webp','thumbnail':relative+'/thumbnail.webp','rig':relative+'/rig.json','renderer':relative+'/render.py','sourceAuthoring':relative+'/Source/authoring.json','prepare':relative+'/prepare.py','viewTransform':view.tolist(),'method':'Continuous rigid body support failure and contact response, neck and appendage angular inertia, independently grounded articulated legs. Complete upper/lower/foot source parts with fixed-scale joint transforms. No full-body cel fitting.'}
for name,value in [('death.json',meta),('motion.json',records)]:
    (folder/name).write_bytes((json.dumps(value,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
for name,mesh in {**meshes,**soft_meshes}.items():
    (folder/(name+'-mesh.json')).write_bytes((json.dumps(mesh,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
board=Image.new('RGB',(2048,560),'#263631')
for i,index in enumerate([0,5,8,11,15,20,28,len(frames)-1]):
    image=frames[index].resize((256,256),Image.Resampling.LANCZOS)
    x=i%8*256;y=0
    board.paste(image,(x,y),image)
    ImageDraw.Draw(board).text((x+8,260),str(index*rig['sampleMs'])+' ms','white')
    little=frames[index].resize((64,64),Image.Resampling.LANCZOS)
    board.paste(little,(x+96,300),little)
board.crop((0,0,2048,380)).save(folder/'contact.png')
frames[-1].save(folder/'final.png')
print(json.dumps({'name':folder.name,'frames':len(frames),'endVelocity':records[-1]['velocity'],'finalBounds':frames[-1].getchannel('A').getbbox()}))
