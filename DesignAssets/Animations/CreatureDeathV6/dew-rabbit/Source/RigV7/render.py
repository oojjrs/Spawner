import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, _webp

from engine import affine, ease, leg_matrices, make_mesh, rasterize, rotation, translation, write_json, encode
from flexible import mesh, skin, matrices


HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / 'rig.json').read_text('utf-8'))['configuration']
IMAGES = {p.stem: Image.open(p).convert('RGBA') for p in (HERE / 'Parts').glob('*.png')}
IMAGES['body'] = IMAGES['body-complete']
HEAD = IMAGES['head-complete-closed']
OPEN_HEAD = IMAGES['head-complete-open']
HEAD_MASK = Image.open(HERE / 'Parts/head-front-mask.png').convert('L')
EAR_MESHES = {name: mesh(IMAGES[name], joints) for name, joints in CONFIG['ears'].items()}
LEG_MESHES = {name: make_mesh(IMAGES[name], joints, 'leg') for name, joints in CONFIG['legs'].items()}
for name, data in LEG_MESHES.items():
    joints = CONFIG['legs'][name]
    data['blendPivots'] = [joints[1] if v[1] < joints[2][1] - 8 else joints[2] for v in data['vertices']]
EAR_TARGETS = {'far-ear': [-220, -240, -260], 'near-ear': [78, 100, 120]}


def progress(time, start, end):
    return ease((time - start) / (end - start))


def pose(time):
    body_amount = progress(time, 132, 660)
    head_amount = progress(time, 99, 726)
    body = translation(*CONFIG['rootOffset']) @ rotation(CONFIG['bodyPivot'], -8 * body_amount)
    head = body @ translation(-4 * head_amount, 63 * head_amount) @ rotation(CONFIG['headPivot'], -5 * head_amount)
    return body, head


def ear_pose(name, time, head):
    joints = np.array(CONFIG['ears'][name])
    delta = np.diff(joints, 1, 0)
    lengths = np.linalg.norm(delta, None, 1)
    angles = np.degrees(np.arctan2(delta[:, 1], delta[:, 0]))
    start = 330 if name == 'far-ear' else 429
    particles = [(head @ np.r_[joints[0], 1])[:2]]
    parent_angle = math.degrees(math.atan2(head[1, 0], head[0, 0]))
    for index, length in enumerate(lengths):
        amount = progress(time, start + index * 44, 1023 + index * 66)
        angle = math.radians(parent_angle + angles[index] + (EAR_TARGETS[name][index] - angles[index]) * amount)
        particles.append(particles[-1] + length * np.array([math.cos(angle), math.sin(angle)]))
    bones = matrices(joints, np.array(particles), head)
    data = EAR_MESHES[name]
    points = np.array(data['vertices'])
    raw = points[:, None, :] - joints[None, :-1, :]
    fractions = np.clip(np.sum(raw * delta[None, :, :], 2) / lengths[None, :] ** 2, 0, 1)
    closest = joints[None, :-1, :] + fractions[:, :, None] * delta[None, :, :]
    indices = np.argmin(np.sum((points[:, None, :] - closest) ** 2, 2), 1)
    centers = closest[np.arange(len(points)), indices]
    width = 1 - .40 * progress(time, 594, 1089)
    terminal = np.linalg.norm(points - joints[-1], None, 1)
    widths = width + (1 - width) * np.clip((24 - terminal) / 12, 0, 1)
    narrowed = centers + (points - centers) * widths[:, None]
    vertices = skin(narrowed, np.array(data['weights']), np.array(data['blendPivots']), bones)
    image, _ = rasterize(IMAGES[name], data, vertices)
    return image, particles, vertices


def render(time):
    body, head = pose(time)
    far_ear, far_points, _ = ear_pose('far-ear', time, head)
    near_ear, near_points, near_vertices = ear_pose('near-ear', time, head)
    legs = {}
    landmarks = {}
    for name, joints in CONFIG['legs'].items():
        bones, record = leg_matrices(joints, body, 1, CONFIG['rootOffset'])
        data = LEG_MESHES[name]
        vertices = skin(data['vertices'], np.array(data['weights']), np.array(data['blendPivots']), bones)
        legs[name], _ = rasterize(IMAGES[name], data, vertices)
        landmarks[name] = record
    result = Image.new('RGBA', (512, 512))
    result.alpha_composite(affine(IMAGES['tail'], body))
    result.alpha_composite(far_ear)
    result.alpha_composite(near_ear)
    result.alpha_composite(legs['foreleg-far'])
    result.alpha_composite(affine(IMAGES['body'], body))
    result.alpha_composite(legs['hindleg'])
    result.alpha_composite(legs['foreleg'])
    head_image = OPEN_HEAD if time < 99 else HEAD
    result.alpha_composite(affine(head_image, head))
    ruff_amount = progress(time, 165, 726)
    ruff = body @ translation(-8 * ruff_amount, 16 * ruff_amount) @ rotation((260, 340), -10 * ruff_amount)
    result.alpha_composite(affine(IMAGES['ruff'], ruff))
    front_head = np.array(head_image)
    moved_mask = HEAD_MASK.transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -30 * progress(time, 99, 726)), Image.Resampling.BILINEAR)
    front_head[:, :, 3] = np.minimum(front_head[:, :, 3], np.maximum(np.asarray(HEAD_MASK), np.asarray(moved_mask)))
    result.alpha_composite(affine(Image.fromarray(front_head), head))
    source = np.array(IMAGES['near-ear'])
    y, x = np.indices((512, 512))
    root = np.array(CONFIG['ears']['near-ear'][0])
    direction = np.array(CONFIG['ears']['near-ear'][1]) - root
    distance = ((x - root[0]) * direction[0] + (y - root[1]) * direction[1]) / np.linalg.norm(direction)
    source[:, :, 3] = np.uint8(source[:, :, 3] * np.clip((distance - 5) / 8, 0, 1))
    data = EAR_MESHES['near-ear']
    foreground, _ = rasterize(Image.fromarray(source), data, near_vertices)
    result.alpha_composite(foreground)
    return result, {'timeMs': time, 'body': body.tolist(), 'head': head.tolist(), 'ears': {'far': np.array(far_points).tolist(), 'near': np.array(near_points).tolist()}, 'legs': landmarks}


if __name__ == '__main__':
    output = HERE.parent.parent
    frame_folder = HERE / 'Frames'
    frame_folder.mkdir(511, True, True)
    times = list(range(0, 1156, 33))
    durations = [33] * (len(times) - 1) + [1000]
    frames = []
    records = []
    for index, time in enumerate(times):
        frame, record = render(time)
        frame.save(frame_folder / (str(index).zfill(3) + '.png'))
        frames.append(frame)
        records.append(record)
    sheet = Image.new('RGBA', (2048, math.ceil(len(frames) / 4) * 512))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index % 4 * 512, index // 4 * 512))
    (output / 'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(), True, 100.0, 100.0, '', 4, 1, b'', ''))
    encode(output / 'preview.webp', frames, durations)
    encode(output / 'thumbnail.webp', [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames], durations)
    prefix = 'DesignAssets/Animations/CreatureDeathV6/dew-rabbit/'
    metadata = {'name': 'dew-rabbit', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/dew-rabbit.png', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': 4, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'pivotX': 256, 'pivotY': 448, 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'Source/RigV7/render.py', 'sourceAuthoring': prefix + 'Source/RigV7/render.py', 'rig': prefix + 'Source/RigV7/rig.json', 'sourceFrames': ['Source/RigV7/Frames/' + str(index).zfill(3) + '.png' for index in range(len(frames))]}
    write_json(output / 'death.json', metadata)
    write_json(HERE / 'timeline.json', records)
    write_json(HERE / 'meshes.json', {'ears': EAR_MESHES, 'legs': LEG_MESHES})
    print('rendered', len(frames), 'frames;', sum(durations), 'ms')
