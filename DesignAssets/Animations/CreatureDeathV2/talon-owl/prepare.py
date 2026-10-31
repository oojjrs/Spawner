from pathlib import Path
from PIL import Image
import json
import numpy as np
from collections import deque

folder = Path(__file__).resolve().parent
atlas = Image.open(folder/'Source/complete-parts-v2.png').convert('RGBA')
parts = [
    ('body',0,(163,216,329,377)),
    ('head',1,(138,98,323,265)),
    ('wing-near',2,(251,220,392,390)),
    ('wing-far',3,(147,229,208,343)),
    ('leg-near-upper',4,(235,335,282,381)),
    ('leg-near-lower',5,(217,362,299,407)),
    ('leg-far-upper',6,(184,335,230,379)),
    ('leg-far-lower',7,(166,358,231,401)),
    ('tail',8,(283,335,381,423))
]
mask = np.asarray(atlas)[:,:,3]>24
components = []
for y in range(atlas.height):
    for x in np.flatnonzero(mask[y]):
        if not mask[y,x]:
            continue
        queue = deque([(int(x),y)])
        mask[y,x] = False
        area = 0
        left,right,top,bottom = int(x),int(x),y,y
        while queue:
            px,py = queue.popleft()
            area += 1
            left,right,top,bottom = min(left,px),max(right,px),min(top,py),max(bottom,py)
            for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                if 0<=nx<atlas.width and 0<=ny<atlas.height and mask[ny,nx]:
                    mask[ny,nx] = False
                    queue.append((nx,ny))
        if area>2000:
            components.append((max(0,left-2),max(0,top-2),min(atlas.width,right+3),min(atlas.height,bottom+3)))
components.sort(key=lambda box:(int(((box[1]+box[3])/2)/(atlas.height/3)),(box[0]+box[2])/2))
if len(components)!=9:
    raise ValueError('Expected nine complete independent attachments')
rects = components
registration = []
for name,index,destination in parts:
    source = atlas.crop(rects[index])
    bounds = source.getchannel('A').point(lambda alpha: 255 if alpha>24 else 0).getbbox()
    source = source.crop(bounds)
    source.save(folder/'Source'/('attachment-'+name+'.png'))
    target = Image.new('RGBA',(512,512))
    target.alpha_composite(source.resize((destination[2]-destination[0],destination[3]-destination[1]),Image.Resampling.LANCZOS),destination[:2])
    target.save(folder/'Parts'/(name+'.png'))
    registration.append({'part':name,'atlasRect':rects[index],'sourceBounds':bounds,'bindRect':destination,'runtimeScale':[1,1]})
encoder = json.JSONEncoder()
encoder.indent = 2
(folder/'Source/registration.json').write_bytes((encoder.encode(registration).replace('\n','\r\n')+'\r\n').encode('utf-8'))
