from pathlib import Path
import json
import numpy as np
from PIL import Image


root = Path(__file__).resolve().parents[4]
output = Path(__file__).resolve().parent
work = root / '$Trash/spring-building-flow-20261030'
size = 432
count = 48
yy, xx = np.mgrid[:size, :size].astype(np.float32)
paths = {
    'storage': [
        ([[214, 94], [174, 134], [111, 160], [76, 190], [80, 243], [111, 285], [85, 331], [61, 352]], 23),
        ([[214, 94], [255, 135], [316, 163], [353, 192], [345, 241], [314, 281], [338, 328], [370, 354]], 23),
        ([[213, 193], [204, 229], [227, 262], [211, 304], [211, 324]], 46)
    ],
    'evolution-lab': [
        ([[215, 64], [187, 130], [141, 168], [76, 211], [77, 245], [110, 268], [85, 307], [65, 348]], 21),
        ([[215, 64], [243, 130], [289, 168], [354, 211], [354, 245], [321, 268], [344, 307], [365, 348]], 21)
    ],
    'outpost': [
        ([[220, 100], [177, 122], [133, 144], [79, 166], [56, 190], [63, 233], [68, 275], [83, 311]], 22),
        ([[220, 100], [266, 144], [322, 159], [371, 183], [375, 231], [371, 274], [351, 310]], 24),
        ([[92, 324], [141, 333], [209, 333], [279, 329], [343, 322]], 16)
    ],
    'watchpost': [
        ([[226, 37], [252, 48], [267, 76], [265, 113], [247, 144], [215, 159], [211, 183],
          [224, 206], [209, 239], [218, 265], [226, 287], [213, 315], [205, 341], [213, 368], [218, 388]], 11),
        ([[207, 67], [177, 90], [166, 118], [180, 145], [207, 162]], 14)
    ]
}
construction = json.loads((root / 'DesignAssets/Animations/Construction/v5/manifest.json').read_bytes())
bed = construction['units']['spring']['growth']['parts']['bed']
bed_height = 3 * .98 * bed[3] / bed[2]
grounds = {}
for kind in paths:
    front = construction['sequences']['spring:' + kind]['layout']['front']
    grounds[kind] = [front['center'][0], front['center'][1] - bed_height / 2 + 8 / 144]
pools = {kind: [216 + grounds[kind][0] * 144, 216 + grounds[kind][1] * 144, radius[0], radius[1]]
         for kind, radius in {'storage': [198, 33], 'evolution-lab': [193, 42],
                              'outpost': [198, 37], 'watchpost': [198, 40]}.items()}
grounds['watchpost'] = [0, 169 / 144]
pools['watchpost'] = [216, 385, 70, 18]


def stream_field(points, width):
    points = np.asarray(points, np.float32)
    segments = points[1:] - points[:-1]
    lengths = np.sqrt(np.sum(segments * segments, 1))
    distance = np.full_like(xx, 1e8)
    progress = np.zeros_like(xx)
    start = 0
    for index, length in enumerate(lengths):
        px, py = points[index]
        dx, dy = segments[index]
        t = np.clip(((xx - px) * dx + (yy - py) * dy) / (length * length), 0, 1)
        squared = (xx - px - t * dx) ** 2 + (yy - py - t * dy) ** 2
        closer = squared < distance
        progress[closer] = start + t[closer] * length
        distance = np.minimum(distance, squared)
        start += length
    weight = np.exp(-distance / (width * width * .7))
    return weight, progress


def prepare(kind):
    reference = root / 'DesignAssets/Animations/Construction/v5/spring' / (kind + '-complete.png')
    source = np.asarray(Image.open(reference).convert('RGBA')).astype(np.float32) / 255
    rgb, alpha = source[:, :, :3], source[:, :, 3]
    inner = alpha.copy()
    for shift in range(1, 7):
        for axis in [0, 1]:
            inner = np.minimum(inner, np.roll(alpha, shift, axis))
            inner = np.minimum(inner, np.roll(alpha, -shift, axis))
    water = np.clip((rgb[:, :, 1] - .24) * 2.5, 0, 1) * inner
    fields = [stream_field(points, width) for points, width in paths[kind]]
    cx, cy, rx, ry = pools[kind]
    radius = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    pool = np.clip((1 - radius) * 9, 0, 1) * np.clip((yy - cy + ry) / 13, 0, 1) * water
    return source, fields, water, pool, radius


def render(source, fields, water, pool, radius, phase):
    rgb = source[:, :, :3]
    gleam = np.zeros_like(xx)
    for index, (weight, progress) in enumerate(fields):
        wave = progress / 69 - phase * 3 + index * .31
        angle = wave * np.pi * 2
        flow = weight * water
        packet = np.maximum(0, np.cos(angle)) ** 9
        wake = np.maximum(0, np.cos(angle - .65)) ** 4
        gleam += (packet * .42 - wake * .07) * flow
    angle = (radius * 3.3 - phase * 4) * np.pi * 2
    ripple = np.maximum(0, np.cos(angle)) ** 11
    gleam += (ripple * .31 - .04 * np.sin(angle)) * pool
    positive, negative = np.maximum(0, gleam)[..., None], np.minimum(0, gleam)[..., None]
    tint = np.asarray([.65, .98, 1], np.float32)
    color = rgb + (tint - rgb) * positive + rgb * negative
    result = np.concatenate([np.clip(color, 0, 1), source[:, :, 3:]], axis=2)
    return Image.fromarray(np.round(result * 255).astype(np.uint8))


def main():
    work.mkdir(511, True, True)
    manifest = {'version': 4, 'sequences': {}}
    gallery = [Image.new('RGB', (768, 224), (25, 40, 43)) for index in range(count)]
    for column, kind in enumerate(paths):
        source, fields, water, pool, radius = prepare(kind)
        destination = output / 'spring' / kind
        destination.mkdir(511, True, True)
        directory = work / kind
        directory.mkdir(511, True, True)
        sheet = Image.new('RGBA', (size * 8, size * 6))
        preview = Image.new('RGBA', (192, 192 * count))
        contact = Image.new('RGB', (size * 5, size), (25, 40, 43))
        original = Image.fromarray(np.round(source * 255).astype(np.uint8))
        contact.paste(original, (0, 0), original)
        frames = []
        for index in range(count):
            frame = render(source, fields, water, pool, radius, index / count)
            frames.append(frame)
            sheet.paste(frame, (index % 8 * size, index // 8 * size))
            small = frame.resize((192, 192), Image.Resampling.LANCZOS)
            preview.paste(small, (0, index * 192))
            gallery[index].paste(small, (column * 192, 16), small)
            if index in [0, 12, 24, 36]:
                contact.paste(frame, (([0, 12, 24, 36].index(index) + 1) * size, 0), frame)
        sheet.save(directory / 'sheet.png')
        preview.save(directory / 'preview.png')
        contact.resize((1440, 288), Image.Resampling.LANCZOS).save(directory / 'contact.png')
        frames[0].save(directory / 'frame-00.png')
        manifest['sequences']['spring:' + kind] = {
            'image': str((destination / 'idle.webp').relative_to(root)).replace('\\', '/'),
            'preview': str((destination / 'preview.webp').relative_to(root)).replace('\\', '/'),
            'frameWidth': size, 'frameHeight': size, 'columns': 8, 'frameCount': count,
            'frameDuration': 100, 'duration': 4800, 'pivot': [216, 216],
            'reference': 'DesignAssets/Animations/Construction/v5/spring/' + kind + '-complete.png',
            'flowPaths': paths[kind], 'pool': pools[kind], 'bedGround': grounds[kind]
        }
    for index, frame in enumerate(gallery):
        frame.save(work / ('gallery-' + str(index).zfill(2) + '.png'))
    text = json.dumps(manifest)
    (work / 'manifest.json').write_bytes((text + '\n').replace('\n', '\r\n').encode('utf-8'))


if __name__ == '__main__':
    main()
