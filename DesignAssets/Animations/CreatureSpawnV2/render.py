from pathlib import Path
import json
import math
import sys
import shutil
import subprocess
ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / '$Trash' / 'creature-emergence-redo-20261030'
sys.path.insert(0, str(ROOT / '$Trash' / 'creature-emergence-20261030' / 'python'))
from PIL import Image, ImageDraw
import numpy as np
import cv2
from engine import affine, matrix, mesh, ribbon, leaf_mesh, leaf, tube
BASE = Path(__file__).resolve().parent


def save_json(path, value):
    encoder = json.JSONEncoder()
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))


def smooth(value):
    value = max(0., min(1., float(value)))
    return value * value * (3 - 2 * value)


def channel(time, keys):
    if time <= keys[0][0]:
        return keys[0][1]
    for a, b in zip(keys, keys[1:]):
        if time <= b[0]:
            return a[1] + (b[1] - a[1]) * smooth((time - a[0]) / (b[0] - a[0]))
    return keys[-1][1]


def translate(x, y):
    return np.array([[1, 0, x], [0, 1, y], [0, 0, 1]], float)


def turn(pivot, degrees):
    return matrix(np.array(pivot, float), np.array(pivot, float), math.radians(degrees))


def polygon(points):
    image = Image.new('L', (512, 512))
    ImageDraw.Draw(image).polygon(points, 255)
    return np.array(image) > 0


def part(reference, visible, hidden, covered):
    original = np.array(reference)
    output = np.zeros_like(original)
    if hidden is not None:
        paint = np.array(hidden)
        keep = covered & (original[:, :, 3] == 255)
        output[keep] = paint[keep]
    output[visible] = original[visible]
    return Image.fromarray(output)


def prepare(name, specs):
    folder = BASE / name
    reference = Image.open(folder / 'Source/reference.png').convert('RGBA')
    source = np.array(reference)
    count, labels, stats, centers = cv2.connectedComponentsWithStats((source[:, :, 3] > 12).astype(np.uint8), 8)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    keep = cv2.dilate((labels == largest).astype(np.uint8), np.ones((3, 3), np.uint8))
    source[keep == 0] = 0
    reference = Image.fromarray(source)
    reference.save(folder / 'Source/reference.png')
    available = source[:, :, 3] > 0
    hsv = cv2.cvtColor(source[:, :, :3], cv2.COLOR_RGB2HSV)
    green = (hsv[:, :, 0] >= 38) & (hsv[:, :, 0] <= 105) & (hsv[:, :, 1] > 18)
    if name == 'snare-vine':
        foliage_region = np.zeros((512, 512), bool)
        for key, mask, paint in specs:
            if key.startswith('leaf-') or key in ['main', 'side', 'crown']:
                foliage_region |= mask
        corrected = []
        for key, mask, paint in specs:
            if key.startswith('leaf-') or key == 'crown':
                candidate = mask & green & available
                if key.startswith('leaf-'):
                    count, labels, stats, centers = cv2.connectedComponentsWithStats(candidate.astype(np.uint8), 8)
                    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                    candidate = (labels == largest)
                mask = candidate
            corrected.append((key, mask, paint))
        specs = corrected
    masks = {}
    covered = np.zeros((512, 512), bool)
    for key, mask, paint in reversed(specs):
        masks[key] = mask & available & ~covered
        covered |= masks[key]
    if np.any(available & ~covered):
        raise RuntimeError('Unassigned reference pixels')
    if name == 'snare-vine':
        yy, xx = np.mgrid[:512, :512]
        olive = (hsv[:, :, 0] >= 18) & (hsv[:, :, 0] < 38) & (hsv[:, :, 1] > 30)
        extra = masks['body'] & ((yy < 289) | (foliage_region & ~olive))
        targets = [key for key, _, _ in specs if key in ['main', 'side', 'crown'] or key.startswith('leaf-')]
        distances = np.array([cv2.distanceTransform((~masks[key]).astype(np.uint8), cv2.DIST_L2, 3) for key in targets])
        closest = np.argmin(distances, axis=0)
        for index, key in enumerate(targets):
            masks[key] |= extra & (closest == index)
        masks['body'][extra] = False
    images = {}
    for index, (key, mask, paint) in enumerate(specs):
        foreground = np.zeros((512, 512), bool)
        for other, _, _ in specs[index + 1:]:
            foreground |= masks[other]
        hidden = Image.open(folder / 'Source/Hidden' / paint).convert('RGBA') if paint else None
        images[key] = part(reference, masks[key], hidden, foreground)
    directory = folder / 'Parts'
    directory.mkdir(0o777, True, True)
    for key, image in images.items():
        image.save(directory / (key + '.png'))
    neutral = Image.new('RGBA', (512, 512))
    for key, _, _ in specs:
        neutral.alpha_composite(images[key])
    neutral.save(folder / 'neutral.png')
    difference = np.abs(np.array(neutral).astype(int) - np.array(reference).astype(int))
    visible = np.maximum(np.array(neutral)[:, :, 3], source[:, :, 3]) > 5
    print(name, 'neutral maximum difference', difference[visible].max(), 'changed pixels', np.any(difference > 2, 2).sum())
    overlay = Image.new('RGB', (512, 512), '#24332a')
    overlay.paste(reference, (0, 0), reference)
    draw = ImageDraw.Draw(overlay)
    colors = ['#ff6655', '#44ddff', '#ffdd44', '#cc77ff', '#55ff88', '#ffffff', '#ff77bb', '#ff9944', '#aaddff']
    for index, (key, mask, paint) in enumerate(specs):
        if key == 'body':
            continue
        contours, hierarchy = cv2.findContours(masks[key].astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            points = [tuple(v[0]) for v in contour]
            if len(points) > 2:
                draw.line(points + [points[0]], colors[index % len(colors)], 1)
    overlay.save(WORK / (name + '-parts-guide.png'))
    save_json(folder / 'Source/part-masks.json', {key: {'visibleReference': 'reference.png', 'partImage': '../Parts/' + key + '.png', 'hiddenSurface': paint} for key, mask, paint in specs})
    return images, reference, [key for key, _, _ in specs]


def ik(joints, hip_now, target):
    hip, knee, wrist = np.array(joints, float)
    upper, lower = np.linalg.norm(knee - hip), np.linalg.norm(wrist - knee)
    delta = target - hip_now
    distance = np.linalg.norm(delta)
    reach = max(abs(upper - lower) + .001, min(upper + lower - .001, distance))
    direction = math.atan2(delta[1], delta[0])
    a, b = knee - hip, wrist - hip
    bend = -1 if a[0] * b[1] - a[1] * b[0] > 0 else 1
    offset = math.acos(np.clip((reach * reach + upper * upper - lower * lower) / (2 * reach * upper), -1, 1))
    angle = direction + bend * offset
    elbow = hip_now + upper * np.array([math.cos(angle), math.sin(angle)])
    actual = hip_now + reach * np.array([math.cos(direction), math.sin(direction)])
    second_angle = math.atan2(actual[1] - elbow[1], actual[0] - elbow[0])
    first = matrix(hip_now, hip, angle - math.atan2(knee[1] - hip[1], knee[0] - hip[0]))
    second = matrix(elbow, knee, second_angle - math.atan2(wrist[1] - knee[1], wrist[0] - knee[0]))
    return first, second, actual, elbow


def limb_parts(image, joints):
    bounds = image.getchannel('A').getbbox()
    xs = np.arange(max(0, bounds[0] - 3), min(511, bounds[2] + 7), 7)
    ys = np.arange(max(0, bounds[1] - 3), min(511, bounds[3] + 7), 7)
    vertices = np.array([[x, y] for y in ys for x in xs], float)
    hip, knee, wrist = np.array(joints, float)
    axis = (wrist - hip) / np.linalg.norm(wrist - hip)
    along = (vertices - hip) @ axis
    elbow_position = (knee - hip) @ axis
    wrist_position = np.linalg.norm(wrist - hip)
    first = np.clip((along - elbow_position + 9) / 18, 0, 1)
    first = first * first * (3 - 2 * first)
    second = np.clip((along - wrist_position + 7) / 14, 0, 1)
    second = second * second * (3 - 2 * second)
    weights = np.column_stack([1 - first, first * (1 - second), first * second])
    pixels = np.array(image)
    ivory = ((pixels[:, :, 0] > 160) & (pixels[:, :, 1] > pixels[:, :, 0] * .8) & (pixels[:, :, 2] > pixels[:, :, 0] * .55) & (pixels[:, :, 3] > 8)).astype(np.uint8)
    ivory = cv2.dilate(ivory, np.ones((9, 9), np.uint8))
    points = np.clip(np.rint(vertices).astype(int), 0, 511)
    rigid = ivory[points[:, 1], points[:, 0]] > 0
    weights[rigid] = [0, 0, 1]
    triangles = []
    for row in range(len(ys) - 1):
        for col in range(len(xs) - 1):
            i = row * len(xs) + col
            triangles += [[i, i + 1, i + len(xs)], [i + 1, i + len(xs) + 1, i + len(xs)]]
    return vertices, weights, triangles


def limb_render(image, data, transforms):
    if all(np.allclose(value, np.eye(3)) for value in transforms):
        return image.copy()
    vertices, weights, triangles = data
    homogeneous = np.column_stack([vertices, np.ones(len(vertices))])
    transformed = np.array([(value @ homogeneous.T).T[:, :2] for value in transforms])
    destination = np.einsum('vb,bvi->vi', weights, transformed)
    return mesh(image, vertices, destination, triangles)


def mole_setup():
    all_pixels = np.ones((512, 512), bool)
    masks = {
        'far-hind': polygon([(355, 297), (403, 298), (413, 350), (351, 358)]),
        'tail': polygon([(413, 215), (476, 213), (475, 275), (415, 287)]),
        'far-paw': polygon([(72, 273), (146, 271), (183, 303), (170, 359), (71, 380), (44, 347)]),
        'head': polygon([(91, 237), (116, 189), (164, 147), (224, 126), (282, 142), (312, 178), (329, 231), (310, 278), (273, 312), (225, 333), (170, 327), (108, 287)]),
        'near-hind': polygon([(409, 302), (451, 304), (466, 345), (413, 360)]),
        'near-paw': polygon([(309, 263), (339, 271), (359, 299), (353, 342), (327, 394), (221, 409), (204, 364), (233, 324), (280, 296)])
    }
    order = ['far-hind', 'tail', 'body', 'far-paw', 'head', 'near-hind', 'near-paw']
    hidden = {'far-hind': 'far-hind.png', 'body': 'body.png', 'far-paw': 'far-paw.png', 'head': 'head.png', 'near-hind': 'near-hind.png', 'near-paw': 'near-paw.png'}
    specs = [(name, masks.get(name, all_pixels), hidden.get(name)) for name in order]
    images, reference, order = prepare('soil-mole', specs)
    joints = {'far-paw': [[149, 284], [140, 306], [116, 326]], 'near-paw': [[329, 279], [319, 309], [289, 345]]}
    limbs = {name: limb_parts(images[name], value) for name, value in joints.items()}
    for name, data in limbs.items():
        save_json(BASE / 'soil-mole' / (name + '-mesh.json'), {'vertices': data[0].tolist(), 'weights': data[1].tolist(), 'triangles': data[2], 'bones': ['upper', 'lower', 'palm']})
    save_json(BASE / 'soil-mole/rig.json', {'canvas': [512, 512], 'hierarchy': {'root': ['underground-body', 'bracing-shoulders', 'head'], 'underground-body': ['body', 'tail', 'far-hind', 'near-hind'], 'bracing-shoulders': ['far-paw-upper', 'near-paw-upper'], 'far-paw-upper': ['far-paw-lower'], 'near-paw-upper': ['near-paw-lower'], 'far-paw-lower': ['far-paw-palm'], 'near-paw-lower': ['near-paw-palm']}, 'forelegJoints': joints, 'headPivot': [267, 266], 'groundY': 398, 'drawOrder': order, 'phaseIntervalsSeconds': [[0, .24], [.24, .85], [.85, 1.6], [1.6, 2.16]], 'scale': 1, 'runtimeSize': 355})
    return images, reference, order, joints, limbs


def mole_frame(time, data):
    images, reference, order, joints, limbs = data
    rise = channel(time, [[0, 285], [.24, 285], [1.32, 0], [2.16, 0]])
    head_rise = rise - channel(time, [[0, 0], [.3, 0], [.8, 12], [1.35, 0], [2.16, 0]])
    head_angle = channel(time, [[0, 6], [.5, 6], [.95, -2], [1.4, 1], [1.7, 0]])
    body = translate(0, rise)
    head = translate(0, head_rise) @ turn([267, 266], head_angle)
    posed = {'body': affine(images['body'], body), 'head': affine(images['head'], head), 'tail': affine(images['tail'], body @ turn([420, 252], channel(time, [[0, 0], [1.2, 0], [1.45, 7], [1.7, -2], [2.0, 0]]))), 'far-hind': affine(images['far-hind'], body), 'near-hind': affine(images['near-hind'], body)}
    records = {}
    for name, joint in joints.items():
        delay = .08 if name == 'near-paw' else 0
        age = max(0, time - delay)
        dy = channel(age, [[0, 100], [.23, 100], [.65, 0], [2.16, 0]])
        palm_angle = channel(age, [[0, 22], [.27, 22], [.85, 0], [1.25, -3], [1.65, 0]])
        hip = np.array(joint[0], float) + [0, min(rise, 75)]
        target = np.array(joint[2], float) + [0, dy]
        first, second, actual, elbow = ik(joint, hip, target)
        palm = matrix(actual, np.array(joint[2], float), math.radians(palm_angle))
        if time >= 1.75:
            first = second = palm = np.eye(3)
            actual = np.array(joint[2], float)
        posed[name] = limb_render(images[name], limbs[name], [first, second, palm])
        records[name] = {'hip': hip.tolist(), 'wrist': actual.tolist(), 'palmAngle': palm_angle}
    output = Image.new('RGBA', (512, 512))
    if time >= .18:
        for name in order:
            output.alpha_composite(posed[name])
    return output, {'bodyRise': rise, 'headRise': head_rise, 'headAngle': head_angle, 'legs': records}


def vine_setup():
    previous = json.loads((BASE / 'snare-vine/Source/previous-rig.json').read_bytes())
    curves = {key: np.array(value['points'], float) for key, value in previous['rods'].items()}
    radii = {key: np.array(value['radii'], float) for key, value in previous['rods'].items()}
    texture = Image.open(BASE / 'snare-vine/Source/Hidden/vine-surface.png').convert('RGBA')
    for key in curves:
        complete = tube(texture, curves[key].copy(), radii[key].copy())
        complete.save(BASE / 'snare-vine/Source/Hidden' / (key + '-complete-bind.png'))
    yy, xx = np.mgrid[:512, :512]
    curve_masks = {}
    for key in curves:
        points = ribbon(curves[key], radii[key] + 5)
        outline = np.vstack([points[::2], points[1::2][::-1]])
        curve_masks[key] = polygon([tuple(value) for value in outline])
    masks = {
        'leaf-upper-left': polygon([(241, 307), (217, 260), (191, 222), (151, 200), (128, 204), (106, 238), (149, 234), (178, 250), (207, 286), (224, 305)]),
        'leaf-upper-right': polygon([(238, 312), (209, 281), (209, 248), (245, 209), (282, 192), (303, 194), (299, 228), (276, 268), (251, 292)]),
        'leaf-lower-left': polygon([(241, 309), (218, 273), (186, 258), (156, 267), (136, 288), (122, 333), (149, 324), (175, 310), (201, 302), (222, 316)]),
        'crown': polygon([(219, 286), (242, 283), (259, 316), (237, 330), (217, 311)]),
        'leaf-lower-right': polygon([(237, 300), (251, 286), (279, 292), (301, 313), (313, 353), (291, 355), (270, 337), (248, 321)]),
        'foot-left': polygon([(178, 402), (213, 402), (219, 440), (181, 440)]),
        'foot-front': polygon([(237, 416), (275, 416), (278, 454), (237, 454)]),
        'foot-right': polygon([(287, 393), (321, 393), (326, 432), (287, 432)])
    }
    order = ['body', 'foot-left', 'foot-front', 'foot-right', 'main', 'side', 'crown', 'leaf-upper-left', 'leaf-upper-right', 'leaf-lower-left', 'leaf-lower-right']
    specs = []
    for name in order:
        mask = curve_masks[name] if name in curves else masks.get(name, np.ones((512, 512), bool))
        paint = name + '-complete-bind.png' if name in curves else 'bulb.png' if name == 'body' else name + '.png' if name.startswith('leaf-') or name == 'crown' else None
        specs.append((name, mask, paint))
    images, reference, order = prepare('snare-vine', specs)
    leaves = {key: value for key, value in previous['leafControls'].items()}
    leaf_data = {key: leaf_mesh(images[key], value) for key, value in leaves.items()}
    initial = {'leaf-upper-left': 32, 'leaf-upper-right': -18, 'leaf-lower-left': 58, 'leaf-lower-right': -62}
    curve_data = {}
    for key, points in curves.items():
        delta = np.diff(points, axis=0)
        length = np.linalg.norm(delta, 2, 1)
        final = np.unwrap(np.arctan2(delta[:, 1], delta[:, 0]))
        sign = 1 if final[-1] > final[0] else -1
        turns = 1.85 if key == 'main' else 1.2
        angles = final[0] + sign * np.linspace(0, turns * 2 * math.pi, len(final))
        vertices = ribbon(points, radii[key] + 5)
        triangles = []
        for index in range(len(points) - 1):
            triangles += [[2 * index, 2 * index + 1, 2 * index + 2], [2 * index + 1, 2 * index + 3, 2 * index + 2]]
        curve_data[key] = {'length': length, 'final': final, 'initial': angles, 'vertices': vertices, 'triangles': triangles}
        save_json(BASE / 'snare-vine' / (key + '-mesh.json'), {'vertices': vertices.tolist(), 'triangles': triangles, 'bindPoints': points.tolist(), 'radii': radii[key].tolist(), 'boneLengths': length.tolist(), 'weights': [[index // 2, 1] for index in range(len(vertices))], 'boneParents': [None] + list(range(len(points) - 1))})
    save_json(BASE / 'snare-vine/rig.json', {'canvas': [512, 512], 'hierarchy': {'root': ['body', 'feet', 'leaf-roots', 'main-base', 'side-base'], 'main-base': ['main-segment-chain'], 'side-base': ['side-segment-chain'], 'leaf-roots': ['four-leaf-mid-bones']}, 'leafControls': leaves, 'closedLeafAnglesDegrees': initial, 'drawOrder': order, 'groundY': 448, 'outputOffsetY': 28, 'scale': 1, 'runtimeSize': 424})
    save_json(BASE / 'snare-vine/leaf-meshes.json', {key: {'vertices': value[0].tolist(), 'weights': [[1 - float(weight), float(weight)] for weight in value[1]], 'bones': ['root', 'mid'], 'triangles': value[2]} for key, value in leaf_data.items()})
    return images, reference, order, curves, radii, leaves, leaf_data, initial, curve_data


def vine_frame(time, data):
    images, reference, order, curves, radii, leaves, leaf_data, initial, curve_data = data
    dy = channel(time, [[0, 280], [.16, 280], [.96, 0], [2.415, 0]])
    body = translate(0, dy)
    posed = {key: affine(images[key], body) for key in ['body', 'foot-left', 'foot-front', 'foot-right', 'crown']}
    record = {'bodyRise': dy, 'curves': {}, 'leaves': {}}
    for key, bind in curves.items():
        curve = curve_data[key]
        delay = .16 if key == 'side' else 0
        progress = smooth((time - .58 - delay) / 1.35)
        along = np.linspace(0, 1, len(curve['length']))
        u = np.clip(progress * 1.35 - along * .35, 0, 1)
        u = u * u * (3 - 2 * u)
        angle = curve['initial'] * (1 - u) + curve['final'] * u
        delta = curve['length'][:, None] * np.column_stack([np.cos(angle), np.sin(angle)])
        points = np.vstack([bind[0], bind[0] + np.cumsum(delta, axis=0)])
        if progress >= 1:
            posed[key] = affine(images[key], body)
        else:
            destination = ribbon(points, radii[key] + 5) + [0, dy]
            posed[key] = mesh(images[key], curve['vertices'], destination, curve['triangles'])
        record['curves'][key] = points.tolist()
    for index, (key, control) in enumerate(leaves.items()):
        opening = smooth((time - .62 - index * .045) / .93)
        angle = math.radians(initial[key]) * (1 - opening)
        distal = math.radians(2) * math.sin(math.pi * opening) * (1 if index % 2 else -1)
        if opening >= 1:
            posed[key] = affine(images[key], body)
        else:
            posed[key] = leaf(images[key], leaf_data[key], control, [angle, distal], body)
        record['leaves'][key] = [angle, distal]
    output = Image.new('RGBA', (512, 512))
    for key in order:
        output.alpha_composite(posed[key])
    return output, record


def earth_source():
    image = Image.open(ROOT / 'DesignAssets/Animations/CreatureSpawnV1/source/soil-mole.png').convert('RGBA').crop((0, 235, 362, 475))
    pixels = np.array(image)
    mask = (pixels[:, :, 3] > 32).astype(np.uint8)
    count, labels, stats, center = cv2.connectedComponentsWithStats(mask, 8)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    keep = cv2.dilate((labels == largest).astype(np.uint8), np.ones((3, 3), np.uint8))
    pixels[keep == 0] = 0
    image = Image.fromarray(pixels)
    bounds = Image.fromarray((pixels[:, :, 3] > 32).astype(np.uint8) * 255).getbbox()
    image = image.crop(bounds)
    image.save(BASE / 'earth-source.png')
    return image


def earth(time, source, width, ground, front):
    result = Image.new('RGBA', (512, 512))
    alpha = 1 - smooth((time - 1.25) / .75)
    if alpha <= 0:
        return result
    if front:
        raw = Image.open(BASE / 'earth-foreground-source.png').convert('RGBA')
        value = np.array(raw)
        bounds = Image.fromarray((value[:, :, 3] > 32).astype(np.uint8) * 255).getbbox()
        image = raw.crop(bounds)
        target = round(width * 1.28)
        height = round(image.height * target / image.width * .38)
        image = image.resize((target, height), Image.Resampling.LANCZOS)
        value = np.array(image)
        value[:, :, 3] = np.rint(value[:, :, 3] * alpha).astype(np.uint8)
        result.alpha_composite(Image.fromarray(value), (256 - target // 2, ground + 22 - height))
        return result
    height = round(source.height * width / source.width)
    image = source.resize((width, height), Image.Resampling.LANCZOS)
    pixels = np.array(image)
    for side, box in [(-1, (0, 0, width // 2, height)), (1, (width // 2, 0, width, height))]:
        part_image = Image.fromarray(pixels).crop(box)
        part_pixels = np.array(part_image)
        part_pixels[:, :, 3] = np.rint(part_pixels[:, :, 3] * alpha).astype(np.uint8)
        opening = smooth((time - .45) / .95)
        x = 256 - width // 2 + box[0] + round(side * opening * width * .11)
        y = ground - height + 4 + round(opening * 5)
        result.alpha_composite(Image.fromarray(part_pixels), (x, y))
    return result


def encode(name, frames, durations, settings, records):
    folder = BASE / name
    temporary = WORK / name
    temporary.mkdir(0o777, True, True)
    size = settings['size']
    columns = 8
    sheet = Image.new('RGBA', (size * columns, size * math.ceil(len(frames) / columns)))
    for index, frame in enumerate(frames):
        frame.save(temporary / ('frame-%03d.png' % index))
        sheet.alpha_composite(frame, ((index % columns) * size, (index // columns) * size))
    sheet.save(temporary / 'sheet.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(temporary / 'sheet.png'), '-c:v', 'libwebp', '-lossless', '1', str(folder / 'emerge.webp')])
    lines = []
    for index, duration in enumerate(durations):
        lines += ["file 'frame-%03d.png'" % index, 'option framerate 1000', 'duration %.6f' % (duration / 1000)]
    lines += ["file 'frame-%03d.png'" % (len(frames) - 1), 'option framerate 1000']
    (temporary / 'frames.txt').write_bytes(('\r\n'.join(lines) + '\r\n').encode('utf-8'))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(temporary / 'frames.txt'), '-fps_mode', 'vfr', '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', str(folder / 'preview.webp')])
    frames[len(frames) // 2].save(folder / 'thumbnail.png')
    contact = Image.new('RGB', (4 * 256, 3 * 256), '#24332a')
    indices = np.linspace(0, len(frames) - 1, 12).astype(int)
    for position, index in enumerate(indices):
        image = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
        contact.paste(image, ((position % 4) * 256, (position // 4) * 256), image)
    contact.save(temporary / 'contact.png')
    save_json(folder / 'emerge.json', {'name': name, 'action': 'birth', 'construction': 'layered-cutout-and-textured-curve-rigs', 'reference': 'Source/reference.png', 'rig': 'rig.json', 'frameSize': size, 'columns': columns, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'rootMotion': False, 'pivotX': settings['pivot'][0], 'pivotY': settings['pivot'][1], 'image': 'emerge.webp', 'preview': 'preview.webp', 'thumbnail': 'thumbnail.png'})
    save_json(folder / 'timeline.json', records)
    print(name, 'exported', len(frames), 'frames', sum(durations), 'ms')


def main():
    WORK.mkdir(0o777, True, True)
    settings = {'soil-mole': {'size': 355, 'pivot': [177.5, 310.625], 'ground': 398, 'earthWidth': 350, 'step': 40, 'offset': 0}, 'snare-vine': {'size': 424, 'pivot': [211.5859375, 389.35125], 'ground': 448, 'earthWidth': 215, 'step': 45, 'offset': 28}}
    soil = earth_source()
    for name in sys.argv[1:] or ['soil-mole', 'snare-vine']:
        config = settings[name]
        data = mole_setup() if name == 'soil-mole' else vine_setup()
        foreground = np.array(earth(0, soil, config['earthWidth'], config['ground'], True))[:, :, 3]
        clip_y = np.full(512, config['ground'] + 5)
        for x in range(512):
            opaque = np.flatnonzero(foreground[:, x] > 230)
            if len(opaque):
                clip_y[x] = int(np.median(opaque))
        yy, xx = np.mgrid[:512, :512]
        visible = np.array(data[1])[:, :, 3] > 8
        print(name, 'neutral pixels below occluder', int(np.count_nonzero(visible & (yy >= clip_y[None, :]))))
        durations = [120] + [config['step']] * 51 + [160]
        time = 0
        frames, records = [], []
        for index, duration in enumerate(durations):
            actor, record = mole_frame(time, data) if name == 'soil-mole' else vine_frame(time, data)
            value = np.array(actor)
            if name == 'snare-vine':
                count, labels, stats, centers = cv2.connectedComponentsWithStats((value[:, :, 3] > 12).astype(np.uint8), 8)
                keep = np.zeros((512, 512), np.uint8)
                for label in range(1, count):
                    if stats[label, cv2.CC_STAT_AREA] >= 80:
                        keep[labels == label] = 1
                keep = cv2.dilate(keep, np.ones((3, 3), np.uint8))
                value[keep == 0] = 0
            value[yy >= clip_y[None, :]] = 0
            composed = earth(time, soil, config['earthWidth'], config['ground'], False)
            composed.alpha_composite(Image.fromarray(value))
            composed.alpha_composite(earth(time, soil, config['earthWidth'], config['ground'], True))
            if config['offset']:
                shifted = Image.new('RGBA', (512, 512)); shifted.alpha_composite(composed, (0, config['offset'])); composed = shifted
            frame = composed.resize((config['size'], config['size']), Image.Resampling.LANCZOS)
            frames.append(frame)
            record['timeSeconds'] = time
            records.append(record)
            time += duration / 1000
        encode(name, frames, durations, config, records)

if __name__ == '__main__':
    main()
