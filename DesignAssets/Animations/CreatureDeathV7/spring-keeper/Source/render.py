import json
import math
import runpy
from pathlib import Path

import numpy as np
from PIL import Image


folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
meta = json.loads((folder.parent / 'death.json').read_text('utf-8'))
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in rig['parts']}
contours = {name: np.array(points, float) for name, points in rig['contours'].items()}


def smooth(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def point(position, center, target, angle):
    c = math.cos(math.radians(angle))
    s = math.sin(math.radians(angle))
    x, y = np.array(position) - np.array(center)
    return np.array(target) + np.array([c * x - s * y, s * x + c * y])


def layer(name, scale, pivot, target, angle):
    c = math.cos(math.radians(angle))
    s = math.sin(math.radians(angle))
    tx = target[0] - scale * (c * pivot[0] - s * pivot[1])
    ty = target[1] - scale * (s * pivot[0] + c * pivot[1])
    transform = (c / scale, s / scale, (-c * tx - s * ty) / scale, -s / scale, c / scale, (s * tx - c * ty) / scale)
    return images[name].convert('RGBa').transform((512, 512), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC).convert('RGBA')


def bottom(name, scale, pivot, target, angle):
    points = contours[name] - np.array(pivot)
    c = math.cos(math.radians(angle))
    s = math.sin(math.radians(angle))
    return target[1] + scale * np.max(s * points[:, 0] + c * points[:, 1])


def grounded_angle(tail, root, direction):
    def height(value):
        return bottom(tail['image'], tail['scale'], tail['pivot'], root, value - tail['nativeAngle'])
    if height(direction) <= rig['groundY'] - 1:
        return direction
    low = direction - 90
    high = direction
    for _ in range(24):
        middle = (low + high) / 2
        if height(middle) > rig['groundY'] - 1:
            high = middle
        else:
            low = middle
    return low


frames = []
body_frames = []
times = []
time = 0
body = rig['body']
head = rig['head']
for duration in meta['durationsMs']:
    times.append(time)
    fall = smooth((time - rig['fallMs'][0]) / (rig['fallMs'][1] - rig['fallMs'][0]))
    tail_fall = smooth((time - rig['tailFallMs'][0]) / (rig['tailFallMs'][1] - rig['tailFallMs'][0]))
    body_target = np.array(body['neutral']) * (1 - fall) + np.array(body['grounded']) * fall
    head_target = np.array(head['neutral']) * (1 - fall) + np.array(head['grounded']) * fall
    body_angle = body['angle'] * fall
    head_angle = head['angle'] * fall
    canvas = Image.new('RGBA', (512, 512))
    for tail in rig['tails']:
        root = point(tail['neutralRoot'], body['neutral'], body_target, body_angle)
        direction = tail['neutralAngle'] * (1 - tail_fall) + tail['finalAngle'] * tail_fall
        direction = grounded_angle(tail, root, direction)
        canvas.alpha_composite(layer(tail['image'], tail['scale'], tail['pivot'], root, direction - tail['nativeAngle']))
    fixed = Image.new('RGBA', (512, 512))
    for foot in rig['feet']:
        name = foot['image']
        image = images[name]
        scale = foot['height'] / image.height
        pivot = [image.width * .5, image.height - 3]
        target = np.array(foot['target'], float)
        angle = foot['angle'] * fall
        target[1] += foot['target'][1] - bottom(name, scale, pivot, target, angle)
        fixed.alpha_composite(layer(name, scale, pivot, target, angle))
    wing = rig['wings'][0]
    image = images[wing['image']]
    fixed.alpha_composite(layer(wing['image'], wing['height'] / image.height, [image.width * wing['pivot'][0], image.height * wing['pivot'][1]], point(wing['root'], body['neutral'], body_target, body_angle), wing['neutralAngle'] + body_angle))
    fixed.alpha_composite(layer(body['image'], body['scale'], body['pivot'], body_target, body_angle))
    wing = rig['wings'][1]
    image = images[wing['image']]
    fixed.alpha_composite(layer(wing['image'], wing['height'] / image.height, [image.width * wing['pivot'][0], image.height * wing['pivot'][1]], point(wing['root'], body['neutral'], body_target, body_angle), wing['neutralAngle'] + body_angle + wing['droopAngle'] * fall))
    collar = rig['collar']
    image = images['collar']
    width = collar['width']
    height = round(image.height * width / image.width * (1 - (1 - collar['depthAtRest']) * fall))
    posed = image.resize((width, height), Image.Resampling.LANCZOS)
    images['collar-posed'] = posed
    target = np.array(collar['neutral']) * (1 - fall) + np.array(collar['grounded']) * fall
    fixed.alpha_composite(layer('collar-posed', 1, [width * .5, height * .5], target, collar['angle'] * fall))
    fixed.alpha_composite(layer(head['image'], head['scale'], head['pivot'], head_target, head_angle))
    body_frames.append(fixed)
    back = []
    front = []
    for crest in reversed(rig['crests']):
        root = point(crest['root'], head['neutral'], head_target, head_angle)
        release = smooth((time - crest['releaseMs']) / (crest['settleMs'] - crest['releaseMs']))
        angle = (crest['neutralAngle'] + head_angle) * (1 - release) + crest['finalAngle'] * release
        feather = layer(crest['image'], crest['scale'], crest['pivot'], root, angle)
        back.append(feather)
        pixels = np.array(feather)
        yy, xx = np.mgrid[:512, :512]
        pixels[(xx - root[0]) ** 2 + (yy - root[1]) ** 2 < 49, 3] = 0
        front.append(Image.fromarray(pixels))
    for feather in back:
        canvas.alpha_composite(feather)
    canvas.alpha_composite(fixed)
    for feather in front:
        canvas.alpha_composite(feather)
    frames.append(canvas)
    time += duration


output = folder / 'RenderedFrames'
output.mkdir(511, True, True)
for index, frame in enumerate(frames):
    frame.save(output / (str(index).zfill(3) + '.png'))
contact = next(index for index, timestamp in enumerate(times) if timestamp >= rig['fallMs'][1])
print(json.dumps({'frames': len(frames), 'bodyFixedAfterContact': all(frame.tobytes() == body_frames[contact].tobytes() for frame in body_frames[contact:]), 'contactFrame': contact}))
runpy.run_path(str(folder / 'pack.py'))
