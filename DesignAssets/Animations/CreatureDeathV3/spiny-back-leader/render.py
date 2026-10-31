import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,_webp
from deform import affine,mesh_render,rotation,translation

HERE=Path(__file__).resolve().parent

def write_json(path,value):
    encoder=json.JSONEncoder()
    encoder.indent=2
    path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def scalar(time,keys):
    for left,right in zip(keys,keys[1:]):
        if time<=right[0]:
            u=max(0,min(1,(time-left[0])/(right[0]-left[0])))
            u=u*u*(3-2*u)
            return left[1]+(right[1]-left[1])*u
    return keys[-1][1]

def scene(images,meshes,values,closed,drop):
    body=translation(0,drop*values['fall'])@rotation([260,350],values['pitch'])
    frame=Image.new('RGBA',(512,512),(0,0,0,0))
    limbs={}
    records={}
    for name,mesh in meshes.items():
        points=mesh['joints']
        upper=body@rotation(points[0],values[name+'-upper'])
        lower=upper@rotation(points[1],values[name+'-lower'])
        claw=lower@rotation(points[2],values[name+'-claw'])
        limbs[name],vertices=mesh_render(images[name],mesh,[upper,lower,claw])
        hip=(upper@np.array(points[0]+[1]))[:2]
        knee=(upper@np.array(points[1]+[1]))[:2]
        ankle=(lower@np.array(points[2]+[1]))[:2]
        records[name]={'hip':hip.tolist(),'knee':knee.tolist(),'ankle':ankle.tolist(),'upperLength':float(np.linalg.norm(knee-hip)),'lowerLength':float(np.linalg.norm(ankle-knee))}
    frame.alpha_composite(limbs['far-leg'])
    core='core-closed' if closed else 'core-open'
    frame.alpha_composite(affine(images[core],body))
    for name in ['rear-leg','middle-leg','front-leg']:
        frame.alpha_composite(limbs[name])
    far=body@rotation([117,310],values['jawFar'])
    near=body@rotation([191,317],values['jawNear'])
    frame.alpha_composite(affine(images['jaw-far'],far))
    frame.alpha_composite(affine(images['jaw-near'],near))
    frame.alpha_composite(affine(images[core+'-cap'],body))
    return frame,{'bodyMatrix':body.tolist(),'jawFarMatrix':far.tolist(),'jawNearMatrix':near.tolist(),'joints':records}

def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    meshes=json.loads((HERE/'meshes.json').read_text('utf-8'))
    names=list(meshes)+['jaw-far','jaw-near','core-open','core-closed','core-open-cap','core-closed-cap']
    images={name:Image.open(HERE/'Parts'/(name+'.png')).convert('RGBA') for name in names}
    values={name:scalar(1280,keys) for name,keys in motion['channels'].items()}
    final,_=scene(images,meshes,values,True,0)
    drop=rig['rootGroundY']+1-final.getchannel('A').getbbox()[3]
    frames=[]
    landmarks=[]
    (HERE/'Frames').mkdir(511,True,True)
    for index,time in enumerate(motion['frameTimesMs']):
        values={name:scalar(time,keys) for name,keys in motion['channels'].items()}
        frame,record=scene(images,meshes,values,time>=motion['eyeCloseMs'],drop)
        frame.save(HERE/'Frames'/('death-'+str(index).zfill(3)+'.png'))
        record['timeMs']=time
        record['alphaBounds']=frame.getchannel('A').getbbox()
        landmarks.append(record)
        frames.append(frame)
    frames[-1].save(HERE/'final.png')
    columns=rig['columns']
    sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,((index%columns)*512,(index//columns)*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    durations=motion['durationsMs']
    encode(HERE/'preview.webp',frames,durations)
    encode(HERE/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
    root='DesignAssets/Animations/CreatureDeathV3/spiny-back-leader/'
    write_json(HERE/'death.json',{'name':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/spiny-back-leader.png','image':root+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'loop':False,'preview':root+'preview.webp','thumbnail':root+'thumbnail.webp','sourceRig':root+'rig.json','sourceRenderer':root+'render.py','method':rig['method']})
    write_json(HERE/'landmarks.json',{'groundY':rig['rootGroundY'],'rootLandingDrop':drop,'frames':landmarks})
    contact=Image.new('RGB',(2048,380),(27,33,39))
    draw=ImageDraw.Draw(contact)
    for col,index in enumerate([0,6,10,14,18,22,26,32]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        contact.paste(tile,(col*256,0),tile)
        draw.text((col*256+8,260),str(motion['frameTimesMs'][index])+' ms',(245,245,245))
        small=frames[index].resize((64,64),Image.Resampling.LANCZOS)
        contact.paste(small,(col*256+96,296),small)
    contact.save(HERE/'contact.png')
    original=Image.open(HERE/'Source/reference.png').convert('RGBA')
    overlay=Image.new('RGB',(512,512),(24,30,37))
    cyan=Image.new('RGBA',(512,512),(0,230,230,0))
    cyan.putalpha(original.getchannel('A').point(lambda value:value//2))
    magenta=Image.new('RGBA',(512,512),(240,0,220,0))
    magenta.putalpha(frames[0].getchannel('A').point(lambda value:value//2))
    overlay.paste(cyan,(0,0),cyan)
    overlay.paste(magenta,(0,0),magenta)
    overlay.save(HERE/'source-overlay.png')
    hashes={name:hashlib.sha256(np.asarray(images[name]).tobytes()).hexdigest() for name in ['jaw-far','jaw-near','core-open','core-closed']}
    lengths=[]
    for record in landmarks:
        for name,entry in record['joints'].items():
            bind=np.asarray(meshes[name]['joints'],float)
            lengths.extend([abs(entry['upperLength']-np.linalg.norm(bind[1]-bind[0])),abs(entry['lowerLength']-np.linalg.norm(bind[2]-bind[1]))])
    write_json(HERE/'source-stability.json',{'sourceHashes':hashes,'rigidBodyScale':1,'maximumJointLengthErrorPx':float(max(lengths)),'finalHoldIdentical':frames[-1].tobytes()==frames[-2].tobytes(),'noOpaqueCanvasClipping':all(record['alphaBounds'][0]>0 and record['alphaBounds'][1]>0 and record['alphaBounds'][2]<512 and record['alphaBounds'][3]<512 for record in landmarks),'previewNativeSize':[512,512],'thumbnailNativeSize':[64,64],'nativePreviewLoop':0,'timelineLoop':False,'rootGroundY':447,'landingDropPx':drop})
    print('spiny-back-leader exported',len(frames),sum(durations),drop)

if __name__=='__main__':
    main()
