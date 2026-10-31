import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parents[1] / '$Trash' / 'pebble-rollers-v1'
SOURCE = ROOT / 'source'
WIDTH, HEIGHT = 720, 480
FPS = 25
SEGMENT = 2.32
TOTAL = SEGMENT * 4
FRAME_COUNT = round(TOTAL * FPS)
FONT = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 22)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 15)
BODY = Image.open(SOURCE / 'body.png').convert('RGBA')
GENERATED = Image.open(SOURCE / 'rollers-source.png').convert('RGBA')
STONE_SIZE = [66, 58, 64]
STONES = []
for index in range(3):
    cell = GENERATED.crop((index * GENERATED.width // 3, 0, (index + 1) * GENERATED.width // 3, GENERATED.height))
    cell = cell.crop(cell.getchannel('A').getbbox())
    cell.save(SOURCE / ('roller-' + str(index + 1) + '.png'))
    cell.thumbnail((STONE_SIZE[index], STONE_SIZE[index]), Image.Resampling.LANCZOS)
    STONES.append(cell)

RIG = {
    'reference': 'DesignAssets/Tribes/pebble/BaseParts/body.png',
    'bodySource': 'source/body.png',
    'sourceCanvas': [512, 512],
    'groundPivot': [256, 480],
    'bodyPivot': [256, 339],
    'bodyType': 'rigid attachment; no scaling or squash',
    'bones': [
        {'name': 'root', 'parent': None},
        {'name': 'body', 'parent': 'root', 'pivot': [256, 339]},
        {'name': 'roller-1', 'parent': 'root', 'centerX': 159},
        {'name': 'roller-2', 'parent': 'root', 'centerX': 256},
        {'name': 'roller-3', 'parent': 'root', 'centerX': 352}
    ],
    'rollerAttachments': ['source/roller-1.png', 'source/roller-2.png', 'source/roller-3.png'],
    'drawOrder': ['shadow', 'roller-1', 'roller-2', 'roller-3', 'body'],
    'rollerContactY': 480,
    'rollerPhaseDegrees': [0, 113, 237],
    'rollerCycleMs': 720,
    'bodyStartLag': '0.75 degrees rigid tilt at acceleration; face remains camera-facing',
    'preview': {'size': [WIDTH, HEIGHT], 'fps': FPS, 'frameCount': FRAME_COUNT, 'rootMotion': True},
    'path': [[186, 390], [534, 390], [534, 220], [186, 220], [186, 390]],
    'segmentMs': 2320,
    'moveMs': 1840,
    'stopMs': 480,
    'interpolation': 'constant speed center with sine acceleration and deceleration',
    'generatedPartPrompt': 'Three complete separate rounded ochre sandstone roller attachments matching the original pebble body; transparent alpha, no face, full closed silhouettes.',
    'generator': 'built-in image_gen; generated source parts are actually used in this rig',
    'installation': 'concept only; no runtime or project asset replacement'
}
(ROOT / 'rig.json').write_bytes((json.dumps(RIG, ensure_ascii=False, indent=2) + '\n').replace('\n', '\r\n').encode('utf-8'))

def motion(time):
    segment = min(3, int(time / SEGMENT))
    local = time - segment * SEGMENT
    duration = 1.84
    ramp = .28
    t = min(duration, local)
    distance = duration - ramp
    if t < ramp:
        covered = (t / 2 - ramp * math.sin(math.pi * t / ramp) / (2 * math.pi)) / distance
        speed = (.5 - .5 * math.cos(math.pi * t / ramp)) / distance
    elif t < duration - ramp:
        covered = (t - ramp / 2) / distance
        speed = 1 / distance
    else:
        remaining = duration - t
        covered = 1 - (remaining / 2 - ramp * math.sin(math.pi * remaining / ramp) / (2 * math.pi)) / distance
        speed = (.5 - .5 * math.cos(math.pi * remaining / ramp)) / distance
    points = RIG['path']
    start, end = points[segment], points[segment + 1]
    x = start[0] + (end[0] - start[0]) * covered
    y = start[1] + (end[1] - start[1]) * covered
    return x, y, end[0] - start[0], end[1] - start[1], speed, segment, local, covered

def pose(time):
    x, y, dx, dy, speed, segment, local, covered = motion(time)
    pose_image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    movement_time = segment * 1.84 + min(1.84, local)
    for index, stone in enumerate(STONES):
        angle = movement_time / .72 * 360 + RIG['rollerPhaseDegrees'][index]
        rotated = stone.rotate(-angle, Image.Resampling.BICUBIC, True)
        bounds = rotated.getchannel('A').getbbox()
        center_x = RIG['bones'][index + 2]['centerX']
        px = round(center_x - (bounds[0] + bounds[2]) / 2)
        py = round(480 - bounds[3])
        pose_image.alpha_composite(rotated, (px, py))
    tilt = .75 * math.sin(min(1, local / .38) * math.pi) if local < .38 else 0
    if local > 1.62 and local < 2.08:
        tilt = -.6 * math.sin((local - 1.62) / .46 * math.pi)
    tilt *= 1 if dx >= 0 else -1
    body = BODY.rotate(tilt, Image.Resampling.BICUBIC, False, (256, 339))
    pose_image.alpha_composite(body)
    return pose_image

background = Image.new('RGBA', (WIDTH, HEIGHT), (236, 231, 216, 255))
draw = ImageDraw.Draw(background)
draw.rounded_rectangle((22, 90, 698, 428), 18, (219, 218, 195, 255))
draw.text((30, 19), '몽돌 · 자갈 구동 이동 시안', (53, 58, 47, 255), FONT)
draw.text((30, 54), '같은 자세로 오른쪽 → 위 → 왼쪽 → 아래 이동', (102, 107, 88, 255), SMALL)
draw.text((30, 446), '본체는 단단하게 유지 · 밑의 자갈만 회전', (91, 96, 78, 255), SMALL)
for xx in range(50, 690, 32):
    for yy in range(112, 420, 32):
        draw.ellipse((xx - 1, yy - 1, xx + 1, yy + 1), (202, 202, 176, 255))
path = RIG['path']
draw.line([tuple(item) for item in path], (194, 194, 167, 255), 2)
for xx, yy in path[:4]:
    draw.ellipse((xx - 4, yy - 3, xx + 4, yy + 3), (188, 189, 163, 255))

shadow = Image.new('RGBA', (180, 36), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse((12, 7, 168, 29), (55, 57, 43, 48))
shadow = shadow.filter(ImageFilter.GaussianBlur(4))
native_frames = TEMP / 'native-frames'
native_frames.mkdir(0o777, True, True)
frames = TEMP / 'frames'
frames.mkdir(0o777, True, True)
key_times = [0, .2, .7, 1.65, 1.95, 2.32, 4.64, 6.96]
keys = []
for index in range(FRAME_COUNT):
    time = index / FPS
    x, y, dx, dy, speed, segment, local, covered = motion(time)
    unit = pose(time)
    scene = background.copy()
    scene.alpha_composite(shadow, (round(x - 90), round(y - 18)))
    dust = Image.new('RGBA', scene.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(dust)
    if speed > .12:
        length = math.hypot(dx, dy)
        vx, vy = dx / length, dy / length
        for particle in range(5):
            phase = (time * 2.8 + particle / 5) % 1
            offset = 22 + phase * 32
            px = x - vx * offset + math.sin(particle * 7) * 9
            py = y - vy * offset + math.cos(particle * 5) * 3
            radius = 1 + phase * 1.6
            dd.ellipse((px - radius, py - radius / 2, px + radius, py + radius / 2), (156, 143, 107, round((1 - phase) * 70)))
    scene.alpha_composite(dust)
    scale = .32
    unit = unit.resize((round(512 * scale), round(512 * scale)), Image.Resampling.LANCZOS)
    scene.alpha_composite(unit, (round(x - 256 * scale), round(y - 480 * scale)))
    label = ['오른쪽', '위쪽', '왼쪽', '아래쪽'][segment]
    if local >= 1.84:
        label += ' · 정지'
    d = ImageDraw.Draw(scene)
    d.rounded_rectangle((555, 20, 690, 67), 10, (222, 219, 199, 255))
    d.text((568, 33), label, (84, 91, 69, 255), SMALL)
    scene.convert('RGB').save(frames / ('frame-' + str(index).zfill(3) + '.png'))
    if any(abs(time - target) < .5 / FPS for target in key_times):
        keys.append(scene.convert('RGB').resize((360, 240), Image.Resampling.LANCZOS))
    native = Image.new('RGB', (240, 176), (219, 218, 195))
    nunit = pose(time).resize((88, 88), Image.Resampling.LANCZOS)
    native.paste(nunit, (76, 42), nunit)
    ImageDraw.Draw(native).text((44, 145), '본체 약 70px', (91, 96, 78), SMALL)
    native.save(native_frames / ('frame-' + str(index).zfill(3) + '.png'))
contact = Image.new('RGB', (1440, 480), (236, 231, 216))
for index, key in enumerate(keys[:8]):
    contact.paste(key, (index % 4 * 360, index // 4 * 240))
contact.save(TEMP / 'keyposes.jpg')
print(json.dumps({'frames': FRAME_COUNT, 'fps': FPS, 'durationSeconds': TOTAL, 'output': str(frames)}))
