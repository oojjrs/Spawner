from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
import math
import sys
from mesh_render import warp, rigid, lattice
import tail_mesh
folder = Path(__file__).resolve().parent
model = json.loads((folder / 'motion.json').read_text('utf8'))
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in ['shell', 'foreground', 'body', 'tube-near', 'tube-far', 'eye-near', 'eye-far']}
vertices, triangles = lattice(images['body'], 7)

def rotation(angle):
    c, s = (math.cos(angle), math.sin(angle))
    return np.array([[c, -s], [s, c]])

def binding(points):
    parameters = np.linspace(-1, 3.8, 800)
    samples = [tail_mesh.section(np.array(points, float), value) for value in parameters]
    positions = np.array([value[0] for value in samples])
    tangents = np.array([value[1] / max(0.0001, np.linalg.norm(value[1])) for value in samples])
    normals = np.column_stack([-tangents[:, 1], tangents[:, 0]])
    distances = np.sum((vertices[:, None, :] - positions[None, :, :]) ** 2, 2)
    nearest = np.argmin(distances, 1)
    delta = vertices - positions[nearest]
    return np.column_stack([parameters[nearest], np.sum(delta * normals[nearest], 1), np.sum(delta * tangents[nearest], 1)])

def deform(points, weights):
    output = []
    for parameter, normal_offset, tangent_offset in weights:
        position, tangent = tail_mesh.section(np.array(points, float), parameter)
        tangent = tangent / max(0.0001, np.linalg.norm(tangent))
        normal = np.array([-tangent[1], tangent[0]])
        output.append(position + normal * normal_offset + tangent * tangent_offset)
    return np.array(output)
front_weights = binding(model['sourceAnterior'])
rear_weights = binding(model['sourcePosterior'])
tubes = {name: tail_mesh.ribbon(bind, [9, 9, 8], 0, 2) for name, bind in model['sourceStalks'].items()}
frames = []
records = list(model['frames']) + [dict(model['frames'][-1], **{'timeMs': 2640})]
for entry in records:
    shell = rigid(images['shell'], [0, 0], [0, entry['shellY']], 0)
    foreground = rigid(images['foreground'], [0, 0], [0, entry['shellY']], 0)
    front = deform(entry['anterior'], front_weights)
    head = (vertices - np.array(model['sourceHeadPosition'])) @ rotation(entry['headAngle']).T + np.array(entry['headPosition'])
    weight = np.clip((220 - vertices[:, 0]) / 30, 0, 1)
    front = front * (1 - weight[:, None]) + head * weight[:, None]
    rear = deform(entry['posterior'], rear_weights)
    weight = np.clip((vertices[:, 0] - 275) / 65, 0, 1)
    moved = front * (1 - weight[:, None]) + rear * weight[:, None]
    contact = (moved[:, 1] > 448) & (vertices[:, 1] > 400)
    moved[contact, 1] = 448
    body = warp(images['body'], vertices, moved, triangles)
    eyes = {}
    for name, bind in model['sourceStalks'].items():
        points = np.array(entry['stalks'][name]['joints'], float)
        source = np.array(bind, float)
        v, t, w = tubes[name]
        tube = warp(images['tube-' + name], v, tail_mesh.deform(points, w, 448), t)
        delta = points[-1] - points[-2]
        original = source[-1] - source[-2]
        angle = math.atan2(delta[1], delta[0]) - math.atan2(original[1], original[0])
        sphere = rigid(images['eye-' + name], source[-1], points[-1], angle)
        tube.alpha_composite(sphere)
        eyes[name] = tube
    canvas = Image.new('RGBA', (512, 512))
    for part in [shell, eyes['far'], eyes['near'], body, foreground]:
        canvas.alpha_composite(part)
    frames.append(canvas)
    if entry is records[-1]:
        canvas.save(folder / 'final.png')
        a = np.array(canvas)
        b = np.array(shell)
        print(json.dumps({'finalSoftOutside': int(((b[:, :, 3] < 32) & (a[:, :, 3] > 128)).sum())}))
frames[0].save(folder / 'neutral.png')
durations = [40] * (len(frames) - 1) + [1000]
atlas = Image.new('RGBA', (4096, math.ceil(len(frames) / 8) * 512))
for index, frame in enumerate(frames):
    atlas.alpha_composite(frame, (index % 8 * 512, index // 8 * 512))
atlas.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4, 'exact': True})
for name, size in [('preview.webp', 512), ('thumbnail.webp', 64)]:
    scaled = [image.resize((size, size), Image.Resampling.LANCZOS) for image in frames]
    scaled[0].save(folder / name, 'WEBP', **{'save_all': True, 'append_images': scaled[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True})
contact = Image.new('RGB', (2048, 512), '#324340')
reference = Image.open(folder / 'Source/reference.png').convert('RGBA')
for index, image in enumerate([reference, frames[0], frames[24], frames[-1]]):
    contact.paste(image, (index * 512, 0), image)
contact.save(folder / 'comparison.png')
board = Image.new('RGB', (2048, 300), '#324340')
for column, index in enumerate([0, 6, 12, 18, 24, 32, 44, 66]):
    image = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
    board.paste(image, (column * 256, 0), image)
    ImageDraw.Draw(board).text((column * 256 + 5, 270), str(records[index]['timeMs']) + ' ms', 'white')
board.save(folder / 'contact.png')
(folder / 'physics-timeline.json').write_bytes((json.dumps({'durationsMs': durations, 'frames': records}, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf8'))
print(json.dumps({'frameCount': len(frames), 'durationMs': sum(durations)}))
