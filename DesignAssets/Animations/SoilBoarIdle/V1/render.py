from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import hashlib
import json
import math
import sys
import numpy as np


folder = Path(__file__).resolve().parent
repo = folder.parents[3]
reference = repo / 'DesignAssets/CreatureConcepts/v3/soil-boar.png'
work = repo / '$Trash/soil-boar-idle-20261026'
size = 512
step = 8


def write_json(path, value):
    text = json.dumps(value, **{'ensure_ascii': False, 'indent': 2}) + '\n'
    path.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def region(points):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).polygon(points, 255)
    return np.asarray(mask).astype(np.float64) / 255


def initialize():
    (folder / 'Source').mkdir(511, True, True)
    source = Image.open(reference).convert('RGBA')
    resized = ImageOps.contain(source, (size, size), Image.Resampling.LANCZOS)
    neutral = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    neutral.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    pixels = np.asarray(neutral).copy()
    pixels[pixels[:, :, 3] < 8] = 0
    Image.fromarray(pixels).save(folder / 'Source/neutral.png')
    yy, xx = np.mgrid[0:size + step:step, 0:size + step:step]
    x, y = xx.astype(np.float64), yy.astype(np.float64)
    head = smooth((278 - x) / 58) * smooth((330 - y) / 32)
    body = (1 - head) * smooth((330 - y) / 55) * smooth((x - 190) / 65)
    muzzle = smooth((196 - x) / 25) * smooth((y - 250) / 24) * smooth((330 - y) / 20) * head
    ear_shape = region([(207, 195), (258, 174), (258, 209), (243, 232), (219, 232)])
    ear_mask = np.pad(ear_shape, ((0, 1), (0, 1)), 'edge')[yy, xx]
    ear = smooth((234 - y) / 39) * ear_mask * head
    ear_tip = ear * smooth((219 - y) / 30)
    tail = smooth((x - 397) / 22) * smooth((267 - y) / 27)
    tail_tip = tail * smooth((x - 410) / 30)
    mane = smooth((200 - y) / 45) * smooth((x - 154) / 30) * smooth((292 - x) / 48)
    mane = np.minimum(mane * 0.7, np.maximum(0, head - ear))
    body *= 1 - tail
    head *= 1 - tail
    weights = np.zeros((*x.shape, 9), np.float64)
    weights[:, :, 1] = body
    weights[:, :, 2] = np.maximum(0, head - muzzle - ear - mane)
    weights[:, :, 3] = muzzle
    weights[:, :, 4] = ear - ear_tip
    weights[:, :, 5] = ear_tip
    weights[:, :, 6] = mane
    weights[:, :, 7] = tail - tail_tip
    weights[:, :, 8] = tail_tip
    weights[:, :, 0] = 1 - weights[:, :, 1:].sum(2)
    vertices = np.stack((x, y), -1).reshape((-1, 2))
    influences = [[[int(i), round(float(w), 7)] for i, w in enumerate(row) if w > 0.00000001] for row in weights.reshape((-1, 9))]
    triangles = []
    columns = x.shape[1]
    for row in range(x.shape[0] - 1):
        for col in range(columns - 1):
            a = row * columns + col
            triangles.extend([[a, a + 1, a + columns], [a + 1, a + columns + 1, a + columns]])
    controls = {
        'breath': [[0, 0], [650, 1], [1500, 0], [1850, 0.1], [2250, 0.3], [2800, 0.05], [3350, 0.45], [3950, 0], [4000, 0]],
        'headReach': [[0, 0], [1450, 0], [1675, 0.8], [1825, 0.22], [2000, 1.25], [2200, 0.9], [2450, 0.3], [2800, 0], [4000, 0]],
        'sniff': [[0, 0], [1525, 0], [1675, 1], [1825, 0], [1875, 0], [2025, 1], [2250, 0], [4000, 0]],
        'ear': [[0, 0], [2300, 0], [2475, 1], [2550, 0.85], [2800, 0], [4000, 0]],
        'tail': [[0, 0], [2525, 0], [2725, 1], [2850, -0.35], [3100, 0], [4000, 0]]
    }
    rig = {
        'format': 'spawner-continuous-mesh-rig-v1',
        'method': 'One continuous textured mesh with weighted local bones; no separated cutout parts or hidden-surface reconstruction is needed for these small in-plane deformations.',
        'texture': 'Source/neutral.png',
        'designReference': '../../../CreatureConcepts/v3/soil-boar.png',
        'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
        'canvas': [size, size],
        'pivot': [256, 394],
        'meshStep': step,
        'meshColumns': columns,
        'vertices': vertices.astype(int).tolist(),
        'triangles': triangles,
        'weights': influences,
        'bones': [
            {'name': 'root', 'parent': None, 'pivot': [256, 394]},
            {'name': 'ribcage', 'parent': 'root', 'pivot': [315, 300]},
            {'name': 'head', 'parent': 'root', 'pivot': [249, 277]},
            {'name': 'muzzle', 'parent': 'head', 'pivot': [151, 298]},
            {'name': 'ear-base', 'parent': 'head', 'pivot': [226, 229]},
            {'name': 'ear-tip', 'parent': 'ear-base', 'pivot': [237, 208]},
            {'name': 'mane', 'parent': 'head', 'pivot': [234, 190]},
            {'name': 'tail-base', 'parent': 'root', 'pivot': [407, 243]},
            {'name': 'tail-tip', 'parent': 'tail-base', 'pivot': [427, 224]}
        ],
        'controls': controls,
        'motion': {
            'ribcageRisePx': 3.3,
            'ribcageScale': [0.014, 0.011],
            'headReachPx': 5.4,
            'headPitchDegrees': -0.55,
            'muzzleReachPx': 2.7,
            'earDegrees': [3.5, 3.0],
            'tailDegrees': [-4, -6],
            'maneLagMs': 100,
            'tailLagMs': 60
        },
        'periodMs': 4000,
        'frameCount': 80,
        'frameDurationMs': 50,
        'columns': 8,
        'rootMotion': False,
        'fixedRegion': {'belowY': 330, 'description': 'All four hoof contact patches and the lower legs keep their registered source pixels.'},
        'rigidFeatures': ['eyes', 'tusks', 'muzzle'],
        'spineCompatibilityVerified': False
    }
    write_json(folder / 'rig.json', rig)


def control(rig, name, milliseconds):
    keys = rig['controls'][name]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if milliseconds <= t1:
            t = float(smooth((milliseconds - t0) / (t1 - t0)))
            return v0 + (v1 - v0) * t
    return keys[-1][1]


def transform(pivot, degrees, translation, scale):
    angle = math.radians(degrees)
    c, s = math.cos(angle), math.sin(angle)
    m = np.array([[c * scale[0], -s * scale[1], 0], [s * scale[0], c * scale[1], 0], [0, 0, 1]], np.float64)
    m[:2, 2] = np.asarray(pivot) + np.asarray(translation) - m[:2, :2] @ np.asarray(pivot)
    return m


def matrices(rig, milliseconds):
    breath = control(rig, 'breath', milliseconds)
    reach = control(rig, 'headReach', milliseconds)
    sniff = control(rig, 'sniff', milliseconds)
    ear = control(rig, 'ear', milliseconds)
    tail = control(rig, 'tail', milliseconds)
    motion = rig['motion']
    lag = control(rig, 'breath', max(0, milliseconds - motion['maneLagMs']))
    tail_lag = control(rig, 'tail', max(0, milliseconds - motion['tailLagMs']))
    pivots = [bone['pivot'] for bone in rig['bones']]
    root = np.eye(3)
    body = transform(pivots[1], 0, [0, -motion['ribcageRisePx'] * breath], [1 + breath * motion['ribcageScale'][0], 1 + breath * motion['ribcageScale'][1]])
    head = transform(pivots[2], motion['headPitchDegrees'] * reach, [-motion['headReachPx'] * reach, -1.2 * breath], [1, 1])
    muzzle = head @ transform(pivots[3], 0, [-motion['muzzleReachPx'] * sniff, -0.45 * sniff], [1, 1])
    ear_base = head @ transform(pivots[4], motion['earDegrees'][0] * ear, [0, 0], [1, 1])
    ear_tip = ear_base @ transform(pivots[5], motion['earDegrees'][1] * ear, [0, 0], [1, 1])
    mane = head @ transform(pivots[6], 0.6 * (lag - breath), [0, 1.8 * (lag - breath)], [1, 1])
    tail_base = transform(pivots[7], motion['tailDegrees'][0] * tail, [0, -0.4 * breath], [1, 1])
    tail_tip = tail_base @ transform(pivots[8], motion['tailDegrees'][1] * tail_lag, [0, 0], [1, 1])
    return np.stack([root, body, head, muzzle, ear_base, ear_tip, mane, tail_base, tail_tip])


def interpolate(grid, coordinates):
    x = np.clip(coordinates[:, :, 0] / step, 0, 63.99999)
    y = np.clip(coordinates[:, :, 1] / step, 0, 63.99999)
    ix, iy = x.astype(np.int32), y.astype(np.int32)
    u, v = (x - ix)[:, :, None], (y - iy)[:, :, None]
    a, b, c, d = grid[iy, ix], grid[iy, ix + 1], grid[iy + 1, ix], grid[iy + 1, ix + 1]
    return np.where(u + v <= 1, a + (b - a) * u + (c - a) * v, d + (c - d) * (1 - u) + (b - d) * (1 - v))


def render(rig, milliseconds, texture, vertices, weights, target):
    ms = milliseconds % rig['periodMs']
    if ms == 0 or (ms >= 3950):
        return Image.open(folder / rig['texture']).convert('RGBA')
    hom = np.column_stack((vertices, np.ones(len(vertices))))
    posed = np.einsum('bij,vj->bvi', matrices(rig, ms), hom)[:, :, :2]
    deformed = np.einsum('vb,bvi->vi', weights, posed)
    delta = (deformed - vertices).reshape((65, 65, 2))
    source_coordinates = target.copy()
    for unused in range(5):
        source_coordinates = target - interpolate(delta, source_coordinates)
    x = np.clip(source_coordinates[:, :, 0], 0, size - 1.00001)
    y = np.clip(source_coordinates[:, :, 1], 0, size - 1.00001)
    x0, y0 = x.astype(np.int32), y.astype(np.int32)
    u, v = (x - x0)[:, :, None], (y - y0)[:, :, None]
    sampled = (texture[y0, x0] * (1 - u) + texture[y0, x0 + 1] * u) * (1 - v) + (texture[y0 + 1, x0] * (1 - u) + texture[y0 + 1, x0 + 1] * u) * v
    alpha = sampled[:, :, 3:4]
    rgb = np.divide(sampled[:, :, :3] * 255, np.maximum(alpha, 0.00001))
    result = np.concatenate((rgb, alpha), 2).clip(0, 255).round().astype(np.uint8)
    result[result[:, :, 3] == 0] = 0
    fixed = np.asarray(Image.open(folder / rig['texture']).convert('RGBA'))
    result[rig['fixedRegion']['belowY']:] = fixed[rig['fixedRegion']['belowY']:]
    return Image.fromarray(result)


def contact(frames, times, path):
    canvas = Image.new('RGB', (1024, 560), (39, 47, 40))
    draw = ImageDraw.Draw(canvas)
    for i, (frame, ms) in enumerate(zip(frames, times)):
        x, y = (i % 4) * 256, (i // 4) * 280
        preview = Image.new('RGBA', (256, 256), (39, 47, 40, 255))
        preview.alpha_composite(frame.resize((256, 256), Image.Resampling.LANCZOS))
        canvas.paste(preview.convert('RGB'), (x, y))
        draw.text((x + 12, y + 257), str(ms) + ' ms', (223, 232, 218))
    canvas.save(path)


def main():
    if not (folder / 'rig.json').exists():
        initialize()
    rig = json.loads((folder / 'rig.json').read_text('utf-8'))
    image = Image.open(folder / rig['texture']).convert('RGBA')
    texture = np.asarray(image).astype(np.float64)
    texture[:, :, :3] *= texture[:, :, 3:4] / 255
    vertices = np.asarray(rig['vertices'], np.float64)
    weights = np.zeros((len(vertices), len(rig['bones'])), np.float64)
    for vertex, influences in enumerate(rig['weights']):
        for bone, weight in influences:
            weights[vertex, bone] = weight
    weights /= weights.sum(1)[:, None]
    yy, xx = np.mgrid[0:size, 0:size]
    target = np.stack((xx, yy), 2).astype(np.float64)
    key_times = [0, 650, 1450, 1675, 1825, 2025, 2475, 2725]
    key_frames = [render(rig, ms, texture, vertices, weights, target) for ms in key_times]
    contact(key_frames, key_times, folder / 'idle-contact.png')
    if '--keys' in sys.argv:
        print(json.dumps({'keyPoses': len(key_frames), 'contact': str(folder / 'idle-contact.png')}))
        return
    if '--pack' in sys.argv:
        atlas = Image.open(folder / 'idle.png').convert('RGBA')
        frames = [atlas.crop((i % rig['columns'] * size, i // rig['columns'] * size, (i % rig['columns'] + 1) * size, (i // rig['columns'] + 1) * size)) for i in range(rig['frameCount'])]
    else:
        frames = [render(rig, i * rig['frameDurationMs'], texture, vertices, weights, target) for i in range(rig['frameCount'])]
    durations = [rig['frameDurationMs']] * len(frames)
    atlas = Image.new('RGBA', (size * rig['columns'], size * math.ceil(len(frames) / rig['columns'])), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.paste(frame, (index % rig['columns'] * size, index // rig['columns'] * size))
    atlas.save(folder / 'idle.png')
    atlas.save(folder / 'idle.webp', 'WEBP', **{'lossless': True, 'method': 4})
    options = {'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'minimize_size': False}
    frames[0].save(folder / 'idle-preview.webp', 'WEBP', **options)
    small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
    small_options = {**options, 'append_images': small[1:]}
    small[0].save(folder / 'idle-thumbnail.webp', 'WEBP', **small_options)
    gif_frames = []
    for frame in frames:
        background = Image.new('RGBA', (384, 384), (39, 47, 40, 255))
        background.alpha_composite(frame.resize((384, 384), Image.Resampling.LANCZOS))
        gif_frames.append(background.convert('RGB'))
    palette = gif_frames[0].quantize(255)
    indexed = [frame.quantize(255, None, 0, palette, Image.Dither.NONE) for frame in gif_frames]
    indexed[0].save(folder / 'idle-preview.gif', 'GIF', **{'save_all': True, 'append_images': indexed[1:], 'duration': durations, 'loop': 0, 'optimize': False, 'disposal': 2})
    manifest = {
        'name': 'soil-boar',
        'action': 'idle',
        'revision': 1,
        'method': 'Rendered continuous weighted-mesh animation from the approved original artwork.',
        'designReference': rig['designReference'],
        'referenceSha256': rig['referenceSha256'],
        'sourceTexture': rig['texture'],
        'rig': 'rig.json',
        'renderer': 'render.py',
        'motion': '묵직한 호흡, 짧고 긴 두 번의 킁킁, 한쪽 귀와 꼬리의 작은 반응, 제자리 복귀.',
        'frameSize': [size, size],
        'columns': rig['columns'],
        'frameCount': len(frames),
        'durationsMs': durations,
        'durationMs': sum(durations),
        'loop': True,
        'rootMotion': False,
        'atlas': 'idle.png',
        'runtimeAtlas': 'idle.webp',
        'preview': 'idle-preview.webp',
        'gif': 'idle-preview.gif',
        'thumbnail': 'idle-thumbnail.webp',
        'contact': 'idle-contact.png',
        'sourcePreparation': {'resize': list(ImageOps.contain(Image.open(reference), (size, size), Image.Resampling.LANCZOS).size), 'alphaCleanupThreshold': 8, 'perFrameFitting': False, 'hiddenSurfacesExposed': False},
        'stationaryPixels': {'belowY': rig['fixedRegion']['belowY'], 'includes': 'All four hoof contact patches'},
        'spineCompatibilityVerified': False
    }
    write_json(folder / 'idle.json', manifest)
    print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'canvas': [size, size], 'atlas': list(atlas.size)}))


if __name__ == '__main__':
    main()
