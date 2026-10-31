from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
import math
import sys
from mesh_render import lattice, warp, rigid, bend_limb
import tail_mesh
folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf8'))
samples = json.loads((folder / 'physics-samples.json').read_text('utf8'))
tail_model = json.loads((folder / 'tail-physics.json').read_text('utf8'))
names = ['torso', 'body-foreground', 'head-skull', 'head-closed-skull', 'neck-ruff', 'ruff-foreground', 'tail'] + [value['id'] for value in rig['limbs']]
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in names}
hind_paw = np.array(images['hind-near'])
hind_paw[:398] = 0
hind_paw = Image.fromarray(hind_paw)
meshes = {name: lattice(image, 7) for name, image in images.items() if name not in ['torso', 'body-foreground']}
source_tail = np.array(tail_model['bind'], float)
tail_vertices, tail_triangles = meshes['tail']
parameters = np.linspace(-0.6, len(source_tail) - 0.4, 900)
curves = [tail_mesh.section(source_tail, parameter) for parameter in parameters]
centres = np.array([value[0] for value in curves])
tangents = np.array([value[1] / max(0.0001, np.linalg.norm(value[1])) for value in curves])
normals = np.column_stack([-tangents[:, 1], tangents[:, 0]])
nearest = np.argmin(np.sum((tail_vertices[:, None, :] - centres[None, :, :]) ** 2, 2), 1)
offset = tail_vertices - centres[nearest]
tail_weights = np.column_stack([parameters[nearest], np.sum(offset * normals[nearest], 1), np.sum(offset * tangents[nearest], 1)])

def transform_points(matrix, points):
    return np.column_stack([points, np.ones(len(points))]) @ matrix[:2].T

def transform_image(image, matrix):
    return rigid(image, [0, 0], matrix[:2, 2], math.atan2(matrix[1, 0], matrix[0, 0]))

def pose_tail(points):
    result = []
    for parameter, normal_offset, tangent_offset in tail_weights:
        centre, tangent = tail_mesh.section(points, parameter)
        tangent = tangent / max(0.0001, np.linalg.norm(tangent))
        normal = np.array([-tangent[1], tangent[0]])
        result.append(centre + normal * normal_offset + tangent * tangent_offset)
    return np.array(result)

def pose_ruff(name, body, head):
    vertices, triangles = meshes[name]
    weight = np.clip((190 - vertices[:, 0]) / 70, 0, 1)
    moved = transform_points(body, vertices) * (1 - weight[:, None]) + transform_points(head, vertices) * weight[:, None]
    moved[:, 1] = np.minimum(moved[:, 1], 448)
    return warp(images[name], vertices, moved, triangles)

def pose_head(name, head):
    vertices, triangles = meshes[name]
    moved = transform_points(head, vertices)
    fur = (vertices[:, 1] > 372) & (vertices[:, 0] > 115) | (vertices[:, 1] > 389)
    moved[fur, 1] = np.minimum(moved[fur, 1], 448)
    return warp(images[name], vertices, moved, triangles)
records = []
for value in tail_model['frames']:
    sample = samples[min(len(samples) - 1, round(value['timeMs'] / 40))]
    records.append(dict(sample, **{'timeMs': value['timeMs']}))
records.append(dict(records[-1], **{'timeMs': records[-1]['timeMs'] + 40}))
frames = []
for entry in records:
    time = entry['timeMs']
    body = np.array(entry['body'], float)
    head = np.array(entry['head'], float)
    limbs = {}
    paw_front = None
    for limb in rig['limbs']:
        name = limb['id']
        state = entry['landmarks'][name]
        joints = np.array([state['hip'], state['knee'], state['ankle']])
        vertices, triangles = meshes[name]
        moved = bend_limb(vertices, limb['bind'], joints, 0)
        if name in ['fore-near', 'fore-far']:
            cutoff = 408 if name == 'fore-near' else 399
            paw = vertices[:, 1] >= cutoff
            moved[paw] = vertices[paw] + joints[-1] - np.array(limb['bind'][-2])
            contact = ~paw & (moved[:, 1] > 448)
            moved[contact, 1] = 448
        limbs[name] = warp(images[name], vertices, moved, triangles)
        if name == 'hind-near':
            paw_front = warp(hind_paw, vertices, moved, triangles)
    tail_points = np.array(tail_model['frames'][min(len(tail_model['frames']) - 1, round(time / 40))]['joints'])
    tail = warp(images['tail'], tail_vertices, pose_tail(tail_points), tail_triangles)
    ruff = pose_ruff('neck-ruff', body, head)
    ruff_front = pose_ruff('ruff-foreground', body, head)
    skull = pose_head('head-skull' if time < 440 else 'head-closed-skull', head)
    image = Image.new('RGBA', (512, 512))
    for part in [limbs['hind-far'], limbs['fore-far'], transform_image(images['torso'], body), ruff, limbs['hind-near'], limbs['fore-near'], transform_image(images['body-foreground'], body), tail, paw_front, skull, ruff_front]:
        image.alpha_composite(part)
    frames.append(image)
    if time == 0:
        image.save(folder / 'neutral-physics.png')
durations = [40] * (len(frames) - 1) + [1000]
atlas = Image.new('RGBA', (4096, math.ceil(len(frames) / 8) * 512))
for index, image in enumerate(frames):
    atlas.alpha_composite(image, (index % 8 * 512, index // 8 * 512))
atlas.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4, 'exact': True})
for name, size in [('preview.webp', 512), ('thumbnail.webp', 64)]:
    images_out = [image.resize((size, size), Image.Resampling.LANCZOS) for image in frames]
    images_out[0].save(folder / name, 'WEBP', **{'save_all': True, 'append_images': images_out[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True})
board = Image.new('RGB', (2048, 512), '#324340')
for index, image in enumerate([Image.open(folder / 'Source/reference.png'), frames[0], frames[20], frames[-1]]):
    board.paste(image, (index * 512, 0), image)
board.save(folder / 'comparison.png')
(folder / 'physics-timeline.json').write_bytes((json.dumps({'durationsMs': durations, 'frames': records}, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf8'))
print(json.dumps({'frames': len(frames), 'durationMs': sum(durations)}))
