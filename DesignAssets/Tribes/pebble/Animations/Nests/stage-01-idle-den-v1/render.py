import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image

folder = Path(sys.argv[1])
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
frames_folder = folder / 'frames'
frames_folder.mkdir(0o777, True, True)
runtime_folder = folder / 'runtime-frames'
runtime_folder.mkdir(0o777, True, True)
base = Image.open(folder / rig['approvedSource']).convert('RGBA')
pixels = np.asarray(base, np.float32)
occlusion = np.asarray(Image.open(folder / rig['light']['occlusion']).convert('L'), np.float32) / 255
y, x = np.mgrid[0:base.height, 0:base.width]
mid, radius, amount = rig['light']['centerSuppression']
occlusion *= 1 - amount * np.exp(-((x - mid) / radius) ** 4)
textures = {emitter['name']: Image.open(folder / emitter['texture']).convert('RGBA') for emitter in rig['emitters']}

def ranged(values, amount):
    return values[0] + (values[1] - values[0]) * amount

def flicker(time, phase):
    angle = 2 * math.pi * time / rig['periodMs']
    value = rig['light']['ambient']
    for index, pair in enumerate(rig['light']['harmonics']):
        frequency, amplitude = pair
        value += amplitude * math.sin(frequency * angle + phase * (1 + index * .37))
    return max(0, min(1, value))

def render(time):
    effect_alpha = np.zeros(base.size[::-1], np.float32)
    emission = np.zeros((base.height, base.width, 3), np.float32)
    for emitter in rig['emitters']:
        phase = rig['tracks'][emitter['name']]['phaseRadians']
        amount = flicker(time, phase)
        scale = ranged(rig['light']['scale'], amount)
        cx, cy = emitter['center']
        texture = textures[emitter['name']].transform(base.size, Image.Transform.AFFINE, (1 / scale, 0, cx * (1 - 1 / scale), 0, 1 / scale, cy * (1 - 1 / scale)), Image.Resampling.BICUBIC)
        glow = np.asarray(texture, np.float32)
        alpha = glow[:, :, 3] / 255 * ranged(rig['light']['opacity'], amount) * occlusion
        effect_alpha += alpha
        emission += glow[:, :, :3] * np.asarray(emitter['tintRgb'], np.float32) * alpha[:, :, None]
    effect_alpha = np.minimum(.96, effect_alpha)
    alpha = np.maximum(pixels[:, :, 3] / 255, effect_alpha)
    premultiplied = pixels[:, :, :3] * (pixels[:, :, 3] / 255)[:, :, None] + emission
    result = pixels.copy()
    active = effect_alpha > 1e-6
    result[active, :3] = np.clip(premultiplied[active] / alpha[active, None], 0, 255)
    result[:, :, 3] = alpha * 255
    return Image.fromarray(np.rint(result).astype(np.uint8))

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
render(rig['actionMs']).save(folder / 'loop-end.png')
