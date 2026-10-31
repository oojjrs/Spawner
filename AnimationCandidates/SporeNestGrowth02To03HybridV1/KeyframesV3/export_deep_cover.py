from pathlib import Path
import sys
import json
import shutil
sys.path.insert(0, 'H:/Spawner/$Trash/creature-emergence-20261030/python')
import numpy as np
from PIL import Image, ImageDraw

root = Path('H:/Spawner/AnimationCandidates/SporeNestGrowth02To03HybridV1')
previous = root / 'KeyframesV2'
output = root / 'KeyframesV3'
sources = output / 'Sources'
sources.mkdir(511, True, True)
raw = sources / 'deep-cover-sheet.png'
if not raw.exists():
    shutil.copy2(Path('D:/.codex/generated_images/01a18fdb-911a-7f01-bebc-e59dd13a40fe/exec-fbbbc807-8a34-444c-a41b-0dbea38868a7.png'), raw)
sheet = Image.open(raw).convert('RGBA')
names = ['02-closed-small.png', '03-closed-medium.png', '04-closed-adult.png']
times = [1400, 1750, 2100]
images = []
metadata = []
for i, name in enumerate(names):
    bounds = (round(i * sheet.width / 3), 0, round((i + 1) * sheet.width / 3), sheet.height)
    original = sheet.crop(bounds)
    original.save(sources / name)
    im = original.resize((512, 512), Image.Resampling.LANCZOS)
    a = np.array(im)
    a[:, :, 3][a[:, :, 3] > 250] = 255
    a[a[:, :, 3] == 0] = 0
    yy = np.where(a[:, :, 3] > 100)[0]
    offset = 447 - int(yy.max())
    frame = Image.new('RGBA', (512, 512))
    frame.paste(Image.fromarray(a), (0, offset))
    frame.save(output / name)
    images.append(frame)
    metadata.append({'file': name, 'timeMs': times[i], 'sourceRect': list(bounds), 'sourceSize': list(original.size), 'canvasScale': 512 / original.width, 'offset': [0, offset]})
contact = Image.new('RGB', (1536, 1100), '#15241f')
draw = ImageDraw.Draw(contact)
for row in range(2):
    for col, name in enumerate(names):
        im = Image.open(previous / name).convert('RGBA') if row == 0 else images[col]
        bg = Image.new('RGBA', (512, 512), '#15241f')
        bg.alpha_composite(im)
        x, y = col * 512, row * 550
        contact.paste(bg.convert('RGB'), (x, y + 32))
        draw.text((x + 16, y + 12), ('BEFORE ' if row == 0 else 'DEEP COVER ') + str(times[col] / 1000) + 's', '#e4eddd')
contact.save(output / 'deep-cover-comparison.png')
new_sheet = Image.new('RGBA', (1536, 512))
for i, im in enumerate(images):
    new_sheet.paste(im, (i * 512, 0))
new_sheet.save(output / 'deep-cover-keys.png')
(output / 'keyframes.json').write_bytes((json.dumps({'version': 'KeyframesV3', 'state': 'pending-user-keyframe-approval', 'frameSize': [512, 512], 'root': [256, 448], 'replaces': 'KeyframesV2 closed poses only', 'keys': metadata}) + '\r\n').encode('utf-8'))
script_source = Path(__file__)
if script_source.resolve() != (output / 'export_deep_cover.py').resolve():
    shutil.copy2(script_source, output / 'export_deep_cover.py')
prompt_source = script_source.parent / 'deep_cover_prompts.json'
if prompt_source.resolve() != (output / 'deep_cover_prompts.json').resolve():
    shutil.copy2(prompt_source, output / 'deep_cover_prompts.json')
print('saved', output, 'source', sheet.size, 'keys', len(images), flush=True)
