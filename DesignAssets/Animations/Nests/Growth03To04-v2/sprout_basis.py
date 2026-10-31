from pathlib import Path
import sys
from PIL import WebPImagePlugin
from riglib import *
from assembly import *
import old_sprout as old
import new_sprout as new

ROOT=old.ROOT
KEYS=[0,12,24,32,40,48,54,60,72,84,88,100]
bridge_front=[];bridge_rear=[]
for family,old_parts,new_parts,output in [('front',old.petals,new.front_petals,bridge_front),('rear',old.rear_petals,new.rear_petals,bridge_rear)]:
    for side in range(2):
        a=old_parts[side];b=new_parts[side];indexes=[0,24,48,64,84]
        la=a.target[indexes].tolist();lb=b.target[indexes].tolist()
        pivot=la[0];middle=np.mean(a.target[:a.boundaryCount],0);tip=la[2]
        mesh=Petal('growth-'+family+'-'+str(side),a.end,b.end,la,lb,middle,np.mean(b.target[:b.boundaryCount],0),[pivot,middle,tip],[3,-2,1]);mesh.motion((-4,-56));output.append(mesh)

def old_flower(progress):
    value=np.zeros_like(old.old)
    for part in old.rear_petals:value=over(part.render(progress),value)
    value=over(shift(old.layers[3],(0,24*ease(progress))),value)
    for part in old.petals:value=over(part.render(progress),value)
    return value

closed_old=old_flower(1)
closed_new=new.flower(1)
closed_complete=over(new.layers[0],new.layers[11]);closed_complete=over(closed_new,closed_complete)
for side in range(2):
    a,b,c=new.arm_pose(1,side);closed_complete=over(a,over(b,over(c,closed_complete)))
closed_complete=over(new.layers[10],over(new.layers[12],closed_complete))

n,component,stats,centers=cv2.connectedComponentsWithStats(np.uint8(old.layers[0][:,:,3]>.1),8)
shadow=np.zeros((512,512),bool)
for i in range(1,n):
    x,y,w,h,area=stats[i]
    if area<70 and 130<centers[i,0]<400 and 180<centers[i,1]<370:shadow|=component==i
old_shadow=old.layers[0]*shadow[:,:,None];old_base=old.layers[0]*(~shadow)[:,:,None]
gadget=old_base*((X<130)&(Y<332))[:,:,None];old_rim=old_base*~((X<130)&(Y<332))[:,:,None]

old_leaves=[]
old_leaf_parts=split_regions(old.layers[10],old.labels,old.groups[10])
for label,part in old_leaf_parts.items():
    if float(part[:,:,3].sum())<2:continue
    yy,xx=np.where(part[:,:,3]>.2);centroid=center_of(part);dist=(xx-260)**2+(yy-370)**2;k=int(np.argmin(dist));pivot=(int(xx[k]),int(yy[k]))
    sign=1 if centroid[0]<260 else -1
    options=[]
    for angle in [0,5,10,15,20,30,40,50,65,80]:
        posed=rigid(part,pivot,angle*sign,(0,0));leak=float((posed[:,:,3]*(1-closed_complete[:,:,3])).sum());options.append((leak,angle))
    leak,angle=min(options);old_leaves.append((str(label),part,pivot,angle*sign,leak))

gadget_angles=[]
for angle in [0,5,10,15,20,25,30,40,50]:
    posed=rigid(gadget,(76,299),angle,(0,0));gadget_angles.append((float((posed[:,:,3]*(1-closed_complete[:,:,3])).sum()),angle))
gadget_leak,gadget_angle=min(gadget_angles)

