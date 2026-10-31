from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Source'
SIZE = 512
FPS = 20
COUNT = 80


def write_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def smooth(value):
    value = max(0.0, min(1.0, value))
    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0)


def envelope(time, keys):
    if time <= keys[0][0]:
        return keys[0][1]
    for first, second in zip(keys, keys[1:]):
        if time <= second[0]:
            blend = smooth((time - first[0]) / (second[0] - first[0]))
            return first[1] + (second[1] - first[1]) * blend
    return keys[-1][1]


def place_texture(texture, bounds):
    layer = Image.new('RGBA', (SIZE, SIZE))
    left, top, right, bottom = [round(value * SIZE / 1254) for value in bounds]
    texture = texture.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    layer.alpha_composite(texture, (left, top))
    return np.array(layer).astype(np.float32) / 255.0


def make_masks(reference):
    rgb = np.array(reference)[:, :, :3].astype(np.float32)
    masks = {}
    for name, bounds in [('left', (222, 681, 296, 820)), ('right', (984, 681, 1058, 820))]:
        x0, y0, x1, y1 = bounds
        crop = rgb[y0:y1, x0:x1]
        selected = (crop[:, :, 2] > crop[:, :, 0] * 1.12) & (crop[:, :, 1] > crop[:, :, 0] * 1.08) & (crop[:, :, 1] > 100)
        a = np.zeros((reference.height, reference.width), np.uint8)
        a[y0:y1, x0:x1] = selected.astype(np.uint8) * 255
        image = Image.fromarray(a).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5))
        masks[name] = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    cave = Image.new('L', reference.size)
    points = [(448, 909), (445, 816), (451, 772), (471, 730), (501, 694), (541, 661), (585, 642), (629, 634), (676, 639), (722, 659), (764, 690), (797, 729), (818, 773), (823, 821), (816, 909), (757, 917), (504, 917)]
    ImageDraw.Draw(cave).polygon(points, 255)
    cave = cave.filter(ImageFilter.GaussianBlur(9))
    masks['cave'] = cave.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    yy, xx = np.mgrid[:reference.height, :reference.width]
    floor = np.exp(-((xx - 634) / 170) ** 4 - ((yy - 883) / 35) ** 2)
    floor = floor * np.array(cave) / 255.0
    masks['floor'] = Image.fromarray(np.uint8(floor * 255)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return masks


def prepare():
    for directory in [ROOT / 'Frames', SOURCE / 'Effects', SOURCE / 'Masks', ROOT / 'Keyframes']:
        directory.mkdir(0o777, True, True)
    reference = Image.open(SOURCE / 'reference.png').convert('RGBA')
    base = reference.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    base.save(SOURCE / 'base.png')
    atlas = Image.open(SOURCE / 'effect-atlas.png').convert('RGBA')
    parts = {}
    names = ['left-emission', 'right-emission', 'left-glint', 'right-glint', 'cave-light', 'floor-light']
    for index, name in enumerate(names):
        column = index % 3
        row = index // 3
        box = (column * atlas.width // 3, row * atlas.height // 2, (column + 1) * atlas.width // 3, (row + 1) * atlas.height // 2)
        part = atlas.crop(box)
        alpha = np.array(part.getchannel('A'))
        strong = Image.fromarray(np.uint8(alpha > 30) * 255)
        bounds = strong.getbbox()
        if bounds:
            part = part.crop(bounds)
        part.save(SOURCE / 'Effects' / (name + '.png'))
        parts[name] = part
    masks = make_masks(reference)
    for name, image in masks.items():
        image.save(SOURCE / 'Masks' / (name + '.png'))
    return base, masks, parts


def render():
    base, masks, parts = prepare()
    pixels = np.array(base)
    original = pixels[:, :, :3].astype(np.float32) / 255.0
    mask_arrays = {name: np.array(value).astype(np.float32) / 255.0 for name, value in masks.items()}
    textures = {
        'left': place_texture(parts['left-emission'], (226, 688, 291, 817)),
        'right': place_texture(parts['right-emission'], (989, 688, 1054, 817)),
        'cave': place_texture(parts['cave-light'], (425, 618, 841, 932)),
        'floor': place_texture(parts['floor-light'], (448, 844, 816, 928))
    }
    timeline = {
        'left': [[0, 0], [0.6, 0], [1.4, 1], [2.2, 0.8], [3.4, 0], [4, 0]],
        'right': [[0, 0], [1, 0], [1.8, 1], [2.2, 0.9], [3.4, 0], [4, 0]],
        'cave': [[0, 0], [1.4, 0], [2.2, 1], [3.4, 0], [4, 0]],
        'floor': [[0, 0], [1.4, 0], [2.2, 1], [3.4, 0], [4, 0]],
        'left-glint': [[1.2, 0], [1.4, 1], [1.6, 0]],
        'right-glint': [[1.6, 0], [1.8, 1], [2, 0]]
    }
    settings = {
        'left': ([0.34, 0.82, 1.0], 0.70),
        'right': ([0.34, 0.82, 1.0], 0.70),
        'cave': ([1.0, 0.53, 0.13], 0.44),
        'floor': ([1.0, 0.70, 0.25], 0.30)
    }
    frames = []
    for index in range(COUNT):
        time = index / FPS
        rgb = original.copy()
        for name, texture in textures.items():
            color, strength = settings[name]
            luminance = np.max(texture[:, :, :3], 2)
            modulation = (0.42 + 0.58 * luminance) * (0.65 + 0.35 * texture[:, :, 3])
            if name in ['left', 'right']:
                modulation = 0.72 + 0.28 * luminance
            amount = mask_arrays[name] * modulation * strength * envelope(time, timeline[name])
            tint = np.array(color, np.float32)
            rgb = 1.0 - (1.0 - rgb) * (1.0 - amount[:, :, None] * tint)
        for side, start, center_x in [('left', 1.2, 258), ('right', 1.6, 1021)]:
            progress = (time - start) / 0.4
            if 0 < progress < 1:
                strength = envelope(time, timeline[side + '-glint'])
                cx = center_x + (progress - 0.5) * 15
                cy = 790 - progress * 65
                light = place_texture(parts[side + '-glint'], (cx - 23, cy - 28, cx + 23, cy + 28))
                amount = light[:, :, 3] * mask_arrays[side] * strength * 0.88
                rgb = 1.0 - (1.0 - rgb) * (1.0 - light[:, :, :3] * amount[:, :, None])
        output = pixels.copy()
        output[:, :, :3] = np.uint8(np.clip(np.rint(rgb * 255), 0, 255))
        frame = Image.fromarray(output)
        frame.save(ROOT / 'Frames' / ('frame-%03d.png' % index))
        frames.append(frame)
    sheet = Image.new('RGBA', (SIZE * 10, SIZE * 8))
    for index, frame in enumerate(frames):
        sheet.paste(frame, ((index % 10) * SIZE, (index // 10) * SIZE))
    sheet.save(ROOT / 'idle.png')
    keys = [0, 12, 28, 36, 44, 56, 68, 79]
    contact = Image.new('RGBA', (SIZE * 4, SIZE * 2))
    for index, key in enumerate(keys):
        frames[key].save(ROOT / 'Keyframes' / ('key-%03d.png' % key))
        contact.paste(frames[key], ((index % 4) * SIZE, (index // 4) * SIZE))
    contact.save(ROOT / 'contact-sheet.png')
    for name, scale in [('idle.webp', SIZE), ('preview.webp', 256)]:
        command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', str(ROOT / 'Frames' / 'frame-%03d.png'), '-vf', 'scale=%d:%d:flags=lanczos' % (scale, scale), '-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '5', '-loop', '0', str(ROOT / name)]
        code = subprocess.call(command)
        if code:
            raise RuntimeError('WebP export failed: ' + name)
    metadata = {
        'version': 1,
        'tribe': 'pebble',
        'level': 4,
        'action': 'idle',
        'durationMs': 4000,
        'frameCount': COUNT,
        'fps': FPS,
        'frameDurationsMs': [50] * COUNT,
        'frameSize': [SIZE, SIZE],
        'sourceSize': list(Image.open(SOURCE / 'reference.png').size),
        'sheet': 'idle.png',
        'columns': 10,
        'rows': 8,
        'loop': True,
        'preview': 'preview.webp',
        'animation': 'idle.webp',
        'encodedFrameCount': Image.open(ROOT / 'idle.webp').n_frames,
        'pivotNormalized': [0.5, 0.85],
        'construction': 'fixed original artwork with generated light-only textures, masked screen emission and moving masked glints',
        'geometryAnimation': False,
        'effectOpacityAnimation': True,
        'poseCrossfade': False,
        'timelineSeconds': timeline,
        'effectSettings': settings
    }
    write_json(ROOT / 'animation.json', metadata)
    print(json.dumps({'output': str(ROOT), 'frames': COUNT, 'durationMs': 4000, 'canvas': [SIZE, SIZE]}))


if __name__ == '__main__':
    render()
