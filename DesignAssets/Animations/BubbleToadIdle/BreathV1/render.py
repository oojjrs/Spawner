import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


FOLDER = Path(__file__).resolve().parent
SOURCE = FOLDER / 'Source'
FRAMES = FOLDER / 'Frames'
SIZE = 1024


def write_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def curve(time, keys):
    for left, right in zip(keys, keys[1:]):
        if time <= right[0]:
            fraction = float(smooth((time - left[0]) / (right[0] - left[0])))
            return left[1] + (right[1] - left[1]) * fraction
    return keys[-1][1]


def sample(array, x, y):
    height, width = array.shape[:2]
    x = np.clip(x, 0, width - 1.00001)
    y = np.clip(y, 0, height - 1.00001)
    ix = x.astype(np.int32)
    iy = y.astype(np.int32)
    fx = (x - ix)[..., None]
    fy = (y - iy)[..., None]
    upper = array[iy, ix] * (1 - fx) + array[iy, ix + 1] * fx
    lower = array[iy + 1, ix] * (1 - fx) + array[iy + 1, ix + 1] * fx
    return upper * (1 - fy) + lower * fy


def prepare():
    SOURCE.mkdir(511, True, True)
    FRAMES.mkdir(511, True, True)
    original = Image.open(SOURCE / 'reference.png').convert('RGBA')
    original.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    neutral = Image.new('RGBA', (SIZE, SIZE))
    neutral.alpha_composite(original, ((SIZE - original.width) // 2, (SIZE - original.height) // 2))
    neutral.save(SOURCE / 'neutral.png')
    guide = Image.open(SOURCE / 'blink-drawings.png').convert('RGBA')
    crop = [235, 165, 630, 420]
    mask = Image.new('L', (SIZE, SIZE), 0)
    pen = ImageDraw.Draw(mask)
    pen.polygon([(286, 287), (303, 278), (321, 284), (320, 313), (306, 336), (281, 342), (276, 329)], 255)
    pen.polygon([(424, 310), (441, 294), (477, 293), (502, 310), (520, 333), (519, 363), (501, 385), (465, 390), (432, 376), (416, 354)], 255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.4))
    mask.save(SOURCE / 'eyelid-mask.png')
    for index, name in enumerate(['half', 'closed']):
        cel = guide.crop((index * guide.width // 2, 0, (index + 1) * guide.width // 2, guide.height))
        cel = cel.resize((crop[2] - crop[0], crop[3] - crop[1]), Image.Resampling.LANCZOS)
        reference_pixels = np.asarray(neutral.crop(tuple(crop))).astype(np.float32)
        candidate_pixels = np.asarray(cel).astype(np.float32)
        anchor_y, anchor_x = np.mgrid[180:228:2, 45:142:2]
        target = reference_pixels[anchor_y, anchor_x, :3]
        choices = []
        for offset_y in range(25, 49):
            for offset_x in range(-10, 11):
                candidate = candidate_pixels[anchor_y - offset_y, anchor_x - offset_x, :3]
                choices.append((float(np.mean((candidate - target) ** 2)), offset_x, offset_y))
        score, offset_x, offset_y = min(choices)
        aligned = Image.new('RGBA', cel.size)
        aligned.paste(cel, (offset_x, offset_y))
        replacement = neutral.copy()
        replacement.paste(aligned, (crop[0], crop[1]))
        posed = Image.composite(replacement, neutral, mask)
        posed.save(SOURCE / ('blink-' + name + '.png'))
        write_json(SOURCE / ('blink-' + name + '-registration.json'), {'translation': [offset_x, offset_y], 'anchorError': round(score, 3), 'crop': crop})
        attachment = Image.new('RGBA', (SIZE, SIZE))
        attachment.paste(posed, (0, 0), mask)
        attachment.save(SOURCE / ('eyelids-' + name + '.png'))
    stationary = Image.new('L', (SIZE, SIZE), 0)
    pen = ImageDraw.Draw(stationary)
    pen.polygon([(148, 694), (206, 679), (308, 709), (318, 766), (141, 766)], 255)
    pen.polygon([(703, 517), (815, 502), (899, 542), (930, 620), (927, 714), (864, 771), (682, 771), (677, 654)], 255)
    pen.polygon([(587, 569), (621, 584), (649, 651), (640, 731), (611, 781), (473, 791), (444, 753), (460, 719), (530, 697), (539, 625)], 255)
    stationary.save(SOURCE / 'stationary-mask.png')
    rigid = np.asarray(stationary).astype(np.float32) / 255
    coordinates = np.linspace(0, SIZE - 1, 49)
    x, y = np.meshgrid(coordinates, coordinates)
    fixed = sample(rigid[..., None], x, y)[..., 0]
    throat = smooth((y - 346) / 100) * smooth((791 - y) / 88) * smooth((661 - x) / 96)
    head = smooth((x - 180) / 60) * smooth((665 - x) / 70) * smooth((y - 194) / 50) * smooth((476 - y) / 57)
    back = smooth((x - 535) / 100) * smooth((810 - x) / 90) * smooth((y - 338) / 70) * smooth((665 - y) / 95)
    weights = np.stack([throat, head, back], 2) * (1 - fixed[..., None])
    vertices = np.stack([x, y], 2).reshape(-1, 2)
    triangles = []
    for row in range(48):
        for column in range(48):
            point = row * 49 + column
            triangles.extend([[point, point + 1, point + 49], [point + 1, point + 50, point + 49]])
    rig = {
        'name': 'bubble-toad', 'canvas': [SIZE, SIZE], 'outputCanvas': [512, 512],
        'method': 'single continuous weighted surface with drawn eyelid attachment swaps',
        'texture': 'Source/neutral.png', 'stationaryMask': 'Source/stationary-mask.png',
        'gridSize': [49, 49], 'vertices': np.round(vertices, 4).tolist(),
        'triangles': triangles, 'weightChannels': ['vocal-sac', 'head', 'back'],
        'weights': np.round(weights.reshape(-1, 3), 6).tolist(),
        'bones': [
            {'name': 'root', 'parent': None, 'pivot': [512, 774]},
            {'name': 'vocal-sac', 'parent': 'root', 'pivot': [380, 350], 'scaleAtPeak': [1.065, 1.035]},
            {'name': 'head', 'parent': 'root', 'pivot': [420, 400], 'translationAtPeak': [0, -6]},
            {'name': 'back', 'parent': 'root', 'pivot': [680, 520], 'translationAtPeak': [0, -3]}
        ],
        'timeline': {
            'durationMs': 4000,
            'breath': [[0, 0], [1500, 1], [2000, 1], [3500, 0], [4000, 0]],
            'back': [[0, 0], [1650, 1], [2050, 1], [3500, 0], [4000, 0]],
            'attachments': [[0, 'open'], [2450, 'half'], [2500, 'closed'], [2650, 'half'], [2700, 'open']]
        },
        'attachments': {'open': 'Source/neutral.png', 'half': 'Source/blink-half.png', 'closed': 'Source/blink-closed.png'},
        'rootMotion': False
    }
    write_json(FOLDER / 'rig.json', rig)


def render(only_blink):
    rig = json.loads((FOLDER / 'rig.json').read_bytes())
    FRAMES.mkdir(511, True, True)
    grid_width, grid_height = rig['gridSize']
    vertices = np.array(rig['vertices']).reshape(grid_height, grid_width, 2)
    weights = np.array(rig['weights']).reshape(grid_height, grid_width, 3)
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    rigid = np.asarray(Image.open(SOURCE / 'stationary-mask.png')) > 0
    neutral = Image.open(SOURCE / 'neutral.png').convert('RGBA')
    raw_neutral = np.asarray(neutral)
    textures = {}
    for name, path in rig['attachments'].items():
        texture = np.asarray(Image.open(FOLDER / path).convert('RGBA')).astype(np.float32) / 255
        texture[:, :, :3] *= texture[:, :, 3:4]
        textures[name] = texture
    times = list(range(0, 3500, 50)) + [3500]
    durations = [50] * 70 + [500]
    state = []
    frames = []
    for index, time in enumerate(times):
        breath = curve(time, rig['timeline']['breath'])
        back = curve(time, rig['timeline']['back'])
        if only_blink and not 2450 <= time < 2700:
            frame = Image.open(FRAMES / (str(index).zfill(3) + '.png')).convert('RGBA')
            frames.append(frame)
            state.append({'frame': index, 'timeMs': time, 'breath': round(breath, 5), 'back': round(back, 5), 'eyes': 'open'})
            continue
        dx = (vertices[:, :, 0] - 380) * .065 * weights[:, :, 0] * breath
        dy = (vertices[:, :, 1] - 350) * .035 * weights[:, :, 0] * breath
        dy -= 6 * weights[:, :, 1] * breath + 3 * weights[:, :, 2] * back
        displacement = np.stack([dx, dy], 2)
        sx, sy = x.copy(), y.copy()
        for iteration in range(5):
            offset = sample(displacement, sx * (grid_width - 1) / (SIZE - 1), sy * (grid_height - 1) / (SIZE - 1))
            sx, sy = x - offset[:, :, 0], y - offset[:, :, 1]
        attachment = 'open'
        for started_at, name in rig['timeline']['attachments']:
            if time >= started_at:
                attachment = name
        if breath == 0 and back == 0 and attachment == 'open':
            posed = neutral.copy()
        else:
            pixels = sample(textures[attachment], sx, sy)
            alpha = pixels[:, :, 3:4]
            pixels[:, :, :3] /= np.maximum(alpha, 1e-6)
            pixels = np.rint(np.clip(pixels * 255, 0, 255)).astype(np.uint8)
            pixels[rigid] = raw_neutral[rigid]
            posed = Image.fromarray(pixels)
        frame = posed.resize((512, 512), Image.Resampling.LANCZOS)
        frame.save(FRAMES / (str(index).zfill(3) + '.png'))
        frames.append(frame)
        state.append({'frame': index, 'timeMs': time, 'breath': round(breath, 5), 'back': round(back, 5), 'eyes': attachment})
    rows = math.ceil(len(frames) / 4)
    atlas = Image.new('RGBA', (2048, rows * 512))
    for index, frame in enumerate(frames):
        atlas.paste(frame, (index % 4 * 512, index // 4 * 512))
    atlas.save(FOLDER / 'idle.png')
    indices = [0, 15, 30, 40, 49, 50, 53, 70]
    contact = Image.new('RGB', (1024, 560), '#26322f')
    pen = ImageDraw.Draw(contact)
    for cell, index in enumerate(indices):
        frame = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
        column, row = cell % 4, cell // 4
        contact.paste(frame, (column * 256, row * 280), frame)
        pen.text((column * 256 + 12, row * 280 + 256), str(times[index]) + ' ms / ' + state[index]['eyes'], '#e4ebdc')
    contact.save(FOLDER / 'idle-contact.png')
    metadata = {
        'name': 'bubble-toad', 'action': 'idle', 'revision': 1, 'status': 'review',
        'designReference': '../../../CreatureConcepts/v3/bubble-toad.png',
        'motion': 'Slow vocal-sac inflation, short peak hold, relaxed deflation with a drawn blink, then rest.',
        'artworkMethod': 'Original continuous texture, weighted local mesh and two image_gen eyelid attachments. Feet and hindquarters retained from the original.',
        'rig': 'rig.json', 'renderer': 'render.py', 'frameSize': [512, 512], 'columns': 4,
        'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations),
        'loop': True, 'rootMotion': False, 'atlas': 'idle.png', 'runtimeAtlas': 'idle.webp',
        'preview': 'idle-preview.webp', 'thumbnail': 'idle-thumbnail.webp',
        'gif': 'idle-preview.gif', 'contact': 'idle-contact.png',
        'frames': ['Frames/' + str(index).zfill(3) + '.png' for index in range(len(frames))],
        'frameStates': state
    }
    write_json(FOLDER / 'idle.json', metadata)
    print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'atlas': atlas.size}))


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] in ['prepare', 'prepare-only']:
        prepare()
    if len(sys.argv) == 1 or sys.argv[1] != 'prepare-only':
        render(len(sys.argv) > 1 and sys.argv[1] == 'blink')
