from pathlib import Path
from PIL import Image, ImageDraw, WebPImagePlugin
import numpy as np
import cv2
import json
import sys

BASE = Path(__file__).resolve().parent.parent
SOURCE = BASE / 'Sources/QuantumV9'
LEGACY = BASE / 'Sources/SupportedV8/sprout'
IDLE = BASE.parent / 'Idle02-v1/sprout'
OUT = Path(sys.argv[1])
OUT.mkdir(511, True, True)
PARTS = SOURCE / 'Parts'
PARTS.mkdir(511, True, True)
FRAMES = OUT / 'Frames'
FRAMES.mkdir(511, True, True)
DURATIONS = [600] + [80] * 59 + [1000]
NAMES = ['core', 'sprout', 'petal-left', 'petal-right', 'base-left', 'base-right', 'rear-left', 'rear-right', 'side-left', 'side-right', 'base-center']
SOURCE_IDS = [0, 10, 4, 5, 1, 2, 6, 7, 8, 9, 3]
ROOT = np.array([256., 448.])


def read(path):
    return np.array(Image.open(path).convert('RGBA'))


def premul(a):
    a = a.astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def unpremul(a):
    rgb = a[:, :, :3] / np.maximum(a[:, :, 3:4], 1e-7)
    return np.uint8(np.clip(np.concatenate([rgb, a[:, :, 3:4]], 2) * 255 + .5, 0, 255))


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def affine(a, pivot, target, sx, sy):
    m = np.array([[sx, 0, target[0] - pivot[0] * sx], [0, sy, target[1] - pivot[1] * sy]], np.float32)
    return cv2.warpAffine(a, m, (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)


def save_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def partition(a, stage):
    r, g, b = [a[:, :, i].astype(np.float32) for i in range(3)]
    material = np.uint8((a[:, :, 3] > 128) & (r > 65) & (g > 80) & (b > 40))
    _, labels, _, _ = cv2.connectedComponentsWithStats(material, 8)
    seeds = np.zeros((512, 512), np.uint8)
    groups = {2: 3, 3: 4, 9: 5, 10: 6} if stage == 0 else {1: 7, 2: 8, 3: 2, 4: 7, 5: 3, 6: 4, 15: 9, 16: 10, 20: 9, 21: 10, 22: 5, 23: 6, 25: 11}
    for label, group in groups.items():
        seeds[labels == label] = group
    gold = (a[:, :, 3] > 128) & (r > g * 1.12) & (g > b * 1.2)
    seeds[gold] = 1
    if stage == 0:
        yy, xx = np.indices(seeds.shape)
        seeds[(labels == 1) & (yy < 283)] = 2
    _, nearest = cv2.distanceTransformWithLabels(np.uint8(seeds == 0), cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    lookup = np.r_[0, seeds[seeds > 0]]
    owner = lookup[nearest]
    owner[a[:, :, 3] == 0] = 0
    return owner


references = [read(LEGACY / 'start.png'), read(LEGACY / 'end.png')]
idle_reference = read(IDLE / 'reference.png')
idle_parts = {name: premul(read(IDLE / 'Parts' / ('2-' + str(index) + '.png')))
              for name, index in zip(NAMES, SOURCE_IDS)}
parts = []
visible = []
for stage_index, stage in enumerate([0, 2]):
    ref = references[stage_index]
    owner = partition(ref, stage)
    source_scale = [300 / 316, 402 / 416][stage_index]
    complete = {}
    native = {}
    for index, (name, source_id) in enumerate(zip(NAMES, SOURCE_IDS)):
        raw = read(LEGACY / 'Parts' / (str(stage) + '-' + str(source_id) + '.png'))
        layer = unpremul(affine(premul(raw), ROOT, ROOT, source_scale, source_scale))
        layer[ref[:, :, 3] == 0] = 0
        mask = owner == index + 1
        exact = np.zeros_like(ref)
        exact[mask] = ref[mask]
        layer[mask] = ref[mask]
        if name in ['sprout', 'base-left', 'base-right']:
            layer = exact.copy()
        if name.startswith('petal'):
            hidden = np.isin(owner, [5, 6, 11])
            layer[(~hidden) & (~mask)] = 0
        complete[name] = premul(layer)
        native[name] = premul(exact)
        Image.fromarray(layer).save(PARTS / (str(stage) + '-' + name + '.png'))
    parts.append(complete)
    visible.append(native)


def contour(a, anchor):
    contours, _ = cv2.findContours(np.uint8(a[:, :, 3] > .15), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = sorted([(cv2.contourArea(v), i, v) for i, v in enumerate(contours)])[-1][2][:, 0, :].astype(np.float64)
    if cv2.contourArea(c.astype(np.float32), True) < 0:
        c = c[::-1]
    if anchor == 'root-left':
        bottom = int(np.argmin((c[:, 0] - np.max(c[:, 0])) ** 2 + (c[:, 1] - (np.min(c[:, 1]) + np.max(c[:, 1])) / 2) ** 2))
    elif anchor == 'root-right':
        bottom = int(np.argmin((c[:, 0] - np.min(c[:, 0])) ** 2 + (c[:, 1] - (np.min(c[:, 1]) + np.max(c[:, 1])) / 2) ** 2))
    else:
        bottom = int(np.argmax(c[:, 1] - .06 * abs(c[:, 0] - 256)))
    c = np.concatenate([c[bottom:], c[:bottom], c[bottom:bottom + 1]])
    lengths = np.r_[0, np.cumsum(np.linalg.norm(np.diff(c, 1, 0), None, 1))]
    sample = np.linspace(0, lengths[-1], 49)[:-1]
    boundary = np.column_stack([np.interp(sample, lengths, c[:, i]) for i in range(2)])
    center = np.mean(boundary, 0)
    interior = boundary[::12] * .35 + center * .65
    return np.concatenate([boundary, interior, center[None]], 0)


def warp(a, source, target):
    if np.max(np.abs(source - target)) < 1e-5:
        return a.copy()
    delta = target[:, None] - target[None]
    radius = np.sum(delta * delta, 2)
    kernel = radius * np.log(radius + 1e-6)
    p = np.column_stack([np.ones(len(target)), target])
    matrix = np.block([[kernel + np.eye(len(target)) * .04, p], [p.T, np.zeros((3, 3))]])
    weights = np.linalg.solve(matrix, np.concatenate([source, np.zeros((3, 2))], 0))
    low = np.maximum(0, np.floor(np.min(target[:48], 0) - 3)).astype(int)
    high = np.minimum(512, np.ceil(np.max(target[:48], 0) + 4)).astype(int)
    yy, xx = np.mgrid[low[1]:high[1], low[0]:high[0]].astype(np.float64)
    field = weights[-3] + xx[:, :, None] * weights[-2] + yy[:, :, None] * weights[-1]
    for point, weight in zip(target, weights[:-3]):
        rr = (xx - point[0]) ** 2 + (yy - point[1]) ** 2
        field += (rr * np.log(rr + 1e-6))[:, :, None] * weight
    out = np.zeros_like(a)
    out[low[1]:high[1], low[0]:high[0]] = cv2.remap(a, field[:, :, 0].astype(np.float32), field[:, :, 1].astype(np.float32), cv2.INTER_LINEAR, None, cv2.BORDER_CONSTANT)
    mask = np.zeros((1024, 1024), np.uint8)
    cv2.fillPoly(mask, [np.int32(target[:48] * 2)], 255)
    mask = cv2.resize(mask, (512, 512), None, 0, 0, cv2.INTER_AREA).astype(np.float32) / 255
    out *= mask[:, :, None]
    return out


control_cache = {}


def morph(a, b, t, key):
    if t <= 0:
        return a.copy()
    if t >= 1:
        return b.copy()
    if key not in control_cache:
        anchor = ('root-left' if key[1] == 'base-left' else 'root-right') if key[0] == 'base' else 'bottom'
        control_cache[key] = [contour(a, anchor), contour(b, anchor)]
    ca, cb = control_cache[key]
    target = ca * (1 - t) + cb * t
    if t < .5:
        return warp(a, ca, target)
    return warp(b, cb, target)


atlas = read(SOURCE / 'petal-poses.png')
_, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(atlas[:, :, 3] > 64), 8)
ids = [i for i in range(1, len(stats)) if stats[i, 4] > 10000]
ids = [v[2] for v in sorted([(int(centers[i, 1] > atlas.shape[0] / 2), centers[i, 0], i) for i in ids])]
poses = []
open_width = stats[ids[-1], 2]
for pose_index, label in enumerate(ids):
    mask = cv2.dilate(np.uint8(labels == label), np.ones((3, 3), np.uint8))
    cell = atlas.copy()
    cell[mask == 0] = 0
    x, y, width, height, _ = stats[label]
    bottom_rows = (labels == label) & (np.indices(labels.shape)[0] >= y + height - 7)
    yy, xx = np.where(bottom_rows)
    hinge = [float(np.median(xx)), float(y + height - 1)]
    scale = 318 / open_width
    m = np.array([[scale, 0, 256 - hinge[0] * scale], [0, scale, 401 - hinge[1] * scale]], np.float32)
    registered = cv2.warpAffine(premul(cell), m, (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    pair = []
    for side in range(2):
        layer = registered.copy()
        layer[:, 256:] = 0 if side == 0 else layer[:, 256:]
        if side == 1:
            layer[:, :256] = 0
        pair.append(layer)
        Image.fromarray(unpremul(layer)).save(PARTS / ('pose-' + str(pose_index) + '-' + ['left', 'right'][side] + '.png'))
    poses.append(pair)


poses[-1] = [parts[1]['petal-left'], parts[1]['petal-right']]


def smooth(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


def opening_petals(opening, stage, adult):
    index = min(2, int(opening * 3))
    amount = opening * 3 - index
    if opening >= 1:
        index, amount = 2, 1
    result = []
    for side, name in enumerate(['petal-left', 'petal-right']):
        sequence = [affine(p[side], [256, 401], [256, 427], .84, .84) for p in poses] if stage == 0 else [p[side] for p in poses]
        sequence[-1] = parts[stage][name] if stage == 0 else adult[name]
        result.append(morph(sequence[index], sequence[index + 1], amount, ('petal', stage, side, index)))
    return result


keys = []
frames = []
for frame in range(61):
    growth = 0.0
    opening = 0.0
    squash = 0.0
    phase = 'closed'
    if frame == 0:
        opening, phase = 1., 'start'
    elif frame <= 9:
        opening, phase = 1 - smooth((frame - 1) / 8), 'close'
    elif frame <= 12:
        phase = 'closed-hold'
    elif frame <= 15:
        squash, phase = (frame - 12) / 3 * -.055, 'anticipation-1'
    elif frame <= 17:
        growth = [0., .32, .5][frame - 15]
        squash, phase = .04, 'growth-1'
    elif frame <= 21:
        growth, squash, phase = .5, .04 * (1 - (frame - 17) / 4), 'settle-1'
    elif frame <= 25:
        growth, phase = .5, 'intermediate-hold'
    elif frame <= 28:
        growth, squash, phase = .5, (frame - 25) / 3 * -.055, 'anticipation-2'
    elif frame <= 30:
        growth, squash, phase = [.5, .82, 1.][frame - 28], .04, 'growth-2'
    elif frame <= 34:
        growth, squash, phase = 1., .04 * (1 - (frame - 30) / 4), 'settle-2'
    elif frame <= 38:
        growth, phase = 1., 'adult-closed-hold'
    elif frame <= 51:
        growth, opening, phase = 1., smooth((frame - 38) / 13), 'open'
    else:
        growth, opening, phase = 1., 1., 'rest'
    if frame == 0 or frame == 1:
        rendered = references[0].copy()
    elif frame >= 51:
        rendered = idle_reference.copy()
    else:
        image = np.zeros((512, 512, 4), np.float32)
        adult = parts[1]
        if frame >= 39:
            adult = {name: morph(parts[1][name], idle_parts[name], opening, ('idle-endpoint', name))
                     for name in NAMES if not name.startswith('petal')}
            adult.update({name: idle_parts[name] for name in ['petal-left', 'petal-right']})
        for name in ['rear-left', 'rear-right', 'side-left', 'side-right']:
            if growth > 0:
                pivot = [256, 420] if name.startswith('rear') else [256, 448]
                size = growth * (.72 + .28 * opening) if name.startswith('rear') else growth
                layer = affine(adult[name], pivot, pivot, size, size)
                image = over(layer, image)
        core = morph(parts[0]['core'], adult['core'], growth, ('body', 'core'))
        image = over(core, image)
        sprout = morph(parts[0]['sprout'], adult['sprout'], growth, ('body', 'sprout'))
        fold = (1 - opening) * (72 * (1 - growth) + 42 * growth)
        sprout = affine(sprout, [256, 284 - growth * 32], [256, 284 - growth * 32 + fold], 1, 1 - .22 * (1 - opening))
        image = over(sprout, image)
        if opening > 0:
            petals = opening_petals(opening, 0 if growth == 0 else 1, adult)
        else:
            scale = .84 + .16 * growth
            petals = [affine(p, [256, 401], [256, 427 - growth * 26], scale, scale) for p in poses[0]]
        for layer in petals:
            hinge = [256, 427 - growth * 26]
            image = over(affine(layer, hinge, hinge, 1 - squash * .45, 1 + squash), image)
        for name in ['base-left', 'base-right']:
            layer = morph(parts[0][name], adult[name], growth, ('base', name))
            image = over(layer, image)
        if growth > 0:
            image = over(affine(adult['base-center'], ROOT, ROOT, .6 + .4 * growth, .6 + .4 * growth), image)
        rendered = unpremul(image)
    frames.append(Image.fromarray(rendered))
    frames[-1].save(FRAMES / (str(frame).zfill(3) + '.png'))
    keys.append({'frame': frame, 'timeMs': 0 if frame == 0 else 600 + (frame - 1) * 80, 'phase': phase, 'growth': growth, 'opening': opening, 'petalSquash': squash, 'hinge': [256, 427 - growth * 26]})
    if frame % 15 == 0:
        print('rendered', frame)
        sys.stdout.flush()


def export_webp(images, path):
    images[0].encoderinfo = {'append_images': images[1:], 'duration': DURATIONS, 'loop': 0, 'lossless': True, 'method': 4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(images[0], stream, str(path))


sheet = Image.new('RGBA', (4096, 4096))
previews = []
for index, image in enumerate(frames):
    sheet.paste(image, (index % 8 * 512, index // 8 * 512))
    bg = Image.new('RGB', (512, 512), '#273438')
    bg.paste(image, (0, 0), image)
    previews.append(bg.resize((384, 384), Image.Resampling.LANCZOS))
sheet.save(OUT / 'growth.png')
Image.fromarray(idle_reference).save(OUT / 'level-02.png')
export_webp(frames, OUT / 'growth.webp')
export_webp(previews, OUT / 'preview.webp')
contact = Image.new('RGB', (256 * 6, 280 * 4), '#273438')
draw = ImageDraw.Draw(contact)
for cell, index in enumerate([0, 3, 6, 9, 12, 15, 16, 17, 21, 25, 28, 29, 30, 34, 38, 39, 41, 43, 45, 47, 49, 50, 51, 60]):
    x, y = cell % 6 * 256, cell // 6 * 280
    contact.paste(previews[index].resize((256, 256)), (x, y))
    draw.text((x + 8, y + 257), str(index) + ' ' + keys[index]['phase'], 'white')
contact.save(OUT / 'contact.png')
metadata = json.loads((BASE / 'sprout/animation.json').read_text('utf-8'))
metadata.update({'method': 'drawn-petal-keys-and-independent-part-deformation', 'source': 'Sources/QuantumV9/Parts', 'additionalSources': ['Sources/QuantumV9/petal-poses.png'], 'timeline': 'rig.json', 'phaseRanges': {'close': [1, 9], 'closedWait': [10, 12], 'anticipation1': [13, 15], 'growth1': [16, 17], 'intermediateHold': [22, 25], 'anticipation2': [26, 28], 'growth2': [29, 30], 'grownClosedWait': [35, 38], 'open': [39, 51], 'rest': [52, 60]}, 'markersMs': {'closeStart': 600, 'closed': 1240, 'growth1Start': 1800, 'growth1End': 1960, 'growth2Start': 2840, 'growth2End': 3000, 'openStart': 3640, 'openEnd': 4600}})
metadata['reference']['end'] = {'source': 'DesignAssets/Animations/Nests/Idle02-v1/sprout/reference.png', 'frame': 0, 'root': [256, 448]}
metadata['additionalSources'].append('DesignAssets/Animations/Nests/Idle02-v1/sprout/Parts')
rig = {'format': 'local-layered-deformation-rig', 'bones': [{'id': 'root', 'parent': None, 'pivot': [256, 448]}, {'id': 'petal-hinge', 'parent': 'root', 'pivotFirst': [256, 427], 'pivotAdult': [256, 401]}], 'deformation': {'type': 'thin-plate-spline', 'boundaryControls': 48, 'interiorControls': 5, 'materialSampling': 'single-nearest-pose', 'crossfade': False}, 'canvas': [512, 512], 'root': [256, 448], 'rootMotion': False, 'frameCount': 61, 'durationMs': 6320, 'sourceRoot': 'Sources/QuantumV9', 'drawOrder': ['rear-left', 'rear-right', 'side-left', 'side-right', 'core', 'sprout', 'petal-left', 'petal-right', 'base-left', 'base-right', 'base-center'], 'parts': {name: {'sourceFirst': 'Parts/0-' + name + '.png', 'sourceAdult': 'Parts/2-' + name + '.png', 'parent': 'petal-hinge' if name.startswith('petal') else 'root', 'hiddenSurfaces': 'native visible part' if name in ['sprout', 'base-left', 'base-right'] else 'registered complete attachment beneath native visible pixels', 'canvasOffset': [0, 0], 'pivotFirst': [256, 427] if name.startswith('petal') else [256, 284] if name == 'sprout' else [256, 420] if name.startswith('rear') else [256, 448], 'pivotAdult': [256, 401] if name.startswith('petal') else [256, 252] if name == 'sprout' else [256, 420] if name.startswith('rear') else [256, 448]} for name in NAMES}, 'keys': keys, 'morphControls': {str(key): [a.tolist() for a in value] for key, value in control_cache.items()}, 'phaseRanges': metadata['phaseRanges']}
rig['endpoint'] = {'source': metadata['reference']['end']['source'], 'parts': 'DesignAssets/Animations/Nests/Idle02-v1/sprout/Parts', 'partIds': dict(zip(NAMES, SOURCE_IDS)), 'blend': 'single-pose-deformation', 'transitionFrames': [39, 51], 'root': [256, 448]}
save_json(OUT / 'animation.json', metadata)
save_json(OUT / 'rig.json', rig)
print('exported', len(frames), 'frames', sum(DURATIONS), 'ms')
sys.stdout.flush()
