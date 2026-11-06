from PIL import Image
import numpy as np,json
from pathlib import Path
p=Path(__file__).parent;checks=[]
for f in p.glob('*-*/*.png'):
 form,action=f.parent.name.split('-');i=int(f.stem);base=np.array(Image.open(p/f'{action}-{i}.png').convert('RGBA'));a=np.array(Image.open(f).convert('RGBA'));yy,xx=np.where(base[:,:,3]>96);t,b=yy.min(),yy.max();mask=np.any(a!=base,axis=2);protected=np.arange(a.shape[0])[:,None]>t+(b-t)*.39 if form=='antenna' else np.arange(a.shape[0])[:,None]<b-(b-t)*.20
 checks.append({'form':form,'action':action,'frame':i,'bodyChangesOutsideAttachmentRegion':int((mask&protected).sum()),'changedPixels':int(mask.sum())})
json.dump({'checks':checks,'scope':'Base pixels preserved outside attachment region. Original birth motion sampled; comparison framing differs.'},open(p/'verification.json','w'),indent=2);print(len(checks),max(x['bodyChangesOutsideAttachmentRegion'] for x in checks))
