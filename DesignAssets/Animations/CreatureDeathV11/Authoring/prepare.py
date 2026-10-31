from pathlib import Path
from collections import deque
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]


def save_json(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def component(mask, seed):
    work = mask.copy()
    x, y = seed
    if not work[y, x]:
        ys, xs = np.where(work)
        if not len(xs):
            return work
        index = np.argmin((xs - x) ** 2 + (ys - y) ** 2)
        x, y = int(xs[index]), int(ys[index])
    found = np.zeros(work.shape, np.uint8)
    queue = deque([(x, y)])
    work[y, x] = False
    while queue:
        x, y = queue.popleft()
        found[y, x] = 255
        for xx, yy in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
            if 0 <= xx < work.shape[1] and 0 <= yy < work.shape[0] and work[yy, xx]:
                work[yy, xx] = False
                queue.append((xx, yy))
    return found


def portal_mask(body, rectangle, seed):
    a = np.array(body)
    dark = (a[:, :, 3] > 128) & (a[:, :, :3].astype(float).mean(2) < 110)
    region = np.zeros((512, 512), bool)
    x0, y0, x1, y1 = rectangle
    region[y0:y1, x0:x1] = True
    dark &= region
    eroded = np.array(Image.fromarray(dark.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0
    selected = component(eroded, seed)
    grown = np.array(Image.fromarray(selected).filter(ImageFilter.MaxFilter(3))) > 0
    return Image.fromarray((grown & dark).astype(np.uint8) * 255)


def cut_part(atlas, rectangle):
    part = atlas.crop(rectangle)
    a = np.array(part)
    a[:, :, 3] = np.clip(a[:, :, 3].astype(float) * 255 / 253, 0, 255).astype(np.uint8)
    ys, xs = np.where(a[:, :, 3] > 24)
    x0, y0 = max(0, int(xs.min()) - 6), max(0, int(ys.min()) - 6)
    x1, y1 = min(a.shape[1], int(xs.max()) + 7), min(a.shape[0], int(ys.max()) + 7)
    return Image.fromarray(a[y0:y1, x0:x1]), [rectangle[0] + x0, rectangle[1] + y0]


def matrix(position, angle):
    angle = math.radians(angle)
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s, position[0]], [s, c, position[1]], [0, 0, 1]], float)


def mesh_for(image, offset, source_joints, root, scale, angle, kind):
    w, h = image.size
    local_joints = np.array(source_joints, float) - np.array(offset)
    rotation = matrix([0, 0], angle)[:2, :2]
    joints = (local_joints - local_joints[0]) @ rotation.T * scale + np.array(root)
    xs, ys = np.linspace(0, w - 1, 7), np.linspace(0, h - 1, 13)
    source = np.array([[x, y] for y in ys for x in xs])
    vertices = (source - local_joints[0]) @ rotation.T * scale + np.array(root)
    triangles = []
    for y in range(12):
        for x in range(6):
            k = y * 7 + x
            triangles.extend([[k, k + 1, k + 7], [k + 1, k + 8, k + 7]])
    if kind == 'head':
        left = w * 0.72
        weights = np.clip((source[:, 0] - left) / (w * 0.22), 0, 1)
        bindings = [matrix(joints[1], 0), matrix(joints[0], 0)]
    else:
        center = local_joints[1, 1]
        weights = np.clip((source[:, 1] - center + h * 0.12) / (h * 0.24), 0, 1)
        upper_angle = math.degrees(math.atan2(*(joints[1] - joints[0])[::-1]))
        lower_angle = math.degrees(math.atan2(*(joints[2] - joints[1])[::-1]))
        bindings = [matrix(joints[0], upper_angle), matrix(joints[1], lower_angle)]
    return {'sourceVertices': source.tolist(), 'bindVertices': vertices.tolist(), 'triangles': triangles,
            'weights': [[1 - float(v), float(v)] for v in weights], 'joints': joints.tolist(),
            'bindMatrices': [b.tolist() for b in bindings], 'sourceOffset': offset, 'sourceScale': scale,
            'sourceAngle': angle}


def prepare(name, settings):
    folder = ROOT / name
    parts_dir, masks_dir = folder / 'Parts', folder / 'Masks'
    if not parts_dir.exists():
        parts_dir.mkdir()
    if not masks_dir.exists():
        masks_dir.mkdir()
    atlas = Image.open(folder / 'Source/RigDrawing/parts-atlas.png').convert('RGBA')
    body = Image.open(folder / 'Source/KeyframesV2/key-03-rest.png').convert('RGBA')
    body_pixels = np.array(body)
    body_pixels[:, :, 3] = np.clip(body_pixels[:, :, 3].astype(float) * 255 / 253, 0, 255).astype(np.uint8)
    body = Image.fromarray(body_pixels)
    body.save(parts_dir / 'shell.png')
    cropped = {}
    offsets = {}
    rectangles = [[0, 0, 550, 512], [550, 0, 1060, 512], [1060, 0, 1536, 512],
                  [0, 512, 550, 1024], [550, 512, 1060, 1024], [1060, 512, 1536, 1024]]
    names = ['head-open', 'head-closed-source', 'fore-far', 'fore-near', 'hind-near', 'tail']
    for part_name, rectangle in zip(names, rectangles):
        cropped[part_name], offsets[part_name] = cut_part(atlas, rectangle)
    open_head = cropped['head-open']
    closed_source = cropped['head-closed-source'].resize(open_head.size, Image.Resampling.LANCZOS)
    eye_mask = Image.new('L', open_head.size)
    draw = ImageDraw.Draw(eye_mask)
    for box in settings['eyeBoxes']:
        draw.ellipse(box, 255)
    eye_mask = eye_mask.filter(ImageFilter.GaussianBlur(0.8))
    cropped['head-closed'] = Image.composite(closed_source, open_head, eye_mask)
    for part_name, image in cropped.items():
        image.save(parts_dir / (part_name + '.png'))
    portals = {}
    for portal_name, specification in settings['portals'].items():
        mask = portal_mask(body, specification[0], specification[1])
        mask.save(masks_dir / (portal_name + '.png'))
        a = np.array(mask)
        yy, xx = np.where(a > 0)
        portals[portal_name] = {'mask': 'Masks/' + portal_name + '.png', 'bounds': [int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1]}
    attachments = []
    for spec in settings['attachments']:
        part_name = spec['id']
        source_name = 'head-open' if part_name == 'head' else part_name
        image = cropped[source_name]
        geometry = mesh_for(image, offsets[source_name], spec['sourceJoints'], spec['root'], spec['scale'], spec['angle'], spec['kind'])
        entry = dict(spec)
        entry.update(geometry)
        bone_ids = [part_name + '-skull', part_name + '-neck'] if spec['kind'] == 'head' else [part_name + '-upper', part_name + '-lower']
        parent_indices = [1, -1] if spec['kind'] == 'head' else [-1, 0]
        entry['bones'] = []
        for index, bone_id in enumerate(bone_ids):
            parent_index = parent_indices[index]
            global_bind = np.array(geometry['bindMatrices'][index])
            local_bind = global_bind if parent_index < 0 else np.linalg.inv(np.array(geometry['bindMatrices'][parent_index])) @ global_bind
            entry['bones'].append({'id': bone_id, 'parent': 'shell-motion' if parent_index < 0 else bone_ids[parent_index], 'bindLocalMatrix': local_bind.tolist(), 'bindWorldMatrix': global_bind.tolist()})
        entry['image'] = 'Parts/' + source_name + '.png'
        if part_name == 'head':
            entry['closedImage'] = 'Parts/head-closed.png'
        entry['portal'] = portals[spec['portal']]
        attachments.append(entry)
    rig = {'name': name, 'appearanceAuthority': 'DesignAssets/CreatureConcepts/v3/' + name + '.png',
           'approvedKeyframes': '../keyframes-v2.json', 'canvas': [512, 512], 'pivot': [256, 448],
           'groundY': 448, 'fps': 30, 'gravity': settings['gravity'], 'restitution': 0.025,
           'durationMs': settings['duration'], 'holdMs': settings['hold'], 'eyesCloseMs': settings['eyesClose'],
           'shell': 'Parts/shell.png', 'coordinateSpace': 'image-uv-y-down',
           'bones': [{'id': 'canvas', 'parent': None, 'position': [0, 0]}, {'id': 'shell-motion', 'parent': 'canvas', 'position': [0, 0]}],
           'drawOrder': [a['id'] for a in attachments], 'attachments': attachments}
    save_json(folder / 'rig.json', rig)
    print(name, 'portal bounds', {k: v['bounds'] for k, v in portals.items()})


COMMON_VINE = {
    'eyeBoxes': [[14, 66, 83, 176], [126, 57, 273, 217]],
    'portals': {'head': [[120, 361, 198, 423], [161, 393]], 'fore-near': [[208, 396, 262, 437], [233, 416]],
                'hind-near': [[328, 408, 373, 442], [349, 425]], 'fore-far': [[94, 383, 123, 421], [109, 402]],
                'tail': [[384, 392, 408, 420], [394, 406]]},
    'gravity': 1200, 'duration': 1667, 'hold': 900, 'eyesClose': 100,
    'attachments': [
        {'id': 'fore-far', 'kind': 'leg', 'portal': 'fore-far', 'sourceJoints': [[1363, 169], [1297, 279], [1211, 416]], 'root': [142, 392], 'scale': 0.26, 'angle': 0, 'time': [100, 570], 'fold': [85, -155], 'inward': [60, -25]},
        {'id': 'tail', 'kind': 'tail', 'portal': 'tail', 'sourceJoints': [[1190, 771], [1300, 779], [1417, 748]], 'root': [401, 390], 'scale': 0.15, 'angle': 0, 'time': [750, 1460], 'fold': [-15, -5], 'inward': [-70, 8]},
        {'id': 'hind-near', 'kind': 'leg', 'portal': 'hind-near', 'sourceJoints': [[748, 654], [819, 777], [861, 885]], 'root': [349, 419], 'scale': 0.29, 'angle': -35, 'time': [620, 1370], 'fold': [-60, 175], 'inward': [-20, -55]},
        {'id': 'head', 'kind': 'head', 'portal': 'head', 'sourceJoints': [[500, 310], [244, 282], [390, 304]], 'root': [242, 397], 'scale': 0.36, 'angle': 0, 'time': [150, 930], 'fold': [-10, 0], 'inward': [132, -7]},
        {'id': 'fore-near', 'kind': 'leg', 'portal': 'fore-near', 'sourceJoints': [[188, 650], [288, 765], [327, 882]], 'root': [223, 406], 'scale': 0.29, 'angle': 0, 'time': [210, 1090], 'fold': [-85, 160], 'inward': [20, -50]}
    ]
}

COMMON_MOUNTAIN = {
    'eyeBoxes': [[0, 46, 81, 176], [112, 44, 259, 206]],
    'portals': {'head': [[119, 361, 220, 411], [171, 387]], 'fore-near': [[215, 376, 288, 426], [251, 402]],
                'hind-near': [[418, 375, 468, 417], [442, 397]], 'fore-far': [[82, 350, 123, 410], [104, 382]],
                'tail': [[471, 366, 487, 391], [477, 380]]},
    'gravity': 1050, 'duration': 2267, 'hold': 1100, 'eyesClose': 133,
    'attachments': [
        {'id': 'fore-far', 'kind': 'leg', 'portal': 'fore-far', 'sourceJoints': [[1275, 170], [1315, 298], [1244, 431]], 'root': [80, 395], 'scale': 0.20, 'angle': 0, 'time': [160, 780], 'fold': [65, -165], 'inward': [65, -35]},
        {'id': 'tail', 'kind': 'tail', 'portal': 'tail', 'sourceJoints': [[1190, 785], [1300, 805], [1438, 731]], 'root': [477, 372], 'scale': 0.12, 'angle': 0, 'time': [1000, 1960], 'fold': [-15, -5], 'inward': [-70, 8]},
        {'id': 'hind-near', 'kind': 'leg', 'portal': 'hind-near', 'sourceJoints': [[816, 631], [832, 755], [807, 897]], 'root': [440, 397], 'scale': 0.26, 'angle': -35, 'time': [900, 1850], 'fold': [-65, 175], 'inward': [-24, -55]},
        {'id': 'head', 'kind': 'head', 'portal': 'head', 'sourceJoints': [[448, 311], [202, 247], [344, 285]], 'root': [223, 405], 'scale': 0.38, 'angle': 0, 'time': [190, 1210], 'fold': [-10, 0], 'inward': [145, -5]},
        {'id': 'fore-near', 'kind': 'leg', 'portal': 'fore-near', 'sourceJoints': [[280, 633], [338, 762], [257, 905]], 'root': [251, 402], 'scale': 0.275, 'angle': 0, 'time': [320, 1380], 'fold': [-75, 165], 'inward': [18, -55]}
    ]
}

if __name__ == '__main__':
    prepare('vine-turtle', COMMON_VINE)
    prepare('walking-forest', COMMON_MOUNTAIN)
