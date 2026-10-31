from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json, math, sys, hashlib
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Source'
PARTS = ROOT / 'Parts'
FRAMES = ROOT / 'Frames'
PROJECT = next(p for p in ROOT.parents if (p / '.git').exists())
QA = PROJECT / '$Trash' / 'SporeNestIdle04-01a18fdd' / 'QA'
for directory in [PARTS, FRAMES, QA]:
    directory.mkdir(511, True, True)

def write_json(path, data):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    path.write_bytes((encoder.encode(data) + '\n').replace('\n', '\r\n').encode('utf-8'))

def smooth(value):
    x = np.clip(value, 0.0, 1.0)
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)

def curve(time, delay):
    t = time - delay
    if t <= 0.3:
        return 0.0
    if t < 1.4:
        return float(smooth((t - 0.3) / 1.1))
    if t <= 1.9:
        return 1.0
    if t < 3.3:
        return 1.0 - float(smooth((t - 1.9) / 1.4))
    return 0.0

def premultiply(image):
    a = np.array(image.convert('RGBA'), np.float32) / 255.0
    a[:, :, :3] *= a[:, :, 3:4]
    return a

def unpremultiply(a):
    out = a.copy()
    out[:, :, :3] = np.divide(out[:, :, :3], np.maximum(out[:, :, 3:4], 1e-07))
    return Image.fromarray(np.uint8(np.clip(out * 255.0 + 0.5, 0, 255)), 'RGBA')

def over(back, front):
    return front + back * (1.0 - front[:, :, 3:4])

def sample(texture, x, y):
    h, w = texture.shape[:2]
    valid = (x >= 0) & (x <= w - 1) & (y >= 0) & (y <= h - 1)
    u = np.clip(x, 0, w - 1)
    v = np.clip(y, 0, h - 1)
    x0 = np.floor(u).astype(np.int32)
    y0 = np.floor(v).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    dx = (u - x0)[..., None]
    dy = (v - y0)[..., None]
    out = (texture[y0, x0] * (1 - dx) + texture[y0, x1] * dx) * (1 - dy) + (texture[y1, x0] * (1 - dx) + texture[y1, x1] * dx) * dy
    return out * valid[..., None]

def mask_polygon(points):
    im = Image.new('L', (512, 512), 0)
    ImageDraw.Draw(im).polygon(points, 255)
    return np.array(im, np.float32) / 255.0

def save_array(path, data):
    unpremultiply(data).save(path)

def make_rig(reference):
    xs = np.array([80, 88, 100, 115, 135, 155, 175, 195, 215, 235, 256, 276, 296, 316, 336, 356, 376, 396, 416, 432, 438], np.float64)
    bx = np.array([80, 88, 100, 120, 140, 160, 175, 190, 210, 235, 255, 280, 305, 330, 345, 365, 385, 410, 430, 438], np.float64)
    by = np.array([196, 197, 189, 178, 166, 153, 148, 153, 165, 173, 174, 172, 161, 151, 153, 161, 171, 182, 197, 197], np.float64)
    bottom = np.interp(xs, bx, by)
    capmask = mask_polygon([(75, 60), (445, 60)] + [(float(x), float(y)) for x, y in zip(bx[::-1], by[::-1])])
    cap = reference * capmask[:, :, None]
    base = reference * (1.0 - capmask[:, :, None])
    save_array(PARTS / 'canopy.png', cap)
    save_array(PARTS / 'fixed-structure.png', base)
    Image.fromarray(np.uint8(capmask * 255), 'L').save(PARTS / 'canopy-mask.png')
    names = ['root', 'cap-center', 'left-base', 'left-mid', 'left-tip', 'right-base', 'right-mid', 'right-tip']
    parents = [-1, 0, 1, 2, 3, 1, 5, 6]
    positions = [(0, 0), (256, 174), (-81, -23), (-45, 14), (-40, 25), (80, -23), (45, 15), (45, 25)]
    bones = [{'name': n, 'parent': p, 'translation': list(xy)} for n, p, xy in zip(names, parents, positions)]
    bind = []
    for b in bones:
        m = np.eye(3)
        m[:2, 2] = b['translation']
        if b['parent'] >= 0:
            m = bind[b['parent']] @ m
        bind.append(m)
    vertices = []
    weights = []
    alpha = reference[:, :, 3]
    for row in range(10):
        r = row / 9.0
        for col, x in enumerate(xs):
            y = 60.0 + (bottom[col] + 2.0 - 60.0) * r
            column = alpha[:200, int(np.clip(x, 0, 511))]
            opaque = np.where(column > 0.5)[0]
            top = float(opaque[0]) if len(opaque) else bottom[col]
            strength = float(smooth((bottom[col] - y) / max(10, bottom[col] - top)))
            moving = np.zeros(8)
            controls = [(88, 4), (130, 3), (175, 2), (256, 1), (336, 5), (381, 6), (426, 7)]
            if x <= controls[0][0]:
                moving[4] = 1.0
            elif x >= controls[-1][0]:
                moving[7] = 1.0
            else:
                for k in range(len(controls) - 1):
                    a, bi = controls[k]
                    b, bj = controls[k + 1]
                    if a <= x <= b:
                        f = (x - a) / (b - a)
                        moving[bi] = 1 - f
                        moving[bj] = f
                        break
            moving *= strength
            moving[0] = 1 - strength
            vertices.append([float(x), float(y)])
            weights.append(moving.tolist())
    triangles = []
    cols = len(xs)
    for row in range(9):
        for col in range(cols - 1):
            a = row * cols + col
            b = a + 1
            c = a + cols
            d = c + 1
            triangles.extend([[a, b, d], [a, d, c]])
    rig = {'format': 'local-layered-weighted-mesh-v1', 'canvas': [512, 512], 'pivot': [256, 448], 'bones': bones, 'vertices': vertices, 'weights': weights, 'triangles': triangles, 'texture': 'Parts/canopy.png', 'fixedTexture': 'Parts/fixed-structure.png', 'bindPose': 'Source/reference.png', 'spineCompatibilityVerified': False, 'drawOrder': ['fixed-structure', 'canopy', 'tank-liquid', 'tank-bubbles', 'tank-front-glass', 'fan-rotor', 'fan-fixed-hub'], 'tracks': {'canopy': {'centerLiftPixels': 4, 'leftDelaySeconds': 0.1, 'rightDelaySeconds': 0.15, 'keysSeconds': [0, 0.3, 0.8, 1.4, 1.6, 1.9, 2.6, 3.3, 3.7, 4]}, 'fan': {'center': [392.4, 298.6], 'basis': [[13.8, -1.7], [1.3, 18.2]], 'revolutionsPerLoop': 1, 'projection': 'fixed-plane-affine'}, 'tank': {'bounds': [402.8, 264.2, 431.4, 296.0], 'particlePeriodSeconds': 4, 'occlusion': 'fixed brass top, bottom, fan housing and vertical glass reflections'}}}
    write_json(ROOT / 'rig.json', rig)
    return (cap, base, rig, bind)

def matrices(rig, bind, time):
    center = curve(time, 0.0)
    left = curve(time, 0.1)
    right = curve(time, 0.15)
    global_m = []
    for i, b in enumerate(rig['bones']):
        x, y = b['translation']
        angle = 0.0
        if i == 1:
            y -= 4.0 * center
        if i == 2:
            y += 4.0 * (center - left)
            angle = 0.35 * left
        if i == 3:
            angle = 0.4 * curve(time, 0.15)
        if i == 4:
            angle = 0.35 * curve(time, 0.2)
        if i == 5:
            y += 4.0 * (center - right)
            angle = -0.35 * right
        if i == 6:
            angle = -0.4 * curve(time, 0.2)
        if i == 7:
            angle = -0.35 * curve(time, 0.25)
        c = math.cos(math.radians(angle))
        s = math.sin(math.radians(angle))
        m = np.array([[c, -s, x], [s, c, y], [0, 0, 1]], np.float64)
        if b['parent'] >= 0:
            m = global_m[b['parent']] @ m
        global_m.append(m)
    return [g @ np.linalg.inv(b) for g, b in zip(global_m, bind)]

def render_canopy(cap, rig, bind, time):
    src = np.array(rig['vertices'], np.float64)
    v = np.column_stack([src, np.ones(len(src))])
    w = np.array(rig['weights'])
    dst = np.zeros_like(src)
    for i, m in enumerate(matrices(rig, bind, time)):
        dst += (v @ m.T)[:, :2] * w[:, i:i + 1]
    result = np.zeros((512, 512, 4), np.float32)
    for indexes in rig['triangles']:
        tri = dst[indexes]
        st = src[indexes]
        left = max(0, int(np.floor(tri[:, 0].min())))
        right = min(511, int(np.ceil(tri[:, 0].max())))
        top = max(0, int(np.floor(tri[:, 1].min())))
        bottom = min(511, int(np.ceil(tri[:, 1].max())))
        if right < left or bottom < top:
            continue
        yy, xx = np.mgrid[top:bottom + 1, left:right + 1]
        a, b, c = tri
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-08:
            continue
        wa = ((b[1] - c[1]) * (xx - c[0]) + (c[0] - b[0]) * (yy - c[1])) / den
        wb = ((c[1] - a[1]) * (xx - c[0]) + (a[0] - c[0]) * (yy - c[1])) / den
        wc = 1 - wa - wb
        inside = (wa >= -1e-07) & (wb >= -1e-07) & (wc >= -1e-07)
        u = wa * st[0, 0] + wb * st[1, 0] + wc * st[2, 0]
        v = wa * st[0, 1] + wb * st[1, 1] + wc * st[2, 1]
        section = result[top:bottom + 1, left:right + 1]
        section[inside] = sample(cap, u, v)[inside]
    return result

def clean_crop(atlas, box):
    image = atlas.crop(box)
    a = np.array(image)
    a[a[:, :, 3] < 16] = 0
    return Image.fromarray(a, 'RGBA')

def prepare_machine(reference):
    atlas = Image.open(SOURCE / 'generated-attachments.png').convert('RGBA')
    crops = {'canopy_hidden': (12, 129, 630, 449), 'upper_hidden': (594, 175, 1207, 406), 'rotor_donor': (1216, 175, 1510, 465), 'liquid': (190, 612, 462, 873), 'bubble': (732, 694, 857, 822), 'housing_donor': (1100, 567, 1509, 900)}
    donors = {}
    for name, box in crops.items():
        donors[name] = clean_crop(atlas, box)
        donors[name].save(SOURCE / (name + '.png'))
    c = np.array([392.4, 298.6])
    basis = np.array([[13.8, -1.7], [1.3, 18.2]])
    yy, xx = np.mgrid[0:256, 0:256]
    unit = np.stack([(xx - 127.5) / 127.5, (yy - 127.5) / 127.5], -1)
    coords = unit @ basis.T + c
    rotor = sample(reference, coords[:, :, 0], coords[:, :, 1])
    radius = np.sqrt(np.sum(unit * unit, 2))
    rotor *= np.clip((1.005 - radius) * 127.5, 0, 1)[:, :, None]
    save_array(PARTS / 'fan-rotor-front.png', rotor)
    donors['bubble'].save(PARTS / 'bubble.png')
    donors['liquid'] = donors['liquid'].crop((25, 76, 245, 212))
    liquid = premultiply(donors['liquid'])
    reference_area = reference[267:289, 414:427, :3]
    source_median = np.median(liquid[:, :, :3].reshape(-1, 3), 0)
    target_median = np.median(reference_area.reshape(-1, 3), 0)
    liquid[:, :, :3] = np.clip(liquid[:, :, :3] + target_median - source_median, 0, liquid[:, :, 3:4])
    save_array(PARTS / 'tank-liquid-source.png', liquid)
    return (rotor, liquid, premultiply(donors['bubble']))

def machine_frame(base, reference, rotor, liquid, bubble, time):
    result = base.copy()
    yy, xx = np.mgrid[0:512, 0:512]
    cx, cy = (392.4, 298.6)
    basis = np.array([[13.8, -1.7], [1.3, 18.2]])
    inv = np.linalg.inv(basis)
    u = inv[0, 0] * (xx - cx) + inv[0, 1] * (yy - cy)
    v = inv[1, 0] * (xx - cx) + inv[1, 1] * (yy - cy)
    radius = np.sqrt(u * u + v * v)
    angle = 2 * math.pi * time / 4.0
    ru = math.cos(angle) * u + math.sin(angle) * v
    rv = -math.sin(angle) * u + math.cos(angle) * v
    spin = sample(rotor, (ru + 1) * 127.5, (rv + 1) * 127.5)
    aperture = np.clip((0.98 - radius) * 12, 0, 1)
    result = result * (1 - aperture[:, :, None]) + spin * aperture[:, :, None]
    hub = ((xx - cx) / 5.0) ** 2 + ((yy - cy) / 5.8) ** 2
    hubmask = np.clip((1.1 - hub) * 5, 0, 1)
    result = result * (1 - hubmask[:, :, None]) + reference * hubmask[:, :, None]
    tx = (xx - 403.0) / 28.0
    ty = (yy - 264.5) / 31.3
    tankmask = mask_polygon([(402,265),(429,266),(429,291),(425,295),(410,295),(409,285),(403,278)])
    tankmask *= np.float32(~(((xx - 392.4) / 21.0) ** 2 + ((yy - 298.6) / 24.5) ** 2 < 1.0))
    tank = tankmask > 0
    liquid_view = sample(liquid, tx * (liquid.shape[1] - 1), ty * (liquid.shape[0] - 1))
    liquid_view[:, :, 3] = reference[:, :, 3]
    liquid_view[:, :, :3] = np.minimum(liquid_view[:, :, :3], liquid_view[:, :, 3:4])
    interior = smooth((xx - 410) / 3.0) * smooth((429 - xx) / 3.0) * smooth((yy - 266) / 3.0) * smooth((295 - yy) / 3.0)
    interior *= tankmask
    result = result * (1 - interior[:, :, None]) + liquid_view * interior[:, :, None]
    for i in range(7):
        phase = (time / 4.0 + i * 0.137) % 1.0
        bx = 411.0 + i % 3 * 5.4 + 0.55 * math.sin(phase * 2 * math.pi + i)
        by = 299.5 - phase * 39.0
        size = 2.1 + 0.45 * (i % 3)
        px = (xx - bx) / size + 0.5
        py = (yy - by) / size + 0.5
        particle = sample(bubble, px * (bubble.shape[1] - 1), py * (bubble.shape[0] - 1))
        particle *= tankmask[:, :, None]
        result = over(result, particle)
    reflections = tank & (((xx >= 404) & (xx <= 406)) | ((xx >= 428) & (xx <= 430)))
    result[reflections] = reference[reflections]
    return result

def contact_sheet(paths, path, columns, size):
    rows = (len(paths) + columns - 1) // columns
    out = Image.new('RGB', (columns * size, rows * (size + 23)), (35, 40, 44))
    draw = ImageDraw.Draw(out)
    for i, p in enumerate(paths):
        im = Image.open(p).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
        x = i % columns * size
        y = i // columns * (size + 23)
        out.paste(im, (x, y), im)
        draw.text((x + 8, y + size + 4), p.stem, (225, 230, 232))
    out.save(path)
reference = premultiply(Image.open(SOURCE / 'reference.png'))
cap, base, rig, bind = make_rig(reference)
rotor, liquid, bubble = prepare_machine(reference)
mode = sys.argv[1]
indices = [0, 16, 28, 32, 52, 66, 74, 80] if mode == 'draft' else list(range(16, 49)) if mode == 'segment' else list(range(80))
render_folder = QA if mode == 'draft' else QA / 'Segment' if mode == 'segment' else FRAMES
render_folder.mkdir(511, True, True)
paths = []
for index in indices:
    time = index / 20.0
    body = over(base, render_canopy(cap, rig, bind, time))
    frame = machine_frame(body, reference, rotor, liquid, bubble, time)
    if mode == 'full' and index == 0:
        closure_body = over(base, render_canopy(cap, rig, bind, 4.0))
        save_array(QA / 'closure-4s.png', machine_frame(closure_body, reference, rotor, liquid, bubble, 4.0))
    path = render_folder / ('frame-%03d.png' % index)
    save_array(path, frame)
    paths.append(path)
    if index % 20 == 0:
        print('rendered', index)
        sys.stdout.flush()
contact_sheet(paths, QA / ('draft-keys.png' if mode == 'draft' else 'segment-filmstrip.png' if mode == 'segment' else 'source-filmstrip.png'), 4 if mode == 'draft' else 10, 256 if mode == 'draft' else 160)
if mode == 'full':
    metadata = {'name': 'spore-nest-level-04-idle', 'frameSize': [512, 512], 'frameCount': 80, 'fps': 20, 'columns': 10, 'rows': 8, 'durationsMs': [50] * 80, 'durationMs': 4000, 'root': [256, 448], 'loop': True, 'rootMotion': False, 'animation': 'idle-sheet.png', 'runtimeAnimation': 'idle-sheet.webp', 'preview': 'preview.webp', 'gifPreview': 'preview.gif', 'gifBackground': '#23282c', 'poster': 'poster.png', 'rig': 'rig.json', 'sources': {'reference': 'Source/reference.png', 'generation': 'Source/generated-attachments.png', 'renderer': 'Source/build.py'}, 'method': 'one-neutral-source-separated-canopy-weighted-mesh-plus-fixed-plane-rotor-and-clipped-bubbles', 'sourcePoseCount': 1, 'additionalFullPoseDrawings': 0, 'keyframeApproval': {'keyframe': 'Keyframes/neutral.png', 'referenceSha256': hashlib.sha256((SOURCE / 'reference.png').read_bytes()).hexdigest(), 'evidence': 'user-confirmed-in-current-chat'}, 'timeline': [{'frame': i, 'seconds': i / 20.0, 'center': curve(i / 20.0, 0), 'left': curve(i / 20.0, 0.1), 'right': curve(i / 20.0, 0.15), 'fanDegrees': i * 4.5} for i in range(80)], 'referenceSha256': hashlib.sha256((SOURCE / 'reference.png').read_bytes()).hexdigest()}
    write_json(ROOT / 'animation.json', metadata)
    Image.open(FRAMES / 'frame-000.png').save(ROOT / 'poster.png')
    sheet = Image.new('RGBA', (5120, 4096), (0, 0, 0, 0))
    for i, p in enumerate(paths):
        sheet.paste(Image.open(p), (i % 10 * 512, i // 10 * 512))
    sheet.save(ROOT / 'idle-sheet.png')
