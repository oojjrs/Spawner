from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np
import json
import math
import sys

folder = Path(__file__).resolve().parent
repo = folder.parents[5]
work = repo / '$Trash/sprout-lifespan-implementation-20261030'
work.mkdir(511,True,True)
canvas = 768
padding = 128
frame_size = 192

def components(mask):
    active = mask.copy()
    height,width = active.shape
    result = []
    for y,x in zip(*np.where(active)):
        if not active[y,x]: continue
        active[y,x] = False
        points = [(int(x),int(y))]
        for px,py in points:
            for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                if 0<=nx<width and 0<=ny<height and active[ny,nx]:
                    active[ny,nx] = False
                    points.append((nx,ny))
        a = np.array(points)
        result.append({'points':points,'box':[int(a[:,0].min()),int(a[:,1].min()),int(a[:,0].max()+1),int(a[:,1].max()+1)],'area':len(points),'center':a.mean(0).tolist()})
    return [entry[2] for entry in sorted([(-item['area'],index,item) for index,item in enumerate(result)])]

def part(image,component):
    mask = Image.new('L',image.size,0)
    pixels = mask.load()
    for x,y in component['points']: pixels[x,y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(3))
    output = image.copy()
    output.putalpha(ImageChops.multiply(image.getchannel('A'),mask))
    return output,mask

def pale(image):
    p = np.asarray(image)
    return (p[:,:,3]>100)&(p[:,:,0]>130)&(p[:,:,2]>p[:,:,0]*.78)&(p[:,:,1].astype(float)-p[:,:,0]<35)

def eye_components(image,body_box,turn):
    p = np.asarray(image)
    x0,y0,x1,y1 = body_box
    yy,xx = np.mgrid[:image.height,:image.width]
    silhouette=components(pale(image))[0]
    interior=np.zeros((image.height,image.width),bool)
    rows={}
    for px,py in silhouette['points']: rows.setdefault(py,[]).append(px)
    for py,values in rows.items():
        if max(values)-min(values)>4: interior[py,min(values)+1:max(values)]=True
    mask = (p[:,:,3]>100)&(p[:,:,0]<110)&(p[:,:,1]<140)&(p[:,:,2]<125)&(p[:,:,2].astype(float)>p[:,:,0]*1.05)&interior&(xx>x0+1)&(xx<x1-1)&(yy>y0+(y1-y0)*.25)&(yy<y1-1)
    found = [item for item in components(mask) if item['box'][2]-item['box'][0]<(x1-x0)*.4 and item['box'][3]-item['box'][1]<(y1-y0)*.45]
    selected=[]
    expected=[.27+.40*turn,.74+.16*turn]
    for fraction in expected:
        candidates=[item for item in found if item not in selected]
        if not candidates: continue
        match=min([(abs((item['center'][0]-x0)/(x1-x0)-fraction)+abs((item['center'][1]-y0)/(y1-y0)-.6)*.55,index,item) for index,item in enumerate(candidates)])[2]
        cost=abs((match['center'][0]-x0)/(x1-x0)-fraction)+abs((match['center'][1]-y0)/(y1-y0)-.6)*.55
        if cost<.28: selected.append(match)
    return [entry[2] for entry in sorted([(item['center'][0],index,item) for index,item in enumerate(selected)])]

def alpha_crop(image):
    alpha = np.asarray(image.getchannel('A'))
    found = components(alpha>64)[0]
    x0,y0,x1,y1 = found['box']
    return image.crop((max(0,x0-2),max(0,y0-2),min(image.width,x1+2),min(image.height,y1+2)))

def affine(image,matrix):
    inverse = np.linalg.inv(matrix)
    return image.transform((canvas,canvas),Image.Transform.AFFINE,tuple(inverse[:2].reshape(6)),Image.Resampling.BICUBIC)

def translation(x,y):
    return np.array([[1,0,x+padding],[0,1,y+padding],[0,0,1]],float)

approved = Image.open(folder/'Source/body-approved.png').convert('RGBA').crop((64,64,576,576))
torso_generated = alpha_crop(Image.open(folder/'Source/torso-generated.png').convert('RGBA'))
hidden = Image.new('RGBA',(512,512),(0,0,0,0))
hidden.alpha_composite(torso_generated.resize((240,302),Image.Resampling.LANCZOS),(136,136))
body_component = components(pale(approved))[0]
yy,xx = np.mgrid[:512,:512]
feet_components = []
for center_x in [194,314]:
    mask = ((xx-center_x)/21)**2+((yy-442)/16)**2<=1
    mask &= np.asarray(approved)[:,:,3]>16
    feet_components.append(components(mask)[0])
eyes_components = eye_components(approved,[136,136,376,438],0)
feet_parts = [part(approved,item)[0] for item in feet_components]
eyes_parts = [part(approved,item)[0] for item in eyes_components]
feet_mask = Image.new('L',(512,512),0)
for item in feet_components: feet_mask = ImageChops.lighter(feet_mask,part(approved,item)[1])
skin = approved.copy()
skin.putalpha(ImageChops.multiply(approved.getchannel('A'),ImageChops.invert(feet_mask)))
hole_fill = hidden.copy()
hole_fill.putalpha(ImageChops.multiply(hidden.getchannel('A'),feet_mask))
skin = Image.alpha_composite(hole_fill,skin)
eye_mask = Image.new('L',(512,512),0)
for item in eyes_components:
    x0,y0,x1,y1 = item['box']
    ImageDraw.Draw(eye_mask).ellipse((x0-6,y0-6,x1+6,y1+6),255)
eye_mask = eye_mask.filter(ImageFilter.GaussianBlur(3))
skin = Image.composite(hidden,skin,eye_mask)
skin.save(folder/'Parts/torso.png')
for index,image in enumerate(feet_parts): image.save(folder/'Parts'/('foot-'+str(index)+'.png'))
for index,image in enumerate(eyes_parts): image.save(folder/'Parts'/('eye-'+str(index)+'.png'))
approved.save(folder/'Parts/body-open.png')
for name,amount in [('half',.45),('closed',.1)]:
    image = skin.copy()
    for foot in feet_parts: image.alpha_composite(foot)
    for eye,item in zip(eyes_parts,eyes_components):
        center = item['center']
        matrix = np.array([[1,0,padding],[0,amount,center[1]*(1-amount)+padding],[0,0,1]],float)
        eye_frame = affine(eye,matrix).crop((padding,padding,padding+512,padding+512))
        image.alpha_composite(eye_frame)
    image.save(folder/'Parts'/('body-'+name+'.png'))
if len(eyes_components)!=2 or len(feet_components)!=2: raise RuntimeError('Two eyes and feet required')
if len(sys.argv)>1 and sys.argv[1]=='parts': raise SystemExit(0)

actions = {
    'attack': ['DesignAssets/Animations/UnitAttack/attack.png',[60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60]],
    'hurt': ['DesignAssets/Animations/UnitHurt/V3/hurt.png',[20,30,30,30,400,30,30,30,20,20,20,20,20,20,20,20]],
    'death': ['DesignAssets/Planning/Tribes/sprout/AnimationStudies/death-v1/death.png',[160,80,80,70,70,60,60,60,60,60,80,90,100,110,120,1000]]
}
data = {'frameSize':frame_size,'columns':4,'scale':1.5,'pivotX':96,'pivotY':152.25,'headLift':103,'body':[136,136,240,324],'torso':[136,136,240,302],'sourceParts':{'body':'Parts/body-open.png','skin':'Parts/torso.png','feet':['Parts/foot-0.png','Parts/foot-1.png'],'eyes':['Parts/eye-0.png','Parts/eye-1.png']},'actions':{}}
contact = Image.new('RGB',(256*8,256*3),'#243229')
death_heads=Image.open(folder/'Source/death-head-generated.png').convert('RGBA')
for row,(action,(path,durations)) in enumerate(actions.items()):
    sheet = Image.open(repo/path).convert('RGBA')
    source_size = sheet.width//4
    source_frames = [sheet.crop((i%4*source_size,i//4*source_size,(i%4+1)*source_size,(i//4+1)*source_size)) for i in range(16)]
    if action=='death':
        source_frames=[image.resize((256,256),Image.Resampling.LANCZOS) for image in source_frames]
        source_size=256
    poses = []
    for index,source in enumerate(source_frames):
        groups = components(pale(source))
        main = groups[0]
        x0,y0,x1,y1 = main['box']
        feet = [entry[2] for entry in sorted([(item['center'][0],number,item) for number,item in enumerate([item for item in groups[1:] if item['center'][1]>y0+(y1-y0)*.6 and item['area']>1][:2])])]
        turn=[0,.35,.65,.9,1,1,1,1,1,1,1,.9,.65,.35,.1,0][index] if action=='attack' else 0
        eyes = eye_components(source,main['box'],turn)
        p = np.asarray(source)
        yy,xx = np.mgrid[:source_size,:source_size]
        if action=='death':
            hs=death_heads.width//4
            head_image=death_heads.crop((index%4*hs,index//4*hs,(index%4+1)*hs,(index//4+1)*hs)).resize((source_size,source_size),Image.Resampling.LANCZOS)
            hp=np.array(head_image)
            neon=(hp[:,:,1]>150)&(hp[:,:,1].astype(float)>hp[:,:,0]*1.8)&(hp[:,:,1].astype(float)>hp[:,:,2]*1.8)
            hp[neon,3]=0
            head_image=Image.fromarray(hp)
            largest=components(hp[:,:,3]>64)[0]
            allowed=np.zeros((source_size,source_size),np.uint8)
            for px,py in largest['points']: allowed[py,px]=255
            head_mask=Image.fromarray(allowed).filter(ImageFilter.MaxFilter(3))
        else:
            head_alpha=np.array(source.getchannel('A'))
            rows={}
            for px,py in main['points']:
                rows.setdefault(py,[]).append(px)
            limit=round(y0+(y1-y0)*.70)
            for py in range(source_size):
                if py>=limit:
                    head_alpha[py,:]=0
                    continue
                values=[]
                for ry in range(max(0,py-2),min(source_size,py+3)):
                    values.extend(rows.get(ry,[]))
                if values:
                    head_alpha[py,max(0,min(values)-3):min(source_size,max(values)+4)]=0
            selected=components(head_alpha>16)[0]
            selected_mask=np.zeros(head_alpha.shape,np.uint8)
            for px,py in selected['points']: selected_mask[py,px]=255
            head_mask=Image.fromarray(selected_mask).filter(ImageFilter.MaxFilter(3))
        if action!='death': head_image=source.copy()
        head_image.putalpha(ImageChops.multiply(head_image.getchannel('A'),head_mask))
        head_box=head_image.getbbox()
        if head_box is None: raise RuntimeError((action,index,'head mask empty'))
        hx0,hy0,hx1,hy1=head_box
        head_group={'box':[hx0,hy0,hx1,hy1],'center':[(hx0+hx1)/2,(hy0+hy1)/2]}
        fall=max(0,min(1,(index-4)/7)) if action=='death' else 0
        fall=fall*fall*(3-2*fall)
        root=[(hx0+hx1)/2,hy1*(1-fall)+(hy0+(hy1-hy0)*.18)*fall]
        angle=math.pi*fall if action=='death' else max(-.9,min(.9,math.atan2(head_group['center'][0]-(x0+x1)/2,y0-head_group['center'][1])))
        upper = [point[0] for point in main['points'] if point[1]<y0+(y1-y0)*.2]
        lower = [point[0] for point in main['points'] if point[1]>y0+(y1-y0)*.8]
        shear = (float(np.mean(upper))-float(np.mean(lower)))/max(1,y1-y0)
        poses.append({'body':main,'feet':feet,'eyes':eyes,'headImage':head_image,'head':head_group,'root':root,'angle':angle,'shear':shear})
    ref = poses[0]
    rx0,ry0,rx1,ry1 = ref['body']['box']
    unit = 240/(rx1-rx0)
    head_unit = 240/(ref['head']['box'][2]-ref['head']['box'][0])
    tracks = []
    body_atlas = Image.new('RGBA',(frame_size*4,frame_size*4),(0,0,0,0))
    head_atlas = Image.new('RGBA',(frame_size*4,frame_size*4),(0,0,0,0))
    for index,(source,pose) in enumerate(zip(source_frames,poses)):
        x0,y0,x1,y1 = pose['body']['box']
        sx,sy = (x1-x0)/(rx1-rx0),(y1-y0)/(ry1-ry0)
        center = 256+((x0+x1-rx0-rx1)/2)*unit
        bottom = 438+(y1-ry1)*unit
        if action=='death':
            amount=math.sin(index/15*math.pi/2)**2
            sx,sy=1+.025*amount,1-.06*amount
            center=256+max(-12,min(12,((x0+x1-rx0-rx1)/2)*unit))
            bottom=438
        shear = .035*index/15 if action=='death' else max(-.4,min(.4,pose['shear']-ref['shear']))*.55
        matrix = np.array([[sx,-shear,center-sx*256+shear*438+padding],[0,sy,bottom-sy*438+padding],[0,0,1]],float)
        image = affine(skin,matrix)
        for side,(foot,part_data) in enumerate(zip(feet_parts,feet_components)):
            source_foot = pose['feet'][side] if len(pose['feet'])==2 and action!='death' else None
            reference_foot = ref['feet'][side] if len(ref['feet'])==2 else None
            if source_foot and reference_foot:
                target = [part_data['center'][0]+(source_foot['center'][0]-reference_foot['center'][0])*unit,part_data['center'][1]+(source_foot['center'][1]-reference_foot['center'][1])*unit]
            else: target = [center+(part_data['center'][0]-256)*sx,bottom+(part_data['center'][1]-438)]
            offset = [target[0]-part_data['center'][0],target[1]-part_data['center'][1]]
            image.alpha_composite(affine(foot,translation(*offset)))
        for side,(eye,part_data) in enumerate(zip(eyes_parts,eyes_components)):
            if action=='attack' and len(pose['eyes'])==1 and side==0: continue
            source_eye = pose['eyes'][side] if len(pose['eyes'])==2 and not (action=='death' and index>=3) else pose['eyes'][0] if action=='attack' and len(pose['eyes'])==1 and side==1 else None
            reference_eye = ref['eyes'][side] if len(ref['eyes'])==2 else None
            original_point = np.array([*part_data['center'],1])
            target = (matrix@original_point)[:2]
            if source_eye and reference_eye:
                target[0] += (source_eye['center'][0]-reference_eye['center'][0] - (x0+x1-rx0-rx1)/2)*unit*.55
                source_height = source_eye['box'][3]-source_eye['box'][1]
                source_width = source_eye['box'][2]-source_eye['box'][0]
                if index not in [0,15] or action=='death' and index>2:
                    eye_cut,unused = part(source,source_eye)
                    bx0,by0,bx1,by1 = source_eye['box']
                    crop = eye_cut.crop((max(0,bx0-1),max(0,by0-1),min(source_size,bx1+1),min(source_size,by1+1)))
                    width = max(8,round(crop.width*unit))
                    height = max(3,round(crop.height*unit))
                    crop = crop.resize((width,height),Image.Resampling.LANCZOS)
                    image.alpha_composite(crop,(round(target[0]-width/2),round(target[1]-height/2)))
                    continue
            closed=.1 if action=='death' and index>=3 or len(pose['eyes'])!=2 and 1<=index<=12 else 1
            matrix_eye = np.array([[1,0,target[0]-part_data['center'][0]],[0,closed,target[1]-closed*part_data['center'][1]],[0,0,1]],float)
            image.alpha_composite(affine(eye,matrix_eye))
        root_x = center+(pose['root'][0]-(x0+x1)/2)*unit*.45
        fall=max(0,min(1,(index-4)/7)) if action=='death' else 0
        fall=fall*fall*(3-2*fall)
        root_y = bottom-302*sy+17+(302*sy*.49-17)*fall
        head = pose['headImage']
        hrx,hry = pose['root']
        head_transform = np.array([[head_unit,0,root_x-hrx*head_unit+padding],[0,head_unit,root_y-hry*head_unit+padding],[0,0,1]],float)
        head_frame = affine(head,head_transform)
        front = action=='death' and index>=4
        track = {'body':[center-120*sx,bottom-302*sy,240*sx,302*sy],'bottom':bottom+22,'head':[root_x,root_y,pose['angle']],'headFront':front,'sourceBody':pose['body']['box'],'sourceEyes':[item['box'] for item in pose['eyes']],'sourceFeet':[item['box'] for item in pose['feet']]}
        tracks.append(track)
        body_frame = image.resize((frame_size,frame_size),Image.Resampling.LANCZOS)
        head_frame = head_frame.resize((frame_size,frame_size),Image.Resampling.LANCZOS)
        body_atlas.paste(body_frame,(index%4*frame_size,index//4*frame_size))
        head_atlas.paste(head_frame,(index%4*frame_size,index//4*frame_size))
        preview = Image.alpha_composite(body_frame,head_frame) if front else Image.alpha_composite(head_frame,body_frame)
        if index in [0,2,4,6,8,10,12,15]:
            column = [0,2,4,6,8,10,12,15].index(index)
            preview = preview.resize((256,256),Image.Resampling.LANCZOS)
            contact.paste(preview,(column*256,row*256),preview)
    body_atlas.save(folder/(action+'-body.png'))
    head_atlas.save(folder/(action+'-head.png'))
    data['actions'][action] = {'body':action+'-body.png','head':action+'-head.png','durationsMs':durations,'tracks':tracks}
(folder/'rig.json').write_bytes((json.dumps(data)+'\n').replace('\n','\r\n').encode('utf-8'))
contact.save(work/'lifespan-actions.png')
print(f'{folder.name}> RENDER COMPLETE.')
sys.stdout.flush()
