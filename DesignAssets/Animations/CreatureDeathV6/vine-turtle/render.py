from pathlib import Path
import json
import math
import numpy as np
from PIL import Image

folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf8'))
shell = Image.open(folder / 'Parts' / rig['shell']).convert('RGBA')
foreground = Image.open(folder / 'Parts' / rig['foreground']).convert('RGBA')
parts = [(item, Image.open(folder / 'Parts' / item['image']).convert('RGBA')) for item in rig['parts']]
yy, xx = np.mgrid[:512, :512]
head_cels = [(item['untilMs'], Image.open(folder / 'Parts' / item['image']).convert('RGBA')) for item in rig['headCels']]

def shifted(image, y):
    return image.transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -y), Image.Resampling.BICUBIC)

def bottom(image):
    mask = np.array(image)[:, :, 3] > 128
    return int(np.where(mask)[0].max()) if np.any(mask) else 0

def articulated(item, image, time):
    if item['name'] == 'head':
        return next((cel for until, cel in head_cels if time < until), head_cels[-1][1])
    if time >= item.get('depthBehindShellAfterMs', 1000000):
        return Image.new('RGBA', (512, 512))
    start, end = item['withdrawalMs']
    u = float(np.clip((time - start) / (end - start), 0, 1))
    u = u * u * (3 - 2 * u)
    angle = math.radians(item['foldDegrees']) * math.sin(u * math.pi / 2)
    c = math.cos(angle)
    s = math.sin(angle)
    px, py = item['pivot']
    dx, dy = np.array(item['inward']) * u
    tx = px + dx - c * px + s * py
    ty = py + dy - s * px - c * py
    transform = (c, s, -c * tx - s * ty, -s, c, s * tx - c * ty)
    out = np.array(image.transform((512, 512), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC))
    x0, y0, x1, y1 = item['ownerWindow']
    out[(xx < x0) | (xx >= x1) | (yy < y0) | (yy >= y1)] = 0
    return Image.fromarray(out)

frames = []
records = []
position = 0.0
velocity = 0.0
shell_bottom = bottom(shell)
end = max(item['withdrawalMs'][1] for item, image in parts) + rig['settleHoldMs']
for time in range(0, end + 1, 40):
    anatomy = Image.new('RGBA', (512, 512))
    for item, image in parts:
        anatomy.alpha_composite(articulated(item, image, time))
    visible = np.array(anatomy)
    visible[:, :, 3] = np.round(visible[:, :, 3] * (1 - np.array(foreground)[:, :, 3] / 255)).astype(np.uint8)
    limit = rig['groundY'] - max(shell_bottom, bottom(Image.fromarray(visible)))
    for step in range(10):
        velocity += rig['gravity'] / 250
        position += velocity / 250
        if position >= limit:
            position = limit
            velocity = -max(0, velocity) * rig['restitution']
            if abs(velocity) < 4:
                velocity = 0
    frame = shifted(shell, position)
    frame.alpha_composite(shifted(anatomy, position))
    frame.alpha_composite(shifted(foreground, position))
    frames.append(frame)
    records.append({'timeMs': time, 'shellY': position, 'contactLimitY': limit})

frames.append(frames[-1].copy())
durations = [40] * (len(frames) - 1) + [1000]
columns = 8
sheet = Image.new('RGBA', (512 * columns, math.ceil(len(frames) / columns) * 512))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index % columns * 512, index // columns * 512))
sheet.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'exact': True, 'method': 4})
for filename, size in [('preview.webp', 512), ('thumbnail.webp', 64)]:
    pictures = [frame.resize((size, size), Image.Resampling.LANCZOS) for frame in frames]
    pictures[0].save(folder / filename, 'WEBP', **{'save_all': True, 'append_images': pictures[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'exact': True, 'method': 4})
prefix = 'DesignAssets/Animations/CreatureDeathV6/' + folder.name + '/'
meta = {'name': folder.name, 'action': 'death', 'sourceImage': rig['authority'], 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': columns, 'frameCount': len(frames), 'pivotX': 256, 'pivotY': 448, 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'render.py', 'rig': prefix + 'rig.json'}
for name, data in [('death.json', meta), ('motion.json', records)]:
    (folder / name).write_bytes((json.dumps(data, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf8'))
board = Image.new('RGB', (2048, 1024), '#263631')
for slot, index in enumerate([0, 6, 10, 14, 18, 22, 30, len(frames) - 1]):
    board.paste(frames[index], (slot % 4 * 512, slot // 4 * 512), frames[index])
board.save(folder / 'contact.png')
print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'lastShellY': position}))