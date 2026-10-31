from pathlib import Path
from PIL import Image,ImageFilter,ImageChops
from collections import deque
import numpy as np,json

folder = Path(__file__).resolve().parent
settings = json.loads((folder/'rig.json').read_bytes())
atlas = Image.open(folder/'Source/body-poses-drawing.png').convert('RGBA')
mask = np.asarray(atlas)[:,:,3]>=200
components = []
labels = np.zeros(mask.shape,np.int16)
component_id = 0
for y in range(atlas.height):
    for x in np.flatnonzero(mask[y]):
        if not mask[y,x]:
            continue
        component_id += 1
        queue = deque([(int(x),y)])
        mask[y,x] = False
        area = 0
        left,right,top,bottom = int(x),int(x),y,y
        while queue:
            px,py = queue.popleft()
            area += 1
            labels[py,px] = component_id
            left,right,top,bottom = min(left,px),max(right,px),min(top,py),max(bottom,py)
            for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                if 0<=nx<atlas.width and 0<=ny<atlas.height and mask[ny,nx]:
                    mask[ny,nx] = False
                    queue.append((nx,ny))
        if area>3000:
            components.append([left,top,right,bottom,component_id])
components.sort(key=lambda box:(int((box[1]+box[3])/2/(atlas.height/2)),(box[0]+box[2])/2))
if len(components)!=6:
    raise ValueError('Expected six independent connected body cels: '+str(components))
registration = []
for i,box in enumerate(components):
    left,top = max(0,box[0]-3),max(0,box[1]-3)
    right,bottom = min(atlas.width,box[2]+4),min(atlas.height,box[3]+4)
    component_mask = Image.fromarray(np.uint8(labels==box[4])*255).filter(ImageFilter.MaxFilter(5))
    isolated = atlas.copy()
    isolated.putalpha(ImageChops.multiply(isolated.getchannel('A'),component_mask))
    drawing = isolated.crop((left,top,right,bottom))
    scale = settings['bodyScale']
    tx = settings['bodyX']-i%3*(atlas.width/3)*scale
    ty = settings['groundY']-box[3]*scale
    part = drawing.convert('RGBa').transform((512,512),Image.Transform.AFFINE,(1/scale,0,-tx/scale-left,0,1/scale,-ty/scale-top),Image.Resampling.BICUBIC).convert('RGBA')
    part.save(folder/'Source'/('body-cel-'+str(i)+'.png'))
    registration.append({'cel':i,'atlasBounds':box,'scale':[scale,scale],'translation':[tx,ty],'groundY':settings['groundY']})
(folder/'Source/body-registration.json').write_bytes((json.dumps(registration,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))
print(folder.name,'body cels prepared')
