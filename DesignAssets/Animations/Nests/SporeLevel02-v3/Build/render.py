from pathlib import Path
import json, math, sys
import numpy as np
import cv2
from PIL import Image, WebPImagePlugin
from riglib import rgba, over
ROOT=Path(__file__).resolve().parents[5]
BASE=ROOT/'DesignAssets/Animations/Nests/SporeLevel02-v3'
WORK=ROOT/'$Trash/SporeLevel02-Apply-20261030'
Y,X=np.mgrid[0:512,0:512].astype(np.float32)

def read(name):
    return Image.open(BASE/name).convert('RGBA')
def premul(im):
    p=np.array(im.convert('RGBA')).astype(np.float32)/255
    p[:,:,:3]*=p[:,:,3:4]
    return p
def write_json(path,data):
    path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
def poly(points):
    m=np.zeros((512,512),np.uint8)
    cv2.fillPoly(m,[np.int32(np.array(points)*8)],255,cv2.LINE_8,3)
    return m.astype(np.float32)/255
def clean(im):
    p=np.array(im.convert('RGBA')).copy()
    core=np.uint8(p[:,:,3]>100)
    edge=core-cv2.erode(core,np.ones((7,7),np.uint8))
    r,g,b=[p[:,:,i] for i in range(3)]
    keyed=((r>220)&(g<65)&(b<70))|((r>170)&(g>145)&(b<65))|((r<50)&(g>205)&(b<100))
    core[(edge>0)&keyed]=0
    n,labels,stats,centers=cv2.connectedComponentsWithStats(core,8)
    keep=np.zeros(n,np.uint8)
    for i in range(1,n):
        if stats[i,4]>=20:keep[i]=1
    core=keep[labels]
    alpha=cv2.GaussianBlur(core.astype(np.float32),(3,3),.4)
    inner=cv2.erode(core,np.ones((3,3),np.uint8))
    if inner.any():
        dist,nearest=cv2.distanceTransformWithLabels(1-inner,cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
        colors=np.zeros((int(nearest.max())+1,3),np.uint8);colors[nearest[inner>0]]=p[:,:,:3][inner>0]
        rim=(p[:,:,3]<245)|(inner==0);p[:,:,:3][rim]=colors[nearest][rim]
    p[:,:,3]=np.uint8(np.clip(alpha*255+.5,0,255));p[p[:,:,3]==0]=0
    return Image.fromarray(p,'RGBA')
def bbox(im):
    a=np.array(im)[:,:,3];yy,xx=np.where(a>24)
    return (int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1))
def fit(im,box):
    a=bbox(im);part=im.crop(a).resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(512,512));out.paste(part,box[:2]);return out
def extract(name,columns,rows):
    im=read(name);p=np.array(im)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(p[:,:,3]>110),8)
    main=[i for area,i in sorted([(int(stats[i,4]),i)for i in range(1,n)if stats[i,4]>1000])[::-1]][:columns*rows]
    main=[i for cy,i in sorted([(float(centers[i,1]),i)for i in main])]
    ordered=[]
    for row in range(rows):
        ordered.extend([i for cx,i in sorted([(float(centers[i,0]),i)for i in main[row*columns:(row+1)*columns]])])
    if len(ordered)!=columns*rows:raise ValueError(('missing drawings',name,len(ordered)))
    out=[]
    for label in ordered:
        selected=np.uint8(labels==label);selected=cv2.dilate(selected,np.ones((3,3),np.uint8))
        pixels=p.copy();pixels[:,:,3]=np.minimum(pixels[:,:,3],selected*255)
        full=clean(Image.fromarray(pixels,'RGBA'));out.append(full.crop(bbox(full)))
    return out
def animate(frames,path,durations):
    path.parent.mkdir(511,True,True)
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
    with path.open('wb')as f:WebPImagePlugin._save_all(frames[0],f,str(path))
def pack(frames,path,columns):
    sheet=Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
    for i,im in enumerate(frames):sheet.paste(im,(i%columns*512,i//columns*512))
    if path.suffix=='.webp':
        sheet.encoderinfo={'lossless':True,'quality':100,'method':4}
        with path.open('wb')as f:WebPImagePlugin._save(sheet,f,str(path))
    else:sheet.save(path)
def contact(frames,indices,path):
    out=Image.new('RGB',(1536,384*math.ceil(len(indices)/4)),'#13201c')
    for j,i in enumerate(indices):
        bg=Image.new('RGB',(512,512),'#13201c');bg.paste(frames[i],(0,0),frames[i])
        out.paste(bg.resize((384,384),Image.Resampling.LANCZOS),(j%4*384,j//4*384))
    out.save(path)
def grid(layer):
    yy,xx=np.where(layer[:,:,3]>.01)
    vertices=np.array([(x,y)for y in np.linspace(max(0,yy.min()-4),min(511,yy.max()+4),13)
                       for x in np.linspace(max(0,xx.min()-4),min(511,xx.max()+4),23)],np.float32)
    triangles=[]
    for row in range(12):
        for col in range(22):
            i=row*23+col;triangles.extend([(i,i+1,i+23),(i+1,i+24,i+23)])
    return vertices,triangles
def warp(layer,vertices,target,triangles):
    if np.max(np.abs(vertices-target))<1e-6:return layer.copy()
    mx=np.full((512,512),-10,np.float32);my=mx.copy()
    for tri in triangles:
        src=vertices[list(tri)].astype(np.float32);dst=target[list(tri)].astype(np.float32)
        x,y,w,h=cv2.boundingRect(dst);l,t=max(0,x),max(0,y);r,b=min(512,x+w+1),min(512,y+h+1)
        if r<=l or b<=t:continue
        mask=np.zeros((b-t,r-l),np.uint8);cv2.fillConvexPoly(mask,np.int32(np.round((dst-[l,t])*256)),1,cv2.LINE_8,8)
        m=cv2.getAffineTransform(dst,src);yy,xx=np.mgrid[t:b,l:r];a=mask>0
        mx[t:b,l:r][a]=(xx*m[0,0]+yy*m[0,1]+m[0,2])[a];my[t:b,l:r][a]=(xx*m[1,0]+yy*m[1,1]+m[1,2])[a]
    return cv2.remap(layer,mx,my,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)
def rot(points,pivot,angle):
    a=math.radians(angle);r=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    return(points-pivot)@r.T+pivot
def smooth(t):
    t=float(np.clip(t,0,1));return t*t*t*(10+t*(-15+6*t))
def breath(t):
    if t<.06:return 0
    if t<.40:return smooth((t-.06)/.34)
    if t<.48:return 1
    return 1-smooth((t-.48)/.45)
def idle():
    reference=read('References/level-02.png');ref=premul(reference)
    parts=extract('Sources/parts-atlas.png',2,2)
    r,g,b=[ref[:,:,i]for i in range(3)]
    candidate=np.uint8((ref[:,:,3]>.5)&(r-g>.18)&(r>b*1.08))
    count,labels,stats,centers=cv2.connectedComponentsWithStats(candidate,8)
    main=1+int(np.argmax(stats[1:,4]));core=np.uint8(labels==main)
    contours,hierarchy=cv2.findContours(core,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(core,contours,-1,1,-1)
    near=cv2.dilate(core,np.ones((11,11),np.uint8))
    rim=(r-g>.10)|((r<.6)&(g<.6)&(b<.6))
    domain=poly([(0,0),(512,0),(512,300),(426,305),(397,308),(373,316),(354,319),(332,311),
        (307,307),(298,287),(294,266),(294,258),(226,258),(225,279),(215,299),(202,308),
        (177,309),(148,323),(123,314),(95,308),(58,300),(0,300)])
    domain=cv2.dilate(domain,np.ones((11,11),np.uint8))
    region=np.float32((core>0)|((near>0)&rim))*domain
    hidden_cap=premul(fit(parts[0],(55,155,457,327)))*np.float32(ref[:,:,3]>.99)[:,:,None]*(1-region)[:,:,None]
    canopy=over(ref*region[:,:,None],hidden_cap)
    hidden_stem=premul(fit(parts[1],(102,234,411,448)))
    stem_mask=poly([(225,239),(292,239),(300,291),(307,313),(205,316),(219,286)])
    hidden_stem*=region[:,:,None]*stem_mask[:,:,None]*np.float32(ref[:,:,3]>.99)[:,:,None]
    body=over(ref*(1-region)[:,:,None],hidden_stem)
    front=ref*region[:,:,None]*stem_mask[:,:,None]
    for name,value in [('canopy',canopy),('body',body),('canopy-front',front)]:rgba(value).save(BASE/'Parts'/(name+'.png'))
    vertices,triangles=grid(canopy);dx=np.abs(vertices[:,0]-256)
    rim=np.clip((vertices[:,1]-178)/140,0,1)**1.3
    influence=np.clip(dx/150,0,1)*rim;outer=np.clip((dx-65)/130,0,1)
    weights=np.column_stack([1-influence,influence*(1-outer),influence*outer])
    frames=[]
    for i in range(80):
        t=i/80;target=vertices.astype(np.float64).copy()
        for side in [-1,1]:
            use=np.where((vertices[:,0]-256)*side>=0)[0];p=vertices[use].astype(np.float64)
            q=breath(t-(.025 if side==1 else 0));qa=breath(t-.045)
            pivot=np.array([256,260]);joint=np.array([256+side*87,276])
            a=rot(p,pivot,-side*2.4*q);b=rot(rot(p,joint,-side*3.0*qa),pivot,-side*2.4*q)
            w=weights[use];target[use]=p*w[:,:1]+a*w[:,1:2]+b*w[:,2:3]
        value=over(warp(front,vertices,target,triangles),over(body,warp(canopy,vertices,target,triangles)))
        frames.append(rgba(value))
    folder=BASE/'Idle';folder.mkdir(511,True,True)
    pack(frames,folder/'idle.webp',10);animate(frames,folder/'preview.webp',[50]*80)
    write_json(folder/'animation.json',{'frameSize':[512,512],'frameCount':80,'columns':10,'rows':8,'frameMs':50,'restMs':0,'durationsMs':[50]*80,'loop':True,'root':[256,448],'rootMotion':False,'reference':'../References/level-02.png','rig':'rig.json'})
    write_json(folder/'rig.json',{'root':[256,448],'bones':{'root':None,'stem':'root','canopy':'stem','left-base':'canopy','right-base':'canopy','left-rim':'left-base','right-rim':'right-base'},'pivot':[256,260],'mesh':{'vertices':vertices.tolist(),'triangles':triangles,'weights':weights.tolist(),'branchByX':256},'parts':['../Parts/canopy.png','../Parts/body.png','../Parts/canopy-front.png'],'drawOrder':['canopy','body','canopy-front'],'fixed':['nursery','eggs','ground']})
    contact(frames,[0,10,20,30,40,50,60,70],WORK/'idle-contact.png')
def keyframes(name,start_width,end_width):
    cells=extract(name,4,4);poses=[];record=[]
    for i,im in enumerate(cells):
        if '01-to-02' in name:
            width=start_width if i<7 else round(start_width+(end_width-start_width)*smooth((i-6)/6)) if i<12 else end_width
        else:
            width=round(start_width+(end_width-start_width)*smooth(max(0,i-3)/10))
        b=bbox(im);scale=width/(b[2]-b[0]);resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(512,512));canvas.paste(resized,(round(256-(b[0]+b[2])*scale/2),round(448-b[3]*scale)))
        poses.append(canvas);record.append({'drawing':i,'width':width,'scale':scale,'root':[256,448]})
    return poses,record
def growth12():
    poses,registration=keyframes('Sources/growth-01-to-02.png',300,402)
    old=Image.open(ROOT/'DesignAssets/Animations/Nests/Growth01To02-v3/spore/growth.png').convert('RGBA')
    frames=[];schedule=[]
    for i in range(61):
        if i<=12:
            frames.append(old.crop((i%8*512,i//8*512,i%8*512+512,i//8*512+512)));schedule.append('approved-lowering-'+str(i));continue
        cel=7 if i<16 else 8 if i<19 else 9 if i<23 else 10 if i<33 else 11 if i<36 else 12 if i<39 else 13 if i<41 else 14 if i<42 else None
        frames.append(poses[cel].copy()if cel is not None else read('References/level-02.png'));schedule.append(cel)
    export_growth('Growth01To02',frames,[600]+[80]*59+[1000],{'source':'../Sources/growth-01-to-02.png','poseSchedule':schedule,'registration':registration,'audio':{'src':'DesignAssets/Audio/NestGrowthV3/spore.mp3','sourceProcessing':'segment-cutting-and-placement','startMs':600,'volume':1,'loop':False},'markersMs':{'lowerStart':600,'lowered':1080,'growthStart':1560,'growthEnd':2360,'liftStart':3160,'liftEnd':3880}})
def growth23():
    poses,registration=keyframes('Sources/growth-02-to-03.png',402,480)
    frames=[];schedule=[]
    for i in range(81):
        cel=1 if i<=6 else 2 if i<=12 else 3 if i<=23 else min(8,4+(i-24)//4)if i<=43 else min(15,9+(i-44)*7//24)if i<68 else None
        frame=read('References/level-02.png')if i==0 else poses[cel].copy()if cel is not None else read('References/level-03.png')
        frames.append(frame);schedule.append(cel if i else 'reference')
    export_growth('Growth02To03',frames,[500]+[40]*79+[900],{'source':'../Sources/growth-02-to-03.png','poseSchedule':schedule,'registration':registration,'audio':{'src':'DesignAssets/Audio/NestGrowth02To03-v1/spore.mp3','startMs':500,'volume':1,'loop':False},'markersMs':{'closeStart':500,'closed':1180,'assemblyStart':1420,'assemblyEnd':2180,'openStart':2220,'openEnd':3180,'mechanismStart':3180,'mechanismEnd':3660}})
def export_growth(name,frames,durations,metadata):
    folder=BASE/name;folder.mkdir(511,True,True)
    pack(frames,folder/'growth.png',8);animate(frames,folder/'preview.webp',durations)
    frames[0].save(folder/'start.png');frames[-1].save(folder/'end.png')
    metadata.update({'method':'registered-drawn-key-poses','frameSize':[512,512],'frameCount':len(frames),'columns':8,'rows':math.ceil(len(frames)/8),'root':[256,448],'durationsMs':durations,'durationMs':sum(durations),'loop':False,'previewRepeats':True})
    write_json(folder/'animation.json',metadata)
    contact(frames,[0,6,12,18,23,33,41,len(frames)-1],WORK/(name+'-contact.png'))
if __name__=='__main__':
    for name,fn in [('idle',idle),('growth12',growth12),('growth23',growth23)]:
        if len(sys.argv)==1 or name in sys.argv[1:]:
            print(name,flush=True);fn()
