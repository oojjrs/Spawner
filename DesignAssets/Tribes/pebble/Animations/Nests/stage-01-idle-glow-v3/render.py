import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageFilter, WebPImagePlugin, GifImagePlugin

folder = Path(sys.argv[1])
output = Path(sys.argv[2])
output.mkdir(0o777, True, True)
timeline = json.loads((folder / 'timeline.json').read_text('utf-8'))
base = Image.open(folder / timeline['source']).convert('RGBA')
pixels = np.asarray(base, np.float32)
color = pixels[:, :, :3] / 255
occlusion = np.asarray(Image.open(folder / timeline['occlusion']).convert('L'), np.float32) / 255
y, x = np.mgrid[0:base.height, 0:base.width]
fields = []
for emitter in timeline['emitters']:
    texture = Image.open(folder / emitter['source']).convert('RGBA')
    dx, dy = emitter['offset']
    texture = texture.transform(base.size, Image.Transform.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.Resampling.BICUBIC)
    mask = ImageChops.multiply(texture.getchannel('A'), texture.convert('L')).filter(
        ImageFilter.GaussianBlur(timeline['blurRadius']))
    cx, cy = emitter['center']
    rx, ry = emitter['radius']
    falloff = np.exp(-.5 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2))
    fields.append(np.asarray(mask, np.float32) / 255 * occlusion * falloff)


def render(time):
    time %= timeline['periodMs']
    angle = 2 * math.pi * time / timeline['periodMs']
    illumination = np.zeros((base.height, base.width), np.float32)
    ambient = np.ones((base.height, base.width), np.float32)
    for emitter, field in zip(timeline['emitters'], fields):
        wave = .5 - .5 * math.cos(angle + emitter['phaseRadians'])
        low, high = timeline['intensity']
        illumination += field * (low + (high - low) * wave)
        ambient -= field * timeline['ambientDimming'] * (1 - wave)
    energy = illumination[:, :, None] * np.asarray(timeline['tint'], np.float32) * timeline['exposure']
    result = pixels.copy()
    shaded = color * np.clip(ambient[:, :, None], 0, 1)
    illuminated = (1 - (1 - shaded) * np.exp(-energy)) * 255
    active = pixels[:, :, 3] > 0
    result[active, :3] = illuminated[active]
    return Image.fromarray(np.rint(result).astype(np.uint8))


columns = timeline['columns']
count = timeline['frameCount']
sheet = Image.new('RGBA', (columns * 512, math.ceil(count / columns) * 512), (0, 0, 0, 0))
scale = timeline['runtimeScale']
tx = timeline['runtimePivot'][0] - timeline['pivot'][0] * scale
ty = timeline['runtimePivot'][1] - timeline['pivot'][1] * scale
transform = (1 / scale, 0, -tx / scale, 0, 1 / scale, -ty / scale)
poses = []
for index in range(count):
    pose = render(index * timeline['frameMs'])
    poses.append(pose)
    pose.save(output / ('frame-' + str(index).zfill(2) + '.png'))
    runtime = pose.transform((512, 512), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
    sheet.paste(runtime, (index % columns * 512, index // columns * 512))
sheet.save(output / 'nest-stage-01-idle-sheet.png')
sheet.encoderinfo = {'lossless': True, 'method': 4, 'exact': True}
with (output / 'nest-stage-01-idle-sheet.webp').open('wb') as stream:
    WebPImagePlugin._save(sheet, stream, str(output / 'nest-stage-01-idle-sheet.webp'))
render(timeline['periodMs']).save(output / 'loop-end.png')
contact = Image.new('RGBA', (4 * 128, 3 * 128), (42, 46, 43, 255))
for cell, index in enumerate(range(0, count, 4)):
    contact.alpha_composite(poses[index].resize((128, 128), Image.Resampling.LANCZOS), (cell % 4 * 128, cell // 4 * 128))
contact.save(output / 'contact-128.png')
for size in [128, 256]:
    preview = [pose.resize((size, size), Image.Resampling.LANCZOS) for pose in poses]
    preview[0].encoderinfo = {'append_images': preview[1:], 'duration': timeline['frameMs'],
                              'loop': 0, 'lossless': True, 'method': 4, 'background': (0, 0, 0, 0)}
    target = output / ('preview-' + str(size) + '.webp')
    with target.open('wb') as stream:
        WebPImagePlugin._save_all(preview[0], stream, str(target))
palette = contact.convert('RGB').quantize(256, Image.Quantize.MEDIANCUT)
preview = []
for pose in poses:
    surface = Image.new('RGBA', base.size, (42, 46, 43, 255))
    surface.alpha_composite(pose)
    frame = surface.resize((256, 256), Image.Resampling.LANCZOS).convert('RGB')
    preview.append(frame.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE))
preview[0].encoderinfo = {'append_images': preview[1:], 'duration': timeline['frameMs'], 'loop': 0, 'disposal': 2}
with (output / 'preview.gif').open('wb') as stream:
    GifImagePlugin._save_all(preview[0], stream, str(output / 'preview.gif'))
