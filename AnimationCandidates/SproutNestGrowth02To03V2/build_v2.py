from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin
import numpy as np
import cv2
import math
import json
import sys

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent if ROOT.parent.name == 'AnimationCandidates' else ROOT.parent
TEMP = PROJECT / '$Trash/SproutGrowth23'
PARTS = ROOT / 'Parts'
FRAMES = ROOT / 'Frames'
ORIGINAL = Path('H:/Spawner/DesignAssets/Animations/Nests/Idle03-v1/sprout')
EARLY = Path('H:/Spawner/DesignAssets/Animations/Nests/Growth01To02-v3/Sources/QuantumV9/Parts')
V1 = Path('H:/Spawner/AnimationCandidates/SproutNestGrowth02To03V1')
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
LOW = {'left': np.array([138., 360.]), 'right': np.array([384., 360.])}
HIGH = {'left': np.array([103., 308.]), 'right': np.array([422., 308.])}
TOP = {'left': np.array([157., 184.]), 'right': np.array([363., 186.])}
HARDWARE_NAMES = [side + '-' + name for side in ['left', 'right'] for name in ['brace', 'brace-bindings', 'lever', 'upper-brass-pivot', 'lower-brass-pivot', 'joint-binding']] + ['collar', 'collar-bindings', 'winch-drum', 'winch-axle-and-knob', 'winch-wrap', 'winch-tether']


def read(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def rgba(a):
    a = np.clip(a, 0, 1)
    rgb = a[:, :, :3] / np.maximum(a[:, :, 3:4], 1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, a[:, :, 3:4]], 2) * 255 + 0.5, 0, 255)))


def over(a, b):
    return a + b * (1 - a[:, :, 3:4])


def write(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def affine(a, pivot, target, angle, scale):
    c, s = math.cos(angle) * scale, math.sin(angle) * scale
    m = np.float32([[c, -s, target[0] - c * pivot[0] + s * pivot[1]], [s, c, target[1] - s * pivot[0] - c * pivot[1]]])
    return cv2.warpAffine(a, m, (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def clean(a):
    n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(a[:, :, 3] > 0.2), 8)
    keep = np.zeros((512, 512), np.uint8)
    for i in range(1, n):
        if stats[i, 4] > 18:
            keep[labels == i] = 1
    return a * cv2.dilate(keep, np.ones((3, 3), np.uint8))[:, :, None]


def material_parts(a):
    pixels = np.array(rgba(a))
    r, g, b = [pixels[:, :, i].astype(float) for i in range(3)]
    green = (g > r * 0.98) & (g > b * 1.1) & (g > 50) & (pixels[:, :, 3] > 90)
    wood = (r > g * 1.05) & (r > b * 1.2) & (r > 65) & (pixels[:, :, 3] > 90)
    seeds = np.zeros((512, 512), np.uint8)
    seeds[wood] = 1
    seeds[green] = 2
    if not np.any(green):
        return a, np.zeros_like(a)
    _, nearest = cv2.distanceTransformWithLabels(np.uint8(seeds == 0), cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    lookup = np.r_[0, seeds[seeds > 0]]
    owner = lookup[nearest]
    return a * (owner == 1)[:, :, None], a * (owner == 2)[:, :, None]


def disk(center, radius):
    return np.uint8((X - center[0]) ** 2 + (Y - center[1]) ** 2 <= radius ** 2)


def hidden_wood(side):
    atlas = read(ROOT / 'Sources/hidden-wood-generated.png')
    mask = np.uint8(atlas[:, :, 3] > 0.5)
    n, labels, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    ids = [i for i in range(1, n) if stats[i, 4] > 5000]
    ids = [i for x, i in sorted([(centers[i, 0], i) for i in ids])]
    chosen = ids[0 if side == 'left' else 1]
    selected = np.uint8(labels == chosen)
    distance = cv2.distanceTransform(selected, cv2.DIST_L2, 5)
    yy, xx = np.indices(selected.shape)
    x, y, width, height, area = stats[chosen]
    upper = np.unravel_index(np.argmax(distance * (yy < y + height * 0.4)), distance.shape)
    lower = np.unravel_index(np.argmax(distance * (yy > y + height * 0.6)), distance.shape)
    a = np.array([upper[1], upper[0]], float)
    b = np.array([lower[1], lower[0]], float)
    source_vector = b - a
    target_vector = LOW[side] - HIGH[side]
    angle = math.atan2(target_vector[1], target_vector[0]) - math.atan2(source_vector[1], source_vector[0])
    scale = np.linalg.norm(target_vector) / np.linalg.norm(source_vector)
    return affine(atlas * selected[:, :, None], a, HIGH[side], angle, scale)


def prepare():
    PARTS.mkdir(511, True, True)
    FRAMES.mkdir(511, True, True)
    for side, bar_id, arm_id in [('left', 6, 8), ('right', 7, 9)]:
        brace = clean(read(ORIGINAL / 'Sources/Parts' / ('old-' + str(bar_id) + '.png')))
        wood, bindings = material_parts(brace)
        rgba(wood).save(PARTS / (side + '-brace.png'))
        rgba(bindings).save(PARTS / (side + '-brace-bindings.png'))
        arm = clean(read(ORIGINAL / 'Sources/Parts' / ('old-' + str(arm_id) + '.png')))
        arm_wood, arm_bindings = material_parts(arm)
        covered = (disk(HIGH[side], 15) > 0) | (disk(LOW[side], 12) > 0)
        hidden = hidden_wood(side)
        rgba(hidden).save(PARTS / (side + '-lever-hidden-surface.png'))
        beam = over(arm_wood * (~covered)[:, :, None], hidden * covered[:, :, None])
        rgba(beam).save(PARTS / (side + '-lever.png'))
        rgba(arm * disk(HIGH[side], 15)[:, :, None]).save(PARTS / (side + '-upper-brass-pivot.png'))
        rgba(arm * disk(LOW[side], 12)[:, :, None]).save(PARTS / (side + '-lower-brass-pivot.png'))
        near_joint = np.minimum(np.hypot(X - LOW[side][0], Y - LOW[side][1]), np.hypot(X - HIGH[side][0], Y - HIGH[side][1])) < 34
        rgba(clean(arm_bindings * near_joint[:, :, None])).save(PARTS / (side + '-joint-binding.png'))
    source = clean(read(ORIGINAL / 'Sources/Parts/old-0.png'))
    collar = source * (Y > 330)[:, :, None]
    collar_wood, collar_bindings = material_parts(collar)
    rgba(collar_wood).save(PARTS / 'collar.png')
    rgba(collar_bindings).save(PARTS / 'collar-bindings.png')
    winch = source * (Y < 330)[:, :, None]
    wood, bindings = material_parts(winch)
    rgba(wood * (X >= 53)[:, :, None]).save(PARTS / 'winch-drum.png')
    rgba(wood * (X < 53)[:, :, None]).save(PARTS / 'winch-axle-and-knob.png')
    rgba(bindings * (Y < 285)[:, :, None]).save(PARTS / 'winch-wrap.png')
    rgba(bindings * (Y >= 285)[:, :, None]).save(PARTS / 'winch-tether.png')
    for name in ['base-left', 'base-right', 'base-center', 'side-left', 'side-right']:
        Image.open(EARLY / ('2-' + name + '.png')).save(PARTS / ('early-' + name + '.png'))
    Image.open(ORIGINAL / 'Sources/Parts/old-10.png').save(PARTS / 'adult-ground-leaves.png')
    lining = read(ORIGINAL / 'Parts/inner-lining.png')
    lining[(Y < 300) | (X < 160) | (X > 354)] = 0
    rgba(affine(lining, (0, 0), (0, 36), 0, 1)).save(PARTS / 'lower-lining.png')
    Image.open(V1 / 'Sources/GrowthSupport/30.png').save(PARTS / 'closed-bud.png')
    rejected = Path('D:/.codex/visualizations/2026/10/31/01a18fdb-6ca5-7d70-94dd-178b3e24c00f/$Trash/SproutGrowth23/RejectedParts')
    for key in [0, 1, 4, 5, 6, 7, 8]:
        body = np.zeros((512, 512, 4), np.float32)
        for part in ['rear-left', 'rear-right', 'core', 'front-left', 'front-right']:
            body = over(read(rejected / ('K' + str(key) + '-' + part + '.png')), body)
        rgba(body).save(PARTS / ('flower-cel-' + str(key) + '.png'))
    Image.open(V1 / 'KeyPoses/K0.png').save(ROOT / 'start.png')
    Image.open(V1 / 'KeyPoses/K1.png').save(ROOT / 'clump-middle.png')
    Image.open(V1 / 'KeyPoses/K8.png').save(ROOT / 'end.png')
    print('prepared independent braces, levers, four brass pivots, collar, winch, axle and vine layers', flush=True)


class Hardware:
    def __init__(self):
        self.parts = {path.stem: read(path) for path in PARTS.glob('*.png')}
        self.frames = []

    def render(self, progress, opening):
        if progress <= 0:
            return np.zeros((512, 512, 4), np.float32), np.zeros((512, 512, 4), np.float32)
        shift = np.array([0, 52 * (1 - progress)])
        behind = np.zeros((512, 512, 4), np.float32)
        foreground = np.zeros_like(behind)
        controls = []
        for side, sign in [('left', 1), ('right', -1)]:
            base, hinge, tip = LOW[side], HIGH[side], TOP[side]
            v1, v2 = hinge - base, tip - hinge
            rest1, rest2 = math.atan2(v1[1], v1[0]), math.atan2(v2[1], v2[0])
            folded1 = math.radians(-50 if sign == 1 else -130)
            folded2 = math.radians(-70 if sign == 1 else -110)
            action = math.sin(math.pi * opening) * math.radians(4) * sign
            angle1 = folded1 * (1 - progress) + rest1 * progress + action
            relative = (folded2 - folded1) * (1 - progress) + (rest2 - rest1) * progress
            angle2 = angle1 + relative
            root = base + shift
            joint = root + np.linalg.norm(v1) * np.array([math.cos(angle1), math.sin(angle1)])
            for name in [side + '-brace', side + '-brace-bindings']:
                behind = over(affine(self.parts[name], hinge, joint, angle2 - rest2, 1), behind)
            for name in [side + '-lever', side + '-joint-binding']:
                foreground = over(affine(self.parts[name], base, root, angle1 - rest1, 1), foreground)
            foreground = over(affine(self.parts[side + '-upper-brass-pivot'], hinge, joint, 0, 1), foreground)
            foreground = over(affine(self.parts[side + '-lower-brass-pivot'], base, root, 0, 1), foreground)
            if side == 'left':
                slide = 50 * (1 - progress)
                spool_pivot = hinge - np.array([slide, 0])
                for name in ['winch-tether', 'winch-drum', 'winch-wrap', 'winch-axle-and-knob']:
                    behind = over(affine(self.parts[name], spool_pivot, joint, angle2 - rest2, 1), behind)
            controls.append({'side': side, 'root': root.tolist(), 'joint': joint.tolist(), 'leverAngle': angle1, 'braceAngle': angle2, 'leverLength': float(np.linalg.norm(v1)), 'braceLength': float(np.linalg.norm(v2))})
        for name in ['collar', 'collar-bindings']:
            foreground = over(affine(self.parts[name], (0, 0), shift, 0, 1), foreground)
        self.frames.append({'growth': progress, 'opening': opening, 'chains': controls})
        return behind, foreground


def ease(t):
    t = float(np.clip(t, 0, 1))
    return t * t * (3 - 2 * t)


def state(time):
    if time < 0.3:
        return 'start-hold', 0.76, 401, 0, 0
    if time < 0.9:
        return 'clump', 0.76, 401, 0, 0
    if time < 1.5:
        return 'small-hold', 0.76, 401, 0, 0
    if time < 1.7:
        q = ease((time - 1.5) / 0.2)
        return 'growth-1', 0.76 + 0.12 * q, 401 - 18 * q, 0.35 * q, 0
    if time < 2.3:
        return 'middle-hold', 0.88, 383, 0.35, 0
    if time < 2.5:
        q = ease((time - 2.3) / 0.2)
        return 'growth-2', 0.88 + 0.12 * q, 383 - 18 * q, 0.35 + 0.65 * q, 0
    if time < 3.1:
        return 'large-hold', 1, 365, 1, 0
    if time < 4:
        return 'open', 1, 365, 1, (time - 3.1) / 0.9
    return 'final-hold', 1, 365, 1, 1


def frame(time, hardware):
    phase, scale, hinge_y, growth, opening = state(time)
    if phase == 'start-hold':
        return Image.open(ROOT / 'start.png').convert('RGBA'), phase
    if phase == 'final-hold':
        return Image.open(ROOT / 'end.png').convert('RGBA'), phase
    if phase == 'clump':
        q = (time - 0.3) / 0.6
        if q < 0.33:
            return Image.open(ROOT / 'start.png').convert('RGBA'), phase
        if q < 0.66:
            return Image.open(ROOT / 'clump-middle.png').convert('RGBA'), phase
    p = hardware.parts
    image = np.zeros((512, 512, 4), np.float32) if opening > 0.65 else over(p['early-side-right'], p['early-side-left'])
    image = over(p['lower-lining'], image)
    back, front = hardware.render(growth, opening)
    image = over(back, image)
    if phase == 'clump':
        q = (time - 0.3) / 0.6
        size = 0.95 - 0.19 * ease((q - 0.66) / 0.34)
        flower = affine(p['closed-bud'], (256, 365), (256, 401), 0, size)
    elif opening == 0:
        flower = affine(p['closed-bud'], (256, 365), (256, hinge_y), 0, scale)
    else:
        sequence = [(0.14, None), (0.38, 4), (0.65, 5), (0.82, 6), (1.01, 7)]
        key = next(key for limit, key in sequence if opening < limit)
        flower = p['closed-bud'] if key is None else p['flower-cel-' + str(key)]
    image = over(flower, image)
    image = over(front, image)
    if opening > 0.65:
        image = over(p['adult-ground-leaves'], image)
    else:
        for name in ['early-base-left', 'early-base-right', 'early-base-center']:
            image = over(p[name], image)
    return rgba(image), phase


def animated(images, path, duration, loops):
    images[0].encoderinfo = {'append_images': images[1:], 'duration': [duration] * len(images), 'loop': loops, 'lossless': True, 'method': 4}
    with path.open('wb') as out:
        WebPImagePlugin._save_all(images[0], out, str(path))


def export(prototype):
    hardware = Hardware()
    times = [0.9 + i * 0.05 for i in range(48)] if prototype else [i * 0.05 for i in range(100)]
    images, previews, timeline = [], [], []
    for index, time in enumerate(times):
        image, phase = frame(round(time, 5), hardware)
        images.append(image)
        back = Image.new('RGB', (512, 512), '#25332e')
        back.paste(image, (0, 0), image)
        previews.append(back.resize((384, 384), Image.Resampling.LANCZOS))
        timeline.append({'frame': index, 'timeMs': round(time * 1000), 'phase': phase})
        if not prototype:
            image.save(FRAMES / (str(index).zfill(3) + '.png'))
    path = TEMP / 'v2-representative.webp' if prototype else ROOT / 'preview.webp'
    animated(previews, path, 50, 0)
    selected = [0, 10, 12, 14, 18, 26, 28, 30, 34, 42, 44, 47] if prototype else list(range(0, 100, 4))
    contact = Image.new('RGB', (1536, math.ceil(len(selected) / 6) * 280), '#25332e')
    draw = ImageDraw.Draw(contact)
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
    for slot, number in enumerate(selected):
        pos = (slot % 6 * 256, slot // 6 * 280 + 24)
        contact.paste(previews[number].resize((256, 256), Image.Resampling.LANCZOS), pos)
        draw.text((pos[0] + 8, pos[1] - 22), str(round(times[number], 2)) + 's ' + timeline[number]['phase'], '#ffffff', font)
    contact.save(TEMP / 'v2-representative.png' if prototype else ROOT / 'playback-contact.png')
    if prototype:
        return
    sheet = Image.new('RGBA', (5120, 5120))
    for index, image in enumerate(images):
        sheet.paste(image, (index % 10 * 512, index // 10 * 512))
    sheet.save(ROOT / 'growth-sheet.png')
    animated(images, ROOT / 'growth.webp', 50, 1)
    write(ROOT / 'timeline.json', timeline)
    write(ROOT / 'hardware-rig.json', {'format': 'local-independent-rigid-fk-parts-v2', 'canvas': [512, 512], 'pivot': [256, 448], 'parts': sorted(path.name for path in PARTS.glob('*.png')), 'hardwareParts': HARDWARE_NAMES, 'hardwarePartCount': len(HARDWARE_NAMES), 'lowPivots': {k: v.tolist() for k, v in LOW.items()}, 'upperPivots': {k: v.tolist() for k, v in HIGH.items()}, 'braceTips': {k: v.tolist() for k, v in TOP.items()}, 'hardwareScaleAnimated': False, 'hardwareOpacityAnimated': False, 'parents': {'left-brace': 'left-lever', 'right-brace': 'right-lever', 'winch-drum': 'left-brace', 'winch-axle-and-knob': 'left-brace', 'left-upper-brass-pivot': 'left-lever-tip', 'right-upper-brass-pivot': 'right-lever-tip'}, 'frames': hardware.frames})
    write(ROOT / 'animation.json', {'frameSize': [512, 512], 'frameCount': 100, 'columns': 10, 'rows': 10, 'frameMs': 50, 'periodMs': 5000, 'loop': False, 'image': 'growth-sheet.png', 'animatedImage': 'growth.webp', 'pivot': [256, 448], 'method': 'drawn-cels-growth-transforms-and-independent-rigid-hardware', 'temporalPoseBlend': False, 'neuralInterpolation': False, 'phasesMs': {'clump': [300, 900], 'smallHold': [900, 1500], 'growth1': [1500, 1700], 'middleHold': [1700, 2300], 'growth2': [2300, 2500], 'largeHold': [2500, 3100], 'open': [3100, 4000], 'finalHold': [4000, 5000]}, 'budScales': [0.76, 0.88, 1.0], 'sourceFrames': 'Frames', 'sourceParts': 'Parts', 'rig': 'hardware-rig.json'})
    print('exported no-fade cadence version', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'prepare':
        prepare()
    elif sys.argv[1] == 'prototype':
        export(True)
    elif sys.argv[1] == 'export':
        export(False)
