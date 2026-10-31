import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, _webp


folder = Path(__file__).resolve().parent
shell = Image.open(folder / 'Parts/shell-back.png').convert('RGBA')
hard = Image.open(folder / 'Parts/hard-front.png').convert('RGBA')
roof_pixels = np.array(hard)
roof_pixels[360:] = 0
roof_pixels[:, :175] = 0
roof = Image.fromarray(roof_pixels)
neutral = Image.open(folder / 'Parts/neutral.png').convert('RGBA')
body = [Image.open(folder / f'Parts/body-{i:02d}.png').convert('RGBA') for i in range(1, 6)]
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
stages = rig['times']
apertures = np.array(Image.open(folder / 'Parts/apertures.png').convert('L'))
exterior = np.array(shell)[:, :, 3] < 128
attachments = {bone['id']: Image.open(folder / 'Parts' / (bone['id'] + '.png')).convert('RGBA') for bone in rig['bones']}
heads = [Image.open(folder / 'Parts' / entry['image']).convert('RGBA') for entry in rig['headCels']]
fore_cels = [Image.open(folder / 'Parts' / entry['image']).convert('RGBA') for entry in rig['foreCels']]


def bottom(image):
    ys, xs = np.where(np.array(image)[:, :, 3] > 128)
    return int(ys.max()) if len(ys) else 0


def translated(image, y):
    return image.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, (1, 0, 0, 0, 1, -y), Image.Resampling.BICUBIC).convert('RGBA')


def attached(bone, time):
    t = min(1, max(0, (time - bone['start']) / (bone['end'] - bone['start'])))
    progress = t * t * (3 - 2 * t)
    angle = math.radians(bone['endAngle'] * progress)
    c, s = math.cos(angle), math.sin(angle)
    px, py = bone['pivot']
    dx, dy = [value * progress for value in bone['endTranslation']]
    tx, ty = px + dx, py + dy
    matrix = (c, s, px - c * tx - s * ty, -s, c, py + s * tx - c * ty)
    image = attachments[bone['id']].convert('RGBa').transform((512, 512), Image.Transform.AFFINE, matrix, Image.Resampling.BICUBIC).convert('RGBA')
    pixels = np.array(image)
    visible = np.zeros((512, 512), np.uint8)
    left, top, right, bottom_y = bone['portal']
    visible[top:bottom_y, left:right] = apertures[top:bottom_y, left:right]
    visible[exterior] = 255
    pixels[:, :, 3] = np.minimum(pixels[:, :, 3], visible)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def head_at(time):
    image = Image.new('RGBA', (512, 512))
    for index, entry in enumerate(rig['headCels']):
        if entry['start'] <= time < entry['end']:
            dx, dy = entry['offset']
            pose = heads[index].convert('RGBa').transform((512, 512), Image.Transform.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.Resampling.BICUBIC).convert('RGBA')
            pixels = np.array(pose)
            if index >= 2:
                allowed = np.zeros((512, 512), np.uint8)
                left, top, right, bottom_y = rig['headPortal']
                allowed[top:bottom_y, left:right] = apertures[top:bottom_y, left:right]
                pixels[:, :, 3] = np.minimum(pixels[:, :, 3], allowed)
                pixels[pixels[:, :, 3] == 0] = 0
            image = Image.fromarray(pixels)
            break
    return image


def fore_at(time):
    image = Image.new('RGBA', (512, 512))
    for index, entry in enumerate(rig['foreCels']):
        if entry['start'] <= time < entry['end']:
            t = (time - entry['start']) / (entry['end'] - entry['start'])
            progress = t * t * (3 - 2 * t)
            dx, dy = [value * progress for value in entry['endOffset']]
            image = fore_cels[index].convert('RGBa').transform((512, 512), Image.Transform.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.Resampling.BICUBIC).convert('RGBA')
            if not entry['foreground']:
                pixels = np.array(image)
                allowed = np.zeros((512, 512), np.uint8)
                left, top, right, bottom_y = rig['forePortal']
                allowed[top:bottom_y, left:right] = apertures[top:bottom_y, left:right]
                pixels[:, :, 3] = np.minimum(pixels[:, :, 3], allowed)
                pixels[pixels[:, :, 3] == 0] = 0
                image = Image.fromarray(pixels)
            break
    return image


frames = []
motion = []
position = 0.0
velocity = 0.0
shell_bottom = bottom(shell)
for time in range(0, stages['end'] + 1, 40):
    index = 0 if time < stages['neutral'] else 1 if time < stages['lowered'] else 2 if time < stages['halfWithdrawn'] else 3 if time < stages['withdrawn'] else 4
    if index == 0:
        image = neutral.copy()
    else:
        if index < 3:
            skin = body[index - 1]
        else:
            skin = Image.new('RGBA', (512, 512))
            for bone in rig['bones']:
                skin.alpha_composite(attached(bone, time))
            skin.alpha_composite(fore_at(time))
        skin = skin.copy()
        skin.alpha_composite(head_at(time))
        limit = rig['groundY'] - max(shell_bottom, bottom(skin))
        for step in range(10):
            velocity += rig['gravity'] / 250
            position += velocity / 250
            if position > limit:
                position = limit
                velocity = -max(velocity, 0) * rig['restitution']
                if abs(velocity) < 5:
                    velocity = 0
        image = shell.copy()
        image.alpha_composite(skin)
        image.alpha_composite(roof)
        image = translated(image, position)
    frames.append(image)
    motion.append({'timeMs': time, 'bodyCel': index, 'shellY': position})
frames.append(frames[-1].copy())
durations = [40] * (len(frames) - 1) + [1000]
columns = 8
sheet = Image.new('RGBA', (columns * 512, ((len(frames) + columns - 1) // columns) * 512))
for index, image in enumerate(frames):
    sheet.paste(image, (index % columns * 512, index // columns * 512))
(folder / 'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(), True, 100.0, 100.0, '', 4, 1, b'', ''))


def encode(path, images, size):
    writer = _webp.WebPAnimEncoder(size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    for image, duration in zip(images, durations):
        writer.add(image.getim(), timestamp, True, 100.0, 100.0, 4)
        timestamp += duration
    writer.add(None, timestamp, True, 100.0, 100.0, 0)
    path.write_bytes(writer.assemble('', '', ''))


encode(folder / 'preview.webp', frames, (512, 512))
encode(folder / 'thumbnail.webp', [image.resize((64, 64), Image.Resampling.LANCZOS) for image in frames], (64, 64))
prefix = 'DesignAssets/Animations/CreatureDeathV6/walking-forest/'
meta = {'name': 'walking-forest', 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/walking-forest.png', 'image': prefix + 'death.webp', 'frameSize': 512, 'columns': columns, 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'pivotX': 256, 'pivotY': 448, 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'render.py', 'rig': prefix + 'rig.json'}
for name, data in [('death.json', meta), ('motion.json', motion)]:
    (folder / name).write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))
board = Image.new('RGB', (1536, 1024), '#263631')
for slot, index in enumerate([0, 4, 8, 13, 18, len(frames) - 1]):
    image = frames[index]
    board.paste(image, (slot % 3 * 512, slot // 3 * 512), image)
board.save(folder / 'contact.png')
print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'shellY': position}))
