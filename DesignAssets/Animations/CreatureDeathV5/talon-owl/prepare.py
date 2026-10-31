from pathlib import Path
import json
import math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

root=Path(__file__).resolve().parent
data=json.loads((root/'Source/authoring-registration.json').read_text('utf-8'))
original=Image.open(root/'Source/original.png').convert('RGBA')
coverage=np.array(original)[:,:,3]
atlas=Image.open(root/'Source/generation/parts-atlas.png').convert('RGBA')
specifications={
    'body':{'matrix':[[0.122,0,24.7],[0,0.095,29],[0,0,1]],'crop':[127,252,403,502],'root':[56,66],'radius':100},
    'head':{'matrix':[[0.127,0,17.9],[0,0.127,-51.04],[0,0,1]],'crop':[111,646,405,947],'root':[54,66],'radius':10},
    'wing-far':{'pairs':[[[747,897],[559,620]],[[43,57],[18,14]]],'crop':[482,590,809,957],'root':[43,57],'radius':100},
    'wing-near':{'pairs':[[[900,900],[1150,640]],[[71,59],[110,22]]],'crop':[850,613,1192,970],'root':[71,59],'radius':100},
    'foot-far':{'pairs':[[[224,1067],[146,1178]],[[43,74],[34,83]]],'crop':[97,1048,263,1196],'root':[43,74],'radius':8},
    'foot-near':{'pairs':[[[397,1064],[395,1209]],[[60,75],[61,89]]],'crop':[305,1049,454,1224],'root':[60,75],'radius':8},
    'tail':{'pairs':[[[815,1076],[1006,1186]],[[70,73],[91,84]]],'crop':[741,1050,1052,1215],'root':[70,73],'radius':7}
}

def pair_matrix(source,target):
    a,b=np.array(source,float)
    c,d=np.array(target,float)
    u=b-a
    v=d-c
    scale=np.linalg.norm(v)/np.linalg.norm(u)
    angle=math.atan2(v[1],v[0])-math.atan2(u[1],u[0])
    rotation=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])*scale
    result=np.eye(3)
    result[:2,:2]=rotation
    result[:2,2]=c-rotation@a
    return result

def normalize(image):
    resized=image.resize((448,360),Image.Resampling.LANCZOS)
    result=Image.new('RGBA',(512,512))
    result.alpha_composite(resized,(32,122))
    return result

for name,specification in specifications.items():
    if 'pairs' in specification:
        matrix=pair_matrix(*specification['pairs'])
        specification['matrix']=matrix.tolist()
    else:
        matrix=np.array(specification['matrix'])
    source=Image.new('RGBA',atlas.size)
    source.paste(atlas.crop(specification['crop']),specification['crop'][:2])
    inverse=np.linalg.inv(matrix)
    registered=source.transform(original.size,Image.Transform.AFFINE,tuple(inverse[:2].reshape(-1)),Image.Resampling.BICUBIC)
    registered.save(root/'Source/Registered'/(name+'.png'))
    radius=specification['radius']
    x,y=specification['root']
    mask=Image.new('L',original.size)
    ImageDraw.Draw(mask).ellipse((x-radius,y-radius,x+radius,y+radius),255)
    hidden=np.array(registered)
    hidden[:,:,3]=np.minimum(hidden[:,:,3],np.array(mask))
    visible=Image.open(root/'Source/Visible'/(name+'.png')).convert('RGBA')
    own=np.array(visible)[:,:,3]
    if name.startswith('wing'):
        root_mask=Image.new('L',original.size)
        ImageDraw.Draw(root_mask).ellipse((x-23,y-23,x+23,y+23),255)
        other=coverage.copy()
        other[own>0]=0
        allowed=np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16
        hidden[:,:,3]*=allowed&(own==0)
        hidden[:,:,3]=np.minimum(hidden[:,:,3],np.array(root_mask))
    elif name.startswith('foot'):
        cutoff=78 if name=='foot-far' else 82
        hidden[np.indices(own.shape)[0]>cutoff,3]=0
        hidden[:,:,3]*=own==0
    elif name=='head':
        other=coverage.copy()
        other[own>0]=0
        allowed=np.array(Image.fromarray(other).filter(ImageFilter.MaxFilter(3)))>16
        hidden[:,:,3]*=allowed&(own==0)
    hidden[hidden[:,:,3]<16,3]=0
    normalize(Image.fromarray(hidden)).save(root/'Parts'/(name+'-hidden.png'))
    normalize(visible).save(root/'Parts'/(name+'-visible.png'))
    complete=Image.fromarray(hidden)
    complete.alpha_composite(visible)
    normalize(complete).save(root/'Parts'/(name+'.png'))

eye_matrix=pair_matrix([[700,323],[790,334]],[[38.3,51.5],[51.5,53]])
inverse=np.linalg.inv(eye_matrix)
closed=atlas.transform(original.size,Image.Transform.AFFINE,tuple(inverse[:2].reshape(-1)),Image.Resampling.BICUBIC)
eye_mask=Image.new('L',original.size)
draw=ImageDraw.Draw(eye_mask)
draw.ellipse((33.3,46.5,43.3,56.5),255)
draw.ellipse((44.5,47.5,58.5,58.5),255)
eye_mask=eye_mask.filter(ImageFilter.GaussianBlur(0.6))
closed_pixels=np.array(closed,float)
original_pixels=np.array(original,float)
for cx,cy,rx,ry in [[38.3,51.5,5,5],[51.5,53,7,5.5]]:
    yy,xx=np.mgrid[0:original.height,0:original.width]
    radius=((xx-cx)/rx)**2+((yy-cy)/ry)**2
    ring=(radius>0.55)&(radius<1.4)&(original_pixels[:,:,:3].mean(2)>135)&(closed_pixels[:,:,:3].mean(2)>150)
    ratio=np.median(original_pixels[ring,:3],0)/np.median(closed_pixels[ring,:3],0)
    select=radius<1.6
    closed_pixels[select,:3]*=np.clip(ratio,0.65,1.1)
closed=Image.fromarray(np.uint8(np.clip(closed_pixels,0,255)))
closed_head=Image.open(root/'Source/Visible/head.png').convert('RGBA')
closed_head.paste(closed,(0,0),eye_mask)
head_alpha=np.array(Image.open(root/'Source/Visible/head.png'))[:,:,3]
closed_array=np.array(closed_head)
closed_array[:,:,3]=head_alpha
normalize(Image.fromarray(closed_array)).save(root/'Parts/head-closed-visible.png')
closed_complete=Image.open(root/'Parts/head-hidden.png').convert('RGBA')
closed_complete.alpha_composite(normalize(Image.fromarray(closed_array)))
closed_complete.save(root/'Parts/head-closed.png')
for name in ['foot-far','foot-near']:
    original_part=np.array(Image.open(root/'Source/Visible'/(name+'.png')).convert('RGBA'))
    yy,xx=np.indices(original_part.shape[:2])
    toe=(yy>=79)|(xx<=39) if name=='foot-far' else yy>=80
    drawing=np.array(Image.open(root/'Source/Registered'/(name+'.png')).convert('RGBA'))
    for section,select,pivot,radius in [['upper',~toe,[43,74] if name=='foot-far' else [60,75],8],['talons',toe,[41,78] if name=='foot-far' else [60,82],3]]:
        visible_part=original_part.copy()
        visible_part[:,:,3]*=select
        mask=Image.new('L',original.size)
        x,y=pivot
        ImageDraw.Draw(mask).ellipse((x-radius,y-radius,x+radius,y+radius),255)
        hidden_part=drawing.copy()
        hidden_part[:,:,3]=np.minimum(hidden_part[:,:,3],np.array(mask))
        if section=='upper':
            hidden_part[:,:,3]*=~toe
        else:
            hidden_part[:,:,3]*=original_part[:,:,3]==0
        hidden_part[hidden_part[:,:,3]<16,3]=0
        complete=Image.fromarray(hidden_part)
        complete.alpha_composite(Image.fromarray(visible_part))
        normalize(complete).save(root/'Parts'/(name+'-'+section+'.png'))
        normalize(Image.fromarray(visible_part)).save(root/'Parts'/(name+'-'+section+'-visible.png'))
        normalize(Image.fromarray(hidden_part)).save(root/'Parts'/(name+'-'+section+'-hidden.png'))
data['generatedParts']=specifications
data['closedEyes']={'matrix':eye_matrix.tolist(),'nativeEllipses':[[33.3,46.5,43.3,56.5],[44.5,47.5,58.5,58.5]]}
(root/'Source/authoring-registration.json').write_bytes(json.dumps(data, **{'indent':2}).replace('\n','\r\n').encode('utf-8'))
