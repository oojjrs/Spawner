from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
folder=Path('H:/Spawner/DesignAssets/Animations/CreatureHurtV7/snare-vine')
size=424
seed=np.asarray(Image.open(folder/'Source/seed.png').convert('RGBA')).astype(np.float64)
native=np.asarray(Image.open(folder/'Source/hidden-surfaces-generated.png').convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)).astype(np.float64)
yy,xx=np.indices((size,size))
rows=np.arange(290,351)
right=np.asarray([np.flatnonzero(seed[y,:,3]>128).max()for y in rows])
coeff=np.polyfit(rows-325,right,3)
ycurve=np.arange(max(270,int(np.flatnonzero(np.any(native[:,:,3]>128,**{'axis':1}))[0])),331)
native_right=np.asarray([np.flatnonzero(native[y,:,3]>128).max()for y in ycurve])
t=np.clip((ycurve-270)/20,0,1);t=t*t*(3-2*t)
curve=native_right*(1-t)+np.polyval(coeff,ycurve-325)*t
valid=(seed[:,:,3]>240)&(yy>=282)&(yy<=376)&(xx>=129)&(xx<=274)&~((xx>188)&(yy<328))&~(((xx-139)**2+(yy-322)**2<120)|((xx-190)**2+(yy-334)**2<150))
def gaussian(a,sigma):
 radius=int(sigma*3);k=np.exp(-(np.arange(-radius,radius+1)/sigma)**2/2);k/=k.sum()
 value=np.apply_along_axis(lambda line:np.convolve(line,k,'same'),0,a)
 return np.apply_along_axis(lambda line:np.convolve(line,k,'same'),1,value)
weight=gaussian(valid.astype(float),17)
fill=np.stack([gaussian(seed[:,:,c]*valid,17)/np.maximum(weight,1e-9)for c in range(3)],2)
residual=np.stack([native[:,:,c]-gaussian(native[:,:,c],4)for c in range(3)],2)
fill=np.clip(fill+np.clip(residual*.15,-5,5),0,255)
mask=Image.new('L',(size,size));draw=ImageDraw.Draw(mask)
draw.rectangle((230,270,290,330),255)
mask.save(folder/'Masks/shoulder-contour-restoration.png')
for expression in ['open','half','closed']:
 path=folder/('Source/body-'+expression+'.png')
 a=np.asarray(Image.open(path).convert('RGBA')).copy()
 for y,edge in zip(ycurve,curve):
  coverage=np.clip(edge+.5-np.arange(230,size),0,1)
  alpha=np.uint8(np.rint(coverage*255))
  needed=(alpha>a[y,230:,3])|((a[y,230:,0]==0)&(alpha>0))
  row=a[y,230:]
  row[needed,:3]=np.uint8(np.rint(fill[y,230:][needed]))
  row[:,3]=alpha
 a[a[:,:,3]<8]=0
 Image.fromarray(a).save(path)
config=json.loads((folder/'rig.json').read_text('utf-8'))
config['hiddenBulbRestoration']['shoulderContour']={'mask':'Masks/shoulder-contour-restoration.png','nativeBodySource':'Source/hidden-surfaces-generated.png','originalVisibleContourRows':[290,350],'nativeCapBlendRows':[270,290],'restoredContourPoints':[[int(y),round(float(x),4)]for y,x in zip(ycurve,curve)],'method':'Single continuous opaque skin surface using original exposed bulb contour and complete native hidden cap; removed old leaf-cut alpha branches and detached skin pixels.'}
(folder/'rig.json').write_bytes((json.dumps(config,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))
body=Image.open(folder/'Source/body-open.png');view=Image.new('RGB',body.size,(30,45,36));view.paste(body,(0,0),body)
view.crop((240,265,280,325)).resize((400,600),Image.Resampling.NEAREST).save('H:/Spawner/$Trash/creature-hurt-rest13-20261030/wild/shoulder-repaired-native.png')
print('restored continuous shoulder contour',len(curve))
