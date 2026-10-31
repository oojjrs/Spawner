import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, _webp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE / 'Source'
KEY = HERE.name
DURATIONS = [70, 210, 50, 300, 170, 220]
PHASES = ['neutral', 'grounded-crouch-wing-load', 'airborne-talon-reach', 'down-left-talon-contact', 'wing-fold-landing', 'neutral']
CONFIG = {
    'bubble-toad': {'pivot': [259, 380.52], 'rootMotion': False, 'anchor': 'spotted-back', 'trajectory': [[0,0],[0,-3],[0,4],[0,6],[0,1],[0,0]], 'motion': 'Inflated vocal-sac anticipation, forehands brace, throat deflates and jaws open, compact tongue lash held 300ms, tongue and sac recover.'},
    'vine-turtle': {'pivot': [262.5,441.62], 'rootMotion': False, 'anchor': 'rigid-orange-carapace', 'trajectory': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]], 'motion': 'Head retracts under rigid shell, freshly drawn neck and open jaw reach forward, low closed-beak bite held 300ms, neck retracts and leaves settle.'},
    'shadow-weasel': {'pivot': [257,423.56], 'rootMotion': True, 'anchor': 'muzzle', 'trajectory': [[0,0],[8,-8],[10,-8],[-10,3],[2,-4],[0,0]], 'motion': 'Hind-leg crouch and lifted forepaw, low pounce with open jaw and claw reach, forepaw rake and jaw clamp held 300ms, recoil and reset. Tail coils above the spine to preserve the fixed canvas.'},
    'snare-vine': {'pivot': [255.5,470.16], 'rootMotion': False, 'anchor': 'bulb-root', 'trajectory': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]], 'motion': 'Main loop coils upward and back, unfurls into a broad continuous arc, lashes down-left with a planted bulb held 300ms, curls back through a newly drawn recovery.'},
    'talon-owl': {'pivot': [234,400], 'rootMotion': True, 'anchor': 'manual-iris-pair', 'scale': 1.125, 'seedEyes': [[174,197],[230,200]], 'sourceEyes': [[[101,331],[152,332]],[[400,424],[442,425]],[[775,343],[820,344]],[[1124,405],[1171,414]],[[1561,328],[1611,331]],[[1935,333],[1984,335]]], 'trajectory': [[0,0],[-0.5,73.5],[-21,36.5],[-56,47.5],[0,-1],[0,0]], 'motion': 'Crouch and half-open wing preparation, airborne wing spread with reaching talons, low down-left talon rake held 300ms, partial wing fold and landing recovery.'}
}


def save_json(path, value):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))


def save_webp(path, picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(), True, 100.0, 100.0, '', 6, 1, b'', ''))


def animate(path, frames):
    encoder = _webp.WebPAnimEncoder(frames[0].size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    durations = DURATIONS.copy()
    durations[-1] += 800
    for picture, duration in zip(frames, durations):
        encoder.add(picture.getim(), timestamp, True, 100.0, 100.0, 3)
        timestamp += duration
    encoder.add(None, timestamp, True, 100.0, 100.0, 0)
    path.write_bytes(encoder.assemble('', '', ''))


def bounds(pixels):
    ys,xs = np.where(pixels[:,:,3] > 128)
    return [int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1]


def specks(pixels):
    output = pixels.copy()
    count,labels,stats,centers = cv2.connectedComponentsWithStats(np.uint8(output[:,:,3] > 4),8)
    large = np.zeros(output.shape[:2],np.uint8)
    for index in range(1,count):
        if stats[index,4] >= 64:
            large[labels == index] = 1
    distance = cv2.distanceTransform(1-large,cv2.DIST_L2,5)
    for index in range(1,count):
        selected = labels == index
        if stats[index,4] < 64 and float(distance[selected].min()) > 8:
            output[selected,3] = 0
    return output


def clean_edges(cel):
    pixels = specks(cel)
    alpha = pixels[:,:,3]
    interior = cv2.erode(np.uint8(alpha > 128),np.ones((3,3),np.uint8)) > 0
    red = (pixels[:,:,0] > 210) & (pixels[:,:,1] < 72) & (pixels[:,:,2] < 64)
    yellow = (pixels[:,:,0] > 199) & (pixels[:,:,1] > 178) & (pixels[:,:,2] < 64)
    green = (pixels[:,:,0] < 102) & (pixels[:,:,1] > 191) & (pixels[:,:,2] < 102)
    pixels[:,:,3] = np.where((red | yellow | green) & ~interior,0,alpha)
    return pixels


def isolate(picture):
    pixels = np.array(picture)
    count,labels,stats,centers = cv2.connectedComponentsWithStats(np.uint8(pixels[:,:,3] > 16),8)
    selected = [index for area,index in sorted([(-int(stats[index,4]),index) for index in range(1,count)])[:6]]
    selected = [index for x,index in sorted([(float(centers[index,0]),index) for index in selected])]
    distances = [cv2.distanceTransform(np.uint8(labels != component),cv2.DIST_L2,5) for component in selected]
    owners = np.argmin(np.stack(distances),0)
    results = []
    for index in range(6):
        cel = pixels.copy()
        cel[:,:,3] = np.where(owners == index,cel[:,:,3],0)
        results.append(clean_edges(cel))
    return results


def feature(pixels):
    left,top,right,bottom = bounds(pixels)
    r,g,b = [pixels[:,:,index].astype(float) for index in range(3)]
    yy,xx = np.mgrid[:pixels.shape[0],:pixels.shape[1]]
    mask = pixels[:,:,3] > 192
    if KEY == 'vine-turtle':
        mask &= (r > 150) & (r > g*1.15) & (b < g*.8)
    elif KEY == 'bubble-toad':
        mask &= (r > 50) & (r < 160) & (g > r*1.08) & (g < 190) & (b < 130) & (xx > left+(right-left)*.45)
    elif KEY == 'snare-vine':
        mask &= (r > 100) & (g > 90) & (b < 110) & (r > g*.9) & (r < g*1.3) & (yy > bottom-135)
    elif KEY == 'talon-owl':
        mask &= (r > 200) & (g > 110) & (g < 210) & (b < 100) & (r > g*1.13)
    else:
        near_x,near_y = left+40,bottom-52
        mask &= (r < 100) & (g < 100) & (b < 100) & (np.abs(r-g)<12) & (np.abs(g-b)<12) & (np.abs(xx-near_x)<35) & (np.abs(yy-near_y)<28)
    ys,xs = np.where(mask)
    if len(xs) < 4:
        raise RuntimeError('Missing semantic anchor '+KEY)
    point = [float(xs.mean()),float(ys.mean())]
    if KEY == 'snare-vine':
        point[1] = bottom
    return point,[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1]


def main():
    config = CONFIG[KEY]
    raw = Image.open(SOURCE/'raw-drawn-strip.png').convert('RGBA')
    seed = Image.open(SOURCE/'seed.png').convert('RGBA')
    seed_pixels = np.array(seed)
    cels = isolate(raw)
    if KEY == 'talon-owl':
        target = np.mean(config['seedEyes'],0).tolist()
        scale = config['scale']
    else:
        target,feature_seed = feature(seed_pixels)
        first,feature_first = feature(cels[0])
        sb,fb = bounds(seed_pixels),bounds(cels[0])
        scale = (sb[2]-sb[0])/(fb[2]-fb[0])
        largest = max(bounds(cel)[2]-bounds(cel)[0] for cel in cels)
        scale = min(scale,500/largest)
    frames = []
    records = []
    (SOURCE/'Frames').mkdir(511,True,True)
    for index,cel in enumerate(cels):
        if KEY == 'talon-owl':
            anchor = np.mean(config['sourceEyes'][index],0).tolist()
        else:
            anchor,unused = feature(cel)
        desired = [target[axis]+config['trajectory'][index][axis] for axis in range(2)]
        offset = [desired[axis]-anchor[axis]*scale for axis in range(2)]
        if index in [0,5]:
            frame = seed.copy()
        else:
            pixels = cel.astype(np.float32)/255
            pixels[:,:,:3] *= pixels[:,:,3:4]
            matrix = np.array([[scale,0,offset[0]],[0,scale,offset[1]]],np.float32)
            warped = cv2.warpAffine(pixels,matrix,(512,512),None,cv2.INTER_LANCZOS4,cv2.BORDER_CONSTANT)
            warped[:,:,:3] /= np.maximum(warped[:,:,3:4],1/255)
            output = specks(np.uint8(np.clip(warped*255+.5,0,255)))
            output[output[:,:,3] <= 4] = 0
            frame = Image.fromarray(output)
        frame.save(SOURCE/'Frames'/('pose-%02d.png'%(index+1)),'PNG')
        frames.append(frame)
        source_bounds = bounds(cel)
        projected = [source_bounds[0]*scale+offset[0],source_bounds[1]*scale+offset[1],source_bounds[2]*scale+offset[0],source_bounds[3]*scale+offset[1]]
        records.append({'index':index,'phase':PHASES[index],'file':'Source/Frames/pose-%02d.png'%(index+1),'durationMs':DURATIONS[index],'exactSeed':index in [0,5],'anchorMethod':config['anchor'],'sourceEyeCenters':config['sourceEyes'][index] if KEY == 'talon-owl' else None,'sourceAnchor':anchor,'targetAnchor':desired,'sharedScale':scale,'translation':offset,'sourceBounds':source_bounds,'projectedBounds':projected,'bounds':list(frame.getbbox())})
    atlas = Image.new('RGBA',(3072,512),(0,0,0,0))
    for index,frame in enumerate(frames):
        atlas.paste(frame,(index*512,0))
    save_webp(HERE/'attack.webp',atlas)
    animate(HERE/'attack-preview.webp',[frame.resize((256,256),Image.Resampling.LANCZOS) for frame in frames])
    thumb = ROOT/'DesignAssets/Planning/UnitPreviews'/KEY/'attack-v2.webp'
    thumb.parent.mkdir(511,True,True)
    animate(thumb,[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])
    contact = Image.new('RGB',(1536,282),(31,42,36))
    draw = ImageDraw.Draw(contact)
    for index,frame in enumerate(frames):
        small = frame.resize((256,256),Image.Resampling.LANCZOS)
        contact.paste(small,(index*256,0),small)
        draw.text((index*256+8,260),'%d / %d ms'%(index+1,DURATIONS[index]),(245,246,239))
    contact.save(HERE/'contact.png','PNG')
    metadata = {'name':KEY,'action':'attack','status':'new drawn cels awaiting actual playback review','image':'DesignAssets/Animations/CreatureAttackV2/'+KEY+'/attack.webp','frameSize':512,'columns':6,'frameCount':6,'durationsMs':DURATIONS,'durationMs':sum(DURATIONS),'loop':False,'rootMotion':config['rootMotion'],'rootMotionNote':config['motion'],'pivotX':config['pivot'][0],'pivotY':config['pivot'][1],'impactFrame':3,'hitAtMs':330,'impactHoldMs':300,'previewPauseMs':800,'facing':'left','provider':'built-in image_gen','artworkMethod':'Newly drawn full-strip cels from one seed-anchored six-pose generation, followed by a targeted anatomy edit of the full strip. Source cels2-5 are new full drawings; first and last are locked exactly to shipped neutral. No mesh warp, crossfade, synthetic motion interpolation, or per-frame scaling.','motion':config['motion'],'source':'Source/raw-drawn-strip.png','initialSource':'Source/raw-initial.png','seed':'Source/seed.png','editCanvas':'Source/edit-canvas.png','prompt':'Source/prompt.txt','initialPrompt':'Source/prompt-initial.txt','renderer':'export.py','preview':'attack-preview.webp','contact':'contact.png','thumbnail':'DesignAssets/Planning/UnitPreviews/'+KEY+'/attack-v2.webp','normalization':'Official edit-canvas and strip normalizer used; anatomical-anchor registration with one global scale preserves rigid body features and explicit local trajectories. Per-pose translation only registers the declared anatomical anchor; it does not fit each frame to its own extents.','normalizationScale':scale,'anchorMethod':config['anchor'],'seedEyeCenters':config['seedEyes'] if KEY == 'talon-owl' else None,'rootTrajectory':config['trajectory'],'firstAndLastFrameIdentical':True,'frames':records}
    save_json(HERE/'attack.json',metadata)
    save_json(SOURCE/'normalization.json',{'rawSize':list(raw.size),'seedEyes':config['seedEyes'] if KEY == 'talon-owl' else None,'sourceEyes':config['sourceEyes'] if KEY == 'talon-owl' else None,'sharedScale':scale,'anchor':config['anchor'],'rootTrajectory':config['trajectory'],'perFrameScale':False,'edgeCleanup':'Only isolated exterior neon matte fringe, and detached components smaller than64px farther than8px from substantive artwork. Seed remains byte-identical.','frames':records})
    print(KEY,'scale',scale,'projected bounds',[record['projectedBounds'] for record in records[1:5]])


if __name__ == '__main__':
    main()
