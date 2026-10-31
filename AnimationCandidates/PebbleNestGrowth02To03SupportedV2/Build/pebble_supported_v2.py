from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin, GifImagePlugin, ImageFilter
import numpy as np
import math,json,sys

ROOT=next(p for p in Path(__file__).resolve().parents if (p/'client/nest-growth.mjs').exists())
OUT=ROOT/'AnimationCandidates/PebbleNestGrowth02To03SupportedV2'
TEMP=ROOT/'$Trash/PebbleNestGrowth02To03-20261031-01a18fdb/SupportedV2'
for path in [OUT,TEMP,OUT/'Sources',OUT/'Parts',OUT/'Frames',OUT/'Build']:
    path.mkdir(511,True,True)
Y,X=np.mgrid[0:512,0:512]
FONT=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)

def read(path):
    return Image.open(path).convert('RGBA')

def write(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))

def polygon(points):
    im=Image.new('L',(512,512))
    ImageDraw.Draw(im).polygon(points,255)
    return np.array(im)>0

def ellipse(box):
    im=Image.new('L',(512,512))
    ImageDraw.Draw(im).ellipse(box,255)
    return np.array(im)>0

def cut(im,mask):
    a=np.array(im).copy()
    a[:,:,3]*=np.uint8(mask)
    a[a[:,:,3]==0]=0
    return Image.fromarray(a)

def over(front,back):
    return Image.alpha_composite(back,front)

def move(im,dx,dy):
    out=Image.new('RGBA',(512,512))
    out.alpha_composite(im,(round(dx),round(dy)))
    return out

def rigid(im,pivot,target,angle):
    co,si=math.cos(math.radians(angle)),math.sin(math.radians(angle))
    rotation=np.array([[co,-si],[si,co]])
    translation=np.array(target)-rotation@np.array(pivot)
    inverse=rotation.T
    offset=-inverse@translation
    coeff=(inverse[0,0],inverse[0,1],offset[0],inverse[1,0],inverse[1,1],offset[1])
    return im.convert('RGBa').transform((512,512),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC).convert('RGBA')

def part(name,im):
    im.save(OUT/'Parts'/(name+'.png'))
    return im

def clamp(x):
    return max(0.,min(1.,x))

def out3(x):
    return 1-(1-clamp(x))**3

def masks(stage):
    if stage<2:
        roof=[(0,306),(83,304),(102,310),(135,318),(174,331),(236,339),(287,344),(320,345),(341,340),(380,328),(420,318),(445,315),(512,315)]
        left=[(0,120),(300,120),(313,159),(335,181),(355,189),(371,183),(380,174),(512,174)]
        right=[(0,400),(310,392),(326,350),(348,333),(370,334),(384,347),(512,347)]
        ls=[(0,368),(75,367),(113,368),(155,374),(183,376),(230,376),(512,376)]
        rs=[(0,382),(335,382),(371,383),(416,379),(456,380),(512,380)]
    else:
        roof=[(0,280),(75,284),(115,290),(153,297),(179,304),(230,310),(305,320),(334,321),(356,315),(393,303),(433,300),(462,298),(512,298)]
        left=[(0,119),(284,119),(296,156),(315,176),(341,185),(361,176),(372,166),(512,166)]
        right=[(0,405),(298,400),(314,355),(337,331),(356,334),(374,349),(512,349)]
        ls=[(0,366),(66,365),(111,367),(151,373),(180,374),(230,374),(512,374)]
        rs=[(0,374),(334,374),(370,374),(414,373),(471,372),(512,372)]
    roof_y=np.interp(X,[p[0] for p in roof],[p[1] for p in roof])
    left_x=np.interp(Y,[p[0] for p in left],[p[1] for p in left])
    right_x=np.interp(Y,[p[0] for p in right],[p[1] for p in right])
    left_y=np.interp(X,[p[0] for p in ls],[p[1] for p in ls])
    right_y=np.interp(X,[p[0] for p in rs],[p[1] for p in rs])
    blx=np.interp(Y,[0,367,390,416,438,448,512],[190,182,187,196,195,174,174])
    brx=np.interp(Y,[0,370,390,418,440,448,512],[335,343,330,317,315,333,333])
    upper=(Y<=roof_y)|((X<=left_x)&(Y<left_y))|((X>=right_x)&(Y<right_y))
    bl=(Y>=left_y)&(X<=blx)&~upper
    br=(Y>=right_y)&(X>=brx)&~upper&~bl
    return {'upper':upper,'base-left':bl,'base-right':br,'back':~(upper|bl|br),'roofEdge':roof_y}

KEYS=[read(OUT/'Sources'/('K'+str(i)+'.png')) for i in range(4)]
M=[masks(i) for i in range(3)]
PARTS=[]
for i in range(3):
    PARTS.append({name:part('K'+str(i)+'-'+name,cut(KEYS[i],M[i][name])) for name in ['upper','base-left','base-right','back']})

atlas=read(OUT/'Sources/hardware-generated.png')
aa=np.array(atlas)
aa[:,:,3][aa[:,:,3]>235]=255
aa[:,:,3][aa[:,:,3]<20]=0
atlas=Image.fromarray(aa)
core=Image.fromarray(np.uint8(aa[:,:,3]>140)*255).copy()
pieces=[]
while True:
    yy,xx=np.where(np.array(core)==255)
    if not len(yy):
        break
    seed=(int(xx[0]),int(yy[0]))
    ImageDraw.floodfill(core,seed,128)
    selected=np.array(core)==128
    if selected.sum()>500:
        near=np.array(Image.fromarray(np.uint8(selected)*255).filter(ImageFilter.MaxFilter(5)))>0
        a=aa.copy()
        a[:,:,3]*=np.uint8(near)
        a[a[:,:,3]==0]=0
        piece=Image.fromarray(a)
        box=piece.getbbox()
        pieces.append((box,piece.crop(box)))
    arr=np.array(core)
    arr[selected]=0
    core=Image.fromarray(arr).copy()
if len(pieces)!=5:
    raise RuntimeError(('Expected five complete hardware parts',[(b,p.size) for b,p in pieces]))
pieces=[entry for position,entry in sorted([(entry[0][1],entry) for entry in pieces])]
rows=[[entry for position,entry in sorted([(entry[0][0],entry) for entry in row])] for row in [pieces[:2],pieces[2:4],pieces[4:]]]
ART={'frame':rows[0][0][1],'wheel':rows[0][1][1],'gate':rows[1][0][1],'weight':rows[1][1][1],'rope':rows[2][0][1]}
for name,im in ART.items():
    im.save(OUT/'Sources'/('complete-'+name+'.png'))

def fitted(im,box):
    out=Image.new('RGBA',(512,512))
    piece=im.convert('RGBa').resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS).convert('RGBA')
    out.alpha_composite(piece,(box[0],box[1]))
    return out

native=KEYS[3]
frame_mask=polygon([(325,209),(345,209),(345,208),(397,208),(398,205),(405,202),(414,203),(420,206),(422,208),(445,209),(450,211),(454,217),(456,225),(453,234),(448,237),(447,261),(448,262),(451,269),(451,278),(446,282),(444,298),(438,306),(428,306),(424,303),(421,297),(421,283),(414,284),(408,282),(406,276),(405,267),(375,239),(359,234),(350,231),(325,232)])
hanger_mask=polygon([(304,222),(306,214),(315,205),(327,200),(333,199),(338,201),(334,206),(326,206),(319,210),(314,217),(313,224),(306,225)])
hanger_mask|=polygon([(337,201),(345,200),(352,204),(356,214),(357,234),(355,250),(349,253),(344,249),(343,235),(341,219),(338,212)])
wheel_shape=ellipse((305,218,359,269))
gate_mask=polygon([(173,282),(300,281),(312,283),(317,285),(329,288),(340,296),(345,305),(342,315),(335,321),(319,326),(174,327),(160,325),(151,321),(146,316),(144,307),(147,298),(154,291),(162,287)])
weight_mask=polygon([(444,280),(456,280),(460,285),(461,292),(455,296),(461,299),(460,305),(455,309),(471,312),(479,319),(482,332),(482,347),(477,357),(469,363),(453,366),(438,363),(431,358),(427,347),(426,332),(430,321),(438,315),(445,311),(445,306),(440,303),(440,297),(445,295),(439,292),(439,286)])
rope_right=polygon([(447,233),(455,233),(455,281),(458,285),(444,286),(444,278)])
rope_gate=polygon([(307,251),(317,255),(311,269),(307,279),(304,284),(295,284),(295,278),(301,263)])
mechanics=frame_mask|hanger_mask|wheel_shape|gate_mask|weight_mask|rope_right|rope_gate
mechanics=np.array(Image.fromarray(np.uint8(mechanics)*255).filter(ImageFilter.MaxFilter(13)))>0
hidden=read(OUT/'Sources/hidden-stone-registered.png')
clean=over(cut(native,~mechanics),cut(hidden,mechanics))
clean.save(OUT/'Sources/K3-stone-backing.png')
M3=masks(2)
P3={name:part('K3-'+name,cut(clean,M3[name])) for name in ['upper','base-left','base-right','back']}
frame_fill=cut(fitted(ART['frame'],(311,202,457,307)),wheel_shape|hanger_mask)
frame_mask&=~hanger_mask&~wheel_shape&~rope_right
frame=part('winch-frame-complete',over(cut(native,frame_mask),frame_fill))
hanger=part('pulley-hanger',cut(native,hanger_mask))
wheel_mesh=[]
source_x=[0,176.5,ART['wheel'].width]
source_y=[0,138,ART['wheel'].height]
target_x=[306,333,358]
target_y=[224,243,267]
for yi in range(2):
    for xi in range(2):
        box=(target_x[xi],target_y[yi],target_x[xi+1],target_y[yi+1])
        quad=(source_x[xi],source_y[yi],source_x[xi],source_y[yi+1],source_x[xi+1],source_y[yi+1],source_x[xi+1],source_y[yi])
        wheel_mesh.append((box,quad))
wheel_fill=ART['wheel'].convert('RGBa').transform((512,512),Image.Transform.MESH,wheel_mesh,Image.Resampling.BICUBIC).convert('RGBA')
wheel=part('pulley-wheel-complete',over(cut(native,ellipse((325,234,343,253))),wheel_fill))
gate=part('stone-gate',cut(native,gate_mask))
weight=part('counterweight',cut(native,weight_mask))
rope_tile=ART['rope'].convert('RGBa').resize((6,120),Image.Resampling.LANCZOS).convert('RGBA')
rope_tile.save(OUT/'Parts/rope-tile.png')
room_source=read(OUT/'Sources/complete-cave-source.png')
room_piece=room_source.crop(room_source.getbbox()).convert('RGBa').resize((250,222),Image.Resampling.LANCZOS).convert('RGBA')
ROOM=Image.new('RGBA',(512,512))
ROOM.alpha_composite(room_piece,(131,216))
ROOM=cut(ROOM,Y<430)
part('complete-cave-backing',ROOM)

def rope(start,end):
    dx,dy=end[0]-start[0],end[1]-start[1]
    length=math.hypot(dx,dy)
    if length<2 or dy<0:
        return Image.new('RGBA',(512,512))
    source=Image.new('RGBA',(512,512))
    for yy in range(0,min(400,math.ceil(length)),120):
        height=min(120,math.ceil(length)-yy)
        source.alpha_composite(rope_tile.crop((0,0,6,height)),(253,64+yy))
    return rigid(source,(256,64),start,-math.degrees(math.atan2(dx,dy)))

def ground(parts):
    im=parts['back'].copy()
    for name in ['base-left','base-right']:
        im=over(parts[name],im)
    return im

def foundation(t):
    u=out3((t-1320)/320)
    v=out3((t-1360)/320)
    im=cut(KEYS[0],~(M[0]['base-left']|M[0]['base-right']))
    im=over(cut(move(PARTS[1]['base-left'],0,6*(1-u)),Y<448),im)
    im=over(cut(move(PARTS[1]['base-right'],0,3*(1-v)),Y<448),im)
    im=over(PARTS[0]['upper'],im)
    return im

def supports(t):
    p=out3((t-2600)/360)
    dy=34*(1-p)
    im=ground(PARTS[2])
    im=over(move(PARTS[2]['upper'],0,dy),im)
    for name in ['base-left','base-right']:
        im=over(PARTS[2][name],im)
    return im

def wheel_turn(angle):
    co,si=math.cos(math.radians(angle)),math.sin(math.radians(angle))
    matrix=np.array([[co,-si*25/21.5],[si*21.5/25,co]])
    inverse=np.linalg.inv(matrix)
    pivot=np.array([333.,243.])
    offset=pivot-inverse@pivot
    coeff=(inverse[0,0],inverse[0,1],offset[0],inverse[1,0],inverse[1,1],offset[1])
    spun=wheel.convert('RGBa').transform((512,512),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC).convert('RGBA')
    im=over(cut(spun,ellipse((311,228,356,264))),wheel)
    return over(cut(native,ellipse((325,234,343,253))),im)

def technology(t):
    age=t-4040
    body_y=8*(1-out3(age/160))
    im=ground(P3)
    im=over(move(P3['upper'],0,body_y),im)
    for name in ['base-left','base-right']:
        im=over(P3[name],im)
    mount=out3(age/160)
    progress=out3((age-140)/340)
    spin=-100*(1-progress)
    wheel_pose=wheel_turn(spin)
    assembly=over(hanger,over(frame,wheel_pose))
    assembly=rigid(assembly,(435,300),(435,300+36*(1-mount)),-8*(1-mount))
    if age<120:
        assembly=cut(assembly,~((X>410)&(Y>307)&(np.array(P3['upper'].getchannel('A'))>100)))
    im=over(assembly,im)
    if age>=140:
        gate_y=145*(1-progress)
        weight_y=-145*(1-progress)
        im=over(cut(rope((165,284),(165,294+gate_y)),Y<435),im)
        im=over(cut(rope((313,259),(309,287+gate_y)),Y<435),im)
        im=over(rope((449,234),(449,284+weight_y)),im)
        im=over(cut(move(gate,0,gate_y),Y<435),im)
        im=over(cut(move(weight,0,weight_y),Y>=234),im)
        for name in ['base-left','base-right']:
            im=over(P3[name],im)
    return im

def render(t):
    if t<1320:
        return KEYS[0].copy()
    if t<1720:
        return foundation(t)
    if t<2600:
        return KEYS[1].copy()
    if t<3000:
        return supports(t)
    if t<4040:
        return KEYS[2].copy()
    if t<4520:
        return technology(t)
    return KEYS[3].copy()

def preview(im):
    bg=Image.new('RGB',(512,512),'#142029')
    bg.paste(im,(0,0),im)
    return bg

def board(images,labels,columns,cell,path):
    rows=math.ceil(len(images)/columns)
    out=Image.new('RGB',(columns*cell,rows*(cell+30)),'#142029')
    d=ImageDraw.Draw(out)
    for i,im in enumerate(images):
        x,y=i%columns*cell,i//columns*(cell+30)
        thumb=im.resize((cell,cell),Image.Resampling.LANCZOS)
        out.paste(thumb,(x,y+30),thumb)
        d.text((x+6,y+4),labels[i],(220,232,240),FONT)
    out.save(path)

def webp(images,path,durations):
    images[0].encoderinfo={'append_images':images[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(images[0],stream,str(path))

def gif(images,path,durations):
    thumbs=[preview(im).resize((384,384),Image.Resampling.LANCZOS) for im in images]
    atlas=Image.new('RGB',(384*12,384*10),'#142029')
    for i,im in enumerate(thumbs):
        atlas.paste(im,(i%12*384,i//12*384))
    palette=atlas.quantize(192,Image.Quantize.MEDIANCUT,0,None,Image.Dither.NONE)
    frames=[im.quantize(192,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in thumbs]
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':0,'disposal':2,'optimize':False}
    with path.open('wb') as stream:
        GifImagePlugin._save_all(frames[0],stream,str(path))

def representative():
    times=list(range(4000,4601,40))
    frames=[render(t) for t in times]
    board(frames,[str(t)+'ms' for t in times],4,384,TEMP/'technology-contact.png')
    webp([preview(im) for im in frames],OUT/'representative.webp',[500]+[40]*(len(frames)-2)+[900])
    gif(frames,OUT/'representative.gif',[500]+[40]*(len(frames)-2)+[900])
    board([frame,wheel,hanger,gate,weight,clean],["frame","wheel","hanger","gate","weight","stone backing"],3,384,TEMP/'parts.png')
    print('Representative technology interval ready')

def export():
    times=[0]+[600+(i-1)*40 for i in range(1,120)]
    durations=[600]+[40]*118+[1000]
    frames=[render(t) for t in times]
    sheet=Image.new('RGBA',(4096,7680))
    for i,im in enumerate(frames):
        im.save(OUT/'Frames'/('%03d.png'%i))
        sheet.paste(im,(i%8*512,i//8*512))
    sheet.save(OUT/'growth.png')
    KEYS[0].save(OUT/'start.png')
    KEYS[3].save(OUT/'level-03.png')
    webp(frames,OUT/'growth.webp',durations)
    webp([preview(im) for im in frames],OUT/'preview.webp',durations)
    gif(frames,OUT/'preview.gif',durations)
    samples=list(range(1280,1761,40))+list(range(2560,3041,40))+list(range(4000,4561,40))
    board([render(t) for t in samples],[str(t)+'ms' for t in samples],8,256,OUT/'transitions.png')
    write(OUT/'animation.json',{'frameSize':[512,512],'frameCount':120,'columns':8,'rows':15,'frameMs':40,'durationsMs':durations,'durationMs':6320,'root':[256,448],'loop':False,'previewRepeats':True,'keyPoseFrames':{'K0':0,'K1':29,'K2':61,'K3':99},'approvedKeys':'Sources/approved-keyposes.json','poseOpacityBlend':False,'entranceOpenThroughout':True,'markersMs':{'foundationStart':1320,'foundationLanded':1720,'supportsStart':2600,'supportsLanded':3000,'technologyStart':4040,'technologyLanded':4520}})
    write(OUT/'rig.json',{'format':'local-layered-rigid-sprite-rig','root':[256,448],'renderer':'Build/pebble_supported_v2.py','rootMotion':False,'scale':[1,1],'bones':[{'id':'root','parent':None,'pivot':[256,448]},{'id':'foundation-left','parent':'root','pivot':[116,438]},{'id':'foundation-right','parent':'root','pivot':[389,438]},{'id':'supported-upper-assembly','parent':'root','pivot':[256,340]},{'id':'winch-frame','parent':'root','pivot':[435,300]},{'id':'wheel','parent':'winch-frame','pivot':[333,243]},{'id':'gate','parent':'root','pivot':[246,305]},{'id':'counterweight','parent':'root','pivot':[451,330]}],'attachments':{'winch-frame':'Parts/winch-frame-complete.png','wheel':'Parts/pulley-wheel-complete.png','hanger':'Parts/pulley-hanger.png','gate':'Parts/stone-gate.png','counterweight':'Parts/counterweight.png','rope':'Parts/rope-tile.png'},'poseOpacityBlend':False,'sourceKeyApproval':'current four key poses approved; unchanged','timelines':{'foundation':{'startMs':1320,'endMs':1720,'leftY':[6,0],'rightY':[3,0]},'supports':{'startMs':2600,'endMs':3000,'upperY':[34,0],'constraint':'roof and supports share one rigid parent; foundation stays grounded'},'technology':{'startMs':4040,'endMs':4520,'mountY':[36,0],'mountAngle':[-8,0],'mountDurationMs':160,'gateDelayMs':140,'gateY':[145,0],'counterweightY':[-145,0],'wheelAngle':[-100,0],'ropeTargets':'arch/beam anchors to moving gate hooks and counterweight knot'}}})
    print('Exported',len(frames),'frames /',sum(durations),'ms')

if sys.argv[1]=='representative':
    representative()
elif sys.argv[1]=='export':
    export()
