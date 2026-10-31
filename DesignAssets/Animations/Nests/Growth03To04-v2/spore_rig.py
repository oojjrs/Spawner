from production import *
from prefab import Prefab,translate3,yaw3
ROOT=Path(__file__).parent/'spore';(ROOT/'Parts').mkdir(511,False,True)
organic=components(ROOT/'organic-source.png',3);mechanical=components(ROOT/'mechanical-source.png',2);cap_art=components(ROOT/'part-source.png',2)
old=read(ROOT/'start.png');new=read(ROOT/'reference-end.png')

def crop(im):
    yy,xx=np.where(im[:,:,3]>.1);return im[yy.min():yy.max()+1,xx.min():xx.max()+1]

def painted(im,box):
    x,y,w,h=box;out=np.zeros((512,512,4),np.float32);out[y:y+h,x:x+w]=cv2.resize(crop(im),(w,h),None,0,0,cv2.INTER_LANCZOS4);return out

old_cap=painted(cap_art[0],(28,113,441,212));new_cap=painted(cap_art[3],(43,51,410,177))
old_body=painted(organic[0],(78,219,349,226));new_body=painted(organic[3],(111,153,271,224))
open3=painted(organic[1],(99,365,286,80));closed3=painted(organic[2],(103,339,286,106));open4=painted(organic[4],(115,300,263,77));closed4=painted(organic[5],(122,281,256,96))
old_collar=fitted(mechanical[0],(190,241,117,56));old_collar*=~((((X-247)/42)**2+((Y-249)/7)**2<1)[:,:,None]);old_vents=[fitted(mechanical[1],(42,231,113,73)),fitted(mechanical[2],(352,235,108,77))]
new_vents=[fitted(mechanical[3],(53,153,103,73)),fitted(mechanical[4],(352,155,99,73))]
posts=((X>132)&(X<165)&(Y>238)&(Y<310))|((X>341)&(X<375)&(Y>239)&(Y<313));pixels=np.array(rgba(old));hsv=cv2.cvtColor(pixels[:,:,:3],cv2.COLOR_RGB2HSV);warm=(hsv[:,:,0]>13)&(hsv[:,:,0]<43)&(hsv[:,:,1]>90)&(hsv[:,:,2]>40);old_frame=old*((posts&dilate(warm,2))|((X>387)&(Y>310)&(Y<410)))[:,:,None]
p=np.array(rgba(new));hsv=cv2.cvtColor(p[:,:,:3],cv2.COLOR_RGB2HSV);gold=(hsv[:,:,0]>12)&(hsv[:,:,0]<42)&(hsv[:,:,1]>80)&(hsv[:,:,2]>45)
neck_domain=(X>199)&(X<308)&(Y>180)&(Y<219);neck=np.uint8(gold&neck_domain);neck=cv2.morphologyEx(neck,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8));curves=cv2.findContours(neck,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0];cv2.drawContours(neck,curves,-1,1,cv2.FILLED);new_collar=new*(dilate(neck>0,2)&neck_domain)[:,:,None]
ring_domain=(X>139)&(X<366)&(Y>280)&(Y<361);ring=np.uint8(gold&ring_domain);ring=cv2.morphologyEx(ring,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));new_ring=new*(dilate(ring>0,1)&ring_domain)[:,:,None]
old_eggs=[];new_eggs=[]
for level,source,output,positions in [(0,old,old_eggs,[(209,356,46,33),(291,366,44,32),(243,394,47,32)]),(1,new,new_eggs,[(212,300,40,29),(292,301,40,30),(253,327,42,28)])]:
    for x,y,rx,ry in positions:output.append(painted(cap_art[level*3+2],(x-rx,y-ry,2*rx,2*ry)))
def convex_part(im):
    pixels=np.array(rgba(im));found=cv2.findContours(np.uint8(pixels[:,:,3]>40),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0];points=np.concatenate(found);hull=cv2.convexHull(points);mask=np.zeros((512,512),np.uint8);cv2.fillConvexPoly(mask,hull,255);rgb=cv2.inpaint(pixels[:,:,:3],np.uint8(pixels[:,:,3]<250)*255,3,cv2.INPAINT_TELEA).astype(np.float32)/255;alpha=mask.astype(np.float32)/255;return np.concatenate([rgb*alpha[:,:,None],alpha[:,:,None]],2)

def halves(im,axis,convex):
    result=[]
    for side in range(2):
        part=im*((X<=axis) if side==0 else (X>axis))[:,:,None];result.append(convex_part(part) if convex else part)
    return result

open3parts=halves(open3,246,False);closed3parts=halves(closed3,246,True);open4parts=halves(open4,250,False);closed4parts=halves(closed4,250,True)
marks_o3=[(246,444),(154,444),(99,409),(132,365),(246,420)];marks_c3=[(246,444),(174,444),(103,394),(175,339),(246,351)]
marks_o4=[(250,376),(167,376),(115,344),(145,300),(250,353)];marks_c4=[(250,376),(187,376),(122,331),(188,281),(250,292)]

def pair(name,sources,targets,marks_a,marks_b,axis_a,axis_b,delta):
    meshes=[]
    for side in range(2):
        ma=marks_a if side==0 else [(axis_a*2-x,y) for x,y in marks_a];mb=marks_b if side==0 else [(axis_b*2-x,y) for x,y in marks_b];sign=1 if side==0 else -1;pivots=[(axis_a,marks_a[0][1]-4),(axis_a-sign*60,marks_a[0][1]-22),(axis_a-sign*110,marks_a[0][1]-45)]
        mesh=Petal(name+str(side),sources[side],targets[side],ma,mb,pivots[1],pivots[1],pivots,[sign*8,sign*6,-sign*4]);mesh.preserve_texture();mesh.clean=[]
        for source in [mesh.start,mesh.end]:
            pixels=np.array(rgba(source));mask=(pixels[:,:,3]<250)|(pixels[:,:,:3].max(2)<170);rgb=cv2.inpaint(pixels[:,:,:3],np.uint8(mask)*255,5,cv2.INPAINT_TELEA).astype(np.float32)/255;mesh.clean.append(np.concatenate([rgb,np.ones((512,512,1),np.float32)],2))
        mesh.motion(delta);meshes.append(mesh)
    return meshes

close3=pair('close3-',open3parts,closed3parts,marks_o3,marks_c3,246,246,(0,0));close4=pair('close4-',open4parts,closed4parts,marks_o4,marks_c4,250,250,(0,0));grow_face=pair('grow-face-',closed3parts,closed4parts,marks_c3,marks_c4,246,250,(4,-69))

def render_lips(meshes,progress):return over(meshes[0].render(progress),meshes[1].render(progress))
grow_cap=smooth_mesh('grow-cap',shift(old_cap,(0,5)),shift(new_cap,(0,4)),[(246,118),(468,244),(460,326),(108,317),(29,245)],[(250,55),(452,186),(441,229),(90,224),(44,186)],(246,258),180,(4,-64))
grow_body=smooth_mesh('grow-body',old_body,new_body,[(250,219),(386,306),(407,421),(110,439),(115,305)],[(249,153),(358,247),(377,351),(129,373),(135,249)],(246,440),140,(4,-69))
platform=fitted(organic[8],(40,317,431,131));column_l=fitted(organic[6],(91,161,101,185));column_r=fitted(organic[7],(310,162,101,185));machine=fitted(mechanical[5],(365,223,99,155))
base=Prefab('plinth',platform,(250,448),(250,390),32,51,1);left=Prefab('left-column',column_l,(141,340),(210,340),39,59,-1);right=Prefab('right-column',column_r,(360,340),(294,340),39,59,1);tank=Prefab('pressure-machine',machine,(413,375),(339,375),44,60,1);collar=Prefab('gold-collar',new_collar,(250,200),(250,220),44,60,-1);rim=Prefab('bowl-rim',new_ring,(251,350),(251,374),46,60,1)
vents=[Prefab('brass-vent-'+str(i),part,(143,205) if i==0 else (359,205),(247,212),46,60,-1 if i==0 else 1) for i,part in enumerate(new_vents)]
nodes=[base,left,right,tank,collar,rim]+vents;vent_keys=[[],[]]

def old_vent(i,q,c,frame):
    pivot=(140,274) if i==0 else (361,277);world=translate3([pivot[0]+(114 if i==0 else -112)*q,pivot[1]+5*c-64*q,0])@yaw3((90 if i==0 else -90)*q);skin=world@np.linalg.inv(translate3([*pivot,0]));vent_keys[i].append({'frame':frame,'local':(np.linalg.inv(translate3([256,448,0]))@world).tolist()})
    if q>=1:return np.zeros_like(old)
    return affine(old_vents[i],np.array([[skin[0,0],skin[0,1],skin[0,3]],[skin[1,0],skin[1,1],skin[1,3]],[0,0,1]]))

def render(frame):
    c=float(np.clip(frame/24,0,1));g=float(np.clip((frame-44)/16,0,1));q=ease(g);p=float(np.clip(1-(frame-60)/28,0,1))
    cap=shift(old_cap,(0,5*ease(c))) if frame<=44 else grow_cap.render(g) if frame<60 else shift(new_cap,(0,4*ease(p)))
    body=old_body if frame<=44 else grow_body.render(g) if frame<60 else new_body
    face=render_lips(close3,c) if frame<=44 else render_lips(grow_face,g) if frame<60 else render_lips(close4,p)
    old_ring=shift(old_collar,(4*q,74*q+50*ease((frame-56)/4)));box_mask=(X>380)&(Y>300);legacy=over(shift(old_frame*box_mask[:,:,None],(-85*q,-13*q)),shift(old_frame*(~box_mask)[:,:,None],(-30*q,30*q)));value=cap.copy();value=over(legacy,value)
    if frame>=56:value=over(old_ring,value)
    for i in range(2):value=over(old_vent(i,q,ease(c),frame),value)
    for node in [base,left,right,tank]:
        drawn=node.render(frame)
        if node in [left,right]:drawn*=np.clip(1-cap[:,:,3:4],0,1)
        value=over(drawn,value)
    value=over(body,value)
    if frame<56:value=over(old_ring,value)
    for node in vents:value=over(node.render(frame),value)
    value=over(collar.render(frame),value);value=over(rim.render(frame),value)
    for i in range(3):
        if frame<=44:egg=shift(old_eggs[i],(0,[24,20,0][i]*ease(c)))
        elif frame<60:egg=shift(old_eggs[i],(4*q,[24,20,0][i]-69*q)) if g<.5 else shift(new_eggs[i],(0,[20,18,0][i]))
        else:egg=shift(new_eggs[i],(0,[20,18,0][i]*ease(p)))
        value=over(egg,value)
    value=over(face,value)
    if frame==0:return old.copy()
    return value

def rig_data():
    for name,part in [('old-cap',old_cap),('new-cap',new_cap),('old-body',old_body),('new-body',new_body),('open3',open3),('closed3',closed3),('open4',open4),('closed4',closed4),('old-collar',old_collar),('old-frame',old_frame)]+[('old-vent-'+str(i),part) for i,part in enumerate(old_vents)]+[('old-egg-'+str(i),part) for i,part in enumerate(old_eggs)]+[('new-egg-'+str(i),part) for i,part in enumerate(new_eggs)]+[(node.name,node.source) for node in nodes]:rgba(part).save(ROOT/'Parts'/(name+'.png'))
    return {'root':[256,448],'weightedParts':{m.name:m.data() for m in close3+close4+grow_face+[grow_cap,grow_body]},'prefabs':[node.data() for node in nodes],'retiredVents':[{'name':'old-vent-'+str(i),'rigid':True,'keys':vent_keys[i]} for i in range(2)],'keys':KEYS}

if __name__=='__main__':export_sequence(ROOT,render,rig_data,'--draft' in sys.argv)
