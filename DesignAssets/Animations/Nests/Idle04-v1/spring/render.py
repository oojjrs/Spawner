import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


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


def bezier(points):
    result = []
    for index in range(0, len(points) - 1, 3):
        a, b, c, d = np.asarray(points[index:index + 4], np.float32)
        for t in np.linspace(0, 1, 20):
            result.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d))
    return result


def make_parts():
    source = read(SOURCES / 'reference.png')
    under = np.asarray(Image.open(SOURCES / 'wheel-underpainting.png').convert('RGBA').resize((164, 146), Image.Resampling.LANCZOS), np.float32) / 255
    underlayer = source.copy()
    underlayer[184:330, 60:224] = under
    wheel_mask = polygon([(90, 218), (110, 209), (134, 207), (151, 218), (168, 244), (176, 272), (176, 298), (163, 305), (136, 304), (126, 300), (115, 286), (102, 279), (89, 263), (86, 241)])
    rim_points = bezier([(88, 218), (110, 211), (130, 234), (136, 260), (140, 280), (136, 293), (126, 303)])
    rim_points += bezier([(119, 298), (126, 280), (125, 266), (117, 246), (108, 233), (97, 228), (88, 228)])
    rim = polygon(rim_points)
    axle = polygon([(60, 253), (79, 250), (92, 250), (102, 261), (105, 275), (99, 286), (83, 290), (67, 280)])
    protected = np.maximum(rim, axle)
    write(PARTS / 'stationary-underlayer.png', underlayer)
    write(PARTS / 'wheel-edit-mask.png', np.dstack([wheel_mask] * 4))
    write(PARTS / 'foreground-mask.png', np.dstack([protected] * 4))
    foreground = source.copy()
    foreground[..., 3] *= protected
    write(PARTS / 'foreground-rim-and-axle.png', foreground)
    texture = source[248:259, 145:160].copy()
    texture[..., 3] = 1
    texture = np.asarray(Image.fromarray(np.uint8(texture * 255)).resize((160, 48), Image.Resampling.BICUBIC), np.float32) / 255
    write(PARTS / 'gold-paddle-face.png', texture)
    back = texture.copy()
    back[..., :3] *= np.array([0.76, 0.69, 0.66])
    write(PARTS / 'gold-paddle-back.png', back)
    edge = source[246:250, 144:159].copy()
    edge[..., 3] = 1
    edge = np.asarray(Image.fromarray(np.uint8(edge * 255)).resize((160, 24), Image.Resampling.BICUBIC), np.float32) / 255
    write(PARTS / 'gold-paddle-edge.png', edge)
    atlas = read(SOURCES / 'splash-keyposes.png')
    width = atlas.shape[1] // 3
    crowns = []
    for index, name in enumerate(['rise', 'peak', 'fall']):
        cell = atlas[:, index * width:(index + 1) * width].copy()
        labels, count = ndimage.label(cell[..., 3] > 0.12)
        areas = np.bincount(labels.ravel())
        areas[0] = 0
        component = labels == np.argmax(areas)
        component = ndimage.binary_dilation(component, None, 2)
        crown = cell.copy()
        crown[..., 3] *= component
        write(PARTS / ('splash-' + name + '.png'), crown)
        crowns.append(crown)
        if index == 1:
            components = []
            for label in range(1, count + 1):
                area = areas[label]
                if area < 60 or label == np.argmax(areas):
                    continue
                ys, xs = np.nonzero(labels == label)
                a, b, c, d = xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3
                if a < 0 or b < 0 or c > width or d > cell.shape[0]:
                    continue
                drop = cell[b:d, a:c].copy()
                drop[..., 3] *= labels[b:d, a:c] == label
                if len(components) < 8:
                    write(PARTS / ('droplet-' + str(len(components)) + '.png'), drop)
                    components.append([int(a), int(b), int(c), int(d)])
            record(PARTS / 'droplets.json', components)
    return source, underlayer, wheel_mask, protected, texture, back, edge, crowns


class Wheel:
    def __init__(self, front, back, edge):
        self.front, self.back, self.edge = front, back, edge
        self.origin = np.array([105.0, 260.0])
        self.u = np.array([26.0, 7.0])
        self.v = np.array([7.0, 44.0])
        self.axis = np.array([41.0, -12.0])
        rows = np.array([[26, 7, 41], [7, 44, -12]])
        self.camera = np.cross(rows[0], rows[1])
        self.camera = self.camera / -self.camera[2]
        self.rect = (68, 194, 190, 312)
        self.scale = 3

    def project(self, points):
        points = np.asarray(points, np.float32)
        xy = self.origin + points[:, 0:1] * self.u + points[:, 1:2] * self.v + points[:, 2:3] * self.axis
        xy = (xy - np.asarray(self.rect[:2])) * self.scale
        depth = points @ self.camera
        return np.column_stack((xy, depth))

    def triangle(self, vertices, uv, texture, shade):
        a, b, c = vertices
        low = np.maximum(np.floor(np.min(vertices[:, :2], 0)).astype(int), [0, 0])
        high = np.minimum(np.ceil(np.max(vertices[:, :2], 0)).astype(int), [self.w - 1, self.h - 1])
        if np.any(high < low):
            return
        y, x = np.mgrid[low[1]:high[1] + 1, low[0]:high[0] + 1]
        denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(denominator) < 0.001:
            return
        w0 = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / denominator
        w1 = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / denominator
        w2 = 1 - w0 - w1
        z = w0 * a[2] + w1 * b[2] + w2 * c[2]
        section = self.depth[low[1]:high[1] + 1, low[0]:high[0] + 1]
        active = (w0 >= 0) & (w1 >= 0) & (w2 >= 0) & (z >= section - 0.00001)
        if not np.any(active):
            return
        section[active] = z[active]
        if texture is None:
            return
        tx = (w0 * uv[0, 0] + w1 * uv[1, 0] + w2 * uv[2, 0]) * (texture.shape[1] - 1)
        ty = (w0 * uv[0, 1] + w1 * uv[1, 1] + w2 * uv[2, 1]) * (texture.shape[0] - 1)
        colors = sample(texture, tx[active], ty[active])
        colors[:, :3] *= shade
        colors[:, 3] = 1
        target = self.pixels[low[1]:high[1] + 1, low[0]:high[0] + 1]
        target[active] = colors

    def quad(self, points, texture, shade):
        vertices = self.project(points)
        uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]])
        for ids in [[0, 1, 2], [0, 2, 3]]:
            self.triangle(vertices[ids], uv[ids], texture, shade)

    def point(self, angle, radial, tangent, axial):
        return [math.cos(angle) * radial - math.sin(angle) * tangent, math.sin(angle) * radial + math.cos(angle) * tangent, axial]

    def render(self, seconds):
        left, top, right, bottom = self.rect
        self.w, self.h = (right - left) * self.scale, (bottom - top) * self.scale
        self.depth = np.full((self.h, self.w), -1.0e10)
        self.pixels = np.zeros((self.h, self.w, 4), np.float32)
        for index in range(64):
            a = index * math.tau / 64
            b = (index + 1) * math.tau / 64
            self.quad([self.point(a, 0.87, 0, 0), self.point(a, 0.87, 0, 1), self.point(b, 0.87, 0, 1), self.point(b, 0.87, 0, 0)], None, 1)
        angle = seconds / PERIOD * math.tau
        for index in range(6):
            a = angle + index * math.tau / 6
            self.quad([self.point(a, 0.13, -0.057, -0.024), self.point(a, 0.91, -0.057, -0.024), self.point(a, 0.91, 0.057, -0.024), self.point(a, 0.13, 0.057, -0.024)], self.front, 0.78)
        for index in range(8):
            a = angle + index * math.tau / 8 - math.pi / 2
            normals = [np.array([math.cos(a), math.sin(a), 0]), np.array([-math.sin(a), math.cos(a), 0]), np.array([0, 0, 1])]
            p = lambda r, q, z: self.point(a, r, q, z)
            if normals[0] @ self.camera > 0:
                self.quad([p(1.02, -0.15, 0.13), p(1.02, -0.15, 1.00), p(1.02, 0.15, 1.00), p(1.02, 0.15, 0.13)], self.front, 0.98)
            else:
                self.quad([p(0.86, -0.15, 0.13), p(0.86, 0.15, 0.13), p(0.86, 0.15, 1.00), p(0.86, -0.15, 1.00)], self.back, 0.87)
            side = 0.15 if normals[1] @ self.camera > 0 else -0.15
            self.quad([p(0.86, side, 0.13), p(0.86, side, 1.00), p(1.02, side, 1.00), p(1.02, side, 0.13)], self.edge, 0.98 if side < 0 else 0.79)
            self.quad([p(0.86, -0.15, 0.13), p(1.02, -0.15, 0.13), p(1.02, 0.15, 0.13), p(0.86, 0.15, 0.13)], self.edge, 0.87)
        small = Image.fromarray(np.uint8(np.clip(self.pixels * 255, 0, 255))).resize((right - left, bottom - top), Image.Resampling.LANCZOS)
        result = np.zeros((SIZE, SIZE, 4), np.float32)
        result[top:bottom, left:right] = np.asarray(small, np.float32) / 255
        return result


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
    source, underlayer, wheel_mask, protected, front, back, edge, crowns = make_parts()
    wheel = Wheel(front, back, edge)
    splash = Splash(crowns)
    pool = polygon([(116, 339), (158, 325), (221, 319), (278, 322), (337, 324), (394, 332), (428, 343), (422, 363), (383, 382), (320, 393), (244, 394), (173, 379), (133, 361)])
    upper_pool = ellipse(226, 150, 72, 12, 0.2)
    tank = polygon([(358, 214), (381, 214), (386, 224), (383, 241), (356, 241), (351, 229), (353, 220)])
    write(PARTS / 'pool-mask.png', np.dstack([pool] * 4))
    write(PARTS / 'tank-mask.png', np.dstack([tank] * 4))
    fall_rows = [
        [[174, 232, 265], [194, 243, 274], [218, 249, 281], [244, 258, 289], [264, 267, 295]],
        [[270, 275, 306], [283, 280, 312], [300, 284, 318], [307, 290, 320]],
        [[216, 145, 157], [231, 153, 167], [250, 160, 174], [278, 169, 181], [299, 171, 183]]
    ]
    falls = [Fall(source, rows, 8, offset) for rows, offset in zip(fall_rows, [0, 0.29, 0.57])]
    for index, fall in enumerate(falls):
        write(PARTS / ('waterflow-' + str(index) + '.png'), fall.field)
    ripple_source = read(SOURCES / 'ripple-ring.png')
    write(PARTS / 'ripple-ring.png', ripple_source)
    bubble_source = splash.drops[0]
    write(PARTS / 'bubble.png', bubble_source)
    rig = {
        'format': 'custom-layered-2d-and-rigid-projection', 'frameSize': [512, 512], 'pivot': [256, 448], 'fps': 30,
        'periodMs': 4000, 'frameCount': 120, 'rootMotion': False,
        'wheel': {'origin': wheel.origin.tolist(), 'planeU': wheel.u.tolist(), 'planeV': wheel.v.tolist(), 'depth': wheel.axis.tolist(), 'paddleCount': 8, 'spokeCount': 6, 'rigid': True, 'angleKeys': [[0, 0], [1, 90], [2, 180], [3, 270], [4, 360]], 'interpolation': 'linear', 'foreground': 'Parts/foreground-rim-and-axle.png'},
        'waterflows': [{'rows': f.rows, 'cyclesPerLoop': f.cycles, 'phase': f.offset} for f in falls],
        'splash': {'drawnKeys': ['Parts/splash-rise.png', 'Parts/splash-peak.png', 'Parts/splash-fall.png'], 'keys': [[0, 'fall'], [0.25, 'rise'], [0.45, 'peak'], [0.8, 'fall'], [2.2, 'rise'], [2.4, 'peak'], [2.75, 'fall'], [4, 'fall']], 'method': 'one painted peak texture on a continuous column mesh, crown contours supplied by all three drawn keys; separate ballistic droplets', 'anchor': [300.5, 313], 'sourceAnchor': [362, 625], 'scale': 0.087, 'poseOpacityBlending': False},
        'attachments': [{'id': 'paddle-' + str(i), 'parent': 'wheel-axis', 'phaseDegrees': i * 45, 'radialBounds': [0.86, 1.02], 'tangentBounds': [-0.15, 0.15], 'axialBounds': [0.13, 1.0], 'weight': 1} for i in range(8)],
        'masks': ['Parts/wheel-edit-mask.png', 'Parts/foreground-mask.png', 'Parts/pool-mask.png', 'Parts/tank-mask.png']
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
        replace(image, underlayer, wheel_mask)
        wheel_layer = wheel.render(t)
        wheel_layer[..., 3] *= wheel_mask
        over(image, wheel_layer)
        replace(image, source, protected)
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
        record(ROOT / 'animation.json', {'name': 'spring-nest-level-04-idle', 'reference': 'Sources/reference.png', 'image': 'idle-sheet.webp', 'animatedImage': 'idle.webp', 'preview': 'preview.gif', 'frameSize': [512, 512], 'frameCount': 120, 'columns': 12, 'rows': 10, 'durationsMs': durations, 'periodMs': 4000, 'pivot': [256, 448], 'rootMotion': False, 'loop': True, 'rig': 'rig.json', 'renderer': 'render.py'})


if __name__ == '__main__':
    run()
