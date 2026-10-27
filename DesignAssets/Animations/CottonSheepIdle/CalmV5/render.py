from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import hashlib
import json
import math
import sys
import numpy as np

folder = Path(__file__).resolve().parent
size, step = 512, 8


def write_json(path, value):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    path.write_bytes((encoder.encode(value).replace('\n', '\r\n') + '\r\n').encode('utf-8'))


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * value * (value * (value * 6 - 15) + 10)


def mask(points):
    image = Image.new('L', (513, 513), 0)
    ImageDraw.Draw(image).polygon(points, 255)
    return image


def initialize():
    yy, xx = np.mgrid[0:520:step, 0:520:step]
    x, y = xx.astype(float), yy.astype(float)
    mobile = 1 - smooth((y - 306) / 30)
    head_shape = [(50, 170), (100, 155), (108, 115), (155, 80), (240, 78), (290, 110),
                  (323, 185), (337, 255), (327, 289), (255, 294), (236, 307), (150, 305),
                  (105, 279), (100, 243), (60, 233)]
    head_image = mask(head_shape).filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(11))
    head = np.clip(np.asarray(head_image).astype(float)[yy, xx] / (255 * 0.8), 0, 1) * mobile
    ear_shape = [(241, 214), (261, 214), (281, 227), (306, 240), (326, 256), (327, 276),
                 (306, 286), (280, 281), (258, 270), (244, 249)]
    ear_image = mask(ear_shape).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(6))
    ear = np.clip(np.asarray(ear_image).astype(float)[yy, xx] / (255 * 0.75), 0, 1) * smooth((x - 239) / 13)
    tip = smooth((x - 270) / 40)
    tail = (1 - head) * smooth((x - 405) / 25) * smooth((258 - y) / 33) * smooth((y - 143) / 28) * mobile
    body = (1 - head) * smooth((x - 229) / 93) * mobile * (1 - tail)
    chest = (1 - head) * smooth((y - 263) / 40) * smooth((x - 90) / 45) * smooth((294 - x) / 72) * mobile
    chest *= (1 - body) * (1 - tail)
    influences = np.stack([body, chest, head * (1 - ear), head * ear * (1 - tip), head * ear * tip, tail], 2)
    influences = np.concatenate((np.maximum(0, 1 - influences.sum(2))[:, :, None], influences), 2)
    influences /= influences.sum(2)[:, :, None]
    columns = x.shape[1]
    triangles = []
    for row in range(columns - 1):
        for column in range(columns - 1):
            vertex = row * columns + column
            triangles.extend([[vertex, vertex + 1, vertex + columns], [vertex + 1, vertex + columns + 1, vertex + columns]])
    mesh = {'step': step, 'columns': columns, 'vertices': np.stack((x, y), 2).reshape((-1, 2)).astype(int).tolist(),
            'triangles': triangles, 'weights': np.round(influences.reshape((-1, 7)), 7).tolist()}
    (folder / 'mesh.json').write_bytes((json.dumps(mesh) + '\r\n').encode('utf-8'))
    rig = {
        'format': 'spawner-continuous-weighted-mesh-v1',
        'method': 'One original continuous sprite mesh with local breathing bones, a rigid face/head region and a two-bone near-ear chain. Eye replacements affect only the two eye interiors. No head/body cutout boundaries or draw-order swaps.',
        'canvas': [512, 512], 'mesh': 'mesh.json', 'pivot': [256, 448], 'periodMs': 6000,
        'sampleIntervalMs': 50, 'atlasColumns': 8, 'rootMotion': False, 'fixedBelowY': 336,
        'referenceSha256': hashlib.sha256((folder / 'Source/reference.png').read_bytes()).hexdigest(),
        'textures': {'open': 'Source/neutral.png', 'half': 'Source/blink-half.png', 'closed': 'Source/blink-closed.png'},
        'blinkIntervals': [[2250, 2300, 'half'], [2300, 2400, 'closed'], [2400, 2450, 'half']],
        'bones': [
            {'name': 'root', 'parent': None, 'pivot': [256, 436]},
            {'name': 'ribcage', 'parent': 'root', 'pivot': [315, 330]},
            {'name': 'chest', 'parent': 'root', 'pivot': [211, 336]},
            {'name': 'head', 'parent': 'root', 'pivot': [212, 282]},
            {'name': 'near-ear-base', 'parent': 'head', 'pivot': [245, 228]},
            {'name': 'near-ear-tip', 'parent': 'near-ear-base', 'pivot': [282, 249]},
            {'name': 'tail', 'parent': 'ribcage', 'pivot': [410, 220]}
        ],
        'controls': {
            'breath': [[0, 0], [1200, 1], [3000, 0], [4200, 0.75], [5900, 0], [6000, 0]],
            'chest': [[0, 0], [1050, 1], [2850, 0], [4050, 0.75], [5800, 0], [6000, 0]],
            'earBase': [[0, 0], [2600, 0], [2800, 1], [2950, -0.3], [3200, 0], [6000, 0]],
            'earTip': [[0, 0], [2670, 0], [2870, 1], [3050, -0.22], [3290, 0], [6000, 0]]
        },
        'motion': {'ribScale': [0.035, 0.025], 'ribShift': [0, -0.7], 'chestScale': [0.015, 0.02],
                   'chestShift': [-0.4, -0.4], 'headShift': [0.15, -1.1], 'headDegrees': -0.2,
                   'earBaseDegrees': 6, 'earTipDegrees': 2.5},
        'spineCompatibilityVerified': False
    }
    write_json(folder / 'rig.json', rig)


def control(rig, name, time):
    keys = rig['controls'][name]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if time <= t1:
            return v0 + (v1 - v0) * float(smooth((time - t0) / (t1 - t0)))
    return keys[-1][1]


def transform(pivot, scale, degrees, shift):
    angle = math.radians(degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    result = np.array([[cosine * scale[0], -sine * scale[1], 0],
                       [sine * scale[0], cosine * scale[1], 0], [0, 0, 1]], float)
    result[:2, 2] = np.asarray(pivot) + np.asarray(shift) - result[:2, :2] @ np.asarray(pivot)
    return result


def matrices(rig, time):
    breath = control(rig, 'breath', time)
    chest = control(rig, 'chest', time)
    motion = rig['motion']
    body = transform([315, 330], [1 + breath * value for value in motion['ribScale']], 0,
                     [breath * value for value in motion['ribShift']])
    front = transform([211, 336], [1 + chest * value for value in motion['chestScale']], 0,
                      [chest * value for value in motion['chestShift']])
    head = transform([212, 282], [1, 1], motion['headDegrees'] * breath,
                     [breath * value for value in motion['headShift']])
    ear_base = head @ transform([245, 228], [1, 1], motion['earBaseDegrees'] * control(rig, 'earBase', time), [0, 0])
    ear_tip = ear_base @ transform([282, 249], [1, 1], motion['earTipDegrees'] * control(rig, 'earTip', time), [0, 0])
    attachment = np.array([410, 220, 1])
    tail = transform([410, 220], [1, 1], 0, (body @ attachment - attachment)[:2])
    return np.stack([np.eye(3), body, front, head, ear_base, ear_tip, tail])


def expression(rig, time):
    for start, end, name in rig['blinkIntervals']:
        if start <= time < end:
            return name
    return 'open'


def interpolate(grid, coordinates):
    x = np.clip(coordinates[:, :, 0] / step, 0, 63.99999)
    y = np.clip(coordinates[:, :, 1] / step, 0, 63.99999)
    ix, iy = x.astype(int), y.astype(int)
    u, v = (x - ix)[:, :, None], (y - iy)[:, :, None]
    a, b, c, d = grid[iy, ix], grid[iy, ix + 1], grid[iy + 1, ix], grid[iy + 1, ix + 1]
    upper = u + v <= 1
    value = np.where(upper, a + (b - a) * u + (c - a) * v, d + (c - d) * (1 - u) + (b - d) * (1 - v))
    return value, np.where(upper, (b - a) / step, (d - c) / step), np.where(upper, (c - a) / step, (d - b) / step)


def render(rig, mesh, time, images, textures, target):
    name = expression(rig, time)
    vertices = np.asarray(mesh['vertices'], float)
    weights = np.asarray(mesh['weights'], float)
    homogeneous = np.column_stack((vertices, np.ones(len(vertices))))
    posed = np.einsum('bij,vj->bvi', matrices(rig, time), homogeneous)[:, :, :2]
    deformed = np.einsum('vb,bvi->vi', weights, posed)
    triangles = np.asarray(mesh['triangles'])
    points = deformed[triangles]
    edge_a, edge_b = points[:, 1] - points[:, 0], points[:, 2] - points[:, 0]
    areas = edge_a[:, 0] * edge_b[:, 1] - edge_a[:, 1] * edge_b[:, 0]
    if float(areas.min()) <= 0:
        raise RuntimeError('Mesh fold at ' + str(time))
    delta = (deformed - vertices).reshape((65, 65, 2))
    if np.abs(delta).max() < 0.0001:
        return images[name].copy(), float(areas.min()), name
    coordinates = target.copy()
    for unused in range(5):
        displacement, dx, dy = interpolate(delta, coordinates)
        error = coordinates + displacement - target
        ax, ay = 1 + dx[:, :, 0], dx[:, :, 1]
        bx, by = dy[:, :, 0], 1 + dy[:, :, 1]
        determinant = ax * by - bx * ay
        coordinates[:, :, 0] -= (by * error[:, :, 0] - bx * error[:, :, 1]) / determinant
        coordinates[:, :, 1] -= (-ay * error[:, :, 0] + ax * error[:, :, 1]) / determinant
    x = np.clip(coordinates[:, :, 0], 0, 510.99999)
    y = np.clip(coordinates[:, :, 1], 0, 510.99999)
    ix, iy = x.astype(int), y.astype(int)
    u, v = (x - ix)[:, :, None], (y - iy)[:, :, None]
    texture = textures[name]
    sampled = ((texture[iy, ix] * (1 - u) + texture[iy, ix + 1] * u) * (1 - v)
               + (texture[iy + 1, ix] * (1 - u) + texture[iy + 1, ix + 1] * u) * v)
    alpha = sampled[:, :, 3:4]
    rgb = sampled[:, :, :3] * 255 / np.maximum(alpha, 0.00001)
    pixels = np.concatenate((rgb, alpha), 2).clip(0, 255).round().astype('uint8')
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels), float(areas.min()), name


def main():
    if not (folder / 'rig.json').exists():
        initialize()
    rig = json.loads((folder / 'rig.json').read_text('utf-8'))
    mesh = json.loads((folder / 'mesh.json').read_text('utf-8'))
    images = {name: Image.open(folder / file).convert('RGBA') for name, file in rig['textures'].items()}
    textures = {name: np.asarray(image).astype(float) for name, image in images.items()}
    for texture in textures.values():
        texture[:, :, :3] *= texture[:, :, 3:4] / 255
    yy, xx = np.mgrid[:size, :size]
    target = np.stack((xx, yy), 2).astype(float)
    contact = Image.new('RGBA', (1024, 256), (24, 31, 33, 255))
    keys = []
    for index, time in enumerate([0, 1200, 2350, 2800]):
        frame, area, name = render(rig, mesh, time, images, textures, target)
        frame.save(folder / ('key-' + str(time) + '.png'))
        contact.alpha_composite(frame.resize((256, 256), Image.Resampling.LANCZOS), (index * 256, 0))
        keys.append({'timeMs': time, 'expression': name, 'minimumTriangleArea2': area})
    contact.save(folder / 'idle-contact.png')
    if '--keys' in sys.argv:
        print(json.dumps(keys))
        return
    (folder / 'Frames').mkdir(511, True, True)
    frames, durations, times, expressions = [], [], [], []
    previous = None
    minimum_area = 64.0
    for time in range(0, rig['periodMs'], rig['sampleIntervalMs']):
        frame, area, name = render(rig, mesh, time, images, textures, target)
        minimum_area = min(minimum_area, area)
        pixels = np.asarray(frame)
        if previous is not None and np.array_equal(previous, pixels):
            durations[-1] += rig['sampleIntervalMs']
        else:
            frames.append(frame)
            durations.append(rig['sampleIntervalMs'])
            times.append(time)
            expressions.append(name)
            previous = pixels
    columns = rig['atlasColumns']
    atlas = Image.new('RGBA', (size * columns, size * math.ceil(len(frames) / columns)))
    paths = []
    for index, frame in enumerate(frames):
        file = 'Frames/' + str(index).zfill(3) + '.png'
        frame.save(folder / file)
        paths.append(file)
        atlas.alpha_composite(frame, ((index % columns) * size, (index // columns) * size))
    atlas.save(folder / 'idle.png')
    metadata = {'name': 'cotton-sheep', 'action': 'idle', 'revision': 5,
                'method': 'original continuous sprite with weighted local breathing, two-bone ear motion and locally drawn eyelid replacements',
                'frameSize': [512, 512], 'columns': columns, 'frameCount': len(frames), 'frames': paths,
                'durationsMs': durations, 'durationMs': sum(durations), 'sourceTimesMs': times,
                'expressions': expressions, 'loop': True, 'pivotX': 256, 'pivotY': 448,
                'rootMotion': False, 'fixedBelowY': 336, 'minimumTriangleArea2': minimum_area,
                'rig': 'rig.json', 'mesh': 'mesh.json', 'atlas': 'idle.png', 'runtimeAtlas': 'idle.webp',
                'preview': 'idle-preview.webp'}
    write_json(folder / 'idle.json', metadata)
    print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'minimumTriangleArea2': minimum_area}))


if __name__ == '__main__':
    main()
