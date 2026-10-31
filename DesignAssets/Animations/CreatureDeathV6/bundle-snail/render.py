from pathlib import Path
import json
import math
import numpy as np
from PIL import Image

folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf8'))
shell = Image.open(folder / 'Parts/shell.png').convert('RGBA')
poses = [(Image.open(folder / 'Parts' / item['image']).convert('RGBA'), item['durationMs']) for item in rig['bodyCels']]
rear_masks = [np.array(Image.open(folder / 'Parts' / item['rearMask']).convert('L')) if 'rearMask' in item else np.zeros((512, 512), np.uint8) for item in rig['bodyCels']]
ends = np.cumsum([duration for image, duration in poses])
bottom = lambda image: int(np.where(np.array(image)[:, :, 3] > 128)[0].max()) if np.any(np.array(image)[:, :, 3] > 128) else 0
shell_bottom = bottom(shell)
position = 0.0
velocity = 0.0
frames = []
records = []

def translated(image, y):
    return image.transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -y), Image.Resampling.BICUBIC)

for time in range(0, int(ends[-1]) + 1, 40):
    index = min(len(poses) - 1, int(np.searchsorted(ends, time, 'right')))
    body = poses[index][0]
    limit = rig['groundY'] - max(shell_bottom, bottom(body))
    for step in range(10):
        velocity += rig['gravity'] / 250
        position += velocity / 250
        if position >= limit:
            position = limit
            velocity = -max(0, velocity) * rig['restitution']
            if abs(velocity) < 4:
                velocity = 0
    source = np.array(body)
    back = source.copy()
    front = source.copy()
    mask = rear_masks[index] / 255
    back[:, :, 3] = np.round(source[:, :, 3] * mask).astype(np.uint8)
    front[:, :, 3] = np.round(source[:, :, 3] * (1 - mask)).astype(np.uint8)
    frame = translated(Image.fromarray(back), position)
    frame.alpha_composite(translated(shell, position))
    frame.alpha_composite(translated(Image.fromarray(front), position))
    frames.append(frame)
    records.append({'timeMs': time, 'bodyCel': rig['bodyCels'][index]['image'], 'shellY': position, 'contactLimitY': limit})

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
for slot, index in enumerate([0, 6, 10, 14, 18, 22, 27, len(frames) - 1]):
    frame = frames[index]
    board.paste(frame, (slot % 4 * 512, slot // 4 * 512), frame)
board.save(folder / 'contact.png')
print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'lastShellY': position}))
