import json
import math
import sys
from pathlib import Path
from PIL import Image

folder = Path(sys.argv[1])
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
frames_folder = folder / 'frames'
frames_folder.mkdir(0o777, True, True)
runtime_folder = folder / 'runtime-frames'
runtime_folder.mkdir(0o777, True, True)
images = {layer['name']: Image.open(folder / layer['image']).convert('RGBA') for layer in rig['layers']}

def value(keys, time):
    for index in range(len(keys) - 1):
        left, right = keys[index], keys[index + 1]
        if time <= right['time']:
            t = max(0, min(1, (time - left['time']) / (right['time'] - left['time'])))
            if left['ease'] == 'inCubic':
                t = t ** 3
            elif left['ease'] == 'outCubic':
                t = 1 - (1 - t) ** 3
            else:
                t = t * t * (3 - 2 * t)
            return left['angle'] + (right['angle'] - left['angle']) * t
    return keys[-1]['angle']

def multiply(a, b):
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]

def render(time):
    matrices = {}
    for bone in rig['bones']:
        x, y = bone['position']
        angle = math.radians(value(rig['tracks'][bone['name']], time)) if bone['name'] in rig['tracks'] else 0
        local = [math.cos(angle), math.sin(angle), -math.sin(angle), math.cos(angle), x, y]
        matrices[bone['name']] = multiply(matrices[bone['parent']], local) if bone['parent'] else local
    result = Image.new('RGBA', tuple(rig['canvas']), (0, 0, 0, 0))
    for order, layer in sorted((item['drawOrder'], item) for item in rig['layers']):
        bone = next(item for item in rig['bones'] if item['name'] == layer['bone'])
        x, y = bone['position']
        a, b, c, d, tx, ty = matrices[layer['bone']]
        tx -= a * x + c * y
        ty -= b * x + d * y
        inverse = (d, -c, c * ty - d * tx, -b, a, b * tx - a * ty)
        part = images[layer['name']] if abs(a - 1) + abs(b) + abs(c) + abs(d - 1) + abs(tx) + abs(ty) < 1e-8 else images[layer['name']].transform(tuple(rig['canvas']), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC)
        result = Image.alpha_composite(result, part)
    return result

columns = rig['runtime']['columns']
sheet = Image.new('RGBA', (columns * 512, math.ceil(rig['frameCount'] / columns) * 512), (0, 0, 0, 0))
scale = rig['runtime']['scale']
tx = rig['runtime']['pivot'][0] - rig['pivot'][0] * scale
ty = rig['runtime']['pivot'][1] - rig['pivot'][1] * scale
runtime_transform = (1 / scale, 0, -tx / scale, 0, 1 / scale, -ty / scale)
for index in range(rig['frameCount']):
    pose = render(index * rig['frameMs'])
    pose.save(frames_folder / ('frame-' + str(index).zfill(2) + '.png'))
    runtime = pose.transform((512, 512), Image.Transform.AFFINE, runtime_transform, Image.Resampling.BICUBIC)
    runtime.save(runtime_folder / ('frame-' + str(index).zfill(2) + '.png'))
    sheet.paste(runtime, (index % columns * 512, index // columns * 512))
sheet.save(folder / 'nest-stage-01-idle-sheet.png')
render(2400).save(folder / 'loop-end.png')
print(json.dumps({'rendered': rig['frameCount'], 'method': 'two-bone rigid layer rig', 'sheet': list(sheet.size)}))
