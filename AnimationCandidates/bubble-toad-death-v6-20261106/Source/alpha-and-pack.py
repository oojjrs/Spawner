from PIL import Image,ImageDraw
from pathlib import Path
import numpy as np
from scipy import ndimage
import shutil,json
out=Path('art-review/bubble-toad-death-v6-20261106'); tmp=Path('$Trash/toad-death-review-v4')
a=Image.open('generated_images/exec-1cc36d3f-0f47-4f24-b6fa-acf070a54f3b.png').convert('RGB')
frames=[]
for i in range(16):
 x=i%4;y=i//4
 cell=a.crop((round(x*a.width/4),round(y*a.height/4),round((x+1)*a.width/4),round((y+1)*a.height/4)))
 rgb=np.asarray(cell).astype(float)
 core=(255-rgb.min(2))>55
 labels,n=ndimage.label(core); counts=np.bincount(labels.ravel());counts[0]=0
 mask=ndimage.binary_fill_holes(labels==counts.argmax())
 interior=ndimage.binary_erosion(mask)
 alpha=mask.astype(float)
 edge=mask & ~interior
 alpha[edge]=np.clip((255-rgb[edge].min(1))/150,.0,1)
 rgb=np.clip((rgb-255*(1-alpha[:,:,None]))/np.maximum(alpha[:,:,None],.001),0,255)
 rgba=np.dstack((rgb,np.round(alpha*255))).astype('uint8');rgba[~mask]=0
 im=Image.fromarray(rgba).resize((512,512),Image.Resampling.LANCZOS)
 im=im.resize((492,492),Image.Resampling.LANCZOS)
 aa=np.asarray(im)[:,:,3]; yy,xx=np.where(aa>32)
 registered=Image.new('RGBA',(512,512));registered.alpha_composite(im,(448-int(xx.max()),448-int(yy.max())))
 im=registered
 frames.append(im)
for i,im in enumerate(frames):im.save(out/'Frames'/f'{i:03}.png')
contact=Image.new('RGBA',(2048,2048))
for i,im in enumerate(frames):contact.alpha_composite(im,((i%4)*512,(i//4)*512))
contact.save(out/'death.png')
preview=Image.new('RGB',(1536,512),(38,59,55))
for j,i in enumerate([13,14,15]):preview.paste(frames[i],(j*512,0),frames[i])
preview.save(tmp/'end-comparison-v6.jpg')
durations=[300,90,100,100,90,80,80,80,90,90,90,90,90,90,90,1200]
lines=[]
for i,im in enumerate(frames):
 bg=Image.new('RGB',(512,512),(38,59,55));bg.paste(im,(0,0),im)
 ImageDraw.Draw(bg).text((15,15),'BUBBLE TOAD / DEATH / 1x',fill='white')
 p=tmp/f'v6-{i:03}.png';bg.save(p)
 lines.extend([f"file '{p.resolve()}'",f'duration {durations[i]/1000}'])
lines.append(f"file '{p.resolve()}'");(tmp/'concat-v6.txt').write_text('\n'.join(lines)+'\n')
meta={'name':'bubble-toad','action':'death','frameSize':512,'columns':4,'frameCount':16,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'pivotX':256,'pivotY':448,'approvalStatus':'review-candidate','approvedFinalPoseReferencePreserved':True,'allFramesCoherentlyRedrawn':True}
(out/'death.json').write_bytes((json.dumps(meta,ensure_ascii=False,indent=2)+'\n').replace('\n','\r\n').encode())
print([(i,im.getbbox()) for i,im in enumerate(frames)])