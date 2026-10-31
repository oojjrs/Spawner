from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from sampling import affine

root=Path(__file__).resolve().parent
registration=json.loads((root/'Source/generated-registration.json').read_text('utf-8'))
placement=np.array(json.loads((root/'Source/reference-registration.json').read_text('utf-8'))['placement'])
original=Image.open(root/'Source/approved-original.png').convert('RGBA')
original_alpha=np.array(original)[:,:,3]
visible={name:Image.open(path).convert('RGBA') for path in (root/'Source/Visible').glob('*.png') for name in [path.stem]}

def normalize(image):
    return affine(image,placement,(512,512))

def registered(name):
    spec=registration[name]
    source=Image.open(root/spec['source']).convert('RGBA')
    selected=Image.new('RGBA',source.size)
    selected.paste(source.crop(spec['crop']),spec['crop'][:2])
    matrix=np.eye(3)
    matrix[:2]=spec['matrix']
    if name=='body':
        matrix=np.array([[1.185,0,-28.12],[0,1.15,-9.45],[0,0,1]])@matrix
    image=affine(selected,matrix,original.size)
    image.save(root/'Source/Registered'/(name+'.png'))
    return image

normalize(original).save(root/'Source/reference.png')
drawings={name:registered(name) for name in registration}
for name in ['body','head','fore-far','hind-far','fore-near','hind-near']:
    pixels=np.array(drawings[name])
    own=np.array(visible[name])[:,:,3]
    other=original_alpha.copy()
    other[own>0]=0
    allowed=np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16
    if name=='body':
        mask=Image.new('L',original.size)
        ImageDraw.Draw(mask).ellipse((159,115,322,205),255)
        pixels[:,:,3]=np.minimum(pixels[:,:,3],np.array(mask))
    elif name=='head':
        yy,xx=np.indices(own.shape)
        pixels[:,:,3]*=allowed&(own==0)&(yy>=110)&(xx<=205)
    else:
        pixels[:,:,3]*=allowed&(own==0)
    pixels[pixels[:,:,3]<16,3]=0
    hidden=Image.fromarray(pixels)
    normalize(hidden).save(root/'Parts'/(name+'-hidden.png'))
    normalize(visible[name]).save(root/'Parts'/(name+'-visible.png'))
    hidden.alpha_composite(visible[name])
    normalize(hidden).save(root/'Parts'/(name+'.png'))

for name,pivot,parent in [['ear-far',[100,115],'head'],['ear-near',[155,129],'head'],['tail',[300,128],'body']]:
    pixels=np.array(drawings[parent])
    mask=Image.new('L',original.size)
    x,y=pivot
    ImageDraw.Draw(mask).ellipse((x-9,y-9,x+9,y+9),255)
    pixels[:,:,3]=np.minimum(pixels[:,:,3],np.array(mask))
    own=np.array(visible[name])[:,:,3]
    other=original_alpha.copy()
    other[own>0]=0
    pixels[:,:,3]*=(np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16)&(own==0)
    pixels[pixels[:,:,3]<16,3]=0
    hidden=Image.fromarray(pixels)
    normalize(hidden).save(root/'Parts'/(name+'-hidden.png'))
    normalize(visible[name]).save(root/'Parts'/(name+'-visible.png'))
    hidden.alpha_composite(visible[name])
    normalize(hidden).save(root/'Parts'/(name+'.png'))

closed=np.array(drawings['closed'])
head=np.array(visible['head'])
eye_mask=Image.new('L',original.size)
draw=ImageDraw.Draw(eye_mask)
draw.ellipse((117,143,144,166),255)
draw.ellipse((79,139,94,154),255)
eye_mask=np.array(eye_mask.filter(ImageFilter.GaussianBlur(1.0)),float)/255
head[:,:,:3]=(head[:,:,:3]*(1-eye_mask[:,:,None])+closed[:,:,:3]*eye_mask[:,:,None]).astype('uint8')
normalize(Image.fromarray(head)).save(root/'Parts/head-closed-visible.png')
closed_complete=Image.open(root/'Parts/head-hidden.png').convert('RGBA')
closed_complete.alpha_composite(normalize(Image.fromarray(head)))
closed_complete.save(root/'Parts/head-closed.png')
core=np.array(visible['body'])
core[core[:,:,3]<=250,3]=0
normalize(Image.fromarray(core)).save(root/'Parts/body-core.png')
mane=np.array(visible['mane'])
corrective=np.array(drawings['mane'])
corrective_weight=np.array(Image.open(root/'Source/mane-corrective-mask.png').convert('L'),float)/255
corrective_weight*=corrective[:,:,3]/255
mane[:,:,:3]=np.rint(mane[:,:,:3]*(1-corrective_weight[:,:,None])+corrective[:,:,:3]*corrective_weight[:,:,None]).astype('uint8')
underpaint=np.array(drawings['body'])
underpaint[:,:235]=np.array(drawings['head'])[:,:235]
underpaint[:,:,:3]=np.rint(underpaint[:,:,:3]*(1-corrective_weight[:,:,None])+corrective[:,:,:3]*corrective_weight[:,:,None]).astype('uint8')
other=original_alpha.copy()
other[mane[:,:,3]>0]=0
allowed=np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16
region=np.array(Image.open(root/'Source/mane-region-mask.png').convert('L'))>0
underpaint[:,:,3]*=allowed&region&(mane[:,:,3]==0)
underpaint[underpaint[:,:,3]<16,3]=0
complete_mane=Image.fromarray(underpaint)
complete_mane.alpha_composite(Image.fromarray(mane))
normalize(complete_mane).save(root/'Parts/mane.png')
normalize(Image.fromarray(mane)).save(root/'Parts/mane-visible.png')

hoof_polygons={
    'fore-near':[[181,226],[196,225],[212,233],[235,270],[150,270],[150,238]],
    'fore-far':[[88,212],[104,213],[118,220],[145,250],[65,250],[65,220]],
    'hind-near':[[289,220],[307,220],[330,231],[350,270],[265,270],[265,230]],
    'hind-far':[[230,207],[248,206],[265,214],[285,250],[200,250],[200,217]]
}
for name,polygon in hoof_polygons.items():
    mask=Image.new('L',original.size)
    ImageDraw.Draw(mask).polygon(polygon,255)
    hoof=np.array(visible[name])
    hoof[:,:,3]=np.minimum(hoof[:,:,3],np.array(mask))
    skin=np.array(visible[name])
    skin[:,:,3]*=np.array(mask)==0
    complete_hidden=np.array(drawings[name])
    own=np.array(visible[name])[:,:,3]
    other=original_alpha.copy()
    other[own>0]=0
    allowed=np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16
    socket=Image.new('L',original.size)
    ankle_point={'fore-near':[194,228],'fore-far':[104,216],'hind-near':[307,220],'hind-far':[244,211]}[name]
    sx,sy=ankle_point
    ImageDraw.Draw(socket).ellipse((sx-5,sy-5,sx+5,sy+5),255)
    allowed|=np.array(socket)>0
    complete_hidden[:,:,3]*=allowed&(own==0)
    complete_hidden[:,:,3]*=(np.array(mask)==0)|(np.array(socket)>0)
    ankle={'fore-near':228,'fore-far':216,'hind-near':220,'hind-far':211}[name]
    complete_hidden[np.indices(original_alpha.shape)[0]>ankle+2,3]=0
    complete_hidden[complete_hidden[:,:,3]<16,3]=0
    for suffix,array in [['skin-visible',skin],['hoof-visible',hoof],['skin-hidden',complete_hidden]]:
        normalize(Image.fromarray(array)).save(root/'Parts'/(name+'-'+suffix+'.png'))
    combined=Image.fromarray(complete_hidden)
    combined.alpha_composite(Image.fromarray(skin))
    normalize(combined).save(root/'Parts'/(name+'-skin.png'))
    normalize(Image.fromarray(hoof)).save(root/'Parts'/(name+'-hoof.png'))
    knee={'fore-near':200,'fore-far':195,'hind-near':205,'hind-far':195}[name]
    for section,selection in [['upper',np.indices(original_alpha.shape)[0]<=knee],['lower',np.indices(original_alpha.shape)[0]>=knee]]:
        collider=np.array(combined)
        collider[:,:,3]*=selection
        normalize(Image.fromarray(collider)).save(root/'Parts'/(name+'-'+section+'-collider.png'))
