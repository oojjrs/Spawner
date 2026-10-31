from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageFilter
import json,numpy as np

folder=Path(__file__).resolve().parent
spec=json.loads((folder/'construction.json').read_text('utf-8'))
size=spec['frameSize']

def connected(image,seed):
    mask=image.getchannel('A').point(lambda value:255 if value>=40 else 0)
    ImageDraw.floodfill(mask,tuple(seed),128,None,0)
    coverage=mask.point(lambda value:255 if value==128 else 0).filter(ImageFilter.MaxFilter(5))
    result=image.copy()
    result.putalpha(ImageChops.multiply(result.getchannel('A'),coverage))
    return Image.alpha_composite(Image.new('RGBA',result.size),result)

body=Image.open(folder/spec['bodySource']).convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)
connected(body,spec['bodySeed']).save(folder/spec['bodyOutput'])
for part in spec['parts']:
    source=connected(Image.open(folder/part['source']).convert('RGBA'),part['seed'])
    inverse=np.linalg.inv(np.vstack((part['matrix'],[0,0,1])))
    result=source.convert('RGBa').transform((size,size),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')
    Image.alpha_composite(Image.new('RGBA',(size,size)),result).save(folder/part['output'])
