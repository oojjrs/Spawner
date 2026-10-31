import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parents[1] / '$Trash' / 'pebble-slide-v2'
WIDTH, HEIGHT = 720, 480
FPS = 25
SCALE = .32
POINTS = [(186, 390), (534, 390), (534, 220), (186, 220), (186, 390)]
MOVE_FRAMES = [56, 30, 56, 30]
HOLD_FRAMES = 10
FRAME_COUNT = sum(MOVE_FRAMES) + 4 * HOLD_FRAMES
TOTAL = FRAME_COUNT / FPS
SEGMENT_STARTS = [0]
for count in MOVE_FRAMES[:-1]:
    SEGMENT_STARTS.append(SEGMENT_STARTS[-1] + (count + HOLD_FRAMES) / FPS)
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
NEUTRAL = Image.open(ROOT / 'source' / 'neutral.png').convert('RGBA')
UNIT = NEUTRAL.resize((round(512 * SCALE), round(512 * SCALE)), Image.Resampling.LANCZOS)
PIVOT = (256 * SCALE, 448 * SCALE)
RIG = {
    'reference': 'DesignAssets/Tribes/pebble/starter.png',
    'attachment': 'source/neutral.png',
    'sourceCanvas': [512, 512],
    'groundPivot': [256, 448],
    'bones': [{'name': 'root', 'parent': None}, {'name': 'stone', 'parent': 'root'}],
    'motion': {
        'rotationDegrees': 0,
        'scale': 1,
        'verticalBobPx': 0,
        'movingParts': [],
        'rootTremorPxAtPreviewSize': .55,
        'rootTremorAxes': 'screen x only; same oscillator for all travel directions',
        'rootTremorHz': [8, 11],
        'contact': 'original foot baseline continuously follows ground; no lift',
        'accelerationMs': 180,
        'holdMs': 400
    },
    'effects': {
        'dust': 'deterministic procedural particles emitted at ground contacts; world-space lifetime',
        'dustDirection': 'opposite current root velocity; footprint width remains unchanged',
        'drawOrder': ['floor', 'dust', 'contact-shadow', 'stone']
    },
    'preview': {
        'size': [WIDTH, HEIGHT],
        'fps': FPS,
        'frames': FRAME_COUNT,
        'durationMs': round(TOTAL * 1000),
        'path': POINTS,
        'moveFramesPerSegment': MOVE_FRAMES,
        'holdFramesPerSegment': HOLD_FRAMES,
        'sameAttachmentForAllDirections': True
    },
    'source': 'preserved high-resolution neutral artwork before project image-size reduction',
    'artworkGeneration': 'none; original body and feet preserved together',
    'scope': 'GIF concept and editable source only'
}
(ROOT / 'rig.json').write_bytes((json.dumps(RIG, ensure_ascii=False, indent=2) + '\n').replace('\n', '\r\n').encode('utf-8'))

def motion(time):
    time %= TOTAL
    segment = max(index for index, start in enumerate(SEGMENT_STARTS) if time >= start)
    local = time - SEGMENT_STARTS[segment]
    duration = MOVE_FRAMES[segment] / FPS
    t = min(duration, local)
    ramp = .18
    distance = duration - ramp
    if t < ramp:
        covered = (t / 2 - ramp * math.sin(math.pi * t / ramp) / (2 * math.pi)) / distance
        velocity = (.5 - .5 * math.cos(math.pi * t / ramp)) / distance
    elif t < duration - ramp:
        covered = (t - ramp / 2) / distance
        velocity = 1 / distance
    else:
        remaining = duration - t
        covered = 1 - (remaining / 2 - ramp * math.sin(math.pi * remaining / ramp) / (2 * math.pi)) / distance
        velocity = (.5 - .5 * math.cos(math.pi * remaining / ramp)) / distance
    if local >= duration:
        covered, velocity = 1, 0
    start, end = POINTS[segment], POINTS[segment + 1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    x = start[0] + dx * covered
    y = start[1] + dy * covered
    vx, vy = dx * velocity, dy * velocity
    return x, y, vx, vy, segment, local

RANDOM = random.Random(824)
PARTICLES = []
for step in range(math.ceil(TOTAL / .055)):
    emission = step * .055
    x, y, vx, vy, segment, local = motion(emission)
    speed = math.hypot(vx, vy)
    if speed < 35:
        continue
    direction_x, direction_y = vx / speed, vy / speed
    for side in [-1, 1]:
        offset = side * 27 + RANDOM.uniform(-5, 5)
        origin_x = x + offset - direction_x * 5
        origin_y = y - .7 - direction_y * 2.5
        lifetime = RANDOM.uniform(.38, .64)
        drift_x = -direction_x * RANDOM.uniform(7, 15) + RANDOM.uniform(-3, 3)
        drift_y = -direction_y * RANDOM.uniform(5, 10) + RANDOM.uniform(-2, 2)
        PARTICLES.append((emission, origin_x, origin_y, lifetime, drift_x, drift_y, RANDOM.uniform(.9, 2.3), RANDOM.randrange(90, 145)))

background = Image.new('RGBA', (WIDTH, HEIGHT), (236, 231, 216, 255))
draw = ImageDraw.Draw(background)
draw.rounded_rectangle((22, 90, 698, 428), 18, (219, 218, 195, 255))
draw.text((30, 19), '몽돌 · 접지 슬라이드 시안', (53, 58, 47, 255), FONT)
draw.text((30, 54), '오른쪽 → 위 → 왼쪽 → 아래 · 같은 동작', (102, 107, 88, 255), SMALL)
draw.text((30, 446), '원래 모습 그대로 · 미세한 진동과 바닥 마찰', (91, 96, 78, 255), SMALL)
for xx in range(50, 690, 32):
    for yy in range(112, 420, 32):
        draw.ellipse((xx - 1, yy - 1, xx + 1, yy + 1), (202, 202, 176, 255))
draw.line(POINTS, (194, 194, 167, 255), 2)
for xx, yy in POINTS[:4]:
    draw.ellipse((xx - 4, yy - 3, xx + 4, yy + 3), (188, 189, 163, 255))

shadow = Image.new('RGBA', (116, 16), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((7, 4, 109, 12), (43, 47, 33, 80))
shadow = shadow.filter(ImageFilter.GaussianBlur(1.4))
frames = TEMP / 'frames'
frames.mkdir(0o777, True, True)
native_frames = TEMP / 'native-frames'
native_frames.mkdir(0o777, True, True)
key_times = [0, .52, 1.16, 2.32, 3.2, 4.8, 6.2, 7.6]
key_images = []
timeline = []
for index in range(FRAME_COUNT):
    time = index / FPS
    x, y, vx, vy, segment, local = motion(time)
    speed = math.hypot(vx, vy)
    amplitude = min(1, speed / 150)
    tremor = amplitude * (.38 * math.sin(2 * math.pi * 8 * time) + .17 * math.sin(2 * math.pi * 11 * time + .6))
    timeline.append({'frame': index, 'root': [x, y], 'tremorX': tremor, 'angle': 0, 'lift': 0})
    scene = background.copy()
    dust = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust)
    for emission, origin_x, origin_y, lifetime, drift_x, drift_y, radius, opacity in PARTICLES:
        age = (time - emission) % TOTAL
        if age >= lifetime:
            continue
        progress = age / lifetime
        px = origin_x + drift_x * age
        py = origin_y + drift_y * age
        r = radius * (1 + progress * .35)
        alpha = round(opacity * (1 - progress) ** 1.3)
        dd.ellipse((px - r, py - r * .48, px + r, py + r * .48), (139, 124, 84, alpha))
    scene.alpha_composite(dust)
    scene.alpha_composite(shadow, (round(x - 58), round(y - 8)))
    unit = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    unit.alpha_composite(UNIT, (round(x - PIVOT[0]), round(y - PIVOT[1])))
    if tremor:
        unit = unit.transform((WIDTH, HEIGHT), Image.Transform.AFFINE, (1, 0, -tremor, 0, 1, 0), Image.Resampling.BICUBIC)
    scene.alpha_composite(unit)
    label = ['오른쪽', '위쪽', '왼쪽', '아래쪽'][segment]
    if speed < .01:
        label += ' · 정지'
    sd = ImageDraw.Draw(scene)
    sd.rounded_rectangle((555, 20, 690, 67), 10, (222, 219, 199, 255))
    sd.text((568, 33), label, (84, 91, 69, 255), SMALL)
    scene.convert('RGB').save(frames / ('frame-' + str(index).zfill(3) + '.png'))
    scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS).save(native_frames / ('frame-' + str(index).zfill(3) + '.png'))
    if any(abs(time - target) < .5 / FPS for target in key_times):
        key_images.append(scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS))
contact = Image.new('RGB', (1440, 480), (236, 231, 216))
for index, image in enumerate(key_images[:8]):
    contact.paste(image, (index % 4 * 360, index // 4 * 240))
contact.save(TEMP / 'keyposes.png')
(ROOT / 'timeline.json').write_bytes((json.dumps(timeline, ensure_ascii=False, separators=(',', ':')) + '\n').replace('\n', '\r\n').encode('utf-8'))
print(json.dumps({'frames': FRAME_COUNT, 'fps': FPS, 'durationMs': round(TOTAL * 1000), 'size': [WIDTH, HEIGHT]}))
