from pathlib import Path
import json,math,sys
import numpy as np
import cv2
from PIL import Image,WebPImagePlugin
ROOT=Path(__file__).resolve().parents[5]
BASE=ROOT/'DesignAssets/Animations/Nests/SporeLevel02-v4'
WORK=ROOT/'$Trash/SporeTearRepair-20261030'
YY,XX=np.mgrid[0:512,0:512].astype(np.float32)
def read(path):return Image.open(BASE/path).convert('RGBA')
def pre(im):
    a=np.array(im).astype(np.float32)/255;a[:,:,3]=np.where(a[:,:,3]>.97,1,a[:,:,3]);a[:,:,:3]*=a[:,:,3:4];return a
def rgba(a):
    if not np.isfinite(a).all():raise ValueError('Non-finite rendered pixels')
    alpha=np.clip(a[:,:,3:4],0,1);rgb=a[:,:,:3]/np.maximum(alpha,1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)),'RGBA')
def over(a,b):return a+b*(1-a[:,:,3:4])
def savej(path,data):path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
def bounds(im):
    a=np.array(im)[:,:,3];y,x=np.where(a>24);return(int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1))
def place(im,width,cx,bottom):
    b=bounds(im);part=im.crop(b);scale=width/part.width
    part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(512,512));out.paste(part,(round(cx-part.width/2),round(bottom-part.height)));return out
def partfit(im,box):
    part=im.crop(bounds(im)).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(512,512));out.paste(part,box[:2]);return out
def smooth(t):
    t=float(np.clip(t,0,1));return t*t*t*(10+t*(-15+6*t))
def phase(t,start,end):return smooth((t-start)/(end-start))
def envelope(t):
    if t<.2:return 0
    if t<1.7:return phase(t,.2,1.7)
    if t<1.95:return 1
    return 1-phase(t,1.95,3.65)
def affine(a,sx,sy,dx,dy):
    mx=(XX-256-dx)/sx+256;my=(YY-448-dy)/sy+448
    return cv2.remap(a,np.ascontiguousarray(mx,np.float32),np.ascontiguousarray(my,np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def rigid(a,pivot,angle,dx,dy):
    c=math.cos(math.radians(angle));q=math.sin(math.radians(angle))
    x=XX-pivot[0]-dx;y=YY-pivot[1]-dy
    mx=pivot[0]+c*x+q*y;my=pivot[1]-q*x+c*y
    return cv2.remap(a,np.ascontiguousarray(mx,np.float32),np.ascontiguousarray(my,np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def headwarp(a,bind,close,lift,left,right,tip):
    anchor=bind['lip'];top=bind['top'];radius=bind['width']/2
    u=np.clip(np.abs(XX-bind['headCenter'])/radius,0,1)
    local=np.where(XX<256,left,right)
    offset=2*u*(1-u)*local+u*u*tip
    ys=(1-close)+close*(bind['closedHeight']/(anchor-top))
    dy=close*(bind['closedLip']-anchor)-lift
    closed_tip=(7-(bind['wing']-anchor)*bind['closedHeight']/(anchor-top)*(1-.85*close))*u*u*close
    distance=YY-anchor-dy-offset-closed_tip
    my=distance/(ys*np.where(distance>0,1-.85*close,1))+anchor
    return cv2.remap(a,np.ascontiguousarray(XX,np.float32),np.ascontiguousarray(my,np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def source(name):
    im=read('Sources/'+name+'.png');p=np.array(im).copy()
    bad=(p[:,:,0]>200)&(p[:,:,1]<45)&(p[:,:,2]<45)
    p[bad,3]=0
    core=np.uint8(p[:,:,3]>64)
    count,labels,stats,centers=cv2.connectedComponentsWithStats(core,8)
    main=1+int(np.argmax(stats[1:,4]))
    keep=cv2.dilate(np.uint8(labels==main),np.ones((5,5),np.uint8))
    p[:,:,3]*=keep;p[p[:,:,3]==0]=0
    if name.startswith('canopy'):
        edge=cv2.distanceTransform(np.uint8(p[:,:,3]>8),cv2.DIST_L2,5)
        red=(p[:,:,0]>180)&(p[:,:,1]<100)&(p[:,:,2]<100)&(p[:,:,0]>2*p[:,:,1].astype(np.uint16))&(p[:,:,0]>2*p[:,:,2].astype(np.uint16))
        fix=red&(edge<5)&(p[:,:,3]>0)
        valid=np.uint8((p[:,:,3]>160)&(~red))
        distance,nearest=cv2.distanceTransformWithLabels(1-valid,cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
        colors=np.zeros((int(nearest.max())+1,3),np.uint8);colors[nearest[valid>0]]=p[:,:,:3][valid>0]
        p[:,:,:3][fix]=colors[nearest][fix]
    return Image.fromarray(p,'RGBA')
def split(level):
    top,wing,width,bw,cx={1:(249,364,300,220,256),2:(157,325,402,310,256),3:(111,303,436,334,246)}[level]
    body=pre(place(source('body-01'if level==1 else'body'),bw,244 if level==3 else 256,448))
    rear=pre(partfit(source('canopy-03'if level==3 else'canopy'),(round(cx-width/2),top,round(cx+width/2),wing)))
    straight=np.array(rgba(rear)).astype(np.float32)/255
    cut=np.full(512,float(wing),np.float32)
    for x in range(512):
        rows=np.where(straight[:,x,3]>.1)[0]
        if not len(rows):continue
        bright=np.where((straight[:,x,0]>.78)&(straight[:,x,3]>.5))[0]
        first=int(bright.min())if len(bright)else int(rows.min())
        for y in range(first+4,min(wing-2,511)):
            if np.all(straight[y:y+3,x,0]<.72)and np.all(straight[y:y+3,x,3]>.4):
                cut[x]=y;break
    cut=np.median(np.lib.stride_tricks.sliding_window_view(np.pad(cut,(4,4),'edge'),9),1).astype(np.float32)
    cut=cv2.GaussianBlur(cut.reshape((1,512)),(9,1),1.3)[0]
    inside=cv2.erode(np.float32(rear[:,:,3]>.05),np.ones((3,3),np.uint8))
    frontmask=np.clip(cut[None,:]+.5-YY,0,1)*inside
    front=rear*frontmask[:,:,None]
    brgba=np.array(rgba(body)).astype(np.float32)/255
    egg=(brgba[:,:,0]-brgba[:,:,1]>.2)&(brgba[:,:,3]>.8)
    eggbottom=int(np.where(egg)[0].max())
    fore=body*np.float32(YY>eggbottom+2)[:,:,None]
    layers={'rear-canopy':rear,'body':body,'canopy-front':front,'cradle-front':fore}
    if level==3:
        whole=pre(place(source('mechanism'),438,263,419))
        layers['mechanism-frame']=pre(place(source('frame'),266,260,333))
        layers['vent-left']=whole*np.float32((XX<179)&(YY<322)&(YY>225))[:,:,None]
        layers['vent-right']=whole*np.float32((XX>347)&(YY<322)&(YY>225))[:,:,None]
        layers['blower']=whole*np.float32((XX>355)&(YY>317))[:,:,None]
    for name,data in layers.items():rgba(data).save(BASE/'Parts'/('level-0'+str(level)+'-'+name+'.png'))
    lip=float(cut[round(cx)])
    bind={'lip':lip,'top':top,'wing':wing,'width':width,'bodyWidth':bw,'closedHeight':150*width/402,'closedLip':eggbottom+3,'headCenter':cx,'bodyCenter':244 if level==3 else 256}
    return{'layers':layers,'bind':bind,'ref':read('References/approved-level-0'+str(level)+'.png')}
RIGS={i:split(i)for i in [1,2,3]}
def stemwarp(a,level,close):
    pivot=360 if level==1 else 330
    sy=1-.92*close
    my=np.where(YY<pivot,pivot+(YY-pivot)/sy,YY).astype(np.float32)
    return cv2.remap(a,np.ascontiguousarray(XX,np.float32),np.ascontiguousarray(my,np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))
def posed(level,close,lift,left,right,tip,pack_y,body_scale,head_scale,body_x,head_x):
    rig=RIGS[level];p=rig['layers'];b=rig['bind']
    growth=float(np.clip((b['width']*head_scale-300)/102,0,1))
    target=RIGS[1]['bind']['closedLip']+(RIGS[2]['bind']['closedLip']-RIGS[1]['bind']['closedLip'])*growth
    y=close*(target-(448+(b['closedLip']-448)*head_scale))
    rear=affine(headwarp(p['rear-canopy'],b,close,lift,left,right,tip),head_scale,head_scale,head_x,y)
    front=affine(headwarp(p['canopy-front'],b,close,lift,left,right,tip),head_scale,head_scale,head_x,y)
    body=affine(stemwarp(p['body'],level,close),body_scale,body_scale,body_x,0)
    out=over(body,rear)
    if level==3:
        fold=float(np.clip(max(close,pack_y/140),0,1))
        out=over(rigid(p['blower'],(367,319),-90*fold,-150*fold,60*fold),out)
        out=over(affine(p['mechanism-frame'],1,1,0,90*fold),out)
        out=over(affine(p['vent-left'],1,1,150*fold,60*fold),out)
        out=over(affine(p['vent-right'],1,1,-150*fold,60*fold),out)
    out=over(front,out)
    if close>0:out=over(affine(p['cradle-front'],body_scale,body_scale,body_x,0),out)
    return out
def pose(level,close,lift,left,right,tip,pack_y):
    return posed(level,close,lift,left,right,tip,pack_y,1,1,0,0)
def pack(frames,path,columns):
    sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
    for i,im in enumerate(frames):sheet.paste(im,(i%columns*512,i//columns*512))
    if path.suffix=='.webp':
        sheet.encoderinfo={'lossless':True,'method':4,'exact':True}
        with path.open('wb')as f:WebPImagePlugin._save(sheet,f,str(path))
    else:sheet.save(path)
def preview(frames,path,timing):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':timing,'loop':0,'lossless':True,'method':4,'exact':True}
    with path.open('wb')as f:WebPImagePlugin._save_all(frames[0],f,str(path))
def contact(frames,names,path):
    out=Image.new('RGB',(1536,384*math.ceil(len(names)/4)),'#13201c')
    for j,i in enumerate(names):
        bg=Image.new('RGB',(512,512),'#13201c');bg.paste(frames[i],(0,0),frames[i])
        out.paste(bg.resize((384,384),Image.Resampling.LANCZOS),(j%4*384,j//4*384))
    out.save(path)
def output(name,frames,timing,columns,metadata):
    folder=BASE/name
    pack(frames,folder/('idle.webp'if name=='Idle'else'growth.png'),columns)
    preview(frames,folder/'preview.webp',timing)
    metadata.update({'frameSize':[512,512],'frameCount':len(frames),'columns':columns,'rows':math.ceil(len(frames)/columns),'durationsMs':timing,'durationMs':sum(timing),'root':[256,448],'loop':name=='Idle','method':'complete-layered-parts-and-continuous-canopy-deformation'})
    savej(folder/'animation.json',metadata)
    frames[0].save(folder/'start.png');frames[-1].save(folder/'end.png')
    contact(frames,[0,len(frames)//8,len(frames)//4,len(frames)*3//8,len(frames)//2,len(frames)*5//8,len(frames)*3//4,len(frames)-1],WORK/(name+'-contact.png'))
def idle():
    frames=[]
    for i in range(80):
        t=i*.05;q=envelope(t);l=envelope(max(0,t-.055));r=envelope(max(0,t-.11))
        frames.append(rgba(pose(2,0,4*q,-4*l,-4*r,-9*q,0)))
    output('Idle',frames,[50]*80,10,{'timeline':[{'frame':i,'seconds':i*.05,'root':[256,448],'lift':4*envelope(i*.05),'leftBend':-4*envelope(max(0,i*.05-.055)),'rightBend':-4*envelope(max(0,i*.05-.11)),'tipBend':-9*envelope(i*.05)}for i in range(80)],'frameMs':50,'restMs':0,'rootMotion':False,'rig':'../Build/rig.json'})
def growth12():
    frames=[];timeline=[]
    for i in range(61):
        t=0 if i==0 else .6+(i-1)*.08
        closed=phase(t,.6,1.08)*(1-phase(t,3.16,3.88));g=phase(t,1.56,2.36)
        level=1 if g<.5 else 2
        width=300+102*g;bodywidth=220+90*g
        b=RIGS[level]['bind']
        hs=width/b['width'];bs=bodywidth/b['bodyWidth']
        value=posed(level,closed,0,0,0,0,0,bs,hs,0,0)
        if i==0:value=pre(RIGS[1]['ref'])
        if t>=3.88:value=pre(RIGS[2]['ref'])
        frame=RIGS[1]['ref'].copy()if i==0 else RIGS[2]['ref'].copy()if t>=3.88 else rgba(value)
        frames.append(frame);timeline.append({'frame':i,'seconds':t,'rig':level,'closed':closed,'growth':g,'root':[256,448]})
    output('Growth01To02',frames,[600]+[80]*59+[1000],8,{'audio':{'src':'DesignAssets/Audio/NestGrowthV3/spore.mp3','startMs':600,'volume':1,'loop':False},'markersMs':{'lowerStart':600,'lowered':1080,'growthStart':1560,'growthEnd':2360,'liftStart':3160,'liftEnd':3880},'timeline':timeline})
def growth23():
    frames=[];timeline=[]
    for i in range(81):
        t=0 if i==0 else .5+(i-1)*.04
        closed=phase(t,.5,1.18)*(1-phase(t,2.22,3.18));g=phase(t,1.42,2.18)
        level=2 if g<.5 else 3
        b=RIGS[level]['bind'];hs=(402+34*g)/b['width'];bs=(310+24*g)/b['bodyWidth']
        body_x=(256-12*g)-(256+(b['bodyCenter']-256)*bs)
        head_x=(256-10*g)-(256+(b['headCenter']-256)*hs)
        value=posed(level,closed,0,0,0,0,140*closed+70*(1-g)if level==3 else 0,bs,hs,body_x,head_x)
        if i==0:value=pre(RIGS[2]['ref'])
        if t>=3.66:value=pre(RIGS[3]['ref'])
        frame=RIGS[2]['ref'].copy()if i==0 else RIGS[3]['ref'].copy()if t>=3.66 else rgba(value)
        frames.append(frame);timeline.append({'frame':i,'seconds':t,'rig':level,'closed':closed,'growth':g})
    output('Growth02To03',frames,[500]+[40]*79+[900],8,{'audio':{'src':'DesignAssets/Audio/NestGrowth02To03-v1/spore.mp3','startMs':500,'volume':1,'loop':False},'markersMs':{'closeStart':500,'closed':1180,'assemblyStart':1420,'assemblyEnd':2180,'openStart':2220,'openEnd':3180,'mechanismStart':3180,'mechanismEnd':3660},'timeline':timeline})
for level in [1,2,3]:
    neutral=rgba(pose(level,0,0,0,0,0,0))
    neutral.save(BASE/'References'/('level-0'+str(level)+'.png'))
    RIGS[level]['ref']=neutral
meshes={}
for level,rig in RIGS.items():
    b=rig['bind'];cx=b['headCenter'];w=b['width']
    vertices=np.array([(x,y)for y in np.linspace(b['top']-3,b['wing']+3,17)for x in np.linspace(cx-w/2-3,cx+w/2+3,33)])
    u=np.clip(np.abs(vertices[:,0]-cx)/(w/2),0,1)
    left=vertices[:,0]<cx
    weights=np.column_stack([(1-u)**2,np.where(left,2*u*(1-u),0),np.where(left,u*u,0),np.where(~left,2*u*(1-u),0),np.where(~left,u*u,0)])
    triangles=[]
    for row in range(16):
        for col in range(32):
            k=row*33+col;triangles.extend([[k,k+1,k+33],[k+1,k+34,k+33]])
    meshes[str(level)]={'vertices':vertices.tolist(),'triangles':triangles,'bones':['canopy','left-base','left-tip','right-base','right-tip'],'weights':weights.tolist()}
savej(BASE/'Build/mesh.json',meshes)
savej(BASE/'Build/rig.json',{'root':[256,448],'bones':{'root':None,'stem':'root','canopy':'stem','left-base':'canopy','left-tip':'left-base','right-base':'canopy','right-tip':'right-base','mechanism-frame':'root','vent-left':'mechanism-frame','vent-right':'mechanism-frame','blower':'vent-right','cradle-front':'root'},'drawOrder':['rear-canopy','body','blower','mechanism-frame','vent-left','vent-right','canopy-front','cradle-front'],'canopyDeformation':{'method':'continuous inverse UV map','weights':['(1-u)^2','2*u*(1-u)','u^2'],'u':'abs(x-256)/(width/2)','transparentGaps':False},'parts':{str(i):{'bind':v['bind'],'sources':list(v['layers'])}for i,v in RIGS.items()},'fixedDuringIdle':['cradle','eggs','ground'],'mechanismRig':{'frameTranslation':[0,90],'leftVentTranslation':[150,60],'rightVentTranslation':[-150,60],'blowerPivot':[367,319],'blowerRotationDegrees':-90,'clipping':False},'growthScaleIntentional':True})
if __name__=='__main__':
    for name,fn in [('idle',idle),('growth12',growth12),('growth23',growth23)]:
        if len(sys.argv)==1 or name in sys.argv[1:]:print(name,flush=True);fn()
