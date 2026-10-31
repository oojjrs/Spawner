import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from engine import affine,encode,leg_matrices,make_mesh,rasterize,scalar,write_json
from flexible import skin
from physics import simulate,at_time
HERE=Path(__file__).resolve().parent
def main():
    config=json.loads((HERE/'rig.json').read_text('utf-8'))['configuration']
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    visible={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Source/VisibleParts').glob('*.png')}
    hidden={}
    for name,image in images.items():
        pixels=np.array(image)
        if name in visible:pixels[np.asarray(visible[name])[:,:,3]>0,3]=0
        hidden[name]=Image.fromarray(pixels)
    trace=simulate(images,config,motion['physics'],motion['channels'])
    write_json(HERE/'physics-trace.json',trace)
    meshes={}
    for name,points in config['legs'].items():
        if name=='hindleg':continue
        anchors=[points[0],points[1],[points[2][0],points[2][1]-12]]
        data=make_mesh(images[name],anchors,'leg')
        data['blendPivots']=[points[1] if v[1]<anchors[2][1]-8 else points[2] for v in data['vertices']]
        hard=np.asarray(Image.open(HERE/config['rigidClawMasks'][name]).convert('L'))
        for i,vertex in enumerate(data['vertices']):
            x,y=np.clip(np.rint(vertex).astype(int),0,511)
            if hard[y,x]>0 or vertex[1]>=config['palmRigidSourceY'][name]:
                data['weights'][i]=[0,0,1]
                data['blendPivots'][i]=points[2]
        meshes[name]=data
    neck_mesh=make_mesh(images['neck-surface'],[], 'neck')
    neck_vertices=np.asarray(neck_mesh['vertices'],float)
    weight=np.clip((neck_vertices[:,0]-205)/90,0,1)
    weight=weight*weight*(3-2*weight)
    neck_mesh['weights']=np.c_[weight,1-weight].tolist()
    frames=[]
    records=[]
    for index,time in enumerate(motion['timesMs']):
        body,head=at_time(time,trace)
        frame=Image.new('RGBA',(512,512))
        homogeneous=np.c_[neck_vertices,np.ones(len(neck_vertices))]
        neck_positions=weight[:,None]*(body@homogeneous.T).T[:,:2]+(1-weight[:,None])*(head@homogeneous.T).T[:,:2]
        neck_layer,_=rasterize(images['neck-surface'],neck_mesh,neck_positions)
        frame.alpha_composite(neck_layer)
        layers={}
        limbs={}
        rear_layers={}
        head_name='head-closed' if time>=motion['eyeCloseMs'] else 'head'

        for name,points in config['legs'].items():
            target=[scalar(time,motion['channels'][name+'-target'+axis]) for axis in ['X','Y']]
            bones,landmarks=leg_matrices(points,body,1,target)
            limbs[name]=landmarks
            if name in meshes:
                data=meshes[name]
                vertices=skin(data['vertices'],np.asarray(data['weights']),np.asarray(data['blendPivots']),bones)
                layers[name],_=rasterize(visible[name],data,vertices)
                layer,_=rasterize(hidden[name],data,vertices)
                rear_layers[name]=layer
            else:layers[name]=affine(visible[name],bones[2])
        layers['tail']=affine(images['tail'],body)
        layers['body']=affine(images['body'],body)
        for layer in rear_layers.values():frame.alpha_composite(layer)
        jaw=np.array(hidden[head_name])
        jaw[:300]=0
        hidden_head=np.array(hidden[head_name])
        hidden_head[300:]=0
        for name,transform in [('body',body),('tail',body)]:frame.alpha_composite(affine(hidden[name],transform))
        frame.alpha_composite(affine(Image.fromarray(hidden_head),head))
        layers['body']=affine(visible['body'],body)
        layers['head']=affine(visible[head_name],head)
        for name in ['tail','body','hindleg']:frame.alpha_composite(layers[name])
        frame.alpha_composite(affine(Image.fromarray(jaw),head))
        for name in ['foreleg-far','head','foreleg']:frame.alpha_composite(layers[name])
        frame.save(HERE/'Frames'/str('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'body':body.tolist(),'head':head.tolist(),'legs':limbs})
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/str('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    durations=motion['durationsMs']+[1000]
    records.append(dict(records[-1]))
    records[-1]['sourceTimeMs']=records[-1]['timeMs']
    records[-1]['timeMs']+=40
    records[-1]['terminalHold']=True
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)))
    for index,frame in enumerate(frames):sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,durations)
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],durations)
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,8,14,20,26,32,42,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(index*40)+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    reference=Image.open(HERE/'reference.png').convert('RGBA')
    comparison=Image.new('RGB',(2048,512),(35,42,37))
    for cell,image in enumerate([reference,frames[0],frames[23],frames[-1]]):comparison.paste(image,(cell*512,0),image)
    comparison.save(HERE/'design-comparison.png')
    neutral=Image.new('RGB',(1536,512),(35,42,37))
    for cell,image in enumerate([reference,frames[0],Image.blend(reference,frames[0],.5)]):neutral.paste(image,(cell*512,0),image)
    neutral.save(HERE/'neutral-comparison.png')
    write_json(HERE/'landmarks.json',records)
    write_json(HERE/'neck-surface-mesh.json',neck_mesh)
    for name,data in meshes.items():write_json(HERE/str(name+'-mesh.json'),data)
    prefix='DesignAssets/Animations/CreatureDeathV5/'+HERE.name+'/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/'+HERE.name+'.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print(HERE.name,len(frames),sum(durations))
if __name__=='__main__':main()
