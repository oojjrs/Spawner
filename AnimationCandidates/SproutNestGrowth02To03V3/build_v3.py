from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin
import numpy as np
import cv2
import json
import math
import sys
import shutil

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent
TEMP = PROJECT / '$Trash/SproutGrowth23V3'
KEYS = PROJECT / 'AnimationCandidates/SproutNestGrowth02To03V3Keyframes/KeyPoses'
PARTS = ROOT / 'Parts'
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
IDENTITY = np.stack([X, Y], 2)
NAMES = ['00-start', '01-closing', '02-small-hold', '03-middle-hold', '04-large-hold', '05-opening', '06-end']
JOINTS = {
    3: [[137, 319], [137, 250], [378, 321], [376, 252], [229, 179], [321, 179]],
    4: [[134, 360], [98, 307], [379, 361], [417, 307], [158, 182], [350, 183]],
    5: [[135, 360], [101, 307], [378, 361], [416, 308], [158, 182], [353, 183]],
    6: [[138, 360], [103, 308], [384, 360], [422, 308], [157, 184], [363, 186]]
}
PETALS = [
    [[187,168],[326,168],[161,225],[352,225],[205,244],[306,244],[97,305],[414,305],[157,370],[355,370],[256,397],[256,315],[256,354]],
    [[238,202],[272,202],[208,241],[306,241],[244,262],[273,262],[157,309],[355,309],[192,370],[320,370],[256,395],[256,281],[256,333]],
    [[237,247],[269,247],[215,267],[298,267],[253,277],[271,277],[173,325],[339,325],[203,371],[309,371],[256,394],[256,285],[261,321]],
    [[239,162],[270,162],[211,204],[302,204],[250,219],[271,219],[150,302],[365,302],[181,365],[331,365],[256,385],[256,228],[263,282]],
    [[242,121],[273,121],[203,161],[312,161],[248,174],[269,174],[118,290],[393,290],[157,344],[355,344],[256,367],[256,183],[264,253]],
    [[240,124],[274,124],[196,169],[319,169],[234,191],[279,191],[119,290],[394,290],[159,344],[355,344],[256,367],[256,218],[265,261]],
    [[186,139],[334,139],[162,199],[351,199],[209,216],[305,216],[108,280],[409,280],[153,337],[355,337],[256,366],[256,275],[255,306]]
]
BASE = [[40,330],[72,322],[108,350],[80,386],[129,415],[165,386],[210,404],[256,445],[302,404],[348,386],[390,415],[436,386],[405,350],[446,322],[477,330],[256,420]]
BOUNDARY = [[0,0],[128,0],[256,0],[384,0],[511,0],[0,150],[511,150],[0,300],[511,300],[0,450],[511,450],[0,511],[256,511],[511,511]]
POLYGONS = {
    3: {
        'left-brace': [[143,232],[178,195],[190,191],[196,205],[158,250],[142,262]],
        'right-brace': [[315,191],[333,198],[380,235],[385,265],[364,258],[321,211]],
        'left-lever': [[129,232],[148,232],[157,245],[151,289],[158,319],[146,343],[128,334],[114,304],[119,255]],
        'right-lever': [[362,232],[383,234],[392,254],[390,297],[397,323],[378,345],[361,330],[360,290]],
        'winch': [[26,262],[45,252],[80,250],[117,256],[126,284],[110,307],[73,305],[57,291],[25,296]],
        'collar-left': [], 'collar-center': [], 'collar-right': []
    },
    4: {
        'left-brace': [[76,286],[91,257],[133,190],[154,171],[166,176],[158,196],[119,270],[107,303]],
        'right-brace': [[339,171],[355,176],[373,192],[420,266],[442,284],[434,305],[413,298],[391,260],[349,197]],
        'left-lever': [[81,292],[97,288],[115,302],[125,326],[149,344],[155,360],[142,376],[121,369],[105,345],[95,324],[81,314]],
        'right-lever': [[407,288],[426,290],[435,306],[424,325],[407,344],[395,371],[375,375],[360,363],[365,345],[390,326],[401,308]],
        'winch': [[16,244],[33,241],[44,227],[58,215],[84,217],[105,235],[101,269],[91,294],[69,288],[46,274],[36,266],[17,270]],
        'collar-left': [[141,342],[176,340],[216,348],[226,366],[216,375],[174,365],[150,364]],
        'collar-center': [[214,352],[233,357],[278,357],[298,350],[304,374],[287,393],[237,394],[213,377]],
        'collar-right': [[293,348],[336,341],[370,341],[374,364],[335,369],[294,376]]
    },
    5: {
        'left-brace': [[79,286],[94,257],[135,190],[155,172],[168,177],[160,199],[122,271],[110,303]],
        'right-brace': [[342,172],[358,177],[376,194],[423,267],[445,286],[435,307],[415,299],[394,261],[352,198]],
        'left-lever': [[84,292],[100,289],[118,302],[128,327],[151,345],[157,361],[145,377],[124,370],[108,346],[98,325],[84,314]],
        'right-lever': [[408,289],[428,291],[437,307],[425,327],[408,346],[397,373],[377,377],[362,364],[367,346],[392,327],[403,309]],
        'winch': [[17,245],[35,242],[46,229],[61,217],[87,219],[108,237],[104,271],[94,296],[72,290],[49,276],[39,268],[18,272]],
        'collar-left': [[144,343],[179,342],[218,350],[229,368],[218,377],[177,367],[153,366]],
        'collar-center': [[215,353],[234,359],[280,358],[300,351],[305,376],[289,395],[239,396],[214,379]],
        'collar-right': [[295,349],[338,343],[372,343],[376,366],[337,371],[296,378]]
    },
    6: {
        'left-brace': [[80,287],[96,259],[133,194],[153,177],[168,181],[161,200],[124,273],[112,306]],
        'right-brace': [[352,176],[368,180],[389,202],[431,270],[452,285],[442,308],[420,302],[401,264],[361,202]],
        'left-lever': [[86,294],[102,291],[121,304],[131,329],[155,346],[161,362],[149,378],[128,371],[112,347],[102,327],[86,316]],
        'right-lever': [[410,291],[431,293],[440,310],[430,329],[414,348],[405,375],[385,379],[370,366],[375,348],[399,330],[405,311]],
        'winch': [[22,248],[39,244],[48,231],[64,220],[91,223],[111,240],[106,275],[98,299],[77,293],[52,280],[43,272],[22,274]],
        'collar-left': [[148,344],[181,343],[222,351],[230,369],[221,379],[180,369],[157,368]],
        'collar-center': [[217,354],[237,359],[283,359],[303,352],[309,378],[292,397],[242,398],[217,381]],
        'collar-right': [[299,350],[344,344],[379,344],[384,367],[344,372],[300,379]]
    }
}


def read(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    a[:,:,:3] *= a[:,:,3:4]
    return a


def rgba(a):
    a = np.clip(a,0,1)
    c = np.concatenate([a[:,:,:3] / np.maximum(a[:,:,3:4],1e-7),a[:,:,3:4]],2)
    return Image.fromarray(np.uint8(np.clip(c,0,1)*255+.5))


def over(a,b):
    return a + b*(1-a[:,:,3:4])


def write(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))


def polygon(points):
    mask = np.zeros((512,512),np.uint8)
    if points:
        cv2.fillPoly(mask,[np.int32(points)],1)
    return mask


def disk(point,radius):
    return np.uint8((X-point[0])**2+(Y-point[1])**2<=radius**2)


def project(a,s0,s1,d0,d1):
    sv, dv = np.array(s1)-s0,np.array(d1)-d0
    sl, dl = np.linalg.norm(sv),np.linalg.norm(dv)
    u, v = sv/sl, dv/dl
    sn, dn = np.array([-u[1],u[0]]),np.array([-v[1],v[0]])
    mat = np.outer(v,u)*(dl/sl)+np.outer(dn,sn)
    offset = np.array(d0)-mat@np.array(s0)
    matrix = np.float32(np.column_stack([mat,offset]))
    return cv2.warpAffine(a,matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


def move(a,offset):
    matrix = np.float32([[1,0,offset[0]],[0,1,offset[1]]])
    return cv2.warpAffine(a,matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


def rigid(a,pivot,target,angle):
    c,s = math.cos(angle),math.sin(angle)
    matrix = np.float32([[c,-s,target[0]-c*pivot[0]+s*pivot[1]],[s,c,target[1]-s*pivot[0]-c*pivot[1]]])
    return cv2.warpAffine(a,matrix,(512,512),None,cv2.INTER_LINEAR,cv2.BORDER_CONSTANT,(0,0,0,0))


def project_point(point,s0,s1,d0,d1):
    sv,dv=np.array(s1)-s0,np.array(d1)-d0
    u,v=sv/np.linalg.norm(sv),dv/np.linalg.norm(dv)
    normal=np.array([-u[1],u[0]])
    offset=np.array(point)-s0
    return np.array(d0)+v*(offset@u)*np.linalg.norm(dv)/np.linalg.norm(sv)+np.array([-v[1],v[0]])*(offset@normal)


def material(a):
    raw = np.array(rgba(a)).astype(np.float32)
    r,g,b,alpha = [raw[:,:,i] for i in range(4)]
    seeds = np.zeros((512,512),np.uint8)
    seeds[(r>g*1.06)&(r>b*1.2)&(alpha>100)] = 1
    seeds[(g>r*.98)&(g>b*1.1)&(g>50)&(alpha>100)] = 2
    if not np.any(seeds==2):
        return a,np.zeros_like(a)
    _, nearest = cv2.distanceTransformWithLabels(np.uint8(seeds==0),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
    lookup = np.r_[0,seeds[seeds>0]]
    labels = lookup[nearest]
    return a*(labels==1)[:,:,None],a*(labels==2)[:,:,None]


def controls(key):
    return np.float64(BOUNDARY+BASE+PETALS[key])/512


def organic_map(source,target):
    source,target = np.float64(source),np.float64(target)
    delta = target[:,None,:]-target[None,:,:]
    r2 = np.sum(delta*delta,2)
    kernel = r2*np.log(r2+1e-12)
    n = len(source)
    poly = np.column_stack([np.ones(n),target])
    matrix = np.block([[kernel+np.eye(n)*1e-8,poly],[poly.T,np.zeros((3,3))]])
    weights = np.linalg.solve(matrix,np.vstack([source,np.zeros((3,2))]))
    result = np.empty((512,512,2),np.float32)
    for y in range(0,512,32):
        grid = IDENTITY[y:y+32].reshape(-1,2)/512
        delta = grid[:,None,:]-target[None,:,:]
        r2 = np.sum(delta*delta,2)
        basis = r2*np.log(r2+1e-12)
        values = basis@weights[:n]+np.column_stack([np.ones(len(grid)),grid])@weights[n:]
        result[y:y+32] = (values*512).reshape(-1,512,2)
    return result


def warp(a, mapping):
    return cv2.remap(a,mapping[:,:,0],mapping[:,:,1],cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT,(0,0,0,0))


def prepare():
    PARTS.mkdir(511,True,True)
    (ROOT/'KeyPoses').mkdir(511,True,True)
    (ROOT/'Sources').mkdir(511,True,True)
    TEMP.mkdir(511,True,True)
    inventory = []
    for key,name in enumerate(NAMES):
        shutil.copyfile(KEYS/(name+'.png'),ROOT/'KeyPoses'/(name+'.png'))
        original = read(KEYS/(name+'.png'))
        owner = np.zeros((512,512),np.uint8)
        ids = {}
        if key>=3:
            raw = np.array(rgba(original)).astype(np.float32)
            r,g,b,alpha = [raw[:,:,i] for i in range(4)]
            wood_seed = (r>g*1.09)&(r>b*1.45)&(alpha>100)
            flower = polygon([[195,160],[320,160],[320,342],[195,342]]) if key>=5 else np.zeros((512,512),np.uint8)
            wood_seed &= flower==0
            regions = []
            for index,(part,points) in enumerate(POLYGONS[key].items(),1):
                mask = polygon(points)
                regions.append(mask)
                owner[wood_seed&(mask>0)] = index
                ids[part] = index
            distances = np.stack([cv2.distanceTransform(1-m,cv2.DIST_L2,5) if np.any(m) else np.full((512,512),1000,np.float32) for m in regions],2)
            closest = np.argmin(distances,2)+1
            owner[wood_seed&(owner==0)] = closest[wood_seed&(owner==0)]
            _, nearest = cv2.distanceTransformWithLabels(np.uint8(owner==0),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
            lookup = np.r_[0,owner[owner>0]]
            near_owner = lookup[nearest]
            near_wood = cv2.distanceTransform(np.uint8(owner==0),cv2.DIST_L2,5)
            union = cv2.dilate(np.max(np.stack(regions,2),2),np.ones((9,9),np.uint8))
            green = (g>r*.98)&(g>b*1.6)&(g>45)&(alpha>100)
            bindings = green&(union>0)&(near_wood<13)&(flower==0)
            bindings |= green&(X<105)&(Y<315)&(Y>220)&(flower==0)&(near_wood<24)
            owner[bindings] = near_owner[bindings]
            seeds = owner.copy()
            colored = (np.maximum.reduce([r,g,b])>75)&(alpha>100)&(near_wood>3)
            seeds[(owner==0)&colored] = 255
            _, nearest = cv2.distanceTransformWithLabels(np.uint8(seeds==0),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_PIXEL)
            lookup = np.r_[0,seeds[seeds>0]]
            owner = lookup[nearest]
            owner[(owner==255)|(alpha==0)] = 0
            visible = np.uint8((owner==0)&(alpha>40))
            count,labels,stats,centers = cv2.connectedComponentsWithStats(visible,8)
            keep = np.zeros((512,512),np.uint8)
            pale = (r>110)&(g>110)&(b>80)&(np.abs(r-g)<40)&(g<b*1.5)
            for component in range(1,count):
                if stats[component,4]>300 or np.count_nonzero(pale&(labels==component))>5:
                    keep[labels==component] = 1
            keep = cv2.dilate(keep,np.ones((3,3),np.uint8))
            stray = (owner==0)&(alpha>0)&(keep==0)
            owner[stray] = closest[stray]
            anatomy = np.zeros((512,512),np.uint8)
            cv2.fillConvexPoly(anatomy,cv2.convexHull(np.int32(PETALS[key][:11])),1)
            anatomy = cv2.dilate(anatomy,np.ones((41,41),np.uint8))
            base_edge = np.interp(X,[0,110,145,200,256,312,367,402,511],[300,300,360,380,393,380,360,300,300])
            stray = (owner==0)&(alpha>0)&(anatomy==0)&(Y<base_edge-7)
            owner[stray] = closest[stray]
            if key==6:
                owner[:]=0
                for part,source_id in [('left-brace',6),('right-brace',7),('left-lever',8),('right-lever',9),('winch',0)]:
                    native=np.array(Image.open(ROOT/'Sources'/('native-hardware-'+str(source_id)+'.png')).convert('RGBA')).astype(np.float32)
                    matching=(np.max(np.abs(native[:,:,:3]-raw[:,:,:3]),2)<18)&(native[:,:,3]>20)&(alpha>20)
                    material_seed = (((r>g*1.09)&(r>b*1.45))|((g>r*.98)&(g>b*1.6)))&matching
                    edge = cv2.dilate(np.uint8(material_seed),np.ones((5,5),np.uint8))>0
                    pale = (g>=r*.94)&(b>g*.65)&(g>95)
                    matching &= material_seed|(edge&(~pale))
                    if source_id==0:
                        owner[matching&(Y<330)]=ids['winch']
                        owner[matching&(Y>=330)&(X<214)]=ids['collar-left']
                        owner[matching&(Y>=330)&(X>=214)&(X<304)]=ids['collar-center']
                        owner[matching&(Y>=330)&(X>=304)]=ids['collar-right']
                    else:
                        owner[matching]=ids[part]
                for body_part in ['cup-left','cup-right','rear-leaves-and-bean','sprout']:
                    native=np.array(Image.open(ROOT/'Sources'/('native-'+body_part+'.png')).convert('RGBA')).astype(np.float32)
                    matching=(np.max(np.abs(native[:,:,:3]-raw[:,:,:3]),2)<20)&(native[:,:,3]>30)&(alpha>20)
                    owner[matching]=0
            for side,low_id,upper_id in [('left',0,1),('right',2,3)]:
                for suffix,point_id,radius in [('upper-brass',upper_id,17),('lower-brass',low_id,14.5)]:
                    part = side+'-'+suffix
                    index = len(ids)+1
                    owner[disk(JOINTS[key][point_id],radius)>0] = index
                    ids[part] = index
        organic = original*(owner==0)[:,:,None]
        rgba(organic).save(PARTS/(str(key)+'-organic.png'))
        if key>=3:
            underlay = warp(read(ROOT/'Sources/organic-hidden-registered.png'),organic_map(controls(4),controls(key)))
            domain = polygon([PETALS[key][2],PETALS[key][3],PETALS[key][7],PETALS[key][9],PETALS[key][10],PETALS[key][8],PETALS[key][6]])>0
            domain = cv2.dilate(np.uint8(domain),np.ones((17,17),np.uint8))>0
            domain |= (Y>338)&(Y<412)&(X>112)&(X<402)
            if key==6:
                underlay=np.zeros_like(original)
                for body_part in ['rear-leaves-and-bean','sprout','cup-left','cup-right','ground']:
                    underlay=over(read(ROOT/'Sources'/('native-'+body_part+'.png')),underlay)
                domain[:]=True
            padded=cv2.dilate(np.uint8(owner>0),np.ones((3,3),np.uint8))>0
            coverage=cv2.dilate(np.uint8(original[:,:,3]>.5),np.ones((3,3),np.uint8))>0
            hidden = underlay*(padded&coverage&domain)[:,:,None]
            rgba(hidden).save(PARTS/(str(key)+'-organic-hidden.png'))
        for part,index in ids.items():
            image = original*(owner==index)[:,:,None]
            if 'brass' not in part:
                wood,bindings = material(image)
                if part in ['left-lever','right-lever']:
                    side = part.split('-')[0]
                    low,upper = (0,1) if side=='left' else (2,3)
                    old_low,old_upper = ([138,360],[103,308]) if side=='left' else ([384,360],[422,308])
                    hidden = read(ROOT/'Sources'/(side+'-lever-hidden-surface.png'))
                    hidden = project(hidden,old_low,old_upper,JOINTS[key][low],JOINTS[key][upper])
                    cover = np.maximum(disk(JOINTS[key][low],15),disk(JOINTS[key][upper],17.5))[:,:,None]
                    underpaint = hidden*cover
                    rgba(underpaint).save(PARTS/(str(key)+'-'+part+'-underpaint.png'))
                rgba(wood).save(PARTS/(str(key)+'-'+part+'.png'))
                rgba(bindings).save(PARTS/(str(key)+'-'+part+'-bindings.png'))
                inventory.append({'key':key,'part':part,'wood':str(key)+'-'+part+'.png','bindings':str(key)+'-'+part+'-bindings.png'})
            else:
                rgba(image).save(PARTS/(str(key)+'-'+part+'.png'))
                inventory.append({'key':key,'part':part,'file':str(key)+'-'+part+'.png'})
        reconstructed = organic.copy()
        for index in ids.values():
            reconstructed += original*(owner==index)[:,:,None]
        error = float(np.max(np.abs(reconstructed-original)))
        if error>1e-6:
            raise RuntimeError(str(key)+' reconstruction '+str(error))
        Image.fromarray(owner).save(TEMP/(str(key)+'-ownership.png'))
    shutil.copyfile(PROJECT/'AnimationCandidates/SproutNestGrowth02To03V2/Sources/hidden-wood-generated.png',ROOT/'Sources/hidden-wood-generated.png')
    write(ROOT/'parts.json',inventory)
    rig_setup()
    print('Separated approved artwork; exact reconstruction verified for all seven keys.')


def rig_setup():
    parents={'left-brace':'left-upper-joint','right-brace':'right-upper-joint','left-upper-brass':'left-upper-joint','left-lower-brass':'left-root-joint','right-upper-brass':'right-upper-joint','right-lower-brass':'right-root-joint','winch':'left-brace','collar-left':'left-root-joint','collar-right':'right-root-joint','collar-center':'collar-root'}
    lengths={}
    for side,root,hinge,tip in [('left',0,1,4),('right',2,3,5)]:
        lengths[side+'-lever']=max(float(np.linalg.norm(np.array(p[hinge])-p[root])) for p in JOINTS.values())
        lengths[side+'-brace']=max(float(np.linalg.norm(np.array(p[tip])-p[hinge])) for p in JOINTS.values())
    write(ROOT/'rig-setup.json',{'format':'local-cel-and-projected-hardware-rig','canvas':[512,512],'root':[256,445],'parents':parents,'bindPoses':JOINTS,'physicalLinkLengths':lengths,'petalLandmarks':PETALS,'basalLandmarks':BASE,'exteriorLandmarks':BOUNDARY,'organicInterpolation':'spatial-thin-plate-spline-of-selected-drawn-cel','poseSelection':'single-source-cel-no-time-alpha-mixing','brassPlateMotion':'translation-at-shared-joint-center','winchMotion':'rigid-rotation-and-translation','woodMotion':'orthographic-link-plane-projection','occlusionOrder':['back-braces-and-winch','hidden-organic-surfaces','flower','front-links-and-collar','basal-leaf-occluder'],'layerFiles':sorted(p.name for p in PARTS.glob('*.png')),'sourceKeyApproval':'2026-10-31 user approved V3 keyframes and continuation'})


class Renderer:
    def __init__(self):
        self.keys = [read(ROOT/'KeyPoses'/(name+'.png')) for name in NAMES]
        self.parts = {p.stem:read(p) for p in PARTS.glob('*.png')}
        self.joints = {k:np.array(v,np.float64) for k,v in JOINTS.items()}
        self.joints[2] = self.joints[3]+np.array([[90,140],[90,140],[-90,140],[-90,140],[30,140],[-30,140]])
        self.records = []
        self.winch_mounts={}
        for key in range(3,7):
            drum=self.part(key,'winch')+self.part(key,'winch-bindings')
            brace=self.part(key,'left-brace')+self.part(key,'left-brace-bindings')
            contact=(cv2.dilate(np.uint8(drum[:,:,3]>.2),np.ones((7,7),np.uint8))>0)&(brace[:,:,3]>.2)
            points=np.argwhere(contact)
            self.winch_mounts[key]=np.mean(points[:,::-1],0) if len(points) else self.joints[key][1]+.2*(self.joints[key][4]-self.joints[key][1])

    def part(self,key,name):
        return self.parts.get(str(key)+'-'+name,np.zeros((512,512,4),np.float32))

    def hardware(self,attachment,joints):
        bind = self.joints[attachment]
        back = np.zeros((512,512,4),np.float32)
        front = np.zeros_like(back)
        for side,low,upper,tip in [('left',0,1,4),('right',2,3,5)]:
            for suffix in ['', '-bindings']:
                brace = project(self.part(attachment,side+'-brace'+suffix),bind[upper],bind[tip],joints[upper],joints[tip])
                back = over(brace,back)
                lever = project(self.part(attachment,side+'-lever'+suffix),bind[low],bind[upper],joints[low],joints[upper])
                front = over(lever,front)
            underpaint = project(self.part(attachment,side+'-lever-underpaint'),bind[low],bind[upper],joints[low],joints[upper])
            front = over(front,underpaint)
            for suffix,index in [('upper-brass',upper),('lower-brass',low)]:
                plate = move(self.part(attachment,side+'-'+suffix),joints[index]-bind[index])
                front = over(plate,front)
        for suffix in ['', '-bindings']:
            old_vector,new_vector = bind[4]-bind[1],joints[4]-joints[1]
            angle = math.atan2(new_vector[1],new_vector[0])-math.atan2(old_vector[1],old_vector[0])
            anchor=self.winch_mounts[attachment]
            target=project_point(anchor,bind[1],bind[4],joints[1],joints[4])
            winch = rigid(self.part(attachment,'winch'+suffix),anchor,target,angle)
            back = over(winch,back)
            for part in ['collar-left','collar-center','collar-right']:
                if part=='collar-center':
                    offset = (joints[0]+joints[2]-bind[0]-bind[2])/2
                    collar = move(self.part(attachment,part+suffix),offset)
                else:
                    index = 0 if part=='collar-left' else 2
                    center_bind = (bind[0]+bind[2])/2+[0,10]
                    center_now = (joints[0]+joints[2])/2+[0,10]
                    collar = project(self.part(attachment,part+suffix),bind[index],center_bind,joints[index],center_now)
                front = over(collar,front)
        back[Y>390] = 0
        front[Y>400] = 0
        return back,front

    def between(self,a,b,q):
        if q<=0:
            return self.keys[a].copy()
        if q>=1:
            return self.keys[b].copy()
        source = a if q<.5 else b
        destination = controls(a)*(1-q)+controls(b)*q
        mapping = organic_map(controls(source),destination)
        organic = warp(self.part(source,'organic'),mapping)
        if b<3:
            return organic
        joints = self.joints[a]*(1-q)+self.joints[b]*q
        attachment = max(3,source)
        back,front = self.hardware(attachment,joints)
        hidden = warp(self.part(source,'organic-hidden'),mapping)
        threshold = np.interp(X,[0,110,145,200,256,312,367,402,511],[300,300,360,380,393,380,360,300,300])
        mask = (Y>=threshold).astype(np.float32)[:,:,None]
        basal = organic*mask
        flower = organic*(1-mask)
        result = over(hidden,back)
        if a==2:
            result = over(flower,over(front,result))
        else:
            result = over(flower,result)
            result = over(front,result)
        result = over(basal,result)
        count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(result[:,:,3]>.12),8)
        keep=np.zeros((512,512),np.uint8)
        for component in range(1,count):
            if stats[component,4]>=28:
                keep[labels==component]=1
        keep=cv2.dilate(keep,np.ones((3,3),np.uint8))
        result*=keep[:,:,None]
        self.records.append({'from':a,'to':b,'q':q,'attachment':attachment,'jointCenters':joints.tolist()})
        return result


def ease(q):
    return q*q*(3-2*q)


def state(frame):
    intervals = [(0,6,'start-hold',0,0),(6,14,'clump',0,1),(14,22,'clump',1,2),(22,38,'small-hold',2,2),(38,44,'growth-1',2,3),(44,60,'middle-hold',3,3),(60,66,'growth-2',3,4),(66,82,'large-hold',4,4),(82,92,'open',4,5),(92,104,'open',5,6),(104,124,'final-hold',6,6)]
    for start,end,phase,a,b in intervals:
        if start<=frame<end:
            q = 0 if a==b else ease((frame-start)/(end-start))
            return phase,a,b,q
    return 'final-hold',6,6,0


def animated(images,path,loops):
    images[0].encoderinfo = {'append_images':images[1:],'duration':[50]*len(images),'loop':loops,'lossless':True,'method':4}
    with path.open('wb') as out:
        WebPImagePlugin._save_all(images[0],out,str(path))


def export(representative):
    renderer = Renderer()
    indexes = list(range(22,83)) if representative else list(range(124))
    frames = []
    records = []
    for number in indexes:
        phase,a,b,q = state(number)
        im = rgba(renderer.between(a,b,q))
        frames.append(im)
        records.append({'frame':number,'timeMs':number*50,'phase':phase,'from':a,'to':b,'progress':q})
        if not representative:
            (ROOT/'Frames').mkdir(511,True,True)
            im.save(ROOT/'Frames'/(str(number).zfill(3)+'.png'))
    previews = []
    for frame in frames:
        background = Image.new('RGB',(512,512),'#25332e')
        background.paste(frame,(0,0),frame.getchannel('A'))
        previews.append(background.resize((384,384),Image.Resampling.LANCZOS))
    animated(previews,TEMP/'representative.webp' if representative else ROOT/'preview.webp',0)
    choices = list(range(0,len(frames),3)) if representative else list(range(0,len(frames),4))
    contact = Image.new('RGB',(1536,math.ceil(len(choices)/6)*280),'#25332e')
    draw = ImageDraw.Draw(contact)
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
    for slot,i in enumerate(choices):
        x,y = slot%6*256,slot//6*280
        draw.text((x+5,y+4),str(round(indexes[i]*.05,2))+'s '+records[i]['phase'],'white',font)
        contact.paste(previews[i].resize((256,256),Image.Resampling.LANCZOS),(x,y+24))
    contact.save(TEMP/'representative-contact.png' if representative else ROOT/'playback-contact.png')
    if representative:
        write(TEMP/'representative-rig.json',renderer.records)
        print('Representative sequence ready.')
        return
    sheet = Image.new('RGBA',(6144,5632),(0,0,0,0))
    for i,frame in enumerate(frames):
        sheet.paste(frame,(i%12*512,i//12*512))
    sheet.save(ROOT/'growth-sheet.png')
    animated(frames,ROOT/'growth.webp',1)
    write(ROOT/'timeline.json',records)
    write(ROOT/'hardware-rig.json',{'canvas':[512,512],'bindPoses':JOINTS,'frames':renderer.records,'metalPlateTransform':'translation','woodTransform':'projected-link-basis','temporalPoseBlend':False})
    write(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':124,'columns':12,'rows':11,'frameMs':50,'periodMs':6200,'loop':False,'image':'growth-sheet.png','animatedImage':'growth.webp','sourceFrames':'Frames','sourceParts':'Parts','sourceKeys':'KeyPoses','temporalPoseBlend':False,'neuralInterpolation':False,'holdIntervalsFrames':[[22,38],[44,60],[66,82]],'method':'approved-drawn-key-cels-soft-petal-deformation-and-joint-linked-hardware'})
    print('Full sequence ready.')


if __name__=='__main__':
    if sys.argv[1]=='prepare':
        prepare()
    elif sys.argv[1]=='representative':
        export(True)
    elif sys.argv[1]=='export':
        export(False)
