from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
import math
import sys
from mesh_render import lattice, warp, rigid
folder = Path(__file__).resolve().parent
records = json.loads((folder / 'motion.json').read_text('utf8'))
records.append(dict(records[-1], **{'timeMs': records[-1]['timeMs'] + 40}))
names = ['body', 'head-collar', 'head-collar-closed', 'head-collar-front', 'head-collar-front-closed', 'near-wing', 'far-wing', 'far-foot', 'near-foot', 'far-foot-visible', 'near-foot-visible', 'tail', 'scalp-cap']
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in names}

for back, front in [('far-foot', 'far-foot-visible'), ('near-foot', 'near-foot-visible')]:
    pixel = np.array(images[back])
    pixel[np.array(images[front])[:, :, 3] > 0] = 0
    images[back] = Image.fromarray(pixel)


for suffix in ['', '-closed']:
    base = np.array(images['head-collar' + suffix]).astype(float)
    front = np.array(images['head-collar-front' + suffix]).astype(float)
    cap = np.array(images['scalp-cap']).astype(float)
    alpha = np.maximum(np.maximum(base[:, :, 3], front[:, :, 3]), cap[:, :, 3])
    rgb = base[:, :, :3]
    for photo in [front, cap]:
        weight = photo[:, :, 3:4] / np.maximum(1, alpha[:, :, None])
        rgb = rgb * (1 - weight) + photo[:, :, :3] * weight
    images['head-collar' + suffix] = Image.fromarray(np.uint8(np.clip(np.dstack([rgb, alpha]), 0, 255).round()))


yy, xx = np.mgrid[:512, :512]
surface_config = json.loads((folder / 'Source/compositing.json').read_text('utf8'))['singleSkinSurface']
near_y, far_y = surface_config['upperDepthY']
left_x, inner_x = surface_config['leftDepthX']
inner_right_x, right_x = surface_config['rightDepthX']
scalp_top = np.clip((far_y - yy) / (far_y - near_y), 0, 1)
scalp_top = scalp_top * scalp_top * (3 - 2 * scalp_top)
scalp_top *= np.clip((xx - left_x) / (inner_x - left_x), 0, 1) * np.clip((right_x - xx) / (right_x - inner_right_x), 0, 1)
for suffix in ['', '-closed']:
    surface_alpha = np.array(images['head-collar' + suffix])[:, :, 3]
    for stem, base in [('head-collar-select', images['head-collar-front' + suffix]), ('scalp-cap-select', images['scalp-cap'])]:
        selector = np.zeros((512, 512, 4), np.uint8)
        selector[:, :, :3] = 255
        selector[:, :, 3] = np.maximum(np.array(base)[:, :, 3], np.round(surface_alpha * scalp_top)).astype(np.uint8)
        images[stem + suffix] = Image.fromarray(selector)

meshes = {name: lattice(image, 6) for name, image in images.items() if name.startswith('head-collar')}
config = json.loads((folder / 'Source/physics-config.json').read_text('utf8'))
crest_rig = json.loads((folder / 'Source/crest-rig.json').read_text('utf8'))
crest_records = json.loads((folder / 'crest-motion.json').read_text('utf8'))
crest_images = [Image.open(folder / 'Parts' / ('crest-' + str(i) + '.png')).convert('RGBA') for i in range(4)]
eye_source = np.array(images['head-collar-front-closed'])
eye_y, eye_x = np.mgrid[:512, :512]
eye_line = (eye_x > 150) & (eye_x < 191) & (eye_y > 280) & (eye_y < 316) & (eye_source[:, :, 0] < 100) & (eye_source[:, :, 1] < 115) & (eye_source[:, :, 2] < 100) & (eye_source[:, :, 3] > 128)
eye_line = np.column_stack(np.where(eye_line)[::-1]).astype(float)

def points(matrix, vertices):
    return np.column_stack([vertices, np.ones(len(vertices))]) @ matrix[:2].T

def transformed(image, matrix):
    return rigid(image, [0, 0], matrix[:2, 2], math.atan2(matrix[1, 0], matrix[0, 0]))

def collar(name, body, head):
    vertices, triangles = meshes[name]
    moved = points(head, vertices)
    soft = vertices[:, 1] > 343
    moved[soft, 1] = np.minimum(moved[soft, 1], 448)
    return warp(images[name], vertices, moved, triangles)
entries = records
frames = []
reports = []
for entry in entries:
    time = entry['timeMs']
    body = np.array(entry['body'])
    head = np.array(entry['head'])
    parts = {name: np.array(value) for name, value in entry['parts'].items()}
    feet = {}
    for name in ['far-foot', 'near-foot']:
        ankle = np.array(entry['landmarks'][name]['ankle'])
        source = np.array(config['legs'][name][-1])
        feet[name] = rigid(images[name], source, ankle, 0)
        feet[name + '-visible'] = rigid(images[name + '-visible'], source, ankle, 0)
    suffix = '-closed' if time >= 360 else ''
    state = crest_records[min(len(crest_records) - 1, round(time / 40))]
    crest = Image.new('RGBA', (512, 512))
    for part, matrix in zip(crest_images, state['matrices']):
        crest.alpha_composite(transformed(part, np.array(matrix)))
    surface = collar('head-collar' + suffix, body, head)
    front_surface = collar('head-collar-select' + suffix, body, head)
    total_alpha = np.maximum(1, np.array(surface)[:, :, 3].astype(float))
    front_mask = Image.fromarray(np.uint8(np.clip(np.array(front_surface)[:, :, 3] / total_alpha * 255, 0, 255)))
    before = [transformed(images['tail'], parts['tail']), feet['far-foot'], feet['near-foot'], transformed(images['far-wing'], parts['far-wing'])]
    after = [transformed(images['body'], body), transformed(images['near-wing'], parts['near-wing']), feet['far-foot-visible'], feet['near-foot-visible']]
    def scene(head_front, include_head):
        result = Image.new('RGBA', (512, 512))
        for layer in before:
            result.alpha_composite(layer)
        if include_head and not head_front:
            result.alpha_composite(surface)
        for layer in after:
            result.alpha_composite(layer)
        if include_head and head_front:
            result.alpha_composite(surface)
        return result
    head_scene = Image.composite(scene(True, True), scene(False, True), front_mask)
    crest_over = head_scene.copy()
    crest_over.alpha_composite(crest)
    scalp_over = scene(False, False)
    scalp_over.alpha_composite(crest)
    scalp_over.alpha_composite(surface)
    cap = transformed(images['scalp-cap-select' + suffix], head)
    cap_mask = Image.fromarray(np.uint8(np.clip(np.array(cap)[:, :, 3] / total_alpha * 255, 0, 255)))
    image = Image.composite(scalp_over, crest_over, cap_mask)
    frames.append(image)
    eye = points(head, np.array([[170, 297]]))[0]
    px, py = np.round(eye).astype(int)
    cover = int(np.array(crest)[min(511, max(0, py)), min(511, max(0, px)), 3])
    line = points(head, eye_line).round().astype(int)
    line_alpha = np.array(crest)[np.clip(line[:, 1], 0, 511), np.clip(line[:, 0], 0, 511), 3]
    reports.append({'timeMs': time, 'eye': eye.tolist(), 'crestAlphaAtEye': cover, 'eyeLineCoverage': float(np.mean(line_alpha > 240)), 'eyeLineSamples': len(line), 'bodyContact': entry['bodyContact'], 'headContact': entry['headContact']})
durations = [40] * (len(frames) - 1) + [1000]
atlas = Image.new('RGBA', (4096, math.ceil(len(frames) / 8) * 512))
for i, image in enumerate(frames):
    atlas.alpha_composite(image, (i % 8 * 512, i // 8 * 512))
atlas.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4, 'exact': True})
for name, size in [('preview.webp', 512), ('thumbnail.webp', 64)]:
    output = [image.resize((size, size), Image.Resampling.LANCZOS) for image in frames]
    output[0].save(folder / name, 'WEBP', **{'save_all': True, 'append_images': output[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True})
board = Image.new('RGB', (2048, 512), '#324340')
for i, image in enumerate([Image.open(folder / 'Source/registered-reference.png'), frames[0], frames[20], frames[-1]]):
    board.paste(image, (i * 512, 0), image)
board.save(folder / 'comparison.png')
(folder / 'physics-timeline.json').write_bytes((json.dumps({'durationsMs': durations, 'frames': records}, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf8'))
(folder / 'eye-coverage.json').write_bytes((json.dumps(reports, **{'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf8'))
print(json.dumps({'frames': len(frames), 'last': reports[-1]}))
