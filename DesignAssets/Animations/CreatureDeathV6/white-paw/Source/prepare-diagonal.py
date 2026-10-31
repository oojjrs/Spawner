from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import json

folder=Path(__file__).resolve().parent
spec=json.loads((folder/'diagonal-registration.json').read_text('utf-8'))
im=Image.open(folder/'Raw'/'tail-diagonal.png').convert('RGBA')
mask=im.getchannel('A').point(lambda a: 255 if a>=20 else 0)
ImageDraw.floodfill(mask,(600,800),128,None,0)
coverage=mask.point(lambda a: 255 if a==128 else 0).filter(ImageFilter.MaxFilter(5))
im.putalpha(ImageChops.multiply(im.getchannel('A'),coverage))
s=spec['scale']
x,y=spec['translation']
m=(1/(s*4),0,-x/s,0,1/(s*4),-y/s)
result=im.convert('RGBa').transform((2048,2048),Image.Transform.AFFINE,m,Image.Resampling.BICUBIC).resize((512,512),Image.Resampling.LANCZOS).convert('RGBA')
result.save(folder/'Frames'/'004-diagonal.png')
