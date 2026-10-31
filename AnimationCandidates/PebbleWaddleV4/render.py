import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parents[1] / '$Trash' / 'pebble-waddle-v4'
SOURCE = ROOT / 'source'
WIDTH, HEIGHT, FPS = 720, 480, 25
SCALE, PAD = .32, 64
STEP_FRAMES, STEPS, STRIDE = 10, 6, 10
REST_FRAMES, SETTLE_FRAMES, HOLD_FRAMES = 8, 10, 8
BOUT_FRAMES = REST_FRAMES + STEP_FRAMES * STEPS + SETTLE_FRAMES + HOLD_FRAMES
FRAME_COUNT = 2 * BOUT_FRAMES
TRAVEL = (STEPS - .5) * STRIDE
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
LABEL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 17)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
ORIGINAL_BODY = Image.open(SOURCE / 'body.png').convert('RGBA')
NEUTRAL = Image.open(SOURCE / 'neutral.png').convert('RGBA')
FEET = {side: Image.open(SOURCE / ('foot-' + side + '.png')).convert('RGBA') for side in ['left', 'right']}
FOOT_CENTERS = {'left': 159.5, 'right': 352}
MATERIAL = Image.open(SOURCE / 'hidden-material.png').convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS)
MATERIAL = ImageEnhance.Brightness(MATERIAL).enhance(.64)
BODY = ORIGINAL_BODY.copy()
pixels, paint = BODY.load(), MATERIAL.load()
opaque_feet = ImageChops.lighter(FEET['left'].getchannel('A'), FEET['right'].getchannel('A')).load()
for y in range(410, 449):
    for x in range(110, 400):
        if opaque_feet[x, y] == 255:
            lower_contour = 431 - .00072 * (x - 256) ** 2
            pixels[x, y] = paint[x, y] if y <= lower_contour else (0, 0, 0, 0)
BODY.save(SOURCE / 'body-complete.png')
BODY_PADDED = Image.new('RGBA', (640, 640), (0, 0, 0, 0))
BODY_PADDED.alpha_composite(BODY, (PAD, PAD))
FEET_CROPS = {}
for side, foot in FEET.items():
    bounds = foot.getchannel('A').getbbox()
    FEET_CROPS[side] = (foot.crop(bounds), bounds)
neutral_assembly = BODY.copy()
for foot in FEET.values():
    neutral_assembly.alpha_composite(foot)
neutral_assembly.save(SOURCE / 'reassembled-neutral.png')

def smooth(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)

def gait(frame):
    bout = min(1, frame // BOUT_FRAMES)
    local = frame - bout * BOUT_FRAMES
    controls = {'left': {'distance': 0, 'lift': 0}, 'right': {'distance': 0, 'lift': 0}}
    support, angle, step, phase = 'both', 0, -1, '대기'
    if local < REST_FRAMES:
        distance = 0
    elif local < REST_FRAMES + STEP_FRAMES * STEPS:
        clock = local - REST_FRAMES
        step, part = clock // STEP_FRAMES, clock % STEP_FRAMES / STEP_FRAMES
        swing = 'right' if step % 2 == 0 else 'left'
        support = 'left' if swing == 'right' else 'right'
        progress = smooth((part - .16) / .72)
        previous = (step - 1) * STRIDE if step >= 2 else 0
        target = (step + 1) * STRIDE
        controls[swing] = {'distance': previous + (target - previous) * progress, 'lift': 3.8 * math.sin(math.pi * progress)}
        controls[support] = {'distance': step * STRIDE if step > 0 else 0, 'lift': 0}
        distance = .5 * STRIDE * smooth(part) if step == 0 else (step - .5) * STRIDE + STRIDE * smooth(part)
        angle = (1 if support == 'left' else -1) * 3.6 * math.sin(math.pi * part)
        phase = '왼발 지지' if support == 'left' else '오른발 지지'
    elif local < REST_FRAMES + STEP_FRAMES * STEPS + SETTLE_FRAMES:
        clock = local - REST_FRAMES - STEP_FRAMES * STEPS
        distance = TRAVEL
        previous = {'right': (STEPS - 1) * STRIDE, 'left': STEPS * STRIDE}
        if clock < SETTLE_FRAMES / 2:
            progress = smooth(clock / (SETTLE_FRAMES / 2))
            controls['right']['distance'] = previous['right'] + (TRAVEL - previous['right']) * progress
            controls['right']['lift'] = 1.8 * math.sin(math.pi * progress)
            controls['left']['distance'] = previous['left']
            support = 'left'
        else:
            progress = smooth((clock - SETTLE_FRAMES / 2) / (SETTLE_FRAMES / 2))
            controls['right']['distance'] = TRAVEL
            controls['left']['distance'] = previous['left'] + (TRAVEL - previous['left']) * progress
            controls['left']['lift'] = 1.8 * math.sin(math.pi * progress)
            support = 'right'
        angle = (1 if support == 'left' else -1) * 1.1 * math.sin(math.pi * progress)
        phase = '발 모으기'
    else:
        distance = TRAVEL
        for foot in controls.values():
            foot['distance'] = TRAVEL
    return {'bout': bout, 'distance': distance, 'feet': controls, 'support': support, 'angle': angle, 'step': step, 'phase': phase}

def direction(panel, bout):
    if panel == 0:
        return (1, 0) if bout == 0 else (-1, 0)
    return (0, -1) if bout == 0 else (0, 1)

def root_position(panel, state):
    start = (157, 344) if panel == 0 else (532, 344)
    initial = direction(panel, 0)
    origin = (start[0] + initial[0] * TRAVEL * state['bout'], start[1] + initial[1] * TRAVEL * state['bout'])
    dx, dy = direction(panel, state['bout'])
    return origin[0] + dx * state['distance'], origin[1] + dy * state['distance']

def rotate_point(point, pivot, angle):
    radians = math.radians(angle)
    cosine, sine = math.cos(radians), math.sin(radians)
    x, y = point[0] - pivot[0], point[1] - pivot[1]
    return pivot[0] + cosine * x + sine * y, pivot[1] - sine * x + cosine * y

def unit_pose(panel, state):
    dx, dy = direction(panel, state['bout'])
    foot_positions = {}
    for side, foot in state['feet'].items():
        relative = foot['distance'] - state['distance']
        foot_positions[side] = [FOOT_CENTERS[side] + dx * relative / SCALE, 448 + dy * relative / SCALE - foot['lift'] / SCALE]
    support = state['support']
    pivot = foot_positions[support] if support != 'both' else [256, 448]
    pivot_padded = (pivot[0] + PAD, pivot[1] + PAD)
    body = BODY_PADDED.rotate(state['angle'], Image.Resampling.BICUBIC, False, pivot_padded)
    unit = Image.new('RGBA', (640, 640), (0, 0, 0, 0))
    leg_mask = Image.new('L', (640, 640), 0)
    ld = ImageDraw.Draw(leg_mask)
    for side, position in foot_positions.items():
        hip = rotate_point([FOOT_CENTERS[side], 423], pivot, state['angle'])
        ankle = [position[0], position[1] - 23]
        ld.line([(round(hip[0] + PAD), round(hip[1] + PAD)), (round(ankle[0] + PAD), round(ankle[1] + PAD))], 255, 10)
    leg = MATERIAL.resize((640, 640), Image.Resampling.LANCZOS)
    leg.putalpha(leg_mask)
    unit.alpha_composite(leg)
    rear, front = [], []
    for side, position in foot_positions.items():
        crop, bounds = FEET_CROPS[side]
        shift = (round(PAD + bounds[0] + position[0] - FOOT_CENTERS[side]), round(PAD + bounds[1] + position[1] - 448))
        item = (crop, shift)
        ground_relative = (state['feet'][side]['distance'] - state['distance']) * dy
        (rear if ground_relative < -.5 else front).append(item)
    for crop, shift in rear:
        unit.alpha_composite(crop, shift)
    unit.alpha_composite(body)
    for crop, shift in front:
        unit.alpha_composite(crop, shift)
    return unit, foot_positions

background = Image.new('RGBA', (WIDTH, HEIGHT), (236, 231, 216, 255))
draw = ImageDraw.Draw(background)
draw.text((28, 18), '몽돌 · 작은 두 발로 뒤뚱걸음', (53, 58, 47, 255), FONT)
draw.text((28, 54), '원래 몸과 발 유지 · 한 발씩 디디고 체중 옮기기', (102, 107, 88, 255), SMALL)
for panel in range(2):
    left = 22 + panel * 346
    draw.rounded_rectangle((left, 92, left + 330, 428), 18, (219, 218, 195, 255))
    draw.text((left + 17, 108), ['좌우 이동', '상하 이동'][panel], (76, 83, 64, 255), LABEL)
    for x in range(left + 20, left + 320, 24):
        for y in range(154, 416, 24):
            draw.ellipse((x - 1, y - 1, x + 1, y + 1), (202, 202, 176, 255))
draw.text((28, 448), '꾹… 딛. 꾹… 딛.   ·   발이 딛는 방향을 실제 이동 방향에 맞춤', (91, 96, 78, 255), SMALL)
shadow = Image.new('RGBA', (124, 16), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((7, 4, 117, 12), (43, 47, 33, 65))
shadow = shadow.filter(ImageFilter.GaussianBlur(1.6))
frames = TEMP / 'frames'
frames.mkdir(0o777, True, True)
native_frames = TEMP / 'native-frames'
native_frames.mkdir(0o777, True, True)
key_frames = [0, 11, 13, 16, 21, 23, 111, 113]
keys, timeline = [], []
for frame in range(FRAME_COUNT):
    state = gait(frame)
    scene = background.copy()
    captures = []
    for panel in range(2):
        root_x, root_y = root_position(panel, state)
        unit, feet = unit_pose(panel, state)
        scene.alpha_composite(shadow, (round(root_x - 62), round(root_y - 8)))
        foot_shadows = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
        sd = ImageDraw.Draw(foot_shadows)
        world_feet = {}
        dx, dy = direction(panel, state['bout'])
        for side, foot in state['feet'].items():
            relative = foot['distance'] - state['distance']
            contact_x = root_x + (FOOT_CENTERS[side] - 256) * SCALE + dx * relative
            contact_y = root_y + dy * relative
            sd.ellipse((contact_x - 10, contact_y - 1.5, contact_x + 10, contact_y + 1.5), (48, 53, 36, round(65 - foot['lift'] * 7)))
            world_feet[side] = {'ground': [contact_x, contact_y], 'lift': foot['lift']}
        scene.alpha_composite(foot_shadows)
        unit = unit.resize((round(640 * SCALE), round(640 * SCALE)), Image.Resampling.LANCZOS)
        scene.alpha_composite(unit, (round(root_x - (256 + PAD) * SCALE), round(root_y - (448 + PAD) * SCALE)))
        label = ['오른쪽', '위쪽'][panel] if state['bout'] == 0 else ['왼쪽', '아래쪽'][panel]
        d = ImageDraw.Draw(scene)
        d.text((45 + panel * 346, 390), label + ' · ' + state['phase'], (96, 103, 83, 255), SMALL)
        captures.append({'panel': panel, 'root': [root_x, root_y], 'feet': world_feet})
    scene.convert('RGB').save(frames / ('frame-' + str(frame).zfill(3) + '.png'))
    scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS).save(native_frames / ('frame-' + str(frame).zfill(3) + '.png'))
    if frame in key_frames:
        keys.append(scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS))
    timeline.append({'frame': frame, 'state': state, 'panels': captures})
contact = Image.new('RGB', (1440, 480), (236, 231, 216))
for index, image in enumerate(keys[:8]):
    contact.paste(image, (index % 4 * 360, index // 4 * 240))
contact.save(TEMP / 'keyposes.png')
rig = {
    'designAuthority': 'DesignAssets/Tribes/pebble/starter.png',
    'sourceCanvas': [512,512],
    'renderCanvas': [640,640],
    'groundPivot': [256,448],
    'bones': [{'name':'root','parent':None},{'name':'stone','parent':'root','pivot':'current support foot ground contact'},{'name':'left-ankle','parent':'root','originalX':159.5},{'name':'right-ankle','parent':'root','originalX':352}],
    'attachments': {'body':'source/body-complete.png','leftFoot':'source/foot-left.png','rightFoot':'source/foot-right.png'},
    'hiddenArtwork': 'Only opaque areas originally covered by the original feet receive completed lower-body surfaces; short concealed ankle surfaces use the existing generated ochre material.',
    'materialSource': 'Existing built-in image_gen material from PebbleFragmentsV3; reused only for concealed lower-body and ankle surfaces, never as a new design reference.',
    'rig': {'rigidBody':True,'squash':False,'footRotation':0,'bodyLeanDegrees':3.6,'footLiftPxAtPreviewScale':3.8,'sameOriginalFootArtAllDirections':True,'footPlacement':'world-space stance anchors and swing targets follow actual movement vector','stance':'one foot always on ground; double support around contacts'},
    'timing': {'fps':FPS,'stepFrames':STEP_FRAMES,'stepsPerDirection':STEPS,'stridePx':STRIDE,'frameCount':FRAME_COUNT,'durationMs':round(FRAME_COUNT/FPS*1000)},
    'panels':['right then left','up then down'],
    'scope':'concept GIF and editable rig only'
}
(ROOT / 'rig.json').write_bytes((json.dumps(rig) + '\r\n').encode('utf-8'))
(ROOT / 'timeline.json').write_bytes((json.dumps(timeline) + '\r\n').encode('utf-8'))
print(json.dumps({'frames':FRAME_COUNT,'fps':FPS,'durationMs':round(FRAME_COUNT/FPS*1000),'travelPx':TRAVEL}))
