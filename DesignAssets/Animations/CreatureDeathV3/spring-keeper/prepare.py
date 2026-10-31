from pathlib import Path
from PIL import Image
import json
import numpy as np

folder=Path(__file__).resolve().parent
registration=json.loads((folder/'Source/collapse-registration.json').read_text('utf-8'))
(folder/'Parts').mkdir(511,True,True)
for entry in registration['entries']:
    image=Image.open(folder/entry['source']).convert('RGBA')
    data=np.array(image)
    yy,xx=np.mgrid[:data.shape[0],:data.shape[1]]
    x0,y0,x1,y1=entry['crop']
    data[(xx<x0)|(xx>=x1)|(yy<y0)|(yy>=y1)]=0
    matrix=np.array(entry['matrix']+[[0,0,1]],float)
    image=Image.fromarray(data).transform((512,512),Image.Transform.AFFINE,np.linalg.inv(matrix)[:2].flatten().tolist(),Image.Resampling.BICUBIC)
    image.save(folder/entry['output'])
Image.open(folder/('Parts/collapse-'+str(registration['selectedContactCel'])+'.png')).save(folder/registration['contactBody'])
