from pathlib import Path
import json
import numpy as np
from PIL import Image
import cv2
ROOT=Path(__file__).resolve().parent.parent
Y,X=np.mgrid[:512,:512].astype(np.float32)

def write(file,data):
    encoder=json.JSONEncoder();encoder.ensure_ascii=False;encoder.indent=2;encoder.item_separator=',';file.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def read_image(im):
    a=np.array(im.convert('RGBA')).astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a

def read(file):return read_image(Image.open(file))

def rgba(a):
    a=np.clip(a,0,1);rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-8);p=np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255));p[p[:,:,3]==0,:3]=0;return Image.fromarray(p)

def over(a,b):return a+b*(1-a[:,:,3:4])

def warp(a,m):
    value=np.clip(cv2.warpAffine(a,np.float32(m[:2]),(512,512),None,cv2.INTER_CUBIC,cv2.BORDER_CONSTANT,(0,0,0,0)),0,1);value[:,:,:3]=np.minimum(value[:,:,:3],value[:,:,3:4]);return value

def seed_mask(a,i):
    rgb=np.array(rgba(a)).astype(float);h=cv2.cvtColor(np.uint8(rgb[:,:,:3]),cv2.COLOR_RGB2HSV);roi=(X>175)&(X<342)&(Y>[184,110,90,95,115,155][i])&(Y<[320,254,232,225,254,300][i]);green=(rgb[:,:,1]>rgb[:,:,0]*1.05)&(rgb[:,:,1]>rgb[:,:,2]*1.45)&(h[:,:,1]>75);gold=(rgb[:,:,0]>rgb[:,:,1]*1.06)&(rgb[:,:,1]>rgb[:,:,2]*1.25)&(rgb[:,:,0]>170)&(Y>[250,172,149,149,178,221][i])&(X>205)&(X<309);m=np.uint8((green|gold)&roi&(a[:,:,3]>.3));m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8));contours=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0];out=np.zeros((512,512),np.uint8)
    for c in contours:
        if cv2.contourArea(c)>80:cv2.drawContours(out,[c],-1,1,-1)
    yy,xx=np.where(out>0);cv2.drawContours(out,[cv2.convexHull(np.column_stack([xx,yy]).astype(np.int32))],-1,1,-1);gm=out*gold;yy,xx=np.where(gm>0);gy,gx=np.where(out*green*(Y<yy.min())>0);return out,{'goldBounds':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())],'leafWidth':int(gx.max()-gx.min()+1)}

def registration(source,reference):
    a=np.array(rgba(source));b=np.array(rgba(reference));roi=np.uint8((X<168)|(X>346)|(Y<95)|(Y>335))*255;sift=cv2.SIFT_create(2600);k1,d1=sift.detectAndCompute(cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2GRAY),roi);k2,d2=sift.detectAndCompute(cv2.cvtColor(b[:,:,:3],cv2.COLOR_RGB2GRAY),roi);pairs=[x for x,y in cv2.BFMatcher().knnMatch(d1,d2,2) if x.distance<.72*y.distance];p=np.float32([k1[m.queryIdx].pt for m in pairs]);q=np.float32([k2[m.trainIdx].pt for m in pairs]);m,inliers=cv2.estimateAffinePartial2D(p,q,None,cv2.RANSAC,2.2,5000,.995,10);good=inliers[:,0]>0;error=np.linalg.norm(p@m[:,:2].T+m[:,2]-q,None,1)
    if good.sum()<15 or np.median(error[good])>1.6:raise RuntimeError('Static architecture does not register')
    return m,{'inliers':int(good.sum()),'medianPixels':float(np.median(error[good])),'matrix':m.tolist()}

def plates():
    report=[]
    for i in [2,3]:
        ref=read(ROOT/'References'/('K'+str(i)+'.png'));raw=rgba(read(ROOT/'Sources'/('empty-K'+str(i)+'.png'))).resize((512,512),Image.Resampling.LANCZOS);src=read_image(raw);m,reg=registration(src,ref);empty=warp(src,m);mask,info=seed_mask(ref,i);remove=cv2.dilate(mask,np.ones((7,7),np.uint8)).astype(np.float32);remove=cv2.GaussianBlur(remove,(0,0),.65);back=ref*(1-remove[:,:,None])+empty*remove[:,:,None];rgba(back).save(ROOT/'Parts'/('empty-'+str(i)+'.png'));report.append({'key':i,'seed':info,'registration':reg})
    return report
