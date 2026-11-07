from PIL import Image, ImageDraw
from pathlib import Path
import json, numpy as np
from scipy.ndimage import label
ROOT=Path(__file__).resolve().parent
REPO=Path('/workspace/scratch/cdf786db13f9/Spawner')
def bbox(im):return im.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()
def desc(im):
 b=bbox(im); a=np.array(im).astype('int32'); r,g,blue,al=[a[:,:,i] for i in range(4)]; ys,xs=np.indices(r.shape)
 mask=(al>=128)&(r>120)&(g>120)&(abs(r-g)<27)&((g-blue)<52)&((g-blue)>-10)&(ys>b[1]+(b[3]-b[1])*.45)
 labs,_=label(mask); areas=np.bincount(labs.ravel()); areas[0]=0; ix=areas.argmax(); yy,xx=np.where(labs==ix); bb=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
 return {'bboxAlpha16':b,'width':b[2]-b[0],'height':b[3]-b[1],'heightPerWidth':(b[3]-b[1])/(b[2]-b[0]),'approxIvoryBodyColorBounds':bb,'approxIvoryBodyHeightPerCapWidth':(bb[3]-bb[1])/(b[2]-b[0])}
idle=Image.open(ROOT/'source.png').convert('RGBA');oldsheet=Image.open(REPO/'AnimationCandidates/spore-defensive-attack-fullbody-v1-20261107/carapace/spore-carapace-counterattack-v1-sheet.png').convert('RGBA');sheet=Image.open(ROOT/'spore-carapace-counterattack-v2-sheet.png').convert('RGBA');frames=[sheet.crop((i%4*512,i//4*512,i%4*512+512,i//4*512+512)) for i in range(16)]; old=oldsheet.crop((0,0,512,512));objects=[idle,old,frames[0],frames[-1]];labels=['Approved idle','Previous attack F0','Redrawn attack F0','Redrawn attack F15'];items=[desc(o) for o in objects]; print(json.dumps(list(zip(labels,items)),indent=2));out=Image.new('RGB',(1400,360),'#233039');draw=ImageDraw.Draw(out)
for i,(im,name,data) in enumerate(zip(objects,labels,items)):
 b=bbox(im); crop=im.crop(b); scale=280/(b[2]-b[0]); crop=crop.resize((280,round(crop.height*scale)),Image.Resampling.LANCZOS);x=i*350+35;y=300-crop.height;out.paste(crop,(x,y),crop);draw.line((i*350,300,(i+1)*350,300),fill='#818c92');draw.text((i*350+15,15),name,fill='white');draw.text((i*350+15,36),f"H/W {data['heightPerWidth']:.4f}",fill='white')
out.save(ROOT/'qa/proportion-before-after.jpg',quality=97)
contact=Image.new('RGB',(1560,735),'#233039');draw=ImageDraw.Draw(contact); poses=[idle]+frames+[idle];names=['REF']+[f'{i}' for i in range(16)]+['REF RETURN']
for i,(im,name) in enumerate(zip(poses,names)):
 b=bbox(im); scale=155/(items[0]['width'] if i in(0,17) else items[2]['width']); z=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);bb=bbox(z);x=(i%6)*260+130-round((bb[0]+bb[2])/2);y=(i//6)*245+222-bb[3];contact.paste(z,(x,y),z);draw.text((i%6*260+6,i//6*245+5),name,fill='white');draw.line((i%6*260,i//6*245+223,(i%6+1)*260,i//6*245+223),fill='#818c92')
contact.save(ROOT/'qa/normalized-all-frames.jpg',quality=97)
result={'method':'Alpha16 full silhouette at equal first-pose cap width. Ivory diagnostic uses RGB connected component color threshold and is an approximate diagnostic, not segmentation or source editing. No anisotropic scaling applied.','references':dict(zip(labels,items)),'oldNeutralHeightRelativeToIdle':items[1]['heightPerWidth']/items[0]['heightPerWidth'],'newNeutralHeightRelativeToIdle':items[2]['heightPerWidth']/items[0]['heightPerWidth'],'newFinalHeightRelativeToIdle':items[3]['heightPerWidth']/items[0]['heightPerWidth'],'allFrames':[desc(f) for f in frames],'sourceFacingDifferentIgnored':True,'browserRuntimeTest':False}
assert 0.95<result['newNeutralHeightRelativeToIdle']<1.05
assert 0.95<result['newFinalHeightRelativeToIdle']<1.05
(ROOT/'proportion-audit.json').write_text(json.dumps(result,indent=2))
