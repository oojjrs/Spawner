import json
import math
from pathlib import Path
from PIL import Image,ImageDraw,_webp
from engine import affine,encode,make_mesh,mesh_render,write_json
from physics import simulate,at_time
from appendage import solve

HERE=Path(__file__).resolve().parent

def main():
    motion=json.loads((HERE/'motion.json').read_text('utf-8'))
    images={p.stem:Image.open(p).convert('RGBA') for p in (HERE/'Parts').glob('*.png')}
    trace=simulate(images['body'],motion['physics'])
    write_json(HERE/'physics-trace.json',trace)
    def parent(time):
        return at_time(time,trace,motion['physics']['center'])
    mesh=make_mesh(images['leaf'],motion['leafJoints'],'ear')
    leaf=solve(motion['timesMs'],motion['leafJoints'],parent,images['leaf'],motion['leaf'])
    frames=[]
    records=[]
    for index,time in enumerate(motion['timesMs']):
        body=parent(time)
        frame=affine(images['body-closed'] if time>=motion['eyeCloseMs'] else images['body'],body)
        moving,_=mesh_render(images['leaf'],mesh,leaf[time]['matrices'])
        frame.alpha_composite(moving)
        frame.save(HERE/'Frames'/('frame-'+str(index).zfill(3)+'.png'))
        frames.append(frame)
        records.append({'timeMs':time,'body':body.tolist(),'leaf':{'matrices':[m.tolist() for m in leaf[time]['matrices']],'particles':leaf[time]['particles'].tolist(),'materialBottom':leaf[time]['materialBottom'],'floorContact':leaf[time]['floorContact']},'alphaBounds':frame.getchannel('A').getbbox()})
    motion['durationsMs'][-1]=40
    motion['durationsMs'].append(1000)
    motion['timesMs'].append(motion['timesMs'][-1]+40)
    frames.append(frames[-1].copy())
    frames[-1].save(HERE/'Frames'/('frame-'+str(len(frames)-1).zfill(3)+'.png'))
    terminal=json.loads(json.dumps(records[-1]))
    terminal['sourceTimeMs']=terminal['timeMs']
    terminal['timeMs']=motion['timesMs'][-1]
    terminal['terminalHold']=True
    records.append(terminal)
    sheet=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%4*512,index//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,motion['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],motion['durationsMs'])
    frames[0].save(HERE/'neutral-reassembled.png')
    frames[-1].save(HERE/'final.png')
    contact=Image.new('RGB',(1024,560),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,10,20,30,40,50,65,len(frames)-1]):
        tile=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(tile,(x,y),tile)
        draw.text((x+4,y+256),str(motion['timesMs'][index])+' ms',(240,240,230))
    contact.save(HERE/'contact.png')
    write_json(HERE/'landmarks.json',records)
    write_json(HERE/'leaf-mesh.json',mesh)
    write_json(HERE/'rig.json',{'name':'rolling-acorn','method':'Rigid seed support and gravity with contact impulses and rolling friction; independently anchored flexible leaf with particle and material floor constraints','parts':['body','body-closed','leaf'],'leafRoot':motion['leafJoints'][0],'controls':'motion.json','timeline':'landmarks.json','renderer':'render.py','spineCompatibilityVerified':False})
    prefix='DesignAssets/Animations/CreatureDeathV4/rolling-acorn/'
    write_json(HERE/'death.json',{'name':HERE.name,'action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/rolling-acorn.png','image':prefix+'death.webp','frameSize':512,'columns':4,'pivotX':256,'pivotY':448,'frameCount':len(frames),'durationsMs':motion['durationsMs'],'durationMs':sum(motion['durationsMs']),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp'})
    print('acorn V4 exported',len(frames))

if __name__=='__main__':
    main()
