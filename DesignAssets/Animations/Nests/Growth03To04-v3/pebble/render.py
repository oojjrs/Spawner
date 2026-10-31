from pathlib import Path
from PIL import Image, ImageDraw, WebPImagePlugin
import sys
import json
import math
import numpy as np
import cv2

ROOT = Path(__file__).parent
if not (ROOT / 'start.png').exists():
    ROOT = ROOT / 'pebble'
PARTS = ROOT / 'Parts'
if not PARTS.exists():
    PARTS.mkdir()
Y, X = np.mgrid[:512, :512].astype(np.float32)
BONES = []
TRACKS = {}


def load(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    a[:, :, 3] = np.where(a[:, :, 3] > .5, 1, a[:, :, 3])
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def picture(a):
    a = np.clip(a, 0, 1)
    rgb = a[:, :, :3] / np.maximum(a[:, :, 3:4], 1e-8)
    return Image.fromarray(np.uint8(np.clip(np.concatenate((rgb, a[:, :, 3:4]), 2) * 255 + .5, 0, 255)))


def over(a, b):
    return a + b * (1 - a[:, :, 3:4])


def blank():
    return np.zeros((512, 512, 4), np.float32)


def ease(t, a, b):
    q = float(np.clip((t - a) / (b - a), 0, 1))
    return q * q * (3 - 2 * q)


def poly(points):
    im = Image.new('L', (512, 512))
    ImageDraw.Draw(im).polygon(points, 255)
    return np.asarray(im) > 0


def curve(start, segments):
    points = [start]
    p0 = np.asarray(start, float)
    for a, b, c in segments:
        a, b, c = [np.asarray(v, float) for v in (a, b, c)]
        for q in np.linspace(0, 1, 32)[1:]:
            points.append(tuple((1-q)**3*p0 + 3*(1-q)**2*q*a + 3*(1-q)*q*q*b + q**3*c))
        p0 = c
    return poly(points)


def transform(a, pivot, delta, angle):
    rad = math.radians(angle)
    c, s = math.cos(rad), math.sin(rad)
    x, y = pivot
    dx, dy = delta
    m = np.array([[c, -s, x + dx - c*x + s*y], [s, c, y + dy - s*x - c*y]], np.float32)
    return cv2.warpAffine(a, m, (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def crop_visible(im):
    a = np.asarray(im.getchannel('A'))
    yy, xx = np.where(a > 128)
    return im.crop((int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1))


def fit(a, box):
    x, y, w, h = box
    a = crop_visible(picture(a))
    scale = min(w / a.width, h / a.height)
    a = a.resize((round(a.width * scale), round(a.height * scale)), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (512, 512))
    out.paste(a, (round(x + (w-a.width)/2), round(y + (h-a.height)/2)))
    data = np.asarray(out).astype(np.float32) / 255
    data[:, :, :3] *= data[:, :, 3:4]
    return data


def atlas(path, cols, rows):
    im = Image.open(path).convert('RGBA')
    result = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c*im.width//cols, r*im.height//rows, (c+1)*im.width//cols, (r+1)*im.height//rows))
            a = np.asarray(cell).astype(np.float32)/255
            n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(a[:, :, 3] > .5), 8)
            k = 1 + int(np.argmax(stats[1:, 4]))
            keep = cv2.dilate(np.uint8(labels == k), np.ones((5, 5), np.uint8))
            a[:, :, 3] *= keep
            a[:, :, :3] *= a[:, :, 3:4]
            result.append(a)
    return result


class Part:
    def __init__(self, name, source, pivot, parent):
        self.name = name
        self.source = source
        self.pivot = pivot
        self.parent = parent
        picture(source).save(PARTS / (name + '.png'))
        BONES.append({'name': name, 'parent': parent, 'pivot': list(pivot), 'rigid': True, 'weights': {name: [1,1,1,1]}, 'source': 'Parts/' + name + '.png'})
        TRACKS[name] = []

    def render(self, t, delta, angle):
        TRACKS[self.name].append({'time': round(t, 4), 'translation': [round(float(v), 4) for v in delta], 'rotation': round(float(angle), 4), 'scale': [1,1]})
        return transform(self.source, self.pivot, delta, angle)


old = load(ROOT / 'start.png')
raw = Image.open(ROOT / 'reference-end.png').convert('RGBA')
raw = crop_visible(raw)
raw = raw.resize((480, round(raw.height * 480 / raw.width)), Image.Resampling.LANCZOS)
end_im = Image.new('RGBA', (512, 512))
end_im.paste(raw, (16, 448 - raw.height))
end_im.save(ROOT / 'end.png')
new = load(ROOT / 'end.png')
art = atlas(ROOT / 'part-source.png', 3, 2)
hidden = atlas(ROOT / 'hidden-source.png', 3, 3)
beam_mask = curve((172,282), [((159,279),(155,287),(156,303)),((153,319),(162,328),(176,328)),((209,332),(284,331),(314,328)),((334,331),(338,316),(333,300)),((336,285),(328,279),(314,282)),((269,279),(214,278),(172,282))])
weight_mask = curve((430,327), [((429,312),(439,301),(453,302)),((469,300),(479,313),(480,329)),((482,334),(483,340),(480,345)),((478,362),(469,368),(451,367)),((435,369),(428,358),(428,341)),((426,335),(426,332),(430,327))])
weight_mask=cv2.dilate(np.uint8(weight_mask),np.ones((5,5),np.uint8))>0
old_portal = curve((172,319), [((202,313),(298,313),(327,320)),((331,347),(327,406),(315,435)),((288,443),(204,442),(181,435)),((168,405),(164,351),(172,319))])
old_rope_mask = (X > 443) & (X < 458) & (Y > 239) & (Y < 328)
old_mech_mask = poly([(303,213),(321,204),(447,204),(457,227),(450,301),(427,310),(413,288),(407,255),(342,254),(335,278),(310,285),(299,267)])
old_mech_mask |= old_rope_mask | weight_mask
old_lintel = fit(art[2], (155,276,184,57))
old_wall = old * (~beam_mask)[:, :, None]
old_wall = over(old_lintel * beam_mask[:, :, None], old_wall)
old_fixed = old_wall * (~old_mech_mask)[:, :, None]
old_mech = old_wall * old_mech_mask[:, :, None]
foot_masks=[poly([(31,399),(40,387),(68,378),(135,379),(155,388),(171,411),(183,439),(165,448),(50,448),(28,431)]),poly([(324,421),(333,389),(361,377),(426,375),(449,388),(464,412),(465,439),(442,448),(331,448),(316,435)])]
old_feet=[Part('old-left-base',old_fixed*foot_masks[0][:,:,None],(105,421),'root'),Part('old-right-base',old_fixed*foot_masks[1][:,:,None],(394,422),'root')]
old_static=old_fixed*(~(foot_masks[0]|foot_masks[1]))[:,:,None]
BONES.append({'name':'old-lift-assembly','parent':'root','pivot':[375,252],'source':None})
TRACKS['old-lift-assembly']=[]
old_machine = Part('old-winch', old_mech * (~weight_mask & ~old_rope_mask)[:, :, None], (375,252), 'old-lift-assembly')
old_weight = Part('old-counterweight', old * weight_mask[:, :, None], (453,331), 'old-lift-assembly')
old_beam = Part('old-gate-beam', old * beam_mask[:, :, None], (250,306), 'root')
old_panel = Part('old-solid-gate', fit(art[0], (164,280,177,157)), (250,398), 'root')
portal = curve((260,258), [((303,258),(336,286),(344,327)),((347,350),(346,372),(343,393)),((301,401),(212,399),(174,392)),((170,369),(170,345),(175,326)),((182,283),(216,258),(260,258))])
outer_arch = curve((261,229), [((309,230),(354,274),(364,325)),((368,348),(367,379),(360,402)),((313,414),(204,411),(159,401)),((151,376),(152,345),(158,321)),((168,269),(210,230),(261,229))])
arch_mask = outer_arch & ~portal
left_mask = poly([(107,223),(141,222),(155,234),(161,251),(158,273),(172,348),(184,369),(183,389),(181,431),(109,437),(43,420),(18,410),(20,390),(31,372),(45,360),(58,350),(80,346),(100,272),(96,261),(90,254),(94,239)])
right_mask = poly([(373,223),(405,223),(423,237),(427,256),(419,276),(441,349),(463,357),(484,373),(496,399),(494,420),(423,438),(334,432),(329,390),(333,371),(347,348),(365,272),(365,251)])
steps_mask = poly([(139,385),(374,385),(380,404),(398,408),(411,421),(410,440),(391,450),(119,450),(102,443),(103,421),(115,410),(135,404)])
beam4_mask = curve((180,194), [((197,189),(239,191),(252,191)),((252,183),(270,184),(276,191)),((303,191),(334,193),(349,194)),((361,201),(359,220),(349,227)),((325,234),(291,231),(275,232)),((273,246),(272,251),(265,254)),((256,254),(252,247),(251,232)),((220,232),(191,233),(180,229)),((169,225),(168,202),(180,194))])
gear_centers = [(188,176),(335,174)]
gear_masks=[]
for cx,cy in gear_centers:
    points=[]
    for tooth in range(12):
        for angle,radius in [(0,23.8),(5,30),(20,30),(25,23.8)]:
            r=math.radians(tooth*30+angle-10)
            points.append((cx+radius*math.cos(r),cy+radius*math.sin(r)))
    gear_masks.append(poly(points))
hinge_masks=[poly([(141,164),(158,162),(188,166),(198,169),(198,179),(183,190),(166,197),(160,213),(142,210)]),poly([(330,167),(361,162),(383,166),(386,209),(369,213),(363,197),(348,190),(327,178)])]
chain_masks = [((X>=183)&(X<=197)&(Y>=181)&(Y<=236)), ((X>=330)&(X<=344)&(Y>=181)&(Y<=236))]
frame_masks = [poly([(143,144),(170,132),(191,139),(202,166),(198,188),(176,195),(176,220),(165,242),(152,259),(139,267),(140,242),(148,227),(143,212),(142,190),(135,177)]), poly([(328,140),(351,134),(377,146),(387,171),(383,195),(378,214),(385,231),(386,253),(374,269),(356,257),(347,240),(347,217),(350,195),(329,184)])]
rgb=new[:,:,:3]/np.maximum(new[:,:,3:4],1e-8)
sat=(rgb.max(2)-rgb.min(2))/np.maximum(rgb.max(2),1e-8)
bronze=(rgb[:,:,0]-rgb[:,:,1]>.04)&(rgb[:,:,1]-rgb[:,:,2]>.1)&(sat>.55)&(rgb[:,:,0]>.25)
for i in range(2):
    domain=frame_masks[i]|hinge_masks[i]
    core=np.uint8(bronze&domain)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(core,8)
    seeds=[(158,149),(151,207),(158,244),(171,174),(188,176)] if i==0 else [(368,151),(371,205),(363,246),(353,175),(335,174)]
    yy,xx=np.where(core)
    selected=set()
    for sx,sy in seeds:
        k=int(np.argmin((xx-sx)**2+(yy-sy)**2))
        selected.add(int(labels[yy[k],xx[k]]))
    clean=np.uint8(np.isin(labels,list(selected)))
    clean=cv2.morphologyEx(clean,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    clean=cv2.dilate(clean,np.ones((3,3),np.uint8))>0
    frame_masks[i] &= clean
    hinge_masks[i] &= clean
for i,(cx,cy) in enumerate(gear_centers):
    core=np.uint8(bronze&((X-cx)**2+(Y-cy)**2<31**2))*255
    core=cv2.morphologyEx(core,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    contours=cv2.findContours(core,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0]
    filled=np.zeros_like(core)
    cv2.drawContours(filled,[contours[int(np.argmax([cv2.contourArea(c) for c in contours]))]],-1,255,-1)
    actual=cv2.dilate(filled,np.ones((3,3),np.uint8))>0
    gear_masks[i] &= actual|hinge_masks[i]|chain_masks[i]
    stone=(rgb[:,:,2]>.35)&((X-cx)**2+(Y-cy)**2>22**2)&~hinge_masks[i]&~chain_masks[i]
    gear_masks[i] &= ~stone
owner = np.zeros((512,512), np.uint8)
owner[portal] = 1
owner[arch_mask] = 2
owner[left_mask] = 3
owner[right_mask] = 4
owner[steps_mask] = 5
for i,m in enumerate(frame_masks):
    owner[m & (owner == 0)] = 6+i
owner[beam4_mask] = 8
for i,m in enumerate(chain_masks):
    owner[m & (owner!=3) & (owner!=4)] = 9+i
for i,m in enumerate(gear_masks):
    owner[m] = 11+i
for i,m in enumerate(chain_masks):
    owner[m]=9+i
for i,m in enumerate(hinge_masks):
    owner[m]=6+i
native = [new * (owner == i)[:, :, None] for i in range(13)]
hardware_background=(((X>133)&(X<222))|((X>307)&(X<394)))&(Y>147)&(Y<271)
hardware_background |= (X>166)&(X<363)&(Y>185)&(Y<255)
light=np.uint8((new[:,:,:3].max(2)>.43)&(new[:,:,1]>.35)&(Y<165)&(Y>90)&(X>170)&(X<400))
n,labels,stats,centers=cv2.connectedComponentsWithStats(light,8)
crown_ids=[int(labels[118,239]),int(labels[126,314])]
crown_keep=cv2.dilate(np.uint8(np.isin(labels,[i for i in crown_ids if i>0])),np.ones((7,7),np.uint8))>0
ivory_keep=(new[:,:,2]>new[:,:,0]*.64)&(new[:,:,1]>new[:,:,0]*.72)&(new[:,:,0]>.4)&(Y>235)
ivory_keep=cv2.dilate(np.uint8(ivory_keep),np.ones((3,3),np.uint8))>0
hardware_background &= ~crown_keep&~ivory_keep
native[0] *= (~hardware_background)[:,:,None]
mount_masks=[poly([(145,237),(159,228),(177,229),(185,240),(175,257),(161,272),(146,273),(142,260)]),poly([(343,229),(361,229),(379,245),(384,262),(369,274),(350,258),(339,243)])]
for i,m in enumerate(mount_masks):
    native[0]*=(~m)[:,:,None]
    native[6+i]*=(~m)[:,:,None]
    native[2]=over(new*m[:,:,None],native[2])
picture(new).save(ROOT / 'registered-final.png')
rock_domain = (owner==0)
key_sheet=Image.open(ROOT/'key-source.png').convert('RGBA')
key_cell=key_sheet.crop((key_sheet.width//2,0,key_sheet.width,key_sheet.height//2))
body=crop_visible(key_cell)
body=body.resize((480,round(body.height*480/body.width)),Image.Resampling.LANCZOS)
body_canvas=Image.new('RGBA',(512,512))
body_canvas.paste(body,(16,448-body.height))
body_canvas.save(ROOT/'body-source.png')
rock_helper=load(ROOT/'body-source.png')
raw_bg=crop_visible(Image.open(ROOT/'background-source.png').convert('RGBA'))
raw_bg=raw_bg.resize((480,round(raw_bg.height*480/raw_bg.width)),Image.Resampling.LANCZOS)
registered_bg=Image.new('RGBA',(512,512))
registered_bg.paste(raw_bg,(16,448-raw_bg.height))
registered_bg.save(ROOT/'background-restored.png')
wall_patch=load(ROOT/'background-restored.png')
restore_mask=hardware_background&~outer_arch&~left_mask&~right_mask&(Y<247)
spatial=cv2.GaussianBlur(np.float32(restore_mask),(0,0),1.5)
spatial[crown_keep]=0
rock_helper=over(wall_patch*spatial[:,:,None],rock_helper)
rough = rock_helper
rock_groups = [
    ('crown', (Y<153)&(X>=170)&(X<=395), (269,142), (0,130), .78,1.5),
    ('upper-left-rocks', (Y<244)&(X<170), (117,196), (90,85), .82,1.48),
    ('upper-right-rocks', (Y<244)&(X>349), (409,198), (-100,85), .86,1.53),
    ('middle-lintel', (Y<244)&(X>=170)&(X<=349)&~((Y<153)&(X>=170)&(X<=395)), (256,200), (0,100), .8,1.55),
    ('lower-left-rocks', (Y>=244)&(X<256), (91,348), (100,-15), .88,1.55),
    ('lower-right-rocks', (Y>=244)&(X>=256), (425,348), (-115,-15), .92,1.55)
]
assigned = np.zeros((512,512),bool)
rock_parts=[]
for n,m,p,d,a,b in rock_groups:
    m &= ~assigned
    assigned |= m
    rock_parts.append((Part(n, rough*m[:, :, None], p, 'root'),d,a,b))
interior = Part('new-cave', native[1], (260,390), 'root')
arch_helper = fit(hidden[2], (146,233,220,173)) * (new[:, :, 3]>.5)[:, :, None]
arch_full = over(native[2], arch_helper * (owner==2)[:, :, None])
arch_part = Part('ivory-arch', arch_full, (260,384), 'root')
left_full = over(native[3], fit(hidden[0],(18,224,168,212))*(new[:,:,3]>.5)[:,:,None]*(owner==3)[:,:,None])
right_full = over(native[4], fit(hidden[1],(330,224,168,212))*(new[:,:,3]>.5)[:,:,None]*(owner==4)[:,:,None])
left_part = Part('left-pilaster',left_full,(112,427),'root')
right_part = Part('right-pilaster',right_full,(414,427),'root')
steps_part = Part('front-steps', native[5], (256,448), 'root')
frame_parts = [Part('left-bronze-frame', native[6], (162,207), 'root'), Part('right-bronze-frame', native[7], (365,207), 'root')]
beam4 = Part('new-gate-beam', native[8], (263,219), 'root')
gate4 = Part('new-solid-gate', fit(art[1],(166,56,190,180)), (263,219), 'new-gate-beam')
gear_parts=[]
for i,center in enumerate(gear_centers):
    helper = fit(art[4+i], (center[0]-30,center[1]-30,60,60))
    rgb=helper[:,:,:3]/np.maximum(helper[:,:,3:4],1e-8)
    cx,cy=center
    patch=rgb[cy-33:cy+34,cx-33:cx+34]
    holes=np.uint8(helper[cy-33:cy+34,cx-33:cx+34,3]<.5)*255
    patch=cv2.inpaint(np.uint8(np.clip(patch*255,0,255)),holes,3,cv2.INPAINT_TELEA).astype(np.float32)/255
    rgb[cy-33:cy+34,cx-33:cx+34]=patch
    complete=np.concatenate((rgb,np.ones((512,512,1),np.float32)),2)*gear_masks[i][:,:,None]
    combined = over(native[11+i],complete)
    gear_parts.append(Part(('left' if i==0 else 'right')+'-gear', combined, center, frame_parts[i].name))
old_rope_sample = old[256:280,448:454].copy()
chain_samples = [new[198:216,184:196].copy(),new[198:216,331:343].copy()]
for sample in chain_samples:
    rgb=sample[:,:,:3]/np.maximum(sample[:,:,3:4],1e-8)
    keep=(rgb[:,:,2]<.38)|(rgb[:,:,:3].max(2)<.45)
    sample*=keep[:,:,None]


def vertical_tape(sample,x,top,bottom):
    out=blank()
    top,bottom=round(top),round(bottom)
    if bottom<=top:
        return out
    top=max(0,top)
    bottom=min(512,bottom)
    n=bottom-top
    tile=np.tile(sample,(math.ceil(n/sample.shape[0]),1,1))[:n]
    left=round(x-sample.shape[1]/2)
    out[top:bottom,left:left+sample.shape[1]]=tile
    return out


def old_pose(t):
    q=ease(t,.15,.75)
    wall=old_wall*(~weight_mask & ~old_rope_mask)[:,:,None]
    patch=fit(hidden[8],(329,300,136,77))
    restore=weight_mask & (X<461) & (Y<371)
    wall=over(patch*restore[:,:,None],wall)
    out=over(old_panel.render(t,(0,112*q-112),0)*old_portal[:,:,None],wall)
    out=over(vertical_tape(old_rope_sample,174,284,304+112*q),out)
    out=over(vertical_tape(old_rope_sample,320,282,304+112*q),out)
    out=over(vertical_tape(old_rope_sample,451,242,305-56*q),out)
    out=over(old_weight.render(t,(0,-56*q),0),out)
    out=over(old_beam.render(t,(0,112*q),0),out)
    if t<=.15:
        return old.copy()
    return out


def render(t):
    if t<=.75:
        TRACKS['old-lift-assembly'].append({'time':round(t,4),'translation':[0,0],'rotation':0,'scale':[1,1]})
        return old_pose(t)
    q=ease(t,.15,.75)
    out=old_static.copy()
    retire=ease(t,.98,1.55)
    for i,part in enumerate(old_feet):
        out=over(part.render(t,((120 if i==0 else -120)*retire,0),0),out)
    patch=fit(hidden[8],(329,300,136,77))
    out=over(patch*(weight_mask & (X<461) & (Y<371))[:,:,None],out)
    mech_retire=ease(t,1.03,1.55)
    machine=old_machine.render(t,(0,0),0)
    machine=over(vertical_tape(old_rope_sample,451,242,305-56*q),machine)
    machine=over(old_weight.render(t,(0,-56*q),0),machine)
    machine=transform(machine,(375,252),(-130*mech_retire,80*mech_retire),25*mech_retire)
    TRACKS['old-lift-assembly'].append({'time':round(t,4),'translation':[-130*mech_retire,80*mech_retire],'rotation':25*mech_retire,'scale':[1,1]})
    out=over(machine,out)
    ordered=rock_parts[4:]+rock_parts[:4]
    for part,delta,a,b in ordered:
        p=ease(t,a,b)
        yy=np.where(part.source[:,:,3]>.5)[0]
        start_y=451-float(yy.min())
        settle=18*ease(t,1.6,2.25) if part.name.startswith('lower-') else 0
        out=over(part.render(t,(delta[0]*.2*(1-p),start_y*(1-p)-settle),0),out)
    old_gate=old_panel.render(t,(0,112*q-112),0)*old_portal[:,:,None]
    out=over(old_gate,out)
    out=over(vertical_tape(old_rope_sample,174,284,304+112*q),out)
    out=over(vertical_tape(old_rope_sample,320,282,304+112*q),out)
    out=over(old_beam.render(t,(0,112*q),0),out)
    p=ease(t,1.66,2.25)
    out=over(arch_part.render(t,(0,230*(1-p)),0),out)
    frame_images=[]
    for i,part in enumerate(frame_parts):
        p=ease(t,2.23+i*.04,2.64+i*.04)
        frame_images.append(part.render(t,((20 if i==0 else -20)*(1-p),320*(1-p)),0))
    install=ease(t,2.32,2.8)
    opening=ease(t,2.82,3.7)
    gate_dy=(400*(1-install)+148*install)*(1-opening)
    beam_dy=(260*(1-install)+148*install)*(1-opening)
    if t>=2.8:
        out=over(interior.render(t,(0,0),0),out)
    gate=gate4.render(t,(0,gate_dy),0)*portal[:,:,None]
    TRACKS['new-solid-gate'][-1]['translation']=[0,gate_dy-beam_dy]
    out=over(gate,out)
    gear_images=[]
    gear_deltas=[]
    for i,part in enumerate(gear_parts):
        p=ease(t,2.23+i*.04,2.64+i*.04)
        angle=(1 if i==0 else -1)*67*(1-opening)
        delta=((20 if i==0 else -20)*(1-p),320*(1-p))
        gear_deltas.append(delta)
        gear_images.append(part.render(t,delta,angle))
        TRACKS[part.name][-1]['translation']=[0,0]
    for item in gear_images+frame_images:
        out=over(item,out)
    beam=beam4.render(t,(0,beam_dy),0)
    if t<2.8:
        beam*=portal[:,:,None]
    out=over(beam,out)
    for i,sample in enumerate(chain_samples):
        base=native[9+i]
        chain=transform(base,(190 if i==0 else 337,182),gear_deltas[i],0)
        extra=vertical_tape(sample,(190 if i==0 else 337)+gear_deltas[i][0],237+gear_deltas[i][1],230+beam_dy)
        chain=over(extra,chain)
        out=over(chain,out)
    p=ease(t,1.6,2.19)
    out=over(left_part.render(t,(-16*(1-p),230*(1-p)),0),out)
    p=ease(t,1.67,2.25)
    out=over(right_part.render(t,(16*(1-p),230*(1-p)),0),out)
    p=ease(t,1.55,2.12)
    out=over(steps_part.render(t,(0,95*(1-p)),0),out)
    out[Y>=449]=0
    return out


def save_json(path,data):
    path.write_bytes((json.dumps(data)+'\r\n').replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))


def export(mode):
    times=[0,.35,.75,1.05,1.3,1.55,1.85,2.25,2.55,2.8,3.05,3.35,3.7,4]
    if mode=='full':
        times=[i/25 for i in range(101)]
    frames=[]
    for t in times:
        im=picture(render(t))
        frames.append(im)
        if mode!='full':
            im.save(ROOT/('probe-'+str(round(t*1000))+'.png'))
    indices=list(range(len(frames))) if mode!='full' else [0,9,19,26,33,39,46,56,64,70,76,84,93,100]
    board=Image.new('RGBA',(1536,math.ceil(len(indices)/4)*404),'#223532')
    d=ImageDraw.Draw(board)
    for k,i in enumerate(indices):
        x,y=(k%4)*384,(k//4)*404
        board.alpha_composite(frames[i].resize((384,384),Image.Resampling.LANCZOS),(x,y+20))
        d.text((x+8,y+4),str(times[i])+'s','#ffffff')
    board.convert('RGB').save(ROOT/('contact-'+mode+'.png'))
    pivots={'root':np.array([256,448],float)}
    for bone in BONES:
        pivots[bone['name']]=np.asarray(bone['pivot'],float)
    for bone in BONES:
        bone['bindLocalTranslation']=(np.asarray(bone['pivot'])-pivots[bone['parent']]).tolist()
        bone['bindWorldPivot']=bone['pivot']
        source=bone.get('source')
        if source is not None:
            bounds=Image.open(ROOT/source).getbbox()
            bone['bounds']=list(bounds) if bounds else None
    picture(old_rope_sample).save(PARTS/'old-rope-strip.png')
    for i,sample in enumerate(chain_samples):
        picture(sample).save(PARTS/('chain-strip-'+str(i)+'.png'))
    save_json(ROOT/'rig.json',{'format':'custom-2d-rigid-parts','root':[256,448],'bones':BONES,'tracks':TRACKS,'opacityAnimation':False,'drawOrderHandoffSeconds':2.8,'proceduralAttachments':{'oldRopes':{'source':'Parts/old-rope-strip.png','counterweightTravelRatio':-.5,'parent':'old-lift-assembly'},'chains':{'sources':['Parts/chain-strip-0.png','Parts/chain-strip-1.png'],'gearCenters':gear_centers,'baselineBottom':237}},'dependencies':['Pillow','numpy','opencv-python-headless']})
    if mode!='full':
        print('representative poses exported')
        return
    sheet=Image.new('RGBA',(4096,6656))
    for i,im in enumerate(frames):
        sheet.alpha_composite(im,((i%8)*512,(i//8)*512))
    sheet.save(ROOT/'growth.png')
    frames[0].save(ROOT/'poster.png')
    frames[-1].save(ROOT/'rendered-end.png')
    board.convert('RGB').save(ROOT/'keyframes.png')
    durations=[40]*100+[800]
    for name,size,loop in [('growth',512,1),('preview',384,0)]:
        items=[im.resize((size,size),Image.Resampling.LANCZOS) for im in frames]
        items[0].encoderinfo={'append_images':items[1:],'duration':durations,'lossless':True,'loop':loop,'method':4}
        with (ROOT/(name+'.webp')).open('wb') as stream:
            WebPImagePlugin._save_all(items[0],stream,'')
    save_json(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True,'method':'drawn hidden surfaces and rigid part rigging','keyframeApproval':'user confirmed current four drawn keyframes','sources':{'start':'start.png','end':'end.png','keyframes':'key-source.png','parts':'Parts','rig':'rig.json','renderer':'render.py','partsArt':'part-source.png','hiddenSurfaces':'hidden-source.png','backgroundRestoration':'background-source.png','stoneBody':'body-source.png'}})
    print('full sequence exported')


if __name__=='__main__':
    export(sys.argv[1] if len(sys.argv)>1 else 'probe')