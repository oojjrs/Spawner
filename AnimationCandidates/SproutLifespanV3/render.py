from pathlib import Path
from PIL import Image
import numpy as np
import json
import math
import subprocess
import shutil
import sys

folder = Path(__file__).resolve().parent
repo = folder.parents[1]
work = repo / '$Trash' / 'sprout-lifespan-v3-20261030'
work.mkdir(511, True, True)
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
size = tuple(rig['canvas'])
bones = rig['bones']
indices = {bone['name']: index for index, bone in enumerate(bones)}
textures = {}
for name, mesh in rig['meshes'].items():
    pixels = np.asarray(Image.open(folder / mesh['texture']).convert('RGBA')).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    textures[name] = pixels
body = Image.open(folder / rig['body']).convert('RGBA')

def smooth(value):
    return value * value * (3 - 2 * value)

def driver(time):
    time %= rig['periodMs'] / 1000
    keys = rig['driverKeys']
    for first, second in zip(keys, keys[1:]):
        if first[0] <= time <= second[0]:
            amount = smooth((time - first[0]) / (second[0] - first[0]))
            return first[1] + (second[1] - first[1]) * amount
    return keys[-1][1]

def response(time, instance, delay):
    lag = instance['delaySeconds']
    return instance['amplitude'] * (0.7 * driver(time - lag - delay) + 0.3 * driver(time - lag - delay - instance['tipLagSeconds']))

def matrices(time, instance):
    result = []
    for bone in bones:
        name = bone['name']
        angle = 0
        if name in ['stem-base', 'stem-tip']:
            angle = rig['motionDegrees'][name] * response(time, instance, 0.06 if name == 'stem-tip' else 0)
        if name.startswith('leaf-'):
            joint = name.split('-')[-1]
            sign = 1 if '-left-' in name else -1
            delay = {'base': 0, 'middle': 0.055, 'tip': 0.105}[joint]
            angle = sign * rig['motionDegrees']['leaf-' + joint] * response(time, instance, delay)
        angle *= math.pi / 180
        c, s = math.cos(angle), math.sin(angle)
        parent = indices[bone['parent']] if bone['parent'] is not None else None
        position = np.array(bone['pivot'], np.float64)
        relative = position - np.array(bones[parent]['pivot'], np.float64) if parent is not None else position
        local = np.array([[c, -s, relative[0]], [s, c, relative[1]], [0, 0, 1]], np.float64)
        result.append(result[parent] @ local if parent is not None else local)
    return result

def deform(mesh, world):
    result = []
    for vertex, weights in zip(mesh['vertices'], mesh['weights']):
        point = np.zeros(2, np.float64)
        for bone, weight in weights:
            pivot = bones[bone]['pivot']
            point += (world[bone] @ np.array([vertex[0] - pivot[0], vertex[1] - pivot[1], 1]))[:2] * weight
        result.append(point)
    return np.array(result)

def place(points, name, instance):
    target = np.array(instance['leafRoot'], np.float64)
    scale = instance['scale']
    if name == 'stem':
        base = np.array(instance['base'], np.float64)
        axis = target - base
        length = np.linalg.norm(axis)
        direction = axis / length
        normal = np.array([-direction[1], direction[0]], np.float64)
        along = np.where(points[:, 1] <= 234,
            length + (234 - points[:, 1]) * scale,
            (253 - points[:, 1]) * length / 19)
        return base + along[:, None] * direction + (points[:, 0] - 256)[:, None] * scale * normal
    left = name.endswith('left')
    pivot = np.array([248 if left else 264, 234], np.float64)
    angle = math.radians(instance['rotationDegrees'] + instance['leafAngleDegrees'] * (1 if left else -1))
    c, s = math.cos(angle), math.sin(angle)
    rotation = np.array([[c, -s], [s, c]], np.float64)
    parent_angle = math.radians(instance['rotationDegrees'])
    c, s = math.cos(parent_angle), math.sin(parent_angle)
    parent_rotation = np.array([[c, -s], [s, c]], np.float64)
    return (points - pivot) @ rotation.T * scale + target + (pivot - [256, 234]) @ parent_rotation.T * scale

def warp(name, world, instance):
    mesh = rig['meshes'][name]
    source = np.array(mesh['vertices'], np.float64)
    destination = place(deform(mesh, world), name, instance)
    texture = textures[name]
    result = np.zeros((size[1], size[0], 4), np.float32)
    for triangle in mesh['triangles']:
        target = destination[triangle]
        original = source[triangle]
        x0, y0 = np.floor(target.min(0)).astype(int)
        x1, y1 = np.ceil(target.max(0)).astype(int)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(size[0] - 1, x1), min(size[1] - 1, y1)
        if x1 < x0 or y1 < y0:
            continue
        basis = np.column_stack((target[1] - target[0], target[2] - target[0]))
        if abs(np.linalg.det(basis)) < 0.00001:
            continue
        yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        barycentric = np.stack((xx - target[0, 0], yy - target[0, 1]), -1) @ np.linalg.inv(basis).T
        first, second = barycentric[:, :, 0], barycentric[:, :, 1]
        inside = (first >= -0.00001) & (second >= -0.00001) & (first + second <= 1.00001)
        if not np.any(inside):
            continue
        uv = original[0] + first[:, :, None] * (original[1] - original[0]) + second[:, :, None] * (original[2] - original[0])
        u, v = np.clip(uv[:, :, 0], 0, 510.999), np.clip(uv[:, :, 1], 0, 510.999)
        ix, iy = np.floor(u).astype(int), np.floor(v).astype(int)
        fx, fy = (u - ix)[:, :, None], (v - iy)[:, :, None]
        sampled = texture[iy, ix] * (1 - fx) * (1 - fy) + texture[iy, ix + 1] * fx * (1 - fy) + texture[iy + 1, ix] * (1 - fx) * fy + texture[iy + 1, ix + 1] * fx * fy
        result[y0:y1 + 1, x0:x1 + 1][inside] = sampled[inside]
    alpha = result[:, :, 3:4]
    rgb = result[:, :, :3] / np.maximum(alpha, 0.000001)
    return Image.fromarray(np.clip(np.rint(np.concatenate((rgb, alpha), 2) * 255), 0, 255).astype(np.uint8))

def frame(index, include_rear):
    time = index * rig['frameDurationMs'] / 1000
    surface = Image.new('RGBA', size, (0, 0, 0, 0))
    instances = rig['instances'] if include_rear else [rig['referenceInstance']]
    for instance in instances:
        world = matrices(time, instance)
        for name in ['stem', 'leaf-basic-left', 'leaf-basic-right']:
            surface.alpha_composite(warp(name, world, instance))
    surface.alpha_composite(body)
    return surface

def comparison(original, candidate):
    surface = Image.new('RGB', (768, 496), '#243229')
    for column, image in enumerate([original, candidate]):
        large = image.resize((384, 384), Image.Resampling.LANCZOS)
        surface.paste(large, (column * 384, -4), large)
        small = image.resize((112, 112), Image.Resampling.LANCZOS)
        surface.paste(small, (column * 384 + 136, 378), small)
    return surface

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    selected = [0, 24, 40, 43, 46, 49, 54, 127] if mode == 'keys' else list(range(rig['frameCount']))
    frames_path = work / 'Frames'
    frames_path.mkdir(511, True, True)
    comparison_path = work / 'Comparison'
    comparison_path.mkdir(511, True, True)
    atlas = Image.new('RGBA', (rig['columns'] * size[0], math.ceil(rig['frameCount'] / rig['columns']) * size[1]), (0, 0, 0, 0)) if mode != 'keys' else None
    for index in selected:
        original, candidate = frame(index, False), frame(index, True)
        candidate.save(frames_path / (str(index).zfill(3) + '.png'))
        comparison(original, candidate).save(comparison_path / (str(index).zfill(3) + '.png'))
        if atlas is not None:
            atlas.paste(candidate, (index % rig['columns'] * size[0], index // rig['columns'] * size[1]))
        if index == 0:
            candidate.save(folder / 'neutral.png')
            comparison(original, candidate).save(folder / 'comparison.png')
        if index % 16 == 0:
            print('rendered ' + str(index), flush=True)
    if mode == 'keys':
        contact = Image.new('RGB', (256 * 4, 256 * 2), '#243229')
        for position, index in enumerate(selected):
            image = Image.open(frames_path / (str(index).zfill(3) + '.png')).convert('RGBA').resize((256, 256), Image.Resampling.LANCZOS)
            contact.paste(image, (position % 4 * 256, position // 4 * 256), image)
        contact.save(work / 'key-poses.png')
    else:
        atlas.save(work / 'idle-atlas.png')
        subprocess.check_call([shutil.which('ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(work / 'idle-atlas.png'), '-c:v', 'libwebp', '-lossless', '1', str(folder / 'idle-atlas.webp')])
        ffmpeg = shutil.which('ffmpeg')
        commands = [
            ['-framerate', '20', '-i', str(frames_path / '%03d.png'), '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', str(folder / 'idle.webp')],
            ['-framerate', '20', '-i', str(comparison_path / '%03d.png'), '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', str(folder / 'comparison.webp')],
            ['-framerate', '20', '-i', str(comparison_path / '%03d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', str(folder / 'comparison.gif')]
        ]
        for command in commands:
            subprocess.check_call([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y'] + command)
        print('exported 128 frames, 6.4 seconds', flush=True)
