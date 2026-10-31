from pathlib import Path
import old_sprout as old
from riglib import *
ROOT=old.ROOT
native=read(ROOT/'reference-end.png');rgb=np.array(rgba(native));ink=(rgb[:,:,:3].max(2)<110)&(rgb[:,:,1]<100);inside=(rgb[:,:,3]>180)&~ink
n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(inside),8)
distance,nearest=cv2.distanceTransformWithLabels(np.uint8(~inside),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_CCOMP)
groups={1:[10],2:[13],3:[27],4:[31],5:[32],6:[24,28,33,35,60,61,62,64],7:[26,29,34,36,43,53,63],8:[67],9:[68],10:[72,73,86,90,95,97,101,102,104,107,108],12:[79,80,83,84,92,93,96]}
lookup=np.zeros(int(nearest.max())+1,np.int16);component_lookup=np.zeros(int(nearest.max())+1,np.int32)
for label in range(1,n):
    values=nearest[labels==label]
    if len(values):component_lookup[int(np.argmax(np.bincount(values)))]=label
for part,ids in groups.items():
    for label in ids:
        values=nearest[labels==label]
        if len(values):lookup[int(np.argmax(np.bincount(values)))]=part
owner=lookup[nearest];component_ids=component_lookup[nearest]
canopy=(Y<300)&~((X<109)&(Y>210))&~((X>395)&(Y>231))
owner[(owner==0)&canopy]=11
hsv=cv2.cvtColor(rgb[:,:,:3],cv2.COLOR_RGB2HSV);warm=((hsv[:,:,0]<42)&(hsv[:,:,1]>65))|(hsv[:,:,2]<80)
for side in range(2):
    rod=polygon([(105,250),(158,154),(181,151),(136,244),(128,271),(106,277)])
    if side:rod=rod[:,::-1]
    owner[rod&warm&np.isin(owner,[0,11])]=6+side
for part in [1,2,3,4,5,6,7,8,9,10,12]:
    selected=(owner==part)&inside;border=cv2.dilate(np.uint8(selected),np.ones((7,7),np.uint8))>0
    owner[border&ink]=part
layers={i:native*(owner==i)[:,:,None] for i in [0,1,2,3,4,5,6,7,8,9,10,11,12]}
hidden_sources=components(ROOT/'hidden-source.png',1)
glass=cv2.resize(hidden_sources[0],(400,250),None,0,0,cv2.INTER_LANCZOS4)
glass_canvas=np.zeros_like(native);glass_canvas[50:300,57:457]=glass
external=cv2.findContours(np.uint8(native[:,:,3]>.1),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]
shape=external[int(np.argmax([cv2.contourArea(c) for c in external]))]
domain=np.zeros((512,512),np.uint8);cv2.drawContours(domain,[shape],-1,255,-1);domain=cv2.erode(domain,np.ones((5,5),np.uint8))>0
plate=hidden_sources[1];h,w=plate.shape[:2];patch=plate[int(h*.22):int(h*.48),int(w*.3):int(w*.7)]
texture=cv2.resize(patch,(370,160),None,0,0,cv2.INTER_LANCZOS4)
plate_canvas=np.zeros_like(native);plate_canvas[250:410,72:442]=texture
floor=(((X-257)/185)**2+((Y-330)/80)**2<=1)&domain
plate_canvas*=floor[:,:,None]
layers[11]=over(layers[11],glass_canvas*domain[:,:,None])
layers[0]=over(layers[0],plate_canvas)
clear_floor=floor&(Y<354)&(X>112)&(X<397)&~(((X<184)|(X>331))&(Y>=315))
layers[0]=over(plate_canvas*clear_floor[:,:,None],layers[0]*(~clear_floor)[:,:,None])

front_bases=[(253,307),(261,307)];front_tips=[(189,170),(325,170)]
closed=[]
for side in range(2):
    fill=old.art_petal(4+side,front_bases[side],front_tips[side]);hidden=np.isin(owner,[6,7,8,9,10,12])&(native[:,:,3]>.98)
    layers[4+side]=over(layers[4+side],fill*hidden[:,:,None])
    fill=old.art_petal(6+side,(241 if side==0 else 273,225),(196 if side==0 else 318,123))
    hidden=np.isin(owner,[3,4,5,6,7,8,9,10,12])&(native[:,:,3]>.98)
    layers[1+side]=over(layers[1+side],fill*hidden[:,:,None])
    closed.append(old.art_petal(6+side,(255 if side==0 else 259,312),(256 if side==0 else 258,139)))
seed=affine(old.seed*old.seed_mask[:,:,None],matrix((256,244),0)@np.diag([.82,.82,1])@matrix((-260,-286),0))
layers[3]=over(layers[3],seed*np.isin(owner,[4,5,6,7,8,9,10,12])[:,:,None]*(native[:,:,3]>.98)[:,:,None])
front_petals=[];rear_petals=[]
for side in range(2):
    def point(p):return p if side==0 else (514-p[0],p[1])
    aa=[point(p) for p in [(253,307),(132,235),(190,169),(198,202),(250,263)]]
    bb=[point(p) for p in [(255,312),(164,239),(256,139),(282,180),(281,253)]]
    front_petals.append(Petal('new-front-'+str(side),layers[4+side],closed[side],aa,bb,point((190,241)),point((219,235)),[point(p) for p in [(253,307),(184,244),(189,178)]],[17*(1 if side==0 else -1),-9*(1 if side==0 else -1),-5*(1 if side==0 else -1)]))
    b=old.art_petal(6+side,point((241,225)),point((256,110)))
    aa=[point(p) for p in [(241,225),(175,159),(197,123),(226,150),(242,194)]]
    bb=[point(p) for p in [(241,225),(184,171),(256,110),(278,151),(270,197)]]
    rear_petals.append(Petal('new-rear-'+str(side),layers[1+side],b,aa,bb,point((209,171)),point((224,169)),[point(p) for p in [(241,225),(211,175),(197,130)]],[22*(1 if side==0 else -1),-10*(1 if side==0 else -1),4*(1 if side==0 else -1)]))

arm_parts=[]
for side in range(2):
    joint=np.array([131,268] if side==0 else [383,268],float);tip=np.array([170,158] if side==0 else [344,158],float);axis=(tip-joint)/np.linalg.norm(tip-joint);sources=[]
    for column in [1,2]:
        art=old.links[6+side*3+column];ys,xs=np.where(art[:,:,3]>.2);lo,hi=ys.min(),ys.max()
        a=(float(np.mean(xs[ys>hi-12])),float(np.mean(ys[ys>hi-12])));b=(float(np.mean(xs[ys<lo+12])),float(np.mean(ys[ys<lo+12])))
        fill=place_two(art,a,b,joint,joint+axis*82) if column==1 else place_two(art,a,b,joint+axis*35,tip)
        slider_mask=np.isin(component_ids,[24,28,33] if side==0 else [26,29,34])
        visible=layers[6+side]*(~slider_mask if column==1 else slider_mask)[:,:,None]
        hidden=np.isin(owner,[8,9,10,12]) if column==1 else np.isin(owner,[8,9,10,12])|((owner==6+side)&~slider_mask)
        sources.append(over(visible,fill*hidden[:,:,None]*(native[:,:,3]>.98)[:,:,None]))
    arm_parts.append(sources)

def arm_pose(progress,side):
    root=np.array([155,321] if side==0 else [359,321],float);joint=np.array([131,268] if side==0 else [383,268],float);tip=np.array([170,158] if side==0 else [344,158],float)
    petal=rear_petals[side];target=petal.positions(progress)[24]+tip-petal.vertices[24]
    a=np.linalg.norm(joint-root);original_b=np.linalg.norm(tip-joint);v=target-root
    extension=max(0,np.linalg.norm(v)-a-original_b+7);b=original_b+extension;distance=np.clip(np.linalg.norm(v),abs(a-b)+.001,a+b-.001)
    theta=math.atan2(v[1],v[0]);delta=math.acos(np.clip((a*a+distance*distance-b*b)/(2*a*distance),-1,1))
    choices=[root+a*np.array([math.cos(theta+sign*delta),math.sin(theta+sign*delta)]) for sign in [-1,1]];j=choices[int(np.argmin([np.linalg.norm(p-joint) for p in choices]))]
    lower=math.degrees(math.atan2(j[1]-root[1],j[0]-root[0])-math.atan2(joint[1]-root[1],joint[0]-root[0]))
    upper=math.degrees(math.atan2(target[1]-j[1],target[0]-j[0])-math.atan2(tip[1]-joint[1],tip[0]-joint[0]))
    return [rigid(layers[8+side],root,lower,(0,0)),rigid(arm_parts[side][0],joint,upper,j-joint),rigid(shift(arm_parts[side][1],(tip-joint)/original_b*extension),joint,upper,j-joint)]

def flower(progress):
    value=np.zeros_like(native)
    for petal in rear_petals:value=over(petal.render(progress),value)
    value=over(shift(layers[3],(0,20*ease(progress))),value)
    for petal in front_petals:value=over(petal.render(progress),value)
    return value

if __name__=='__main__':
    board=Image.new('RGBA',(2560,512),'#182923')
    for i,p in enumerate([0,.25,.5,.75,1]):
        value=over(layers[11],layers[0]);value=over(flower(p),value)
        for side in range(2):
            lower,body,slider=arm_pose(p,side);value=over(slider,value);value=over(body,value);value=over(lower,value)
        value=over(layers[12],value);value=over(layers[10],value);im=rgba(value);board.alpha_composite(im,(i*512,0));im.save(ROOT/('new-close-'+str(i)+'.png'))
        if i==0:
            diff=np.abs(np.array(im.convert('RGBa')).astype(int)-np.array(rgba(native).convert('RGBa')).astype(int));print('new bind reconstruction',int(diff.max()),float(diff.mean()))
    board.convert('RGB').save(ROOT/'new-close-keys.png')
    for index,layer in layers.items():rgba(layer).save(ROOT/'Parts'/('new-'+str(index)+'.png'))
    save_json(ROOT/'new-front-mesh.json',{str(i):petal.data() for i,petal in enumerate(front_petals+rear_petals)})
    print('new key poses rendered')
