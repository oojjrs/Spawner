import json
import math
import random
import sys
from pathlib import Path
from PIL import Image, WebPImagePlugin

folder = Path(sys.argv[1])
output = Path(sys.argv[2])
output.mkdir(0o777, True, True)
timeline = json.loads((folder / 'timeline.json').read_text('utf-8'))
base = Image.open(folder / timeline['source']).convert('RGBA')
atlas = Image.open(folder / timeline['effects']).convert('RGBA')


def extract(rect):
    part = atlas.crop(rect)
    return part.crop(part.getbbox())


dust = extract((0, 0, 640, 640))
dispersed = extract((640, 0, 1280, 640))
chips = [extract(rect) for rect in [(125, 750, 345, 935), (390, 780, 550, 945),
                                    (120, 950, 345, 1150), (375, 985, 565, 1150)]]
dust.save(folder / 'source/dust.png')
dispersed.save(folder / 'source/dust-dispersed.png')
for index, chip in enumerate(chips):
    chip.save(folder / ('source/chip-' + str(index) + '.png'))


def stamp(surface, texture, x, y, width, height, opacity, angle):
    part = texture.resize((max(1, round(width)), max(1, round(height))), Image.Resampling.LANCZOS)
    if angle:
        part = part.rotate(angle, Image.Resampling.BICUBIC)
    part.putalpha(part.getchannel('A').point(lambda value: round(value * opacity)))
    surface.alpha_composite(part, (round(x - part.width / 2), round(y - part.height / 2)))


def smooth(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def render(time):
    pose = base.copy()
    particles = Image.new('RGBA', base.size, (0, 0, 0, 0))
    for event in timeline['events']:
        age = (time - event['startMs']) % timeline['periodMs']
        generator = random.Random(event['seed'])
        for index in range(event['grainCount']):
            offset = index * event['durationMs'] / event['grainCount'] + generator.uniform(-10, 10)
            travel = generator.uniform(*timeline['grainTravelMs'])
            width = generator.uniform(*timeline['grainWidth'])
            spread = generator.uniform(-timeline['grainSpread'], timeline['grainSpread'])
            origin_spread = generator.uniform(-10, 10)
            rotation = generator.uniform(-160, 160)
            phase = (age - offset) / travel
            if 0 <= phase < 1:
                x = event['origin'][0] + origin_spread + (event['landing'][0] - event['origin'][0]) * phase + spread * phase
                y = event['origin'][1] + (event['landing'][1] - event['origin'][1]) * phase * phase
                opacity = smooth(phase * 7) * smooth((1 - phase) * 7)
                stamp(particles, chips[index % len(chips)], x, y, width, width * .8, opacity, rotation * phase)
            elif 1 <= phase < 1.32:
                bounce = (phase - 1) / .32
                direction = -1 if spread < 0 else 1
                x = event['landing'][0] + origin_spread + spread + direction * 16 * bounce
                y = event['landing'][1] - math.sin(math.pi * bounce) * 12
                stamp(particles, chips[index % len(chips)], x, y, width, width * .8,
                      (1 - smooth(bounce)) * .8, rotation * phase)
        phase = (age - 350) / timeline['dustDurationMs']
        if 0 <= phase < 1:
            envelope = smooth(phase / .16) * smooth((1 - phase) / .32)
            width = event['dustWidth'] * (.62 + .46 * phase)
            height = width * timeline['dustHeightRatio']
            center = event['landing'][0] + event['drift'] * phase
            stamp(pose, dispersed, center + event['drift'] * .25, event['landing'][1] - height * .36,
                  width * 1.18, height * .72, envelope * .72, 0)
            stamp(pose, dust, center, event['landing'][1] - height / 2,
                  width, height, envelope * timeline['dustOpacity'], 0)
    pose.alpha_composite(particles)
    return pose


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
