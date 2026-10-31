from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from contour import profile, bg
import cv2

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Sources'
PARTS = SOURCE / 'Parts'
SCRATCH = ROOT.parent / '$Trash' / 'SporeStabilizedV1'
YY, XX = np.mgrid[:640,:640].astype(np.float32)
SEAMS = {
    'small-upright': [[192,483],[205,475],[222,473],[240,461],[260,456],[279,459],[296,466],[319,470],[339,470],[358,464],[378,461],[397,466],[418,475],[445,483]],
    'small-halfclosed': [[185,500],[200,511],[218,523],[230,527],[240,511],[255,511],[277,519],[299,525],[320,526],[340,522],[362,515],[382,505],[396,505],[409,517],[420,525],[437,512],[455,496]],
    'adult-upright': [[127,410],[154,409],[182,402],[219,385],[247,384],[277,392],[313,402],[347,401],[374,393],[402,387],[433,390],[464,399],[492,406],[511,410]],
    'adult-halflift': [[138,445],[160,437],[185,432],[217,420],[246,419],[276,427],[311,435],[347,435],[374,428],[403,420],[430,419],[455,426],[481,434],[502,444]]
}


def read(name):
    return np.array(Image.open(SOURCE / (name+'.png')).convert('RGBA'))


def body_mask(a,closed):
    rgb = a[:,:,:3].astype(np.float32)
    r,g,b = rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    seed = np.uint8((a[:,:,3]>100)&(r-g<48)&(g>90)&(g>b*1.035))
    count,labels,stats,centers = cv2.connectedComponentsWithStats(seed,8)
    if closed:
        ids = [k for k in range(1,count) if centers[k,1]>520 and stats[k,4]>3]
    else:
        choices = [(int(stats[k,4]),k) for k in range(1,count) if centers[k,1]>480]
        ids = [max(choices)[1]]
    mask = np.uint8(np.isin(labels,ids))
    contours,hierarchy = cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(mask,contours,-1,1,cv2.FILLED)
    radius=9 if closed else 5
    mask = cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(radius,radius)))
    return mask


def extract(name):
    a = read(name)
    mask = body_mask(a,name.endswith('rest'))
    body = a.copy()
    body[mask==0]=0
    if name in SEAMS:
        points = np.array(SEAMS[name])
        seam = np.interp(np.arange(640),points[:,0],points[:,1])
        seam = cv2.GaussianBlur(seam.astype(np.float32)[None,:],(7,1),1.2)[0]
        rgb=a[:,:,:3].astype(np.float32)
        seed=np.uint8((rgb[:,:,0]-rgb[:,:,1]>38)&(rgb[:,:,0]>165)&(rgb[:,:,1]>85)&(a[:,:,3]>100)&(YY<=seam[None,:]+6))
        count,labels,stats,centers=cv2.connectedComponentsWithStats(seed,8)
        main=1+int(np.argmax(stats[1:,4]))
        capmask=np.uint8(labels==main)
        contours,hierarchy=cv2.findContours(capmask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(capmask,contours,-1,1,cv2.FILLED)
        capmask=cv2.dilate(capmask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
        capmask[(rgb[:,:,0]-rgb[:,:,1]<48)&(rgb[:,:,1]>100)&(YY>seam[None,:]-8)]=0
        cap = a.copy()
        cap[capmask==0]=0
    else:
        cap = a.copy()
        cap[mask>0]=0
        seam = np.max(np.where(cap[:,:,3]>30,YY,-1000),0)
    if name.endswith('rest'):
        cap[mask>0]=0
    cap[cap[:,:,3]<20]=0
    if name.endswith('rest'):
        count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(cap[:,:,3]>0),8)
        main=1+int(np.argmax(stats[1:,4]))
        cap[labels!=main]=0
    Image.fromarray(body).save(PARTS/(name+'-body.png'))
    Image.fromarray(cap).save(PARTS/(name+'-cap.png'))
    return {'source':a,'body':body,'cap':cap,'seam':seam,'bodyMask':mask}


def gills(native,lining):
    a=native['source']
    secondary=np.zeros_like(a)
    mask=np.zeros((640,640),np.uint8)
    if a[460,480,3]>0:
        polygon=np.array([[398,459],[410,440],[433,426],[451,420],[474,424],[495,438],[510,455],[515,480],[504,503],[484,509],[478,533],[454,526],[430,498],[412,480]],np.int32)
        cv2.fillPoly(mask,[polygon],1)
        secondary=a.copy()
        secondary[(mask==0)|(native['bodyMask']>0)]=0
    visible=a.copy()
    visible[(native['bodyMask']>0)|(native['cap'][:,:,3]>0)|(mask>0)]=0
    visible[YY<native['seam'][None,:]-2]=0
    depth=55 if secondary[:,:,3].max()>0 else 40
    visible[YY>native['seam'][None,:]+depth]=0
    count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(visible[:,:,3]>20),8)
    keep=[k for k in range(1,count) if stats[k,4]>100]
    visible[~np.isin(labels,keep)]=0
    coords=cv2.findNonZero(np.uint8(visible[:,:,3]>30))
    hull=cv2.convexHull(coords)
    fill=np.zeros((640,640),np.uint8)
    cv2.fillConvexPoly(fill,hull,1)
    ys,xs=np.where(fill>0)
    x0,x1,y0,y1=int(xs.min()),int(xs.max())+1,int(ys.min()),int(ys.max())+1
    sample=cv2.resize(lining[:,:,:3],(x1-x0,y1-y0),None,0,0,cv2.INTER_LINEAR)
    extra=np.zeros_like(a)
    extra[y0:y1,x0:x1,:3]=sample
    extra[:,:,3]=np.uint8((fill>0)&(native['bodyMask']>0)&(a[:,:,3]>240))*255
    complete=over(visible,extra)
    complete[complete[:,:,3]==0]=0
    return complete,secondary


def linings():
    a=read('gill-lining-raw')
    count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>20),8)
    items=sorted([(int(stats[k,4]),k) for k in range(1,count)])[-2:]
    ids=[v[1] for v in sorted((centers[k,0],k) for area,k in items)]
    result=[]
    for k in ids:
        x,y,w,h,area=[int(v) for v in stats[k]]
        result.append(a[y:y+h,x:x+w])
    return result


def over(front,back):
    f,b=front.astype(np.float32)/255,back.astype(np.float32)/255
    fa,ba=f[:,:,3:4],b[:,:,3:4]
    alpha=fa+ba*(1-fa)
    out=np.concatenate([(f[:,:,:3]*fa+b[:,:,:3]*ba*(1-fa))/np.maximum(alpha,1e-8),alpha],2)
    a=np.uint8(np.clip(out*255+.5,0,255))
    a[a[:,:,3]<20]=0
    return a


def clean(a):
    count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>0),8)
    if count<=2:
        return a
    main=1+int(np.argmax(stats[1:,4]))
    for k in range(1,count):
        if k!=main and stats[k,4]>8:
            raise ValueError('Unexpected detached sprite part: '+str(stats[k].tolist()))
    a=a.copy()
    a[labels!=main]=0
    return a


def main():
    images={n:extract(n) for n in ['small-upright','small-halfclosed','small-rest','adult-upright','adult-halflift','adult-rest']}
    board=Image.new('RGB',(640*3,368*2),'#20282e')
    for row,stage in enumerate(['small','adult']):
        native=images[stage+'-upright']
        for col,kind in enumerate(['upright','halfclosed' if stage=='small' else 'halflift','rest']):
            key=images[stage+'-'+kind]
            image=over(key['cap'],native['body'])
            board.paste(bg(image,'#20282e').crop((0,240,640,608)),(col*640,row*368))
    board.save(SCRATCH/'fixed-body-prototype.png')
    parts=Image.new('RGB',(640*3,368*2),'#20282e')
    for row,stage in enumerate(['small','adult']):
        for col,name in enumerate(['body','cap','source']):
            parts.paste(bg(images[stage+'-upright'][name],'#20282e').crop((0,240,640,608)),(col*640,row*368))
    parts.save(SCRATCH/'part-prototype.png')


if __name__=='__main__':
    main()
