from pathlib import Path
import sys
import shutil
import json
sys.path.insert(0, 'H:/Spawner/$Trash/creature-emergence-20261030/python')
import numpy as np
from PIL import Image, ImageDraw

root = Path('H:/Spawner/AnimationCandidates/SporeNestGrowth02To03HybridV1')
output = root / 'KeyframesV2'
sources = output / 'Sources'
sources.mkdir(511, True, True)
generated = Path('D:/.codex/generated_images/01a18fdb-911a-7f01-bebc-e59dd13a40fe')
entries = [
    ('00-start', .5, root / 'Sources/start.png', 'reference'),
    ('01-half-close', .95, root / 'Sources/key-01.png', 'initial-sheet'),
    ('02-closed-small', 1.4, generated / 'exec-bac897b0-d7bb-468c-8f9b-23c811f1d013.png', 'small-closed'),
    ('03-closed-medium', 1.75, generated / 'exec-97f6b13b-893d-4517-b408-ae997fe8deae.png', 'medium-closed'),
    ('04-closed-adult', 2.1, generated / 'exec-e75a286d-87a5-404d-b56c-911ac7cb013a.png', 'adult-closed-corrected'),
    ('05-half-open', 2.8, generated / 'exec-79302b58-38b2-4c09-ae76-3f2a9a2eaae0.png', 'half-open-corrected'),
    ('06-end', 3.6, root / 'Sources/end.png', 'reference')
]
images = []
metadata = []
for name, seconds, path, prompt in entries:
    local_source = sources / (name + '.png')
    if local_source.exists():
        path = local_source
    else:
        shutil.copy2(path, local_source)
    original = Image.open(path).convert('RGBA')
    im = original.resize((512, 512), Image.Resampling.LANCZOS)
    a = np.array(im)
    a[:, :, 3][a[:, :, 3] > 250] = 255
    a[a[:, :, 3] == 0] = 0
    im = Image.fromarray(a)
    dy = 0
    if prompt != 'reference':
        yy = np.where(a[:, :, 3] > 100)[0]
        dy = 447 - int(yy.max())
        shifted = Image.new('RGBA', (512, 512))
        shifted.paste(im, (0, dy))
        im = shifted
    im.save(output / (name + '.png'))
    images.append(im)
    metadata.append({'file': name + '.png', 'timeMs': round(seconds * 1000), 'sourceSize': list(original.size), 'canvasScale': 512 / original.width, 'offset': [0, dy], 'promptId': prompt})
contact = Image.new('RGB', (1536, 828), '#15241f')
draw = ImageDraw.Draw(contact)
for i, (im, entry) in enumerate(zip(images, entries)):
    bg = Image.new('RGBA', (512, 512), '#15241f')
    bg.alpha_composite(im)
    row, col = divmod(i, 4)
    tile = bg.convert('RGB').resize((384, 384), Image.Resampling.LANCZOS)
    x, y = col * 384, row * 414
    contact.paste(tile, (x, y + 25))
    draw.text((x + 12, y + 8), entry[0] + '  ' + str(entry[1]) + 's', '#e5efdf')
contact.save(output / 'keyframes-contact.png')
(output / 'keyframes.json').write_bytes((json.dumps({'version': 'KeyframesV2', 'state': 'pending-user-keyframe-approval', 'frameSize': [512, 512], 'root': [256, 448], 'keys': metadata}) + '\r\n').encode('utf-8'))
if Path(__file__).resolve() != (output / 'export_key_review.py').resolve():
    shutil.copy2(Path(__file__), output / 'export_key_review.py')
prompt_source = Path(__file__).parent / 'generation-prompts.json'
if prompt_source.resolve() != (output / 'generation-prompts.json').resolve():
    shutil.copy2(prompt_source, output / 'generation-prompts.json')
print('saved', output, len(images), flush=True)
