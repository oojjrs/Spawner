import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
PARTS = ROOT / 'Parts'
SOURCES = ROOT / 'Sources'
FRAMES = ROOT / 'Frames'
SIZE = 512
FPS = 30
COUNT = 120
PERIOD = 4.0
YY, XX = np.mgrid[0:SIZE, 0:SIZE]


def read(path):
    return np.asarray(Image.open(path).convert('RGBA'), np.float32) / 255


def write(path, pixels):
    Image.fromarray(np.uint8(np.clip(pixels * 255 + 0.5, 0, 255))).save(path, 'PNG')


def record(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def polygon(points):
    image = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(image).polygon([(int(x * 4), int(y * 4)) for x, y in points], 255)
    return np.asarray(image.resize((SIZE, SIZE), Image.Resampling.LANCZOS), np.float32) / 255


def ellipse(cx, cy, rx, ry, soft):
    distance = np.sqrt(((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2)
    return np.clip((1 - distance) / soft, 0, 1)


def sample(texture, x, y):
    height, width = texture.shape[:2]
    x = np.clip(x, 0, width - 1.001)
    y = np.clip(y, 0, height - 1.001)
    x0 = x.astype(np.int32)
    y0 = y.astype(np.int32)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    return (texture[y0, x0] * (1 - fx) + texture[y0, x0 + 1] * fx) * (1 - fy) + (texture[y0 + 1, x0] * (1 - fx) + texture[y0 + 1, x0 + 1] * fx) * fy


def replace(base, layer, mask):
    base[:] = base * (1 - mask[..., None]) + layer * mask[..., None]


def over(base, layer):
    alpha = layer[..., 3:4]
    out_alpha = alpha + base[..., 3:4] * (1 - alpha)
    rgb = (layer[..., :3] * alpha + base[..., :3] * base[..., 3:4] * (1 - alpha)) / np.maximum(out_alpha, 0.00001)
    base[..., :3] = rgb
    base[..., 3:4] = out_alpha


def make_parts():
    source = read(SOURCES / 'reference-no-wheel.png')
    crowns = [read(PARTS / ('splash-' + name + '.png')) for name in ['rise', 'peak', 'fall']]
    return source, crowns


class Fall:
    def __init__(self, source, rows, cycles, offset):
        self.rows, self.cycles, self.offset = rows, cycles, offset
        self.y0, self.y1 = rows[0][0], rows[-1][0]
        self.left = np.interp(YY, [r[0] for r in rows], [r[1] for r in rows])
        self.right = np.interp(YY, [r[0] for r in rows], [r[2] for r in rows])
        self.u = np.clip((XX - self.left) / (self.right - self.left), 0, 1)
        self.v = np.clip((YY - self.y0) / (self.y1 - self.y0), 0, 1)
        self.mask = np.clip(np.minimum.reduce([(XX - self.left) / 1.7, (self.right - XX) / 1.7, (YY - self.y0) / 1.7, (self.y1 - YY) / 1.7]), 0, 1)
        vv, uu = np.mgrid[0:128, 0:96]
        ys = self.y0 + vv / 127 * (self.y1 - self.y0)
        ls = np.interp(ys, [r[0] for r in rows], [r[1] for r in rows])
        rs = np.interp(ys, [r[0] for r in rows], [r[2] for r in rows])
        self.field = sample(source, ls + uu / 95 * (rs - ls), ys)
        self.mean = np.mean(self.field, 0)

    def apply(self, image, source, seconds):
        phase = (self.v - self.cycles * seconds / PERIOD + self.offset) % 1
        tex = sample(self.field, self.u * 95, phase * 127)
        mean = self.mean[np.clip(np.int32(self.u * 95), 0, 95)]
        color = source.copy()
        color[..., :3] = source[..., :3] * 0.38 + mean[..., :3] * 0.62 + (tex[..., :3] - mean[..., :3]) * (0.88 * np.sin(phase[..., None] * np.pi) ** 2)
        replace(image, color, self.mask)


class Splash:
    def __init__(self, crowns):
        self.crowns = crowns
        self.tops, self.bottoms = [], []
        for crown in crowns:
            valid = crown[..., 3] > 0.15
            top = np.argmax(valid, 0).astype(float)
            bottom = valid.shape[0] - 1 - np.argmax(valid[::-1], 0)
            good = np.any(valid, 0)
            self.tops.append(np.interp(np.arange(valid.shape[1]), np.flatnonzero(good), top[good]))
            self.bottoms.append(np.interp(np.arange(valid.shape[1]), np.flatnonzero(good), bottom[good]))
        self.texture = crowns[1]
        self.drops = [read(p) for p in sorted(PARTS.glob('droplet-*.png'))]

    def apply(self, image, seconds):
        times = [0.0, 0.25, 0.45, 0.8, 1.15, 2.2, 2.4, 2.75, 3.15, 4.0]
        poses = [2, 0, 1, 2, 2, 0, 1, 2, 2, 2]
        interval = min(np.searchsorted(times, seconds, 'right') - 1, len(times) - 2)
        q = (seconds - times[interval]) / (times[interval + 1] - times[interval])
        q = q * q * (3 - 2 * q)
        a, b = poses[interval], poses[interval + 1]
        top = self.tops[a] * (1 - q) + self.tops[b] * q
        bottom = self.bottoms[a] * (1 - q) + self.bottoms[b] * q
        scale = 0.087
        high_y, high_x = np.mgrid[0:135, 0:216]
        x = (high_x / 3 + 265 - 300.5) / scale + 362
        y = (high_y / 3 + 273 - 313.0) / scale + 625
        col = np.clip(np.int32(x), 0, self.texture.shape[1] - 1)
        vertical = (y - top[col]) / np.maximum(bottom[col] - top[col], 1)
        source_y = self.tops[1][col] + vertical * (self.bottoms[1][col] - self.tops[1][col])
        premultiplied = self.texture.copy()
        premultiplied[..., :3] *= premultiplied[..., 3:4]
        layer = sample(premultiplied, x, source_y)
        layer[..., :3] /= np.maximum(layer[..., 3:4], 0.00001)
        layer[..., 3] *= (x >= 0) & (x < self.texture.shape[1]) & (vertical >= 0) & (vertical <= 1)
        reduced = Image.fromarray(np.uint8(np.clip(layer * 255 + 0.5, 0, 255))).resize((72, 45), Image.Resampling.LANCZOS)
        over(image[273:318, 265:337], np.asarray(reduced, np.float32) / 255)
        for start in [0.25, 2.2]:
            age = seconds - start
            if age < 0 or age > 0.68:
                continue
            for index in range(min(5, len(self.drops))):
                velocity_x = [-20, -11, 3, 14, 23][index]
                velocity_y = [-42, -54, -58, -49, -36][index]
                x0 = 300 + velocity_x * age
                y0 = 308 + velocity_y * age + 80 * age * age
                if y0 < 311:
                    sprite(image, self.drops[index], x0, y0, 2.2 + index % 2 * 0.6, 3.0, np.ones((SIZE, SIZE)))


def sprite(image, texture, cx, cy, width, height, clip):
    left = max(0, int(cx - width / 2 - 1))
    right = min(SIZE, int(cx + width / 2 + 2))
    top = max(0, int(cy - height / 2 - 1))
    bottom = min(SIZE, int(cy + height / 2 + 2))
    if right <= left or bottom <= top:
        return
    y, x = np.mgrid[top:bottom, left:right]
    tx = (x - cx) / width + 0.5
    ty = (y - cy) / height + 0.5
    premultiplied = texture.copy()
    premultiplied[..., :3] *= premultiplied[..., 3:4]
    layer = sample(premultiplied, tx * (texture.shape[1] - 1), ty * (texture.shape[0] - 1))
    layer[..., :3] /= np.maximum(layer[..., 3:4], 0.00001)
    layer[..., 3] *= (tx >= 0) & (tx <= 1) & (ty >= 0) & (ty <= 1)
    layer[..., 3] *= clip[top:bottom, left:right]
    over(image[top:bottom, left:right], layer)


def run():
    source, crowns = make_parts()
    splash = Splash(crowns)
    pool = polygon([(116, 339), (158, 325), (221, 319), (278, 322), (337, 324), (394, 332), (428, 343), (422, 363), (383, 382), (320, 393), (244, 394), (173, 379), (133, 361)])
    upper_pool = ellipse(226, 150, 72, 12, 0.2)
    tank = polygon([(358, 214), (381, 214), (386, 224), (383, 241), (356, 241), (351, 229), (353, 220)])
    write(PARTS / 'pool-mask.png', np.dstack([pool] * 4))
    write(PARTS / 'tank-mask.png', np.dstack([tank] * 4))
    flow_specs = [
        {'name': 'central-upper', 'rows': [[174, 232, 265], [194, 243, 274], [218, 249, 281], [244, 258, 289], [264, 267, 295]], 'phase': 0.0},
        {'name': 'central-lower', 'rows': [[270, 275, 306], [283, 280, 312], [300, 284, 318], [307, 290, 320]], 'phase': 0.29},
        {'name': 'left-upper', 'rows': [[201, 119, 139], [207, 128, 147], [216, 134, 153], [226, 137, 157], [234, 139, 159]], 'phase': 0.57},
        {'name': 'left-middle', 'rows': [[239, 145, 163], [246, 150, 168], [256, 155, 174], [266, 157, 177]], 'phase': 0.72},
        {'name': 'left-lower', 'rows': [[272, 170, 187], [281, 173, 194], [290, 174, 197], [298, 176, 198]], 'phase': 0.88}
    ]
    falls = [Fall(source, spec['rows'], 8, spec['phase']) for spec in flow_specs]
    for index, fall in enumerate(falls):
        write(PARTS / ('waterflow-' + str(index) + '.png'), fall.field)
    ripple_source = read(SOURCES / 'ripple-ring.png')
    write(PARTS / 'ripple-ring.png', ripple_source)
    bubble_source = splash.drops[0]
    write(PARTS / 'bubble.png', bubble_source)
    rig = {
        'format': 'custom-layered-2d-waterflow', 'frameSize': [512, 512], 'pivot': [256, 448], 'fps': 30,
        'periodMs': 4000, 'frameCount': 120, 'rootMotion': False,
        'staticBase': 'Sources/reference-no-wheel.png', 'wheelRemoved': True, 'baseKeyframeApprovedByUser': True,
        'waterflows': [{'name': spec['name'], 'rows': f.rows, 'cyclesPerLoop': f.cycles, 'phase': f.offset} for spec, f in zip(flow_specs, falls)],
        'splash': {'drawnKeys': ['Parts/splash-rise.png', 'Parts/splash-peak.png', 'Parts/splash-fall.png'], 'keys': [[0, 'fall'], [0.25, 'rise'], [0.45, 'peak'], [0.8, 'fall'], [2.2, 'rise'], [2.4, 'peak'], [2.75, 'fall'], [4, 'fall']], 'method': 'one painted peak texture on a continuous column mesh, crown contours supplied by all three drawn keys; separate ballistic droplets', 'anchor': [300.5, 313], 'sourceAnchor': [362, 625], 'scale': 0.087, 'poseOpacityBlending': False},
        'attachments': ['Parts/splash-rise.png', 'Parts/splash-peak.png', 'Parts/splash-fall.png', 'Parts/ripple-ring.png', 'Parts/bubble.png'],
        'masks': ['Parts/pool-mask.png', 'Parts/tank-mask.png']
    }
    record(ROOT / 'rig.json', rig)
    selected = [int(v) for v in sys.argv[1:]]
    indices = selected if selected else range(COUNT + 1)
    for index in indices:
        t = index / FPS
        phase = t / PERIOD * math.tau
        image = source.copy()
        pool_x = XX + pool * (0.65 * np.sin(phase * 2 + YY * 0.13) + 0.35 * np.sin(phase * 3 + XX * 0.07))
        pool_y = YY + pool * 0.35 * np.cos(phase * 2 + XX * 0.10)
        replace(image, sample(source, pool_x, pool_y), pool)
        replace(image, sample(source, XX + upper_pool * 0.5 * np.sin(phase * 2 + YY * 0.2), YY + upper_pool * 0.2 * np.cos(phase * 3 + XX * 0.2)), upper_pool)
        for fall in falls:
            fall.apply(image, source, t)
        for index_ripple in range(3):
            age = (t / 2 + index_ripple / 3) % 1
            sprite(image, ripple_source, 303 - age * 22, 316 + age * 34, 16 + age * 136, 2 + age * 15, pool * (1 - age) ** 1.7 * 0.42)
        for index_bubble in range(5):
            age = (t / PERIOD * 2 + index_bubble * 0.213) % 1
            bx = 358 + index_bubble * 5.0 + 0.6 * math.sin(phase * 2 + index_bubble)
            by = 244 - age * 31
            sprite(image, bubble_source, bx, by, 2.5 + index_bubble % 2 * 0.7, 3.0 + index_bubble % 2 * 0.7, tank)
        splash.apply(image, t)
        output = ROOT / 'loop-end-check.png' if index == COUNT else FRAMES / ('frame-' + str(index).zfill(3) + '.png')
        write(output, image)
        if index % 30 == 0:
            print('rendered', index, flush=True)
    if not selected:
        durations = [33, 33, 34] * 40
        record(ROOT / 'animation.json', {'name': 'spring-nest-level-04-idle', 'reference': 'Sources/reference-no-wheel.png', 'image': 'idle-sheet.webp', 'animatedImage': 'idle.webp', 'preview': 'preview.gif', 'frameSize': [512, 512], 'frameCount': 120, 'columns': 12, 'rows': 10, 'durationsMs': durations, 'periodMs': 4000, 'pivot': [256, 448], 'rootMotion': False, 'loop': True, 'rig': 'rig.json', 'renderer': 'render.py'})


if __name__ == '__main__':
    run()
