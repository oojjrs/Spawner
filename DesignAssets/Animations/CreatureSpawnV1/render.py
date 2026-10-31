from pathlib import Path
import json
import math
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / '$Trash' / 'creature-emergence-20261030'
sys.path.insert(0, str(WORK / 'python'))
from PIL import Image, ImageDraw
import numpy as np
import cv2

BASE = Path(__file__).resolve().parent
SETTINGS = {
    'soil-mole': {'idle': 'DesignAssets/Animations/CreatureIdleV3/soil-mole/idle.webp', 'size': 355, 'pivot': [177.5, 310.625], 'rows': [0, 490, 805, 1086], 'floors': [452, 773, 1051], 'step': 40},
    'snare-vine': {'idle': 'DesignAssets/Animations/CreatureIdleStudies/V1/snare-vine/idle.webp', 'size': 424, 'pivot': [211.5859375, 389.35125], 'rows': [0, 362, 724, 1086], 'floors': [340, 700, 1052], 'step': 45}
}

def clean(image):
    pixels = np.array(image.convert('RGBA'))
    mask = (pixels[:, :, 3] > 24).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    keep = np.zeros(mask.shape, np.uint8)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= 12:
            keep[labels == label] = 255
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8))
    pixels[keep == 0] = 0
    return Image.fromarray(pixels)

def bounds(image):
    return Image.fromarray((np.array(image)[:, :, 3] > 80).astype(np.uint8) * 255).getbbox()

def flow_image(image):
    pixels = np.array(image).astype(np.float32) / 255
    return (pixels[:, :, :3] * pixels[:, :, 3:4] * 255).astype(np.uint8)

def between(left, right, count):
    a = np.array(left).astype(np.float32) / 255
    b = np.array(right).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    b[:, :, :3] *= b[:, :, 3:4]
    ag = cv2.cvtColor(flow_image(left), cv2.COLOR_RGB2GRAY)
    bg = cv2.cvtColor(flow_image(right), cv2.COLOR_RGB2GRAY)
    optical = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    forward = optical.calc(ag, bg, None)
    backward = optical.calc(bg, ag, None)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)
    result = []
    for index in range(1, count):
        t = index / count
        wa = cv2.remap(a, xx - forward[:, :, 0] * t, yy - forward[:, :, 1] * t, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
        wb = cv2.remap(b, xx - backward[:, :, 0] * (1 - t), yy - backward[:, :, 1] * (1 - t), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
        mixed = wa if t < .5 else wb
        mixed[:, :, :3] /= np.maximum(mixed[:, :, 3:4], 0.0001)
        result.append(Image.fromarray(np.clip(mixed * 255, 0, 255).astype(np.uint8)))
    return result

def run(arguments):
    process = subprocess.run(arguments)
    if process.returncode:
        raise RuntimeError('Media encoding failed')

def render(name, settings):
    directory = BASE / name
    directory.mkdir(0o777, True, True)
    temporary = WORK / name
    temporary.mkdir(0o777, True, True)
    image = Image.open(BASE / 'source' / (name + '.png')).convert('RGBA')
    size = settings['size']
    idle = Image.open(ROOT / settings['idle']).convert('RGBA').crop((0, 0, size, size))
    keys = []
    regions = []
    for index in range(12):
        row, column = divmod(index, 4)
        box = [column * 362, settings['rows'][row], (column + 1) * 362, settings['rows'][row + 1]]
        keys.append(clean(image.crop(box)))
        regions.append(box)
    last = bounds(keys[-1])
    target = bounds(idle)
    factor = (target[2] - target[0]) / (last[2] - last[0])
    target_center = (target[0] + target[2]) / 2
    source_center = (last[0] + last[2]) / 2
    registered = []
    for index, key in enumerate(keys):
        row = index // 4
        resized = key.resize((round(key.width * factor), round(key.height * factor)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (size, size))
        x = round(target_center - source_center * factor)
        y = round(target[3] - (settings['floors'][row] - settings['rows'][row]) * factor)
        canvas.alpha_composite(resized, (x, y))
        registered.append(canvas)
        canvas.save(temporary / ('key-%02d.png' % index))
    frames = []
    for index in range(len(registered) - 1):
        frames.append(registered[index])
        frames.extend(between(registered[index], registered[index + 1], 4))
    frames.append(registered[-1])
    frames.extend(between(registered[-1], idle, 8))
    frames.append(idle)
    durations = [settings['step']] * len(frames)
    durations[0] = 120
    durations[-1] = 160
    columns = 8
    sheet = Image.new('RGBA', (size * columns, size * math.ceil(len(frames) / columns)))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % columns) * size, (index // columns) * size))
        frame.save(temporary / ('frame-%03d.png' % index))
    sheet.save(temporary / 'sheet.png')
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(temporary / 'sheet.png'), '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', str(directory / 'emerge.webp')])
    concat = []
    for index, duration in enumerate(durations):
        concat += ["file 'frame-%03d.png'" % index, "option framerate 1000", 'duration %.6f' % (duration / 1000)]
    concat += ["file 'frame-%03d.png'" % (len(frames) - 1), "option framerate 1000"]
    (temporary / 'frames.txt').write_bytes(('\r\n'.join(concat) + '\r\n').encode('utf-8'))
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(temporary / 'frames.txt'), '-fps_mode', 'vfr', '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', str(directory / 'preview.webp')])
    thumb = frames[len(frames) // 2]
    thumb.save(directory / 'thumbnail.png')
    contact = Image.new('RGB', (4 * 240, 3 * 250), '#202a24')
    draw = ImageDraw.Draw(contact)
    for index, frame in enumerate(registered):
        small = frame.resize((225, 225), Image.Resampling.LANCZOS)
        contact.paste(small, ((index % 4) * 240 + 7, (index // 4) * 250 + 20), small)
        draw.text(((index % 4) * 240 + 8, (index // 4) * 250 + 5), str(index + 1), '#e1e8d9')
    contact.save(temporary / 'contact.png')
    meta = {'name': name, 'action': 'birth', 'provider': 'built-in image_gen', 'construction': 'drawn-keyframes-with-optical-flow-inbetweens', 'source': '../source/' + name + '.png', 'sourceRects': regions, 'sourceScale': factor, 'idleReference': settings['idle'], 'frameSize': size, 'columns': columns, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'rootMotion': False, 'pivotX': settings['pivot'][0], 'pivotY': settings['pivot'][1], 'image': 'emerge.webp', 'preview': 'preview.webp', 'thumbnail': 'thumbnail.png'}
    (directory / 'emerge.json').write_bytes((json.dumps(meta) + '\r\n').encode('utf-8'))
    print(name, len(frames), size, sum(durations), 'scale', factor, 'idle', target, 'source', last)

for name, settings in SETTINGS.items():
    render(name, settings)
