from pathlib import Path
import sys
import json
import shutil

VENDOR = Path('H:/Spawner/$Trash/NestGrowth03To04-v1/vendor')
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'Sources'
PARTS = ROOT / 'Parts'
SCALE = 2
SIZE = 512 * SCALE
Y, X = np.mgrid[:SIZE, :SIZE].astype(np.float32) / SCALE


def read(path):
    pixels = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def image(pixels):
    pixels = np.clip(pixels, 0, 1)
    rgb = pixels[:, :, :3] / np.maximum(pixels[:, :, 3:4], 1e-7)
    result = np.uint8(np.clip(np.dstack([rgb, pixels[:, :, 3]]) * 255 + .5, 0, 255))
    result[result[:, :, 3] == 0, :3] = 0
    return Image.fromarray(result)


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def path(start, segments):
    points = [start]
    a = np.array(start, float)
    for c1, c2, b in segments:
        c1, c2, b = np.array(c1), np.array(c2), np.array(b)
        for t in np.linspace(0, 1, 24)[1:]:
            points.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * b))
        a = b
    return np.array(points)


def mask(points):
    canvas = Image.new('L', (SIZE * 3, SIZE * 3))
    ImageDraw.Draw(canvas).polygon([tuple(p * SCALE * 3) for p in points], 255)
    alpha = np.array(canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)).astype(np.float32) / 255
    alpha[alpha < 2 / 255] = 0
    return alpha


def mirrored(points, center):
    result = points.copy()
    result[:, 0] = center - result[:, 0]
    return result


def alpha_part(rgb, alpha, outline_width):
    distance = cv2.distanceTransform(np.uint8(alpha > .5), cv2.DIST_L2, 5)
    edge = np.clip(outline_width * SCALE + .5 - distance, 0, 1)
    rgb = rgb * (1 - edge[:, :, None]) + np.array([.035, .15, .125]) * edge[:, :, None]
    return np.dstack([rgb * alpha[:, :, None], alpha]).astype(np.float32)


def metal_material(rgb, alpha, side, name):
    gold = (rgb[:, :, 0] > rgb[:, :, 1] * 1.08) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.08)
    density = cv2.blur(np.float32(gold), (9, 9))
    distance = cv2.distanceTransform(np.uint8(alpha > .5), cv2.DIST_L2, 5)
    dark = rgb.max(2) < .4
    valid = gold | ((density > .62) & (distance > 2)) | (dark & (density > .38) & (distance > 2))
    if name == 'rod':
        windows = np.zeros((SIZE, SIZE), bool)
        for x, y, radius in [(185, 165, 7), (151, 188, 7), (115, 260, 15)]:
            if side == 'right':
                x = 520 - x
            windows |= (X - x) ** 2 + (Y - y) ** 2 < radius ** 2
        saturation = (rgb.max(2) - rgb.min(2)) / np.maximum(rgb.max(2), 1e-6)
        green = (rgb[:, :, 1] > rgb[:, :, 0] * 1.02) & (saturation > .3)
        valid |= green & windows
    valid = np.uint8(valid & (alpha > .9))
    _, labels = cv2.distanceTransformWithLabels(1 - valid, cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    colors = rgb[valid > 0]
    return colors[np.clip(labels - 1, 0, len(colors) - 1)]


def register(path):
    data = json.loads((ROOT / 'registration.json').read_text('utf-8'))
    matrix = np.array(data['matrix'], np.float32) * SCALE
    return cv2.warpAffine(read(path), matrix, (SIZE, SIZE), None, cv2.INTER_CUBIC, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def pad_material(pixels):
    alpha = pixels[:, :, 3]
    distance = cv2.distanceTransform(np.uint8(alpha > .9), cv2.DIST_L2, 5)
    valid = np.uint8(distance > 4)
    _, labels = cv2.distanceTransformWithLabels(1 - valid, cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    rgb = pixels[:, :, :3] / np.maximum(alpha[:, :, None], 1e-7)
    colors = rgb[valid > 0]
    return colors[np.clip(labels - 1, 0, len(colors) - 1)].astype(np.float32)


def tps_map(source, target, points):
    a, b = np.array(source, float), np.array(target, float)
    delta = a[:, None] - a[None, :]
    distance = np.sum(delta * delta, 2)
    kernel = distance * np.log(distance + 1e-7)
    affine = np.c_[np.ones(len(a)), a]
    matrix = np.block([[kernel + np.eye(len(a)) * .01, affine], [affine.T, np.zeros((3, 3))]])
    solution = np.linalg.solve(matrix, np.vstack([b, np.zeros((3, 2))]))
    result = []
    for chunk in np.array_split(points, 32):
        delta = chunk[:, None] - a[None, :]
        distance = np.sum(delta * delta, 2)
        result.append(np.c_[distance * np.log(distance + 1e-7), np.ones(len(chunk)), chunk] @ solution)
    return np.vstack(result)


def interior_labels(neutral):
    pixels = np.array(image(neutral))
    rgb = pixels[:, :, :3]
    ink = (rgb.max(2) < 112) & (rgb[:, :, 1] < 105)
    inside = (pixels[:, :, 3] > 220) & ~cv2.dilate(np.uint8(ink), np.ones((2, 2), np.uint8)).astype(bool)
    return cv2.connectedComponentsWithStats(np.uint8(inside), 8)[1]


def build():
    neutral = register(SOURCE / 'neutral.png')
    opened = register(SOURCE / 'open.png')
    clean = register(SOURCE / 'backplate-clean.png')
    image(neutral).save(SOURCE / 'neutral-native.png')
    image(opened).save(SOURCE / 'open-native.png')
    small_neutral = cv2.resize(neutral, (512, 512), None, 0, 0, cv2.INTER_AREA)
    labels = interior_labels(small_neutral)
    atlas = read(SOURCE / 'petal-source.png')
    _, components, stats, centers = cv2.connectedComponentsWithStats(np.uint8(atlas[:, :, 3] > .5), 8)
    ids = [i for i in range(1, len(stats)) if stats[i, 4] > 1000]
    ids = [entry[1] for entry in sorted((centers[i, 0], i) for i in ids)]
    petal_outline = path((249.5, 304.5), [
        ((234, 301), (194, 297), (170, 289)),
        ((145, 281), (130, 266), (131, 243)),
        ((129, 218), (144, 191), (165, 178)),
        ((180, 168), (194, 166), (203, 172)),
        ((214, 177), (213, 187), (205, 192)),
        ((201, 195), (195, 197), (194, 192)),
        ((191, 201), (205, 214), (220, 225)),
        ((240, 241), (255, 266), (255, 288)),
        ((255, 298), (254, 303), (249.5, 304.5))
    ])
    target_landmarks = np.array([(249.5, 304.5), (174, 291), (132, 241), (138, 216), (171, 177), (194, 169), (210, 183), (196, 194), (200, 205), (220, 225), (243, 256), (255, 284), (253, 298), (172, 248), (219, 269), (166, 203)])
    uv_landmarks = np.array([(.87, .99), (.35, .90), (.025, .60), (.08, .42), (.34, .10), (.55, .008), (.71, .11), (.55, .21), (.57, .32), (.73, .45), (.90, .64), (.99, .81), (.96, .94), (.35, .56), (.69, .71), (.33, .28)])
    target_points = np.c_[X.ravel(), Y.ravel()]
    uv = tps_map(target_landmarks, uv_landmarks, target_points).reshape(SIZE, SIZE, 2)
    petal_masks = []
    for side, index, component in [('left', 40, ids[0]), ('right', 41, ids[1])]:
        ax, ay, aw, ah, _ = stats[component]
        texture = atlas[ay:ay + ah, ax:ax + aw].copy()
        texture *= np.float32(components[ay:ay + ah, ax:ax + aw] == component)[:, :, None]
        if side == 'right':
            texture = texture[:, ::-1].copy()
        material = pad_material(texture)
        coordinates = uv.copy()
        points = petal_outline
        if side == 'right':
            coordinates = cv2.warpAffine(coordinates, np.array([[-1, 0, 519 * SCALE], [0, 1, 0]], np.float32), (SIZE, SIZE))
            points = mirrored(petal_outline, 519)
        rgb = cv2.remap(material, np.float32(coordinates[:, :, 0] * (aw - 1)), np.float32(coordinates[:, :, 1] * (ah - 1)), cv2.INTER_CUBIC, None, cv2.BORDER_REPLICATE)
        alpha = mask(points)
        confidence = cv2.distanceTransform(np.uint8(labels == index), cv2.DIST_L2, 5)
        confidence = cv2.resize(np.clip((confidence - 3) / 7, 0, 1), (SIZE, SIZE), None, 0, 0, cv2.INTER_LINEAR)
        original_rgb = neutral[:, :, :3] / np.maximum(neutral[:, :, 3:4], 1e-7)
        rgb = rgb * (1 - confidence[:, :, None]) + original_rgb * confidence[:, :, None]
        part = alpha_part(rgb, alpha, .9)
        image(part).save(PARTS / ('petal-' + side + '.png'))
        petal_masks.append(alpha)
    sprout_outline = path((259, 209), [
        ((255.5, 207), (257, 201), (254.5, 195)),
        ((247, 190), (228, 189), (222, 178)),
        ((217, 171), (218, 159), (225, 157)),
        ((239, 153), (252, 167), (258.5, 181)),
        ((263, 174), (269, 159), (289, 157)),
        ((303, 152), (304, 168), (295, 179)),
        ((288, 188), (270, 191), (264, 195)),
        ((261, 200), (263, 208), (259, 209))
    ])
    sprout_alpha = mask(sprout_outline)
    neutral_rgb = neutral[:, :, :3] / np.maximum(neutral[:, :, 3:4], 1e-7)
    image(alpha_part(neutral_rgb, sprout_alpha, 1.05)).save(PARTS / 'sprout.png')
    crank = path((138, 255), [
        ((148, 253), (157, 257), (158, 267)),
        ((157, 282), (163, 294), (176, 306)),
        ((185, 311), (184, 322), (176, 328)),
        ((167, 334), (156, 330), (153, 324)),
        ((151, 320), (153, 316), (150, 308)),
        ((147, 300), (141, 290), (133, 285)),
        ((127, 282), (125, 276), (127, 268)),
        ((128, 260), (132, 256), (138, 255))
    ])
    rod = path((188, 155), [
        ((194, 155), (199, 160), (194, 168)),
        ((181, 179), (164, 188), (158, 195)),
        ((146, 213), (132, 235), (128, 247)),
        ((135, 252), (133, 265), (123, 271)),
        ((111, 278), (100, 269), (102, 256)),
        ((102, 250), (107, 246), (114, 244)),
        ((122, 228), (135, 204), (143, 192)),
        ((145, 183), (176, 162), (188, 155))
    ])
    coupler = path((115, 252), [
        ((124, 252), (137, 260), (143, 267)),
        ((149, 275), (142, 283), (134, 279)),
        ((125, 276), (115, 270), (112, 264)),
        ((109, 259), (110, 254), (115, 252))
    ])
    mechanical_masks = []
    for side in ['left', 'right']:
        for name, outline in [('crank', crank), ('rod', rod), ('coupler', coupler)]:
            if side == 'right':
                outline = mirrored(outline, 520)
            alpha = mask(outline)
            rgb = metal_material(neutral_rgb, alpha, side, name)
            part = alpha_part(rgb, alpha, .72)
            image(part).save(PARTS / (side + '-' + name + '.png'))
            mechanical_masks.append(alpha)
    hole_outline = path((111, 236), [
        ((118, 201), (158, 158), (208, 145)),
        ((233, 143), (282, 143), (311, 145)),
        ((358, 157), (398, 197), (410, 238)),
        ((415, 270), (398, 309), (380, 333)),
        ((310, 337), (210, 337), (139, 333)),
        ((115, 307), (101, 270), (111, 236))
    ])
    moving = np.maximum.reduce(petal_masks + mechanical_masks + [sprout_alpha])
    previous_mask_path = SOURCE / 'previous-moving-mask.png'
    if not previous_mask_path.exists():
        shutil.copyfile(ROOT.parent / 'Idle04-v1' / 'Parts' / 'moving-mask.png', previous_mask_path)
    old_mask = np.array(Image.open(previous_mask_path)).astype(np.float32) / 255
    old_mask = cv2.resize(old_mask, (SIZE, SIZE), None, 0, 0, cv2.INTER_LINEAR)
    erase = cv2.dilate(np.maximum(moving, old_mask), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    hole = np.maximum(mask(hole_outline), erase)
    hole = cv2.GaussianBlur(hole, (0, 0), 1.6 * SCALE)
    base = neutral * (1 - hole[:, :, None]) + clean * hole[:, :, None]
    image(base).save(PARTS / 'fixed-backplate.png')
    rear_labels = interior_labels(clean)
    left_label = rear_labels[155 * SCALE, 208 * SCALE]
    right_label = rear_labels[155 * SCALE, 310 * SCALE]
    if not left_label or not right_label:
        raise RuntimeError('Rear-petal occlusion seeds are outside the petal interiors')
    rear_alpha = np.float32((rear_labels == left_label) | (rear_labels == right_label))
    rear_alpha *= np.float32((Y < 232) & (X > 155) & (X < 365))
    rear_alpha = cv2.GaussianBlur(rear_alpha, (0, 0), .4 * SCALE)
    image(base * rear_alpha[:, :, None]).save(PARTS / 'fixed-rear-occluder.png')
    foreground = np.clip((Y - 332.2) * 2, 0, 1)
    root_ring = mask(path((235, 308), [((249, 306), (270, 306), (284, 308)), ((288, 314), (283, 325), (276, 328)), ((261, 333), (241, 328), (235, 322)), ((233, 318), (233, 313), (235, 308))]))
    foreground = np.maximum(foreground, root_ring)
    foot = mask(path((149, 328), [((155, 326), (176, 326), (181, 329)), ((185, 334), (185, 339), (179, 342)), ((166, 345), (152, 343), (148, 339)), ((146, 335), (146, 332), (149, 328))]))
    foreground = np.maximum(foreground, foot)
    foreground = np.maximum(foreground, cv2.warpAffine(foot, np.array([[-1, 0, 520 * SCALE], [0, 1, 0]], np.float32), (SIZE, SIZE)))
    image(neutral * foreground[:, :, None]).save(PARTS / 'fixed-foreground.png')
    Image.fromarray(np.uint8(moving * 255 + .5)).save(PARTS / 'moving-mask.png')
    print('Clean curved masks and complete source surfaces prepared at 1024x1024.', flush=True)


if __name__ == '__main__':
    build()
