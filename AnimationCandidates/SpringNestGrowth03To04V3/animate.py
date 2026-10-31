from pathlib import Path
from PIL import Image, ImageDraw, WebPImagePlugin
import numpy as np
import math, json, sys, hashlib
import cv2
ROOT=Path(__file__).parent
PARTS=ROOT/'Rig'/'Parts'
WORK=Path('H:/Spawner/$Trash/SpringNestGrowth03To04-v3-20261031')
PARTS.mkdir(511,True,True)
Y,X=np.mgrid[:512,:512].astype(np.float32)
def load(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4]
    return a
def pil(a):
    a=np.clip(a,0,1)
    rgb=a[:,:,:3]/np.maximum(a[:,:,3:4],1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,a[:,:,3:4]],2)*255+.5,0,255)))
def save_json(path,data):
    path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
def over(front,back):
    return front+back*(1-front[:,:,3:4])
def blank():
    return np.zeros((512,512,4),np.float32)
def poly(points):
    a=Image.new('L',(512,512))
    ImageDraw.Draw(a).polygon(points,255)
    return np.array(a)>0
def ellipse(cx,cy,rx,ry):
    return ((X-cx)/rx)**2+((Y-cy)/ry)**2<=1
def ease(value):
    u=float(np.clip(value,0,1))
    return u*u*(3-2*u)
def affine(source,matrix):
    return cv2.warpAffine(source,np.array(matrix,np.float32),(512,512),None,cv2.INTER_CUBIC,cv2.BORDER_CONSTANT,(0,0,0,0))
def move(source,delta):
    return affine(source,[[1,0,delta[0]],[0,1,delta[1]]])
def rotate(source,pivot,angle,shift):
    cs=math.cos(angle);sn=math.sin(angle)
    x,y=pivot
    return affine(source,[[cs,-sn,x+shift[0]-cs*x+sn*y],[sn,cs,y+shift[1]-sn*x-cs*y]])
def fit(source,box):
    x,y,w,h=box
    a=cv2.resize(source,(round(w),round(h)),None,0,0,cv2.INTER_CUBIC)
    out=blank()
    out[round(y):round(y)+a.shape[0],round(x):round(x)+a.shape[1]]=a
    return out
def atlas_cell(path,column,row):
    a=load(path);h,w=a.shape[:2]
    cell=a[round(row*h/3):round((row+1)*h/3),round(column*w/3):round((column+1)*w/3)].copy()
    binary=np.uint8(cell[:,:,3]>.45)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(binary,8)
    component=1+int(np.argmax(stats[1:,4]))
    keep=cv2.dilate(np.uint8(labels==component),np.ones((3,3),np.uint8))>0
    cell*=keep[:,:,None]
    yy,xx=np.where(cell[:,:,3]>.45)
    return cell[yy.min():yy.max()+1,xx.min():xx.max()+1]
def write_part(name,source):
    pil(source).save(PARTS/(name+'.png'))
def warm_mask(source,region):
    p=np.array(pil(source))
    hsv=cv2.cvtColor(p[:,:,:3],cv2.COLOR_RGB2HSV)
    warm=(hsv[:,:,0]<42)&(hsv[:,:,1]>70)&(hsv[:,:,2]>45)
    mask=cv2.dilate(np.uint8(warm&region),np.ones((5,5),np.uint8))>0
    return mask&region&(source[:,:,3]>.05)
def patch(source,mask,helper):
    return np.where(mask[:,:,None],helper,source)
def sprite(source,cx,cy,w,h):
    sh,sw=source.shape[:2]
    return affine(source,[[w/sw,0,cx-w/2],[0,h/sh,cy-h/2]])
def quad(source,a,b,c):
    sh,sw=source.shape[:2]
    start=np.float32([[0,0],[sw,0],[0,sh]])
    end=np.float32([a,b,c])
    return affine(source,cv2.getAffineTransform(start,end))
def local_maps(source_points,destination_points,triangles):
    mx=np.full((512,512),-50,np.float32)
    my=mx.copy()
    for tri in triangles:
        a=source_points[tri];b=destination_points[tri]
        x0=max(0,int(np.floor(b[:,0].min())));x1=min(511,int(np.ceil(b[:,0].max())))
        y0=max(0,int(np.floor(b[:,1].min())));y1=min(511,int(np.ceil(b[:,1].max())))
        if x1<x0 or y1<y0:continue
        mat=np.vstack([b.T,np.ones(3)])
        if abs(np.linalg.det(mat))<1e-5:continue
        xx=X[y0:y1+1,x0:x1+1];yy=Y[y0:y1+1,x0:x1+1]
        weights=np.linalg.inv(mat)@np.vstack([xx.ravel(),yy.ravel(),np.ones(xx.size)])
        inside=np.all(weights>=-.0001,axis=0).reshape(xx.shape)
        uv=(a.T@weights).reshape(2,*xx.shape)
        mx[y0:y1+1,x0:x1+1][inside]=uv[0][inside]
        my[y0:y1+1,x0:x1+1][inside]=uv[1][inside]
    return mx,my
def triangles_for(a,b):
    mid=(a+b)/2
    sub=cv2.Subdiv2D((0,0,512,512))
    for p in mid:sub.insert((float(p[0]),float(p[1])))
    result=[]
    for values in sub.getTriangleList():
        t=np.array(values).reshape(3,2)
        ids=[int(np.argmin(np.linalg.norm(mid-p,None,1))) for p in t]
        if len(set(ids))<3:continue
        if max(np.linalg.norm(mid[ids]-t,None,1))>.1:continue
        result.append(ids)
    result=np.array(result,int)
    for q in [0,.25,.5,.75,1]:
        points=a*(1-q)+b*q
        areas=[]
        for tri in result:
            v=points[tri]
            u=v[1]-v[0];w=v[2]-v[0]
            areas.append(float(u[0]*w[1]-u[1]*w[0]))
        if any(abs(v)<.01 for v in areas):raise ValueError('Collapsed growth triangle')
    return result
UPPER=[
poly([(38,315),(43,278),(58,254),(78,246),(85,228),(118,207),(195,201),(235,215),(265,245),(277,256),(303,274),(338,270),(360,240),(381,243),(389,284),(384,304),(405,316),(403,332),(320,333),(297,341),(265,342),(246,336),(198,339),(182,351),(145,347),(119,335),(80,335),(51,328)]),
poly([(39,289),(42,259),(57,234),(74,218),(95,195),(126,172),(167,160),(225,163),(266,180),(286,208),(307,222),(340,232),(368,226),(385,203),(407,206),(414,219),(403,237),(401,260),(418,282),(421,299),(404,306),(360,307),(305,315),(267,318),(232,315),(212,311),(193,319),(157,322),(122,320),(99,314),(70,313),(44,303)]),
poly([(30,291),(37,247),(57,219),(66,200),(91,186),(118,174),(126,121),(168,109),(258,110),(290,116),(323,108),(360,123),(383,159),(406,174),(407,228),(422,234),(453,233),(463,251),(458,278),(438,293),(421,306),(373,300),(336,307),(321,313),(287,313),(253,315),(232,318),(208,327),(169,327),(137,324),(117,323),(94,324),(73,319),(53,316),(35,307)])
]
wet_reference=load(ROOT/'Sources/end.png')
refs=[load(ROOT/'Parts/old-stationary-underlayer.png'),load(ROOT/'Keys/key-1200.png'),load(ROOT/'Keys/key-2000.png'),load(ROOT/'Keys/key-2800.png')]
KEY_TIMES=[0,1.2,2,2.8]
WHEELS=[([108,304],[23,42],[45,-8]),([118,268],[25,44],[40,-10]),([104,264],[25,44],[50,-10]),([104,263],[25,44],[50,-10])]
CAPS=[(94,304),(104,269),(86,265),(86,263)]
old_helper=refs[0]
new_helper=load(ROOT/'Parts/rig-host-underlayer.png')
atlas=ROOT/'Sources/new-parts-generated.png'
tex={
'front-old':load(ROOT/'Parts/old-wheel-front.png'),
'rear-old':load(ROOT/'Parts/old-wheel-rear.png'),
'paddle-old':load(ROOT/'Parts/old-paddle-front.png'),
'paddle-back-old':load(ROOT/'Parts/old-paddle-back.png'),
'front-new':atlas_cell(atlas,0,0),
'rear-new':atlas_cell(atlas,1,0),
'paddle-new':atlas_cell(atlas,2,0),
'paddle-back-new':atlas_cell(atlas,0,1),
'gear':atlas_cell(atlas,1,1),
'valve':atlas_cell(atlas,2,1),
'flow':load(ROOT/'Parts/old-water-ribbon-tiled.png'),
'foam':load(ROOT/'Parts/old-foam.png'),
'ripple':load(ROOT/'Parts/old-ripple-filtered.png'),
'droplet':load(ROOT/'Parts/old-droplet.png')
}
def strong_rim(source):
    size=192
    source=cv2.resize(source,(size,size),None,0,0,cv2.INTER_CUBIC)
    yy,xx=np.mgrid[:size,:size].astype(np.float32)
    u=(xx-95.5)/90;v=(yy-95.5)/90
    radius=np.sqrt(u*u+v*v)
    source_radius=np.where(radius>.60,.80+(radius-.60)*.20/.40,radius*.80/.60)
    scale=source_radius/np.maximum(radius,1e-6)
    result=cv2.remap(source,95.5+u*scale*90,95.5+v*scale*90,cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0))
    result[radius>1]=0
    result[result[:,:,3]<.3]=0
    return result
tex['front-old']=strong_rim(load(ROOT/'Parts/old-wheel-front.png'))
tex['rear-old']=tex['front-old'].copy()
tex['rear-old'][:,:,:3]*=.83
tex['front-new']=tex['front-old'].copy()
tex['rear-new']=tex['rear-old'].copy()
tex['paddle-new']=tex['paddle-old'].copy()
tex['paddle-back-new']=tex['paddle-back-old'].copy()
flow_core=tex['flow'][32:224].copy()
flow_core=cv2.resize(flow_core,(128,256),None,0,0,cv2.INTER_CUBIC)
tex['flow']=np.concatenate([flow_core,flow_core[::-1]],0)
for name,source in tex.items():
    if name in ['paddle-new','paddle-back-new','gear','valve']:
        source[source[:,:,3]<.25]=0
    write_part(name,source)
wheel_regions=[
poly([(69,250),(102,243),(144,252),(176,275),(186,322),(166,342),(126,346),(91,329),(70,305)]),
poly([(78,210),(107,204),(146,214),(172,243),(184,282),(172,308),(126,317),(91,299),(76,272)]),
poly([(69,204),(105,195),(147,206),(174,232),(184,275),(169,305),(122,312),(83,293),(68,267)])
]
lever_regions=[
poly([(337,278),(347,263),(361,246),(374,243),(383,251),(370,270),(352,286)]),
poly([(366,241),(378,224),(392,206),(405,204),(414,215),(402,234),(383,250)])
]
lever_pivots=[(345,280),(374,241)]
levers=[]
bodies=[]
caps=[]
for index,source in enumerate(refs):
    region=wheel_regions[min(index,2)]
    wheel=warm_mask(source,region)
    if index==0:helper=old_helper
    elif index==1:helper=move(old_helper,(17,-34))
    else:helper=new_helper
    body=patch(source,wheel,helper)
    cx,cy=WHEELS[index][0]
    capx,capy=CAPS[index]
    cap_region=ellipse(capx,capy,12,15)&(X<capx+9)
    cap=source*cap_region[:,:,None]
    caps.append(cap)
    if index<2:
        region=lever_regions[index]
        lever=source*region[:,:,None]
        levers.append(lever)
        clear=region&(Y<lever_pivots[index][1]-2)
        body[clear]=0
    bodies.append(body)
gear_mask=warm_mask(refs[3],ellipse(194,240,20,23))
valve_mask=ellipse(436,257,24,25)
drive_region=poly([(166,273),(182,264),(199,253),(226,254),(248,263),(252,282),(243,297),(221,298),(198,289),(170,287)])
drive_mask=warm_mask(refs[3],drive_region)|(drive_region&(X>192)&(X<230)&(Y>262)&(Y<286))
tank_mask=poly([(330,171),(359,168),(379,179),(388,201),(388,228),(378,248),(337,252),(319,241),(316,219),(321,194)])
pipe_top_mask=poly([(278,118),(299,108),(325,112),(345,125),(357,146),(360,163),(356,180),(338,181),(334,155),(329,141),(316,132),(299,132),(290,138),(279,135)])
pipe_side_mask=poly([(357,164),(376,166),(392,180),(400,199),(399,229),(408,237),(407,247),(384,248),(379,229),(380,200),(373,185),(357,182)])
equipment_masks={'tank':tank_mask,'return-pipe':pipe_top_mask,'side-pipe':pipe_side_mask,'drive':drive_mask,'gear':gear_mask,'valve':valve_mask}
equipment={}
for name,mask in equipment_masks.items():
    equipment[name]=sprite(tex['gear'],194,240,38,43) if name=='gear' else refs[3]*mask[:,:,None]
    write_part(name,equipment[name])
    bodies[3]=patch(bodies[3],mask,new_helper)
bodies[2]=new_helper.copy()
bodies[3]=new_helper.copy()
for index in [2,3]:
    caps[index]=new_helper*(ellipse(92,263,13,18)&(X<104))[:,:,None]
basin_helper_old=fit(atlas_cell(ROOT/'Sources/basin-growth-generated.png',0,0),(28,313,456,135))
basin_helper_new=fit(atlas_cell(ROOT/'Sources/basin-growth-generated.png',2,2),(16,292,480,156))
lower=[]
upper=[]
for k in range(4):
    mask=UPPER[min(k,2)]
    helper=basin_helper_old if k==0 else basin_helper_new
    lower.append(over(refs[k]*(~mask)[:,:,None],helper*mask[:,:,None]))
    upper.append(bodies[k]*mask[:,:,None])
    write_part('lower-'+str(k),lower[-1])
    write_part('upper-'+str(k),upper[-1])
    write_part('axle-cap-'+str(k),caps[k])
for k,im in enumerate(levers):write_part('crank-'+str(k),im)
cuts=[(265,205,304),(229,217,319),(183,210,328),(183,210,328)]
architectures=[]
for k in range(4):
    cy,lx,rx=cuts[k]
    pool=(Y<cy)&(X>70)&(X<355)
    chute=(Y>=cy)&(X>=lx)&(X<rx)
    left=(~pool)&(X<lx)
    right=(~pool)&(X>=rx)
    masks=[pool,chute,left,right]
    others=~np.logical_or.reduce(masks)
    masks[2]|=others
    parts=[upper[k]*m[:,:,None] for m in masks]
    architectures.append(parts)
    for label,im in zip(['upper-pool','spillway','left-housing','right-housing'],parts):write_part(str(k)+'-'+label,im)
A0=np.array([[0,0],[511,0],[511,511],[0,511],[55,315],[110,285],[100,245],[165,205],[246,228],[295,275],[345,280],[420,333],[285,335],[182,338],[255,300],[205,268]],float)
B0=np.array([[0,0],[511,0],[511,511],[0,511],[45,303],[121,256],[100,211],[191,163],[271,190],[326,244],[374,241],[431,309],[303,310],[198,316],[273,276],[220,232]],float)
A1=np.array([[0,0],[511,0],[511,511],[0,511],[45,303],[121,256],[100,211],[191,163],[271,190],[326,244],[398,245],[431,309],[303,310],[198,316],[273,276],[220,232]],float)
B1=np.array([[0,0],[511,0],[511,511],[0,511],[42,313],[112,251],[99,202],[213,111],[316,143],[333,229],[397,245],[433,309],[305,308],[195,318],[279,265],[230,181]],float)
MESHS=[(A0,B0,triangles_for(A0,B0)),(A1,B1,triangles_for(A1,B1))]

def remap(source,maps):
    return cv2.remap(source,maps[0],maps[1],cv2.INTER_CUBIC,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def architecture(a,b,progress):
    if progress<=0:return upper[a].copy()
    if progress>=1:return upper[b].copy()
    p=ease(progress);aa,bb,tris=MESHS[a]
    current=aa*(1-p)+bb*p
    amap=local_maps(aa,current,tris);bmap=local_maps(bb,current,tris)
    old_surface=blank();new_surface=blank()
    for old,new in zip(architectures[a],architectures[b]):
        old_surface+=remap(old,amap)
        new_surface+=remap(new,bmap)
    if a==0:field=np.clip((448-Y)/300+.055*np.sin(X/34),0,1)
    else:field=np.clip((318-Y)/195+.045*np.sin(X/24),0,1)
    threshold=np.clip(p*1.18-.08,0,1)
    choose=field<=threshold
    return np.clip(np.where(choose[:,:,None],new_surface,old_surface),0,1)

def basin(progress):
    if progress<=0:return lower[0]
    if progress>=1:return lower[3]
    p=ease(progress)
    w=456+24*p;top=313-21*p;h=448-top
    old=affine(lower[0],[[w/456,0,256-w/456*256],[0,h/135,448-h/135*448]])
    new=affine(lower[3],[[w/480,0,256-w/480*256],[0,h/156,448-h/156*448]])
    field=np.clip((Y-top)/(448-top)+.035*np.sin(X/22),0,1)
    return np.where((field<p*1.12)[:,:,None],new,old)
def wheel_parameters(time):
    if time<1.2:k=0;p=ease(max(0,(time-.5)/.7))
    elif time<2:k=1;p=ease((time-1.2)/.8)
    else:k=2;p=ease((time-2)/.8)
    first=WHEELS[k];second=WHEELS[k+1]
    return [np.array(a)*(1-p)+np.array(b)*p for a,b in zip(first,second)]
def angle_at(time):
    if time<.5:return .15+2*math.pi*(.50*time-.5*time*time)
    if time<3.22:return .15+2*math.pi*.125
    u=time-3.22
    return .15+2*math.pi*.125+2*math.pi*(.30*u*u)
def project_wheel(u,v,z,config):
    c,r,d=config
    return (c[0]+r[0]*u+d[0]*z,c[1]+r[1]*v+d[1]*z)
def wheel(time,config):
    p=ease((time-2.05)/.55)
    stage='new' if p>=.55 else 'old'
    front=tex['front-'+stage];rear=tex['rear-'+stage]
    paddle=tex['paddle-'+stage];back=tex['paddle-back-'+stage]
    angle=angle_at(time);cs=math.cos(angle);sn=math.sin(angle)
    out=blank()
    for source,z in [(rear,1)]:
        a=project_wheel(-cs+sn,-sn-cs,z,config);b=project_wheel(cs+sn,sn-cs,z,config);c=project_wheel(-cs-sn,-sn+cs,z,config)
        out=over(quad(source,a,b,c),out)
    paddles=sorted([(math.cos(angle+k*2*math.pi/8),angle+k*2*math.pi/8,k) for k in range(8)])
    for order,theta,k in paddles:
        delta=.16
        a=project_wheel(math.cos(theta-delta),math.sin(theta-delta),0,config)
        b=project_wheel(math.cos(theta-delta),math.sin(theta-delta),1,config)
        c=project_wheel(math.cos(theta+delta),math.sin(theta+delta),0,config)
        source=paddle if math.cos(theta)>0 else back
        out=over(quad(source,a,b,c),out)
    a=project_wheel(-cs+sn,-sn-cs,0,config);b=project_wheel(cs+sn,sn-cs,0,config);c=project_wheel(-cs-sn,-sn+cs,0,config)
    out=over(quad(front,a,b,c),out)
    return out
def rigid_install(source,progress,delta):
    if progress<=0:return blank()
    q=ease(progress)
    im=move(source,(delta[0]*(1-q),delta[1]*(1-q)))
    im*=((Y<325)&(Y>108))[:,:,None]
    return im
def clip_front(source):
    return source*((Y<323)|(X>425))[:,:,None]
def flowing_strip(time,path,head,tail):
    x0,y0,x1,y1,w0,w1=path
    if head>=tail:return blank()
    texture=tex['flow']
    offset=int((time*95)%256)
    source=texture[offset:offset+256].copy()
    sh,sw=source.shape[:2]
    origin=np.float32([[0,0],[sw,0],[sw,sh],[0,sh]])
    target=np.float32([[x0-w0/2,y0],[x0+w0/2,y0],[x1+w1/2,y1],[x1-w1/2,y1]])
    matrix=cv2.getPerspectiveTransform(origin,target)
    out=cv2.warpPerspective(source,matrix,(512,512),None,cv2.INTER_CUBIC,cv2.BORDER_CONSTANT,(0,0,0,0))
    dx=x1-x0;dy=y1-y0
    along=((X-x0)*dx+(Y-y0)*dy)/max(dx*dx+dy*dy,1)
    leading=tail+.008*np.sin(X*.3+time*10)
    out*=((along>=head)&(along<=leading))[:,:,None]
    return out

FLOW0=[[161,270,174,333,13,19],[222,249,246,289,47,43],[259,289,278,333,33,40]]
FLOW4=[[153,209,173,306,17,24],[237,165,269,267,43,44],[269,263,292,318,44,48]]
def fluids(time):
    out=blank()
    if time<.5:
        paths=FLOW0;head=ease(time/.5);tail=1
        impact=1-head
    elif time<2.8:return out
    else:
        paths=FLOW4
        elapsed=time-2.92
        head=0;tail=np.clip(elapsed/.40,0,1)
        impact=float(np.clip((elapsed-.28)/.25,0,1))
    for i,path in enumerate(paths):
        delay=0 if time<.5 else [.10,0,.18][i]
        end=tail if time<.5 else np.clip((time-2.92-delay)/.40,0,1)
        out=over(flowing_strip(time,path,head,end),out)
    if impact>0:
        pulse=.5+.5*math.sin(time*26)
        out=over(sprite(tex['foam'],174 if time<.5 else 174,333 if time<.5 else 307,30,4+pulse*4)*impact,out)
        out=over(sprite(tex['foam'],279 if time<.5 else 292,334 if time<.5 else 319,42,4+pulse*3)*impact,out)
        for k in range(4):
            u=(time*2.1+k*.23)%1
            dt=u*.45
            x=(280 if time<.5 else 290)+(k-1.4)*24*dt
            y=(332 if time<.5 else 318)-(17+k*3)*dt+65*dt*dt
            out=over(sprite(tex['droplet'],x,y,2.0,3.2)*impact*(1-u),out)
    return out
def ripples(time):
    out=blank()
    amount=1 if time<.5 else float(np.clip((time-3.15)/.45,0,1))
    if amount<=0:return out
    for k in range(3):
        u=(time*.7+k/3)%1
        out=over(sprite(tex['ripple'],280,345+26*u,45+270*u,8+44*u)*((1-u)*.35*amount),out)
    return out
def render(time):
    if time<1.2:
        p=max(0,(time-.5)/.7)
        value=basin(p)
        body=architecture(0,1,p)
    elif time<2:
        p=(time-1.2)/.8
        value=lower[3].copy()
        body=architecture(1,3,p)
    else:
        value=lower[3].copy()
        body=upper[3].copy()
    value=over(body,value)
    if time>=2:
        gear_q=(time-2.10)/.35
        gear=rigid_install(equipment['gear'],gear_q,(-42,0))
        if gear_q>0:
            hub=refs[3]*ellipse(194,240,6,6)[:,:,None]
            gear=over(move(hub,(-42*(1-ease(gear_q)),0)),gear)
        if time>3.22:gear=rotate(gear,(194,240),-(angle_at(time)-angle_at(3.22))*1.8,(0,0))
        value=over(gear,value)
        tank=rigid_install(equipment['tank'],(time-2.18)/.38,(0,88))
        tank*=(Y<=252)[:,:,None]
        value=over(tank,value)
        q=ease((time-2.45)/.33)
        top_pipe=equipment['return-pipe']*((Y>=181-74*q)&(q>0))[:,:,None]
        value=over(top_pipe,value)
        q=ease((time-2.38)/.40)
        side_pipe=equipment['side-pipe']*((Y>=249-86*q)&(q>0))[:,:,None]
        value=over(side_pipe,value)
    config=wheel_parameters(time)
    value=over(wheel(time,config),value)
    if time<1.2:
        p=ease(max(0,(time-.5)/.7))
        cap=move(caps[0],(config[0][0]-WHEELS[0][0][0],config[0][1]-WHEELS[0][0][1]))
        if p>.5:cap=move(caps[1],(config[0][0]-WHEELS[1][0][0],config[0][1]-WHEELS[1][0][1]))
    else:cap=move(caps[2],(config[0][0]-WHEELS[2][0][0],config[0][1]-WHEELS[2][0][1]))
    value=over(cap,value)
    if time<2:
        delta=np.array(lever_pivots[1])-lever_pivots[0]
        if time<1.2:
            p=ease(max(0,(time-.5)/.7))
            offset=delta*p
        else:
            q=ease((time-1.2)/.8)
            offset=delta+np.array([17*q,70*q])
        lever=rotate(levers[0],lever_pivots[0],math.radians(-57*ease(time/.5)),offset)
        lever*=((Y<318)&(X<440))[:,:,None]
        if time>=1.2:lever*=(Y<245)[:,:,None]
        value=over(lever,value)
    if time>=2:
        drive=rigid_install(equipment['drive'],(time-2.20)/.42,(0,48))
        drive*=(Y<=298)[:,:,None]
        value=over(drive,value)
        valve=rigid_install(equipment['valve'],(time-2.40)/.38,(-34,0))
        valve*=(X>=413)[:,:,None]
        if time>=2.8:valve=rotate(valve,(436,257),math.radians(70*ease((time-2.8)/.32)),(0,0))
        value=over(valve,value)
    if time>=2.85:
        fill=ease((time-2.85)/.35)
        inside=ellipse(352,218,25,22)&(Y>=240-36*fill)&(Y<239)
        fluid=wet_reference*inside[:,:,None]
        value=over(fluid,value)
        if fill>0:value=over(sprite(tex['ripple'],352,240-36*fill,45,7)*.55,value)
    value=over(ripples(time),value)
    value=over(fluids(time),value)
    return np.clip(value,0,1)
def encode(path,frames,durations,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'lossless':True,'loop':loop,'method':4}
    with path.open('wb') as stream:WebPImagePlugin._save_all(frames[0],stream,'')
def rig_data():
    attachments=[]
    for name in ['tank','return-pipe','side-pipe','drive','gear','valve']:
        im=equipment[name];yy,xx=np.where(im[:,:,3]>.05)
        box=[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())]
        attachments.append({'name':name,'parent':'root','source':'Rig/Parts/'+name+'.png','vertices':[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]],'triangles':[[0,1,2],[0,2,3]],'weights':[[1],[1],[1],[1]],'rigid':True})
    return {'format':'custom-layered-growth-rig-v1','canvas':[512,512],'root':[256,448],'approvedKeyTimesMs':[1200,2000,2800],'keyframeApproval':'좋아, 계속해봐','construction':'separate masonry layers with local growth meshes, projected rigid wheel attachments, rigid machinery installation, masked flowing-water ribbons','compatibility':'Python/OpenCV renderer and baked PNG/WebP only','dependencies':['Pillow','numpy','opencv-python-headless'],'fixedMasonrySource':'Parts/rig-host-underlayer.png','representativePlaybackVerified':True,'opacityPoseReplacement':False,'growthMeshes':[{'source':a.tolist(),'target':b.tolist(),'triangles':t.tolist()} for a,b,t in MESHS],'attachments':attachments,'wheel':{'stages':WHEELS,'paddles':8,'projection':'orthographic front/rear planes, depth-sorted rigid paddle quads'},'fluids':{'oldPaths':FLOW0,'newPaths':FLOW4,'waterTravelTimeSeconds':.4},'hiddenSurfaceSources':['Parts/old-stationary-underlayer.png','Parts/rig-host-underlayer.png','Sources/rig-host-backplate-generated.png','Sources/basin-growth-generated.png','Sources/new-parts-generated.png'],'partSources':[str(p.relative_to(ROOT)).replace('\\','/') for p in PARTS.glob('*.png')]}
def sample():
    times=np.linspace(2,4,51)
    frames=[pil(render(float(t))) for t in times]
    encode(ROOT/'assembly-sample.webp',frames,[40]*len(frames),0)
    board=Image.new('RGBA',(2560,512),(22,39,39,255))
    for k,index in enumerate([0,10,20,30,50]):board.alpha_composite(frames[index],(k*512,0))
    board.convert('RGB').save(WORK/'assembly-sample-poses.png')
    save_json(ROOT/'Rig'/'rig.json',rig_data())
    print('Rendered 2.04s representative assembly and water-restart clip.')
def full():
    frames=[]
    for k in range(100):
        frame=pil(render(k/99*4))
        frame.save(ROOT/'Frames'/('frame-'+str(k).zfill(3)+'.png'))
        frames.append(frame)
    durations=[40]*100
    encode(ROOT/'growth.webp',frames,durations,1)
    previews=[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames]
    preview_frames=[previews[0]]+previews+[previews[-1]]
    encode(ROOT/'preview.webp',preview_frames,[600]+durations+[1000],0)
    sheet=Image.new('RGBA',(4096,6656))
    for k,frame in enumerate(frames):sheet.alpha_composite(frame,((k%8)*512,(k//8)*512))
    sheet.save(ROOT/'growth-sheet.png')
    board=Image.new('RGBA',(2560,1024),(22,39,39,255))
    ids=[0,12,22,30,40,50,60,70,82,99]
    for j,k in enumerate(ids):board.alpha_composite(frames[k],((j%5)*512,(j//5)*512))
    board.convert('RGB').save(ROOT/'animation-contact.png')
    save_json(ROOT/'animation.json',{'frameSize':[512,512],'root':[256,448],'frameCount':100,'fps':25,'durationMs':4000,'durationsMs':durations,'columns':8,'rows':13,'loop':False,'sheet':'growth-sheet.png','animation':'growth.webp','preview':'preview.webp','previewHoldMs':[600,1000],'sourceRig':'Rig/rig.json','keyApprovalSource':'keyframes.json'})
    save_json(ROOT/'Rig'/'rig.json',rig_data())
    print('Exported 100 frames, 4.00s, transparent WebP and 8-column sprite sheet.')
if __name__=='__main__':
    if sys.argv[1]=='sample':sample()
    elif sys.argv[1]=='full':
        state=json.loads((ROOT/'keyframes.json').read_text())
        if state['status']=='additional-growth-keys-awaiting-user-approval':
            raise RuntimeError('추가 성장 키프레임 확인 전에는 전체 출력을 만들 수 없습니다.')
        full()
