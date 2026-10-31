import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, _webp

from engine import affine, ease, encode, rasterize, rotation, sample, translation, write_json
from flexible import matrices, mesh, skin


HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / 'rig.json').read_text('utf-8'))['configuration']
IMAGES = {p.stem: Image.open(p).convert('RGBA') for p in (HERE / 'Parts').glob('*.png')}
EAR_MESHES = {name: mesh(IMAGES[name], joints) for name, joints in CONFIG['ears'].items()}
EAR_TARGETS = {'far-ear': [-200, -215, -230], 'near-ear': [78, 100, 120]}


def progress(time, start, end):
    return ease((time - start) / (end - start))


def pose(time):
    amount = progress(time, 132, 660)
    head_amount = progress(time, 99, 726)
    parent = translation(*CONFIG['rootOffset']) @ rotation(CONFIG['bodyPivot'], -8 * amount)
    head = parent @ translation(-4 * head_amount, 63 * head_amount) @ rotation(CONFIG['headPivot'], -5 * head_amount)
    return head


def neck_weight(x, y):
    horizontal = np.clip((310 - x) / 120, 0, 1)
    vertical = np.clip((426 - y) / 150, 0, 1)
    horizontal = horizontal * horizontal * (3 - 2 * horizontal)
    vertical = vertical * vertical * (3 - 2 * vertical)
    return horizontal * vertical


def body_layer(time):
    amount = progress(time, 132, 726)
    dx, dy = np.array(CONFIG['neckDisplacement']) * amount
    rows, columns = np.indices((512, 512))
    target_x = columns.ravel() - CONFIG['rootOffset'][0]
    target_y = rows.ravel() - CONFIG['rootOffset'][1]
    source_x = target_x.astype(float)
    source_y = target_y.astype(float)
    for iteration in range(12):
        weight = neck_weight(source_x, source_y)
        source_x = target_x - dx * weight
        source_y = target_y - dy * weight
    pixels = np.array(IMAGES['body']).astype(float) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    values = sample(pixels, source_x, source_y)
    values[(source_x < 0) | (source_y < 0) | (source_x > 511) | (source_y > 511)] = 0
    rgb = values[:, :3] / np.maximum(1e-10, values[:, 3:4])
    result = np.c_[rgb, values[:, 3]].reshape(512, 512, 4)
    return Image.fromarray(np.uint8(np.clip(result * 255 + .5, 0, 255)))


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
    width = 1 - .30 * progress(time, 594, 1089)
    terminal = np.linalg.norm(points - joints[-1], None, 1)
    widths = width + (1 - width) * np.clip((24 - terminal) / 12, 0, 1)
    narrowed = centers + (points - centers) * widths[:, None]
    vertices = skin(narrowed, np.array(data['weights']), np.array(data['blendPivots']), bones)
    image, _ = rasterize(IMAGES[name], data, vertices)
    return image, particles, vertices


def render(time):
    head = pose(time)
    far_ear, far_points, _ = ear_pose('far-ear', time, head)
    near_ear, near_points, _ = ear_pose('near-ear', time, head)
    result = Image.new('RGBA', (512, 512))
    result.alpha_composite(far_ear)
    result.alpha_composite(body_layer(time))
    result.alpha_composite(affine(IMAGES['head-open' if time < 99 else 'head-closed'], head))
    result.alpha_composite(near_ear)
    return result, {'timeMs': time, 'body': translation(*CONFIG['rootOffset']).tolist(), 'neckProgress': progress(time, 132, 726), 'head': head.tolist(), 'ears': {'far': np.array(far_points).tolist(), 'near': np.array(near_points).tolist()}}


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
    metadata = {'name': 'dew-rabbit', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/dew-rabbit.png', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': 4, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'pivotX': 256, 'pivotY': 448, 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'Source/RigV9/render.py', 'sourceAuthoring': prefix + 'Source/RigV9/render.py', 'rig': prefix + 'Source/RigV9/rig.json', 'sourceFrames': ['Source/RigV9/Frames/' + str(index).zfill(3) + '.png' for index in range(len(frames))]}
    write_json(output / 'death.json', metadata)
    write_json(HERE / 'timeline.json', records)
    write_json(HERE / 'meshes.json', EAR_MESHES)
    print('rendered', len(frames), 'frames;', sum(durations), 'ms')
