from pathlib import Path
import sys
import json
import math
import numpy as np
import cv2
from PIL import Image, WebPImagePlugin
from riglib import premul, rgba, over, affine

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'DesignAssets/Animations/Nests/Idle02-v2'
WORK = ROOT / '$Trash/NestIdle02-v2-20261030'
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
SIZE = 512

def write_json(path, data):
    path.write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))

def premul_source(source):
    pixels = np.array(source.convert('RGBA')).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels

def image(name):
    return Image.open(BASE / name).convert('RGBA')

def save_part(tribe, name, value):
    rgba(value).save(BASE / tribe / 'Parts' / (name + '.png'))
    return value

def mask_polygon(points):
    result = np.zeros((512, 512), np.uint8)
    cv2.fillPoly(result, [np.int32(np.array(points) * 8)], 255, cv2.LINE_8, 3)
    return result.astype(np.float32) / 255

def component(mask, rank, padding):
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(mask), 8)
    choices = [i for area, i in sorted([(int(stats[i, 4]), i) for i in range(1, count)])[::-1]]
    selected = np.uint8(labels == choices[rank])
    contours, _ = cv2.findContours(selected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(selected, contours, -1, 1, cv2.FILLED)
    if padding:
        selected = cv2.dilate(selected, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (padding * 2 + 1, padding * 2 + 1)))
    return selected.astype(np.float32)

def trimmed(source):
    pixels = np.array(source)
    alpha = np.uint8(pixels[:, :, 3] > 80)
    count, labels, stats, centers = cv2.connectedComponentsWithStats(alpha, 8)
    keep = [i for i in range(1, count) if stats[i, 4] > 24]
    mask = np.uint8(np.isin(labels, keep))
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    pixels[:, :, 3] = np.minimum(pixels[:, :, 3], mask * 255)
    result = Image.fromarray(pixels, 'RGBA')
    return result.crop(result.getbbox())

def fitted(source, box):
    left, top, right, bottom = box
    layer = Image.new('RGBA', (512, 512))
    part = trimmed(source).resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    layer.paste(part, (left, top))
    return premul(layer)

def remesh(layer, vertices, target, triangles):
    if np.abs(vertices - target).max() < 1e-7:
        return layer.copy()
    map_x = np.full((512, 512), -10, np.float32)
    map_y = map_x.copy()
    for tri in triangles:
        src = vertices[list(tri)].astype(np.float32)
        dst = target[list(tri)].astype(np.float32)
        bx, by, bw, bh = cv2.boundingRect(dst)
        left, top = max(0, bx), max(0, by)
        right, bottom = min(512, bx + bw + 1), min(512, by + bh + 1)
        if right <= left or bottom <= top:
            continue
        selection = np.zeros((bottom - top, right - left), np.uint8)
        cv2.fillConvexPoly(selection, np.int32(np.round((dst - [left, top]) * 256)), 1, cv2.LINE_8, 8)
        transform = cv2.getAffineTransform(dst, src)
        yy, xx = np.mgrid[top:bottom, left:right]
        active = selection > 0
        map_x[top:bottom, left:right][active] = (xx * transform[0, 0] + yy * transform[0, 1] + transform[0, 2])[active]
        map_y[top:bottom, left:right][active] = (xx * transform[1, 0] + yy * transform[1, 1] + transform[1, 2])[active]
    return cv2.remap(layer, map_x, map_y, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)

def grid_mesh(layer, cols, rows):
    yy, xx = np.where(layer[:, :, 3] > .02)
    vertices = np.array([(x, y) for y in np.linspace(max(0, yy.min() - 5), min(511, yy.max() + 5), rows)
                         for x in np.linspace(max(0, xx.min() - 5), min(511, xx.max() + 5), cols)], np.float32)
    triangles = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            at = row * cols + col
            triangles.extend([(at, at + 1, at + cols), (at + 1, at + cols + 1, at + cols)])
    return vertices, triangles

def rotate_points(points, pivot, angle):
    theta = math.radians(angle)
    rotation = np.array([[math.cos(theta), -math.sin(theta)], [math.sin(theta), math.cos(theta)]])
    return (points - pivot) @ rotation.T + pivot

def smooth(value):
    t = float(np.clip(value, 0, 1))
    return t * t * t * (10 + t * (-15 + 6 * t))

def breath(t, start, peak, hold, end):
    if t < start:
        return 0
    if t < peak:
        return smooth((t - start) / (peak - start))
    if t < hold:
        return 1
    return 1 - smooth((t - hold) / (end - hold))

def rigid_matrix(pivot, angle, offset):
    r = math.radians(angle)
    c, s = math.cos(r), math.sin(r)
    x, y = pivot
    return np.array([[c, -s, x - c * x + s * y + offset[0]],
                     [s, c, y - s * x - c * y + offset[1]], [0, 0, 1]], np.float64)

def rigid(layer, matrix):
    return cv2.warpAffine(layer, matrix[:2].astype(np.float32), (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)

def spore():
    ref = premul(image('spore/reference.png'))
    colors = ref[:, :, :3] / np.maximum(ref[:, :, 3:4], 1e-6)
    pink = (colors[:, :, 0] > colors[:, :, 1] * 1.18) & (colors[:, :, 0] > colors[:, :, 2] * 1.15) & (ref[:, :, 3] > .5)
    atlas = image('Sources/spore-caps.png')
    pixels = np.array(atlas)
    alpha = pixels[:, :, 3] > 100
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(alpha), 8)
    choices = [i for area, i in sorted([(int(stats[i, 4]), i) for i in range(1, count)])[::-1]][:2]
    isolated = []
    for label in choices:
        cut = pixels.copy()
        region = cv2.dilate(np.uint8(labels == label), np.ones((3, 3), np.uint8))
        cut[:, :, 3] = np.minimum(cut[:, :, 3], region * 255)
        isolated.append(Image.fromarray(cut, 'RGBA'))
    main = save_part('spore', 'canopy', fitted(isolated[0], (54, 147, 436, 315)))
    secondary = save_part('spore', 'rear-canopy', fitted(isolated[1], (322, 276, 456, 352)))
    drawn_body = fitted(image('Sources/spore-body.png'), (93, 171, 430, 447))
    body_region = mask_polygon([(225, 247), (290, 249), (293, 264), (303, 284), (325, 301), (347, 306),
        (365, 318), (376, 330), (395, 339), (410, 352), (421, 371), (418, 397), (408, 414),
        (387, 432), (359, 439), (328, 440), (304, 443), (280, 444), (251, 446), (225, 445),
        (202, 447), (174, 446), (151, 442), (128, 432), (112, 419), (101, 399), (94, 377),
        (95, 355), (103, 340), (117, 327), (136, 313), (156, 300), (181, 291), (198, 294),
        (211, 285), (221, 267)])
    body_region = cv2.dilate(body_region, np.ones((5, 5), np.uint8))
    hidden_mask = mask_polygon([(224, 235), (288, 235), (298, 290), (213, 300)])
    rear_mask = mask_polygon([(372, 304), (414, 304), (424, 351), (367, 365)])
    rear_stem = save_part('spore', 'rear-stem', drawn_body * rear_mask[:, :, None])
    body = save_part('spore', 'body-complete', over(ref * body_region[:, :, None], drawn_body * hidden_mask[:, :, None]))
    foreground_mask = np.float32(Y <= 247 + 4 * np.cos((X - 257) / 55))
    canopy_front = save_part('spore', 'canopy-front', main * foreground_mask[:, :, None])
    vertices, triangles = grid_mesh(main, 23, 13)
    dx = np.abs(vertices[:, 0] - 257)
    rim = np.clip((vertices[:, 1] - 172) / 125, 0, 1) ** 1.3
    outer = np.clip((dx - 65) / 130, 0, 1)
    influence = np.clip(dx / 150, 0, 1) * rim
    weights = np.column_stack([1 - influence, influence * (1 - outer), influence * outer])
    pivot = np.array([257, 247], np.float64)
    joints = {1: np.array([342, 261]), -1: np.array([174, 263])}

    def frame(t):
        inhale = breath(t, .04, .40, .48, .91)
        target = vertices.astype(np.float64).copy()
        for side in [-1, 1]:
            indices = np.where((vertices[:, 0] - 257) * side >= 0)[0]
            points = vertices[indices].astype(np.float64)
            lag = .025 if side == 1 else 0
            q = breath(t - lag, .04, .40, .48, .91)
            base_angle = -side * 2.5 * q
            tip_angle = -side * 3.3 * breath(t - lag, .08, .45, .51, .95)
            base = rotate_points(points, pivot, base_angle)
            branch = rotate_points(points, joints[side], tip_angle)
            branch = rotate_points(branch, pivot, base_angle)
            w = weights[indices]
            target[indices] = points * w[:, :1] + base * w[:, 1:2] + branch * w[:, 2:3]
        target[:, 1] -= 2.2 * inhale * np.clip((300 - vertices[:, 1]) / 150, 0, 1)
        cap = remesh(main, vertices, target, triangles)
        front = remesh(canopy_front, vertices, target, triangles)
        rear_q = breath(t, .14, .48, .55, .98)
        rear = affine(secondary, (389, 333), (1, 1), -2.6 * rear_q, (0, -1.2 * rear_q))
        return over(front, over(body, over(cap, over(rear, rear_stem))))

    rig = {'bones': [{'id': 'root', 'parent': None, 'pivot': [256, 448]},
        {'id': 'stem', 'parent': 'root', 'pivot': [257, 300]},
        {'id': 'canopy', 'parent': 'stem', 'pivot': [257, 247]},
        {'id': 'left-base', 'parent': 'canopy', 'pivot': [257, 247]},
        {'id': 'right-base', 'parent': 'canopy', 'pivot': [257, 247]},
        {'id': 'rim-left', 'parent': 'left-base', 'pivot': [174, 263]},
        {'id': 'rim-right', 'parent': 'right-base', 'pivot': [342, 261]},
        {'id': 'rear-canopy', 'parent': 'root', 'pivot': [389, 333]}],
        'mesh': {'source': 'Parts/canopy.png', 'vertices': vertices.tolist(), 'triangles': triangles,
                 'weights': weights.tolist(), 'branchByX': 257,
                 'weightBonesByBranch': {'left': ['canopy', 'left-base', 'rim-left'], 'right': ['canopy', 'right-base', 'rim-right']}},
        'drawOrder': ['rear-stem', 'rear-canopy', 'canopy', 'body-complete', 'canopy-front'],
        'fixed': ['lower rim', 'eggs', 'ground'], 'keys': [0, .04, .40, .48, .91, 1],
        'maximumRimRotationDegrees': 5.8, 'periodMs': 4000}
    return frame, rig

def pebble():
    ref = premul(image('pebble/reference.png'))
    colors = ref[:, :, :3] / np.maximum(ref[:, :, 3:4], 1e-6) * 255
    r, g, b = [colors[:, :, i] for i in range(3)]
    yellow = (ref[:, :, 3] > .5) & (r > 55) & (g > 45) & (r > b * .98)
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(yellow), 8)
    seeds = {'roof': (270, 300), 'cap': (300, 222), 'upper-left': (125, 343), 'upper-right': (394, 351)}
    masks = {}
    ranks = [i for area, i in sorted([(int(stats[i, 4]), i) for i in range(1, count)])[::-1]]
    for name, point in seeds.items():
        label = int(labels[point[1], point[0]])
        if label == 0:
            raise ValueError(('unbound stone seed', name))
        interior = component(yellow, ranks.index(label), 0)
        outline = cv2.dilate(interior, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        dark = np.float32((r < 80) & (g < 80) & (b < 80))
        masks[name] = np.maximum(interior, outline * dark)
    if len(set(int(labels[y, x]) for x, y in seeds.values())) != 4:
        raise ValueError('Stone outlines must separate all four rigid attachments')
    layers = {name: ref * mask[:, :, None] for name, mask in masks.items()}
    union = np.maximum.reduce(list(masks.values()))
    fixed = ref * (1 - union)[:, :, None]
    backdrop = fitted(image('Sources/pebble-interior.png'), (76, 279, 446, 439))
    backdrop *= union[:, :, None]
    backdrop *= np.uint8(ref[:, :, 3] > .98)[:, :, None]
    back = save_part('pebble', 'cave-back', over(fixed, backdrop))
    roof_fill = fitted(image('Sources/pebble-roof.png'), (85, 226, 448, 342))
    roof_fill *= masks['cap'][:, :, None]
    layers['roof'] = over(layers['roof'], roof_fill)
    for name, value in layers.items():
        save_part('pebble', name, value)
    foreground = save_part('pebble', 'ground-occluder', fixed * np.float32(Y >= 369)[:, :, None])
    left_pivot = np.array([177., 374.])
    right_pivot = np.array([339., 381.])
    contacts = np.array([[130., 313.], [400., 326.]])
    roof_pivot = contacts.mean(0)
    cap_pivot = np.array([322., 252.])
    yy, xx = np.where(layers['cap'][:, :, 3] > .5)
    cap_points = np.column_stack([xx, yy]).astype(np.float64)
    normal = np.array([-.18, 1.])
    normal /= np.linalg.norm(normal)
    ground_plane = np.max(cap_points @ normal)
    timelines = []
    support_points = {}
    for name in ['upper-left', 'upper-right']:
        yy, xx = np.where(layers[name][:, :, 3] > .5)
        support_points[name] = np.column_stack([xx, yy]).astype(np.float64)

    def supported(name, matrix, slope):
        normal = np.array([-slope, 1.])
        normal /= np.linalg.norm(normal)
        points = support_points[name]
        baseline = np.max(points @ normal)
        posed = np.column_stack([points, np.ones(len(points))]) @ matrix.T
        penetration = np.max(posed[:, :2] @ normal) - baseline
        matrix[:2, 2] -= normal * penetration
        return matrix

    def matrices(t):
        left_angle = 4.2 * breath(t, .10, .33, .39, .65)
        right_angle = -3.8 * breath(t, .19, .43, .48, .76)
        left = supported('upper-left', rigid_matrix(left_pivot, left_angle, (0, 0)), .08)
        right = supported('upper-right', rigid_matrix(right_pivot, right_angle, (0, 0)), .03)
        moved = np.array([(left @ np.append(contacts[0], 1))[:2], (right @ np.append(contacts[1], 1))[:2]])
        original_vector, target_vector = contacts[1] - contacts[0], moved[1] - moved[0]
        angle = math.degrees(math.atan2(target_vector[1], target_vector[0]) - math.atan2(original_vector[1], original_vector[0]))
        roof = rigid_matrix(roof_pivot, angle, moved.mean(0) - roof_pivot)
        q = breath(t, .24, .48, .52, .86)
        cap_angle = 4.4 * q * math.sin((t - .24) / .62 * math.pi * 1.45)
        cap_local = rigid_matrix(cap_pivot, cap_angle, (0, 0))
        moved_cap = np.column_stack([cap_points, np.ones(len(cap_points))]) @ cap_local.T
        penetration = np.max(moved_cap[:, :2] @ normal) - ground_plane
        cap_local[:2, 2] -= normal * penetration
        return left, right, roof, roof @ cap_local

    def frame(t):
        left, right, roof, cap = matrices(t)
        value = back.copy()
        for name, matrix in [('upper-left', left), ('upper-right', right), ('roof', roof), ('cap', cap)]:
            value = over(rigid(layers[name], matrix), value)
        return over(foreground, value)

    for t in [0, .10, .19, .33, .43, .48, .65, .76, .86, 1]:
        timelines.append({'t': t, 'matrices': [m.tolist() for m in matrices(t)]})
    rig = {'bones': [{'id': 'root', 'parent': None, 'pivot': [256, 448]},
        {'id': 'upper-left', 'parent': 'root', 'pivot': left_pivot.tolist()},
        {'id': 'upper-right', 'parent': 'root', 'pivot': right_pivot.tolist()},
        {'id': 'roof', 'parent': 'root', 'pivot': roof_pivot.tolist()},
        {'id': 'cap', 'parent': 'roof', 'pivot': cap_pivot.tolist()}],
        'drawOrder': ['cave-back', 'upper-left', 'upper-right', 'roof', 'cap', 'ground-occluder'],
        'attachments': {name: {'source': 'Parts/' + name + '.png', 'weight': 1, 'rigid': True} for name in layers},
        'contacts': contacts.tolist(), 'capContactNormal': normal.tolist(), 'supportSlopes': [.08, .03], 'rootMotion': False,
        'keys': timelines, 'fixed': ['lower support stones', 'small pebbles', 'floor'], 'rigidScale': [1, 1],
        'periodMs': 6000, 'restMs': 2000}
    return frame, rig

def optical_pair(a, b):
    gray_a = cv2.cvtColor(np.uint8(np.clip(a[:, :, :3] * 255, 0, 255)), cv2.COLOR_RGB2GRAY)
    gray_b = cv2.cvtColor(np.uint8(np.clip(b[:, :, :3] * 255, 0, 255)), cv2.COLOR_RGB2GRAY)
    forward = cv2.calcOpticalFlowFarneback(gray_a, gray_b, None, .5, 3, 13, 4, 5, 1.2, 0)
    backward = cv2.calcOpticalFlowFarneback(gray_b, gray_a, None, .5, 3, 13, 4, 5, 1.2, 0)
    return forward, backward

def flow_between(a, b, flows, q):
    forward, backward = flows
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    aa = cv2.remap(a, xx - forward[:, :, 0] * q, yy - forward[:, :, 1] * q, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    bb = cv2.remap(b, xx - backward[:, :, 0] * (1 - q), yy - backward[:, :, 1] * (1 - q), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    return aa * (1 - q) + bb * q

def place_small(part, box):
    result = np.zeros((512, 512, 4), np.float32)
    left, top, right, bottom = box
    result[top:bottom, left:right] = cv2.resize(part, (right - left, bottom - top))
    return result

def spring():
    ref = premul(image('spring/reference.png'))
    atlas = image('Sources/spring-layers.png')
    width, height = atlas.size
    cells = [atlas.crop((round(i % 4 * width / 4), round(i // 4 * height / 2),
                         round((i % 4 + 1) * width / 4), round((i // 4 + 1) * height / 2))) for i in range(8)]
    clean = fitted(cells[0], (58, 293, 455, 448))
    pool_mask = np.zeros((512, 512), np.uint8)
    cv2.ellipse(pool_mask, (270, 377), (142, 20), 0, 0, 360, 255, cv2.FILLED, cv2.LINE_AA)
    pool_mask = cv2.GaussianBlur(pool_mask.astype(np.float32) / 255, (5, 5), 1)
    curtain_mask = mask_polygon([(190, 334), (250, 330), (265, 352), (259, 359), (198, 358)])
    patch = np.maximum(pool_mask, curtain_mask)
    base = ref * (1 - patch[:, :, None]) + clean * patch[:, :, None]
    base[:, :, 3] = ref[:, :, 3]
    save_part('spring', 'clean-pools', base)
    ribbons = []
    for i in [1, 2, 3, 4]:
        part = trimmed(cells[i]).resize((80, 32), Image.Resampling.LANCZOS)
        ribbons.append(premul(part))
        part.save(BASE / 'spring/Parts' / ('curtain-' + str(i) + '.png'))
    flows = [optical_pair(ribbons[i], ribbons[(i + 1) % len(ribbons)]) for i in range(len(ribbons))]
    ring = trimmed(cells[5])
    arc = trimmed(cells[6])
    ring.save(BASE / 'spring/Parts/ripple-ring.png')
    arc.save(BASE / 'spring/Parts/ripple-arc.png')
    pool_surface = fitted(cells[7], (130, 305, 244, 325))
    upper_mask = np.zeros((512, 512), np.uint8)
    cv2.ellipse(upper_mask, (188, 315), (48, 7), 0, 0, 360, 255, cv2.FILLED, cv2.LINE_AA)
    upper_mask = upper_mask.astype(np.float32) / 255
    pool_surface *= upper_mask[:, :, None]
    save_part('spring', 'upper-surface', pool_surface)
    occluder_mask = mask_polygon([(181, 326), (246, 321), (259, 334), (195, 337)])
    occluder = ref * occluder_mask[:, :, None]
    save_part('spring', 'upper-lip-occluder', occluder)

    def frame(t):
        value = base.copy()
        phase = t * math.pi * 8
        local_x = X + .8 * math.sin(phase) * upper_mask
        local_y = Y + .45 * math.cos(phase) * upper_mask
        surface = cv2.remap(pool_surface, local_x.astype(np.float32), local_y.astype(np.float32), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
        value = over(surface, value)
        time = (t * 4) % 1
        for delay in [0, .5]:
            age = (time + delay) % 1
            ripple = ring if delay == 0 else arc
            w, h = int(32 + 250 * age), int(4 + 32 * age)
            left, top = int(234 + 34 * age - w / 2), int(357 + 22 * age - h / 2)
            target = Image.new('RGBA', (512, 512))
            target.paste(ripple.resize((w, h), Image.Resampling.LANCZOS), (left, top))
            layer = premul_source(target) * pool_mask[:, :, None] * (.38 * math.sin(math.pi * age) ** .8)
            value = over(layer, value)
        progress = time * len(ribbons)
        low = int(progress) % len(ribbons)
        q = progress - math.floor(progress)
        film = flow_between(ribbons[low], ribbons[(low + 1) % len(ribbons)], flows[low], q)
        layer = place_small(film, (189, 332, 269, 364))
        value = over(layer, value)
        return over(occluder, value)

    rig = {'parts': {'clean-pools': {'source': 'Parts/clean-pools.png', 'fixed': True},
        'upper-water': {'source': 'Parts/upper-surface.png', 'parent': 'upper-basin', 'pivot': [188, 315]},
        'curtain': {'sources': ['Parts/curtain-' + str(i) + '.png' for i in range(1, 5)],
                    'parent': 'upper-basin', 'bounds': [189, 332, 80, 32], 'cycles': 4,
                    'interpolation': 'registered-bidirectional-flow'},
        'ripples': {'sources': ['Parts/ripple-ring.png', 'Parts/ripple-arc.png'], 'origin': [234, 357], 'cycles': 4},
        'upper-lip': {'source': 'Parts/upper-lip-occluder.png', 'fixed': True}},
        'drawOrder': ['clean-pools', 'upper-water', 'ripples', 'curtain', 'upper-lip'],
        'fixed': ['outer pool silhouette', 'ground', 'upper basin lip'], 'periodMs': 4000}
    return frame, rig

def animated(frames, path, durations):
    path.parent.mkdir(511, True, True)
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0], stream, str(path))

def export(tribe, factory, full):
    folder = BASE / tribe
    frame, rig = factory()
    rig.update({'canvas': [512, 512], 'root': [256, 448], 'rootMotion': False, 'loop': True,
                'source': 'reference.png', 'frameCount': 80, 'frameMs': 50})
    write_json(folder / 'rig.json', rig)
    indices = range(80) if full else [0, 8, 16, 24, 32, 40, 56, 72]
    frames = []
    for i in indices:
        frames.append(rgba(frame(i / 80)))
        if i % 16 == 0:
            print(tribe, i, flush=True)
    contact = Image.new('RGB', (1536, 768), '#13201c')
    picks = [0, 8, 16, 24, 32, 40, 56, 72] if full else list(range(8))
    for cell, i in enumerate(picks):
        im = frames[i]
        panel = Image.new('RGB', (512, 512), '#13201c')
        panel.paste(im, (0, 0), im)
        contact.paste(panel.resize((384, 384), Image.Resampling.LANCZOS), (cell % 4 * 384, cell // 4 * 384))
    contact.save(WORK / (tribe + '-contact.png'))
    if not full:
        return
    sheet = Image.new('RGBA', (5120, 4096))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 10 * 512, i // 10 * 512))
    sheet.encoderinfo = {'lossless': True, 'quality': 100, 'method': 4}
    with (folder / 'idle.webp').open('wb') as stream:
        WebPImagePlugin._save(sheet, stream, str(folder / 'idle.webp'))
    durations = [50] * 80
    if tribe == 'pebble':
        durations[0] += 2000
    animated(frames, folder / 'preview.webp', durations)
    write_json(folder / 'animation.json', {'frameSize': [512, 512], 'frameCount': 80, 'columns': 10, 'rows': 8,
        'frameMs': 50, 'restMs': 2000 if tribe == 'pebble' else 0, 'durationsMs': durations,
        'loop': True, 'pivot': [256, 448], 'rootMotion': False, 'image': 'idle.webp', 'preview': 'preview.webp', 'rig': 'rig.json'})

if __name__ == '__main__':
    full = '--full' in sys.argv
    for tribe, factory in [('spore', spore), ('pebble', pebble), ('spring', spring)]:
        if not any(x in sys.argv for x in ['spore', 'pebble', 'spring']) or tribe in sys.argv:
            export(tribe, factory, full)
