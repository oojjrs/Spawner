import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops, ImageEnhance

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parents[1] / '$Trash' / 'pebble-fragments-v3'
PARTS = ROOT / 'source' / 'parts'
WIDTH, HEIGHT, FPS = 720, 480, 25
SCALE, PAD = .32, 64
POINTS = [(186, 390), (534, 390), (534, 220), (186, 220), (186, 390)]
MOVE_FRAMES = [44, 22, 44, 22]
REST, OPEN, CLOSE, HOLD = 6 / FPS, 8 / FPS, 8 / FPS, 8 / FPS
STARTS = [0]
for frame_count in MOVE_FRAMES[:-1]:
    STARTS.append(STARTS[-1] + REST + OPEN + frame_count / FPS + CLOSE + HOLD)
FRAME_COUNT = sum(MOVE_FRAMES) + 4 * 30
TOTAL = FRAME_COUNT / FPS
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
NEUTRAL = Image.open(ROOT / 'source' / 'neutral.png').convert('RGBA')
ALPHA = NEUTRAL.getchannel('A')
MATERIAL = Image.open(ROOT / 'source' / 'fracture-material.png').convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS)
MATERIAL = ImageEnhance.Brightness(MATERIAL).enhance(.64)
NAMES = ['crown', 'left', 'right', 'lower', 'face']
core_mask = Image.new('L', (512, 512), 0)
ImageDraw.Draw(core_mask).polygon([(146, 272), (209, 249), (302, 260), (365, 256), (391, 329), (347, 413), (163, 413), (118, 330)], 255)
crown_mask = Image.new('L', (512, 512), 0)
ImageDraw.Draw(crown_mask).polygon([(0, 0), (512, 0), (512, 250), (365, 256), (302, 260), (209, 249), (146, 272), (0, 290)], 255)
core_pixels, crown_pixels = core_mask.load(), crown_mask.load()
owners = []
for y in range(512):
    for x in range(512):
        if core_pixels[x, y]:
            owner = 'face'
        elif crown_pixels[x, y]:
            owner = 'crown'
        elif y < 413 or x < 205 or x > 301:
            owner = 'left' if x < 256 else 'right'
        else:
            owner = 'lower'
        owners.append(owner)

ATTACHMENTS = {}
assembly = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
for name in NAMES:
    mask = Image.new('L', (512, 512), 0)
    mask.putdata([255 if owner == name else 0 for owner in owners])
    alpha = ImageChops.multiply(ALPHA, mask)
    front = NEUTRAL.copy()
    front.putalpha(alpha)
    front.save(PARTS / (name + '-front.png'))
    assembly.alpha_composite(front)
    edge_alpha = Image.new('L', (512, 512), 0)
    for depth in range(1, 6):
        shifted = alpha.transform((512, 512), Image.Transform.AFFINE, (1, 0, -depth * .3, 0, 1, -depth), Image.Resampling.BICUBIC)
        edge_alpha = ImageChops.lighter(edge_alpha, shifted)
    edge_alpha = ImageChops.multiply(edge_alpha, ALPHA)
    edge = MATERIAL.copy()
    edge.putalpha(edge_alpha)
    edge.save(PARTS / (name + '-edge.png'))
    union = ImageChops.lighter(alpha, edge_alpha).getbbox()
    crop = (union[0] - 3, union[1] - 3, union[2] + 3, union[3] + 3)
    center = [(crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2]
    ATTACHMENTS[name] = {'front': front.crop(crop), 'edge': edge.crop(crop), 'center': center, 'bounds': list(crop)}
assembly.save(ROOT / 'source' / 'reassembled-neutral.png')

def smooth(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)

def state(time):
    time %= TOTAL
    segment = max(index for index, start in enumerate(STARTS) if time >= start)
    local = time - STARTS[segment]
    duration = MOVE_FRAMES[segment] / FPS
    move_time = max(0, min(duration, local - REST - OPEN))
    ramp = .18
    distance = duration - ramp
    if move_time < ramp:
        covered = (move_time / 2 - ramp * math.sin(math.pi * move_time / ramp) / (2 * math.pi)) / distance
    elif move_time < duration - ramp:
        covered = (move_time - ramp / 2) / distance
    else:
        remaining = duration - move_time
        covered = 1 - (remaining / 2 - ramp * math.sin(math.pi * remaining / ramp) / (2 * math.pi)) / distance
    covered = max(0, min(1, covered))
    start, end = POINTS[segment], POINTS[segment + 1]
    x = start[0] + (end[0] - start[0]) * covered
    y = start[1] + (end[1] - start[1]) * covered
    if local < REST:
        spread, phase = 0, '대기'
    elif local < REST + OPEN:
        spread, phase = smooth((local - REST) / OPEN), '풀림'
    elif local < REST + OPEN + duration:
        spread, phase = 1, '이동'
    elif local < REST + OPEN + duration + CLOSE:
        spread, phase = 1 - smooth((local - REST - OPEN - duration) / CLOSE), '뭉침'
    else:
        spread, phase = 0, '대기'
    return x, y, spread, phase, segment, local

OFFSETS = {'crown': (0, -22), 'left': (-26, 8), 'right': (26, 8), 'lower': (0, 16), 'face': (0, 0)}
DELAYS = {'crown': .025, 'left': .065, 'right': .09, 'lower': .05, 'face': 0}

def pose(time):
    x, y, spread, phase, segment, local = state(time)
    unit = Image.new('RGBA', (640, 640), (0, 0, 0, 0))
    controls = {}
    if spread < .000001:
        unit.alpha_composite(NEUTRAL, (PAD, PAD))
        return unit, controls
    layers = []
    for index, name in enumerate(NAMES):
        attachment = ATTACHMENTS[name]
        lag_x, lag_y = state(time - DELAYS[name])[:2]
        if name == 'face':
            tx, ty, angle = 0, 0, 0
        else:
            tick = local - REST
            tx = spread * (OFFSETS[name][0] + 3 * math.sin(tick * math.pi * (4.4 + index * .31) + index) + (lag_x - x) / SCALE)
            ty = spread * (OFFSETS[name][1] + 3.8 * math.sin(tick * math.pi * (5.2 + index * .27) + index * 2) + (lag_y - y) / SCALE)
            angle = spread * 1.35 * math.sin(tick * math.pi * (4.1 + index * .22) + index)
        controls[name] = {'translation': [tx, ty], 'angleDegrees': angle}
        center = attachment['center']
        front = attachment['front'].rotate(angle, Image.Resampling.BICUBIC, True)
        edge = attachment['edge'].rotate(angle, Image.Resampling.BICUBIC, True)
        edge.putalpha(edge.getchannel('A').point(lambda value: round(value * spread)))
        position = (round(PAD + center[0] + tx - front.width / 2), round(PAD + center[1] + ty - front.height / 2))
        layers.append((front, edge, position))
    for front, edge, position in layers:
        unit.alpha_composite(edge, position)
    for front, edge, position in layers:
        unit.alpha_composite(front, position)
    return unit, controls

background = Image.new('RGBA', (WIDTH, HEIGHT), (236, 231, 216, 255))
draw = ImageDraw.Draw(background)
draw.rounded_rectangle((22, 90, 698, 428), 18, (219, 218, 195, 255))
draw.text((30, 19), '몽돌 · 느슨한 자갈 무리 시안', (53, 58, 47, 255), FONT)
draw.text((30, 54), '오른쪽 → 위 → 왼쪽 → 아래 · 얼굴과 표면은 원본 유지', (102, 107, 88, 255), SMALL)
draw.text((30, 446), '이동할 때만 조각 분리 · 정지하면 원래 모습', (91, 96, 78, 255), SMALL)
for xx in range(50, 690, 32):
    for yy in range(112, 420, 32):
        draw.ellipse((xx - 1, yy - 1, xx + 1, yy + 1), (202, 202, 176, 255))
draw.line(POINTS, (194, 194, 167, 255), 2)
for xx, yy in POINTS[:4]:
    draw.ellipse((xx - 4, yy - 3, xx + 4, yy + 3), (188, 189, 163, 255))
shadow = Image.new('RGBA', (130, 20), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((6, 5, 124, 16), (43, 47, 33, 62))
shadow = shadow.filter(ImageFilter.GaussianBlur(2))
frames = TEMP / 'frames'
frames.mkdir(0o777, True, True)
native_frames = TEMP / 'native-frames'
native_frames.mkdir(0o777, True, True)
key_times = [0, .4, .88, 2.4, 2.8, 3.76, 6.08, 8.96]
key_images, timeline = [], []
for index in range(FRAME_COUNT):
    time = index / FPS
    x, y, spread, phase, segment, local = state(time)
    unit, controls = pose(time)
    scene = background.copy()
    scene.alpha_composite(shadow, (round(x - 65), round(y - 10)))
    unit = unit.resize((round(640 * SCALE), round(640 * SCALE)), Image.Resampling.LANCZOS)
    scene.alpha_composite(unit, (round(x - (256 + PAD) * SCALE), round(y - (448 + PAD) * SCALE)))
    label = ['오른쪽', '위쪽', '왼쪽', '아래쪽'][segment] + ' · ' + phase
    sd = ImageDraw.Draw(scene)
    sd.rounded_rectangle((540, 20, 697, 67), 10, (222, 219, 199, 255))
    sd.text((550, 33), label, (84, 91, 69, 255), SMALL)
    scene.convert('RGB').save(frames / ('frame-' + str(index).zfill(3) + '.png'))
    scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS).save(native_frames / ('frame-' + str(index).zfill(3) + '.png'))
    if any(abs(time - target) < .5 / FPS for target in key_times):
        key_images.append(scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS))
    timeline.append({'frame': index, 'root': [x, y], 'spread': spread, 'phase': phase, 'bones': controls})
contact = Image.new('RGB', (1440, 480), (236, 231, 216))
for index, image in enumerate(key_images[:8]):
    contact.paste(image, (index % 4 * 360, index // 4 * 240))
contact.save(TEMP / 'keyposes.png')
rig = {
    'designAuthority': 'DesignAssets/Tribes/pebble/starter.png',
    'neutral': 'source/neutral.png',
    'originalFrontPixelsPreserved': True,
    'sourceCanvas': [512, 512],
    'renderCanvas': [640, 640],
    'padding': PAD,
    'groundPivot': [256, 448],
    'face': 'both eyes remain in the single fixed original face attachment; no rotation or scaling',
    'bones': [{'name': name, 'parent': 'root', 'pivot': ATTACHMENTS[name]['center'], 'front': 'source/parts/' + name + '-front.png', 'exposedInterior': 'source/parts/' + name + '-edge.png'} for name in NAMES],
    'drawOrder': ['all generated fracture sides', 'crown', 'left', 'right', 'lower', 'face'],
    'rotation': 'bounded articulation of +/- 1.35 degrees in loose fragments, no rolling or spinning',
    'timeMs': {'neutralBefore': 240, 'separate': 320, 'gather': 320, 'neutralAfter': 320},
    'preview': {'size': [WIDTH, HEIGHT], 'fps': FPS, 'frames': FRAME_COUNT, 'durationMs': round(TOTAL * 1000), 'path': POINTS},
    'materialGenerator': 'built-in image_gen; fracture-material.png is mapped to actual exposed side attachments',
    'scope': 'temporary movement-form concept; all original silhouette and front pixels return at rest'
}
(ROOT / 'rig.json').write_bytes((json.dumps(rig) + '\r\n').encode('utf-8'))
(ROOT / 'timeline.json').write_bytes((json.dumps(timeline) + '\r\n').encode('utf-8'))
print(json.dumps({'frames': FRAME_COUNT, 'fps': FPS, 'durationMs': round(TOTAL * 1000), 'parts': NAMES}))
