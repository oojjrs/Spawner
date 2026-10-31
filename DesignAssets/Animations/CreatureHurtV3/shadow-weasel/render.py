from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json
import math
import hashlib
import numpy as np

FOLDER = Path(__file__).resolve().parent
DURATIONS = [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20]

def write_json(path, data):
    text = json.dumps(data, **{'ensure_ascii':False,'indent':2}) + '\n'
    path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))

def warp(source, source_point, target_point, angle, scale):
    a = math.radians(angle)
    c, s = math.cos(a)*scale, math.sin(a)*scale
    forward = np.array([[c,-s,target_point[0]-c*source_point[0]+s*source_point[1]],[s,c,target_point[1]-s*source_point[0]-c*source_point[1]],[0,0,1]],np.float64)
    inverse = np.linalg.inv(forward)[:2].reshape(-1).tolist()
    return source.transform(source.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC),forward[:2].tolist()

def shape_mask(size, points):
    mask = Image.new('L',(size,size),0)
    ImageDraw.Draw(mask).polygon(points,255)
    return mask.filter(ImageFilter.GaussianBlur(.8))

def match_patch(donor,neutral,mask):
    d = np.asarray(donor).astype(np.float32)
    n = np.asarray(neutral).astype(np.float32)
    core = np.asarray(mask)>32
    outer = np.asarray(mask.filter(ImageFilter.MaxFilter(15)))>32
    ring = outer & ~core & (d[:,:,3]>245) & (n[:,:,3]>245)
    shift = np.median((n[:,:,:3]-d[:,:,:3])[ring],0)
    d[:,:,:3] = np.clip(d[:,:,:3]+shift,0,255)
    d[:,:,3] = n[:,:,3]
    return Image.fromarray(np.uint8(np.round(d))),shift.tolist()

def seamless_patch(donor,neutral,mask):
    d=np.asarray(donor).astype(np.float32)
    n=np.asarray(neutral).astype(np.float32)
    box=mask.getbbox()
    left=max(0,box[0]-2);top=max(0,box[1]-2);right=min(mask.width,box[2]+2);bottom=min(mask.height,box[3]+2)
    target=n[top:bottom,left:right,:3]
    original=d[top:bottom,left:right,:3]
    core=(np.asarray(mask)[top:bottom,left:right]>16)&(n[top:bottom,left:right,3]>64)
    core[[0,-1],:]=False;core[:,[0,-1]]=False
    correction=target-original
    for unused in range(220):
        average=(np.roll(correction,1,0)+np.roll(correction,-1,0)+np.roll(correction,1,1)+np.roll(correction,-1,1))*.25
        correction[core]=average[core]
    d[top:bottom,left:right,:3]=np.clip(original+correction,0,255)
    d[:,:,3]=n[:,:,3]
    return Image.fromarray(np.uint8(np.round(d))),np.median(correction[core],0).tolist()

def ink_patch(donor,neutral,mask,eye):
    skin,unused=warp(neutral,eye['skinFill'],eye['target'],0,1)
    skin,shift=seamless_patch(skin,neutral,mask)
    gate=Image.new('L',donor.size,0)
    ImageDraw.Draw(gate).polygon(eye['inkPolygon'],255)
    raw=np.asarray(donor).copy()
    luminance=raw[:,:,:3].astype(np.float32).mean(2)
    alpha=np.clip((eye['inkThreshold']-luminance)/35,0,1)*np.asarray(gate)/255
    raw[:,:,3]=np.uint8(np.round(raw[:,:,3]*alpha))
    layer=Image.fromarray(raw)
    layer.save(FOLDER/'Source'/(eye['name']+'-ink.png'))
    layer,unused=warp(layer,eye['source'],eye['target'],eye['angle'],eye['inkScale'])
    pixels=np.asarray(layer).copy()
    pixels[:,:,3]=np.uint8(pixels[:,:,3].astype(np.float32)*np.asarray(mask)/255*np.asarray(neutral.getchannel('A'))/255)
    result=skin.copy();result.alpha_composite(Image.fromarray(pixels))
    return result,shift

def prepare(neutral,config):
    size=neutral.width
    donor=Image.open(FOLDER/'Source/donor-closed.png').convert('RGBA')
    closed=neutral.copy()
    union=np.zeros((size,size),np.uint8)
    half_union=np.zeros((size,size),np.float32)
    yy,xx=np.mgrid[:size,:size].astype(np.float32)
    registrations=[]
    for eye in config['eyes']:
        mask=shape_mask(size,eye['points'])
        mask.save(FOLDER/'Masks'/(eye['name']+'.png'))
        aligned,matrix=warp(donor,eye['source'],eye['target'],eye['angle'],eye['scale'])
        corrected,shift=match_patch(aligned,neutral,mask)
        if eye.get('inkOnly',False):
            corrected,shift=ink_patch(donor,neutral,mask,eye)
        elif eye.get('seamless',False):
            corrected,shift=seamless_patch(aligned,neutral,mask)
        corrected.save(FOLDER/'Source'/(eye['name']+'-registered.png'))
        closed=Image.composite(corrected,closed,mask)
        union=np.maximum(union,np.asarray(mask))
        cutoff=eye['halfCut']
        if cutoff:
            cover=np.clip((cutoff[0]+cutoff[1]*xx-yy)/1.3+.5,0,1)
        else:
            cover=np.ones((size,size),np.float32)
        half_union=np.maximum(half_union,np.asarray(mask)*cover)
        if eye.get('inkOnly',False):
            unused,matrix=warp(donor,eye['source'],eye['target'],eye['angle'],eye['inkScale'])
        registrations.append({'name':eye['name'],'source':'Source/donor-closed.png','matrix':matrix,'medianRgbCorrection':shift,'colorMethod':'neutral skin fill + isolated painted eyelid ink' if eye.get('inkOnly',False) else 'harmonic boundary matching' if eye.get('seamless',False) else 'boundary RGB offset','mask':'Masks/'+eye['name']+'.png'})
    Image.fromarray(union).save(FOLDER/'Masks/expression.png')
    closed.save(FOLDER/'Source/eyes-closed.png')
    half_mask=Image.fromarray(np.uint8(half_union))
    half_mask.save(FOLDER/'Masks/half-occlusion.png')
    half=Image.composite(closed,neutral,half_mask)
    half.save(FOLDER/'Source/eyes-half.png')
    write_json(FOLDER/'expression-registration.json',{'eyes':registrations,'halfSource':'Source/eyes-closed.png','halfMask':'Masks/half-occlusion.png','outsideExpressionMask':'Exact approved neutral pixels; no temporal crossfade.'})
    return closed,half

def render_frame(source,pivot,angle,lift):
    if angle==0 and lift==0:return source.copy()
    size=source.width
    large=source.resize((size*4,size*4),Image.Resampling.LANCZOS)
    result,unused=warp(large,[v*4 for v in pivot],[pivot[0]*4,(pivot[1]-lift)*4],angle,1)
    return result.resize((size,size),Image.Resampling.LANCZOS)

def main():
    config=json.loads((FOLDER/'expression-config.json').read_text('utf-8'))
    neutral=Image.open(FOLDER/'Source/seed.png').convert('RGBA')
    size=neutral.width
    closed,half=prepare(neutral,config)
    profile=[0,.30,.70,.92,1,.94,.70,.44,.22,.06,0,0,0,0,0,0]
    expressions=['open','half','closed','closed','closed','closed','closed','closed','half','half','half','open','open','open','open','open']
    if not config['half']:
        expressions=['open','open','closed','closed','closed','closed','closed','closed','closed','open','open','open','open','open','open','open']
    sources={'open':neutral,'closed':closed,'half':half}
    pivot=config['pivot']
    frames=[render_frame(sources[e],pivot,config['degrees']*p,config['liftPx']*p) for e,p in zip(expressions,profile)]
    timeline={'durationMs':760,'durationsMs':DURATIONS,'pivot':pivot,'scale':1,'clockwisePositive':True,'rootTravel':False,'frames':[{'frame':i,'expression':e,'clockwiseDegrees':round(config['degrees']*p,5),'liftPx':round(config['liftPx']*p,5),'scale':1} for i,(e,p) in enumerate(zip(expressions,profile))]}
    write_json(FOLDER/'timeline.json',timeline)
    sheet=Image.new('RGBA',(size*4,size*4),(0,0,0,0))
    matrix=Image.new('RGBA',(256,256),(0,0,0,0))
    for i,f in enumerate(frames):
        sheet.paste(f,(i%4*size,i//4*size))
        matrix.paste(f.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
    sheet.save(FOLDER/'hurt.webp',**{'lossless':True,'method':4})
    matrix.save(FOLDER/'hurt-matrix.webp',**{'lossless':True,'method':4})
    preview=DURATIONS.copy();preview[-1]+=900
    frames[0].save(FOLDER/'hurt-preview.webp',**{'save_all':True,'append_images':frames[1:],'duration':preview,'loop':0,'lossless':True,'method':4})
    small=[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames]
    small[0].save(FOLDER/'hurt-thumbnail.webp',**{'save_all':True,'append_images':small[1:],'duration':preview,'loop':0,'lossless':True,'method':4})
    keys=[0,1,2,4,6,8,9,11]
    contact=Image.new('RGB',(size*4,(size+25)*2),(41,49,43));d=ImageDraw.Draw(contact)
    for i,k in enumerate(keys):
        x,y=i%4*size,i//4*(size+25);contact.paste(frames[k],(x,y),frames[k]);d.text((x+6,y+size+4),'frame '+str(k)+' / '+expressions[k],(240,240,230))
    contact.save(FOLDER/'hurt-contact.png')
    box=config['faceBox'];w,h=box[2]-box[0],box[3]-box[1]
    face=Image.new('RGB',(w*4*3,h*4),(41,49,43))
    for i,key in enumerate(['open','half','closed']):
        crop=sources[key].crop(tuple(box)).resize((w*4,h*4),Image.Resampling.NEAREST);face.paste(crop,(i*w*4,0),crop)
    face.save(FOLDER/'expression-contact.png')
    metadata={'image':'DesignAssets/Animations/CreatureHurtV3/'+FOLDER.name+'/hurt.webp','frameSize':size,'columns':4,'pivotX':pivot[0],'pivotY':pivot[1],'frameCount':16,'durationsMs':DURATIONS,'durationMs':760,'loop':False,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'method':'Approved neutral body reused at fixed scale; V2 painted eyelids locally registered and color-corrected; coherent ground-pivot rotation/lift. Corrective compositing, not a part rig.','seed':'Source/seed.png','seedSha256':hashlib.sha256((FOLDER/'Source/seed.png').read_bytes()).hexdigest(),'expressionRegistration':'expression-registration.json','expressionConfig':'expression-config.json','masks':'Masks/expression.png','timeline':'timeline.json','renderer':'render.py','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','previewPauseMs':900,'artworkScale':1,'rotationPivot':pivot,'peakRotationDegrees':config['degrees'],'peakLiftPixels':config['liftPx']}
    write_json(FOLDER/'hurt.json',metadata)
    print(json.dumps({'species':FOLDER.name,'frames':16,'durationMs':760,'frameSize':size,'source':'fixed neutral + registered eyes'}))

if __name__=='__main__':
    main()
