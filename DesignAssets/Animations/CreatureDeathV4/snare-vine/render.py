from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, _webp
from engine import ease, rot, matrix, affine, tube, leaf_mesh, leaf
from physics import simulate, pressure, boundary

root = Path(__file__).resolve().parent
rig = json.loads((root / 'rig.json').read_text('utf-8'))
images = {name: Image.open(root / path).convert('RGBA') for name, path in rig['parts'].items()}
texture = Image.open(root / rig['tubeTexture']).convert('RGBA')
records = simulate(rig, images, rig['durationMs'])

def write_json(path, value):
    encoder = json.JSONEncoder()
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))

mesh_source = json.loads((root / rig['leafMeshes']).read_text('utf-8'))
leaf_data = {name: (np.array(value['vertices']), np.array(value['distalWeights']), value['triangles']) for name, value in mesh_source.items()}
leaf_angles = {name: [] for name in rig['leafControls']}
for name, control in rig['leafControls'].items():
    source = np.argwhere(np.array(images[name])[:, :, 3] > 128)[:, ::-1]
    pivot, base = np.array(control['root'], float), np.array(control['base'], float)
    center = source.mean(0)
    inertia = float(np.mean(np.sum((source - pivot) ** 2, 1)))
    second_inertia = float(np.mean(np.sum((source - base) ** 2, 1)))
    outline = boundary(images[name])
    distance = np.linalg.norm(outline - pivot, 2, 1)
    weights = np.clip((distance - 7) / 18, 0, 1)
    weights = weights * weights * (3 - 2 * weights)
    points = np.column_stack([outline, np.ones(len(outline))])
    theta, speed, bend_angle, bend_speed = 0., 0., 0., 0.
    last_root, last_velocity, last_body_angle = None, np.zeros(2), 0.
    for record in records:
        dt = 1 / 120
        body = np.array(record['body'])
        world_root = (body @ np.r_[pivot, 1])[:2]
        root_velocity = (world_root - last_root) / dt if last_root is not None else np.zeros(2)
        delta_velocity = root_velocity - last_velocity
        lever = body[:2, :2] @ rot(theta) @ (base - pivot + rot(bend_angle) @ (center - base))
        if record['timeMs'] > 60:
            speed -= (lever[0] * delta_velocity[1] - lever[1] * delta_velocity[0]) / inertia
            active = pressure(record['timeMs'], control['pressureInterval'])
            acceleration = lever[0] * 900 / inertia - (320 * active * active + .3) * theta - 5.5 * speed
            speed += acceleration * dt
            theta += speed * dt
            bend_speed += (-90 * bend_angle - 12 * bend_speed - .22 * acceleration) * dt
            bend_angle += bend_speed * dt
            theta = max(control['range'][0], min(control['range'][1], theta))
            bend_angle = max(-.22, min(.22, bend_angle))
        for iteration in range(12):
            first = body @ matrix(pivot, pivot, theta)
            second = first @ matrix(base, base, bend_angle)
            destination = (first @ points.T).T[:, :2] * (1 - weights[:, None]) + (second @ points.T).T[:, :2] * weights[:, None]
            worst = int(np.argmax(destination[:, 1]))
            depth = destination[worst, 1] - 448
            if depth <= 0:
                break
            world_base = (first @ np.r_[base, 1])[:2]
            first_gradient = destination[worst, 0] - world_root[0]
            second_gradient = weights[worst] * ((second @ points[worst])[:2][0] - world_base[0])
            denominator = first_gradient * first_gradient / inertia + second_gradient * second_gradient / second_inertia
            if denominator < .000001:
                break
            multiplier = -depth / denominator
            theta += max(-.08, min(.08, first_gradient / inertia * multiplier))
            bend_angle += max(-.05, min(.05, second_gradient / second_inertia * multiplier))
            theta = max(control['range'][0], min(control['range'][1], theta))
            bend_angle = max(-.22, min(.22, bend_angle))
            speed *= .6
            bend_speed *= .5
        leaf_angles[name].append([theta, bend_angle])
        last_root, last_velocity, last_body_angle = world_root, root_velocity, record['q'][2]

foot_angles = {name: [] for name in rig['feet']}
for name, control in rig['feet'].items():
    pivot = np.array(control['root'], float)
    points = boundary(images[name])
    pixels = np.argwhere(np.array(images[name])[:, :, 3] > 128)[:, ::-1]
    center = pixels.mean(0) - pivot
    inertia = float(np.mean(np.sum((pixels - pivot) ** 2, 1)))
    theta, speed = 0., 0.
    for record in records:
        dt = 1 / 120
        body = np.array(record['body'])
        world_root = (body @ np.r_[pivot, 1])[:2]
        if record['timeMs'] > 60:
            lever = body[:2, :2] @ rot(theta) @ center
            active = pressure(record['timeMs'], [90, 300])
            speed += (lever[0] * 900 / inertia - 200 * active * theta - 7 * speed) * dt
            theta += speed * dt
        for iteration in range(12):
            transform = body @ matrix(pivot, pivot, theta)
            surface = (transform @ np.column_stack([points, np.ones(len(points))]).T).T[:, :2]
            worst = int(np.argmax(surface[:, 1]))
            depth = surface[worst, 1] - control['groundY']
            if depth <= 0:
                break
            gradient = surface[worst, 0] - world_root[0]
            if abs(gradient) < .01:
                gradient = .01
            theta += max(-.08, min(.08, -depth / gradient))
            theta = max(-1.7, min(1.7, theta))
            speed *= .5
        foot_angles[name].append(theta)

open_body = np.array(images['bulb'])
closed_body = np.array(images['bulb-closed'])
eye_mask = Image.new('L', (512, 512))
draw = ImageDraw.Draw(eye_mask)
draw.ellipse((162, 351, 184, 384), 255)
draw.ellipse((222, 365, 249, 399), 255)
eye_mask = np.array(eye_mask.filter(ImageFilter.GaussianBlur(1))) / 255
yy = np.indices((512, 512))[0]

def state_at(time):
    index = max(0, min(len(records) - 2, int(time * 120 / 1000)))
    a, b = records[index:index + 2]
    u = max(0, min(1, (time - a['timeMs']) / (b['timeMs'] - a['timeMs'])))
    state = np.array(a['q']) * (1 - u) + np.array(b['q']) * u
    body = matrix(state[:2], np.array(rig['bodyCenter']), state[2])
    rods = {name: a['rods'][name] * (1 - u) + b['rods'][name] * u for name in rig['rods']}
    leaves = {name: np.array(values[index]) * (1 - u) + np.array(values[index + 1]) * u for name, values in leaf_angles.items()}
    feet = {name: values[index] * (1 - u) + values[index + 1] * u for name, values in foot_angles.items()}
    return body, rods, leaves, feet

def frame(time):
    body, rods, leaves, feet = state_at(time)
    output = Image.new('RGBA', (512, 512))
    for name in rig['feet']:
        pivot = np.array(rig['feet'][name]['root'], float)
        output.alpha_composite(affine(images[name], body @ matrix(pivot, pivot, feet[name])))
    for name, points in rods.items():
        output.alpha_composite(tube(texture, points, np.array(rig['rods'][name]['radii'])))
    for name in ['leaf-upper-left', 'leaf-upper-right']:
        output.alpha_composite(leaf(images[name], leaf_data[name], rig['leafControls'][name], leaves[name], body))
    value = open_body.copy()
    closure = ease((time - 70) / 180)
    mask = eye_mask * np.clip((350 + 52 * closure - yy) / 2, 0, 1)
    value[:, :, :3] = (value[:, :, :3] * (1 - mask[:, :, None]) + closed_body[:, :, :3] * mask[:, :, None]).astype('uint8')
    output.alpha_composite(affine(Image.fromarray(value), body))
    output.alpha_composite(affine(images['crown'], body))
    for name in ['leaf-lower-left', 'leaf-lower-right']:
        output.alpha_composite(leaf(images[name], leaf_data[name], rig['leafControls'][name], leaves[name], body))
    return output

def encode(path, frames, durations):
    encoder = _webp.WebPAnimEncoder(frames[0].size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    for image, duration in zip(frames, durations):
        encoder.add(image.getim(), timestamp, True, 100., 100., 3)
        timestamp += duration
    encoder.add(None, timestamp, True, 100., 100., 0)
    path.write_bytes(encoder.assemble('', '', ''))

times = np.linspace(0, rig['durationMs'], round(rig['durationMs'] * rig['fps'] / 1000) + 1)
frames = [frame(float(time)) for time in times]
durations = [round(float(b)) - round(float(a)) for a, b in zip(times, times[1:])] + [rig['holdMs']]
(root / 'Frames').mkdir(0o777, True, True)
for i, image in enumerate(frames):
    image.save(root / 'Frames' / ('frame-' + str(i).zfill(3) + '.png'))
sheet = Image.new('RGBA', (4096, 5632))
for i, image in enumerate(frames):
    sheet.alpha_composite(image, (i % 8 * 512, i // 8 * 512))
sheet.save(root / 'death.webp', **{'lossless': True, 'quality': 100, 'method': 6})
encode(root / 'preview.webp', frames, durations)
encode(root / 'thumbnail.webp', [image.resize((64, 64), Image.Resampling.LANCZOS) for image in frames], durations)
contact = Image.new('RGBA', (2048, 1024), (235, 232, 224, 255))
draw = ImageDraw.Draw(contact)
for i, index in enumerate([0, 9, 18, 27, 36, 48, 66, 84]):
    contact.alpha_composite(frames[index], (i % 4 * 512, i // 4 * 512))
    draw.text((i % 4 * 512 + 12, i // 4 * 512 + 12), str(round(float(times[index]))) + 'ms', (20, 20, 20))
contact.save(root / 'contact.png')
serial = []
for index, record in enumerate(records):
    value = record.copy()
    value['rods'] = {name: points.tolist() for name, points in value['rods'].items()}
    value['leaves'] = {name: angles[index] for name, angles in leaf_angles.items()}
    value['feet'] = {name: angles[index] for name, angles in foot_angles.items()}
    serial.append(value)
write_json(root / 'motion-records.json', serial)
prefix = 'DesignAssets/Animations/CreatureDeathV4/snare-vine/'
write_json(root / 'death.json', {'name': 'snare-vine', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/snare-vine.png', 'sourceAnimation': 'DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': 8, 'frameCount': len(frames), 'pivotX': 256, 'pivotY': 448, 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'previewLoop': 0, 'rig': prefix + 'rig.json', 'renderer': prefix + 'render.py', 'sourcePlacement': {'canvas': [512, 512], 'groundY': 448, 'runtimeScale': [1, 1], 'referenceNormalization': rig['referencePlacement']}})
metadata = json.loads((root / 'death.json').read_text('utf-8'))
metadata.update({'sourceAuthoring': prefix + 'Source/authoring.json', 'prepare': prefix + 'Source/prepare.py', 'contact': prefix + 'contact.png', 'construction': 'One complete rigid footless bulb, separate complete rigid root feet, flexible petioles with rigid leaf blades, and two length-constrained elastic tendrils. Initial stem tracings match the approved idle; pressure loss, gravity and contacts determine the collapse. No previous death target curve or frame fitting is used.'})
write_json(root / 'death.json', metadata)
print(json.dumps({'frames': len(frames), 'finalBody': records[-1]['q'], 'finalBounds': frames[-1].getbbox()}))
