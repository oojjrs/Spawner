import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[3]
TEMP = PROJECT / '$Trash' / 'creature-idle-studies-v1'
sys.path.insert(0, str(TEMP / 'python-packages'))

import cv2
import numpy as np
from PIL import GifImagePlugin, Image, ImageDraw, _webp

SIZE = 512
BG = (34, 44, 40)


def ease(v):
    v = np.clip(v, 0, 1)
    return v * v * (3 - 2 * v)


def track(keys, t):
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if t <= b:
            return x + (y - x) * ease((t - a) / (b - a))
    return keys[-1][1]


def clean(pic):
    a = np.array(pic.convert('RGBA'))
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(a[:, :, 3] > 40), 8)
    keep = np.zeros(a.shape[:2], np.uint8)
    for i in range(1, count):
        if stats[i, 4] > 100:
            keep[labels == i] = 255
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8))
    a[:, :, 3] = np.minimum(a[:, :, 3], keep)
    return Image.fromarray(a)


def load(key, filename):
    return clean(Image.open(HERE / key / 'Source' / filename))


def png(path, pic):
    pic.save(path, 'PNG')


def save_json(path, data):
    enc = json.JSONEncoder()
    enc.ensure_ascii = False
    enc.indent = 2
    text = enc.encode(data) + '\n'
    path.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def transform(pic, mat, size):
    a = np.array(pic).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    b = cv2.warpAffine(a, np.array(mat, np.float32), size, None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    b[:, :, :3] /= np.maximum(b[:, :, 3:4], 1 / 255)
    return Image.fromarray(np.uint8(np.clip(b * 255 + .5, 0, 255)))


def translate(pic, x, y):
    return transform(pic, [[1, 0, x], [0, 1, y]], pic.size)


def mask_pic(pic, mask):
    a = np.array(pic)
    a[:, :, 3] = np.uint8(a[:, :, 3].astype(float) * np.asarray(mask).astype(float) / 255)
    return Image.fromarray(a)


def polygon(size, pts):
    m = Image.new('L', size)
    ImageDraw.Draw(m).polygon(pts, 255)
    return m


def register(source, target, bottom):
    a, b = np.array(source), np.array(target)
    ma, mb = np.uint8(a[:, :, 3] > 100) * 255, np.uint8(b[:, :, 3] > 100) * 255
    if bottom:
        ma[:int(ma.shape[0] * .52)] = 0
        mb[:int(mb.shape[0] * .52)] = 0
    sift = cv2.SIFT_create()
    ka, da = sift.detectAndCompute(cv2.cvtColor(a, cv2.COLOR_RGBA2GRAY), ma)
    kb, db = sift.detectAndCompute(cv2.cvtColor(b, cv2.COLOR_RGBA2GRAY), mb)
    matches = cv2.BFMatcher().knnMatch(da, db, 2)
    good = [m for m, n in matches if m.distance < .72 * n.distance]
    src = np.float32([ka[m.queryIdx].pt for m in good])
    dst = np.float32([kb[m.trainIdx].pt for m in good])
    mat, status = cv2.estimateAffinePartial2D(src, dst, None, cv2.RANSAC, 12)
    print('registration', len(good), int(status.sum()), mat.tolist())
    return transform(source, mat, target.size), mat


def packed_webp(path, frames, durations):
    enc = _webp.WebPAnimEncoder(frames[0].size, 0, 0, False, 9, 17, False, False)
    t = 0
    for frame, duration in zip(frames, durations):
        enc.add(frame.getim(), t, True, 100.0, 100.0, 3)
        t += duration
    enc.add(None, t, True, 100.0, 100.0, 0)
    path.write_bytes(enc.assemble('', '', ''))


def export(key, frames, durations, rig):
    folder = HERE / key
    frame_dir = folder / 'Frames'
    frame_dir.mkdir(exist_ok=True)
    for i, frame in enumerate(frames):
        png(frame_dir / ('%03d.png' % i), frame)
    preview = []
    for frame in frames:
        frame = frame.resize((384, 384), Image.Resampling.LANCZOS)
        bg = Image.new('RGB', (384, 384), BG)
        bg.paste(frame, (0, 0), frame)
        preview.append(bg)
    bank = Image.new('RGB', (384 * 4, 384 * 4), BG)
    for j in range(16):
        i = round(j * (len(frames) - 1) / 15)
        bank.paste(preview[i], (j % 4 * 384, j // 4 * 384))
    palette = bank.quantize(256)
    pframes = [p.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for p in preview]
    pframes[0].encoderinfo = {'duration': durations, 'loop': 0, 'append_images': pframes[1:], 'disposal': 2, 'optimize': False}
    with (folder / 'idle-preview.gif').open('wb') as handle:
        GifImagePlugin._save_all(pframes[0], handle, str(folder / 'idle-preview.gif'))
    packed_webp(folder / 'idle-preview.webp', frames, durations)
    bank.resize((1024, 1024), Image.Resampling.LANCZOS).save(folder / 'idle-contact.png')
    rig['canvas'] = [512, 512]
    rig['previewCanvas'] = [384, 384]
    rig['frameCount'] = len(frames)
    rig['durationsMs'] = durations
    rig['loop'] = True
    save_json(folder / 'rig.json', rig)
    print('exported', key, len(frames), sum(durations))


def turtle():
    key = 'vine-turtle'
    original = load(key, 'original.png')
    shell, registration = register(load(key, 'retracted-shell.png'), original, False)
    pts = {
        'head': [(279,945),(294,865),(339,818),(428,792),(523,792),(615,822),(665,868),(708,944),(712,1011),(668,1059),(590,1082),(465,1079),(379,1051),(312,1016)],
        'fore-far': [(270,967),(330,1010),(382,1047),(450,1075),(443,1140),(390,1195),(275,1200),(187,1179),(177,1135),(198,1074),(230,1018)],
        'fore-near': [(680,1045),(700,995),(760,965),(822,965),(875,992),(908,1043),(944,1116),(970,1210),(910,1240),(760,1240),(680,1210),(655,1170),(670,1105)],
        'hind': [(1173,1050),(1198,1007),(1267,978),(1326,978),(1361,1025),(1386,1075),(1404,1150),(1364,1196),(1300,1208),(1220,1198),(1153,1155),(1156,1108)],
        'tail': [(1289,909),(1321,897),(1359,881),(1397,855),(1393,891),(1376,938),(1344,976),(1300,988)]
    }
    masks = {name: polygon(original.size, points) for name, points in pts.items()}
    for name in ['fore-far','fore-near','hind','tail']:
        masks[name]=Image.fromarray(np.minimum(np.asarray(masks[name]),255-np.asarray(masks['head'])))
    parts = {name: mask_pic(original, m) for name, m in masks.items()}
    removed = np.maximum.reduce([np.asarray(m) for m in masks.values()])
    removed[980:]=255
    fixed = mask_pic(original, Image.fromarray(255 - removed))
    s = .35
    mat = [[s,0,-15],[0,s,19]]
    fixed = transform(fixed, mat, (SIZE,SIZE))
    shell = transform(shell, mat, (SIZE,SIZE))
    parts = {name: transform(part, mat, (SIZE,SIZE)) for name,part in parts.items()}
    for name,part in parts.items():
        png(HERE/key/'Source'/(name+'.png'),part)
    png(HERE/key/'Source'/'shell-complete-aligned.png', shell)
    png(HERE/key/'Source'/'shell-original-surface.png',fixed)
    head_gate = polygon((SIZE,SIZE),[(0,0),(194,0),(194,298),(212,306),(224,327),(224,344),(210,362),(191,371),(0,371)])
    fore_gate = polygon((SIZE,SIZE),[(0,379),(120,379),(144,404),(143,512),(0,512)])
    near_gate = polygon((SIZE,SIZE),[(214,512),(214,412),(224,379),(249,364),(270,364),(286,382),(300,413),(316,512)])
    hind_gate = polygon((SIZE,SIZE),[(384,512),(384,399),(399,374),(426,364),(445,374),(470,412),(512,512)])
    tail_gate = polygon((SIZE,SIZE),[(440,304),(512,282),(512,369),(440,369)])
    gates = {'head':head_gate,'fore-far':fore_gate,'fore-near':near_gate,'hind':hind_gate,'tail':tail_gate}
    velocity = {'head':(154,-19),'fore-far':(70,-75),'fore-near':(-3,-95),'hind':(-55,-80),'tail':(-66,8)}
    frames = []
    for i in range(160):
        t=i*.05
        head = track([(0,0),(.55,0),(.9,1),(2,1),(2.65,0),(8,0)],t)
        feet = track([(0,0),(.7,0),(1.12,1),(2.35,1),(3,0),(8,0)],t)
        settle = track([(0,0),(.84,0),(1.2,1),(2.45,1),(3.05,0),(8,0)],t)
        drop = 29*settle
        back = shell.copy()
        back.alpha_composite(fixed)
        back = translate(back,0,drop)
        for name in ['tail','hind','fore-far','head','fore-near']:
            amount = head if name=='head' else feet
            dx,dy=velocity[name]
            breath=0
            if name=='head' and t>3.05:
                breath=1.05*math.sin((t-3.05)*math.tau/2.1)*ease((t-3.05)/.5)*ease((8-t)/.5)
            moved=translate(parts[name],dx*amount,dy*amount+drop+breath)
            gate=translate(gates[name].convert('RGBA'),0,drop).getchannel('R')
            if amount>0:
                moved=mask_pic(moved,gate)
            back.alpha_composite(moved)
        frames.append(back)
    export(key,frames,[50]*len(frames),{'method':'original articulated head/limbs with painted hidden shell','source':'original.png','shellRegistration':registration.tolist(),'partPolygons':pts,'velocities':velocity,'action':'retract, hold shell, emerge, breathe','durationSeconds':8})


def catmull(points, count):
    p=np.asarray(points,float)
    q=np.vstack([p[0],p,p[-1]])
    dense=[]
    for i in range(len(p)-1):
        for u in np.linspace(0,1,30,False):
            a,b,c,d=q[i:i+4]
            dense.append(.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u))
    dense=np.vstack([dense,p[-1]])
    ds=np.r_[0,np.cumsum(np.linalg.norm(np.diff(dense,axis=0),axis=1))]
    t=np.linspace(0,ds[-1],count)
    return np.column_stack([np.interp(t,ds,dense[:,0]),np.interp(t,ds,dense[:,1])])


def ribbon(points, radius):
    tang=np.gradient(points,axis=0)
    normal=np.column_stack([-tang[:,1],tang[:,0]])
    normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],.01)
    return np.stack([points+normal*radius[:,None],points-normal*radius[:,None]],axis=1)


def mesh_render(texture, source, destination):
    canvas=np.zeros((SIZE,SIZE,4),np.uint8)
    src=source.reshape(-1,2)
    dst=destination.reshape(-1,2)
    for i in range(len(source)-1):
        for ids in [[2*i,2*i+1,2*i+2],[2*i+1,2*i+3,2*i+2]]:
            a=src[ids]
            b=dst[ids]
            lo=np.maximum(np.floor(b.min(axis=0)).astype(int)-1,0)
            hi=np.minimum(np.ceil(b.max(axis=0)).astype(int)+1,SIZE-1)
            if np.any(hi<lo):
                continue
            x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
            system=np.vstack([b.T,np.ones(3)])
            if abs(np.linalg.det(system))<.0001:
                continue
            bc=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
            inside=np.all(bc>=-.00001,axis=0)
            if not np.any(inside):
                continue
            uv=a.T@bc[:,inside]
            pix=cv2.remap(texture,uv[0].reshape(1,-1).astype(np.float32),uv[1].reshape(1,-1).astype(np.float32),cv2.INTER_LINEAR)[0]
            canvas[y.ravel()[inside],x.ravel()[inside]]=pix
    return Image.fromarray(canvas)


def vine():
    key='snare-vine'
    original=load(key,'original.png')
    clean_body,registration=register(load(key,'body-clean.png'),original,True)
    main_points=[(347,523),(304,467),(265,409),(236,340),(231,266),(252,199),(295,150),(357,120),(426,112),(493,127),(548,165),(582,224),(591,289),(574,354),(535,408),(482,446),(425,473),(395,514)]
    side_points=[(389,508),(427,474),(483,480),(537,513),(591,552),(649,562),(698,538),(727,495),(729,451),(710,420),(682,409),(658,419),(649,441),(655,462),(676,471),(687,463)]
    main=catmull(main_points,70)
    side=catmull(side_points,50)
    holes=np.zeros((original.height,original.width),np.uint8)
    cv2.polylines(holes,[np.int32(main)],False,255,75,cv2.LINE_AA)
    cv2.polylines(holes,[np.int32(side)],False,255,65,cv2.LINE_AA)
    untouched=mask_pic(original,Image.fromarray(255-holes))
    body=clean_body.copy()
    body.alpha_composite(untouched)
    s=.42
    m=np.array([[s,0,78],[0,s,100]])
    body=transform(body,m,(SIZE,SIZE))
    art=transform(original,m,(SIZE,SIZE))
    png(HERE/key/'Source'/'body-completed-aligned.png',body)
    main=main*s+[78,100]
    side=side*s+[78,100]
    mr=np.full(len(main),30*s)
    mr[:6]=np.linspace(17,30,6)*s
    mr[-7:]=np.linspace(30,18,7)*s
    sr=np.full(len(side),25*s)
    sr[-10:]=np.linspace(25,5,10)*s
    mesh=ribbon(main,mr)
    side_mesh=ribbon(side,sr)
    tex=np.array(art)
    uvmesh=np.zeros_like(mesh)
    uvmesh[:,0,0]=0
    uvmesh[:,1,0]=63
    uvmesh[:,:,1]=np.linspace(0,511,len(main))[:,None]
    strip=np.zeros((512,64,4),np.uint8)
    tang=np.gradient(main,axis=0)
    normals=np.column_stack([-tang[:,1],tang[:,0]])
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],.01)
    for j in range(512):
        u=j/511
        index=u*(len(main)-1)
        sample_index=index
        if u>.82:
            sample_index=.60*(len(main)-1)
        if u<.10:
            sample_index=.28*(len(main)-1)
        lo=int(sample_index)
        hi=min(lo+1,len(main)-1)
        f=sample_index-lo
        center=main[lo]*(1-f)+main[hi]*f
        normal=normals[lo]*(1-f)+normals[hi]*f
        normal/=np.linalg.norm(normal)
        width=30*s
        xy=center+np.linspace(1,-1,64)[:,None]*normal*width
        strip[j]=cv2.remap(tex,xy[:,0].reshape(1,-1).astype(np.float32),xy[:,1].reshape(1,-1).astype(np.float32),cv2.INTER_LINEAR)[0]
    mr[-8:]=np.linspace(30,1.5,8)*s
    png(HERE/key/'Source'/'main-tendril-unwrapped.png',Image.fromarray(strip))
    seg=np.diff(main,axis=0)
    lengths=np.linalg.norm(seg,axis=1)
    rest_angles=np.unwrap(np.arctan2(seg[:,1],seg[:,0]))
    unit=np.linspace(0,1,len(seg))
    frames=[]
    endpoints=[]
    for i in range(160):
        t=i*.05
        open_amount=track([(0,0),(.6,0),(1.35,1),(3.7,1),(4.65,0),(8,0)],t)
        spin=track([(0,0),(1.35,0),(3.7,2*math.tau),(4.65,2*math.tau),(8,2*math.tau)],t)
        angle=rest_angles+open_amount*(-1.2*unit+1.5*math.sin(spin)*np.sin(unit*math.pi)+1.25*(1-math.cos(spin))*unit*unit)
        chain=np.vstack([main[0],main[0]+np.cumsum(np.column_stack([np.cos(angle),np.sin(angle)])*lengths[:,None],axis=0)])
        moving=mesh_render(strip,uvmesh,ribbon(chain,mr))
        out=Image.new('RGBA',(SIZE,SIZE))
        out.alpha_composite(moving)
        sway=1.8*math.sin(t*math.tau/1.2)*open_amount
        side_current=side.copy()
        side_current[:,0]+=sway*np.linspace(0,1,len(side))**2
        side_current[:,1]+=.7*sway*np.linspace(0,1,len(side))**2
        out.alpha_composite(mesh_render(tex,side_mesh,ribbon(side_current,sr)))
        out.alpha_composite(body)
        endpoints.append(chain[-1].tolist())
        frames.append(out)
    export(key,frames,[50]*len(frames),{'method':'textured original tendril ribbon meshes with painted hidden leaf surfaces','source':'original.png','bodyRegistration':registration.tolist(),'mainCenterline':main.tolist(),'mainRadius':mr.tolist(),'sideCenterline':side.tolist(),'sideRadius':sr.tolist(),'tipTrajectory':endpoints,'action':'uncoil, two loose twirls, recoil, rest','durationSeconds':8})


def weasel():
    key='shadow-weasel'
    sheet=load(key,'curl-drawings-padded.png')
    sheet_array=np.array(sheet)
    count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(sheet_array[:,:,3]>40),8)
    subjects=[i for i in range(1,count) if stats[i,4]>3000]
    subjects.sort(key=lambda i:(int(centers[i,1]//(sheet.height/4)),centers[i,0]))
    assert len(subjects)==16
    cells=[]
    for i in range(16):
        subject=subjects[i]
        keep=np.uint8(labels==subject)*255
        keep=cv2.dilate(keep,np.ones((3,3),np.uint8))
        a=sheet_array.copy()
        a[:,:,3]=np.minimum(a[:,:,3],keep)
        cell=Image.fromarray(a)
        bbox=Image.fromarray(np.uint8(a[:,:,3]>100)*255).getbbox()
        shift_x=180-(bbox[0]+bbox[2])/2
        shift_y=290-bbox[3]
        cell=transform(cell,[[1,0,shift_x],[0,1,shift_y]],(360,360))
        cells.append(cell)
        png(HERE/key/'Source'/('pose-%02d.png'%i),cell)
    frames=[]
    durations=[]
    sequences=[(0,1000),(1,100),(2,110),(3,110),(4,100),(5,100),(6,110),(7,850),(8,100),(9,130),(10,130),(11,130),(12,130),(13,100),(14,100),(0,3000)]
    for n,duration in sequences:
        cell=cells[n]
        cell=transform(cell,[[1.38,0,8],[0,1.38,30]],(SIZE,SIZE))
        frames.append(cell)
        durations.append(duration)
    export(key,frames,durations,{'method':'sixteen source drawings for topology-changing curl and uncurl, common scale and ground registration','source':'curl-drawings-padded.png','action':'curl, tail wrap, hold, uncurl, rest','durationSeconds':sum(durations)/1000})


if __name__=='__main__':
    for action in sys.argv[1:] or ['turtle','vine','weasel']:
        globals()[action]()
