from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import math
import json
import sys

folder = Path(__file__).resolve().parent
root = folder.parents[2]
work = root / '$Trash/unique-idle-three-20261027'
size = 512
yy, xx = np.mgrid[0:size, 0:size].astype(float)

def write_json(path, value):
    path.write_bytes((json.dumps(value, **{'ensure_ascii': False, 'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))

def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)

def control(keys, time):
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if time <= t1:
            return v0 + (v1 - v0) * float(smooth((time - t0) / (t1 - t0)))
    return keys[-1][1]

def polygon(points):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).polygon([tuple(point) for point in points], 255)
    return mask

def pixels(image):
    data = np.array(image).astype(float)
    data[:, :, :3] *= data[:, :, 3:4] / 255
    return data

def rgba(data):
    result = data.copy()
    result[:, :, :3] = result[:, :, :3] * 255 / np.maximum(result[:, :, 3:4], 0.00001)
    result = np.clip(result, 0, 255).round().astype(np.uint8)
    result[result[:, :, 3] == 0] = 0
    return Image.fromarray(result)

def sample(data, x, y):
    inside = (x >= 0) & (x <= size - 1) & (y >= 0) & (y <= size - 1)
    x, y = np.clip(x, 0, size - 1.001), np.clip(y, 0, size - 1.001)
    ix, iy = x.astype(int), y.astype(int)
    u, v = (x - ix)[..., None], (y - iy)[..., None]
    result = (data[iy, ix] * (1 - u) + data[iy, ix + 1] * u) * (1 - v) + (data[iy + 1, ix] * (1 - u) + data[iy + 1, ix + 1] * u) * v
    result *= inside[..., None]
    return result

def warp(image, fields, offsets):
    if all(abs(x) + abs(y) < 0.00001 for x, y in offsets):
        return image.copy()
    sx, sy = xx.copy(), yy.copy()
    for iteration in range(4):
        dx, dy = np.zeros((size, size)), np.zeros((size, size))
        for weight, offset in zip(fields, offsets):
            wx = np.clip(sx.round().astype(int), 0, size - 1)
            wy = np.clip(sy.round().astype(int), 0, size - 1)
            w = weight[wy, wx]
            dx += w * offset[0]
            dy += w * offset[1]
        sx, sy = xx - dx, yy - dy
    return rgba(sample(pixels(image), sx, sy))

def rotate(image, pivot, degrees, dy):
    if abs(degrees) + abs(dy) < 0.00001:
        return image.copy()
    angle = math.radians(degrees)
    c, s = math.cos(angle), math.sin(angle)
    x = xx - pivot[0]
    y = yy - pivot[1] - dy
    sx = c * x + s * y + pivot[0]
    sy = -s * x + c * y + pivot[1]
    return rgba(sample(pixels(image), sx, sy))

def layer(image, mask):
    data = np.array(image)
    data[:, :, 3] = np.minimum(data[:, :, 3], np.array(mask))
    data[data[:, :, 3] == 0] = 0
    return Image.fromarray(data)

def aligned(key, filename):
    source = folder / key / 'Source'
    record = json.loads((source / 'registration.json').read_text('utf-8'))
    image = Image.open(source / filename).convert('RGBA')
    original = Image.open(source / 'original.png')
    if image.size != original.size:
        image = image.resize(original.size, Image.Resampling.LANCZOS)
    crop = image.crop(tuple(record['sourceBounds']))
    crop = crop.resize((round(crop.width * record['scale']), round(crop.height * record['scale'])), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.alpha_composite(crop, tuple(record['origin']))
    return result

def leg_weights(specs):
    result = np.ones((size, size))
    for points, joint, foot in specs:
        mask = np.array(polygon(points).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(7))).astype(float) / 255
        axis = np.array(foot) - np.array(joint)
        t = ((xx - joint[0]) * axis[0] + (yy - joint[1]) * axis[1]) / np.dot(axis, axis)
        local = 1 - smooth((t - 0.06) / 0.76)
        result = result * (1 - mask) + local * mask
    return result

def rig_mesh(key, fields, bones, controls, extra):
    vertices = []
    weights = []
    for y in range(0, size + 1, 16):
        for x in range(0, size + 1, 16):
            vertices.append([x, y])
            weights.append([round(float(w[min(y, 511), min(x, 511)]), 5) for w in fields])
    triangles = []
    for y in range(32):
        for x in range(32):
            a = y * 33 + x
            triangles += [[a, a + 1, a + 33], [a + 1, a + 34, a + 33]]
    record = {'format': 'spawner-local-bone-mesh-v1', 'canvas': [512, 512], 'pivot': [256, 448], 'rootMotion': False, 'bones': bones, 'mesh': {'vertices': vertices, 'triangles': triangles, 'weights': weights}, 'controls': controls, 'spineCompatibilityVerified': False}
    record.update(extra)
    write_json(folder / key / 'rig.json', record)
    np.savez_compressed(folder / key / 'Source/weights.npz', **{'weights': np.stack(fields)})

def prepare_mountain():
    key = 'walking-forest'
    source = folder / key / 'Source'
    image = Image.open(source / 'neutral.png').convert('RGBA')
    body = leg_weights([
        ([(37, 399), (49, 376), (74, 350), (100, 350), (113, 377), (100, 417), (65, 423)], [88, 361], [69, 409]),
        ([(194, 396), (205, 367), (235, 350), (270, 358), (292, 385), (298, 420), (278, 449), (208, 449), (192, 433)], [247, 369], [242, 433]),
        ([(397, 397), (409, 364), (432, 348), (453, 364), (474, 397), (471, 419), (425, 426)], [433, 370], [438, 412])
    ])
    head = (1 - smooth((xx - 157) / 42)) * smooth((xx - 48) / 24) * smooth((yy - 285) / 24) * (1 - smooth((yy - 370) / 19))
    blink = aligned(key, 'blink-drawing.png')
    mask = Image.new('L', (512, 512), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((67, 312, 97, 345), 255)
    draw.ellipse((117, 313, 161, 356), 255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.6))
    attachment = layer(blink, mask)
    attachment.save(source / 'eyelids.png')
    a = np.array(image).astype(float)
    gold = (a[:, :, 0] > 180) & (a[:, :, 1] > 139) & (a[:, :, 0] > a[:, :, 2] * 1.38) & (a[:, :, 1] > a[:, :, 2] * 1.17) & (yy < 390) & (xx > 105)
    crystal = np.array(polygon([(249, 101), (275, 73), (299, 104), (316, 172), (295, 210), (260, 188)])) > 0
    glow = (gold.astype(float) * 0.8 + crystal.astype(float) * 0.65) * (a[:, :, 3] / 255)
    glow = np.minimum(glow, 1)
    Image.fromarray((glow * 255).astype(np.uint8)).save(source / 'mineral-mask.png')
    np.save(source / 'glow.npy', glow)
    controls = {'rise': [[0, 0], [1400, 0], [3200, 1], [4200, 1], [6400, 0], [8000, 0]], 'glow': [[0, 0], [1700, 0], [3400, 1], [4400, 0.75], [6000, 0], [8000, 0]], 'blink': [[0, 0], [3650, 0], [3730, 1], [3890, 1], [3970, 0], [8000, 0]]}
    rig_mesh(key, [body, head], [{'name': 'shell', 'parent': 'root', 'translationAtPeak': [0, -9]}, {'name': 'head', 'parent': 'shell', 'translationAtPeak': [-3, 0]}], controls, {'durationMs': 8000, 'drawOrder': ['body-mesh', 'eyelids'], 'rigidRegions': 'Whole mineral shell and crystal peaks translate as one rigid mass. Leg weights taper only through exposed skin to planted toes.'})

def prepare_leader():
    key = 'spiny-back-leader'
    source = folder / key / 'Source'
    image = Image.open(source / 'neutral.png').convert('RGBA')
    points = [
        [(107, 303), (123, 300), (132, 312), (124, 332), (115, 334), (124, 345), (115, 354), (101, 352), (96, 366), (87, 371), (84, 390), (94, 410), (78, 403), (66, 389), (56, 368), (54, 348), (59, 330), (78, 313)],
        [(177, 314), (193, 315), (209, 327), (219, 345), (222, 362), (215, 384), (201, 403), (179, 415), (149, 422), (124, 421), (126, 414), (145, 399), (160, 381), (163, 368), (153, 371), (147, 364), (156, 353), (148, 347), (157, 337), (163, 326)]
    ]
    original = np.array(image).astype(float)
    cream = (original[:, :, 0] > 95) & (original[:, :, 1] > 65) & (original[:, :, 0] < original[:, :, 1] * 1.65) & (original[:, :, 1] > original[:, :, 2] * 1.08) & (original[:, :, 3] > 0)
    cream = Image.fromarray(np.where(cream, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    masks = []
    for points_for_jaw in points:
        mask = Image.fromarray(np.minimum(np.array(polygon(points_for_jaw).filter(ImageFilter.MaxFilter(9))), np.array(cream)))
        outside = mask.copy()
        ImageDraw.floodfill(outside, (0, 0), 128)
        filled = np.where((np.array(outside) != 128), 255, 0).astype(np.uint8)
        chitin = (original[:, :, 0] > original[:, :, 1] * 1.75) & (original[:, :, 2] > original[:, :, 1] * 0.65)
        filled[chitin] = 0
        masks.append(Image.fromarray(filled))
    union = np.maximum(np.array(masks[0]), np.array(masks[1]))
    raw = np.array(image)
    body_pixels = raw.copy()
    body_pixels[:, :, 3] = np.where(union > 0, 0, raw[:, :, 3])
    underpaint = aligned(key, 'mouth-underpaint.png')
    underpaint = underpaint.transform((512, 512), Image.Transform.AFFINE, (1, 0, -8, 0, 1, 29), Image.Resampling.BICUBIC)
    fill = Image.fromarray(union).filter(ImageFilter.MaxFilter(5))
    restrict = polygon([(89, 300), (126, 294), (158, 306), (192, 306), (210, 328), (212, 356), (184, 367), (147, 361), (111, 352), (91, 331)])
    fill = Image.fromarray(np.minimum(np.array(fill), np.array(restrict)))
    base = layer(underpaint, fill)
    base.alpha_composite(Image.fromarray(body_pixels))
    base.save(source / 'body.png')
    for name, mask in zip(['mandible-far', 'mandible-near'], masks):
        part = layer(image, mask)
        part.save(source / (name + '.png'))
        mask.save(source / (name + '-mask.png'))
    weight = leg_weights([
        ([(36, 344), (40, 319), (58, 295), (83, 290), (83, 315), (62, 345), (55, 370), (43, 371)], [64, 313], [48, 354]),
        ([(237, 347), (256, 328), (278, 336), (294, 355), (289, 384), (271, 429), (254, 449), (240, 432), (239, 398)], [266, 354], [252, 432]),
        ([(326, 352), (347, 342), (371, 355), (389, 387), (389, 412), (375, 433), (356, 414), (345, 389)], [354, 362], [377, 419]),
        ([(419, 338), (437, 316), (456, 323), (474, 350), (476, 379), (466, 399), (445, 383), (437, 360)], [442, 338], [462, 380])
    ])
    controls = {'rise': [[0, 0], [1200, 0], [2300, 1], [3700, 1], [4650, 0], [7200, 0]], 'jaw': [[0, 0], [1600, 0], [2900, 1], [3460, 1], [3630, -0.45], [3790, -0.2], [4080, 0], [7200, 0]]}
    rig_mesh(key, [weight], [{'name': 'carapace', 'parent': 'root', 'translationAtPeak': [0, -6]}, {'name': 'mandible-far', 'parent': 'carapace', 'pivot': [115, 315], 'degreesAtPeak': 13}, {'name': 'mandible-near', 'parent': 'carapace', 'pivot': [181, 329], 'degreesAtPeak': -16}], controls, {'durationMs': 7200, 'drawOrder': ['body', 'mandible-far', 'mandible-near'], 'underpainting': 'Generated mouth surface is used only where the original moving jaw roots uncover the face.'})

def prepare_white_paw():
    key = 'white-paw'
    source = folder / key / 'Source'
    sheet = Image.open(source / 'pose-drawings.png').convert('RGBA')
    a = np.array(sheet)
    owners = np.load(source / 'pose-owners.npz')['owners']
    registrations = []
    for index in range(9):
        mask = Image.fromarray(np.where(owners == index, 255, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
        rgba_pose = a.copy()
        rgba_pose[:, :, 3] = np.minimum(rgba_pose[:, :, 3], np.array(mask))
        rgba_pose[rgba_pose[:, :, 3] < 20] = 0
        pose = Image.fromarray(rgba_pose)
        scale = 0.88
        origin = (35 - index % 3 * 458 * scale, 129 - index // 3 * 382 * scale)
        posed = pose.transform((512, 512), Image.Transform.AFFINE, (1 / scale, 0, -origin[0] / scale, 0, 1 / scale, -origin[1] / scale), Image.Resampling.BICUBIC)
        posed.save(source / ('pose-' + str(index) + '.png'))
        registrations.append({'drawing': index, 'commonScale': scale, 'translation': list(origin)})
    upper = (1 - smooth((yy - 287) / 125))
    chest = smooth((xx - 100) / 45) * (1 - smooth((xx - 300) / 60)) * smooth((yy - 175) / 45) * (1 - smooth((yy - 370) / 60))
    tail = smooth((xx - 285) / 70) * (1 - smooth((yy - 372) / 65))
    controls = {'drawings': [[0, 'neutral'], [1400, '1'], [1520, '2'], [1650, '3'], [1770, '4'], [1890, '5'], [4500, '4'], [4640, '3'], [4780, '2'], [4920, '1'], [5060, 'neutral'], [7800, 'neutral']], 'breathing': [[1890, 0], [2370, 1], [2980, 0], [3500, 1], [4160, 0], [4500, 0]]}
    rig_mesh(key, [upper, chest, tail], [{'name': 'upper-body', 'parent': 'root', 'translationAtInhale': [0, -3.5]}, {'name': 'chest', 'parent': 'root', 'translationAtInhale': [-1.2, -0.8]}, {'name': 'tail', 'parent': 'root', 'translationAtInhale': [1.5, -1.5]}], controls, {'durationMs': 7800, 'drawOrder': ['complete-drawing'], 'method': 'New complete drawings supply the large change of pose and exposed abdomen. A weighted local torso and tail mesh animates the upright hold. No crossfades or interpolated replacement silhouettes.', 'drawingRegistrations': registrations})

def render_mountain(time, rig, sources):
    rise = control(rig['controls']['rise'], time)
    glow = control(rig['controls']['glow'], time)
    blink = control(rig['controls']['blink'], time)
    image = sources['neutral'].copy()
    data = np.array(image).astype(float)
    wave = smooth((time - (2100 + (390 - yy) * 2.1)) / 600)
    amount = sources['glow'] * glow * wave
    data[:, :, :3] += (255 - data[:, :, :3]) * amount[:, :, None] * np.array([0.30, 0.25, 0.12])
    image = Image.fromarray(np.clip(data, 0, 255).round().astype(np.uint8))
    if blink > 0.6:
        image.alpha_composite(sources['eyelids'])
    return warp(image, sources['weights'], [(0, -9 * rise), (-3 * rise, 0)])

def render_leader(time, rig, sources):
    rise = control(rig['controls']['rise'], time)
    jaw = control(rig['controls']['jaw'], time)
    if rise < 0.00001 and abs(jaw) < 0.00001:
        return sources['neutral'].copy()
    frame = warp(sources['body'], sources['weights'], [(0, -6 * rise)])
    frame.alpha_composite(rotate(sources['mandible-far'], [115, 315], 13 * jaw, -6 * rise))
    frame.alpha_composite(rotate(sources['mandible-near'], [181, 329], -16 * jaw, -6 * rise))
    return frame

def render_white_paw(time, rig, sources):
    drawing = 'neutral'
    for at, name in rig['controls']['drawings']:
        if time < at:
            break
        drawing = name
    if drawing == 'neutral':
        return sources['neutral'].copy()
    image = sources['pose-' + drawing]
    if drawing != '5':
        return image.copy()
    breath = control(rig['controls']['breathing'], time)
    return warp(image, sources['weights'], [(0, -3.5 * breath), (-1.2 * breath, -0.8 * breath), (1.5 * breath, -1.5 * breath)])

def load_sources(key):
    source = folder / key / 'Source'
    images = {p.stem: Image.open(p).convert('RGBA') for p in source.glob('*.png') if p.stem not in ['original', 'blink-drawing', 'pose-drawings', 'mouth-underpaint']}
    images['weights'] = list(np.load(source / 'weights.npz')['weights'])
    if key == 'walking-forest':
        images['glow'] = np.load(source / 'glow.npy')
    return images

def main():
    mode = sys.argv[1]
    if mode == 'prepare':
        prepare_mountain()
        prepare_leader()
        prepare_white_paw()
        return
    functions = {'walking-forest': render_mountain, 'white-paw': render_white_paw, 'spiny-back-leader': render_leader}
    selected = sys.argv[2:] or list(functions)
    for key in selected:
        target = folder / key
        rig = json.loads((target / 'rig.json').read_text('utf-8'))
        sources = load_sources(key)
        if mode == 'keys':
            times = [0, 1700, 3200, 3780, 4800, 6500] if key == 'walking-forest' else ([0, 1500, 1650, 1890, 2800, 4850] if key == 'white-paw' else [0, 1800, 2900, 3500, 3660, 4500])
            board = Image.new('RGB', (1536, 1056), (35, 43, 46))
            for index, at in enumerate(times):
                frame = functions[key](at, rig, sources)
                x, y = index % 3 * 512, index // 3 * 528
                board.paste(frame, (x, y), frame)
                ImageDraw.Draw(board).text((x + 12, y + 10), str(at) + ' ms', (240, 240, 240))
            board.save(work / (key + '-keys.png'))
        elif mode == 'render':
            frames_dir = work / key / 'Frames'
            frames_dir.mkdir(511, True, True)
            times = list(range(0, rig['durationMs'], 50))
            for index, at in enumerate(times):
                functions[key](at, rig, sources).save(frames_dir / ('idle-' + str(index).zfill(3) + '.png'))
            write_json(work / key / 'timing.json', {'durationsMs': [50] * len(times), 'durationMs': rig['durationMs']})
            print(key, len(times), flush=True)

if __name__ == '__main__':
    main()
