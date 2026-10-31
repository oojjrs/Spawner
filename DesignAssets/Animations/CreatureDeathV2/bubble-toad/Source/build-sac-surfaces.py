from pathlib import Path
from PIL import Image
import numpy as np,json,sys

r=Path(r'H:/Spawner');sys.path.insert(0,str(r/'$Trash/creature-idle-studies-v1/python-packages'));import cv2
f=r/'DesignAssets/Animations/CreatureDeathV2/bubble-toad';rig=json.loads((f/'rig.json').read_bytes());out=f/'Source/SacSurfaces';out.mkdir(0o777,True,True)
a=np.asarray(Image.open(f/'Source/CleanAttachments/sac.png').convert('RGBA')).astype(float);b=np.asarray(Image.open(f/'Source/CleanAttachments/sac-folded.png').convert('RGBA')).astype(float)

def sdf(alpha):
    binary=np.uint8(alpha>=127)
    return cv2.distanceTransform(binary,cv2.DIST_L2,5)-cv2.distanceTransform(1-binary,cv2.DIST_L2,5)

def extended(image):
    mask=np.uint8(image[:,:,3]>=127)
    inside=cv2.erode(mask,np.ones((5,5),np.uint8))
    distance,labels=cv2.distanceTransformWithLabels(1-inside,cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
    yy,xx=np.where(inside>0);lookup=image[yy,xx,:3]
    result=lookup[np.maximum(labels-1,0)]
    return result

da,db=sdf(a[:,:,3]),sdf(b[:,:,3]);pa=extended(a);pb=extended(b)
for i,time in enumerate(rig['timesMs']):
    v=max(0,min(1,(time-180)/900));v=v*v*(3-2*v);alpha=np.clip((da*(1-v)+db*v)+.5,0,1)*255;rgb=pa*(1-v)+pb*v;edge=np.clip((da*(1-v)+db*v)/1.2,0,1);rgb*=.65+.35*edge[:,:,None];result=np.dstack((rgb,alpha));result[result[:,:,3]==0]=0;Image.fromarray(np.uint8(np.clip(result,0,255)+.5)).save(out/('%04d.png'%time))
for p in rig['parts']:
    if p['name']=='head':p['translation']=[0,64]
rig['correctiveSacSurfaces']={'folder':'Source/SacSurfaces','sourceA':'Source/CleanAttachments/sac.png','sourceB':'Source/CleanAttachments/sac-folded.png','outlineInterpolation':'signed-distance interpolation in one fixed bind rectangle; premultiplied-color interior','changesShape':True,'rigidPartScaling':False}
(f/'rig.json').write_bytes((json.dumps(rig,**{'indent':2})+'\n').replace('\n','\r\n').encode())
p=f/'render.py';s=p.read_text('utf-8');s=s.replace("                image=Image.blend(image,folded,progress(time,180))","                image=Image.open(FOLDER/'Source/SacSurfaces'/('%04d.png'%time)).convert('RGBA')")
p.write_bytes(s.replace('\n','\r\n').encode())
