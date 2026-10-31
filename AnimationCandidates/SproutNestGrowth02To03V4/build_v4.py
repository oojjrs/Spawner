from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin
import numpy as np
import cv2
import math
import json
import shutil
import sys

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
TEMP=PROJECT/'$Trash/SproutGrowth23V4'
PARTS=ROOT/'Parts'
NATIVE=PROJECT/'DesignAssets/Animations/Nests/Idle03-v1/sprout'
V2=PROJECT/'AnimationCandidates/SproutNestGrowth02To03V2/Parts'
FPS=50
COUNT=310
Y,X=np.mgrid[0:512,0:512].astype(np.float32)
SOURCE_LEFT=np.float64([[155,203],[127,228],[100,271],[98,294],[104,310],[115,322],[145,341],[172,347],[206,347],[227,351],[253,365],[258,364],[264,358],[269,343],[268,328],[260,307],[237,279],[202,255],[187,237],[209,226],[212,220],[211,207],[202,198],[191,194],[178,194]])
CLOSED_LEFT=np.float64([[184,175],[156,208],[126,262],[123,288],[128,309],[141,326],[165,342],[192,350],[220,355],[241,360],[255,365],[259,364],[262,353],[271,331],[280,310],[279,285],[269,260],[253,236],[245,213],[255,199],[257,190],[254,180],[245,169],[229,163],[211,162]])
START_LEFT=np.float64([[155,230],[126,252],[98,300],[100,324],[107,341],[120,354],[150,372],[176,382],[207,385],[229,390],[253,397],[258,396],[263,390],[266,376],[263,361],[250,337],[229,310],[199,285],[185,261],[204,252],[207,245],[204,233],[196,225],[185,222],[172,223]])
SOURCE_RIGHT=SOURCE_LEFT*np.array([-1,1])+[512,0]
CLOSED_RIGHT=CLOSED_LEFT*np.array([-1,1])+[512,0]
for I in range(12,19):
    CLOSED_RIGHT[I]=CLOSED_LEFT[I]+[-4,0]
CLOSED_RIGHT[10]=[257,365]
CLOSED_RIGHT[11]=[253,364]
CLOSED_RIGHT[19:25]=[[231,199],[232,190],[244,180],[262,169],[290,163],[312,162]]
START_RIGHT=START_LEFT*np.array([-1,1])+[512,0]
JOINTS={
    2: [[227,489],[227,420],[288,491],[286,422],[259,349],[291,349]],
    3: [[145,359],[136,291],[376,360],[376,291],[206,202],[318,202]],
    4: [[134,360],[98,307],[379,361],[417,307],[158,182],[350,183]],
    5: [[135,360],[101,307],[378,361],[416,308],[158,182],[353,183]],
    6: [[138,360],[103,308],[384,360],[422,308],[157,184],[363,186]]
}
JOINTS[0]=JOINTS[2]
JOINTS[1]=JOINTS[2]
BIND=np.float64(JOINTS[6])
WINCH_POSES=np.float64([[200,440],[200,440],[200,440],[65,285],[62,264],[64,265],[65,263]])
COLLAR_POSES=np.float64([140,140,140,25,0,0,0])
PHASES=[(0,300,'start-hold',0,0),(300,700,'clump',0,1),(700,1100,'clump',1,2),(1100,1900,'small-hold',2,2),(1900,2200,'growth-1',2,3),(2200,3000,'middle-hold',3,3),(3000,3300,'growth-2',3,4),(3300,4100,'large-hold',4,4),(4100,4600,'open',4,5),(4600,5200,'open',5,6),(5200,6200,'final-hold',6,6)]


def write(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))


def read(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)/255
    a[:,:,3]=np.where(a[:,:,3]>.98,1,a[:,:,3])
    a[:,:,:3]*=a[:,:,3:4]
    return a


def rgba(a):
    a=np.clip(a,0,1)
    pixels=np.concatenate([a[:,:,:3]/np.maximum(a[:,:,3:4],1e-7),a[:,:,3:4]],2)
    return Image.fromarray(np.uint8(np.clip(pixels,0,1)*255+.5))


def over(a,b):
    return a+b*(1-a[:,:,3:4])


def scale_pose(points,sx,sy,root_y):
    return (np.array(points)-[256,365])*[sx,sy]+[256,root_y]


def petal_poses(source,closed,start):
    small=scale_pose(closed,.62,.62,394)
    middle=scale_pose(closed,.8,.91,385)
    closing=start*.52+small*.48
    closing[:,0]=start[:,0]*.25+small[:,0]*.75
    opening=closed*.55+source*.45
    return [start,closing,small,middle,closed,opening,source]


LEFT_POSES=petal_poses(SOURCE_LEFT,CLOSED_LEFT,START_LEFT)
RIGHT_POSES=petal_poses(SOURCE_RIGHT,CLOSED_RIGHT,START_RIGHT)


def tps(source,target,points):
    source=np.float64(source)/512
    target=np.float64(target)/512
    points=np.float64(points)/512
    difference=source[:,None,:]-source[None,:,:]
    r2=np.sum(difference*difference,2)
    kernel=r2*np.log(r2+1e-12)
    n=len(source)
    polynomial=np.column_stack([np.ones(n),source])
    matrix=np.block([[kernel+np.eye(n)*1e-8,polynomial],[polynomial.T,np.zeros((3,3))]])
    weights=np.linalg.solve(matrix,np.vstack([target,np.zeros((3,2))]))
    difference=points[:,None,:]-source[None,:,:]
    r2=np.sum(difference*difference,2)
    kernel=r2*np.log(r2+1e-12)
    return (kernel@weights[:n]+np.column_stack([np.ones(len(points)),points])@weights[n:])*512


class Petal:
    def __init__(self,name,source,poses):
        self.name=name
        self.image=read(PARTS/(name+'.png'))
        self.source=source
        self.poses=poses
        mask=np.uint8(self.image[:,:,3]>.12)
        contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        contour=contours[sorted((-cv2.contourArea(c),i) for i,c in enumerate(contours))[0][1]]
        outline=cv2.approxPolyDP(contour,.75,True).reshape(-1,2)
        points=[list(map(float,p)) for p in outline]
        for y in range(195,368,10):
            for x in range(90,425,10):
                if mask[y,x]:
                    points.append([float(x),float(y)])
        for p in source:
            points.append(p.tolist())
        points=np.unique(np.array(points),False,False,False,0)
        subdiv=cv2.Subdiv2D((0,0,512,512))
        for p in points:
            subdiv.insert(tuple(p))
        triangles=[]
        for triangle in subdiv.getTriangleList().reshape(-1,3,2):
            indexes=[]
            for p in triangle:
                distance=np.sum((points-p)**2,1)
                indexes.append(int(np.argmin(distance)))
            samples=np.vstack([triangle.mean(0),(triangle[0]+triangle[1])/2,(triangle[1]+triangle[2])/2,(triangle[2]+triangle[0])/2])
            samples=np.int32(np.rint(samples))
            if np.all(mask[samples[:,1],samples[:,0]]):
                triangles.append(indexes)
        self.vertices=points
        self.triangles=np.array(triangles)
        self.reference_areas=self.areas(points)
        self.fixed=np.zeros(len(points),np.bool_)
        for p in source:
            self.fixed[np.argmin(np.sum((points-p)**2,1))]=True

    def areas(self,points):
        triangles=points[self.triangles]
        a,b=triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]
        return a[:,0]*b[:,1]-a[:,1]*b[:,0]

    def render(self,a,b,q):
        target=self.poses[a]*(1-q)+self.poses[b]*q
        vertices=tps(self.source,target,self.vertices)
        for iteration in range(180):
            areas=self.areas(vertices)
            bad=np.where(areas*self.reference_areas<=.02*np.abs(self.reference_areas))[0]
            if not len(bad):
                break
            for index in bad:
                ids=self.triangles[index]
                p=vertices[ids]
                sign=1 if self.reference_areas[index]>0 else -1
                area=areas[index]*sign
                gradients=np.float64([[p[1,1]-p[2,1],p[2,0]-p[1,0]],[p[2,1]-p[0,1],p[0,0]-p[2,0]],[p[0,1]-p[1,1],p[1,0]-p[0,0]]])*sign
                gradients[self.fixed[ids]]=0
                factor=(.03*abs(self.reference_areas[index])-area)/(np.sum(gradients*gradients)+1e-9)
                vertices[ids]+=factor*gradients
        areas=self.areas(vertices)
        inverted=int(np.count_nonzero(areas*self.reference_areas<=0))
        map_x=np.full((512,512),-1000,np.float32)
        map_y=np.full((512,512),-1000,np.float32)
        for indexes in self.triangles:
            destination=np.float32(vertices[indexes])
            original=np.float32(self.vertices[indexes])
            x0=max(0,int(np.floor(np.min(destination[:,0]))))
            x1=min(512,int(np.ceil(np.max(destination[:,0])))+1)
            y0=max(0,int(np.floor(np.min(destination[:,1]))))
            y1=min(512,int(np.ceil(np.max(destination[:,1])))+1)
            if x1<=x0 or y1<=y0:
                continue
            matrix=cv2.getAffineTransform(destination,original)
            mask=np.zeros((y1-y0,x1-x0),np.uint8)
            cv2.fillConvexPoly(mask,np.int32(np.rint(destination-[x0,y0])),1)
            take=mask>0
            x,y=X[y0:y1,x0:x1],Y[y0:y1,x0:x1]
            mx=matrix[0,0]*x+matrix[0,1]*y+matrix[0,2]
            my=matrix[1,0]*x+matrix[1,1]*y+matrix[1,2]
            map_x[y0:y1,x0:x1][take]=mx[take]
            map_y[y0:y1,x0:x1][take]=my[take]
        result=cv2.remap(self.image,map_x,map_y,cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))
        return result,inverted


def transform(a,pivot,target,angle,sx,sy):
    c,s=math.cos(angle),math.sin(angle)
    matrix=np.float32([[c*sx,-s*sy,target[0]-c*sx*pivot[0]+s*sy*pivot[1]],[s*sx,c*sy,target[1]-s*sx*pivot[0]-c*sy*pivot[1]]])
    return cv2.warpAffine(a,matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


def projection_matrix(s0,s1,d0,d1):
    sv,dv=s1-s0,d1-d0
    u,v=sv/np.linalg.norm(sv),dv/np.linalg.norm(dv)
    matrix=np.outer(v,u)*np.linalg.norm(dv)/np.linalg.norm(sv)+np.outer([-v[1],v[0]],[-u[1],u[0]])
    return matrix,d0-matrix@s0


def project(a,s0,s1,d0,d1):
    matrix,offset=projection_matrix(s0,s1,d0,d1)
    return cv2.warpAffine(a,np.float32(np.column_stack([matrix,offset])),(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


def prepare():
    PARTS.mkdir(511,True,True)
    TEMP.mkdir(511,True,True)
    (ROOT/'KeyGuides').mkdir(511,True,True)
    for path in (PROJECT/'AnimationCandidates/SproutNestGrowth02To03V3Keyframes/KeyPoses').glob('*.png'):
        shutil.copyfile(path,ROOT/'KeyGuides'/path.name)
    for old,new in [('cup-left','petal-left'),('cup-right','petal-right'),('sprout','sprout')]:
        shutil.copyfile(NATIVE/'Parts'/(old+'.png'),PARTS/(new+'.png'))
    rear=read(NATIVE/'Parts/rear-leaves-and-bean.png')
    seed_mask=(Y>230)&(X>179)&(X<335)
    rgba(rear*seed_mask[:,:,None]).save(PARTS/'seeds.png')
    color=rear[:,:,:3]/np.maximum(rear[:,:,3:4],1e-7)
    warm=(color[:,:,0]>color[:,:,1]*1.1)&(color[:,:,2]<color[:,:,1]*.9)
    clean_rear=rear*(~warm)[:,:,None]
    rgba(clean_rear*((~seed_mask)&(X<256))[:,:,None]).save(PARTS/'rear-left.png')
    rgba(clean_rear*((~seed_mask)&(X>=256))[:,:,None]).save(PARTS/'rear-right.png')
    ground=read(NATIVE/'Sources/Parts/old-10.png')
    rgba(ground).save(PARTS/'ground.png')
    lining=read(NATIVE/'Parts/inner-lining.png')
    lining[(X<156)|(X>358)]=0
    color=lining[:,:,:3]/np.maximum(lining[:,:,3:4],1e-7)
    warm=(color[:,:,0]>color[:,:,1]*1.1)&(color[:,:,2]<color[:,:,1]*.9)
    lining[warm]=0
    rgba(lining).save(PARTS/'lining.png')
    hardware=[side+'-'+name for side in ['left','right'] for name in ['brace','brace-bindings','lever','upper-brass-pivot','lower-brass-pivot','joint-binding']]+['collar','collar-bindings','winch-drum','winch-axle-and-knob','winch-wrap','winch-tether']
    for name in hardware:
        shutil.copyfile(V2/(name+'.png'),PARTS/(name+'.png'))
    for suffix in ['', '-bindings']:
        shutil.copyfile(PROJECT/'AnimationCandidates/SproutNestGrowth02To03V3/Parts'/('4-collar-left'+suffix+'.png'),PARTS/('winch-mount'+suffix+'.png'))
    write(ROOT/'rig.json',{'method':'single-texture-set-continuous-part-rig','canvas':[512,512],'root':[256,445],'leftSourceCage':SOURCE_LEFT.tolist(),'rightSourceCage':SOURCE_RIGHT.tolist(),'leftPoseCages':[p.tolist() for p in LEFT_POSES],'rightPoseCages':[p.tolist() for p in RIGHT_POSES],'jointPoses':JOINTS,'winchPositions':WINCH_POSES.tolist(),'collarOffsets':COLLAR_POSES.tolist(),'phasesMs':PHASES,'partTextures':[p.name for p in sorted(PARTS.glob('*.png'))],'textureSwitches':False,'originalKeyBypass':False,'temporalPoseBlend':False})


class Renderer:
    def __init__(self):
        self.parts={p.stem:read(p) for p in PARTS.glob('*.png')}
        self.left=Petal('petal-left',SOURCE_LEFT,LEFT_POSES)
        self.right=Petal('petal-right',SOURCE_RIGHT,RIGHT_POSES)
        self.cache={}
        self.records=[]
        meshes=[]
        for petal in [self.left,self.right]:
            meshes.append({'part':petal.name,'vertices':petal.vertices.tolist(),'triangles':petal.triangles.tolist(),'fixedCageVertices':np.where(petal.fixed)[0].tolist(),'poseCages':[p.tolist() for p in petal.poses]})
        write(ROOT/'meshes.json',meshes)

    def hardware(self,joints,winch_target,collar_shift):
        back=np.zeros((512,512,4),np.float32)
        front=np.zeros_like(back)
        for side,low,hinge,tip in [('left',0,1,4),('right',2,3,5)]:
            for suffix in ['', '-bindings']:
                back=over(project(self.parts[side+'-brace'+suffix],BIND[hinge],BIND[tip],joints[hinge],joints[tip]),back)
            for suffix in ['lever','joint-binding']:
                front=over(project(self.parts[side+'-'+suffix],BIND[low],BIND[hinge],joints[low],joints[hinge]),front)
            for name,index in [('upper-brass-pivot',hinge),('lower-brass-pivot',low)]:
                front=over(transform(self.parts[side+'-'+name],BIND[index],joints[index],0,1,1),front)
        source_anchor=np.float64([65,263])
        upper_vector=joints[0]-joints[1]
        upper_normal=np.array([-upper_vector[1],upper_vector[0]])/np.linalg.norm(upper_vector)
        mount_target=joints[1]+.12*upper_vector+7*upper_normal
        for suffix in ['', '-bindings']:
            neck=project(self.parts['winch-mount'+suffix],np.array([158.,354.]),np.array([212.,360.]),winch_target+[23,10],mount_target)
            back=over(neck,back)
        for name in ['winch-tether','winch-drum','winch-wrap','winch-axle-and-knob']:
            back=over(transform(self.parts[name],source_anchor,winch_target,0,1,1),back)
        collar_offset=np.array([(joints[0,0]+joints[2,0]-BIND[0,0]-BIND[2,0])/2,collar_shift])
        for name in ['collar','collar-bindings']:
            front=over(transform(self.parts[name],[0,0],collar_offset,0,1,1),front)
        front[Y>394]=0
        back[Y>394]=0
        return back,front

    def render(self,a,b,q):
        identity=(a,b,round(q,10))
        if identity in self.cache:
            return self.cache[identity]
        left,li=self.left.render(a,b,q)
        right,ri=self.right.render(a,b,q)
        values=np.float64([[1,1,397],[.72,.76,396],[.62,.62,394],[.8,.91,385],[1,1,365],[1,1,365],[1,1,365]])
        sx,sy,root_y=values[a]*(1-q)+values[b]*q
        lining=transform(self.parts['lining'],[256,365],[256,root_y],0,sx,sy)
        image=lining
        rear_source=np.float32([[186,139],[135,280],[256,340]])
        rear_closed=np.float32([[242,121],[138,238],[256,365]])
        rear_poses=[rear_source+[0,28],scale_pose(rear_closed,.62,.62,394),scale_pose(rear_closed,.62,.62,394),scale_pose(rear_closed,.8,.91,385),rear_closed,rear_closed*.87+rear_source*.13,rear_source]
        rear_poses[1][:,1]=rear_poses[0][:,1]*.52+rear_poses[2][:,1]*.48
        rear_poses[1][:,0]=rear_poses[0][:,0]*.25+rear_poses[2][:,0]*.75
        joints=np.float64(JOINTS[a])*(1-q)+np.float64(JOINTS[b])*q
        winch_target=WINCH_POSES[a]*(1-q)+WINCH_POSES[b]*q
        collar_shift=COLLAR_POSES[a]*(1-q)+COLLAR_POSES[b]*q
        back,front=self.hardware(joints,winch_target,collar_shift)
        image=over(back,image)
        for side,sign in [('left',1),('right',-1)]:
            source=rear_source.copy()
            target=np.float32(rear_poses[a]*(1-q)+rear_poses[b]*q)
            if sign==-1:
                source[:,0]=512-source[:,0]
                target[:,0]=512-target[:,0]
            matrix=cv2.getAffineTransform(source,target)
            rear=cv2.warpAffine(self.parts['rear-'+side],matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))
            image=over(rear,image)
        core_poses=np.float64([[1,1,16],[.72,.76,36],[.62,.62,29],[.8,.91,20],[1,1,0],[1,1,-22],[1,1,0]])
        cx,cy,shift=core_poses[a]*(1-q)+core_poses[b]*q
        for part in ['seeds','sprout']:
            core=transform(self.parts[part],[256,365],[256,365+shift],0,cx,cy)
            image=over(core,image)
        image=over(left,image)
        image=over(right,image)
        image=over(front,image)
        ground_values=np.array([.91,.91,.91,.96,1,1,1])
        gx=float(ground_values[a]*(1-q)+ground_values[b]*q)
        ground=transform(self.parts['ground'],[256,445],[256,445],0,gx,1)
        image=over(ground,image)
        self.records.append({'from':a,'to':b,'q':q,'jointCenters':joints.tolist(),'invertedPetalTriangles':[li,ri]})
        self.cache[identity]=image
        return image


def state(index):
    time=index*20
    for start,end,phase,a,b in PHASES:
        if start<=time<end:
            q=0 if a==b else (time-start)/(end-start)
            q=q*q*(3-2*q)
            return phase,a,b,q
    return 'final-hold',6,6,0


def animated(frames,path,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':[20]*len(frames),'loop':loop,'lossless':True,'method':4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0],stream,str(path))


def export(mode):
    renderer=Renderer()
    if mode=='poses':
        selected=list(range(7))
        frames=[rgba(renderer.render(i,i,0)) for i in selected]
        out=Image.new('RGB',(2048,1104),'#25332e')
        draw=ImageDraw.Draw(out)
        font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',18)
        for i,frame in enumerate(frames):
            x,y=i%4*512,i//4*552
            draw.text((x+8,y+8),'rig pose '+str(i),'white',font)
            out.paste(frame,(x,y+40),frame.getchannel('A'))
        out.save(TEMP/'rig-poses.png')
        write(TEMP/'mesh-diagnostics.json',renderer.records)
        print('Continuous rig poses ready.')
        return
    indexes=list(range(85,166)) if mode=='representative' else list(range(COUNT))
    frames=[]
    timeline=[]
    destination=TEMP/'representative-frames' if mode=='representative' else ROOT/'Frames'
    destination.mkdir(511,True,True)
    for i,index in enumerate(indexes):
        phase,a,b,q=state(index)
        frame=rgba(renderer.render(a,b,q))
        frame.save(destination/(str(i if mode=='representative' else index).zfill(3)+'.png'))
        frames.append(frame)
        timeline.append({'frame':index,'timeMs':index*20,'phase':phase,'from':a,'to':b,'q':q})
        if i>0 and i%80==0:
            print('Rendered '+str(i)+' frames.')
            sys.stdout.flush()
    previews=[]
    for frame in frames:
        preview=Image.new('RGB',(512,512),'#25332e')
        preview.paste(frame,(0,0),frame.getchannel('A'))
        previews.append(preview.resize((384,384),Image.Resampling.LANCZOS))
    animated(previews,TEMP/'representative.webp' if mode=='representative' else ROOT/'preview.webp',0)
    step=5 if mode=='representative' else 10
    choices=list(range(0,len(frames),step))
    contact=Image.new('RGB',(1536,math.ceil(len(choices)/6)*280),'#25332e')
    draw=ImageDraw.Draw(contact)
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',16)
    for slot,i in enumerate(choices):
        x,y=slot%6*256,slot//6*280
        draw.text((x+5,y+4),str(round(indexes[i]*.02,2))+'s '+timeline[i]['phase'],'white',font)
        contact.paste(previews[i].resize((256,256),Image.Resampling.LANCZOS),(x,y+24))
    contact.save(TEMP/'representative-contact.png' if mode=='representative' else ROOT/'playback-contact.png')
    write(TEMP/'mesh-diagnostics.json' if mode=='representative' else ROOT/'motion.json',renderer.records)
    if mode=='representative':
        print('Continuous representative ready.')
        return
    sheet=Image.new('RGBA',(9216,9216),(0,0,0,0))
    for i,frame in enumerate(frames):
        sheet.paste(frame,(i%18*512,i//18*512))
    sheet.save(ROOT/'growth-sheet.png')
    animated(frames,ROOT/'growth.webp',1)
    write(ROOT/'timeline.json',timeline)
    write(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':COUNT,'frameMs':20,'periodMs':6200,'columns':18,'rows':18,'pivot':[256,448],'loop':False,'image':'growth-sheet.png','animatedImage':'growth.webp','sourceFrames':'Frames','sourceParts':'Parts','rig':'rig.json','textureSwitches':False,'keyImageBypass':False,'temporalPoseBlend':False,'holdsMs':[[1100,1900],[2200,3000],[3300,4100]]})
    print('Continuous V4 exported.')


if __name__=='__main__':
    if sys.argv[1]=='prepare':
        prepare()
    else:
        export(sys.argv[1])
