from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin, GifImagePlugin
import numpy as np
import json, math, shutil, sys

ROOT = next(p for p in Path(__file__).resolve().parents if (p/'client/nest-growth.mjs').exists())
OUT = ROOT/'AnimationCandidates/PebbleNestGrowth02To03SupportedV1'
APPROVED = ROOT/'AnimationCandidates/PebbleNestGrowth02To03SupportedKeysV1'
TEMP = ROOT/'$Trash/PebbleNestGrowth02To03-20261031-01a18fdb/SupportedAnimation'
OUT.mkdir(511, True, True)
TEMP.mkdir(511, True, True)
for name in ['Sources', 'Parts', 'Frames', 'Build']:
    (OUT/name).mkdir(511, True, True)
Y, X = np.mgrid[0:512, 0:512]
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
CONTACT_SAMPLES = []

def write(path, value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))

def read(path):
    return Image.open(path).convert('RGBA')

def polygon(points):
    im = Image.new('L', (512,512))
    ImageDraw.Draw(im).polygon(points, 255)
    return np.array(im)>0

def cut(im, mask):
    a = np.array(im).copy()
    a[:,:,3] *= np.uint8(mask)
    a[a[:,:,3]==0] = 0
    return Image.fromarray(a)

def over(front, back):
    return Image.alpha_composite(back, front)

def move(im, dx, dy):
    out = Image.new('RGBA', (512,512))
    out.alpha_composite(im, (round(dx),round(dy)))
    return out

def save_part(name, im):
    im.save(OUT/'Parts'/(name+'.png'))
    return im

def split(im, stage):
    if stage<2:
        roof_edge = [(0,306),(83,304),(102,310),(135,318),(174,331),(236,339),(287,344),(320,345),(341,340),(380,328),(420,318),(445,315),(512,315)]
        left_edge = [(0,120),(300,120),(313,159),(335,181),(355,189),(371,183),(380,174),(512,174)]
        right_edge = [(0,400),(310,392),(326,350),(348,333),(370,334),(384,347),(512,347)]
        left_seam = [(0,368),(75,367),(113,368),(155,374),(183,376),(230,376),(512,376)]
        right_seam = [(0,382),(335,382),(371,383),(416,379),(456,380),(512,380)]
    else:
        roof_edge = [(0,280),(75,284),(115,290),(153,297),(179,304),(230,310),(305,320),(334,321),(356,315),(393,303),(433,300),(462,298),(512,298)]
        left_edge = [(0,119),(284,119),(296,156),(315,176),(341,185),(361,176),(372,166),(512,166)]
        right_edge = [(0,405),(298,400),(314,355),(337,331),(356,334),(374,349),(512,349)]
        left_seam = [(0,366),(66,365),(111,367),(151,373),(180,374),(230,374),(512,374)]
        right_seam = [(0,374),(334,374),(370,374),(414,373),(471,372),(512,372)]
    roof_y = np.interp(X,[p[0] for p in roof_edge],[p[1] for p in roof_edge])
    left_x = np.interp(Y,[p[0] for p in left_edge],[p[1] for p in left_edge])
    right_x = np.interp(Y,[p[0] for p in right_edge],[p[1] for p in right_edge])
    left_base_y = np.interp(X,[p[0] for p in left_seam],[p[1] for p in left_seam])
    right_base_y = np.interp(X,[p[0] for p in right_seam],[p[1] for p in right_seam])
    base_left_x = np.interp(Y,[0,367,390,416,438,448,512],[190,182,187,196,195,174,174])
    base_right_x = np.interp(Y,[0,370,390,418,440,448,512],[335,343,330,317,315,333,333])
    masks = {'roof':Y<=roof_y,'left-upper':(X<=left_x)&(Y<left_base_y),'right-upper':(X>=right_x)&(Y<right_base_y),'left-base':(Y>=left_base_y)&(X<=base_left_x),'right-base':(Y>=right_base_y)&(X>=base_right_x)}
    claimed = np.zeros((512,512),bool)
    parts = {}
    for name in ['roof','left-upper','right-upper','left-base','right-base']:
        mask = masks[name]&~claimed
        claimed |= mask
        parts[name] = save_part('K'+str(stage)+'-'+name, cut(im,mask))
    parts['back'] = save_part('K'+str(stage)+'-back',cut(im,~claimed))
    return parts

KEYS = [read(OUT/'Sources'/('K'+str(i)+'.png')) for i in range(4)]
for i,im in enumerate(KEYS):
    im.save(OUT/'Sources'/('K'+str(i)+'.png'))
PARTS = [split(KEYS[i],i) for i in range(3)]
raw = OUT/'Sources/hidden-stone-generated.png'
hidden = read(raw).convert('RGBa').resize((512,512),Image.Resampling.LANCZOS).convert('RGBA')
a = np.array(hidden)
a[:,:,3][a[:,:,3]>240] = 255
a[:,:,3][a[:,:,3]<12] = 0
hidden = Image.fromarray(a)
hidden.save(OUT/'Sources/hidden-stone-registered.png')
hardware = polygon([(330,198),(349,198),(359,204),(395,204),(397,200),(420,202),(423,207),(447,208),(456,215),(457,233),(451,240),(459,253),(454,282),(445,284),(445,310),(430,317),(417,307),(417,284),(408,280),(405,269),(375,246),(359,244),(359,254),(348,265),(333,269),(319,264),(308,255),(303,241),(307,226),(313,216),(314,206)])
hardware |= polygon([(448,228),(458,229),(456,315),(446,320),(442,309)])
hardware |= polygon([(314,253),(325,260),(316,290),(305,288)])
gate = polygon([(147,297),(156,288),(171,283),(306,281),(319,286),(330,290),(344,299),(346,311),(337,319),(320,327),(174,328),(159,324),(148,317)])
weight = polygon([(437,304),(458,303),(471,311),(479,325),(482,346),(477,362),(464,371),(446,369),(430,358),(425,345),(427,324)])
hardware &= ~gate&~weight
mechanics = hardware|gate|weight
roof_region = polygon([(0,0),(512,0),(512,306),(428,306),(398,310),(351,320),(329,313),(312,289),(174,289),(164,301),(146,323),(98,314),(54,305),(0,305)])
roof_mask = roof_region&~mechanics
native = KEYS[3]
native_roof = cut(native,roof_mask)
fill_roof = cut(hidden,roof_region&mechanics)
roof = over(native_roof,fill_roof)
top_parts = {'arch':save_part('K3-arch-complete',roof),'frame-and-pulley':save_part('K3-frame-and-pulley',cut(native,hardware)),'gate':save_part('K3-gate',cut(native,gate)),'counterweight':save_part('K3-counterweight',cut(native,weight))}
lower = cut(native,~(roof_mask|mechanics))
top_parts['lower'] = save_part('K3-lower',lower)
room_source_path = OUT/'Sources/complete-cave-source.png'
if not room_source_path.exists():
    shutil.copyfile(ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3/Sources/SupportedV8/pebble/Parts/growth-0.png',room_source_path)
room_source = read(room_source_path)
room_piece = room_source.crop(room_source.getbbox()).resize((230,203),Image.Resampling.LANCZOS)
room = Image.new('RGBA',(512,512))
room.alpha_composite(room_piece,(141,235))
room = cut(room,Y<430)
room = save_part('complete-cave-backing',room)

def assemble(parts):
    im = parts['back'].copy()
    for name in ['left-base','right-base','left-upper','right-upper','roof']:
        im = over(parts[name],im)
    return im

def board(images, labels, columns, cell, path):
    rows = math.ceil(len(images)/columns)
    out = Image.new('RGB',(columns*cell,rows*(cell+32)),'#142029')
    draw = ImageDraw.Draw(out)
    for i,im in enumerate(images):
        x = i%columns*cell
        y = i//columns*(cell+32)
        thumb = im.resize((cell,cell),Image.Resampling.LANCZOS)
        out.paste(thumb,(x,y+32),thumb)
        draw.text((x+8,y+5),labels[i],(220,232,240),FONT)
    out.save(path)

def timeline(keys, frame):
    value = keys[0][1]
    for at,next_value in keys:
        if frame<at:
            break
        value = next_value
    return value

def foundation(f):
    im = PARTS[0]['back'].copy()
    for name in ['left-base','right-base','left-upper','right-upper']:
        im = over(PARTS[0][name],im)
    for name,at in [('left-base',10),('right-base',11)]:
        dy = timeline([(0,105),(at,88),(at+1,53),(at+2,22),(at+3,4),(at+4,0)],f)
        im = over(cut(move(PARTS[1][name],0,dy),Y<448),im)
    im = over(PARTS[0]['roof'],im)
    return im

def contact_y(im, x, edge):
    alpha = np.array(im.getchannel('A'))
    values = []
    for xx in range(x-3,x+4):
        yy = np.where(alpha[:,xx]>128)[0]
        if len(yy):
            values.append(float(yy.max() if edge=='bottom' else yy.min()))
    return float(np.median(values))

def supported_roof(left_y, right_y):
    source = np.array([[130.,contact_y(PARTS[1]['roof'],130,'bottom')],[392.,contact_y(PARTS[1]['roof'],392,'bottom')]])
    target = source.copy()
    target[0,1] = min(source[0,1],contact_y(PARTS[2]['left-upper'],130,'top')+left_y+2)
    target[1,1] = min(source[1,1],contact_y(PARTS[2]['right-upper'],392,'top')+right_y+2)
    a,b = source[1]-source[0],target[1]-target[0]
    angle = math.atan2(b[1],b[0])-math.atan2(a[1],a[0])
    co,si = math.cos(angle),math.sin(angle)
    rotation = np.array([[co,-si],[si,co]])
    translation = target.mean(0)-rotation@source.mean(0)
    inverse = rotation.T
    offset = -inverse@translation
    coeff = (inverse[0,0],inverse[0,1],offset[0],inverse[1,0],inverse[1,1],offset[1])
    posed = PARTS[1]['roof'].convert('RGBa').transform((512,512),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC).convert('RGBA')
    actual = source@rotation.T+translation
    sample = {'matrix':np.column_stack((rotation,translation)).tolist(),'sourceContacts':source.tolist(),'supportTargets':target.tolist(),'roofContacts':actual.tolist(),'errorPx':float(np.max(np.linalg.norm(actual-target,axis=1)))}
    return posed,target,sample

def supports(f):
    left_y = timeline([(0,120),(26,98),(27,57),(28,27),(29,7),(30,0)],f)
    right_y = timeline([(0,120),(27,98),(28,57),(29,27),(30,7),(31,0)],f)
    oldroof, contacts, sample = supported_roof(left_y,right_y)
    sample['frame'] = f
    CONTACT_SAMPLES.append(sample)
    ceiling = float(contacts[:,1].min())
    im = cut(room,Y>=ceiling-8)
    im = over(PARTS[1]['back'],im)
    for name,dy,replace_at in [('left-upper',left_y,29),('right-upper',right_y,30)]:
        incoming = cut(move(PARTS[2][name],0,dy),Y<437)
        if f<replace_at:
            alpha = np.array(PARTS[1][name].getchannel('A'))
            limit = np.zeros(512)
            for xx in range(512):
                yy = np.where(alpha[:,xx]>100)[0]
                if len(yy):
                    limit[xx] = yy.min()
            incoming = cut(incoming,Y<limit[None,:])
            im = over(incoming,im)
            im = over(PARTS[1][name],im)
        else:
            im = over(incoming,im)
    for name in ['left-base','right-base']:
        im = over(PARTS[1][name],im)
    im = over(oldroof,im)
    return im

def final_module(f):
    module_y = timeline([(0,190),(44,126),(45,77),(46,36),(47,11),(48,0)],f)
    machine_y = timeline([(0,200),(44,150),(45,98),(46,50),(47,17),(48,4),(49,0)],f)
    if f<48:
        im = KEYS[2].copy()
        cap_mask = polygon([(157,140),(394,140),(394,231),(362,230),(312,228),(250,222),(200,216),(170,212),(157,210)])
        arch_only = cut(top_parts['arch'],~cap_mask)
        incoming = move(arch_only,0,module_y)
        roof_edge = [(0,280),(75,284),(115,290),(153,297),(179,304),(230,310),(305,320),(334,321),(356,315),(393,303),(433,300),(462,298),(512,298)]
        limit = np.interp(X,[p[0] for p in roof_edge],[p[1] for p in roof_edge])
        incoming = cut(incoming,Y<=limit)
        im = over(incoming,im)
        im = over(PARTS[2]['roof'],im)
    else:
        im = over(top_parts['arch'],top_parts['lower'])
    for name in ['frame-and-pulley','counterweight','gate']:
        im = over(cut(move(top_parts[name],0,machine_y),Y<448),im)
    return im

def render(f):
    if f<10:
        return KEYS[0].copy()
    if f<15:
        return foundation(f)
    if f<26:
        return KEYS[1].copy()
    if f<31:
        return supports(f)
    if f<44:
        return KEYS[2].copy()
    if f<49:
        return final_module(f)
    return KEYS[3].copy()

def webp(images,path,durations):
    images[0].encoderinfo = {'append_images':images[1:],'duration':durations,'loop':0,'lossless':True,'method':4,'minimize_size':False}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(images[0],stream,str(path))

def preview(im):
    bg = Image.new('RGB',(512,512),'#142029')
    bg.paste(im,(0,0),im)
    return bg

def gif(images,path,durations):
    thumbs = [preview(im).resize((384,384),Image.Resampling.LANCZOS) for im in images]
    atlas = Image.new('RGB',(3072,3072),'#142029')
    for i,im in enumerate(thumbs):
        atlas.paste(im,(i%8*384,i//8*384))
    palette = atlas.quantize(192,Image.Quantize.MEDIANCUT,0,None,Image.Dither.NONE)
    frames = [im.quantize(192,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in thumbs]
    frames[0].encoderinfo = {'append_images':frames[1:],'duration':durations,'loop':0,'disposal':2,'optimize':False}
    with path.open('wb') as stream:
        GifImagePlugin._save_all(frames[0],stream,str(path))

def prepare():
    images=[]
    labels=[]
    for i,parts in enumerate(PARTS):
        for name,im in parts.items():
            images.append(im)
            labels.append('K'+str(i)+' '+name)
    for name,im in top_parts.items():
        images.append(im)
        labels.append('K3 '+name)
    board(images,labels,6,256,TEMP/'parts.png')
    samples = list(range(24,34))
    frames = [render(f) for f in samples]
    board(frames,['F'+str(f) for f in samples],5,256,TEMP/'representative-contact.png')
    webp([preview(im) for im in frames],OUT/'representative.webp',[400]+[80]*8+[700])
    print('Representative interval prepared',OUT/'representative.webp')

def export():
    frames = [render(f) for f in range(61)]
    durations = [600]+[80]*59+[1000]
    sheet = Image.new('RGBA',(4096,4096))
    for f,im in enumerate(frames):
        im.save(OUT/'Frames'/('%03d.png'%f))
        sheet.paste(im,(f%8*512,f//8*512))
    sheet.save(OUT/'growth.png')
    KEYS[0].save(OUT/'start.png')
    KEYS[3].save(OUT/'level-03.png')
    webp(frames,OUT/'growth.webp',durations)
    webp([preview(im) for im in frames],OUT/'preview.webp',durations)
    gif(frames,OUT/'preview.gif',durations)
    samples = list(range(9,17))+list(range(25,33))+list(range(43,52))
    board([frames[i] for i in samples],['F'+str(i) for i in samples],8,224,OUT/'transitions.png')
    board([frames[i] for i in [0,10,12,15,26,28,31,44,46,48,50,60]],['F'+str(i) for i in [0,10,12,15,26,28,31,44,46,48,50,60]],4,384,OUT/'contact.png')
    meta = {'frameSize':[512,512],'frameMs':80,'columns':8,'rows':8,'frameCount':61,'durationsMs':durations,'durationMs':sum(durations),'root':[256,448],'loop':False,'previewRepeats':True,'approvedKeys':'../PebbleNestGrowth02To03SupportedKeysV1/keyposes.png','keyPoseFrames':{'K0':0,'K1':15,'K2':31,'K3':50},'motionReference':'DesignAssets/Animations/Nests/Growth01To02-v3/pebble/growth.png','markersMs':{'foundationStart':1320,'foundationLanded':1720,'supportsStart':2600,'supportsLanded':3000,'archAndHoistStart':4040,'archAndHoistLanded':4520},'poseOpacityBlend':False,'entranceOpenThroughout':True}
    write(OUT/'animation.json',meta)
    bones = [{'id':'root','parent':None,'pivot':[256,448],'scale':[1,1]}]
    attachments = []
    for stage,parts in enumerate(PARTS):
        for name,im in parts.items():
            bone = 'K'+str(stage)+'-'+name
            pivot = [256,448] if name=='back' else [115,436] if name=='left-base' else [390,438] if name=='right-base' else [172,370] if name=='left-upper' else [340,378] if name=='right-upper' else [256,314]
            bones.append({'id':bone,'parent':'root','pivot':pivot,'scale':[1,1]})
            attachments.append({'id':bone,'bone':bone,'image':'Parts/'+bone+'.png','rigid':True,'weight':1,'bindCanvas':[512,512],'sourceKey':'K'+str(stage)})
    bones.append({'id':'arch-and-hoist','parent':'root','pivot':[256,305],'scale':[1,1]})
    bones.append({'id':'arch','parent':'arch-and-hoist','pivot':[256,305],'scale':[1,1]})
    bones.append({'id':'hardware','parent':'arch-and-hoist','pivot':[335,240],'scale':[1,1]})
    for name in top_parts:
        attachments.append({'id':'K3-'+name,'bone':'root' if name=='lower' else 'arch' if name=='arch' else 'hardware','image':'Parts/'+('K3-arch-complete' if name=='arch' else 'K3-'+name)+'.png','rigid':True,'weight':1,'bindCanvas':[512,512],'sourceKey':'K3'})
    write(OUT/'rig.json',{'format':'local-layered-rigid-sprite-rig','bones':bones,'attachments':attachments,'renderer':'Build/pebble_supported.py','rootMotion':False,'rigidScale':[1,1],'groundClipY':448,'poseOpacityBlend':False,'phases':{'foundation':[10,15],'supportsAndRoof':[26,31],'archAndHoist':[44,50]},'occlusion':'native wall and roof silhouettes; lower parts occlude rising supports; roof and hardware have complete backing','sourceKeyApproval':'user: current design, continue production','contactSamples':CONTACT_SAMPLES,'timeline':{'foundationLeft':[[10,88],[11,53],[12,22],[13,4],[14,0]],'foundationRight':[[11,88],[12,53],[13,22],[14,4],[15,0]],'supportLeft':[[26,98],[27,57],[28,27],[29,7],[30,0]],'supportRight':[[27,98],[28,57],[29,27],[30,7],[31,0]],'arch':[[44,126],[45,77],[46,36],[47,11],[48,0]],'hardware':[[44,150],[45,98],[46,50],[47,17],[48,4],[49,0]]}})
    print('Exported',len(frames),'frames',sum(durations),'ms',OUT)

if sys.argv[1]=='prepare':
    prepare()
elif sys.argv[1]=='export':
    export()
