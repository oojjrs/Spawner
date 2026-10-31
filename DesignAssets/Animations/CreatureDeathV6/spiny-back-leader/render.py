from pathlib import Path
import json
import math
import numpy as np
from PIL import Image,ImageDraw
from sampling import affine
from physics import simulate,matrices_at

root=Path(__file__).resolve().parent
rig=json.loads((root/'rig.json').read_text('utf-8'))
images={path.stem:Image.open(path).convert('RGBA') for path in (root/'Parts').glob('*.png')}
motion=simulate(images,rig)

def frame(time):
    matrices=matrices_at(motion,time)
    canvas=Image.new('RGBA',(512,512))
    def draw(name,matrix):
        canvas.alpha_composite(affine(images[name],matrix,(512,512)))
    def leg_draw(leg):
        for part in leg['parts']:draw(part+'-hidden',matrices[part])
        for part in reversed(leg['parts']):draw(part+'-visible',matrices[part])
    far=[item[2] for item in sorted([(leg['joints'][2][1],i,leg) for i,leg in enumerate(rig['legs']) if 'far' in leg['id']])]
    near=[item[2] for item in sorted([(leg['joints'][2][1],i,leg) for i,leg in enumerate(rig['legs']) if 'near' in leg['id']])]
    for leg in far:leg_draw(leg)
    draw('body-base',matrices['body'])
    for leg in near:leg_draw(leg)
    for jaw in rig['jaws']:
        name=jaw['id']
        draw(name+'-hidden',matrices[name])
        draw(name+'-visible',matrices[name])
    draw('body-visible-closed' if time>=120 else 'body-visible',matrices['body'])
    return canvas

def small(image):
    a=np.array(image).astype(float)/255
    a[:,:,:3]*=a[:,:,3:4]
    a=a.reshape(64,8,64,8,4).mean((1,3))
    a[:,:,:3]/=np.maximum(a[:,:,3:4],1e-12)
    return Image.fromarray(np.uint8(np.clip(a*255+.5,0,255)))

times=list(range(0,rig['durationActiveMs'],rig['sampleMs']))+[rig['durationActiveMs']]
frames=[frame(time) for time in times]
durations=[times[i+1]-time for i,time in enumerate(times[:-1])]+[rig['finalHoldMs']]
(root/'Frames').mkdir(0o777,True,True)
for i,image in enumerate(frames):image.save(root/'Frames'/('frame-'+str(i).zfill(3)+'.png'))
columns=4
sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
for i,image in enumerate(frames):sheet.alpha_composite(image,((i%columns)*512,(i//columns)*512))
sheet.save(root/'death.webp',**{'lossless':True,'exact':True,'method':6})
frames[0].save(root/'preview.webp',**{'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'exact':True,'method':6})
thumbs=[small(image) for image in frames]
thumbs[0].save(root/'thumbnail.webp',**{'save_all':True,'append_images':thumbs[1:],'duration':durations,'loop':0,'lossless':True,'exact':True,'method':6})
frames[-1].save(root/'final.png')
contact=Image.new('RGBA',(2048,1024),(38,53,49,255))
for i,time in enumerate([0,80,160,240,360,520,720,900]):
    contact.alpha_composite(frame(time),((i%4)*512,(i//4)*512))
    ImageDraw.Draw(contact).text(((i%4)*512+12,(i//4)*512+12),str(time)+'ms',(255,255,255,255))
contact.convert('RGB').save(root/'contact.png')
prefix='DesignAssets/Animations/CreatureDeathV6/spiny-back-leader/'
metadata={'sourceImage':'DesignAssets/CreatureConcepts/v3/spiny-back-leader.png','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'sourceCanvasPlacement':rig['sourceRegistration'],'rig':prefix+'rig.json','renderer':prefix+'render.py','prepare':prefix+'prepare.py','sourceAuthoring':prefix+'Source/authoring.json'}
(root/'death.json').write_bytes(json.dumps(metadata,**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
(root/'motion.json').write_bytes(json.dumps({'names':motion['names'],'centers':motion['centers'].tolist(),'stepMs':motion['stepMs'],'poses':[pose.tolist() for pose in motion['poses']]},**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
print(json.dumps({'frames':len(frames),'durationMs':sum(durations),'bodyFinal':motion['poses'][-1][0].tolist()}))
