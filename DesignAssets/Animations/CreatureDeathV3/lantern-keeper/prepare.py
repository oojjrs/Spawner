from pathlib import Path
from PIL import Image,ImageFilter
import json
import numpy as np

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
(folder/'Parts').mkdir(511,True,True)
for entry in rig['registrations']:
    source=Image.open(folder/entry['source']).convert('RGBA')
    pixels=np.array(source)
    yy,xx=np.mgrid[:pixels.shape[0],:pixels.shape[1]]
    if entry['crop'] is not None:
        x0,y0,x1,y1=entry['crop']
        pixels[(xx<x0)|(xx>=x1)|(yy<y0)|(yy>=y1)]=0
    matrix=np.array(entry['matrix']+[[0,0,1]],float)
    inverse=np.linalg.inv(matrix)[:2].flatten().tolist()
    if 'splitX' in entry:
        for name,keep in [('far',xx<entry['splitX']),('near',xx>=entry['splitX'])]:
            layer=pixels.copy()
            layer[~keep]=0
            image=Image.fromarray(layer).transform((512,512),Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC)
            image.save(folder/(entry['output']+'-'+name+'.png'))
    else:
        image=Image.fromarray(pixels).transform((512,512),Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC)
        if 'restoreBody' in entry:
            data=np.array(image)
            original=np.array(Image.open(folder/entry['restoreBody']).convert('RGBA'))
            support=np.array(image.getchannel('A').filter(ImageFilter.MaxFilter(5)))>16
            gy,gx=np.mgrid[:512,:512]
            restore=support&(original[:,:,3]>0)&(((gx<300)&(gy>350))|((gx>=300)&(gy>330)))
            data[restore]=original[restore]
            image=Image.fromarray(data)
        image.save(folder/entry['output'])
