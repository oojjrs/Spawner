from pathlib import Path
import sys
from PIL import Image, ImageDraw, WebPImagePlugin
import numpy as np
import cv2
import json
import math
WORK=Path(__file__).resolve().parent
Y,X=np.mgrid[0:512,0:512].astype(np.float32)
ATLAS={}
CACHE={}
USED={}
SAMPLES=[0,12,24,40,52,60,70,80,88,100]

def ease(t):
    t=float(np.clip(t,0,1))
    return t*t*t*(10+t*(-15+6*t))

def pm(im):
    data=np.array(im.convert('RGBA')).astype(np.float32)/255
    data[:,:,:3]*=data[:,:,3:4]
    return data

def image(data):
    alpha=np.clip(data[:,:,3:4],0,1)
    rgb=data[:,:,:3]/np.maximum(alpha,1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)))

def over(a,b):
    return a+b*(1-a[:,:,3:4])

def poly(points):
    mask=Image.new('L',(512,512));ImageDraw.Draw(mask).polygon(points,255)
    return np.array(mask)>0

def crop_alpha(im):
    data=np.array(im.convert('RGBA'));yy,xx=np.where(data[:,:,3]>=32)
    return im.crop((max(0,int(xx.min())-1),max(0,int(yy.min())-1),min(im.width,int(xx.max())+2),min(im.height,int(yy.max())+2)))

def cell(tribe,cols,rows,index):
    if tribe not in ATLAS:ATLAS[tribe]=Image.open(WORK/tribe/'parts-atlas.png').convert('RGBA')
    im=ATLAS[tribe];col,row=index%cols,index//cols
    im=im.crop((round(col*im.width/cols),round(row*im.height/rows),round((col+1)*im.width/cols),round((row+1)*im.height/rows)))
    data=np.array(im);count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(data[:,:,3]>80),8)
    if count<2:raise ValueError(('missing part',tribe,index))
    main=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]));keep=cv2.dilate(np.uint8(labels==main),np.ones((3,3),np.uint8))
    data[:,:,3]*=keep
    return crop_alpha(Image.fromarray(data))

def place(im,box):
    im=crop_alpha(im).convert('RGBa').resize((int(box[2]-box[0]),int(box[3]-box[1])),Image.Resampling.LANCZOS).convert('RGBA')
    result=Image.new('RGBA',(512,512));result.alpha_composite(im,(int(box[0]),int(box[1])))
    return pm(result)

def translated(layer,x,y):
    matrix=np.array([[1,0,x],[0,1,y]],np.float32)
    return cv2.warpAffine(layer,matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT)

def transform(layer,pivot,angle,offset):
    angle=math.radians(angle);c,s=math.cos(angle),math.sin(angle)
    dx,dy=X-pivot[0]-offset[0],Y-pivot[1]-offset[1]
    xx,yy=dx*c+dy*s+pivot[0],-dx*s+dy*c+pivot[1]
    return cv2.remap(layer,xx.astype(np.float32),yy.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)

def grow(layer,start,span,frame,offset,angle,pivot):
    progress=ease((frame-start)/span)
    if progress<=0:return np.zeros_like(layer)
    initial=transform(layer,pivot,angle,(0,0))
    occupied=np.where(initial[:,:,3]>.02)[0]
    if not len(occupied):return np.zeros_like(layer)
    height=max(offset[1],450-int(occupied.min()))
    return transform(layer,pivot,angle*(1-progress),(offset[0]*(1-progress),height*(1-progress)))*(Y<=448)[:,:,None]

def outline(layer,count):
    contours,unused=cv2.findContours(np.uint8(layer[:,:,3]>.12),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    curve=contours[int(np.argmax([cv2.contourArea(contour) for contour in contours]))][:,0].astype(np.float64);center=curve.mean(0)
    angles=np.arctan2(curve[:,1]-center[1],curve[:,0]-center[0])
    if np.sum(np.diff(np.unwrap(angles)))<0:curve=curve[::-1]
    start=int(np.argmax(curve[:,1]-np.abs(curve[:,0]-center[0])*.3));curve=np.roll(curve,-start,0)
    closed=np.r_[curve,curve[:1]];distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(closed,1,0),None,1))]
    samples=np.linspace(0,distance[-1],count,False)
    points=np.column_stack([np.interp(samples,distance,closed[:,axis]) for axis in [0,1]])
    return np.r_[points,center[None,:]]

def warp(layer,source,target):
    if np.max(np.abs(source-target))<1e-5:return layer.copy()
    delta=target[:,None]-target[None,:];radius=np.sum(delta*delta,2)
    kernel=radius*np.log(radius+1e-6);affine=np.column_stack([np.ones(len(target)),target])
    system=np.block([[kernel+np.eye(len(target))*.08,affine],[affine.T,np.zeros((3,3))]])
    weights=np.linalg.solve(system,np.r_[source,np.zeros((3,2))])
    left,top=np.maximum(0,np.floor(target.min(0)-4)).astype(int);right,bottom=np.minimum(512,np.ceil(target.max(0)+5)).astype(int)
    xx,yy=X[top:bottom,left:right],Y[top:bottom,left:right]
    field=weights[-3]+xx[:,:,None]*weights[-2]+yy[:,:,None]*weights[-1]
    for point,weight in zip(target,weights[:-3]):
        rr=(xx-point[0])**2+(yy-point[1])**2;field+=(rr*np.log(rr+1e-6))[:,:,None]*weight
    result=np.zeros_like(layer)
    result[top:bottom,left:right]=cv2.remap(layer,field[:,:,0].astype(np.float32),field[:,:,1].astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    return result

def material(layer):
    if id(layer) not in CACHE:
        rgb=layer[:,:,:3]/np.maximum(layer[:,:,3:4],1e-6)
        rgb=cv2.inpaint(np.uint8(np.clip(rgb*255,0,255)),np.uint8(layer[:,:,3]<.9)*255,3,cv2.INPAINT_TELEA).astype(np.float32)/255
        CACHE[id(layer)]=(layer,np.concatenate([rgb,np.ones((512,512,1),np.float32)],2))
    return CACHE[id(layer)][1]

def morph(a,b,p):
    if p<=0:return a
    if p>=1:return b
    pa,pb=outline(a,40),outline(b,40);target=pa*(1-p)+pb*p
    first,last=warp(material(a),pa,target),warp(material(b),pb,target)
    shape=np.zeros((512,512),np.uint8);cv2.fillPoly(shape,[np.int32(target[:-1]*8)],255,cv2.LINE_AA,3)
    return (first*(1-p)+last*p)*(shape.astype(np.float32)/255)[:,:,None]

def complete(source,owner,part,fill,mask,fronts):
    own=source*(owner==part)[:,:,None];hidden=mask&np.isin(owner,fronts)&(source[:,:,3]>.95)
    return over(own,fill*hidden[:,:,None])

def save_parts(tribe,layers):
    folder=WORK/tribe/'Parts';folder.mkdir(511,True,True)
    USED[tribe]=[str(name)+'.png' for name in layers]
    for name,layer in layers.items():image(layer).save(folder/(str(name)+'.png'))

def scene(layers,order):
    value=np.zeros((512,512,4),np.float32)
    for part in order:value=over(layers[part],value)
    return value

def two_link(root,joint,tip,target):
    root,joint,tip,target=[np.array(v,float) for v in [root,joint,tip,target]]
    l1,l2=np.linalg.norm(joint-root),np.linalg.norm(tip-joint);d=float(np.clip(np.linalg.norm(target-root),abs(l1-l2)+.01,l1+l2-.01))
    direction=math.atan2(target[1]-root[1],target[0]-root[0]);offset=math.acos(float(np.clip((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)))
    choices=[root+l1*np.array([math.cos(direction+sign*offset),math.sin(direction+sign*offset)]) for sign in [-1,1]]
    next_joint=choices[int(np.argmin([np.linalg.norm(v-joint) for v in choices]))]
    angle=math.degrees(math.atan2(next_joint[1]-root[1],next_joint[0]-root[0])-math.atan2(joint[1]-root[1],joint[0]-root[0]))
    child=math.degrees(math.atan2(target[1]-next_joint[1],target[0]-next_joint[0])-math.atan2(tip[1]-joint[1],tip[0]-joint[0]))
    return angle,child,next_joint-joint

def red_mask(source,limit):
    rgba=np.array(image(source));rgb=rgba[:,:,:3].astype(float)
    hsv=cv2.cvtColor(rgba[:,:,:3],cv2.COLOR_RGB2HSV)
    mask=np.uint8(((hsv[:,:,0]<10)|(hsv[:,:,0]>174))&(hsv[:,:,1]>55)&(rgba[:,:,3]>40)&(Y<limit))
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));contours,unused=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    result=np.zeros((512,512),np.uint8);cv2.drawContours(result,[contours[int(np.argmax([cv2.contourArea(contour) for contour in contours]))]],-1,1,-1)
    return cv2.dilate(result,np.ones((3,3),np.uint8))>0

def rotate_wheel(layer,pivot,radii,degrees):
    theta=math.radians(degrees);dx,dy=(X-pivot[0])/radii[0],(Y-pivot[1])/radii[1]
    xx=pivot[0]+(dx*math.cos(theta)+dy*math.sin(theta))*radii[0];yy=pivot[1]+(-dx*math.sin(theta)+dy*math.cos(theta))*radii[1]
    return cv2.remap(layer,xx.astype(np.float32),yy.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)

def export(tribe,frames,rig,draft):
    folder=WORK/tribe;contact=Image.new('RGB',(1920,768),'#13201c')
    for at,index in enumerate(SAMPLES):
        if frames[index] is None:continue
        tile=Image.new('RGB',(512,512),'#13201c');rendered=image(frames[index]);tile.paste(rendered,(0,0),rendered)
        contact.paste(tile.resize((384,384),Image.Resampling.LANCZOS),(at%5*384,at//5*384))
    contact.save(folder/('contact-draft.png' if draft else 'contact.png'))
    if draft:
        print(tribe+' representative poses rendered');sys.stdout.flush();return
    rendered=[image(frame) for frame in frames];durations=[600]+[40]*99+[1000]
    sheet=Image.new('RGBA',(4096,6656))
    for index,frame in enumerate(rendered):sheet.paste(frame,(index%8*512,index//8*512))
    sheet.save(folder/'growth.png')
    for name,size in [('growth.webp',512),('preview.webp',384)]:
        values=rendered if size==512 else [im.resize((384,384),Image.Resampling.LANCZOS) for im in rendered]
        values[0].encoderinfo={'append_images':values[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
        with (folder/name).open('wb') as stream:WebPImagePlugin._save_all(values[0],stream,str(folder/name))
    rig['parts']=USED[tribe]
    rig.update({'root':[256,448],'frameSize':[512,512],'keys':[0,24,32,60,88,100]})
    metadata={'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True,'markersMs':{'closeStart':600,'closed':1520,'assemblyStart':1840,'assemblyEnd':2960,'openStart':3000,'openEnd':4080,'mechanismEnd':4560},'sources':{'start':'start.png','end':'end.png','parts':'Parts','rig':'rig.json'}}
    for name,data in [('rig.json',rig),('animation.json',metadata)]:(folder/name).write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
    print(tribe+' exported 101 frames');sys.stdout.flush()

def refine_owner(source,rough):
    pixels=np.array(image(source));rgb=pixels[:,:,:3]
    opaque=pixels[:,:,3]>16
    dark=(rgb[:,:,0]<80)&(rgb[:,:,1]<105)&(rgb[:,:,2]<100)&opaque
    dark=cv2.dilate(np.uint8(dark),np.ones((3,3),np.uint8))>0
    count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(opaque&~dark),8)
    refined=np.zeros((512,512),np.uint8);known=np.zeros((512,512),bool)
    for index in range(1,count):
        if stats[index,cv2.CC_STAT_AREA]<8:continue
        region=labels==index
        owner=int(np.argmax(np.bincount(rough[region],None,32)))
        refined[region]=owner;known[region]=True
    distance,nearest=cv2.distanceTransformWithLabels(np.uint8(~known),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
    owners=np.zeros(int(nearest.max())+1,np.uint8);owners[nearest[known]]=refined[known]
    refined[opaque&~known]=owners[nearest[opaque&~known]]
    return refined


def make_sprout(draft):
    tribe='sprout';old,final=[pm(Image.open(WORK/tribe/name)) for name in ['start.png','end.png']]
    def split(source,level):
        if level==3:
            petal=[(252,367),(238,340),(214,304),(191,275),(174,251),(169,236),(176,218),(195,212),(207,202),(204,190),(190,184),(175,187),(150,200),(127,222),(109,246),(98,273),(99,305),(114,329),(142,349),(178,362),(215,369)]
            core_box=(154,135,358,366);arms=[(146,351),(111,302),(157,190)]
            lower=[(88,286),(112,284),(127,298),(128,315),(151,337),(161,351),(155,370),(139,377),(121,364),(120,351),(97,328),(88,312)]
            upper=[(149,182),(166,185),(156,209),(140,224),(127,247),(115,272),(104,289),(88,286),(92,271),(108,241),(126,216)]
            fill_l=place(cell(tribe,4,4,0),(98,184,255,372));fill_r=place(cell(tribe,4,4,1),(257,184,414,372))
        else:
            petal=[(255,320),(238,296),(217,277),(195,261),(180,246),(172,231),(171,214),(180,200),(195,195),(204,186),(201,176),(190,170),(175,169),(158,178),(143,194),(131,217),(128,243),(134,268),(148,290),(172,309),(208,320),(239,324)]
            core_box=(173,128,339,320);arms=[(145,335),(114,277),(166,144)]
            lower=[(98,258),(120,253),(136,268),(133,282),(154,299),(163,317),(160,339),(141,349),(122,339),(120,319),(104,296),(97,278)]
            upper=[(157,136),(173,139),(162,159),(145,180),(130,207),(116,235),(110,257),(98,267),(91,260),(101,231),(117,199),(136,168)]
            fill_l=place(cell(tribe,4,4,8),(128,168,256,326));fill_r=place(cell(tribe,4,4,9),(256,168,384,326))
        owner=np.zeros((512,512),np.uint8)
        if level==4:owner[Y<337]=7
        left,right=poly(petal),np.fliplr(poly(petal));core=poly([(core_box[0],core_box[1]),(core_box[2],core_box[1]),(core_box[2],core_box[3]),(core_box[0],core_box[3])])
        owner[core]=3;owner[left]=1;owner[right]=2
        rgba=np.array(image(source));hsv=cv2.cvtColor(rgba[:,:,:3],cv2.COLOR_RGB2HSV)
        wood=np.uint8((hsv[:,:,0]<40)&(hsv[:,:,1]>75)&(rgba[:,:,3]>50));wood=cv2.morphologyEx(wood,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))>0
        for part,region in [(4,poly(lower)),(5,np.fliplr(poly(lower))),(6,poly(upper)),(8,np.fliplr(poly(upper)))]:owner[region&wood]=part
        if level==3:
            owner[(X<99)&(Y<310)&(Y>220)]=9;owner[(Y>=354)&(Y<384)&(X>105)&(X<406)&wood]=10
        else:
            owner[poly([(36,216),(108,216),(121,270),(112,318),(37,326)])]=9
            owner[(Y>=316)&(Y<372)&(X>118)&(X<395)&~wood]=11
        owner=refine_owner(source,owner)
        layers={part:source*(owner==part)[:,:,None] for part in range(12)}
        layers[1]=complete(source,owner,1,fill_l,left,[2,11,6,8,9,4,5,10]);layers[2]=complete(source,owner,2,fill_r,right,[11,6,8,9,4,5,10])
        layers[3]=complete(source,owner,3,place(cell(tribe,4,4,10),core_box),core,[1,2,11,6,8,9,4,5,10])
        if level==4:
            layers[7]=complete(source,owner,7,place(cell(tribe,4,4,13),(45,48,471,340)),Y<337,[0,1,2,3,4,5,6,8,9,11])
            layers[11]=complete(source,owner,11,place(cell(tribe,4,4,11),(118,304,394,373)),(Y>304)&(Y<374),[6,8,9,4,5])
            layers[0]=complete(source,owner,0,place(cell(tribe,4,4,12),(30,306,482,448)),Y>=306,[1,2,3,4,5,6,8,9,11])
        return layers,owner,arms
    a,oa,arm_a=split(old,3);b,ob,arm_b=split(final,4)
    closed_a=[place(cell(tribe,4,4,i),(98 if side==0 else 253,148,259 if side==0 else 414,369)) for side,i in enumerate([2,3])]
    closed_b=[place(cell(tribe,4,4,i),(128 if side==0 else 253,145,259 if side==0 else 384,325)) for side,i in enumerate([4,5])]
    half_b=[place(cell(tribe,4,4,i),(150 if side==0 else 253,156,258 if side==0 else 362,325)) for side,i in enumerate([6,7])]
    save_parts(tribe,{**{'old-'+str(k):v for k,v in a.items()},**{'new-'+str(k):v for k,v in b.items()},'closed03-left':closed_a[0],'closed03-right':closed_a[1],'closed04-left':closed_b[0],'closed04-right':closed_b[1],'half04-left':half_b[0],'half04-right':half_b[1]})
    frames=[]
    for frame in range(101):
        if draft and frame not in SAMPLES:frames.append(None);continue
        close=ease(frame/24);build=ease((frame-32)/28);opened=ease((frame-60)/28)
        if frame<=32:
            value=over(translated(a[3],0,12*close),a[0])
            for side,part in enumerate([1,2]):value=over(morph(a[part],closed_a[side],close),value)
            for side in [0,1]:
                root,joint,tip=[np.array(p,float) for p in arm_a]
                if side:root[0]=512-root[0];joint[0]=512-joint[0];tip[0]=512-tip[0]
                target=tip*(1-close)+np.array([166 if side==0 else 346,194])*close
                angle,child,shift=two_link(root,joint,tip,target)
                value=over(transform(a[6 if side==0 else 8],joint,child,shift),value)
                value=over(transform(a[4 if side==0 else 5],root,angle,(0,0)),value)
            for part in [9,10]:value=over(a[part],value)
        else:
            value=np.zeros_like(old)
            for side in [0,1]:
                layer=b[7]*((X<256) if side==0 else (X>=256))[:,:,None]
                value=over(grow(layer,40,20,frame,(0,165),28 if side==0 else -28,(78 if side==0 else 434,334)),value)
            value=over(grow(b[0],32,20,frame,(0,105),0,(256,448)),value)
            value=over(translated(b[3],0,60*(1-build)),value)
            for side,part in enumerate([1,2]):
                closed=morph(closed_a[side],closed_b[side],build)
                petal=morph(closed,half_b[side],ease(opened*2)) if opened<=.5 else morph(half_b[side],b[part],ease(opened*2-1))
                value=over(petal,value)
            value=over(morph(a[0],b[11],build),value)
            value=over(grow(b[9],44,20,frame,(0,105),0,(256,448)),value)
            for side in [0,1]:
                root,joint,tip=[np.array(p,float) for p in arm_b]
                if side:root[0]=512-root[0];joint[0]=512-joint[0];tip[0]=512-tip[0]
                target=tip*opened+np.array([170 if side==0 else 342,151])*(1-opened)
                angle,child,shift=two_link(root,joint,tip,target);amount=ease((frame-46)/14)
                if amount>0:
                    value=over(translated(transform(b[6 if side==0 else 8],joint,child,shift),0,95*(1-amount))*(Y<=448)[:,:,None],value)
                    value=over(translated(transform(b[4 if side==0 else 5],root,angle,(0,0)),0,95*(1-amount))*(Y<=448)[:,:,None],value)
            if frame>=88:
                value=final.copy();activation=ease((frame-88)/12)
                liquid=(((X-72)/17)**2+((Y-272)/25)**2<=1)
                pixels=np.array(image(final));liquid&=(pixels[:,:,1].astype(float)>pixels[:,:,0]*1.2)&(pixels[:,:,2].astype(float)>pixels[:,:,0]*1.2)
                shimmer=translated(final,0,2*math.sin(activation*math.pi*2))*liquid[:,:,None]
                value=over(shimmer,value*(~liquid)[:,:,None])
        if frame==0:value=old.copy()
        if frame==100:value=final.copy()
        frames.append(value)
    rig={'method':'drawn-petal-keys-local-control-mesh-rigid-two-link-IK','drawOrder':['canopy','plinth','core','petals','rosette','irrigation','upper-braces','lower-braces'],'bones':[{'name':'root','parent':None,'pivot':[256,448]},{'name':'left-lower','parent':'root','pivot':arm_b[0]},{'name':'left-upper','parent':'left-lower','pivot':arm_b[1]},{'name':'right-lower','parent':'root','pivot':[512-arm_b[0][0],arm_b[0][1]]},{'name':'right-upper','parent':'right-lower','pivot':[512-arm_b[1][0],arm_b[1][1]]}],'surfaceKeys':{name:outline(layer,40).tolist() for name,layer in [('oldLeft',a[1]),('closed03Left',closed_a[0]),('closed04Left',closed_b[0]),('half04Left',half_b[0]),('endLeft',b[1])]}}
    export(tribe,frames,rig,draft)


def make_spore(draft):
    tribe='spore';old,final=[pm(Image.open(WORK/tribe/name)) for name in ['start.png','end.png']]
    old_front=poly([(77,377),(94,356),(113,347),(139,353),(160,371),(177,400),(213,417),(254,423),(299,417),(335,401),(357,372),(377,352),(401,350),(422,365),(435,392),(431,416),(411,437),(382,448),(126,448),(100,439),(83,420)])
    new_front=poly([(126,324),(141,302),(158,300),(174,319),(188,338),(213,349),(251,352),(294,348),(325,334),(344,312),(360,300),(378,309),(388,331),(384,356),(362,376),(339,383),(173,383),(145,371),(127,349)])
    old_rgb=np.array(image(old));new_rgb=np.array(image(final))
    for mask,rgb in [(old_front,old_rgb),(new_front,new_rgb)]:
        hsv=cv2.cvtColor(rgb[:,:,:3],cv2.COLOR_RGB2HSV)
        eggs=((hsv[:,:,0]<10)|(hsv[:,:,0]>174))&(hsv[:,:,1]>65)
        mask[eggs]=False
        if rgb is old_rgb:mask[(hsv[:,:,0]<45)&(hsv[:,:,1]>80)]=False
    foundation=((Y>=380)|((Y>=334)&(((X-256)/170)**2+((Y-353)/43)**2>=1)))&~new_front
    a_front=old*old_front[:,:,None];a_upper=old*(~old_front)[:,:,None]
    b_front=final*new_front[:,:,None];base=final*foundation[:,:,None];b_upper=final*(~(new_front|foundation))[:,:,None]
    back_fill=place(cell(tribe,3,3,5),(42,334,481,448))
    base_back=over(base,back_fill*((final[:,:,3]>.95)&~foundation)[:,:,None])
    old_window=(Y<425)|(old[:,:,3]>.05)
    new_window=(Y<370)|(final[:,:,3]>.05)
    a_closed=translated(a_upper,0,220)*(Y<=448)[:,:,None]*old_window[:,:,None]
    b_closed=translated(b_upper,0,275)*(Y<=448)[:,:,None]*new_window[:,:,None]
    save_parts(tribe,{'old-upper-canopy':a_upper,'old-front-cradle':a_front,'new-upper-canopy':b_upper,'new-front-cradle':b_front,'new-plinth':base,'new-plinth-hidden':base_back,'closed03':a_closed,'closed04':b_closed})
    frames=[]
    for frame in range(101):
        if draft and frame not in SAMPLES:frames.append(None);continue
        close=ease(frame/24);build=ease((frame-32)/28);opened=ease((frame-60)/28)
        if frame<=32:
            moving=translated(a_upper,0,220*close)*(Y<=448)[:,:,None]*old_window[:,:,None]
            value=over(a_front,moving)
        else:
            payload=morph(a_closed,b_closed,build) if opened<=0 else translated(b_upper,0,275*(1-opened))*(Y<=448)[:,:,None]*new_window[:,:,None]
            value=over(payload,grow(base_back,32,24,frame,(0,95),0,(256,448)))
            value=over(grow(base,32,24,frame,(0,95),0,(256,448)),value)
            value=over(morph(a_front,b_front,build),value)
            if frame>=88:
                value=final.copy();progress=ease((frame-88)/12);pivot=(421,328);radii=(17,20)
                mask=((X-pivot[0])/radii[0])**2+((Y-pivot[1])/radii[1])**2<=1
                fan=rotate_wheel(material(final),pivot,radii,720*progress)*mask[:,:,None];value=over(fan,value*(~mask)[:,:,None])
        if frame==0:value=old.copy()
        if frame==100:value=final.copy()
        frames.append(value)
    rig={'method':'independent-upper-canopy-retraction-front-cradle-surface-mesh-rigid-plinth','drawOrder':['upper-canopy','plinth','front-cradle','fan'],'bones':[{'name':'root','parent':None,'pivot':[256,448]},{'name':'canopy','parent':'root','pivot':[256,370],'rigid':True},{'name':'plinth','parent':'root','pivot':[256,448],'rigid':True},{'name':'fan','parent':'canopy','pivot':[421,328],'rigid':True}],'canopyTravel':[220,275],'frontKeys':{'old':outline(a_front,40).tolist(),'new':outline(b_front,40).tolist()}}
    export(tribe,frames,rig,draft)
def make_pebble(draft):
    tribe='pebble';old,final=[pm(Image.open(WORK/tribe/name)) for name in ['start.png','end.png']]
    old_portal=poly([(153,285),(330,285),(355,437),(147,437)]);old_gate=place(cell(tribe,4,3,0),(146,151,342,330))
    portal=poly([(173,278),(194,260),(216,250),(258,247),(297,252),(325,270),(340,299),(347,386),(163,386)])
    gate_art=cell(tribe,4,3,8);gate_art=gate_art.crop((0,0,gate_art.width,int(gate_art.height*.40)))
    gate=place(gate_art,(161,60,349,253));owner=np.zeros((512,512),np.uint8)
    shapes={1:[(96,145),(152,106),(254,90),(358,115),(416,161),(405,206),(107,204)],2:[(22,184),(112,147),(157,199),(159,365),(72,389),(21,359)],3:[(354,159),(478,184),(493,351),(452,390),(354,366)],4:[(60,247),(128,226),(177,273),(167,381),(87,393),(51,359)],5:[(344,249),(410,228),(459,257),(468,360),(429,395),(345,381)],6:[(42,376),(470,376),(483,447),(25,447)],7:[(159,252),(176,229),(202,211),(258,206),(309,220),(348,250),(360,378),(339,386),(331,294),(305,270),(256,257),(205,268),(180,292),(177,381),(156,384)],8:[(163,194),(349,194),(347,253),(164,253)],9:[(129,137),(215,137),(219,215),(180,264),(128,247)],10:[(294,137),(380,137),(387,248),(331,263),(293,215)]}
    for part in [1,2,3,6,7,4,5,9,10,8]:owner[poly(shapes[part])]=part
    owner[portal]=0;b={part:final*(owner==part)[:,:,None] for part in range(11)}
    priority=[0,1,2,3,6,7,4,5,9,10,8]
    for part,index,box in [(1,2,(106,91,410,204)),(2,3,(22,164,159,390)),(3,4,(354,164,493,390)),(4,5,(50,227,178,398)),(5,6,(336,227,464,398)),(6,7,(25,374,486,448)),(7,11,(151,222,363,388)),(9,9,(128,135,220,260)),(10,10,(293,135,387,260))]:b[part]=complete(final,owner,part,place(cell(tribe,4,3,index),box),poly(shapes[part]),priority[priority.index(part)+1:])
    hidden_lintel=place(cell(tribe,4,3,2),(155,183,357,265))
    b[0]=over(b[0],hidden_lintel*(owner==8)[:,:,None])
    slabmask=poly([(141,287),(335,278),(342,325),(143,332)]);slab=old*slabmask[:,:,None]
    background=over(old*(~slabmask)[:,:,None],place(cell(tribe,4,3,1),(28,159,484,448))*slabmask[:,:,None])
    save_parts(tribe,{**{'new-'+str(k):v for k,v in b.items()},'old-background':background,'old-gate':old_gate,'old-slab':slab,'new-gate':gate})
    construction=[(6,32,(0,82)),(2,35,(-16,30)),(3,38,(16,30)),(1,41,(0,135)),(7,43,(0,115)),(4,46,(-40,80)),(5,48,(40,80)),(9,50,(0,130)),(10,52,(0,130))]
    frames=[]
    for frame in range(101):
        if draft and frame not in SAMPLES:frames.append(None);continue
        close=ease(frame/24);build=ease((frame-32)/28);opened=ease((frame-60)/28)
        if frame<=32:
            value=over(translated(old_gate,0,110*close)*old_portal[:,:,None],background)
            value=over(translated(slab,0,110*close)*(old_portal|slabmask)[:,:,None],value)
        else:
            value=over(translated(slab,0,110),over(translated(old_gate,0,110)*old_portal[:,:,None],background))
            for part,start,offset in construction:value=over(grow(b[part],start,12,frame,offset,0,(256,448)),value)
            if frame>=64:value=scene(b,[0,1,2,3,6,7,4,5,9,10])
            elif build>0:value*=np.maximum(final[:,:,3],1-build)[:,:,None]
            if frame>=60:value=over(translated(gate,0,134*(1-opened))*portal[:,:,None],value)
            elif frame>=44:
                reveal=Y>448-230*ease((frame-44)/16);value=over(translated(gate,0,134)*portal[:,:,None]*reveal[:,:,None],value)
            slab_pose=translated(b[8],0,134*(1-opened))
            gate_window=portal|poly(shapes[8])
            value=over(slab_pose*gate_window[:,:,None],value) if frame>=60 else over(grow(b[8],48,12,frame,(0,134),0,(256,256)),value)
            if frame>=88:
                value=final.copy();progress=ease((frame-88)/12)
                for pivot,radius,direction in [((179,172),(18,20),1),((332,172),(18,20),-1)]:
                    mask=((X-pivot[0])/radius[0])**2+((Y-pivot[1])/radius[1])**2<=1
                    gear=rotate_wheel(material(final),pivot,radius,360*progress*direction)*mask[:,:,None];value=over(gear,value*(~mask)[:,:,None])
        if frame==0:value=old.copy()
        if frame==100:value=final.copy()
        frames.append(value)
    rig={'method':'separate-rigid-masonry-attachments-occluded-sliding-gate-gears','drawOrder':priority,'bones':[{'name':'root','parent':None,'pivot':[256,448]}]+[{'name':'part-'+str(k),'parent':'root','pivot':np.mean(np.array(shape),0).tolist(),'rigid':True} for k,shape in shapes.items()],'gateTravel':{'old':110,'new':134}}
    export(tribe,frames,rig,draft)


def make_spring(draft):
    tribe='spring';old,final=[pm(Image.open(WORK/tribe/name)) for name in ['start.png','end.png']]
    old_shape=poly([(28,356),(46,338),(78,331),(123,327),(196,325),(275,326),(350,329),(414,335),(459,348),(482,373),(481,401),(461,426),(425,439),(358,448),(244,448),(149,443),(81,434),(44,419),(28,392)])
    rgba=np.array(image(old));hsv=cv2.cvtColor(rgba[:,:,:3],cv2.COLOR_RGB2HSV);warm=(hsv[:,:,0]<40)&(hsv[:,:,1]>75)&(rgba[:,:,3]>40)
    visible=old_shape&~warm
    old_fill=place(cell(tribe,3,3,0),(28,206,484,448))
    a_pool=over(old*visible[:,:,None],old_fill*old_shape[:,:,None]);a_upper=old*(~visible)[:,:,None]
    lower=poly([(17,341),(35,318),(76,305),(106,307),(111,318),(177,312),(267,310),(361,315),(427,316),(474,329),(495,358),(494,401),(471,431),(419,448),(299,448),(177,448),(81,433),(32,410),(16,379)])
    water=poly([(102,326),(154,313),(220,306),(306,308),(379,317),(425,332),(448,354),(429,376),(371,393),(286,402),(199,397),(135,382),(100,364),(87,346)])
    pixels=np.array(image(final));hsv=cv2.cvtColor(pixels[:,:,:3],cv2.COLOR_RGB2HSV);hardware=(hsv[:,:,0]<41)&(hsv[:,:,1]>75)
    lower&=~hardware
    water&=lower
    rim=lower&~water
    b_upper=final*(~lower)[:,:,None];b_pool=final*water[:,:,None];b_rim=final*rim[:,:,None]
    basin_back=place(cell(tribe,3,3,2),(16,293,496,448))*(final[:,:,3]>.95)[:,:,None]
    fill=place(cell(tribe,3,3,1),(87,306,449,403));b_pool=over(b_pool,fill*(water&(final[:,:,3]>.95))[:,:,None])
    left=poly([(59,202),(91,184),(147,190),(166,214),(188,237),(209,257),(252,259),(260,301),(236,323),(170,331),(110,333),(65,313)])
    right=poly([(328,113),(370,107),(410,109),(431,148),(437,193),(452,221),(480,237),(489,274),(471,295),(411,298),(350,288),(328,252)])
    save_parts(tribe,{'old-pool':a_pool,'old-upper-waterworks':a_upper,'new-pool':b_pool,'new-basin-rim':b_rim,'new-basin-hidden':basin_back,'new-aqueduct':b_upper*(~(left|right))[:,:,None],'new-drive':b_upper*left[:,:,None],'new-pressure':b_upper*right[:,:,None]})
    frames=[]
    for frame in range(101):
        if draft and frame not in SAMPLES:frames.append(None);continue
        close=ease(frame/24);build=ease((frame-32)/28);opened=ease((frame-60)/28)
        if frame<=32:
            payload=translated(a_upper,0,168*close)*(Y<=448)[:,:,None]*((Y<425)|(old[:,:,3]>.05))[:,:,None]
            value=over(a_pool,payload)
        else:
            payload=translated(b_upper,0,260*(1-opened))*(Y<=448)[:,:,None]*((Y<370)|(final[:,:,3]>.05))[:,:,None]
            value=over(payload,grow(basin_back,32,24,frame,(0,90),0,(256,448)))
            value=over(morph(a_pool,b_pool,build),value)
            value=over(grow(b_rim,32,24,frame,(0,90),0,(256,448)),value)
            if frame>=88:
                value=final.copy();progress=ease((frame-88)/12);pivot=(112,260);radii=(29,51)
                wheel_mask=(((X-pivot[0])/radii[0])**2+((Y-pivot[1])/radii[1])**2<=1)&hardware&left
                wheel=rotate_wheel(material(final),pivot,radii,360*progress)*wheel_mask[:,:,None];value=over(wheel,value*(~wheel_mask)[:,:,None])
        if frame==0:value=old.copy()
        if frame==100:value=final.copy()
        frames.append(value)
    rig={'method':'rigid-parented-waterworks-lift-basin-occlusion-fluid-control-mesh','drawOrder':['basin-hidden','aqueduct','pressure','drive','pool','basin-rim','wheel'],'bones':[{'name':'root','parent':None,'pivot':[256,448]},{'name':'waterworks','parent':'root','pivot':[256,325],'rigid':True},{'name':'aqueduct','parent':'waterworks','rigid':True},{'name':'drive','parent':'waterworks','rigid':True},{'name':'pressure','parent':'waterworks','rigid':True},{'name':'wheel','parent':'drive','pivot':[112,260],'rigid':True},{'name':'basin-rim','parent':'root','pivot':[256,448],'rigid':True}],'waterworksTravel':[168,260],'waterKeys':{'old':outline(a_pool,40).tolist(),'new':outline(b_pool,40).tolist()}}
    export(tribe,frames,rig,draft)

if __name__=='__main__':
    methods={'sprout':make_sprout,'spore':make_spore,'pebble':make_pebble,'spring':make_spring};draft='--draft' in sys.argv
    names=[name for name in sys.argv[1:] if not name.startswith('--')]
    for tribe in names or list(methods):
        methods[tribe](draft);CACHE.clear()