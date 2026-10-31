from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw
from bloom_assets import read,read_image,rgba,warp,registration,over,write,cv2,X,Y,plates
ROOT=Path(__file__).resolve().parent.parent

def clean_source(path):
    im=Image.open(path).convert('RGBA');a=np.array(im);core=np.uint8(a[:,:,3]>240);support=cv2.dilate(core,np.ones((3,3),np.uint8));v=a.astype(np.float32)/255;v[:,:,3]=np.minimum(v[:,:,3]*255/254,1)*support;v[:,:,:3]*=v[:,:,3:4];return v

def cell_parts(kind):
    v=clean_source(ROOT/'Sources'/('flower-'+kind+'.png'));n,l,s,c=cv2.connectedComponentsWithStats(np.uint8(v[:,:,3]>.5),8);groups=[[] for i in range(6)]
    for j in range(1,n):
        if s[j,4]>300:
            x,y=c[j];groups[int(y//512)*3+int(x//512)].append(j)
    result=[]
    for i,ids in enumerate(groups):
        x=(i%3)*512;y=(i//3)*512;part=v*np.isin(l,ids)[:,:,None];result.append(part[y:y+512,x:x+512])
    return result

def floating(part):
    n,l,s,c=cv2.connectedComponentsWithStats(np.uint8(part[:,:,3]>.5),8);ids=[j for j in range(1,n) if s[j,4]>200 and c[j,1]<250];mask=cv2.dilate(np.uint8(np.isin(l,ids)),np.ones((3,3),np.uint8));return part*mask[:,:,None],part*(1-mask[:,:,None])

def prepare():
    plates();report={};ref0=read(ROOT/'References'/'K0.png');ref4=read(ROOT/'References'/'K4.png')
    raw=read_image(Image.open(ROOT/'Sources'/'bare-frame-0.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS));m,r=registration(raw,ref0);front0=warp(raw,m);rgba(front0).save(ROOT/'Parts'/'takeoff-frame.png')
    raw=read_image(Image.open(ROOT/'Sources'/'architecture-back4.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS));yy,xx=np.where(raw[:,:,3]>.8);cx=(xx.min()+xx.max())/2;s=411/(yy.max()-yy.min());m=np.array([[s,0,256-s*cx],[0,s,37-s*yy.min()],[0,0,1]],float);r4={'method':'crown-ground-uniform-registration','sourceBounds':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())],'matrix':m.tolist()};back4=warp(raw,m);rgba(back4).save(ROOT/'Parts'/'landing-back.png')
    v=clean_source(ROOT/'Sources'/'architecture-front4.png');m=np.array([[.347,0,41],[0,.347,34],[0,0,1]],float);front4=warp(v,m);rgba(front4).save(ROOT/'Parts'/'landing-front.png');report['architecture']={'takeoff':r,'landingBack':r4,'landingFrontMatrix':m.tolist()}
    takeoff_matrix=np.array([[.80,0,51],[0,.80,62],[0,0,1]],float);takeoff_report={'matrix':takeoff_matrix.tolist()}
    for kind in ['takeoff','landing']:
        board=Image.new('RGBA',(1536,1024),'#edf0e7');records=[]
        for i,part in enumerate(cell_parts(kind)):
            if kind=='takeoff':
                m=takeoff_matrix;r=takeoff_report;flower=warp(part,m);frame=over(front0,flower)
            else:
                tip=[176,176,176,132,135,132][i];m=np.array([[.60,0,102],[0,.60,156-.60*tip],[0,0,1]],float);r={'matrix':m.tolist()};flower=warp(part,m)*np.uint8(Y<320)[:,:,None];frame=over(front4,over(flower,back4))
            rgba(flower).save(ROOT/'Parts'/(kind+'-complete-flower-'+str(i)+'.png'));rgba(frame).save(ROOT/'Cels'/(kind+'-'+str(i)+'.png'));board.alpha_composite(rgba(frame),((i%3)*512,(i//3)*512));records.append(r)
        board.convert('RGB').save(ROOT/(kind+'-complete-review.png'));report[kind]=records
    seed,flower=floating(cell_parts('takeoff')[5]);seed=warp(seed,takeoff_matrix);flower=warp(flower,takeoff_matrix);rgba(over(front0,flower)).save(ROOT/'Parts'/'hover-1.png');rgba(seed).save(ROOT/'Parts'/'floating-seed.png')
    for name,mask in [('seed-body',(Y>=160)|((X>=250)&(X<=262)&(Y>=143))),('seed-leaf-left',(X<=258)&(Y<=158)),('seed-leaf-right',(X>=254)&(Y<=158))]:rgba(seed*mask[:,:,None]).save(ROOT/'Parts'/(name+'.png'))
    seed,flower=floating(cell_parts('landing')[0]);m=np.array([[.60,0,102],[0,.60,50.4],[0,0,1]],float);rgba(over(front4,over(warp(flower,m)*np.uint8(Y<320)[:,:,None],back4))).save(ROOT/'Parts'/'hover-4.png');rgba(warp(seed,m)).save(ROOT/'Parts'/'landing-seed.png')
    for i in [2,3]:rgba(read(ROOT/'Parts'/('empty-'+str(i)+'.png'))).save(ROOT/'Parts'/('hover-'+str(i)+'.png'))
    write(ROOT/'complete-preparation.json',report);print(json.dumps(report))

if __name__=='__main__':prepare()
