from pathlib import Path
import sys
import json
import shutil
sys.path.insert(0, 'H:/Spawner/$Trash/creature-emergence-20261030/python')
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('H:/Spawner/AnimationCandidates/SporeNestGrowth02To03RedrawV1')
SRC = ROOT / 'Sources'
KEYS = ROOT / 'Keyposes'
WORK = Path('H:/Spawner/$Trash/SporeNestGrowth02To03RedrawV1')
GENERATED = Path('D:/.codex/generated_images/01a18fdb-911a-7f01-bebc-e59dd13a40fe')
KEYS.mkdir(511, True, True)

families = [
    ('closing', 3, 'exec-fe587f94-e010-4ed1-889f-fbe7f0c96787.png'),
    ('growth', 2, 'exec-136d1299-7971-49aa-88da-f9de1946b381.png'),
    ('opening', 3, 'exec-99580d4e-dd79-4819-9310-a159b95a9dbf.png'),
    ('medium-redraw', 1, 'exec-4845c564-e7e6-4d2a-8e92-435db2b804f1.png')
]
drawings = {}
for family, count, filename in families:
    source_path = SRC / (family + '-whole-drawings.png')
    if not source_path.exists():
        shutil.copy2(GENERATED / filename, source_path)
    sheet = Image.open(source_path).convert('RGBA')
    for i in range(count):
        box = (round(i * sheet.width / count), 0, round((i + 1) * sheet.width / count), sheet.height)
        cel = sheet.crop(box)
        cel.save(SRC / (family + '-' + str(i + 1) + '-raw.png'))
        resized = cel.resize((512, 512), Image.Resampling.LANCZOS)
        alpha = np.array(resized)[:, :, 3]
        rows = np.where((alpha > 128).sum(1) >= 20)[0]
        offset = 447 - int(rows.max())
        frame = Image.new('RGBA', (512, 512))
        frame.paste(resized, (0, offset))
        drawings[(family, i)] = (frame, {'family': family, 'cell': i, 'sourceRect': list(box), 'sourceSize': list(cel.size), 'canvasScale': 512 / cel.width, 'translation': [0, offset]})

entries = [
    ('00-start', '시작 · 2레벨 원화', None),
    ('01-lower-early', '덮기 시작', ('closing', 0)),
    ('02-lower-deep', '더 깊게 덮기', ('closing', 1)),
    ('03-closed-small', '완전히 덮음 · 정지', ('closing', 2)),
    ('04-closed-medium', '1차 성장 · 정지', ('medium-redraw', 0)),
    ('05-closed-adult', '2차 성장 · 정지', ('growth', 1)),
    ('06-opening-middle', '올리기 중간', ('opening', 0)),
    ('07-opening-high', '거의 올림', ('opening', 1)),
    ('08-end', '도착 · 3레벨 원화', None)
]
images = []
records = []
for i, (name, label, ref) in enumerate(entries):
    if ref is None:
        frame = Image.open(SRC / ('start.png' if i == 0 else 'end.png')).convert('RGBA')
        registration = {'reference': True, 'translation': [0, 0], 'canvasScale': 1}
    else:
        frame, registration = drawings[ref]
    frame.save(KEYS / (name + '.png'))
    images.append(frame)
    records.append({'file': 'Keyposes/' + name + '.png', 'label': label, 'registration': registration})

font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 19)
for variant, color in [('dark', '#15241f'), ('light', '#eee7da')]:
    contact = Image.new('RGB', (1536, 1650), color)
    draw = ImageDraw.Draw(contact)
    ink = '#e5edde' if variant == 'dark' else '#26342a'
    for i, (im, entry) in enumerate(zip(images, entries)):
        bg = Image.new('RGBA', (512, 512), color)
        bg.alpha_composite(im)
        x, y = i % 3 * 512, i // 3 * 550
        contact.paste(bg.convert('RGB'), (x, y + 34))
        draw.text((x + 16, y + 9), str(i).zfill(2) + '  ' + entry[1], ink, font)
    contact.save(ROOT / ('keyposes-' + variant + '.png'))

metadata = {'state': 'pending-user-keypose-review', 'frameSize': [512, 512], 'root': [256, 448], 'newWholeDrawings': 7, 'referenceImages': 2, 'motion': 'cover-hold-jump-hold-jump-hold-lift', 'priorAnimationOrRigReused': False, 'partExtractionOrRiggingPerformed': False, 'inbetweenFramesProduced': False, 'processing': 'whole-cell crop, common square canvas resampling and whole-pose ground translation only', 'keys': records}
(ROOT / 'keyposes.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
if Path(__file__).resolve() != (ROOT / 'export_fresh_keyposes.py').resolve():
    shutil.copy2(Path(__file__), ROOT / 'export_fresh_keyposes.py')
prompt_source = Path(__file__).parent / 'fresh-keypose-prompts.json'
if not prompt_source.exists():
    prompt_source = ROOT / 'generation-prompts.json'
if prompt_source.resolve() != (ROOT / 'generation-prompts.json').resolve():
    shutil.copy2(prompt_source, ROOT / 'generation-prompts.json')
print('fresh keypose sheet saved', len(images), 'new drawings', 7)
