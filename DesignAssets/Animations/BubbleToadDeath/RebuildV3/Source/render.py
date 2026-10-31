import json
import math
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

folder=Path(__file__).resolve().parent
keys=folder/'Keys'
final=Image.open(keys/'settled-revision2.png').convert('RGBA')
size=512
gy,gx=np.mgrid[:size,:size].astype(np.float32)


def polygon(points):
    mask=Image.new('L',(size,size))
    ImageDraw.Draw(mask).polygon(points,255)
    return np.array(mask).astype(np.float32)/255


def masked(image,mask):
    values=np.array(image).copy()
    values[:,:,3]=np.uint8(values[:,:,3].astype(np.float32)*mask+.5)
    return Image.fromarray(values)


front=polygon([(107,350),(120,333),(136,313),(151,298),(174,302),(183,319),(194,326),(205,319),(224,315),(242,321),(259,333),(283,355),(286,377),(289,394),(281,411),(266,422),(242,430),(210,434),(177,429),(148,421),(128,413),(111,402),(102,389),(101,372),(107,359)])
limb_masks=[polygon(points) for points in [[(370,328),(389,321),(414,321),(440,337),(449,360),(449,393),(435,419),(410,443),(348,446),(332,429),(331,403),(333,383),(338,366),(348,347),(360,337)],[(306,365),(319,369),(330,380),(339,392),(342,410),(328,426),(309,435),(288,450),(241,449),(234,430),(242,418),(258,410),(278,407),(289,400),(287,389),(293,374)],[(82,413),(101,405),(118,408),(133,415),(149,420),(155,432),(133,443),(99,440),(76,432)]]]
limb_masks=[cv2.dilate(mask,np.ones((7,7),np.uint8)) for mask in limb_masks]
limbs=np.maximum.reduce(limb_masks)
body_mask=polygon([(143,315),(186,311),(230,295),(275,277),(304,280),(341,295),(375,321),(398,353),(403,387),(387,425),(318,434),(238,435),(176,428),(141,410),(126,383),(128,347)])
raw=Image.open(folder/'Raw/hidden-torso.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
raw=raw.transform((512,512),Image.Transform.AFFINE,(1,0,0,0,1,-24),Image.Resampling.BICUBIC)
back=masked(raw,body_mask*(gy<=420))
native_back=polygon([(181,317),(215,309),(247,292),(274,279),(305,279),(341,295),(365,316),(369,326),(358,334),(347,345),(337,361),(331,374),(318,367),(306,362),(293,366),(285,375),(278,362),(267,344),(254,332),(237,320),(222,316),(204,322),(188,324)])
front_known=front*(1-native_back)*(1-limbs)
new_front=Image.open(folder/'Raw/front-complete.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
sift=cv2.SIFT_create()
ref=np.array(final)
gen=np.array(new_front)
mask=np.zeros((512,512),np.uint8);mask[302:367,121:277]=255
first,desc=sift.detectAndCompute(cv2.cvtColor(gen[:,:,:3],cv2.COLOR_RGB2GRAY),np.uint8(gen[:,:,3]>128)*255)
last,other=sift.detectAndCompute(cv2.cvtColor(ref[:,:,:3],cv2.COLOR_RGB2GRAY),mask)
pairs=cv2.BFMatcher().knnMatch(desc,other,2)
good=[pair[0] for pair in pairs if len(pair)==2 and pair[0].distance<.72*pair[1].distance]
a=np.float32([first[m.queryIdx].pt for m in good]);b=np.float32([last[m.trainIdx].pt for m in good])
pose,inliers=cv2.estimateAffinePartial2D(a,b,None,cv2.RANSAC,1.5,3000,.995,10)
inverse=cv2.invertAffineTransform(pose)
new_front=new_front.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse.ravel()),Image.Resampling.BICUBIC).convert('RGBA')
npixels=np.array(new_front).astype(np.float32)/255
npixels[:,:,:3]*=npixels[:,:,3:4]
nalpha=npixels[:,:,3]
source_bottom=int(np.where(nalpha>.5)[0].max())
source_rows=np.arange(350,source_bottom+1)
old_left=[];old_right=[]
for y in source_rows:
    xs=np.where(nalpha[y]>0.5)[0]
    old_left.append(float(xs.min()) if len(xs) else old_left[-1])
    old_right.append(float(xs.max()) if len(xs) else old_right[-1])
target_rows=np.array([350.,363.,370.,380.,390.,400.,410.,420.,429.])
target_left=np.array([121.,112.,106.,105.,110.,123.,145.,172.,207.])
target_right=np.array([283.,281.,284.,287.,289.,282.,272.,255.,220.])
sy=np.where(gy>=363,363+(gy-363)*(source_bottom-363)/(429-363),gy)
sl=np.interp(sy,source_rows,old_left);sr=np.interp(sy,source_rows,old_right)
tl=np.interp(gy,target_rows,target_left);tr=np.interp(gy,target_rows,target_right)
sx=sl+(gx-tl)/np.maximum(tr-tl,1)*(sr-sl)
weight=np.clip((gy-350)/13,0,1)
sx=gx*(1-weight)+sx*weight
sampled=cv2.remap(npixels,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
alpha=np.clip(sampled[:,:,3:4],0,1)
rgb=np.clip(sampled[:,:,:3],0,alpha)/np.maximum(alpha,1/255)
alpha[gy>429]=0
skin=Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)))
native_front_alpha=np.uint8(np.array(skin)[:,:,3]>64)
clear_front=cv2.dilate(native_front_alpha,np.ones((5,5),np.uint8))
body_cap=masked(final,native_back*(1-limbs)*(1-clear_front))
back=masked(raw,body_mask*(gy<=420))
back.alpha_composite(body_cap)
front_known*=cv2.erode(native_front_alpha,np.ones((5,5),np.uint8))
foreground=masked(final,front_known)
skin.alpha_composite(foreground)
skin_array=np.array(skin)
opaque=np.uint8(skin_array[:,:,3]>128)
inside=cv2.erode(opaque,np.ones((7,7),np.uint8))
distance,labels=cv2.distanceTransformWithLabels(1-inside,cv2.DIST_L2,3,None,None,cv2.DIST_LABEL_PIXEL)
labels_inside=labels[inside>0]
colors=np.zeros((int(labels.max())+1,3),np.uint8)
colors[labels_inside]=skin_array[:,:,:3][inside>0]
edge_distance=cv2.distanceTransform(opaque,cv2.DIST_L2,3)
clean=(edge_distance<3.5)&(gy>362)&(opaque>0)
skin_array[:,:,:3][clean]=colors[labels[clean]]
joint=(gx>266)&(gy>343)
coverage=np.minimum(1,edge_distance/4)
skin_array[:,:,3][joint]=np.uint8(skin_array[:,:,3][joint]*coverage[joint])
skin_array[skin_array[:,:,3]==0,:3]=0
left_bound=np.interp(gy,target_rows,target_left)
right_bound=np.interp(gy,target_rows,target_right)
shape=np.clip(gx-left_bound+.5,0,1)*np.clip(right_bound-gx+.5,0,1)*np.clip(429.5-gy,0,1)
closed=(gy>=363)&(shape>0)
known=np.uint8((skin_array[:,:,3]>240)&(edge_distance>3))
dist,lab=cv2.distanceTransformWithLabels(1-known,cv2.DIST_L2,3,None,None,cv2.DIST_LABEL_PIXEL)
lookup=np.zeros((int(lab.max())+1,3),np.uint8)
lookup[lab[known>0]]=skin_array[:,:,:3][known>0]
missing=closed&(skin_array[:,:,3]<128)
skin_array[:,:,:3][missing]=lookup[lab[missing]]
skin_array[:,:,3][gy>=363]=np.uint8(shape[gy>=363]*255+.5)
skin_array[:,:,3][gy<373]=np.minimum(skin_array[:,:,3][gy<373],np.array(final)[:,:,3][gy<373])
skin_array[skin_array[:,:,3]==0,:3]=0
skin=Image.fromarray(skin_array)
farr=np.array(foreground)
farr[:,:,3][gy>=363]=np.minimum(farr[:,:,3][gy>=363],skin_array[:,:,3][gy>=363])
white=(skin_array[:,:,0]>180)&(skin_array[:,:,1]>180)&(skin_array[:,:,2]>130)&(gy>373)&(gx<255)&(skin_array[:,:,3]>240)
wd,wl=cv2.distanceTransformWithLabels(1-np.uint8(white),cv2.DIST_L2,3,None,None,cv2.DIST_LABEL_PIXEL)
wc=np.zeros((int(wl.max())+1,3),np.uint8);wc[wl[white]]=skin_array[:,:,:3][white]
wrong=(gy>391)&(gx>234)&(gx<290)&((skin_array[:,:,1]<160)|(farr[:,:,1]<160))
skin_array[:,:,:3][wrong]=wc[wl[wrong]]
farr[:,:,3][wrong]=0
hidden=(gy>383)&(gy<429)&(gx>234)&(gx<290)&(farr[:,:,3]<128)
skin_array[:,:,:3][hidden]=wc[wl[hidden]]
known_front=farr[:,:,3]>128
skin_array[:,:,:3][known_front]=farr[:,:,:3][known_front]
smooth_rgb=cv2.GaussianBlur(skin_array[:,:,:3],(9,9),2)
soft_zone=(gy>383)&(gx>232)&(gx<291)&(skin_array[:,:,3]>128)
skin_array[:,:,:3][soft_zone]=smooth_rgb[soft_zone]
skin=Image.fromarray(skin_array)
foreground=Image.fromarray(farr)
limb_images=[masked(final,mask) for mask in limb_masks]
parts=folder/'Parts'
parts.mkdir(0o777,True,True)
skin.save(parts/'head-neck-frontbody.png')
back.save(parts/'back-hidden.png')
for index,image in enumerate(limb_images):
    image.save(parts/('limb-'+str(index)+'.png'))

poses=[np.array([[1.,0.,0.],[0.,1.,0.]]),np.array([[1.00279408,-.00303901,-1.88848313],[.00303901,1.00279408,46.93010065]]),np.array([[1.00647995,-.02709965,-1.10997535],[.02709965,1.00647995,109.54217059]])]
origin=np.array([213.,232.])
centers=[p[:,:2]@origin+p[:,2] for p in poses]
angles=[math.atan2(p[1,0],p[0,0]) for p in poses]


def smooth(u):
    u=max(0.,min(1.,u))
    return u*u*(3-2*u)


def state(time):
    if time<=650:
        a,b,u=0,1,smooth((time-180)/470)
    else:
        a,b,u=1,2,smooth((time-650)/420)
    center=centers[a]*(1-u)+centers[b]*u
    angle=angles[a]*(1-u)+angles[b]*u-angles[2]
    rotation=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])
    translation=center-rotation@centers[2]
    inflation=[1.,.60,0.][a]*(1-u)+[1.,.60,0.][b]*u
    body_y=[-39.,-16.,0.][a]*(1-u)+[-39.,-16.,0.][b]*u
    return rotation,translation,inflation,body_y


skin_values=np.array(skin).astype(np.float32)/255
skin_values[:,:,:3]*=skin_values[:,:,3:4]
left_profile=np.interp(np.arange(373,430),target_rows,target_left).tolist()
right_profile=np.interp(np.arange(373,430),target_rows,target_right).tolist()
profile_v=np.linspace(0,1,len(left_profile))
start_v=np.array([0,.12,.28,.46,.64,.81,.94,1.])
start_left=np.array([118,94,78,73,80,104,145,207.])
start_right=np.array([285,292,297,295,283,263,241,220.])


def curve(knots,values,points):
    knots=np.array(knots,float);values=np.array(values,float)
    h=np.diff(knots);slope=np.diff(values)/h
    tangent=np.zeros(len(values))
    tangent[0]=slope[0];tangent[-1]=slope[-1]
    for i in range(1,len(values)-1):
        if slope[i-1]*slope[i]>0:
            w1=2*h[i]+h[i-1];w2=h[i]+2*h[i-1]
            tangent[i]=(w1+w2)/(w1/slope[i-1]+w2/slope[i])
    index=np.clip(np.searchsorted(knots,points,'right')-1,0,len(h)-1)
    u=np.clip((points-knots[index])/h[index],0,1)
    return (2*u**3-3*u**2+1)*values[index]+(u**3-2*u**2+u)*h[index]*tangent[index]+(-2*u**3+3*u**2)*values[index+1]+(u**3-u**2)*h[index]*tangent[index+1]


def warp_skin(rotation,translation,inflation,values,closed_skin):
    inverse=rotation.T
    hx=inverse[0,0]*(gx-translation[0])+inverse[0,1]*(gy-translation[1])
    hy=inverse[1,0]*(gx-translation[0])+inverse[1,1]*(gy-translation[1])
    slope=rotation[1,0]/rotation[0,0]
    top=slope*(gx-translation[0]-rotation[0,1]*373)+rotation[1,1]*373+translation[1]
    bottom=429-8*inflation
    v=(gy-top)/(bottom-top)
    normalized=np.clip(v,0,1)
    source_v=normalized**(1/(1+.5*inflation))
    sy=373+56*source_v
    source_left=np.interp(source_v,profile_v,left_profile)
    source_right=np.interp(source_v,profile_v,right_profile)
    native_left=np.interp(normalized,profile_v,left_profile)
    native_right=np.interp(normalized,profile_v,right_profile)
    target_left=native_left*(1-inflation)+curve(start_v,start_left,normalized)*inflation
    target_right=native_right*(1-inflation)+curve(start_v,start_right,normalized)*inflation
    edge_left=rotation[0,0]*left_profile[0]+rotation[0,1]*373+translation[0]
    edge_right=rotation[0,0]*right_profile[0]+rotation[0,1]*373+translation[0]
    raw_left=left_profile[0]*(1-inflation)+start_left[0]*inflation
    raw_right=right_profile[0]*(1-inflation)+start_right[0]*inflation
    target_left+=(edge_left-raw_left)*(1-normalized)**6
    target_right+=(edge_right-raw_right)*(1-normalized)**6
    sx=source_left+(gx-target_left)/np.maximum(target_right-target_left,1)*(source_right-source_left)
    if closed_skin:
        margin=np.minimum(2.5,(source_right-source_left)*.25)
        sx=np.clip(sx,source_left+margin,source_right-margin)
    upper=v<0
    sx[upper]=hx[upper];sy[upper]=hy[upper]
    lower=v>1
    sx[lower]=gx[lower];sy[lower]=gy[lower]+8*inflation
    sampled=cv2.remap(values,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    sampled_alpha=np.clip(sampled[:,:,3:4],0,1)
    rgb=np.clip(sampled[:,:,:3],0,sampled_alpha)/np.maximum(sampled_alpha,1/255)
    alpha=sampled_alpha.copy()
    if closed_skin:
        pouch=v>=0
        coverage=np.clip(gx-target_left+.5,0,1)*np.clip(target_right-gx+.5,0,1)*np.clip(bottom-gy+.5,0,1)
        alpha[:,:,0][pouch]=coverage[pouch]
        distance=np.minimum(np.minimum(gx-target_left,target_right-gx),bottom-gy)
        ink=np.clip((1.4-distance),0,1)*(pouch&(coverage>0))
        rgb=rgb*(1-ink[:,:,None])+np.array([30,48,40])/255*ink[:,:,None]
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)))


def render(time):
    rotation,translation,inflation,body_y=state(time)
    torso=back.convert('RGBa').transform((size,size),Image.Transform.AFFINE,(1,0,0,0,1,-body_y),Image.Resampling.BICUBIC).convert('RGBA')
    result=Image.new('RGBA',(size,size))
    result.alpha_composite(limb_images[2])
    result.alpha_composite(torso)
    result.alpha_composite(warp_skin(rotation,translation,inflation,skin_values,True))
    for image in limb_images[:2]:
        result.alpha_composite(image)
    return result


