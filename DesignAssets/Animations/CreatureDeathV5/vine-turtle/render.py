from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
import math
import sys
folder = Path(__file__).resolve().parent
from mesh_render import lattice, warp, bend_limb, rigid
import tail_mesh
model = json.loads((folder / 'motion.json').read_text('utf-8'))
names = ['shell', 'foreground', 'head', 'fore-near', 'fore-far', 'hind-near', 'hind-far', 'tail']
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in names}
visibility = Image.new('RGBA', (512, 512), (255, 255, 255, 255))
visibility.putalpha(Image.open(folder / 'Source/head-visibility.png').convert('L'))
source_neck = np.array(model['sourceNeck'], float)
head_root = np.array(model['sourceHeadRoot'], float)
neck = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
piece = images['head'].crop((int(head_root[0]) - 26, int(head_root[1]) - 28, int(head_root[0]), int(head_root[1]) + 28))
placement = []
for value in np.arange(head_root[0] - 20, source_neck[0, 0] + 1, 17):
    position, tangent = tail_mesh.section(source_neck, np.interp(value, source_neck[::-1, 0], [2, 1, 0]))
    target = (round(value - 13), round(position[1] - 28))
    neck.alpha_composite(piece, target)
    placement.append(list(target))
neck.save(folder / 'Parts/neck.png')
neck.save(folder / 'Source/EditableParts/neck.png')
(folder / 'Source/neck-compositing.json').write_bytes((json.dumps({'source': 'Parts/head.png', 'crop': [int(head_root[0]) - 26, int(head_root[1]) - 28, int(head_root[0]), int(head_root[1]) + 28], 'placements': placement, 'role': 'complete hidden cervical connector beneath rigid carapace'}, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))
neck_vertices, neck_triangles, neck_weights = tail_mesh.ribbon(source_neck, [26, 26, 26], 0, 2)
tail_vertices, tail_triangles, tail_weights = tail_mesh.ribbon(model['sourceTail'], [10, 10, 5], 0, 2)
meshes = {name: lattice(images[name], 7) for name in model['sourceLegs']}
frames = []
entries = list(model['frames']) + [dict(model['frames'][-1], **{'timeMs': model['frames'][-1]['timeMs'] + 40})]
reports = []
for entry in entries:
    offset = [0, entry['shellY']]
    shell = rigid(images['shell'], [0, 0], offset, 0)
    foreground = rigid(images['foreground'], [0, 0], offset, 0)
    head = rigid(images['head'], head_root, entry['headRoot'], entry['headAngle'])
    neck_frame = warp(neck, neck_vertices, tail_mesh.deform(entry['neck'], neck_weights, 448), neck_triangles)
    portal = np.array(rigid(visibility, [0, 0], offset, 0))[:, :, 3].astype(float) / 255
    for surface in [head, neck_frame]:
        pixel = np.array(surface)
        pixel[:, :, 3] = np.round(pixel[:, :, 3] * portal).astype(np.uint8)
        surface.putalpha(Image.fromarray(pixel[:, :, 3]))
    tail_frame = warp(images['tail'], tail_vertices, tail_mesh.deform(entry['tail'], tail_weights, 448), tail_triangles)
    limbs = {}
    for name, bind in model['sourceLegs'].items():
        vertices, triangles = meshes[name]
        points = np.array(bind, float)
        paw = np.array(model['sourceToes'][name], float)
        source = np.vstack([points, paw])
        state = entry['legs'][name]
        limbs[name] = rigid(images[name], points[-1], state['joints'][-1], state['pawAngle'])
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    for part in [limbs['hind-far'], limbs['fore-far'], tail_frame, neck_frame, shell, head, limbs['hind-near'], limbs['fore-near'], foreground]:
        canvas.alpha_composite(part)
    frames.append(canvas)
    if entry is entries[-1]:
        shell_array = np.array(shell)
        final = np.array(canvas)
        different = np.any(final != shell_array, 2) & ((final[:, :, 3] > 32) | (shell_array[:, :, 3] > 32))
        reports.append({'timeMs': entry['timeMs'], 'shellDifferencePixels': int(different.sum()), 'shellY': entry['shellY']})
        canvas.save(folder / 'final.png')
        difference = np.zeros((512, 512, 4), np.uint8)
        difference[different] = [255, 0, 255, 255]
        Image.fromarray(difference).save(folder / 'final-soft-exposure.png')
    if entry['timeMs'] == 0:
        canvas.save(folder / 'neutral.png')
durations = [40] * (len(frames) - 1) + [1000]
columns = 8
atlas = Image.new('RGBA', (columns * 512, math.ceil(len(frames) / columns) * 512), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    atlas.alpha_composite(frame, (index % columns * 512, index // columns * 512))
atlas.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4, 'exact': True})
for name, size in [('preview.webp', 512), ('thumbnail.webp', 64)]:
    resized = [frame.resize((size, size), Image.Resampling.LANCZOS) for frame in frames]
    resized[0].save(folder / name, 'WEBP', **{'save_all': True, 'append_images': resized[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True})
contact = Image.new('RGB', (2048, 300), '#324340')
indices = [0, 6, 12, 18, 24, 30, 40, len(frames) - 1]
for column, index in enumerate(indices):
    frame = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
    contact.paste(frame, (column * 256, 0), frame)
    ImageDraw.Draw(contact).text((column * 256 + 6, 270), str(entries[index]['timeMs']) + ' ms', 'white')
contact.save(folder / 'contact.png')
(folder / 'physics-timeline.json').write_bytes((json.dumps({'durationsMs': durations, 'frames': entries}, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))
(folder / 'exposure-report.json').write_bytes((json.dumps(reports, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))
print(json.dumps({'id': folder.name, 'frames': len(frames), 'reports': reports, 'finalIdentical': frames[-1].tobytes() == frames[-2].tobytes()}))
