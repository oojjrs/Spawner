from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json, sys, shutil
sys.path.insert(0, 'H:/Spawner/$Trash/NestGrowth03To04-v1/vendor')
import cv2
ROOT=Path('H:/Spawner/AnimationCandidates/SpringNestGrowth03To04V3')
WORK=Path('H:/Spawner/$Trash/SpringNestGrowth03To04-v3-20261031')
def extract_sheet(source, name, target_width):
    image=np.array(Image.open(source).convert('RGBA'))
    height,width=image.shape[:2]
    crops=[]
    bounds=[]
    for k in range(9):
        x0=round((k%3)*width/3);x1=round((k%3+1)*width/3)
        y0=round((k//3)*height/3);y1=round((k//3+1)*height/3)
        cell=image[y0:y1,x0:x1].copy()
        mask=np.uint8(cell[:,:,3]>100)
        n,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8)
        component=1+int(np.argmax(stats[1:,4]))
        x,y,w,h,area=stats[component]
        keep=cv2.dilate(np.uint8(labels==component),np.ones((3,3),np.uint8))>0
        cell[:,:,3]=np.where(keep,np.clip((cell[:,:,3].astype(float)-10)*255/243,0,255),0)
        crops.append(Image.fromarray(cell[y:y+h,x:x+w]))
        bounds.append([int(x),int(y),int(w),int(h)])
    scale=target_width/bounds[-1][2]
    directory=ROOT/'Sources'/name
    directory.mkdir(511,True,True)
    frames=[]
    for k,crop in enumerate(crops):
        w=round(crop.width*scale);h=round(crop.height*scale)
        sprite=crop.resize((w,h),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(512,512))
        frame.alpha_composite(sprite,(round(256-w/2),448-h))
        if name=='phase1':
            a=np.array(frame)
            yy,xx=np.mgrid[:512,:512]
            clear=(yy<280)|((yy<320)&(xx>65)&(xx<428))
            a[clear]=0
            frame=Image.fromarray(a)
            upper=Image.open(ROOT/'Parts'/'old-stationary-underlayer.png').convert('RGBA')
            u=np.array(upper)
            u[yy>=335]=0
            frame.alpha_composite(Image.fromarray(u))
            if k==0:frame=Image.open(ROOT/'Parts'/'old-stationary-underlayer.png').convert('RGBA')
        frame.save(directory/('cel-'+str(k).zfill(2)+'.png'))
        frames.append(frame)
    (directory/'registration.json').write_bytes((json.dumps({'sharedScale':scale,'sourceBounds':bounds,'root':[256,448]})+'\r\n').encode('utf-8'))
    board=Image.new('RGBA',(1536,1536),(26,44,42,255))
    for k,frame in enumerate(frames):board.alpha_composite(frame,((k%3)*512,(k//3)*512))
    board.convert('RGB').save(WORK/(name+'-registered.jpg'))
    return frames
if __name__=='__main__':
    name=sys.argv[1]
    source=Path(sys.argv[2])
    shutil.copy2(source,ROOT/'Sources'/(name+'-generated.png'))
    if name.startswith('phase'):
        frames=extract_sheet(source,name,int(sys.argv[3]))
        frames[-1].save(WORK/(name+'-end.png'))
        print(name, '9 drawn cels registered', frames[-1].getbbox())
    elif name=='clean4':
        frame=Image.open(source).convert('RGBA')
        a=np.array(frame)
        a[:,:,3]=np.where(a[:,:,3]>100,np.minimum(a[:,:,3].astype(float)*255/253,255),0)
        frame=Image.fromarray(a.astype(np.uint8))
        box=frame.getbbox()
        visible=frame.crop(box)
        scale=480/visible.width
        visible=visible.resize((480,round(visible.height*scale)),Image.Resampling.LANCZOS)
        target=Image.new('RGBA',(512,512))
        target.alpha_composite(visible,(16,448-visible.height))
        target.save(ROOT/'Parts'/'new-underlayer.png')
        print(name,box,target.getbbox())
