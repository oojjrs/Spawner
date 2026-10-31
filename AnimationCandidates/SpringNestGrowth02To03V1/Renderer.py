from pathlib import Path
import sys
import json
import math
import shutil
import numpy as np
import cv2
from PIL import Image, ImageDraw, GifImagePlugin, WebPImagePlugin

WORK = Path(__file__).resolve().parent
IDLE = WORK / 'Sources/Idle03Frames'
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
GRID = np.stack([X, Y], 2)

def load(path):
    return Image.open(path).convert('RGBA')

def values(image):
    a = np.array(image).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a

def image(a):
    alpha = np.clip(a[:, :, 3:4], 0, 1)
    rgb = a[:, :, :3] / np.maximum(alpha, 0.000001)
    result = np.uint8(np.clip(np.concatenate([rgb, alpha], 2), 0, 1) * 255 + 0.5)
    result[:, :, :3][result[:, :, 3] == 0] = 0
    return Image.fromarray(result)

def over(back, front):
    return front + back * (1 - front[:, :, 3:4])

def read_scaled(name):
    source = load(WORK / name)
    return values(source.convert('RGBa').resize((512, 512), Image.Resampling.LANCZOS).convert('RGBA'))

def sample(a, coords):
    return cv2.remap(a, coords[:, :, 0], coords[:, :, 1], cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)

def smooth(q):
    q = min(1, max(0, q))
    return q * q * (3 - 2 * q)

def dump(path, data):
    path.write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))

def rear_mask(points):
    line = np.interp(np.arange(512), [p[0] for p in points], [p[1] for p in points])
    return (Y < line[None, :]).astype(np.float32)

def guide(a):
    rgb = a[:, :, :3] + np.array([0.06, 0.12, 0.14], np.float32) * (1 - a[:, :, 3:4])
    gray = cv2.cvtColor(np.uint8(np.clip(rgb, 0, 1) * 255), cv2.COLOR_RGB2GRAY)
    return np.uint8(gray.astype(np.float32) * 0.7 + a[:, :, 3] * 76)

def field(a, b):
    model = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    model.setFinestScale(0)
    model.setGradientDescentIterations(32)
    model.setVariationalRefinementIterations(16)
    forward = model.calc(guide(a), guide(b), None)
    backward = model.calc(guide(b), guide(a), None)
    pin = np.clip((448 - Y) / 14, 0, 1)
    forward *= pin[:, :, None]
    backward *= pin[:, :, None]
    return forward, backward

def transport(a, flow, fraction):
    coords = GRID - fraction * flow
    for i in range(7):
        coords = GRID - fraction * sample(flow, coords)
    return sample(a, coords)

def pool_points(a):
    mask = a[:, :, 3] > 0.5
    yy, xx = np.where(mask)
    center = np.array([float(np.mean(xx)), float(np.mean(yy))], np.float32)
    points = [[0, 0], [256, 0], [511, 0], [511, 256], [511, 511], [256, 511], [0, 511], [0, 256]]
    outside = []
    for angle in np.linspace(0, 2 * np.pi, 48, False):
        direction = np.array([math.cos(angle), math.sin(angle)], np.float32)
        ray = center + np.arange(350)[:, None] * direction
        ix = np.clip(np.rint(ray[:, 0]), 0, 511).astype(np.int32)
        iy = np.clip(np.rint(ray[:, 1]), 0, 511).astype(np.int32)
        valid = np.where(mask[iy, ix])[0]
        outside.append(center + direction * float(valid[-1]))
    points.extend([list(p) for p in outside])
    points.extend([list(center + (p - center) * 0.55) for p in outside[::3]])
    points.append(list(center))
    return np.array(points, np.float32)

def pool_mesh(a, b):
    first = pool_points(a)
    second = pool_points(b)
    middle = (first + second) / 2
    subdivision = cv2.Subdiv2D((0, 0, 512, 512))
    for point in middle:
        subdivision.insert((float(point[0]), float(point[1])))
    triangles = []
    for triangle in subdivision.getTriangleList():
        vertices = triangle.reshape(3, 2)
        indices = [int(np.argmin(np.sum((middle - v) ** 2, 1))) for v in vertices]
        if len(set(indices)) == 3:
            triangles.append(indices)
    return first, second, np.array(triangles, np.int32)

def mesh_sample(a, b, mesh, fraction):
    first, second, triangles = mesh
    destination = first * (1 - fraction) + second * fraction
    coords_a = GRID.copy()
    coords_b = GRID.copy()
    for indices in triangles:
        dst = destination[indices]
        left = max(0, int(np.floor(dst[:, 0].min())))
        right = min(512, int(np.ceil(dst[:, 0].max())) + 1)
        top = max(0, int(np.floor(dst[:, 1].min())))
        bottom = min(512, int(np.ceil(dst[:, 1].max())) + 1)
        if right <= left or bottom <= top:
            continue
        region = np.zeros((bottom - top, right - left), np.uint8)
        polygon = np.rint(dst - np.array([left, top])).astype(np.int32)
        cv2.fillConvexPoly(region, polygon, 1)
        xx = X[top:bottom, left:right]
        yy = Y[top:bottom, left:right]
        selected = region > 0
        for source, coords in [(first, coords_a), (second, coords_b)]:
            matrix = cv2.getAffineTransform(dst, source[indices])
            u = matrix[0, 0] * xx + matrix[0, 1] * yy + matrix[0, 2]
            v = matrix[1, 0] * xx + matrix[1, 1] * yy + matrix[1, 2]
            coords[top:bottom, left:right, 0][selected] = u[selected]
            coords[top:bottom, left:right, 1][selected] = v[selected]
    old_surface = sample(a, coords_a)
    new_surface = sample(b, coords_b)
    radius = np.sqrt(((X - 260) / 232) ** 2 + ((Y - 369) / 80) ** 2)
    passed_wavefront = radius < fraction * 1.55 - 0.1
    return np.where(passed_wavefront[:, :, None], new_surface, old_surface)

def water(a, t, strength):
    inside = np.clip(1 - ((X - 260) / 157) ** 2 - ((Y - 371) / 31) ** 2, 0, 1)
    movement = inside ** 2 * strength
    coords = GRID.copy()
    coords[:, :, 0] += np.sin(Y * 0.11 + t * 5.8) * movement * 1.25
    coords[:, :, 1] += np.sin(X * 0.055 - t * 6.2) * movement * 0.65
    return sample(a, coords)

def board(frames, indices, path, columns, cell):
    rows = math.ceil(len(indices) / columns)
    result = Image.new('RGB', (columns * cell, rows * (cell + 28)), '#14252b')
    draw = ImageDraw.Draw(result)
    for j, index in enumerate(indices):
        frame = frames[index].resize((cell, cell), Image.Resampling.LANCZOS)
        x = j % columns * cell
        y = j // columns * (cell + 28)
        result.paste(frame, (x, y + 28), frame)
        draw.text((x + 8, y + 7), format(index * 5 / 149, '.2f') + 's', '#d4eef0')
    result.save(path, 'PNG')

def encode(frames, durations, target, kind, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': loop,
                             'lossless': True, 'quality': 100, 'method': 0,
                             'minimize_size': False, 'optimize': False, 'disposal': 2}
    with target.open('wb') as stream:
        if kind == 'WEBP':
            WebPImagePlugin._save_all(frames[0], stream, str(target))
        else:
            GifImagePlugin._save_all(frames[0], stream, str(target))

def main():
    for folder in ['Frames', 'Parts', 'RenderedPoses']:
        (WORK / folder).mkdir(511, True, True)
    start = values(load(WORK / 'KeyPoses/00-level-02.png'))
    end = values(load(WORK / 'KeyPoses/03-level-03.png'))
    low2 = read_scaled('Sources/01-submerged.png')
    low3 = read_scaled('Sources/02-expanded.png')
    points2 = [[0, 300], [99, 320], [110, 339], [145, 357], [190, 366], [230, 366], [265, 364], [285, 349], [300, 333], [512, 320]]
    points3 = [[0, 350], [68, 354], [110, 348], [160, 338], [220, 333], [302, 333], [355, 338], [410, 342], [485, 356], [512, 360]]
    mask2 = rear_mask(points2)
    mask3 = rear_mask(points3)
    rear2 = start * mask2[:, :, None]
    foreground2 = start * (1 - mask2[:, :, None])
    foreground3 = end * (1 - mask3[:, :, None])
    fill2 = low2.copy()
    fill2 *= (mask2 * (start[:, :, 3] == 1))[:, :, None]
    fill3 = low3.copy()
    fill3 *= (mask3 * (end[:, :, 3] == 1))[:, :, None]
    base2 = over(fill2, foreground2)
    base3 = over(fill3, foreground3)
    for name, a in [('rear-02', rear2), ('foreground-02', foreground2), ('rear-fill-02', fill2),
                    ('low-pool-02', base2), ('foreground-03', foreground3), ('rear-fill-03', fill3),
                    ('low-pool-03', base3), ('rear-03', end * mask3[:, :, None])]:
        image(a).save(WORK / 'Parts' / (name + '.png'), 'PNG')
    sink_forward, sink_backward = field(base2, low2)
    forward, backward = field(low2, low3)
    rise_forward, rise_backward = field(low3, base3)
    growth_mesh = pool_mesh(low2, low3)
    np.savez_compressed(WORK / 'Parts' / 'sink-pool-motion.npz', sink_forward, sink_backward)
    np.savez_compressed(WORK / 'Parts' / 'rise-pool-motion.npz', rise_forward, rise_backward)
    np.savez_compressed(WORK / 'Parts' / 'pool-motion.npz', forward, backward)
    np.savez_compressed(WORK / 'Parts' / 'growth-mesh.npz', *growth_mesh)
    frames = []
    source_entries = []
    render_indices = list(range(43)) if sys.argv[1] == 'prototype' else list(range(150))
    for i in render_indices:
        t = i * 5 / 149
        if t <= 1.4:
            q = smooth((t - 0.5) / 0.9)
            coords = GRID.copy()
            coords[:, :, 1] -= q * 105
            rear = sample(rear2, coords) * mask2[:, :, None]
            pool = transport(base2, sink_forward, q) if q < 0.5 else transport(low2, sink_backward, 1 - q)
            frame = over(water(pool, t, smooth(t / 0.5) * 0.75), rear)
            source = 'Parts/rear-02.png'
            method = 'separate-rear-basin-translation-behind-water-occluder'
        elif t < 2.1:
            q = smooth((t - 1.4) / 0.7)
            frame = mesh_sample(low2, low3, growth_mesh, q)
            source = 'KeyPoses/01-submerged.png' if q < 0.5 else 'KeyPoses/02-expanded.png'
            frame = water(frame, t, 1.25)
            method = 'single-source-water-surface-coordinate-deformation'
        else:
            rise = smooth((t - 2.1) / 1.5)
            shift = (1 - rise) * 132
            if t < 3.6:
                idle_index = 94
            else:
                q = (t - 3.6) / 1.4
                idle_index = round(94 + 26 * q * q) % 120
            actual = values(load(IDLE / ('frame-' + str(idle_index).zfill(3) + '.png')))
            rear = actual * mask3[:, :, None]
            coords = GRID.copy()
            coords[:, :, 1] -= shift
            rear = sample(rear, coords) * mask3[:, :, None]
            pool = transport(low3, rise_forward, rise) if rise < 0.5 else transport(base3, rise_backward, 1 - rise)
            frame = over(pool, rear)
            if rise == 1:
                frame = actual
            method = 'rigid-stone-wheel-sluice-assembly-rises-behind-front-pool'
            source = 'Idle03-v1/spring/Frames/frame-' + str(idle_index).zfill(3) + '.png'
        if i == 0:
            frame = start
        if i == 149:
            frame = end
        result = image(frame)
        result.save(WORK / 'Frames' / (str(i).zfill(3) + '.png'), 'PNG')
        frames.append(result)
        source_entries.append({'frame': i, 'time': t, 'method': method, 'source': source})
    key_times = [0, 0.5, 0.95, 1.4, 1.75, 2.1, 2.35, 2.8, 3.15, 3.6, 3.85, 4.1, 5]
    indices = [round(t / 5 * 149) for t in key_times if round(t / 5 * 149) < len(frames)]
    for j, index in enumerate(indices):
        frames[index].save(WORK / 'RenderedPoses' / (str(j).zfill(2) + '.png'), 'PNG')
    board(frames, indices, WORK / 'keyframes.png', 4, 256)
    board(frames, [i for i in [0, 15, 28, 42, 46, 48, 51, 54, 57, 60, 63, 70, 77, 83, 90, 97] if i < len(frames)], WORK / 'growth-detail.png', 4, 256)
    dump(WORK / 'frame-sources.json', source_entries)
    dump(WORK / 'rig.json', {'canvas': [512, 512], 'root': [256, 448], 'rootMotion': False,
         'rear02': {'source': 'Parts/rear-02.png', 'occluderBoundary': points2, 'translation': [0, 105]},
         'rear03': {'source': 'Parts/rear-03.png', 'occluderBoundary': points3, 'translation': [0, 132], 'rigid': True},
         'pool': {'sources': ['Parts/low-pool-02.png', 'Parts/low-pool-03.png'], 'coordinates': 'Parts/pool-motion.npz',
                  'method': 'single-source-inverse-coordinate-deformation', 'temporalOpacityBlending': False},
         'keyTimes': key_times})
    if sys.argv[1] == 'prototype':
        preview = []
        for frame in frames:
            rgb = Image.new('RGB', (384, 384), '#14252b')
            small = frame.resize((384, 384), Image.Resampling.LANCZOS)
            rgb.paste(small, (0, 0), small)
            preview.append(rgb)
        encode(preview, ([33, 33, 34] * 50)[:len(frames)], WORK / 'prototype.webp', 'WEBP', 0)
    else:
        durations = [33, 33, 34] * 50
        encode(frames, durations, WORK / 'growth.webp', 'WEBP', 1)
        preview = []
        for frame in frames:
            rgb = Image.new('RGB', (384, 384), '#14252b')
            small = frame.resize((384, 384), Image.Resampling.LANCZOS)
            rgb.paste(small, (0, 0), small)
            preview.append(rgb)
        encode(preview, durations, WORK / 'preview.webp', 'WEBP', 0)
        palette_board = Image.new('RGB', (384 * 5, 384 * 5))
        for j, index in enumerate(range(0, 150, 6)):
            palette_board.paste(preview[index], (j % 5 * 384, j // 5 * 384))
        palette = palette_board.quantize(192, 0, 0, None, 0)
        gif_frames = [frame.quantize(192, 0, 0, palette, 0) for frame in preview]
        encode(gif_frames, [30, 30, 40] * 50, WORK / 'preview.gif', 'GIF', 0)
        sheet = Image.new('RGBA', (5120, 7680))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i % 10 * 512, i // 10 * 512))
        sheet.save(WORK / 'growth-sheet.png', 'PNG')
        frames[0].save(WORK / 'start.png', 'PNG')
        frames[-1].save(WORK / 'end.png', 'PNG')
        dump(WORK / 'animation.json', {'frameSize': [512, 512], 'frameCount': 150, 'columns': 10, 'rows': 15,
             'frameMs': 1000 / 30, 'durationsMs': durations, 'durationMs': 5000, 'pivot': [256, 448], 'loop': False,
             'image': 'growth-sheet.png', 'animatedImage': 'growth.webp', 'preview': 'preview.webp', 'rig': 'rig.json',
             'markersMs': {'sinkStart': 500, 'submerged': 1400, 'growthComplete': 2100, 'riseComplete': 3600, 'settled': 4100},
             'construction': 'imagegen-drawn-hidden-pool-surfaces, separated painted rear assemblies, rigid translation, water-coordinate deformation, existing final idle frames',
             'temporalOpacityBlending': False})
    print(json.dumps({'frames': len(frames), 'output': str(WORK), 'mode': sys.argv[1]}))

main()
