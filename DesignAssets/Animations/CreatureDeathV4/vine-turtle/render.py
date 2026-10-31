from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json
import math
from mesh_render import lattice,warp,bend_limb,rigid,smooth
from tail_mesh import ribbon,deform
from export import encode,still,write_json

folder=Path(__file__).resolve().parent

def restore_surface(canvas,shell,mask):
    return Image.composite(shell,canvas,mask)

def foreground_mask(shell,foreground):
    base=np.asarray(shell)[:,:,3].astype(float)
    front=np.asarray(foreground)[:,:,3].astype(float)
    return Image.fromarray(np.uint8(np.clip(front/np.maximum(base,1)*255+.5,0,255)))

def head_depth_mask(shell,entry,model,rig):
    definition=rig['headPortal']
    amount=smooth(entry['headRoot'][0],model['sourceHeadRoot'][0],model['sourceHeadRoot'][0]+definition['depthDistance'])
    start=np.asarray(definition['frontWindow'],float)
    end=np.asarray(definition['insideWindow'],float)
    box=start*(1-amount)+end*amount
    box[[1,3]]+=entry['shellY']
    window=Image.new('L',(2048,2048),0)
    ImageDraw.Draw(window).ellipse(tuple(box*4),255)
    window=window.resize((512,512),Image.Resampling.LANCZOS)
    alpha=np.asarray(shell)[:,:,3]
    return Image.fromarray(np.uint8((alpha>0)*(255-np.asarray(window))))

def main():
    model=json.loads((folder/'motion.json').read_text('utf-8'))
    rig=json.loads((folder/'rig.json').read_text('utf-8'))
    names=['shell','foreground','head','head-closed','neck','fore-near','fore-far','hind-near','hind-far','tail']
    images={name:Image.open(folder/'Parts'/(name+'.png')).convert('RGBA') for name in names}
    source_neck=np.asarray(model['sourceNeck'],float)
    head_root=np.asarray(model['sourceHeadRoot'],float)
    neck_vertices,neck_triangles,neck_weights=ribbon(source_neck,[26,26,26],0,2)
    tail_vertices,tail_triangles,tail_weights=ribbon(model['sourceTail'],[10,10,5],0,2)
    meshes={name:lattice(images[name],7) for name in model['sourceLegs']}
    frames=[]
    entries=list(model['frames'])
    terminal=dict(entries[-1])
    terminal['sourceTimeMs']=terminal['timeMs']
    terminal['timeMs']+=40
    terminal['terminalHold']=True
    entries.append(terminal)
    reports=[]
    target=folder/'Frames'
    if not target.exists():target.mkdir()
    for index,entry in enumerate(entries):
        offset=[0,entry['shellY']]
        shell=rigid(images['shell'],[0,0],offset,0)
        foreground=rigid(images['foreground'],[0,0],offset,0)
        head_image=images['head-closed'] if entry['timeMs']>=rig['eyeCloseMs'] else images['head']
        head=rigid(head_image,head_root,entry['headRoot'],entry['headAngle'])
        neck_frame=warp(images['neck'],neck_vertices,deform(entry['neck'],neck_weights,448),neck_triangles)
        tail_frame=warp(images['tail'],tail_vertices,deform(entry['tail'],tail_weights,448),tail_triangles)
        limbs={}
        for name,bind in model['sourceLegs'].items():
            vertices,triangles=meshes[name]
            source=np.vstack([np.asarray(bind,float),np.asarray(model['sourceToes'][name],float)])
            state=entry['legs'][name]
            moved=bend_limb(vertices,source,np.asarray(state['joints'],float),state['pawAngle'])
            limbs[name]=warp(images[name],vertices,moved,triangles)
        canvas=Image.new('RGBA',(512,512),(0,0,0,0))
        for part in [limbs['hind-far'],limbs['fore-far'],tail_frame,neck_frame,shell,head]:canvas.alpha_composite(part)
        canvas=restore_surface(canvas,shell,head_depth_mask(shell,entry,model,rig))
        for part in [limbs['hind-near'],limbs['fore-near']]:canvas.alpha_composite(part)
        canvas=restore_surface(canvas,shell,foreground_mask(shell,foreground))
        frames.append(canvas)
        canvas.save(target/('frame-'+str(index).zfill(3)+'.png'))
        entry['alphaBounds']=canvas.getchannel('A').getbbox()
        if index==len(entries)-1:
            shell_array=np.asarray(shell)
            final=np.asarray(canvas)
            changed=np.any(final!=shell_array,2)&((final[:,:,3]>32)|(shell_array[:,:,3]>32))
            reports.append({'timeMs':entry['timeMs'],'shellDifferencePixels':int(changed.sum()),'shellY':entry['shellY']})
            difference=np.zeros((512,512,4),np.uint8)
            difference[changed]=[255,0,255,255]
            Image.fromarray(difference).save(folder/'final-soft-exposure.png')
    durations=[40]*(len(frames)-1)+[1000]
    atlas=Image.new('RGBA',(2048,math.ceil(len(frames)/4)*512),(0,0,0,0))
    for index,frame in enumerate(frames):atlas.alpha_composite(frame,(index%4*512,index//4*512))
    still(folder/'death.webp',atlas)
    encode(folder/'preview.webp',frames,durations)
    encode(folder/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
    frames[0].save(folder/'neutral-reassembled.png')
    frames[-1].save(folder/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,6,12,18,24,30,40,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(entries[index]['timeMs'])+' ms',(240,240,230))
    contact.save(folder/'contact.png')
    write_json(folder/'physics-timeline.json',{'durationsMs':durations,'frames':entries})
    write_json(folder/'landmarks.json',entries)
    write_json(folder/'exposure-report.json',reports)
    for name,(vertices,triangles) in meshes.items():write_json(folder/(name+'-mesh.json'),{'vertices':vertices.tolist(),'triangles':triangles.tolist(),'sourceJoints':model['sourceLegs'][name],'sourceToe':model['sourceToes'][name],'deformation':'joint-centered rotations with complete rigid paw after ankle'})
    for name,vertices,triangles,weights in [('neck',neck_vertices,neck_triangles,neck_weights),('tail',tail_vertices,tail_triangles,tail_weights)]:write_json(folder/(name+'-mesh.json'),{'vertices':vertices.tolist(),'triangles':triangles.tolist(),'curveCoordinates':weights.tolist()})
    prefix='DesignAssets/Animations/CreatureDeathV4/vine-turtle/'
    write_json(folder/'death.json',{'name':'vine-turtle','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/vine-turtle.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print('vine-turtle',len(frames),sum(durations),reports)

if __name__=='__main__':
    main()
