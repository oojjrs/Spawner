import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'
TEMP = ROOT.parents[1] / '$Trash' / 'pebble-single-walk-v5'
WIDTH, HEIGHT, FPS = 720, 480, 25
SCALE, PAD = .32, 64
STEP_FRAMES, LOOP_FRAMES = 10, 20
REST_FRAMES, MOVE_FRAMES, HOLD_FRAMES = 8, 60, 8
BOUT_FRAMES = REST_FRAMES + MOVE_FRAMES + HOLD_FRAMES
FRAME_COUNT = BOUT_FRAMES * 2
TRAVEL = 55
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
LABEL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 17)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
BODY = Image.open(SOURCE / 'body-complete.png').convert('RGBA')
BODY_PADDED = Image.new('RGBA', (640, 640), (0, 0, 0, 0))
BODY_PADDED.alpha_composite(BODY, (PAD, PAD))
FEET = {side: Image.open(SOURCE / ('foot-' + side + '.png')).convert('RGBA') for side in ['left','right']}
FOOT_CENTERS = {'left':159.5,'right':352}
FEET_CROPS = {side:(image.crop(image.getchannel('A').getbbox()),image.getchannel('A').getbbox()) for side,image in FEET.items()}
MATERIAL = Image.open(SOURCE / 'hidden-material.png').convert('RGBA').resize((640,640),Image.Resampling.LANCZOS)
MATERIAL = ImageEnhance.Brightness(MATERIAL).enhance(.64)

def smooth(value):
    value = max(0,min(1,value))
    return value*value*(3-2*value)

def controls(index):
    index %= LOOP_FRAMES
    half = index // STEP_FRAMES
    part = index % STEP_FRAMES / STEP_FRAMES
    support = 'left' if half == 0 else 'right'
    swing = 'right' if half == 0 else 'left'
    progress = smooth((part-.16)/.72)
    lifts = {'left':0,'right':0}
    lifts[swing] = 3.8*math.sin(math.pi*progress)
    angle = (1 if support == 'left' else -1)*3.6*math.sin(math.pi*part)
    return {'support':support,'lifts':lifts,'angle':angle}

def rotate_point(point,pivot,angle):
    radians = math.radians(angle)
    cosine,sine = math.cos(radians),math.sin(radians)
    x,y = point[0]-pivot[0],point[1]-pivot[1]
    return pivot[0]+cosine*x+sine*y,pivot[1]-sine*x+cosine*y

def pose(index):
    state = controls(index)
    pivot = (FOOT_CENTERS[state['support']],448)
    body = BODY_PADDED.copy() if abs(state['angle']) < .000000001 else BODY_PADDED.rotate(state['angle'],Image.Resampling.BICUBIC,False,(pivot[0]+PAD,pivot[1]+PAD))
    unit = Image.new('RGBA',(640,640),(0,0,0,0))
    mask = Image.new('L',(640,640),0)
    draw = ImageDraw.Draw(mask)
    for side in ['left','right']:
        hip = rotate_point([FOOT_CENTERS[side],423],pivot,state['angle'])
        ankle = (FOOT_CENTERS[side],448-state['lifts'][side]/SCALE-23)
        draw.line([(round(hip[0]+PAD),round(hip[1]+PAD)),(round(ankle[0]+PAD),round(ankle[1]+PAD))],255,10)
    legs = MATERIAL.copy()
    legs.putalpha(mask)
    if abs(state['angle']) > .000000001 or max(state['lifts'].values()) > .000000001:
        unit.alpha_composite(legs)
    unit.alpha_composite(body)
    for side in ['left','right']:
        crop,bounds = FEET_CROPS[side]
        unit.alpha_composite(crop,(PAD+bounds[0],round(PAD+bounds[1]-state['lifts'][side]/SCALE)))
    return unit

RAW_POSES = [pose(index) for index in range(LOOP_FRAMES)]
POSES = [image.resize((205,205),Image.Resampling.LANCZOS) for image in RAW_POSES]
POSE_HASHES = [hashlib.sha256(image.tobytes()).hexdigest() for image in POSES]
RAW_POSES[0].crop((PAD,PAD,PAD+512,PAD+512)).save(SOURCE/'reassembled-neutral.png')
sheet = Image.new('RGBA',(1280,1024),(0,0,0,0))
for index,image in enumerate(RAW_POSES):
    sheet.paste(image.resize((256,256),Image.Resampling.LANCZOS),(index%5*256,index//5*256))
sheet.save(ROOT/'walk-loop.png','PNG')
loop = {'frameSize':[256,256],'frameCount':LOOP_FRAMES,'columns':5,'durationsMs':[40]*LOOP_FRAMES,'durationMs':800,'pivot':[128,204.8],'directionVariants':1,'source':'source/body-complete.png and original foot attachments','note':'One baked in-place cycle; no movement direction is passed into pose generation.'}
(ROOT/'walk-loop.json').write_bytes((json.dumps(loop)+'\r\n').encode('utf-8'))

def placement(frame,panel):
    bout = min(1,frame//BOUT_FRAMES)
    local = frame-bout*BOUT_FRAMES
    if local < REST_FRAMES:
        progress,index,moving = 0,0,False
    elif local < REST_FRAMES+MOVE_FRAMES:
        clock = local-REST_FRAMES
        time = clock/FPS
        duration,ramp = MOVE_FRAMES/FPS,.2
        if time < ramp:
            progress = (time/2-ramp*math.sin(math.pi*time/ramp)/(2*math.pi))/(duration-ramp)
        elif time < duration-ramp:
            progress = (time-ramp/2)/(duration-ramp)
        else:
            remaining = duration-time
            progress = 1-(remaining/2-ramp*math.sin(math.pi*remaining/ramp)/(2*math.pi))/(duration-ramp)
        index,moving = clock%LOOP_FRAMES,True
    else:
        progress,index,moving = 1,0,False
    distance = TRAVEL*(progress if bout == 0 else 1-progress)
    position = (157+distance,344) if panel == 0 else (532,344-distance)
    return position,index,moving,bout

background = Image.new('RGBA',(WIDTH,HEIGHT),(236,231,216,255))
draw = ImageDraw.Draw(background)
draw.text((28,18),'몽돌 · 제자리 디딤 한 벌로 이동',(53,58,47,255),FONT)
draw.text((28,54),'동일한 20프레임을 재생하고 전체 위치만 이동',(102,107,88,255),SMALL)
for panel in range(2):
    left = 22+panel*346
    draw.rounded_rectangle((left,92,left+330,428),18,(219,218,195,255))
    draw.text((left+17,108),['좌우 이동','상하 이동'][panel],(76,83,64,255),LABEL)
    for x in range(left+20,left+320,24):
        for y in range(154,416,24):
            draw.ellipse((x-1,y-1,x+1,y+1),(202,202,176,255))
draw.text((28,448),'왼발 꾹 → 오른발 꾹   ·   방향별 보폭과 뒤집기 없음',(91,96,78,255),SMALL)
shadow = Image.new('RGBA',(124,16),(0,0,0,0))
ImageDraw.Draw(shadow).ellipse((7,4,117,12),(43,47,33,65))
shadow = shadow.filter(ImageFilter.GaussianBlur(1.6))
frames,native_frames = TEMP/'frames',TEMP/'native-frames'
frames.mkdir(0o777,True,True)
native_frames.mkdir(0o777,True,True)
keys,timeline = [],[]
for frame in range(FRAME_COUNT):
    scene = background.copy()
    panels = []
    for panel in range(2):
        (x,y),index,moving,bout = placement(frame,panel)
        actor = POSES[index]
        state = controls(index)
        scene.alpha_composite(shadow,(round(x-62),round(y-8)))
        foot_shadows = Image.new('RGBA',(WIDTH,HEIGHT),(0,0,0,0))
        sd = ImageDraw.Draw(foot_shadows)
        for side,lift in state['lifts'].items():
            fx = x+(FOOT_CENTERS[side]-256)*SCALE
            sd.ellipse((fx-10,y-1.5,fx+10,y+1.5),(48,53,36,round(65-lift*7)))
        scene.alpha_composite(foot_shadows)
        scene.alpha_composite(actor,(round(x-(256+PAD)*SCALE),round(y-(448+PAD)*SCALE)))
        label = (['오른쪽','위쪽'][panel] if bout == 0 else ['왼쪽','아래쪽'][panel])+(' · 이동' if moving else ' · 대기')
        ImageDraw.Draw(scene).text((45+panel*346,390),label,(96,103,83,255),SMALL)
        panels.append({'panel':panel,'root':[x,y],'poseIndex':index,'poseHash':POSE_HASHES[index]})
    scene.convert('RGB').save(frames/('frame-'+str(frame).zfill(3)+'.png'))
    scene.convert('RGB').resize((360,240),Image.Resampling.LANCZOS).save(native_frames/('frame-'+str(frame).zfill(3)+'.png'))
    if frame in [0,11,13,18,21,23,93,101]:
        keys.append(scene.convert('RGB').resize((360,240),Image.Resampling.LANCZOS))
    timeline.append({'frame':frame,'panels':panels})
contact = Image.new('RGB',(1440,480),(236,231,216))
for index,image in enumerate(keys):
    contact.paste(image,(index%4*360,index//4*240))
contact.save(TEMP/'keyposes.png')
rig = {'designAuthority':'DesignAssets/Tribes/pebble/starter.png','attachments':{'body':'source/body-complete.png','leftFoot':'source/foot-left.png','rightFoot':'source/foot-right.png'},'bones':[{'name':'root','parent':None},{'name':'stone','parent':'root','pivot':'stationary local support foot'},{'name':'left-foot','parent':'root','x':159.5},{'name':'right-foot','parent':'root','x':352}],'cycle':{'frames':20,'fps':25,'durationMs':800,'footLiftPxAtPreviewScale':3.8,'bodyLeanDegrees':3.6,'footAdvance':0,'directionInput':False},'sheet':'walk-loop.png','sheetMetadata':'walk-loop.json','preview':{'frames':FRAME_COUNT,'durationMs':round(FRAME_COUNT/FPS*1000),'size':[720,480],'panels':'identical baked pose pixels in both panels; only root translation differs'},'scope':'preview and one reusable baked animation; no game integration'}
(ROOT/'rig.json').write_bytes((json.dumps(rig)+'\r\n').encode('utf-8'))
(ROOT/'timeline.json').write_bytes((json.dumps(timeline)+'\r\n').encode('utf-8'))
print(json.dumps({'frames':FRAME_COUNT,'fps':FPS,'durationMs':round(FRAME_COUNT/FPS*1000),'bakedCycleFrames':20}))
