from pathlib import Path
import sys
import json
import math
import hashlib
import numpy as np
from PIL import Image, ImageDraw, WebPImagePlugin, GifImagePlugin

ROOT = Path(sys.argv[1])
MODE = sys.argv[2]
WORK = ROOT / 'Proof'
PIVOT = [256, 448]
HOP_LOCAL = [0, -73]
ORIGIN = [PIVOT[0] + HOP_LOCAL[0], PIVOT[1] + HOP_LOCAL[1]]
DURATIONS = [500] + [50] * 62 + [1400]
Y, X = np.mgrid[0:512, 0:512]
DROP_CLIP = Y < ORIGIN[1]
RIPPLE_CLIP = ((X - 264) / 140) ** 2 + ((Y - 374) / 27) ** 2 < 1
STAGE_CHANGES = [26, 60]
HOP_STARTS = [4, 38]

def read(path):
    return Image.open(path).convert('RGBA')

def write_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def moved(part, pivot, position, scale):
    transform = (1 / scale[0], 0, pivot[0] - position[0] / scale[0],
                 0, 1 / scale[1], pivot[1] - position[1] / scale[1])
    return part.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC).convert('RGBA')

def clipped(part, mask):
    pixels = np.array(part)
    pixels[:, :, 3] *= np.uint8(mask)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)

def droplet_pose(age):
    if age < 0 or age > 20:
        return None
    if age <= 2:
        return [ORIGIN[0], ORIGIN[1] + [120, 58, 28][age]], [0.92, 1.08], 'emerge'
    if age <= 17:
        fraction = (age - 3) / 14
        height = 70 * 4 * fraction * (1 - fraction)
        stretch = 1 + 0.10 * abs(1 - 2 * fraction)
        return [ORIGIN[0], ORIGIN[1] - height], [1 / stretch, stretch], 'flight'
    return [ORIGIN[0], ORIGIN[1] + [28, 58, 120][age - 18]], [0.92, 1.08], 'submerge'

def encode(frames, durations, path, kind, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': loop,
                            'lossless': True, 'quality': 100, 'method': 0, 'optimize': False, 'disposal': 2}
    with path.open('wb') as stream:
        if kind == 'webp':
            WebPImagePlugin._save_all(frames[0], stream, str(path))
        else:
            GifImagePlugin._save_all(frames[0], stream, str(path))

def contact(frames, indices, path, offset):
    columns = 4
    result = Image.new('RGB', (1536, math.ceil(len(indices) / columns) * 244), '#17292f')
    draw = ImageDraw.Draw(result)
    times = np.cumsum([0] + DURATIONS[:-1])
    for index, number in enumerate(indices):
        picture = frames[number].crop((0, 128, 512, 480)).resize((384, 264), Image.Resampling.LANCZOS)
        x = index % columns * 384
        y = index // columns * 244
        picture = picture.crop((0, 24, 384, 240))
        result.paste(picture, (x, y + 28), picture)
        draw.text((x + 10, y + 9), str(number + offset) + ' / ' + str(int(times[number + offset])) + 'ms', '#d6eef2')
    result.save(path, 'PNG')

def main():
    stages = [read(ROOT / 'KeyPoses' / name) for name in ['stage-00-level02.png', 'stage-01-stone-spring.png', 'stage-02-level03.png']]
    stage_paths = ['KeyPoses/stage-00-level02.png', 'KeyPoses/stage-01-stone-spring.png', 'KeyPoses/stage-02-level03.png']
    stage_hashes = [sha(ROOT / name) for name in stage_paths]
    droplet = read(ROOT / 'Parts/droplet.png')
    bounds = droplet.getbbox()
    drop_pivot = [(bounds[0] + bounds[2]) / 2, bounds[3]]
    effects = {name: read(ROOT / 'Parts' / ('entry-' + name + '.png')) for name in ['dimple', 'crown', 'collar', 'ripple']}
    frames = []
    timeline = []
    count = 31 if MODE == 'prototype' else 64
    start = 32 if MODE == 'transition' else 0
    for number in range(start, count):
        stage = sum(number >= change for change in STAGE_CHANGES)
        frame = stages[stage].copy()
        key = {'frame': number, 'stage': stage, 'bodySha256': stage_hashes[stage], 'bodyTransform': 'identity', 'drawings': []}
        if number < 63:
            for hop_index, begin in enumerate(HOP_STARTS):
                age = number - begin
                pose = droplet_pose(age)
                if pose is not None:
                    position, scale, phase = pose
                    layer = clipped(moved(droplet, drop_pivot, position, scale), DROP_CLIP)
                    frame = Image.alpha_composite(frame, layer)
                    key['drawings'].append({'id': 'droplet', 'hop': hop_index + 1, 'position': position, 'scale': scale,
                                            'opacity': 1, 'phase': phase, 'visible': layer.getbbox() is not None})
                impact_age = number - (begin + 17)
                if -1 <= impact_age <= 3:
                    name, sx, sy = [('dimple', 0.65, 0.65), ('crown', 0.95, 0.80), ('crown', 1.12, 0.65),
                                    ('collar', 1.02, 0.78), ('collar', 1.15, 0.50)][impact_age + 1]
                    layer = moved(effects[name], [256, 400], ORIGIN, [sx, sy])
                    if name != 'crown':
                        layer = clipped(layer, RIPPLE_CLIP)
                    frame = Image.alpha_composite(frame, layer)
                    key['drawings'].append({'id': name, 'hop': hop_index + 1, 'position': ORIGIN, 'scale': [sx, sy], 'opacity': 1})
                if 4 <= impact_age <= 10:
                    width = 82 + 14 * (impact_age - 4)
                    height = 10 + 1.5 * (impact_age - 4)
                    strength = min(1, max(0, (10 - impact_age) / 5))
                    layer = clipped(moved(effects['ripple'], [256, 400], ORIGIN, [width / 180, height / 34]), RIPPLE_CLIP)
                    pixels = np.array(layer)
                    pixels[:, :, 3] = np.uint8(pixels[:, :, 3] * strength)
                    frame = Image.alpha_composite(frame, Image.fromarray(pixels))
                    key['drawings'].append({'id': 'ripple-highlight', 'hop': hop_index + 1, 'opacity': strength, 'effectOnly': True})
        frame.save(ROOT / 'Frames' / (str(number).zfill(3) + '.png'), 'PNG')
        frames.append(frame)
        timeline.append(key)
    preview = []
    for frame in frames:
        background = Image.new('RGB', (512, 512), '#17292f')
        background.paste(frame, (0, 0), frame)
        preview.append(background.resize((384, 384), Image.Resampling.LANCZOS))
    if MODE == 'transition':
        encode(preview, DURATIONS[start:count], WORK / 'transition.webp', 'webp', 0)
        contact(frames, [0, 6, 10, 16, 20, 24, 25, 26, 27, 28, 29, 31], WORK / 'transition-contact.png', start)
    elif MODE == 'prototype':
        encode(preview, DURATIONS[:count], WORK / 'prototype.webp', 'webp', 0)
        contact(frames, [0, 5, 10, 14, 20, 23, 24, 25, 26, 27, 29, 30], WORK / 'prototype-contact.png', 0)
    else:
        encode(frames, DURATIONS, ROOT / 'growth.webp', 'webp', 1)
        encode(preview, DURATIONS, ROOT / 'preview.webp', 'webp', 0)
        palette_image = Image.new('RGB', (384 * 4, 384 * 4))
        for i, number in enumerate(range(0, 64, 4)):
            palette_image.paste(preview[number], (i % 4 * 384, i // 4 * 384))
        palette = palette_image.quantize(192, 0, 0, None, 0)
        gif_frames = [frame.quantize(192, 0, 0, palette, 0) for frame in preview]
        encode(gif_frames, DURATIONS, ROOT / 'preview.gif', 'gif', 0)
        sheet = Image.new('RGBA', (4096, 4096))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i % 8 * 512, i // 8 * 512))
        sheet.save(ROOT / 'growth.png', 'PNG')
        contact(frames, [0, 10, 20, 24, 25, 26, 27, 32, 42, 52, 58, 59, 60, 61, 62, 63], ROOT / 'contact.png', 0)
        write_json(ROOT / 'animation.json', {'frameSize': [512, 512], 'frameCount': 64, 'columns': 8, 'rows': 8,
                   'durationsMs': DURATIONS, 'durationMs': sum(DURATIONS), 'root': PIVOT, 'loop': False,
                   'image': 'growth.png', 'animatedImage': 'growth.webp', 'preview': 'preview.webp',
                   'stageChangeFrames': STAGE_CHANGES, 'stageChangeMs': [1750, 3450],
                   'fullySubmergedFrames': [24, 58], 'fullySubmergedMs': [1650, 3350],
                   'method': 'fixed-stage-quantum-jumps-after-submersion', 'bodyInterpolation': False,
                   'bodyMaterialWipe': False, 'bodyCrossfade': False, 'endReference': 'DesignAssets/Animations/Nests/Idle03-v2/spring/keypose.png'})
    write_json(ROOT / 'rig.json', {'coordinateSpace': 'image-canvas-y-down', 'canvas': [512, 512], 'rootMotion': False,
               'bones': [{'id': 'root', 'parent': None, 'pivot': PIVOT}, {'id': 'water-hop', 'parent': 'root', 'local': HOP_LOCAL}],
               'stageSources': stage_paths, 'stageHashes': stage_hashes, 'stageChanges': STAGE_CHANGES,
               'hopStarts': HOP_STARTS, 'dropWaterlineY': ORIGIN[1], 'rippleClipEllipse': [124, 347, 404, 401],
               'attachments': {'droplet': {'source': 'Parts/droplet.png', 'parent': 'water-hop', 'pivot': drop_pivot},
                               'entryEffects': {'sources': ['Parts/entry-' + name + '.png' for name in effects], 'parent': 'water-hop', 'pivot': [256, 400]}},
               'drawOrder': ['fixed-stage-body', 'droplet-clipped-at-waterline', 'water-entry-reaction', 'contained-ripple'],
               'bodyTransform': 'identity', 'animatedPoseOpacity': False, 'effectIntensityAnimation': ['ripple-highlight'],
               'keys': timeline})
    print(json.dumps({'mode': MODE, 'frames': len(frames), 'durationMs': sum(DURATIONS[start:count]), 'stageChanges': STAGE_CHANGES}))

main()
