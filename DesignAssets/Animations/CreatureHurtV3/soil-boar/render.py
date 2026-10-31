from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json
import math
import hashlib
import numpy as np

FOLDER = Path(__file__).resolve().parent
SIZE = 369
DURATIONS = [20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20]


def write_json(path, data):
    text = json.dumps(data, **{'ensure_ascii': False, 'indent': 2}) + '\n'
    path.write_bytes(text.replace('\n','\r\n').encode('utf-8'))


def warp(source, source_point, target_point, angle, scale):
    a = math.radians(angle)
    c, s = math.cos(a) * scale, math.sin(a) * scale
    forward = np.array([[c,-s,target_point[0]-c*source_point[0]+s*source_point[1]],[s,c,target_point[1]-s*source_point[0]-c*source_point[1]],[0,0,1]], np.float64)
    inverse = np.linalg.inv(forward)[:2].reshape(-1).tolist()
    return source.transform(source.size, Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC), forward[:2].tolist()


def mask_polygon(points):
    m = Image.new('L', (SIZE,SIZE), 0)
    ImageDraw.Draw(m).polygon(points, 255)
    return m.filter(ImageFilter.GaussianBlur(.85))


def match_patch(donor, neutral, mask):
    d = np.asarray(donor).astype(np.float32)
    n = np.asarray(neutral).astype(np.float32)
    core = np.asarray(mask) > 32
    outer = np.asarray(mask.filter(ImageFilter.MaxFilter(15))) > 32
    ring = outer & ~core & (d[:,:,3] > 245) & (n[:,:,3] > 245)
    difference = n[:,:,:3] - d[:,:,:3]
    shift = np.median(difference[ring],0)
    d[:,:,:3] = np.clip(d[:,:,:3] + shift,0,255)
    d[:,:,3] = n[:,:,3]
    return Image.fromarray(np.uint8(np.round(d))), shift.tolist()


def prepare(neutral):
    near_points = [(116,178),(128,173),(147,171),(155,180),(151,195),(140,201),(122,200),(113,190)]
    far_points = [(79,173),(85,176),(90,184),(89,194),(83,195),(77,188),(76,180)]
    near = mask_polygon(near_points)
    far = mask_polygon(far_points)
    near.save(FOLDER/'Masks/near-eye.png')
    far.save(FOLDER/'Masks/far-eye.png')
    union = Image.fromarray(np.maximum(np.asarray(near),np.asarray(far)))
    union.save(FOLDER/'Masks/expression.png')
    registrations = {}
    for expression, donor_file, near_center, near_angle, far_center, far_angle in [
        ('closed','donor-closed.png',[136,146],-30,[136,146],-12),
    ]:
        donor = Image.open(FOLDER/'Source'/donor_file).convert('RGBA')
        near_image, near_matrix = warp(donor,near_center,[133,186],near_angle,1)
        far_image, far_matrix = warp(donor,far_center,[83.5,184.5],far_angle,.44)
        local_near = mask_polygon([(118,187),(130,181),(146,176),(152,181),(148,194),(139,199),(123,198),(115,191)]) if expression == 'half' else near
        local_near.save(FOLDER/'Masks'/('near-'+expression+'.png'))
        near_image, near_shift = match_patch(near_image,neutral,local_near)
        far_image, far_shift = match_patch(far_image,neutral,far)
        composite = Image.composite(near_image,neutral,local_near)
        composite = Image.composite(far_image,composite,far)
        composite.save(FOLDER/'Source'/('eyes-'+expression+'.png'))
        near_image.save(FOLDER/'Source'/('near-'+expression+'-registered.png'))
        far_image.save(FOLDER/'Source'/('far-'+expression+'-registered.png'))
        registrations[expression] = {'source':'Source/'+donor_file,'near':{'matrix':near_matrix,'rgbShift':near_shift,'mask':'Masks/near-'+expression+'.png'},'far':{'matrix':far_matrix,'rgbShift':far_shift,'mask':'Masks/far-eye.png'},'outsideExpressionMask':'Exact approved neutral pixels. Spatial feathering only; no temporal crossfade.'}
    yy, xx = np.mgrid[:SIZE,:SIZE].astype(np.float32)
    occlusion = np.clip((227 - .28 * xx - yy) / 1.3 + .5,0,1)
    half_mask = Image.fromarray(np.uint8(np.maximum(np.asarray(near) * occlusion,np.asarray(far))))
    half_mask.save(FOLDER/'Masks/half-occlusion.png')
    closed = Image.open(FOLDER/'Source/eyes-closed.png').convert('RGBA')
    half = Image.composite(closed,neutral,half_mask)
    half.save(FOLDER/'Source/eyes-half.png')
    registrations['half'] = {'source':'Source/eyes-closed.png','mask':'Masks/half-occlusion.png','occlusion':'Painted upper eyelid covers the upper iris while the lower original iris remains intentionally visible.'}
    write_json(FOLDER/'expression-registration.json',registrations)


def render_frame(source, pivot, degrees, lift):
    if degrees == 0 and lift == 0:
        return source.copy()
    scale = 4
    large = source.resize((SIZE*scale,SIZE*scale),Image.Resampling.LANCZOS)
    transformed, unused = warp(large,[pivot[0]*scale,pivot[1]*scale],[pivot[0]*scale,(pivot[1]-lift)*scale],degrees,1)
    return transformed.resize((SIZE,SIZE),Image.Resampling.LANCZOS)


def main():
    neutral = Image.open(FOLDER/'Source/seed.png').convert('RGBA')
    prepare(neutral)
    pivot = [184.5,283.957031]
    angles = [0,2.1,4.9,6.45,7,6.58,4.9,3.08,1.54,.42,0,0,0,0,0,0]
    lift = [0,1.3,3.0,3.97,4.32,4.06,3.0,1.9,.95,.26,0,0,0,0,0,0]
    expressions = ['open','half','closed','closed','closed','closed','closed','closed','half','half','half','open','open','open','open','open']
    sources = {'open':neutral,'half':Image.open(FOLDER/'Source/eyes-half.png').convert('RGBA'),'closed':Image.open(FOLDER/'Source/eyes-closed.png').convert('RGBA')}
    frames = [render_frame(sources[e],pivot,a,l) for e,a,l in zip(expressions,angles,lift)]
    timeline = {'durationMs':760,'durationsMs':DURATIONS,'pivot':pivot,'scale':1,'rotationConvention':'Positive is clockwise in image coordinates, recoiling the left-facing head toward rear/right.','rootTravel':False,'intentionalLiftPx':4.32,'frames':[{'frame':i,'expression':e,'clockwiseDegrees':a,'liftPx':l,'scale':1} for i,(e,a,l) in enumerate(zip(expressions,angles,lift))]}
    write_json(FOLDER/'timeline.json',timeline)
    sheet = Image.new('RGBA',(SIZE*4,SIZE*4),(0,0,0,0))
    matrix = Image.new('RGBA',(256,256),(0,0,0,0))
    for i,f in enumerate(frames):
        sheet.paste(f,(i%4*SIZE,i//4*SIZE))
        matrix.paste(f.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
    sheet.save(FOLDER/'hurt.webp',**{'lossless':True,'method':4})
    matrix.save(FOLDER/'hurt-matrix.webp',**{'lossless':True,'method':4})
    preview_durations=DURATIONS.copy();preview_durations[-1]+=900
    frames[0].save(FOLDER/'hurt-preview.webp',**{'save_all':True,'append_images':frames[1:],'duration':preview_durations,'loop':0,'lossless':True,'method':4})
    small = [f.resize((64,64),Image.Resampling.LANCZOS) for f in frames]
    small[0].save(FOLDER/'hurt-thumbnail.webp',**{'save_all':True,'append_images':small[1:],'duration':preview_durations,'loop':0,'lossless':True,'method':4})
    keys = [0,1,2,4,6,8,9,11]
    contact = Image.new('RGB',(SIZE*4,(SIZE+25)*2),(41,49,43));draw=ImageDraw.Draw(contact)
    for i,k in enumerate(keys):
        x,y=i%4*SIZE,i//4*(SIZE+25);contact.paste(frames[k],(x,y),frames[k]);draw.text((x+8,y+SIZE+4),'frame '+str(k)+' / '+expressions[k],(240,240,230))
    contact.save(FOLDER/'hurt-contact.png')
    face = Image.new('RGB',(500*3,500),(41,49,43))
    for i,key in enumerate(['open','half','closed']):
        f=sources[key].crop((60,145,165,225)).resize((500,380),Image.Resampling.NEAREST);face.paste(f,(i*500,50),f)
    face.save(FOLDER/'expression-contact.png')
    metadata={'image':'DesignAssets/Animations/CreatureHurtV3/soil-boar/hurt.webp','frameSize':SIZE,'columns':4,'pivotX':pivot[0],'pivotY':pivot[1],'frameCount':16,'durationsMs':DURATIONS,'durationMs':760,'loop':False,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'method':'Approved neutral artwork reused for the entire body; locally registered and color-corrected painted eyelids from V2; one coherent ground-pivot rotation/lift with constant scale. This is corrective compositing, not a part rig.','seed':'Source/seed.png','seedSha256':hashlib.sha256((FOLDER/'Source/seed.png').read_bytes()).hexdigest(),'expressionRegistration':'expression-registration.json','masks':'Masks/expression.png','timeline':'timeline.json','renderer':'render.py','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','previewPauseMs':900,'artworkScale':1,'rotationPivot':pivot,'peakRotationDegrees':7,'peakLiftPixels':4.32}
    write_json(FOLDER/'hurt.json',metadata)
    print(json.dumps({'species':'soil-boar','frames':len(frames),'durationMs':sum(DURATIONS),'frameSize':SIZE,'method':'corrective compositing + coherent constant-scale transform'}))


if __name__ == '__main__':
    main()