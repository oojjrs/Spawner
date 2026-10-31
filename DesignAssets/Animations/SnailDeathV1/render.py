from pathlib import Path
import json
import math
import sys
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent
mode = sys.argv[1]

def progress(time, start, end):
    value = max(0.0, min(1.0, (time - start) / (end - start)))
    return value * value * (3 - 2 * value)

def affine(image, matrix):
    inverse = np.linalg.inv(matrix)
    return image.transform((627, 627), Image.Transform.AFFINE, tuple(inverse[:2].reshape(-1)), Image.Resampling.BICUBIC)

def translated(image, x, y):
    return affine(image, np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float))

def registered(image, rig):
    scale = rig['registration']['scale']
    dx, dy = rig['registration']['translation']
    return image.transform((512, 512), Image.Transform.AFFINE, (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), Image.Resampling.BICUBIC)

def frame_at(time, rig, parts):
    timeline = rig['timeline']
    eye_scale = 1 - progress(time, 40, timeline['eyeEndMs'])
    body_scale = 1 - progress(time, timeline['bodyStartMs'], timeline['bodyEndMs'])
    drop = rig['shellDropY'] * progress(time, timeline['settleStartMs'], timeline['settleEndMs'])
    frame = translated(parts[rig['shell']['back']], 0, drop)
    soft = Image.new('RGBA', (627, 627))
    for eye in rig['eyes']:
        center = np.array(eye['tip'], float)
        base = np.array(eye['root'], float)
        direction = center - base
        direction /= np.linalg.norm(direction)
        axes = np.eye(2) + (max(0.005, eye_scale) - 1) * np.outer(direction, direction)
        matrix = np.eye(3)
        matrix[:2, :2] = axes
        matrix[:2, 2] = base - axes @ base
        soft.alpha_composite(affine(parts[eye['stalk']], matrix))
        shift = (1 - eye_scale) * (base - center)
        soft.alpha_composite(translated(parts[eye['bulb']], float(shift[0]), float(shift[1])))
    soft.alpha_composite(parts[rig['body']['image']])
    if body_scale > 0:
        anchor = rig['body']['anchor'][0]
        matrix = np.array([[body_scale, 0, anchor * (1 - body_scale)], [0, 1, 0], [0, 0, 1]], float)
        frame.alpha_composite(affine(soft, matrix))
    frame.alpha_composite(translated(parts[rig['shell']['front']], 0, drop))
    return registered(frame, rig), {'timeMs': time, 'bodyScaleX': body_scale, 'bodyScaleY': 1, 'eyeExtension': eye_scale, 'shellY': drop}

def save_json(path, value):
    path.write_bytes((json.dumps(value, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf8'))

def animated_webp(path, frames, durations, size):
    images = [frame.resize((size, size), Image.Resampling.LANCZOS) for frame in frames]
    images[0].save(path, 'WEBP', **{'save_all': True, 'append_images': images[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'exact': True, 'method': 4})

def gif_preview(path, frames, durations):
    images = []
    for frame in frames:
        background = Image.new('RGB', (384, 384), '#263631')
        reduced = frame.resize((384, 384), Image.Resampling.LANCZOS)
        background.paste(reduced, (0, 0), reduced)
        images.append(background)
    palette_source = Image.new('RGB', (384 * 4, 384 * 2), '#263631')
    for index in range(8):
        source = images[round(index * (len(images) - 1) / 7)]
        palette_source.paste(source, (index % 4 * 384, index // 4 * 384))
    palette = palette_source.quantize(256, Image.Quantize.MEDIANCUT)
    indexed = [image.quantize(256, None, 0, palette, Image.Dither.NONE) for image in images]
    indexed[0].save(path, 'GIF', **{'save_all': True, 'append_images': indexed[1:], 'duration': durations, 'loop': 0, 'disposal': 2, 'optimize': False})

for name in ['bundle-snail', 'old-garden-snail']:
    folder = root / name
    source = folder / 'Source'
    rig = json.loads((source / 'rig.json').read_text('utf8'))
    parts = {path.name: Image.open(path).convert('RGBA') for path in (source / 'Parts').glob('*.png') if path.name != 'cavity-mask.png'}
    timeline = rig['timeline']
    end = 800 if mode == 'sample' else timeline['motionMs']
    frames = []
    records = []
    for time in range(0, end + 1, 40):
        frame, record = frame_at(time, rig, parts)
        frames.append(frame)
        records.append(record)
    if mode == 'sample':
        target = Path('H:/Spawner/$Trash/snail-death-horizontal-v1') / name / 'Sample'
    else:
        target = folder
    target.mkdir(0o777, True, True)
    durations = [40] * (len(frames) - 1) + [600 if mode == 'sample' else 1000]
    animated_webp(target / 'preview.webp', frames, durations, 512)
    gif_preview(target / 'preview.gif', frames, durations)
    board = Image.new('RGB', (512 * 4, 512 * 2), '#263631')
    for slot in range(8):
        index = round(slot * (len(frames) - 1) / 7)
        board.paste(frames[index], (slot % 4 * 512, slot // 4 * 512), frames[index])
    board.save(target / 'contact.png')
    frames[0].save(target / 'neutral.png')
    frames[-1].save(target / 'final.png')
    save_json(target / 'motion.json', records)
    if mode == 'full':
        frame_folder = source / 'Frames'
        frame_folder.mkdir(0o777, True, True)
        sheet = Image.new('RGBA', (512 * 8, math.ceil(len(frames) / 8) * 512))
        for index, frame in enumerate(frames):
            frame.save(frame_folder / (str(index).zfill(3) + '.png'))
            sheet.alpha_composite(frame, (index % 8 * 512, index // 8 * 512))
        sheet.save(target / 'death.webp', 'WEBP', **{'lossless': True, 'exact': True, 'method': 4})
        animated_webp(target / 'thumbnail.webp', frames, durations, 64)
        prefix = 'DesignAssets/Animations/SnailDeathV1/' + name + '/'
        save_json(target / 'death.json', {
            'name': name, 'action': 'death', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': 8,
            'frameCount': len(frames), 'pivotX': 256, 'pivotY': 448, 'durationsMs': durations,
            'durationMs': sum(durations), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp',
            'renderer': 'DesignAssets/Animations/SnailDeathV1/render.py', 'rig': prefix + 'Source/rig.json',
            'approvedKeys': 'AnimationCandidates/SnailDeathsV9HorizontalRetraction-20261031/' + name + '-keyposes.png',
        })
    print(json.dumps({'name': name, 'mode': mode, 'frames': len(frames), 'durationMs': sum(durations), 'output': str(target)}))
