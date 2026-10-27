from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import importlib.util
import json
import shutil
import sys
import math

folder = Path(__file__).resolve().parent
root = folder.parents[2]
work = root / '$Trash/unique-idle-three-20261027'
review = root / '$Trash/white-paw-pivot-20261027'
target = folder / 'white-paw-pivot-v2'
source = folder / 'white-paw/Source'
target.mkdir(511, True, True)
review.mkdir(511, True, True)
if not (target / 'Source').exists():
    shutil.copytree(source, target / 'Source')
spec = importlib.util.spec_from_file_location('original_idle_renderer', folder / 'render.py')
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
planning_target = root / 'DesignAssets/Planning/Animations/MountainPawLeaderIdle/white-paw-pivot-v2'
rig_path = planning_target / 'rig.json' if (planning_target / 'rig.json').exists() else target / 'rig.json'
if not rig_path.exists():
    rig_path = folder / 'white-paw/rig.json'
rig = json.loads(rig_path.read_text('utf-8'))
names = ['neutral', 'pose-1', 'pose-2', 'pose-3', 'pose-4', 'pose-5']
weights_path = target / 'Source/weights.npz'
if not weights_path.exists():
    weights_path = planning_target / 'Source/weights.npz'
sources = {'weights': list(np.load(weights_path)['weights'])}
attachment_path = target / 'Source/drawing-attachments.webp'
planning_attachment = root / 'DesignAssets/Planning/Animations/MountainPawLeaderIdle/white-paw-pivot-v2/Source/drawing-attachments.webp'
if not attachment_path.exists() and planning_attachment.exists():
    attachment_path = planning_attachment
if attachment_path.exists():
    attachments = Image.open(attachment_path).convert('RGBA')
    for index, name in enumerate(names):
        x, y = index % 3 * 512, index // 3 * 512
        sources[name] = attachments.crop((x, y, x + 512, y + 512))
else:
    accepted = json.loads((folder / 'white-paw/idle.json').read_text('utf-8'))
    for index, source_frame in enumerate(accepted['sourceFrames']):
        drawing = 'neutral'
        for at, value in rig['controls']['drawings']:
            if source_frame * 50 < at:
                break
            drawing = 'neutral' if value == 'neutral' else 'pose-' + value
        if drawing not in sources:
            sources[drawing] = Image.open(work / 'white-paw/Frames' / ('idle-' + str(source_frame).zfill(3) + '.png')).convert('RGBA')
    attachments = Image.new('RGBA', (1536, 1024), (0, 0, 0, 0))
    for index, name in enumerate(names):
        attachments.alpha_composite(sources[name], (index % 3 * 512, index // 3 * 512))
    attachments.save(attachment_path, 'WEBP', **{'lossless': True, 'method': 4})
regions = [
    [[332, 380, 412, 431], [252, 373, 310, 425]],
    [[288, 388, 360, 452], [180, 388, 252, 438]],
    [[260, 388, 336, 455], [141, 388, 218, 440]],
    [[290, 388, 361, 454], [170, 382, 249, 440]],
    [[260, 389, 341, 455], [141, 383, 222, 441]],
    [[230, 393, 304, 465], [115, 385, 197, 442]]
]

def contact(image, region):
    x0, y0, x1, y1 = region
    alpha = np.array(image.getchannel('A'))[y0:y1, x0:x1]
    ys, xs = np.where(alpha > 128)
    bottom = int(ys.max())
    xs = xs[ys >= bottom - 1]
    return [int(math.floor(float(np.median(xs)) + x0 + 0.5)), bottom + y0 + 1]

feet = {name: {'near': contact(sources[name], region[0]), 'far': contact(sources[name], region[1])} for name, region in zip(names, regions)}
reference = feet['neutral']
pad = [16, 64]
frame_size = 576
registrations = {}
fields = {}
for name in names:
    near, far = np.array(feet[name]['near']), np.array(feet[name]['far'])
    translation = np.array(reference['near']) - near
    correction = np.array(reference['far']) - far - translation
    weight = (1 - original.smooth((abs(original.xx - far[0]) - 52) / 24)) * (1 - original.smooth((far[1] - original.yy - 28) / 57))
    fields[name] = weight
    registrations[name] = {'sourceRearFeet': feet[name], 'translation': translation.tolist(), 'farFootCorrection': correction.tolist()}
    if name != 'neutral':
        registered = original.warp(sources[name], [weight], [tuple(correction)])
        canvas = Image.new('RGBA', (frame_size, frame_size), (0, 0, 0, 0))
        canvas.alpha_composite(registered, tuple((translation + pad).astype(int)))
        canvas.save(review / (name + '-registered.png'))

protect = np.zeros((512, 512))
for foot in [feet['pose-5']['near'], feet['pose-5']['far']]:
    local = (1 - original.smooth((abs(original.xx - foot[0]) - 33) / 16)) * original.smooth((original.yy - (foot[1] - 40)) / 16)
    protect = np.maximum(protect, local)
hold_weights = [weight * (1 - protect) for weight in sources['weights']]

def render(time):
    name = 'neutral'
    for at, drawing in rig['controls']['drawings']:
        if time < at:
            break
        name = 'neutral' if drawing == 'neutral' else 'pose-' + drawing
    source_image = sources[name]
    if name == 'pose-5':
        breath = original.control(rig['controls']['breathing'], time)
        source_image = original.warp(source_image, hold_weights, [(0, -3.5 * breath), (-1.2 * breath, -0.8 * breath), (1.5 * breath, -1.5 * breath)])
    record = registrations[name]
    if name != 'neutral':
        source_image = original.warp(source_image, [fields[name]], [tuple(record['farFootCorrection'])])
    image = Image.new('RGBA', (frame_size, frame_size), (0, 0, 0, 0))
    image.alpha_composite(source_image, tuple((np.array(record['translation']) + pad).astype(int)))
    return image

new_rig = dict(rig)
new_rig['attachments'] = {'image': 'Source/drawing-attachments.webp', 'frameSize': 512, 'columns': 3, 'names': names}
new_rig.update({'species': 'white-paw', 'frameSize': frame_size, 'canvas': [frame_size, frame_size], 'pivot': (np.array(reference['near']) + pad).tolist(), 'rearFeet': {name: (np.array(point) + pad).tolist() for name, point in reference.items()}, 'poseRegistration': registrations, 'renderer': '../white-paw-pivot.py', 'thumbnailTarget': 'DesignAssets/UnitPreviews/white-paw/idle-pivot-v2.webp', 'registrationMethod': 'Translation at the original near hind-paw contact, with a rigid far-paw plateau and smooth shin weights. Both hind paws are excluded from the upright breathing controls. Shared unscaled 576px canvas for every pose.'})
rig_output = planning_target if planning_target.exists() else target
(rig_output / 'Source').mkdir(511, True, True)
original.write_json(rig_output / 'rig.json', new_rig)
original.write_json(rig_output / 'Source/foot-registration.json', {'reference': reference, 'padding': pad, 'drawings': registrations})
mode = sys.argv[1]
if mode == 'keys':
    times = [0, 1500, 1650, 1890, 2800, 4850]
    board = Image.new('RGB', (576 * 3, 600 * 2), (35, 43, 46))
    for index, time in enumerate(times):
        frame = render(time)
        left, top = index % 3 * 576, index // 3 * 600
        board.paste(frame, (left, top), frame)
        draw = ImageDraw.Draw(board)
        draw.text((left + 10, top + 10), str(time) + ' ms', (240, 240, 240))
        for point in new_rig['rearFeet'].values():
            x, y = point[0] + left, point[1] + top
            draw.line((x - 10, y, x + 10, y), (255, 95, 70), 1)
            draw.line((x, y - 8, x, y + 8), (255, 95, 70), 1)
    board.save(review / 'registered-keys.png')
    print(json.dumps({'reference': reference, 'registrations': registrations}), flush=True)
elif mode == 'render':
    frames = work / 'white-paw-pivot-v2/Frames'
    frames.mkdir(511, True, True)
    for index, time in enumerate(range(0, rig['durationMs'], 50)):
        render(time).save(frames / ('idle-' + str(index).zfill(3) + '.png'))
    original.write_json(work / 'white-paw-pivot-v2/timing.json', {'durationsMs': [50] * (rig['durationMs'] // 50), 'durationMs': rig['durationMs']})
    print('white-paw-pivot-v2', rig['durationMs'] // 50, flush=True)
