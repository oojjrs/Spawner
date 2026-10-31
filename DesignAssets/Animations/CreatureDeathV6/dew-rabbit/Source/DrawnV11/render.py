import json
from bisect import bisect_right
import math
from pathlib import Path

import numpy as np
from PIL import Image, _webp

from engine import affine, ease, encode, rotation, sample, translation, write_json


HERE = Path(__file__).resolve().parent
CONFIG = json.loads((HERE / 'motion.json').read_text('utf-8'))
BODY = Image.open(HERE / 'Parts/body.png').convert('RGBA')
HEADS = [Image.open(HERE / ('Parts/HeadUnits/closed-' + str(i).zfill(2) + '.png')).convert('RGBA') for i in range(12)]
OPEN_HEAD = Image.open(HERE / 'Parts/HeadUnits/open-00.png').convert('RGBA')


def progress(time, start, end):
    return ease((time - start) / (end - start))


def pose(time):
    amount = progress(time, 132, 660)
    head_amount = progress(time, 99, 726)
    parent = translation(*CONFIG['rootOffset']) @ rotation(CONFIG['bodyPivot'], -8 * amount)
    return parent @ translation(-4 * head_amount, 63 * head_amount) @ rotation(CONFIG['headPivot'], -5 * head_amount)


def neck_weight(x, y):
    horizontal = np.clip((310 - x) / 120, 0, 1)
    vertical = np.clip((426 - y) / 150, 0, 1)
    horizontal = horizontal * horizontal * (3 - 2 * horizontal)
    vertical = vertical * vertical * (3 - 2 * vertical)
    return horizontal * vertical


def body_layer(time):
    amount = progress(time, 132, 726)
    dx, dy = np.array(CONFIG['neckDisplacement']) * amount
    rows, columns = np.indices((512, 512))
    target_x = columns.ravel() - CONFIG['rootOffset'][0]
    target_y = rows.ravel() - CONFIG['rootOffset'][1]
    source_x = target_x.astype(float)
    source_y = target_y.astype(float)
    for iteration in range(12):
        weight = neck_weight(source_x, source_y)
        source_x = target_x - dx * weight
        source_y = target_y - dy * weight
    pixels = np.array(BODY).astype(float) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    values = sample(pixels, source_x, source_y)
    values[(source_x < 0) | (source_y < 0) | (source_x > 511) | (source_y > 511)] = 0
    rgb = values[:, :3] / np.maximum(1e-10, values[:, 3:4])
    result = np.c_[rgb, values[:, 3]].reshape(512, 512, 4)
    return Image.fromarray(np.uint8(np.clip(result * 255 + .5, 0, 255)))


def render(time):
    head = pose(time)
    index = max(0, bisect_right(CONFIG['earKeyTimesMs'], time) - 1)
    unit = OPEN_HEAD if time < 99 else HEADS[index]
    result = body_layer(time)
    result.alpha_composite(affine(unit, head))
    return result, {'timeMs': time, 'drawing': index, 'head': head.tolist(), 'neckProgress': progress(time, 132, 726)}


if __name__ == '__main__':
    output = HERE.parent.parent
    frame_folder = HERE / 'Frames'
    frame_folder.mkdir(511, True, True)
    times = list(range(0, 1156, 33))
    durations = [33] * (len(times) - 1) + [1000]
    frames = []
    records = []
    for index, time in enumerate(times):
        frame, record = render(time)
        frame.save(frame_folder / (str(index).zfill(3) + '.png'))
        frames.append(frame)
        records.append(record)
    sheet = Image.new('RGBA', (2048, math.ceil(len(frames) / 4) * 512))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index % 4 * 512, index // 4 * 512))
    (output / 'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(), True, 100.0, 100.0, '', 4, 1, b'', ''))
    encode(output / 'preview.webp', frames, durations)
    encode(output / 'thumbnail.webp', [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames], durations)
    prefix = 'DesignAssets/Animations/CreatureDeathV6/dew-rabbit/'
    metadata = {'name': 'dew-rabbit', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/dew-rabbit.png', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': 4, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'pivotX': 256, 'pivotY': 448, 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'Source/DrawnV11/render.py', 'sourceAuthoring': prefix + 'Source/DrawnV11/render.py', 'sourceFrames': ['Source/DrawnV11/Frames/' + str(index).zfill(3) + '.png' for index in range(len(frames))], 'headDrawings': [prefix + 'Source/DrawnV11/Parts/HeadUnits/closed-' + str(index).zfill(2) + '.png' for index in range(12)]}
    write_json(output / 'death.json', metadata)
    write_json(HERE / 'timeline.json', records)
    print('rendered', len(frames), 'frames;', sum(durations), 'ms')
