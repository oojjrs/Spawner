from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageFilter
from sampling import affine

root=Path(__file__).resolve().parent
source=root/'Source'
parts=root/'Parts'
parts.mkdir(511,True,True)
record=json.loads((source/'legs-edit-registration.json').read_text('utf-8'))
target=Image.open(source/record['target']).convert('RGBA')
paint=affine(Image.open(source/record['source']).convert('RGBA'),np.array(record['matrix']),(1254,1254))
mask=Image.open(source/record['mask']).convert('L').filter(ImageFilter.GaussianBlur(record['maskEdgeBlurPx']))
Image.composite(paint,target,mask).save(parts/'bridge-120.png')
records=json.loads((source/'followthrough-registration.json').read_text('utf-8'))
for time,record in records.items():
    target=Image.open(source/record['fixedBody']).convert('RGBA')
    paint=affine(Image.open(source/record['source']).convert('RGBA'),np.array(record['matrix']),(1254,1254))
    mask=Image.open(source/record['mask']).convert('L').filter(ImageFilter.GaussianBlur(1))
    Image.composite(paint,target,mask).save(parts/str('follow-'+time+'.png'))
