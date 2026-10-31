import json
import math
import numpy as np
from PIL import Image

def load_rear(folder):
    poses=json.loads((folder/'poses.json').read_text('utf-8'))
    layers={name:Image.open(folder/str(name+'.png')).convert('RGBA') for name in ['body','tail','hindleg']}
    layers['mask']=Image.open(folder/'rear-mask.png').convert('L')
    return poses,layers

def apply_rear(frame,index,rear):
    if index==0:return frame
    config,layers=rear
    pose=config['frames'][index]
    angle=math.radians(pose['degrees'])
    c,s=math.cos(angle),math.sin(angle)
    pivot=np.asarray(config['pivot'],float)
    linear=np.array([[c,-s],[s,c]])
    matrix=np.eye(3)
    matrix[:2,:2]=linear
    matrix[:2,2]=pivot-linear@pivot+pose['translation']
    inverse=tuple(np.linalg.inv(matrix)[:2].ravel())
    body=layers['body'].convert('RGBa').transform(frame.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).convert('RGBA')
    rendered=layers['tail'].convert('RGBa').transform(frame.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).convert('RGBA')
    rendered.alpha_composite(body)
    rendered.alpha_composite(layers['hindleg'])
    mask=layers['mask'].transform(frame.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC)
    return Image.composite(rendered,frame,mask)