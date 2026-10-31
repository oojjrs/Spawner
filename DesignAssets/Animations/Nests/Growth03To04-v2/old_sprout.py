from pathlib import Path
import sys
from riglib import *
from PIL import WebPImagePlugin

ROOT=Path(__file__).parent/'sprout'
ROOT.joinpath('Parts').mkdir(511,True,True)
old=read(ROOT/'start.png');end=read(ROOT/'reference-end.png')
parts=components(ROOT/'petal-source.png',2)
assert len(parts)==8,len(parts)

def art_petal(index,base,tip):
    art=parts[index];alpha=art[:,:,3]
    ys,xs=np.where(alpha>.2);top=ys.min();bottom=ys.max()
    tx=float(np.mean(xs[ys<top+4]));ty=float(np.mean(ys[ys<top+4]));bx=float(np.mean(xs[ys>bottom-3]));by=float(np.mean(ys[ys>bottom-3]))
    return place_two(art,(bx,by),(tx,ty),base,tip)

rgb=np.array(rgba(old));ink=(rgb[:,:,:3].max(2)<110)&(rgb[:,:,1]<100)
inside=(rgb[:,:,3]>180)&~ink
n,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(inside),8)
distance,nearest=cv2.distanceTransformWithLabels(np.uint8(~inside),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_CCOMP)
groups={1:[2],2:[1],3:[4],4:[8],5:[9],6:[3,6,10,12,14,30,33,36],7:[5,7,11,13,15,31,34,39],8:[37,41,63,53,55,51],9:[38,42,64,54,56,52],10:[49,50,70,73,74,75,80,81,85,86,87]}
groups[0]=[label for label in range(1,n) if 45<centers[label,0]<101 and 224<centers[label,1]<277 and label not in [14,30,33,36]]
known={label for values in groups.values() for label in values}
for label in range(1,n):
    if label in known:continue
    cx,cy=centers[label]
    if 70<cx<177 and 176<cy<315:groups[6].append(label)
    elif 359<cx<477 and 176<cy<319:groups[7].append(label)
    elif 82<cx<169 and 281<cy<377:groups[8].append(label)
    elif 351<cx<439 and 281<cy<378:groups[9].append(label)

lookup=np.zeros(int(nearest.max())+1,np.int16)
for part,ids in groups.items():
    for label in ids:
        values=nearest[labels==label]
        if len(values):lookup[int(np.argmax(np.bincount(values)))]=part
owner=lookup[nearest]
for part in [1,2,3,4,5,6,7,8,9,10]:
    selected=np.isin(labels,groups[part]);border=cv2.dilate(np.uint8(selected),np.ones((7,7),np.uint8))>0
    owner[border&ink]=part
layers={i:old*(owner==i)[:,:,None] for i in range(11)}

complete={4:art_petal(0,(255,358),(178,196)),5:art_petal(1,(257,358),(334,196))}
for i in [4,5]:
    hidden=np.isin(owner,[6,7,8,9,10])&(old[:,:,3]>.98)
    layers[i]=over(layers[i],complete[i]*hidden[:,:,None])
for i in [1,2]:
    source=art_petal(2 if i==1 else 3,(240 if i==1 else 272,267),(186 if i==1 else 326,137))
    hidden=np.isin(owner,[3,4,5,6,7,8,9,10])&(old[:,:,3]>.98)
    layers[i]=over(layers[i],source*hidden[:,:,None])
seed=Image.open(ROOT/'seed-source.png').convert('RGBA')
scale=225/seed.height;seed=seed.resize((round(seed.width*scale),225),Image.Resampling.LANCZOS)
bg=Image.new('RGBA',(512,512));bg.alpha_composite(seed,((512-seed.width)//2,137));seed=np.array(bg).astype(np.float32)/255;seed[:,:,:3]*=seed[:,:,3:4]
seed_rgb=np.array(rgba(seed));seed_hsv=cv2.cvtColor(seed_rgb[:,:,:3],cv2.COLOR_RGB2HSV);seed_mask=(seed_hsv[:,:,0]<40)&(seed_hsv[:,:,1]>65)&(Y>225);seed_mask=cv2.morphologyEx(np.uint8(seed_mask),cv2.MORPH_CLOSE,np.ones((7,7),np.uint8));seed_mask=cv2.dilate(seed_mask,np.ones((7,7),np.uint8))>0
layers[3]=over(layers[3],seed*seed_mask[:,:,None]*np.isin(owner,[4,5,6,7,8,9,10])[:,:,None]*(old[:,:,3]>.98)[:,:,None])
closed=[art_petal(2,(259,371),(260,160)),art_petal(3,(263,371),(262,160))]
for i in range(11):rgba(layers[i]).save(ROOT/'Parts'/('old-'+str(i)+'.png'))
for i in range(2):rgba(closed[i]).save(ROOT/'Parts'/('closed-'+str(i)+'.png'))

petals=[]
for side in range(2):
    def point(p):return p if side==0 else (520-p[0],p[1])
    a=[point(p) for p in [(255,358),(102,283),(181,194),(194,232),(252,308)]]
    b=[point(p) for p in [(259,371),(137,270),(260,160),(277,208),(284,299)]]
    petal=Petal('front-'+str(side),layers[4+side],closed[side],a,b,point((173,283)),point((205,268)),[point(p) for p in [(255,358),(170,288),(181,208)]],[18 if side==0 else -18,-10 if side==0 else 10,-6 if side==0 else 6])
    petals.append(petal)

rear_petals=[]
for side in range(2):
    def rearpoint(point):return point if side==0 else (520-point[0],point[1])
    closed_rear=art_petal(2+side,rearpoint((241,267)),rearpoint((253,127)))
    aa=[rearpoint(point) for point in [(241,267),(153,198),(187,138),(223,176),(240,225)]]
    bb=[rearpoint(point) for point in [(241,267),(164,203),(253,127),(277,171),(270,230)]]
    petal=Petal('rear-'+str(side),layers[1+side],closed_rear,aa,bb,rearpoint((200,204)),rearpoint((221,200)),[rearpoint(point) for point in [(241,267),(204,210),(187,147)]],[25*(1 if side==0 else -1),-9*(1 if side==0 else -1),5*(1 if side==0 else -1)])
    rear_petals.append(petal);rgba(closed_rear).save(ROOT/'Parts'/('rear-closed-'+str(side)+'.png'))

links=components(ROOT/'link-source.png',4)
assert len(links)==12,len(links)
arm_parts=[]
component_lookup=np.zeros(int(nearest.max())+1,np.int32)
for label in range(1,n):
    values=nearest[labels==label]
    if len(values):component_lookup[int(np.argmax(np.bincount(values)))]=label
component_ids=component_lookup[nearest]
for side in range(2):
    root=np.array([137,361] if side==0 else [384,361],float);joint=np.array([102,309] if side==0 else [420,309],float);tip=np.array([153,198] if side==0 else [367,198],float)
    axis=(tip-joint)/np.linalg.norm(tip-joint)
    layers_here=[]
    for column in [1,2]:
        art=links[side*3+column];ys,xs=np.where(art[:,:,3]>.2);lo,hi=ys.min(),ys.max()
        a=(float(np.mean(xs[ys>hi-12])),float(np.mean(ys[ys>hi-12])));b=(float(np.mean(xs[ys<lo+12])),float(np.mean(ys[ys<lo+12])))
        if column==1:fill=place_two(art,a,b,joint,joint+axis*100)
        else:fill=place_two(art,a,b,joint+axis*35,tip)
        front=np.isin(owner,[8,9,10])&(old[:,:,3]>.98)
        slider_mask=np.isin(component_ids,[3,6,10] if side==0 else [5,7,11])
        native=layers[6+side]*(~slider_mask if column==1 else slider_mask)[:,:,None]
        hidden=front if column==1 else front|((owner==6+side)&~slider_mask)
        layers_here.append(over(native,fill*hidden[:,:,None]))
    arm_parts.append(layers_here)
    for k,part in enumerate(layers_here):rgba(part).save(ROOT/'Parts'/('old-arm-'+str(side)+'-'+str(k)+'.png'))

def ik_pose(progress,side):
    root=np.array([137,361] if side==0 else [384,361],float);joint=np.array([102,309] if side==0 else [420,309],float);tip=np.array([153,198] if side==0 else [367,198],float)
    petal=rear_petals[side];anchor=24;bind_point=petal.vertices[anchor]
    target=petal.positions(progress)[anchor]+tip-bind_point

    a=np.linalg.norm(joint-root);original_b=np.linalg.norm(tip-joint);v=target-root
    extension=max(0,np.linalg.norm(v)-a-original_b+7)*progress;b=original_b+extension
    distance=np.clip(np.linalg.norm(v),abs(a-b)+.001,a+b-.001);theta=math.atan2(v[1],v[0]);delta=math.acos(np.clip((a*a+distance*distance-b*b)/(2*a*distance),-1,1))
    choices=[root+a*np.array([math.cos(theta+sign*delta),math.sin(theta+sign*delta)]) for sign in [-1,1]]
    j=choices[int(np.argmin([np.linalg.norm(p-joint) for p in choices]))]
    lower=math.degrees(math.atan2(j[1]-root[1],j[0]-root[0])-math.atan2(joint[1]-root[1],joint[0]-root[0]))
    upper=math.degrees(math.atan2(target[1]-j[1],target[0]-j[0])-math.atan2(tip[1]-joint[1],tip[0]-joint[0]))
    body=rigid(arm_parts[side][0],joint,upper,j-joint)
    slider=rigid(shift(arm_parts[side][1],(tip-joint)/original_b*extension),joint,upper,j-joint)
    return rigid(layers[8+side],root,lower,(0,0)),over(body,slider),j,target
