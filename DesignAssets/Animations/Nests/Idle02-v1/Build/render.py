from pathlib import Path
import sys
import math
import json
import shutil
import numpy as np
import cv2
from PIL import Image, WebPImagePlugin

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'DesignAssets/Animations/Nests/Idle02-v1'
GROWTH = ROOT / 'DesignAssets/Animations/Nests/Growth01To02-v3'
WORK = ROOT / '$Trash/NestIdle02-20261030'
sys.path.insert(0, str(GROWTH / 'Build'))
from riglib import premul, rgba, over, affine, water_surface, clean_matte, skin

Y, X = np.mgrid[0:512, 0:512].astype(np.float32)


def write_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def wave(t, phase):
    return math.sin(math.pi * t) ** 2 * math.sin(2 * math.pi * t + phase)


def source(tribe, name):
    target = BASE / tribe / 'Parts' / name
    target.parent.mkdir(511, True, True)
    if not target.exists():
        shutil.copyfile(GROWTH / tribe / 'Parts' / name, target)
    return premul(Image.open(target))


def mesh(layer, pivot, joint):
    yy, xx = np.where(layer[:, :, 3] > .01)
    left, right = max(0, int(xx.min()) - 5), min(511, int(xx.max()) + 5)
    top, bottom = max(0, int(yy.min()) - 5), min(511, int(yy.max()) + 5)
    vertices = np.array([(x, y) for y in np.linspace(top, bottom, 9) for x in np.linspace(left, right, 9)], np.float32)
    triangles = []
    for row in range(8):
        for col in range(8):
            a = row * 9 + col
            triangles.extend([(a, a + 1, a + 9), (a + 1, a + 10, a + 9)])
    length = np.linalg.norm(np.array(joint) - np.array(pivot))
    weights = np.clip(np.linalg.norm(vertices - np.array(pivot), None, 1) / length - .5, 0, 1)
    weights = weights * weights * (3 - 2 * weights)
    return {'pivot': pivot, 'joint': joint, 'vertices': vertices.tolist(), 'triangles': triangles,
            'weights': [[float(1 - v), float(v)] for v in weights]}, vertices, weights


def deform(layer, rig, angle, follow):
    record, vertices, weights = rig
    if abs(angle) + abs(follow) < 1e-7:
        return layer.copy()
    posed = skin(vertices, record['pivot'], record['joint'], angle, follow, weights).astype(np.float32)
    map_x = np.full((512, 512), -10, np.float32)
    map_y = map_x.copy()
    for tri in record['triangles']:
        src, dst = vertices[list(tri)], posed[list(tri)]
        left, top, width, height = cv2.boundingRect(dst)
        left, top = max(0, left), max(0, top)
        right, bottom = min(512, left + width + 1), min(512, top + height + 1)
        if right <= left or bottom <= top:
            continue
        mask = np.zeros((bottom - top, right - left), np.uint8)
        cv2.fillConvexPoly(mask, np.int32(np.round((dst - [left, top]) * 256)), 1, cv2.LINE_8, 8)
        matrix = cv2.getAffineTransform(dst, src)
        yy, xx = np.mgrid[top:bottom, left:right]
        selection = mask > 0
        map_x[top:bottom, left:right][selection] = (xx * matrix[0, 0] + yy * matrix[0, 1] + matrix[0, 2])[selection]
        map_y[top:bottom, left:right][selection] = (xx * matrix[1, 0] + yy * matrix[1, 1] + matrix[1, 2])[selection]
    return cv2.remap(layer, map_x, map_y, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)


def sprout():
    parts = {i: source('sprout', '2-' + str(i) + '.png') for i in range(13)}
    specs = {4: ((256, 398), (171, 310)), 5: ((256, 398), (341, 310)),
             10: ((256, 265), (256, 227)), 6: ((200, 315), (153, 282)),
             7: ((312, 315), (359, 282)), 8: ((130, 390), (85, 356)),
             9: ((382, 390), (427, 356))}
    rigs = {i: mesh(parts[i], *spec) for i, spec in specs.items()}

    def frame(t):
        moving = dict(parts)
        for i in [4, 5]:
            side = 1 if i == 4 else -1
            a = wave(t, 0 if i == 4 else -.23)
            moving[i] = deform(parts[i], rigs[i], side * 1.6 * a, side * 1.2 * wave(t, -.35))
        moving[10] = deform(parts[10], rigs[10], 2.6 * wave(t, -.2), 1.4 * wave(t, -.55))
        for i in [6, 7, 8, 9]:
            side = 1 if i % 2 == 0 else -1
            moving[i] = deform(parts[i], rigs[i], side * 2.7 * wave(t, -.35), side * 1.1 * wave(t, -.65))
        value = over(moving[12], moving[11])
        value = over(moving[10], over(parts[0], value))
        for i in [6, 7, 8, 9]:
            value = over(value, moving[i])
        for i in [4, 5, 1, 2, 3]:
            value = over(moving[i], value)
        return value

    record = {'parts': {str(i): {'source': 'Parts/2-' + str(i) + '.png',
              'mesh': rigs[i][0] if i in rigs else None, 'fixed': i not in rigs} for i in parts},
              'drawOrder': [11, 12, 9, 8, 7, 6, 0, 10, 4, 5, 1, 2, 3],
              'bones': {str(i): ['root', 'base-' + str(i), 'tip-' + str(i)] for i in rigs}}
    return frame, record


def spore():
    body = source('spore', '2-0.png')
    cap = source('spore', '2-complete-cap-v4.png')
    side = source('spore', '2-2.png')
    rig = mesh(cap, (256, 291), (256, 215))

    def frame(t):
        a = wave(t, 0)
        canopy = deform(cap, rig, .65 * a, -.35 * wave(t, -.25))
        canopy = affine(canopy, (256, 291), (1, 1), 0, (0, -1.4 * math.sin(math.pi * t) ** 2))
        secondary = affine(side, (407, 367), (1, 1), -.85 * wave(t, -.4), (0, 0))
        return over(canopy, over(body, secondary))

    return frame, {'parts': {'nursery': {'source': 'Parts/2-0.png', 'fixed': True},
            'canopy': {'source': 'Parts/2-complete-cap-v4.png', 'mesh': rig[0], 'parent': 'root'},
            'side': {'source': 'Parts/2-2.png', 'pivot': [407, 367], 'parent': 'root', 'rigid': True}},
            'drawOrder': ['side', 'nursery', 'canopy'], 'bones': ['root', 'canopy-base', 'canopy-tip', 'side']}


def pebble():
    parts = {i: source('pebble', str(i) + '.png') for i in range(8)}
    contact = (294, 251)

    def frame(t):
        value = parts[0].copy()
        for i in [4, 5, 1, 2, 3]:
            value = over(parts[i], value)
        cap = affine(parts[6], contact, (1, 1), 1.7 * wave(t, 0), (0, 0))
        value = over(cap, value)
        return over(parts[7], value)

    return frame, {'parts': {str(i): {'source': 'Parts/' + str(i) + '.png', 'parent': 'root',
            'pivot': list(contact) if i == 6 else [256, 448], 'rigid': True, 'fixed': i != 6} for i in parts},
            'drawOrder': [0, 4, 5, 1, 2, 3, 6, 7], 'bones': ['root', 'cap-contact'], 'rigidScale': [1, 1]}


def interior_flow(layer, t, amplitude, spacing):
    distance = cv2.distanceTransform(np.uint8(layer[:, :, 3] > .9), cv2.DIST_L2, 5)
    influence = np.clip(distance / 13, 0, 1)
    phase = math.pi * 2 * t
    dx = amplitude * (np.sin(Y / spacing + phase) - np.sin(Y / spacing)) * influence
    dy = amplitude * .45 * (np.cos(X / (spacing * 2) - phase) - np.cos(X / (spacing * 2))) * influence
    return cv2.remap(layer, X + dx.astype(np.float32), Y + dy.astype(np.float32), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)


def spring():
    data = json.loads((GROWTH / 'spring/rig.json').read_text('utf-8'))
    water = source('spring', 'main-water-v4.png')
    controls = data['parts']['main-water']
    water = water_surface(water, np.array(controls['sourceControls']), np.array(controls['targetControls']))
    basin = source('spring', 'upper-basin-v4.png')
    falling = source('spring', 'waterfall-v4.png')
    falling *= np.clip((365 - Y) / 3, 0, 1)[:, :, None]

    def frame(t):
        main = interior_flow(water, t * 2, 2.6, 17)
        upper = interior_flow(basin, t * 2, 1.4, 9)
        spill = interior_flow(falling, t * 4, 1.5, 5)
        return over(spill, over(main, upper))

    return frame, {'bindCorrection': 'reference.png', 'parts': {'main-water': {'source': 'Parts/main-water-v4.png',
            'sourceControls': controls['sourceControls'], 'bindControls': controls['targetControls'],
            'parent': 'root', 'fixedBoundaryPixels': 1, 'flowAmplitude': 2.6, 'cycles': 2},
            'basin': {'source': 'Parts/upper-basin-v4.png', 'parent': 'root', 'fixedBoundaryPixels': 1, 'cycles': 2},
            'waterfall': {'source': 'Parts/waterfall-v4.png', 'parent': 'basin', 'cycles': 4}},
            'drawOrder': ['basin', 'main-water', 'waterfall'], 'bones': ['root', 'basin', 'waterfall']}


def animated(frames, path, durations):
    path.parent.mkdir(511, True, True)
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0], stream, str(path))


def export(tribe, factory):
    folder = BASE / tribe
    folder.mkdir(511, True, True)
    frame, rig = factory()
    reference = Image.open(GROWTH / tribe / 'level-02.png').convert('RGBA')
    reference.save(folder / 'reference.png')
    neutral = frame(0)
    reference_pixels = np.array(reference)
    reconstructed = np.array(clean_matte(rgba(neutral)))
    print(tribe, 'neutral changed pixels', int(np.any(reference_pixels != reconstructed, 2).sum()), flush=True)
    frames = []
    for index in range(64):
        posed = frame(index / 64)
        image = clean_matte(rgba(posed))
        if tribe == 'spring':
            pixels = np.array(image).astype(np.int16)
            pixels[:, :, :3] += reference_pixels[:, :, :3].astype(np.int16) - reconstructed[:, :, :3].astype(np.int16)
            pixels[:, :, 3] = reference_pixels[:, :, 3]
            image = Image.fromarray(np.uint8(np.clip(pixels, 0, 255)), 'RGBA')
        frames.append(image)
        if index % 16 == 0:
            print(tribe, index, flush=True)
    frames[0] = reference.copy()
    sheet = Image.new('RGBA', (4096, 4096))
    for index, image in enumerate(frames):
        sheet.paste(image, (index % 8 * 512, index // 8 * 512))
    sheet.encoderinfo = {'lossless': True, 'quality': 100, 'method': 4}
    with (folder / 'idle.webp').open('wb') as stream:
        WebPImagePlugin._save(sheet, stream, str(folder / 'idle.webp'))
    durations = [round((i + 1) * 62.5) - round(i * 62.5) for i in range(64)]
    if tribe == 'pebble':
        durations[0] += 2000
    animated(frames, folder / 'preview.webp', durations)
    previews = []
    for image in frames:
        background = Image.new('RGB', (512, 512), '#13201c')
        background.paste(image, (0, 0), image)
        previews.append(background.resize((384, 384), Image.Resampling.LANCZOS))
    animated(previews, ROOT / ('DesignAssets/Planning/Previews/Nests/' + tribe + '-stage-02.webp'), durations)
    contact = Image.new('RGB', (1024, 512), '#13201c')
    for cell, index in enumerate([0, 8, 16, 24, 32, 40, 48, 56]):
        background = Image.new('RGB', (512, 512), '#13201c')
        background.paste(frames[index], (0, 0), frames[index])
        contact.paste(background.resize((256, 256), Image.Resampling.LANCZOS), (cell % 4 * 256, cell // 4 * 256))
    contact.save(WORK / (tribe + '-contact.png'))
    rig.update({'canvas': [512, 512], 'root': [256, 448], 'rootMotion': False,
        'phaseKeys': [0, 16, 32, 48, 64], 'loop': True, 'reference': 'reference.png'})
    write_json(folder / 'rig.json', rig)
    write_json(folder / 'animation.json', {'frameSize': [512, 512], 'frameCount': 64,
        'columns': 8, 'rows': 8, 'frameMs': 62.5, 'restMs': 2000 if tribe == 'pebble' else 0,
        'durationsMs': durations, 'loop': True, 'pivot': [256, 448], 'rootMotion': False,
        'image': 'idle.webp', 'preview': 'preview.webp', 'rig': 'rig.json', 'source': 'reference.png'})


def combined_preview():
    sources = []
    for tribe in ['sprout', 'spore', 'spring', 'pebble']:
        sheet = Image.open(BASE / tribe / 'idle.webp').convert('RGBA')
        cells = []
        for index in range(64):
            x, y = index % 8 * 512, index // 8 * 512
            cell = sheet.crop((x, y, x + 512, y + 512))
            cells.append(cell.resize((192, 192), Image.Resampling.LANCZOS))
        sources.append(cells)
    frames = []
    for index in range(192):
        surface = Image.new('RGB', (384, 384), '#13201c')
        for slot, cells in enumerate(sources):
            position = index * 62.5 % (6000 if slot == 3 else 4000)
            frame = max(0, int((position - 2000) / 62.5)) if slot == 3 else index % 64
            image = cells[frame]
            surface.paste(image, (slot % 2 * 192, slot // 2 * 192), image)
        frames.append(surface)
    durations = [round((i + 1) * 62.5) - round(i * 62.5) for i in range(192)]
    animated(frames, ROOT / 'DesignAssets/Planning/Previews/Nests/idle-stage-02-v1.webp', durations)


if __name__ == '__main__':
    WORK.mkdir(511, True, True)
    for tribe, factory in [('sprout', sprout), ('spore', spore), ('spring', spring), ('pebble', pebble)]:
        if len(sys.argv) == 1 or tribe in sys.argv[1:]:
            export(tribe, factory)
    if len(sys.argv) == 1:
        combined_preview()
