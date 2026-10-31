from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageFilter
from sampling import affine

root=Path(__file__).resolve().parent
spec=json.loads((root/'Source/pose-spec.json').read_text('utf-8'))
placement=np.array(json.loads((root/'Source/placement.json').read_text('utf-8'))['matrix'])
affine(Image.open(root/'Source/original.png').convert('RGBA'),placement,(512,512)).save(root/'Source/reference.png')
(root/'Parts').mkdir(511,True,True)
records=[]
for pose in spec['poses']:
    source=Image.open(root/pose['source']).convert('RGBA')
    assert list(source.size)==spec['rawCanvas']
    pixels=np.array(source)
    r,g,b=pixels[:,:,:3].astype(int).transpose(2,0,1)
    neon=((r-g>90)&(r-b>90))|((g-r>70)&(b-r>70))
    edge=np.array(source.getchannel('A').filter(ImageFilter.MinFilter(21)))<128
    pixels[neon&edge,3]=0
    scale=spec['commonScale']
    matrix=np.diag([scale,scale,1.])
    normalized=affine(Image.fromarray(pixels),matrix,(512,512))
    contact=None
    if pose['contactXRange'] is not None:
        low,high=pose['contactXRange']
        alpha=np.array(normalized)[:,:,3]
        yy,xx=np.where(alpha[:,low:high]>128)
        y=int(yy.max());x=int(np.median(xx[yy==y]))+low
        contact=[x,y]
        matrix[1,2]=pose['contactY']-y
    landmark=pose['beakBridge']
    matrix[0,2]=landmark['target'][0]-landmark['source'][0]
    matrix[1,2]=landmark['target'][1]-landmark['source'][1]
    image=affine(Image.fromarray(pixels),matrix,(512,512))
    path='Parts/pose-'+str(pose['timeMs'])+'.png'
    image.save(root/path)
    records.append({'timeMs':pose['timeMs'],'source':pose['source'],'part':path,'matrix':matrix.tolist(),'sourceContact512':contact,'targetContactY':pose['contactY'],'beakBridge':landmark})
transitions=json.loads((root/'Source/wing-transitions.json').read_text('utf-8'))['transitions']
for transition in transitions:
    source=Image.open(root/transition['source']).convert('RGBA')
    pixels=np.array(source)
    r,g,b=pixels[:,:,:3].astype(int).transpose(2,0,1)
    neon=((r-g>90)&(r-b>90))|((g-r>70)&(b-r>70))
    edge=np.array(source.getchannel('A').filter(ImageFilter.MinFilter(21)))<128
    pixels[neon&edge,3]=0
    drawing=affine(Image.fromarray(pixels),np.array(transition['matrix']),(512,512))
    base_part='Parts/pose-'+str(transition['baseTimeMs'])+'.png'
    base=Image.open(root/base_part).convert('RGBA')
    mask=Image.open(root/transition['mask']).convert('L')
    image=Image.composite(drawing,base,mask)
    part='Parts/pose-'+str(transition['timeMs'])+'.png'
    image.save(root/part)
    records.append({'timeMs':transition['timeMs'],'source':transition['source'],'part':part,'basePart':base_part,'mask':transition['mask'],'matrix':transition['matrix']})
records.sort(key=lambda record:record['timeMs'])
(root/'Source/pose-registration.json').write_bytes(json.dumps({'commonScale':spec['commonScale'],'poses':records},**{'indent':2}).replace('\n','\r\n').encode('utf-8'))
print(json.dumps(records))
