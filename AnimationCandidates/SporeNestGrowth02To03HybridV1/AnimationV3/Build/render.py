from pathlib import Path
import sys
import json
import math
import shutil

PROJECT = Path('H:/Spawner')
sys.path.insert(0, str(PROJECT / '$Trash/creature-emergence-20261030/python'))
sys.path.insert(0, str(PROJECT / '$Trash/SproutNestQuantumV1/dependencies'))
import numpy as np
import cv2
from PIL import Image, ImageDraw, WebPImagePlugin, GifImagePlugin

BASE = PROJECT / 'AnimationCandidates/SporeNestGrowth02To03HybridV1'
ROOT = BASE / 'AnimationV3'
SRC = ROOT / 'Sources'
PARTS = ROOT / 'Parts'
BUILD = ROOT / 'Build'
FRAMES = ROOT / 'Frames'
WORK = PROJECT / '$Trash/SporeNestGrowth02To03DeepProductionV3'
IDLE = PROJECT / 'DesignAssets/Animations/Nests/Idle03-v1/spore'
SMALL = PROJECT / 'DesignAssets/Animations/Nests/SporeLevel02-v4'
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
TIMES = np.array([.5, .95, 1.4, 1.75, 2.1, 2.8, 3.6])


def save_json(path, data):
    path.write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))


def read(path):
    return Image.open(path).convert('RGBA')


def pre(im):
    a = np.array(im).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def rgba(a):
    a = np.clip(a, 0, 1).copy()
    a[:, :, :3] /= np.maximum(a[:, :, 3:4], 1e-8)
    a = np.uint8(np.clip(a * 255 + .5, 0, 255))
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def bounds(im):
    yy, xx = np.where(np.array(im)[:, :, 3] > 80)
    return [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]


def main_component(mask):
    n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(mask), 8)
    return np.uint8(labels == (1 + int(np.argmax(stats[1:, 4]))))


def transform(texture, matrix):
    return cv2.warpAffine(texture, np.array(matrix, np.float32), (512, 512), None, cv2.INTER_LANCZOS4, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def fit_source(im, width, center, bottom):
    left, top, right, low = bounds(im)
    scale = width / (right - left)
    matrix = [[scale, 0, center - scale * (left + right) / 2], [0, scale, bottom - scale * (low - 1)]]
    return rgba(transform(pre(im), matrix))


def cap_extract(im):
    a = np.array(im)
    r, g, b = [a[:, :, i].astype(float) for i in range(3)]
    red = (r - g > 30) & (r - b > 18) & (b > .78 * g) & (a[:, :, 3] > 60)
    core = main_component(red)
    expanded = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    allowed = red | ((r + g + b < 360) & (a[:, :, 3] > 0))
    mask = np.uint8((expanded > 0) & allowed)
    contours = cv2.findContours(core, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if contours[1] is not None:
        for i, contour in enumerate(contours[0]):
            if contours[1][0][i][3] >= 0:
                cv2.drawContours(mask, [contour], -1, 1, cv2.FILLED)
    cap = a.copy()
    cap[:, :, 3] *= mask
    cap[cap[:, :, 3] == 0] = 0
    body = a.copy()
    body[:, :, 3] *= 1 - mask
    body[body[:, :, 3] == 0] = 0
    return Image.fromarray(cap), Image.fromarray(body)


def shape(im, pink_lip):
    a = np.array(im)
    valid = []
    top = np.zeros(512)
    lip = np.zeros(512)
    bottom = np.zeros(512)
    for x in range(512):
        yy = np.where(a[:, x, 3] > 60)[0]
        if not len(yy):
            continue
        valid.append(x)
        top[x], bottom[x] = yy.min(), yy.max()
        lip[x] = (top[x] + bottom[x]) / 2
        lip[x] = min(bottom[x] - .2, max(top[x] + .2, lip[x]))
    u = np.linspace(0, 1, 97)
    xs = valid[0] + u * (valid[-1] - valid[0])
    profiles = [np.interp(xs, valid, v[valid]) for v in [top, lip, bottom]]
    profiles[0] -= 1.5
    profiles[2] += 1.5
    return np.r_[float(valid[0] - 1), float(valid[-1] + 1), profiles[0], profiles[1], profiles[2]].astype(np.float32)


def front_curve(cap, points):
    a = np.array(cap)
    line = np.interp(np.arange(512), [p[0] for p in points], [p[1] for p in points])
    a[Y > line[None, :]] = 0
    return Image.fromarray(a)


def cleaned_part(im):
    a = np.array(im)
    mask = cv2.dilate(main_component(a[:, :, 3] > 60), np.ones((3, 3), np.uint8))
    a[:, :, 3] *= mask
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)


def profile_warp(texture, source, target):
    u = (X - target[0]) / max(.1, target[1] - target[0])
    clipped = np.clip(u, 0, 1)
    knots = np.linspace(0, 1, 97)
    st, sl, sb = [np.interp(clipped, knots, source[2 + i * 97:2 + (i + 1) * 97]) for i in range(3)]
    dt, dl, db = [np.interp(clipped, knots, target[2 + i * 97:2 + (i + 1) * 97]) for i in range(3)]
    src_x = source[0] + clipped * (source[1] - source[0])
    upper = (Y - dt) / np.maximum(dl - dt, .3)
    lower = (Y - dl) / np.maximum(db - dl, .3)
    src_y = np.where(Y <= dl, st + upper * (sl - st), sl + lower * (sb - sl))
    out = cv2.remap(texture, src_x.astype(np.float32), src_y.astype(np.float32), cv2.INTER_LANCZOS4, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
    out[(u < 0) | (u > 1) | (Y < dt - .5) | (Y > db + .5)] = 0
    return out


def pchip(values, t):
    h = np.diff(TIMES)
    delta = np.diff(values, 1, 0) / h[:, None]
    slopes = np.zeros_like(values)
    slopes[0] = delta[0]
    slopes[-1] = delta[-1]
    for k in range(1, len(TIMES) - 1):
        same = delta[k - 1] * delta[k] > 0
        w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
        slopes[k, same] = (w1 + w2) / (w1 / delta[k - 1, same] + w2 / delta[k, same])
    if t <= TIMES[0]:
        return values[0]
    if t >= TIMES[-1]:
        return values[-1]
    k = min(len(TIMES) - 2, int(np.searchsorted(TIMES, t, 'right')) - 1)
    q = (t - TIMES[k]) / h[k]
    return (2 * q ** 3 - 3 * q ** 2 + 1) * values[k] + (q ** 3 - 2 * q ** 2 + q) * h[k] * slopes[k] + (-2 * q ** 3 + 3 * q ** 2) * values[k + 1] + (q ** 3 - q ** 2) * h[k] * slopes[k + 1]


def smooth(q):
    q = float(np.clip(q, 0, 1))
    return q * q * (3 - 2 * q)


def rigid(texture, pivot, angle, shift):
    theta = math.radians(angle)
    c, s = math.cos(theta), math.sin(theta)
    return transform(texture, [[c, -s, pivot[0] + shift[0] - c * pivot[0] + s * pivot[1]], [s, c, pivot[1] + shift[1] - s * pivot[0] - c * pivot[1]]])


def lower_body(texture, source, target):
    anchor = (source[0] + source[1]) / 2
    destination = (target[0] + target[1]) / 2
    q = np.clip((Y - 335) / 112, 0, 1)
    q = q * q * (3 - 2 * q)
    scale = 1 + ((target[1] - target[0]) / (source[1] - source[0]) - 1) * q
    mx = (X - anchor - (destination - anchor) * q) / scale + anchor
    body = cv2.remap(texture, mx.astype(np.float32), Y, cv2.INTER_LANCZOS4, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
    u = np.clip((X - target[0]) / (target[1] - target[0]), 0, 1)
    cut = np.interp(u, np.linspace(0, 1, 97), target[2:99]) + 4
    body[Y > cut] = 0
    body[((X < target[0]) | (X > target[1])) & (Y > target[2:99].min() + 2)] = 0
    return body


def contact(images, labels, path, columns):
    out = Image.new('RGB', (384 * columns, 414 * math.ceil(len(images) / columns)), '#15241f')
    draw = ImageDraw.Draw(out)
    for i, im in enumerate(images):
        bg = Image.new('RGBA', (512, 512), '#15241f')
        bg.alpha_composite(im)
        x, y = i % columns * 384, i // columns * 414
        out.paste(bg.convert('RGB').resize((384, 384), Image.Resampling.LANCZOS), (x, y + 25))
        draw.text((x + 10, y + 7), labels[i], '#e4eddd')
    out.save(path)


def animated(frames, path, duration, loops):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': duration, 'loop': loops, 'lossless': True, 'method': 4, 'exact': True, 'minimize_size': False, 'kmin': 1, 'kmax': 1}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0], f, str(path))


def setup():
    for folder in [ROOT, SRC, PARTS, BUILD, FRAMES, WORK]:
        folder.mkdir(511, True, True)
    keypaths = [BASE / 'KeyframesV2/00-start.png', BASE / 'KeyframesV2/01-half-close.png', BASE / 'KeyframesV3/02-closed-small.png', BASE / 'KeyframesV3/03-closed-medium.png', BASE / 'KeyframesV3/04-closed-adult.png', BASE / 'KeyframesV2/05-half-open.png', BASE / 'KeyframesV2/06-end.png']
    for i, p in enumerate(keypaths):
        shutil.copy2(p, SRC / ('key-' + str(i) + '.png'))
    for p in (IDLE / 'Parts').glob('*.png'):
        im = read(p)
        if im.size != (512, 512):
            im = im.resize((512, 512), Image.Resampling.LANCZOS)
        im.save(PARTS / ('adult-' + p.name))
    shutil.copy2(IDLE / 'rig.json', BUILD / 'adult-skeleton-source.json')
    shutil.copy2(PROJECT / 'DesignAssets/Animations/Nests/Growth02To03-v3/spore/animation.json', SRC / 'runtime-contract.json')
    shutil.copy2(SMALL / 'Parts/level-02-body.png', PARTS / 'small-body-source.png')
    shutil.copy2(SMALL / 'Parts/level-02-rear-canopy.png', PARTS / 'small-cap-source.png')
    shutil.copy2(SMALL / 'Parts/level-02-canopy-front.png', PARTS / 'small-cap-front-source.png')
    generated = Path('D:/.codex/generated_images/01a18fdb-911a-7f01-bebc-e59dd13a40fe')
    if not (SRC / 'adult-body-hidden-source.png').exists():
        shutil.copy2(generated / 'exec-ce477152-fe4c-4c08-b923-dd67071c1fc0.png', SRC / 'adult-body-hidden-source.png')
    if not (SRC / 'adult-frame-hidden-source.png').exists():
        shutil.copy2(generated / 'exec-7c08308a-bd54-4c28-911b-7a3eeddd0e88.png', SRC / 'adult-frame-hidden-source.png')
    fit_source(read(SRC / 'adult-body-hidden-source.png'), 338, 244, 447).save(PARTS / 'adult-body-hidden-complete.png')
    fit_source(read(SRC / 'adult-frame-hidden-source.png'), 418, 252, 326).save(PARTS / 'adult-frame-hidden-complete.png')
    caps, feet = [], []
    for i in range(7):
        im = read(SRC / ('key-' + str(i) + '.png'))
        cap, body = cap_extract(im)
        if i in [0, 1, 5, 6]:
            a = np.array(body)
            points = [(100, 406), (127, 381), (150, 375), (181, 391), (217, 409), (256, 412), (289, 405), (324, 384), (354, 376), (383, 388), (414, 409)] if i < 5 else [(76, 413), (101, 384), (128, 378), (160, 390), (195, 409), (225, 420), (257, 420), (287, 410), (323, 387), (350, 381), (382, 393), (414, 413)]
            curve = np.interp(np.arange(512), [p[0] for p in points], [p[1] for p in points])
            a[Y < curve[None, :]] = 0
            r, g, b = [a[:, :, k].astype(float) for k in range(3)]
            a[(r - g > 65) & (b > .75 * g)] = 0
            a[X > (414 if i >= 5 else 415)] = 0
            body = Image.fromarray(a)
        cap = cleaned_part(cap)
        body = cleaned_part(body)
        cap.save(PARTS / ('cap-key-' + str(i) + '.png'))
        body.save(PARTS / ('cradle-front-key-' + str(i) + '.png'))
        caps.append(cap)
        feet.append(body)
    cap3 = read(PARTS / 'adult-canopy-rear.png')
    a = np.array(cap3)
    mask = cv2.dilate(main_component(a[:, :, 3] > 80), np.ones((3, 3), np.uint8))
    a[:, :, 3] *= mask
    cap3 = Image.alpha_composite(Image.fromarray(a), read(PARTS / 'adult-canopy-front.png'))
    cap3.save(PARTS / 'adult-cap-complete.png')
    cap0 = Image.alpha_composite(read(PARTS / 'small-cap-source.png'), read(PARTS / 'small-cap-front-source.png'))
    cap0.save(PARTS / 'small-cap-complete.png')
    caps[0] = cap0
    caps[6] = cap3
    fronts = [read(PARTS / 'small-cap-front-source.png'), front_curve(caps[1], [(49, 318), (75, 301), (110, 288), (145, 275), (172, 273), (202, 296), (232, 309), (260, 311), (289, 298), (320, 276), (345, 273), (375, 288), (412, 299), (438, 302), (456, 322)]), caps[2], caps[3], caps[4], front_curve(caps[5], [(50, 277), (75, 263), (100, 272), (135, 266), (170, 253), (210, 256), (255, 261), (300, 256), (345, 256), (385, 271), (420, 274), (460, 278)]), read(PARTS / 'adult-canopy-front.png')]
    for i, im in enumerate(fronts):
        im.save(PARTS / ('canopy-front-key-' + str(i) + '.png'))
    body2 = np.array(read(PARTS / 'small-body-source.png'))
    fragment = (body2[:, :, 0].astype(float) - body2[:, :, 1] > 35) & (Y < 320)
    body2[fragment] = 0
    Image.fromarray(body2).save(PARTS / 'small-rear-body-eggs.png')
    adult_fixed = np.array(read(PARTS / 'adult-fixed-base-hardware.png'))
    r, g, b = [adult_fixed[:, :, i].astype(float) for i in range(3)]
    cream = (r > 125) & (g > 100) & (r - g < 85) & (b > .65 * g) & (Y > 295) & (X > 60) & (X < 420) & (adult_fixed[:, :, 3] > 50)
    cream = cv2.morphologyEx(np.uint8(cream), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cream = main_component(cream)
    bodymask = np.zeros((512, 512), np.uint8)
    cv2.drawContours(bodymask, cv2.findContours(cream, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], -1, 1, cv2.FILLED)
    bodymask = cv2.dilate(bodymask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    actual_body = adult_fixed.copy()
    actual_body[:, :, 3] *= bodymask
    hose_mask = np.array(read(PARTS / 'adult-bellows-fixed-port-hose.png'))[:, :, 3] > 30
    under_body = np.array(read(PARTS / 'adult-body-hidden-complete.png'))
    actual_body[hose_mask & (bodymask > 0)] = under_body[hose_mask & (bodymask > 0)]
    actual_body[actual_body[:, :, 3] == 0] = 0
    Image.fromarray(actual_body).save(PARTS / 'adult-visible-body-eggs.png')
    mechanical = adult_fixed.copy()
    red = (r - g > 35) & (b > .8 * g)
    mechanical[(bodymask > 0) | red | (Y > 328)] = 0
    hidden_frame = np.array(read(PARTS / 'adult-frame-hidden-complete.png'))
    for name, mask in [('vent-left', X < 184), ('collar-frame', (X >= 184) & (X <= 332)), ('vent-right', X > 332)]:
        under = hidden_frame.copy()
        under[:, :, 3] *= np.uint8(mask)
        exact = mechanical.copy()
        exact[:, :, 3] *= np.uint8(mask)
        Image.alpha_composite(Image.fromarray(under), Image.fromarray(exact)).save(PARTS / ('adult-' + name + '.png'))
    capshapes = np.array([shape(im, True) for im in caps])
    footshapes = np.array([shape(im, False) for im in feet])
    frontshapes = np.array([shape(im, False) for im in fronts])
    rig = {'frameSize': [512, 512], 'root': [256, 448], 'times': TIMES.tolist(), 'capProfiles': capshapes.tolist(), 'frontCradleProfiles': footshapes.tolist(), 'canopyFrontProfiles': frontshapes.tolist(), 'controlColumns': 97, 'capMeshBands': ['crown', 'hem'], 'drawOrder': ['rear-canopy', 'stem', 'hidden-frame', 'bellows', 'fixed-hardware-body', 'hose', 'lever', 'front-cradle', 'front-canopy'], 'skeleton': 'adult-skeleton-source.json', 'poseOpacityBlend': False, 'compatibility': 'local Python/OpenCV part mesh renderer', 'approval': {'closedVersion': 'KeyframesV3', 'userMessage': '계속해봐', 'approvedChange': 'deep downward drape held through growth'}}
    rig['frontMaterialSourceIndices'] = [0, 2, 2, 2, 2, 6, 6]
    rig['frontCradleMaterialSourcePolicy'] = {'beforeGrowthEnd': 0, 'afterGrowthEnd': 6}
    save_json(BUILD / 'rig.json', rig)
    contact(caps + feet, ['cap' + str(i) for i in range(7)] + ['front' + str(i) for i in range(7)], WORK / 'separated-parts.png', 7)
    if Path(__file__).resolve() != (BUILD / 'render.py').resolve():
        shutil.copy2(Path(__file__), BUILD / 'render.py')
    print('prepared approved layers and profile rig')


class Renderer:
    def __init__(self):
        self.rig = json.loads((BUILD / 'rig.json').read_text())
        self.capshapes = np.array(self.rig['capProfiles'], np.float32)
        self.footshapes = np.array(self.rig['frontCradleProfiles'], np.float32)
        self.frontshapes = np.array(self.rig['canopyFrontProfiles'], np.float32)
        self.caps = [pre(read(PARTS / ('cap-key-' + str(i) + '.png'))) for i in range(7)]
        self.caps[0] = pre(read(PARTS / 'small-cap-complete.png'))
        self.caps[6] = pre(read(PARTS / 'adult-cap-complete.png'))
        self.feet = [pre(read(PARTS / ('cradle-front-key-' + str(i) + '.png'))) for i in range(7)]
        self.fronts = [pre(read(PARTS / ('canopy-front-key-' + str(i) + '.png'))) for i in range(7)]
        self.smallbody = pre(read(PARTS / 'small-rear-body-eggs.png'))
        self.start = read(SRC / 'key-0.png')
        self.end = read(SRC / 'key-6.png')
        self.adult = {p.stem[6:]: pre(read(p)) for p in PARTS.glob('adult-*.png') if p.stem[6:] in ['canopy-rear', 'stem', 'canopy-front', 'collar-hidden-patch', 'bellows-diaphragm', 'bellows-bottom-board', 'bellows-top-board', 'fixed-base-hardware', 'bellows-fixed-port-hose', 'lever', 'body-hidden-complete', 'frame-hidden-complete', 'visible-body-eggs', 'vent-left', 'collar-frame', 'vent-right']}
        self.skeleton = json.loads((BUILD / 'adult-skeleton-source.json').read_text())
        self.bind = self.bone_matrices({}, {})

    def bone_matrices(self, angles, translations):
        out = []
        for i, bone in enumerate(self.skeleton['bones']):
            theta = math.radians(angles.get(i, 0))
            c, s = math.cos(theta), math.sin(theta)
            dx, dy = translations.get(i, (0, 0))
            local = np.array([[c, -s, bone['x'] + dx], [s, c, bone['y'] + dy], [0, 0, 1]], float)
            out.append(local if bone['parent'] < 0 else out[bone['parent']] @ local)
        return out

    def mesh_skin(self, texture, part, matrices):
        vertices = np.array([[v['x'], v['y']] for v in part['vertices']], float)
        target = np.zeros_like(vertices)
        transforms = [m @ np.linalg.inv(b) for m, b in zip(matrices, self.bind)]
        for i, v in enumerate(part['vertices']):
            for w in v['weights']:
                target[i] += (transforms[w['bone']] @ np.r_[vertices[i], 1])[:2] * w['weight']
        mx = np.full((512, 512), -100, np.float32)
        my = mx.copy()
        for tri in np.array(part['triangles']).reshape(-1, 3):
            a, b = vertices[tri], target[tri]
            x0, x1 = max(0, int(np.floor(b[:, 0].min()))), min(511, int(np.ceil(b[:, 0].max())))
            y0, y1 = max(0, int(np.floor(b[:, 1].min()))), min(511, int(np.ceil(b[:, 1].max())))
            if x1 < x0 or y1 < y0:
                continue
            mat = np.vstack([b.T, np.ones(3)])
            if abs(np.linalg.det(mat)) < 1e-8:
                continue
            xx, yy = X[y0:y1 + 1, x0:x1 + 1], Y[y0:y1 + 1, x0:x1 + 1]
            weights = np.linalg.inv(mat) @ np.vstack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
            inside = np.all(weights >= -.0002, 0).reshape(xx.shape)
            uv = (a.T @ weights).reshape(2, *xx.shape)
            mx[y0:y1 + 1, x0:x1 + 1][inside] = uv[0][inside]
            my[y0:y1 + 1, x0:x1 + 1][inside] = uv[1][inside]
        return cv2.remap(texture, mx, my, cv2.INTER_LANCZOS4, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))

    def final_pump(self, t):
        q = np.clip((t - 3.6) / .5, 0, 1)
        pump = math.sin(math.pi * q) ** 2
        angles = {4: -1.1 * pump, 5: -.8 * pump, 6: 1.0 * pump, 7: .7 * pump, 9: 12 * pump}
        matrices = self.bone_matrices(angles, {8: (0, 14 * pump), 2: (0, .8 * pump)})
        out = np.zeros((512, 512, 4), np.float32)
        for part in self.skeleton['parts']:
            out = over(self.mesh_skin(self.adult[part['name']], part, matrices), out)
        return rgba(out)

    def frame(self, t):
        if t <= .5:
            return self.start.copy()
        if t >= 4.1:
            return self.end.copy()
        if t >= 3.6:
            return self.final_pump(t)
        index = min(5, max(0, int(np.searchsorted(TIMES, t, 'right')) - 1))
        cap_target = pchip(self.capshapes, t)
        foot_target = pchip(self.footshapes, t)
        front_target = pchip(self.frontshapes, t)
        front_source = 2 if 1 <= index <= 4 else 6 if index == 5 else index
        cap = profile_warp(self.fronts[front_source], self.frontshapes[front_source], front_target)
        foot_source = 0 if t < 2.1 else 6
        foot = profile_warp(self.feet[foot_source], self.footshapes[foot_source], foot_target)
        out = np.zeros((512, 512, 4), np.float32)
        if t < 1.4:
            out = over(profile_warp(self.caps[0], self.capshapes[0], cap_target), out)
            body = lower_body(self.smallbody, self.footshapes[0], foot_target)
            center_top = np.interp(.5, np.linspace(0, 1, 97), cap_target[2:99])
            body[(X > 185) & (X < 330) & (Y < center_top + 7)] = 0
            out = over(body, out)
            out = over(foot, out)
            out = over(cap, out)
        elif t < 2.1:
            out = over(foot, out)
            out = over(cap, out)
        else:
            rear = profile_warp(self.caps[6], self.capshapes[6], cap_target)
            out = over(rear, out)
            out = over(self.adult['stem'], out)
            machinery = smooth((t - 2.1) / .3)
            tucked = 1 - machinery
            out = over(rigid(self.adult['collar-frame'], (252, 280), 0, (0, 55 * tucked)), out)
            out = over(rigid(self.adult['vent-left'], (145, 280), 0, (112 * tucked, 52 * tucked)), out)
            out = over(rigid(self.adult['vent-right'], (375, 280), 0, (-120 * tucked, 52 * tucked)), out)
            deploy = smooth((t - 2.15) / 1.1)
            dx, dy = -105 * (1 - deploy), -7 * (1 - deploy)
            for name in ['bellows-diaphragm', 'bellows-bottom-board', 'bellows-top-board']:
                out = over(rigid(self.adult[name], (420, 380), 0, (dx, dy)), out)
            out = over(lower_body(self.adult['visible-body-eggs'], self.footshapes[6], foot_target), out)
            out = over(rigid(self.adult['bellows-fixed-port-hose'], (385, 405), 0, (dx, dy)), out)
            out = over(self.adult['collar-hidden-patch'], out)
            out = over(rigid(self.adult['lever'], (251, 267), 0, (0, 55 * tucked)), out)
            out = over(foot, out)
            out = over(cap, out)
        return rgba(out)


def sample():
    renderer = Renderer()
    for label, a, b in [('closing', .5, 1.4), ('opening', 2.1, 3.6)]:
        times = np.linspace(a, b, round((b - a) * 25) + 1)
        frames = [renderer.frame(float(t)) for t in times]
        animated(frames, WORK / (label + '.webp'), [40] * len(frames), 0)
        folder = WORK / label
        folder.mkdir(511, True, True)
        for i, im in enumerate(frames):
            bg = Image.new('RGBA', (512, 512), '#15241f')
            bg.alpha_composite(im)
            bg.convert('RGB').save(folder / (str(i).zfill(4) + '.png'))
        indices = np.linspace(0, len(frames) - 1, 8).astype(int)
        contact([frames[i] for i in indices], [str(round(times[i], 3)) + 's' for i in indices], WORK / (label + '-contact.png'), 4)
    print('representative intervals rendered')


def render():
    renderer = Renderer()
    frames = []
    timeline = []
    for i in range(125):
        t = i / 25
        im = renderer.frame(t)
        im.save(FRAMES / (str(i).zfill(4) + '.png'))
        frames.append(im)
        timeline.append({'frame': i, 'timeMs': i * 40})
    sheet = Image.new('RGBA', (5120, 6656))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 10 * 512, i // 10 * 512))
    sheet.save(ROOT / 'authoring-sheet.png')
    contract = json.loads((SRC / 'runtime-contract.json').read_text())
    runtime_durations = contract['durationsMs']
    runtime_times = np.r_[0, np.cumsum(runtime_durations[:-1])] / 1000
    runtime_frames = [renderer.frame(float(t)) for t in runtime_times]
    runtime_folder = ROOT / 'RuntimeFrames'
    runtime_folder.mkdir(511, True, True)
    runtime_sheet = Image.new('RGBA', (4096, 4096))
    for i, im in enumerate(runtime_frames):
        im.save(runtime_folder / (str(i).zfill(4) + '.png'))
        runtime_sheet.paste(im, (i % 8 * 512, i // 8 * 512))
    runtime_sheet.save(ROOT / 'growth-sheet.png')
    animated(runtime_frames, ROOT / 'growth.webp', runtime_durations, 1)
    bgframes = []
    for im in frames:
        bg = Image.new('RGBA', (512, 512), '#15241f')
        bg.alpha_composite(im)
        bgframes.append(bg.convert('RGB'))
    animated(bgframes, ROOT / 'preview.webp', [40] * len(frames), 0)
    palette_sheet = Image.new('RGB', (1024, 640))
    for i, im in enumerate(bgframes[::4]):
        palette_sheet.paste(im.resize((128, 128), Image.Resampling.LANCZOS), (i % 8 * 128, i // 8 * 128))
    palette = palette_sheet.quantize(192, Image.Quantize.MEDIANCUT, 0, None, Image.Dither.NONE)
    gif_frames = [im.quantize(192, None, 0, palette, Image.Dither.NONE) for im in bgframes]
    gif_frames[0].encoderinfo = {'append_images': gif_frames[1:], 'duration': [40] * len(frames), 'loop': 0, 'disposal': 2, 'optimize': False}
    with (ROOT / 'preview.gif').open('wb') as f:
        GifImagePlugin._save_all(gif_frames[0], f, str(ROOT / 'preview.gif'))
    indices = [0, 18, 25, 32, 35, 44, 52, 61, 70, 80, 90, 96, 102, 124]
    contact([frames[i] for i in indices], [str(i / 25) + 's' for i in indices], ROOT / 'contact.png', 4)
    save_json(ROOT / 'animation.json', {'durationMs': sum(runtime_durations), 'frameSize': [512, 512], 'frameCount': len(runtime_frames), 'columns': 8, 'rows': 8, 'durationsMs': runtime_durations, 'root': [256, 448], 'loop': False, 'timeline': [{'frame': i, 'timeMs': round(t * 1000)} for i, t in enumerate(runtime_times)], 'rig': 'Build/rig.json', 'approvedClosedKeys': 'KeyframesV3', 'poseOpacityBlend': False, 'method': 'approved drawn poses, part-local profile mesh deformation, adult bone skinning', 'audioReference': {'source': 'DesignAssets/Audio/NestGrowth02To03-v2/spore.mp3', 'startMs': 500, 'processing': 'none'}, 'authoringPreview': {'frameCount': 125, 'fps': 25, 'durationMs': 5000, 'frames': 'Frames', 'sheet': 'authoring-sheet.png'}})
    if Path(__file__).resolve() != (BUILD / 'render.py').resolve():
        shutil.copy2(Path(__file__), BUILD / 'render.py')
    print('complete candidate rendered', len(frames))


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'prepare':
        setup()
    elif mode == 'sample':
        sample()
    elif mode == 'render':
        render()
