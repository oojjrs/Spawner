from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, _webp
from physics import simulate, at_time, matrix, rot, ease

root = Path(__file__).resolve().parent
rig = json.loads((root / 'rig.json').read_text('utf-8'))
images = {name: Image.open(root / path).convert('RGBA') for name, path in rig['parts'].items()}
records = simulate(images, rig, 1800)

def write_json(path, value):
    encoder = json.JSONEncoder()
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))

def transformed(image, value):
    inverse = np.linalg.inv(value)
    return image.transform((512, 512), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC)

def foreground(image, ellipses):
    mask = Image.new('L', (512, 512))
    draw = ImageDraw.Draw(mask)
    for ellipse in ellipses:
        draw.ellipse(ellipse, 255)
    value = np.array(image)
    value[:, :, 3] = np.minimum(value[:, :, 3], np.asarray(mask))
    return Image.fromarray(value)

head_foreground = foreground(images['head-open'], rig['headForeground'])
eyes = Image.new('L', (512, 512))
draw = ImageDraw.Draw(eyes)
for ellipse in rig['eyeClosure']['ellipses']:
    draw.ellipse(ellipse, 255)
eye_mask = np.asarray(eyes.filter(ImageFilter.GaussianBlur(rig['eyeClosure']['feather']))) / 255
open_head = np.array(images['head-open'])
closed_head = np.array(images['head-closed'])
yy = np.indices((512, 512))[0]

appendage_specs = rig['appendages']
appendages = {name: [] for name in appendage_specs}
for name, spec in appendage_specs.items():
    pivot = np.array(spec['root'], float)
    pixels = np.argwhere(np.asarray(images[name])[:, :, 3] > 128)[:, ::-1]
    lever = pixels.mean(0) - pivot
    inertia = float(np.mean(np.sum((pixels - pivot) ** 2, 1)))
    angle, speed = 0, 0
    last_root, last_speed = None, np.zeros(2)
    for record in records:
        parent = np.asarray(record['matrices'][spec['parent']])
        point = (parent @ np.r_[pivot, 1])[:2]
        dt = 1 / 240
        root_speed = (point - last_root) / dt if last_root is not None else np.zeros(2)
        acceleration = np.clip((root_speed - last_speed) / dt, -1800, 1800)
        world_lever = parent[:2, :2] @ rot(angle) @ lever
        gravity = (world_lever[0] * (900 - acceleration[1]) + world_lever[1] * acceleration[0]) / inertia
        active = 1 - ease((record['timeMs'] - spec['release'][0]) / (spec['release'][1] - spec['release'][0]))
        speed += (gravity - spec['stiffness'] * active * angle - 11 * speed) * dt
        angle += speed * dt
        limited = max(spec['range'][0], min(spec['range'][1], angle))
        if limited != angle:
            angle = limited
            speed = 0
        appendages[name].append(angle)
        last_root, last_speed = point, root_speed

def appendage(name, time, parent):
    index = max(0, min(len(records) - 1, round(time * 240 / 1000)))
    pivot = np.array(appendage_specs[name]['root'], float)
    return parent @ matrix(pivot, pivot, appendages[name][index])

def frame(time):
    matrices = at_time(time, records)
    value = open_head.copy()
    eye = rig['eyeClosure']
    closure = ease((time - eye['startMs']) / eye['durationMs'])
    mask = eye_mask * np.clip((eye['top'] + eye['height'] * closure - yy) / eye['edge'], 0, 1)
    value[:, :, :3] = (value[:, :, :3] * (1 - mask[:, :, None]) + closed_head[:, :, :3] * mask[:, :, None]).astype('uint8')
    head = Image.fromarray(value)
    output = Image.new('RGBA', (512, 512))
    order = rig['drawOrder']
    for name in order:
        if name in appendage_specs:
            parent = matrices[appendage_specs[name]['parent']]
            output.alpha_composite(transformed(images[name], appendage(name, time, parent)))
        elif name == 'head-foreground':
            output.alpha_composite(transformed(head_foreground, matrices['head-open']))
        elif name == 'head':
            output.alpha_composite(transformed(head, matrices['head-open']))
        else:
            output.alpha_composite(transformed(images[name], matrices[name]))
    return output

def encode(path, frames, durations):
    encoder = _webp.WebPAnimEncoder(frames[0].size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    for image, duration in zip(frames, durations):
        encoder.add(image.getim(), timestamp, True, 100., 100., 3)
        timestamp += duration
    encoder.add(None, timestamp, True, 100., 100., 0)
    path.write_bytes(encoder.assemble('', '', ''))

times = np.linspace(0, 1800, 55)
frames = [frame(float(time)) for time in times]
durations = [round(float(right)) - round(float(left)) for left, right in zip(times, times[1:])] + [900]
(root / 'Frames').mkdir(0o777, True, True)
for index, image in enumerate(frames):
    image.save(root / 'Frames' / ('frame-' + str(index).zfill(3) + '.png'))
sheet = Image.new('RGBA', (4096, 3584))
for index, image in enumerate(frames):
    sheet.alpha_composite(image, (index % 8 * 512, index // 8 * 512))
sheet.save(root / 'death.webp', **{'lossless': True, 'quality': 100, 'method': 6})
encode(root / 'preview.webp', frames, durations)
encode(root / 'thumbnail.webp', [image.resize((64, 64), Image.Resampling.LANCZOS) for image in frames], durations)
contact = Image.new('RGBA', (2048, 1024), (235, 232, 224, 255))
draw = ImageDraw.Draw(contact)
for i, index in enumerate([0, 6, 12, 18, 24, 33, 42, 54]):
    contact.alpha_composite(frames[index], (i % 4 * 512, i // 4 * 512))
    draw.text((i % 4 * 512 + 12, i // 4 * 512 + 12), str(round(float(times[index]))) + 'ms', (20, 20, 20))
contact.save(root / 'contact.png')
write_json(root / 'motion-records.json', records)
write_json(root / 'death.json', {'name': 'soil-boar', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/soil-boar.png', 'image': 'DesignAssets/Animations/CreatureDeathV4/soil-boar/death.webp', 'frameSize': 512, 'columns': 8, 'frameCount': len(frames), 'pivotX': 256, 'pivotY': 448, 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': 'DesignAssets/Animations/CreatureDeathV4/soil-boar/preview.webp', 'thumbnail': 'DesignAssets/Animations/CreatureDeathV4/soil-boar/thumbnail.webp', 'previewLoop': 0})
metadata = json.loads((root / 'death.json').read_text('utf-8'))
prefix = 'DesignAssets/Animations/CreatureDeathV4/soil-boar/'
metadata.update({'rig': prefix + 'rig.json', 'renderer': prefix + 'render.py', 'prepare': prefix + 'Source/prepare.py', 'sourceAuthoring': prefix + 'Source/authoring.json', 'contact': prefix + 'contact.png', 'sourcePlacement': {'canvas': [512, 512], 'groundY': 448, 'runtimeScale': [1, 1], 'referenceNormalization': json.loads((root / 'Source/reference-registration.json').read_text('utf-8')), 'partRegistration': 'Source/registration.json'}, 'construction': 'Complete independent rigid torso, skull, upper and lower limbs, hooves, ears and tail. Coupled rigid-body joint and contact dynamics release the muscle support. Ears and tail have delayed angular inertia. The skull alpha stays fixed while local eyelids close.'})
write_json(root / 'death.json', metadata)
print(json.dumps({'frames': len(frames), 'jointErrorMax': max(record['jointErrorPx'] for record in records), 'finalBody': records[-1]['q'][0], 'finalHead': records[-1]['q'][1]}))
