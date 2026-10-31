from pathlib import Path
import sys,json,math,shutil
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).parent))
from quantum_mesh import read,rgba,over,apply,contour,triangulate,harmonic_matrix,closed_boundary,warp,cv2,Y,X
ROOT=Path(__file__).resolve().parent.parent
OLD=ROOT/'Sources'/'Level03Parts'

def write(file,data):file.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
def save(name,pixels):rgba(pixels).save(ROOT/'Parts'/(name+'.png'))
def affine(a,m):return cv2.warpAffine(a,np.float32(m[:2]),(512,512),None,cv2.INTER_CUBIC,cv2.BORDER_CONSTANT,(0,0,0,0))
def mirror(a):return affine(a,np.array([[-1,0,512],[0,1,0],[0,0,1]],float))
def polygon(points):
    im=Image.new('L',(1536,1536));ImageDraw.Draw(im).polygon([tuple(np.array(p)*3) for p in points],255)
    return np.array(im.resize((512,512),Image.Resampling.LANCZOS)).astype(float)/255
def curve(start,segments):
    points=[np.array(start,float)];a=np.array(start,float)
    for c,d,b in segments:
        c,d,b=[np.array(v,float) for v in [c,d,b]]
        for t in np.linspace(0,1,28)[1:]:points.append((1-t)**3*a+3*(1-t)**2*t*c+3*(1-t)*t*t*d+t**3*b)
        a=b
    return polygon(points)
def material(a):
    return cv2.cvtColor(np.array(rgba(a))[:,:,:3],cv2.COLOR_RGB2HSV)
def pale(a):
    h=material(a);return (((h[:,:,1]<125)&(h[:,:,0]>32))|(h[:,:,1]<45))&(h[:,:,2]>65)
def core_component(mask):
    n,l,s,c=cv2.connectedComponentsWithStats(np.uint8(mask),8);return np.uint8(l==1+int(np.argmax(s[1:,4])))
def components(file):
    raw=np.array(Image.open(file).convert('RGBA'));n,l,s,c=cv2.connectedComponentsWithStats(np.uint8(raw[:,:,3]>200),8)
    ids=[i for row,x,i in sorted((int(c[i,1]//512),c[i,0],i) for i in range(1,n) if s[i,4]>1000)];out=[]
    for i in ids:
        x,y,w,h,_=s[i];pad=3;a=raw[max(0,y-pad):y+h+pad,max(0,x-pad):x+w+pad].copy();keep=cv2.dilate(np.uint8(l==i),np.ones((5,5),np.uint8))[max(0,y-pad):y+h+pad,max(0,x-pad):x+w+pad]
        a[:,:,3]=np.uint8(np.minimum(a[:,:,3].astype(float)*255/253,255))*keep;a[a[:,:,3]==0,:3]=0
        a=a.astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];out.append(a)
    return out
def row_fit(source,alpha):
    sh,sw=source.shape[:2];sm=source[:,:,3]>.96;ty,tx=np.where(alpha>.4);sy,sx=np.where(sm)
    yy=np.arange(sy.min(),sy.max()+1);sl=[];sr=[]
    for y in yy:
        xs=np.where(sm[y])[0];sl.append(xs.min() if len(xs) else sl[-1]);sr.append(xs.max() if len(xs) else sr[-1])
    mx=np.full((512,512),-20,np.float32);my=mx.copy()
    for y in range(ty.min(),ty.max()+1):
        xs=np.where(alpha[y]>.01)[0]
        if not len(xs):continue
        v=sy.min()+(sy.max()-sy.min())*(y-ty.min())/max(1,ty.max()-ty.min());l=np.interp(v,yy,sl);r=np.interp(v,yy,sr)
        u=(xs-xs.min())/max(1,xs.max()-xs.min());mx[y,xs]=l+(r-l)*u;my[y,xs]=v
    result=cv2.remap(source,mx,my,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0));result[:,:,3]=alpha;rgb=result[:,:,:3]/np.maximum(cv2.remap(source[:,:,3],mx,my,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,0)[:,:,None],1e-6);result[:,:,:3]=rgb*alpha[:,:,None]
    return np.clip(result,0,1)

def fit_complete(source):
    mask=np.uint8(source[:,:,3]>.96);cs=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0];c=cs[int(np.argmax([cv2.contourArea(v) for v in cs]))][:,0,:].astype(float)
    top=c[c[:,1]==c[:,1].min()].mean(0);bottom=c[c[:,1]==c[:,1].max()].mean(0);left=c[c[:,0]==c[:,0].min()].mean(0)
    m=cv2.getAffineTransform(np.float32([top,bottom,left]),np.float32([[204,143],[245,247],[178,202]]))
    return affine(source,m)

def modern_boundary(poly,mode):
    anchors=[[255,365],[101,286],[180,198],[207,214],[187,230],[255,309]]
    ids=[int(np.argmin(np.linalg.norm(poly-p,None,1))) for p in anchors]
    endpoints=[[[251,312],[142,251],[193,180],[218,199],[201,214],[257,277]],[[258,325],[144,267],[239,187],[251,207],[242,217],[265,254]],[[258.5,325],[144,268],[236,187],[310,300],[310,315],[274,320]]][mode]
    controls=[[[[211,302],[140,287]],[[140,215],[168,179]],[[211,178],[222,188]],[[217,210],[203,217]],[[199,231],[245,239]],[[265,296],[254,314]]],[[[199,318],[143,304]],[[148,229],[208,190]],[[246,186],[254,197]],[[250,215],[245,219]],[[243,233],[262,240]],[[269,285],[259,315]]],[[[199,320],[143,305]],[[148,232],[210,185]],[[266,180],[300,244]],[[310,305],[310,310]],[[300,318],[288,320]],[[267,323],[260,324]]]][mode]
    out=np.empty_like(poly)
    for i in range(6):
        start=ids[i];end=ids[i+1] if i<5 else len(poly);j=np.arange(start,end);arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(poly[start:end+1] if end<len(poly) else np.vstack([poly[start:],poly[0]]),1,0),None,1))]
        t=(arc[:len(j)]/arc[-1])[:,None];a=np.array(endpoints[i]);b=np.array(endpoints[(i+1)%6]);c,d=np.array(controls[i]);out[j]=(1-t)**3*a+3*(1-t)**2*t*c+3*(1-t)*t*t*d+t**3*b
    return out

def stabilize(states,tris,boundary_count):
    from quantum_mesh import cross
    for iteration in range(32):
        repairs=[]
        for j in range(len(states)-1):
            for u in np.linspace(0,1,21):
                v=(states[j]*(1-u)+states[j+1]*u)[tris];a=cross(v[:,1]-v[:,0],v[:,2]-v[:,0])
                for tri in tris[a<=1e-5]:
                    boundary=[int(i) for i in tri if i<boundary_count];inside=[int(i) for i in tri if i>=boundary_count]
                    if len(boundary)!=2 or len(inside)!=1:raise RuntimeError('Petal path requires a new interior layout')
                    b=sorted(boundary);b=b[::-1] if b[1]-b[0]>1 else b;repairs.append((j,b,inside[0]))
        if not repairs:return states
        for j,b,i in set((j,tuple(b),i) for j,b,i in repairs):
            for k in [j,j+1]:
                if k==0:continue
                edge=states[k][b[1]]-states[k][b[0]];n=np.array([-edge[1],edge[0]]);n/=np.linalg.norm(n);states[k][i]+=.35*n
    raise RuntimeError('Petal interior did not stabilize')
def register_frame(source,reference):
    raw=np.array(rgba(source).resize((512,512),Image.Resampling.LANCZOS));ref=np.array(rgba(reference));mask=np.uint8((Y>330)|(Y<135)|(X<145)|(X>367))*255
    gray1=cv2.cvtColor(raw[:,:,:3],cv2.COLOR_RGB2GRAY);gray2=cv2.cvtColor(ref[:,:,:3],cv2.COLOR_RGB2GRAY);sift=cv2.SIFT_create(2200);k1,d1=sift.detectAndCompute(gray1,None);k2,d2=sift.detectAndCompute(gray2,mask)
    good=[a for a,b in cv2.BFMatcher().knnMatch(d1,d2,2) if a.distance<.72*b.distance];p=np.float32([k1[m.queryIdx].pt for m in good]);q=np.float32([k2[m.trainIdx].pt for m in good]);m,inliers=cv2.estimateAffinePartial2D(p,q,None,cv2.RANSAC,2.5,5000,.995,10)
    accepted=inliers[:,0]>0
    if accepted.sum()<12:raise RuntimeError('Bare plate registration lacks stable anchors')
    error=np.linalg.norm(p@m[:,:2].T+m[:,2]-q,None,1);report={'inliers':int(accepted.sum()),'medianError':float(np.median(error[accepted])),'matrix':m.tolist()};m[:,:2]*=512/source.shape[1]
    return affine(source,m),report
def refine_boundary(boundary,reference,side):
    rgb=np.array(rgba(reference))[:,:,:3].astype(float)/255;gray=cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY);gx=cv2.Sobel(gray,cv2.CV_32F,1,0);gy=cv2.Sobel(gray,cv2.CV_32F,0,1);gradient=np.sqrt(gx*gx+gy*gy);out=boundary.copy()
    for i,p in enumerate(boundary):
        tangent=boundary[(i+1)%len(boundary)]-boundary[i-1];n=np.array([tangent[1],-tangent[0]])/max(np.linalg.norm(tangent),1e-6);options=np.linspace(-3,3,13);samples=p+options[:,None]*n;xx=np.clip(samples[:,0],0,511).astype(int);yy=np.clip(samples[:,1],0,511).astype(int)
        cost=gray[yy,xx]*2-gradient[yy,xx]*.5+options*options*.045;j=int(np.argmin(cost));out[i]=samples[j]
    return out
def prepare():
    for name in ['Parts','Sources','References']:(ROOT/name).mkdir(511,True,True)
    source_atlas=components(ROOT/'Sources'/'atlas.png');reference03=read(ROOT/'References'/'K0.png');reference04=read(ROOT/'References'/'K7.png');back,reg=register_frame(read(ROOT/'Sources'/'bare.png'),reference04);save('complete-bare04',back);write(ROOT/'bare-registration.json',reg)
    topology={};source_bind={};flower_union=np.zeros((512,512),float)
    reflect03=np.array([[-1,0,512],[0,1,0],[0,0,1]],float);reflect04=np.array([[-1,0,517],[0,1,0],[0,0,1]],float)
    m_open=np.array([[.628,0,253-.628*255],[0,.774,315-.774*365],[0,0,1]],float);m_closed=np.array([[.80,0,258.5-.80*255],[0,.744,325-.744*365],[0,0,1]],float)
    for side in [0,1]:
        native=read(OLD/('cup-left.png' if side==0 else 'cup-right.png'));canonical=native if side==0 else mirror(native);poly=contour(canonical);uv,tri=triangulate(poly,canonical);h=harmonic_matrix(uv,tri,len(poly));boundary=closed_boundary(poly);closed=np.vstack([boundary,h@boundary]);world03=np.eye(3) if side==0 else reflect03
        open03=apply(world03,uv);closed03=apply(world03,closed);world04=m_open if side==0 else reflect04@m_open;boundary04=modern_boundary(poly,0);open04=np.vstack([boundary04,h@boundary04]);boundary04=modern_boundary(poly,2);closed04=np.vstack([boundary04,h@boundary04]);boundary04=modern_boundary(poly,1);mid04=np.vstack([boundary04,h@boundary04])
        open04,mid04,closed04=stabilize([open04,mid04,closed04],tri,len(poly))
        if side:open04=apply(reflect04,open04);closed04=apply(reflect04,closed04);mid04=apply(reflect04,mid04)
        name='front-'+str(side);topology[name]={'uv':uv.tolist(),'triangles':tri.tolist(),'boundaryCount':len(poly),'open03':open03.tolist(),'closed03':closed03.tolist(),'open04':open04.tolist(),'mid04':mid04.tolist(),'closed04':closed04.tolist()};save(name+'-03',canonical)
        save(name+'-04',canonical)
        for state in [open04,closed04]:flower_union=np.maximum(flower_union,warp(canonical,uv,state,tri)[:,:,3])
    native_rear=read(OLD/'rear-leaves-and-bean.png');hs=material(native_rear);gold=(hs[:,:,0]<38)&(hs[:,:,1]>65)&(hs[:,:,2]>75)&(X>180)&(X<340)&(Y>230)&(Y<350)&(native_rear[:,:,3]>.4);gold=cv2.morphologyEx(np.uint8(gold),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8));cs=cv2.findContours(gold,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0];c=cs[int(np.argmax([cv2.contourArea(v) for v in cs]))];gold=np.zeros((512,512),np.uint8);cv2.drawContours(gold,[c],-1,1,-1);gold=cv2.dilate(gold,np.ones((3,3),np.uint8));seed=native_rear*gold[:,:,None];save('seed-03',seed)
    raw=np.array(rgba(native_rear));gold*=np.uint8(raw[:,:,0].astype(float)>=raw[:,:,1].astype(float)*.85);seed=native_rear*gold[:,:,None];save('seed-03',seed)
    sm=np.array([[.61,0,259-.61*260],[0,.61,219-.61*240],[0,0,1]],float);seed4=affine(seed,sm);save('seed-04',seed4);flower_union=np.maximum(flower_union,seed4[:,:,3])
    for level in [3,4]:
        for side in [0,1]:
            if level==3:
                native_visible=native_rear*(1-gold)[:,:,None]*((X<260) if side==0 else (X>=260))[:,:,None];mask=np.maximum(native_visible[:,:,3],gold*((X<263) if side==0 else (X>257)))
                mask*=Y<316;mask=np.clip(mask,0,1);native_visible*=(Y<235)[:,:,None]
            else:
                shape=curve((204,143),[[[197,160],[179,184],[178,202]],[[181,226],[214,244],[245,247]],[[255,232],[256,213],[247,188]],[[230,163],[213,148],[204,143]]])
                if side:shape=affine(np.dstack([shape]*4),np.array([[-1,0,518],[0,1,0],[0,0,1]],float))[:,:,3]
                mask=shape;native_visible=reference04*mask[:,:,None];native_visible*=pale(native_visible)[:,:,None]
            complete=row_fit(source_atlas[side],mask) if level==3 else fit_complete(source_atlas[3] if side==0 else source_atlas[4][:,::-1].copy())
            if level==4 and side:complete=affine(complete,np.array([[-1,0,518],[0,1,0],[0,0,1]],float))
            weight=(native_visible[:,:,3]>0)*np.clip((235-Y)/40,0,1) if level==3 else np.zeros((512,512));rgb=native_visible[:,:,:3]/np.maximum(native_visible[:,:,3:4],1e-6)*complete[:,:,3:4];complete[:,:,:3]=complete[:,:,:3]*(1-weight[:,:,None])+rgb*weight[:,:,None];save('rear-'+str(level)+'-'+str(side),complete)
            if level==4:flower_union=np.maximum(flower_union,mask)
    sprout=read(OLD/'sprout.png');sprout4m=np.array([[.75,0,259-.75*260],[0,.8,223-.8*247],[0,0,1]],float)
    masks=[((X>=254)&(X<=270)&(Y>=221)),((X<=260)&(Y<=226)),((X>=260)&(Y<=226))]
    for level in [3,4]:
        src=sprout.copy()
        if level==4:
            projected=cv2.remap(reference04,apply(sprout4m,np.dstack([X,Y]).reshape(-1,2))[:,0].reshape(512,512).astype(np.float32),apply(sprout4m,np.dstack([X,Y]).reshape(-1,2))[:,1].reshape(512,512).astype(np.float32),cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0));rgb=np.array(rgba(projected));good=(rgb[:,:,1]>rgb[:,:,0])&(rgb[:,:,1]>rgb[:,:,2]*1.15)&(sprout[:,:,3]>.98);src[good,:3]=projected[good,:3]*sprout[good,3,None]/np.maximum(projected[good,3,None],1e-6)
        for name,mask in zip(['stem','leaf-l','leaf-r'],masks):save('sprout-'+str(level)+'-'+name,src*mask[:,:,None])
    save('foreground-03',read(OLD/'fixed-frame-and-ground.png'));save('lining-03',read(OLD/'inner-lining.png'))
    flower_union=np.maximum(flower_union,affine(sprout,sprout4m)[:,:,3]);flower_union=np.maximum(flower_union,polygon([(182,132),(336,132),(379,224),(374,323),(145,323),(138,258),(150,203)]));flower_union=cv2.dilate(np.float32(flower_union>.05),np.ones((7,7),np.uint8));merged=reference04*(1-flower_union[:,:,None])+back*flower_union[:,:,None]
    interior=polygon([(256,130),(204,130),(191,165),(176,184),(162,211),(151,236),(143,257),(144,269),(158,278),(165,297),(186,313),(222,317),(256,316),(290,317),(326,313),(347,297),(354,278),(368,269),(369,257),(361,236),(350,211),(336,184),(321,165),(308,130)])
    fg=np.uint8(interior<.5)
    save('background-04',merged*(1-fg[:,:,None]));save('foreground-04',merged*fg[:,:,None]);save('sprout-full-03',sprout);write(ROOT/'topology.json',topology);write(ROOT/'part-transforms.json',{'sprout04':sprout4m.tolist(),'fore04OpenGuide':m_open.tolist(),'fore04ClosedGuide':m_closed.tolist()})
    board=Image.new('RGBA',(2048,1536),'#14251f')
    names=['front-0-03','front-0-04','rear-3-0','rear-4-0','seed-03','seed-04','sprout-3-leaf-l','sprout-4-leaf-l','foreground-03','background-04','foreground-04','lining-03']
    for i,name in enumerate(names):board.alpha_composite(Image.open(ROOT/'Parts'/(name+'.png')),((i%4)*512,(i//4)*512))
    board.convert('RGB').save(ROOT/'parts-contact.png');print('prepared',len(list((ROOT/'Parts').glob('*.png'))),'parts')

if __name__=='__main__':prepare()
