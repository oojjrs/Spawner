from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops
import numpy as np,json

folder=Path(__file__).resolve().parent.parent
original=Image.open(folder/'Source/tail-visible.png').convert('RGBA')
raw=Image.open(folder/'Source/tail-root-drawing.png').convert('RGBA')
source=np.array([[715,585,1],[1160,740,1],[1010,925,1]],float)
target=np.array([[294,238],[470,295],[430,375]],float)
affine=np.linalg.solve(source,target).T
inverse=np.linalg.inv(np.vstack((affine,[0,0,1])))
patch=raw.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')
mask=Image.new('L',(512,512))
ImageDraw.Draw(mask).polygon([(316,305),(361,298),(395,333),(400,378),(356,382),(326,357)],255)
mask=mask.filter(ImageFilter.GaussianBlur(3))
mask=ImageChops.multiply(mask,Image.open(folder/'Source/reference.png').convert('RGBA').getchannel('A'))
patch.putalpha(ImageChops.multiply(patch.getchannel('A'),mask))
tail=Image.alpha_composite(patch,original)
tail=Image.alpha_composite(Image.new('RGBA',(512,512)),tail)
tail.save(folder/'Parts/tail.png')
(folder/'root-registration.json').write_bytes((json.dumps({'matrix':affine.tolist(),'mask':[[316,305],[361,298],[395,333],[400,378],[356,382],[326,357]]})+'\r\n').encode('utf-8'))