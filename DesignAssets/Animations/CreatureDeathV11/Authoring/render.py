from pathlib import Path
from collections import deque
import json
import math
import subprocess
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parents[2]
YY, XX = np.mgrid[:512, :512]


def smooth(value):
    value = float(np.clip(value, 0, 1))
    return value * value * (3 - 2 * value)


def matrix(position, angle):
    angle = math.radians(angle)
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s, position[0]], [s, c, position[1]], [0, 0, 1]], float)


def premultiplied(image):
    a = np.array(image).astype(np.float32)
    a[:, :, :3] *= a[:, :, 3:4] / 255
    return a


def pixels_from_premultiplied(pixels):
    a = np.clip(pixels.copy(), 0, 255)
    alpha = np.maximum(a[:, :, 3:4], 0.001)
    a[:, :, :3] *= 255 / alpha
    a[a[:, :, 3] < 0.5] = 0
    return np.clip(a, 0, 255).astype(np.uint8)


def rasterize(texture, source, destination, triangles):
    output = np.zeros((512, 512, 4), np.float32)
    source_coordinates = np.zeros((512, 512, 2), np.float32)
    height, width = texture.shape[:2]
    for indices in triangles:
        s = source[indices]
        d = destination[indices]
        x0, y0 = np.maximum(np.floor(d.min(0)).astype(int), [0, 0])
        x1, y1 = np.minimum(np.ceil(d.max(0)).astype(int) + 1, [512, 512])
        if x1 <= x0 or y1 <= y0:
            continue
        axes = np.column_stack([d[1] - d[0], d[2] - d[0]])
        if abs(np.linalg.det(axes)) < 0.001:
            continue
        gy, gx = np.mgrid[y0:y1, x0:x1]
        q = np.stack([gx - d[0, 0], gy - d[0, 1]], -1)
        uv = q @ np.linalg.inv(axes).T
        inside = (uv[:, :, 0] >= -0.00001) & (uv[:, :, 1] >= -0.00001) & (uv.sum(2) <= 1.00001)
        coordinates = s[0] + uv[:, :, 0:1] * (s[1] - s[0]) + uv[:, :, 1:2] * (s[2] - s[0])
        sx, sy = coordinates[:, :, 0], coordinates[:, :, 1]
        ix = np.clip(np.floor(sx).astype(int), 0, width - 2)
        iy = np.clip(np.floor(sy).astype(int), 0, height - 2)
        fx, fy = np.clip(sx - ix, 0, 1)[:, :, None], np.clip(sy - iy, 0, 1)[:, :, None]
        sample = texture[iy, ix] * (1 - fx) * (1 - fy) + texture[iy, ix + 1] * fx * (1 - fy)
        sample += texture[iy + 1, ix] * (1 - fx) * fy + texture[iy + 1, ix + 1] * fx * fy
        region = output[y0:y1, x0:x1]
        region[inside] = sample[inside]
        coordinate_region = source_coordinates[y0:y1, x0:x1]
        coordinate_region[inside] = coordinates[inside]
    return pixels_from_premultiplied(output), source_coordinates


def deform(attachment, progress):
    bind = attachment['bind']
    joints = attachment['jointsArray']
    weights = attachment['weightsArray']
    source_vertices = attachment['verticesHomogeneous']
    if attachment['kind'] == 'head':
        drift = np.array(attachment['inward']) * progress
        drift[1] += 10 * math.sin(math.pi * progress)
        angle = -10 * math.sin(math.pi * progress)
        current = [matrix(joints[1] + drift, angle), matrix(joints[0] + drift * 0.30, angle * 0.45)]
    else:
        retract = smooth((progress - 0.30) / 0.70)
        drift = np.array(attachment['inward']) * retract
        bend = smooth(progress / 0.85)
        upper_angle = math.degrees(math.atan2(bind[0][1, 0], bind[0][0, 0]))
        lower_angle = math.degrees(math.atan2(bind[1][1, 0], bind[1][0, 0]))
        upper = matrix(joints[0] + drift, upper_angle + attachment['fold'][0] * bend)
        length = np.linalg.norm(joints[1] - joints[0])
        knee = (upper @ np.array([length, 0, 1]))[:2]
        lower = matrix(knee, lower_angle + (attachment['fold'][0] + attachment['fold'][1]) * bend)
        current = [upper, lower]
    destination = np.zeros((len(source_vertices), 2))
    for i in range(2):
        transformed = (current[i] @ attachment['inverseBind'][i] @ source_vertices.T).T[:, :2]
        destination += transformed * weights[:, i:i + 1]
    return destination


def clip_attachment(pixels, coordinates, attachment, progress, exterior):
    portal = attachment['portalArray']
    x0, y0, x1, y1 = attachment['portal']['bounds']
    if attachment['kind'] == 'head':
        height, width = attachment['openTexture'].shape[:2]
        radius = round(32 * (1 - smooth(progress / 0.68)))
        center = np.array(attachment['sourceJoints'][1]) - np.array(attachment['sourceOffset'])
        face = ((coordinates[:, :, 0] - center[0]) / (width * 0.42)) ** 2 + ((coordinates[:, :, 1] - center[1]) / (height * 0.52)) ** 2 < 1
        front = attachment['occlusionCaps'][radius] & face
    elif attachment['kind'] == 'tail':
        front = np.zeros((512, 512), bool)
    else:
        left = 55 if attachment['id'] == 'fore-far' else 30
        right = 100 if attachment['id'] == 'hind-near' else 45
        if attachment['id'] == 'fore-far':
            right = 12
        front = (XX > x0 - left) & (XX < x1 + right) & (YY > y1 - 8)
        if progress > 0.65:
            front[:] = False
    allowed = portal | front | exterior
    if attachment['kind'] == 'leg':
        height = attachment['openTexture'].shape[0]
        knee = attachment['sourceJoints'][1][1] - attachment['sourceOffset'][1]
        distal = coordinates[:, :, 1] > (knee - 0.15 * height) * smooth(progress / 0.50)
        allowed = portal | ((front | exterior) & distal)
    result = pixels.copy()
    result[~allowed] = 0
    shade = portal & (result[:, :, 3] > 0)
    result[shade, :3] = np.round(result[shade, :3] * (1 - 0.12 * progress)).astype(np.uint8)
    if attachment['kind'] == 'leg' and progress > 0.10:
        visible = result[:, :, 3] > 0
        for y, x in zip(*np.where(visible)):
            if not visible[y, x]:
                continue
            queue = deque([(int(x), int(y))])
            visible[y, x] = False
            points = []
            touches_portal = False
            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                touches_portal = touches_portal or bool(portal[py, px])
                for nx, ny in [(px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)]:
                    if 0 <= nx < 512 and 0 <= ny < 512 and visible[ny, nx]:
                        visible[ny, nx] = False
                        queue.append((nx, ny))
            if len(points) < 40 and not touches_portal:
                for px, py in points:
                    result[py, px] = 0
    return Image.fromarray(result)


def load_rig(name):
    folder = ROOT / name
    rig = json.loads((folder / 'rig.json').read_text('utf-8'))
    body = Image.open(folder / rig['shell']).convert('RGBA')
    exterior = np.array(body)[:, :, 3] < 16
    for attachment in rig['attachments']:
        attachment['openTexture'] = premultiplied(Image.open(folder / attachment['image']).convert('RGBA'))
        if attachment['kind'] == 'head':
            attachment['closedTexture'] = premultiplied(Image.open(folder / attachment['closedImage']).convert('RGBA'))
        attachment['sourceArray'] = np.array(attachment['sourceVertices'], float)
        attachment['jointsArray'] = np.array(attachment['joints'], float)
        attachment['weightsArray'] = np.array(attachment['weights'], float)
        attachment['verticesHomogeneous'] = np.column_stack([attachment['bindVertices'], np.ones(len(attachment['bindVertices']))])
        attachment['bind'] = [np.array(v, float) for v in attachment['bindMatrices']]
        attachment['inverseBind'] = [np.linalg.inv(v) for v in attachment['bind']]
        attachment['portalArray'] = np.array(Image.open(folder / attachment['portal']['mask'])) > 0
        if attachment['kind'] == 'head':
            cap = Image.fromarray(attachment['portalArray'].astype(np.uint8) * 255)
            attachment['occlusionCaps'] = [np.array(cap) > 0]
            for radius in range(32):
                cap = cap.filter(ImageFilter.MaxFilter(3))
                attachment['occlusionCaps'].append(np.array(cap) > 0)
    return rig, body, exterior


def geometry_frame(rig, body, exterior, time):
    frame = body.copy()
    metrics = {}
    for attachment in rig['attachments']:
        start, end = attachment['time']
        progress = smooth((time - start) / (end - start))
        texture = attachment['openTexture']
        if attachment['kind'] == 'head' and time >= rig['eyesCloseMs']:
            texture = attachment['closedTexture']
        vertices = deform(attachment, progress)
        pixels, coordinates = rasterize(texture, attachment['sourceArray'], vertices, attachment['triangles'])
        layer = clip_attachment(pixels, coordinates, attachment, progress, exterior)
        metrics[attachment['id']] = int(np.count_nonzero(np.array(layer)[:, :, 3] > 128))
        frame.alpha_composite(layer)
    return frame, metrics


def bottom(image):
    ys = np.where(np.array(image)[:, :, 3] > 128)[0]
    return int(ys.max()) + 1 if len(ys) else 0


def shifted(image, y):
    return image.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -y), Image.Resampling.BICUBIC).convert('RGBA')


def execute(arguments):
    result = subprocess.run(arguments)
    if result.returncode:
        raise RuntimeError('Media export failed: ' + arguments[0])


def gif_from_frames(paths, times, gif_path, palette_path):
    samples = [paths[round(i * (len(paths) - 1) / 7)] for i in range(8)]
    execute(['magick'] + [str(p) for p in samples] + ['-background', '#26352f', '-alpha', 'remove', '-alpha', 'off', '+append', '-colors', '255', '-unique-colors', str(palette_path)])
    command = ['magick']
    elapsed, ticks = 0, 0
    for path, delay in zip(paths, times):
        elapsed += delay
        end_ticks = round(elapsed / 10)
        command += ['-delay', str(max(1, end_ticks - ticks)), '(', str(path), ')']
        ticks = end_ticks
    command += ['-background', '#26352f', '-alpha', 'remove', '-alpha', 'off', '-remap', str(palette_path), '-loop', '0', str(gif_path)]
    execute(command)


def render(name, end_time, tag):
    rig, body, exterior = load_rig(name)
    work = PROJECT / '$Trash/creature-death-rig-v11' / name / tag
    work.mkdir(511, True, True)
    count = math.ceil(end_time / 1000 * rig['fps']) + 1
    times = sorted(set(min(end_time, round(i * 1000 / rig['fps'])) for i in range(count)))
    frames, paths, records = [], [], []
    position, velocity = None, 0.0
    previous_time = 0
    for index, time in enumerate(times):
        raw, metrics = geometry_frame(rig, body, exterior, time)
        limit = rig['groundY'] - bottom(raw)
        if position is None:
            position = float(limit)
        dt = (time - previous_time) / 1000
        for step in range(10):
            velocity += rig['gravity'] * dt / 10
            position += velocity * dt / 10
            if position >= limit:
                position = float(limit)
                velocity = -max(0, velocity) * rig['restitution']
                if abs(velocity) < 4:
                    velocity = 0
        frame = shifted(raw, position)
        path = work / f'{index:03d}.png'
        frame.save(path)
        frames.append(frame)
        paths.append(path)
        records.append({'timeMs': time, 'bodyY': round(position, 4), 'contactLimitY': limit, 'visibleSoftPixels': metrics})
        previous_time = time
    delays = [b - a for a, b in zip(times, times[1:])] + [rig['holdMs'] if tag == 'full' else 450]
    board = Image.new('RGB', (2048, 1024), '#26352f')
    for slot in range(8):
        index = round(slot * (len(frames) - 1) / 7)
        board.paste(frames[index], (slot % 4 * 512, slot // 4 * 512), frames[index])
    board.save(work / 'contact.png')
    (work / 'motion.json').write_bytes((json.dumps(records) + '\r\n').encode('utf-8'))
    (work / 'timing.json').write_bytes((json.dumps(delays) + '\r\n').encode('utf-8'))
    gif_from_frames(paths, delays, work / 'preview.gif', work / 'palette.png')
    print(json.dumps({'name': name, 'tag': tag, 'frames': len(frames), 'firstY': records[0]['bodyY'], 'lastY': records[-1]['bodyY'], 'lastSoftPixels': records[-1]['visibleSoftPixels'], 'contact': str(work / 'contact.png'), 'gif': str(work / 'preview.gif')}))


if __name__ == '__main__':
    render(sys.argv[1], int(sys.argv[2]), sys.argv[3])
