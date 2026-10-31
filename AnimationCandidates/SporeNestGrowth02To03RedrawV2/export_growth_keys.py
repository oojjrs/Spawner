from pathlib import Path
import json
import shutil
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image, ImageDraw, ImageFont

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03RedrawV2')
root.mkdir(0o777, True, True)
sources = root / 'Sources'
keys = root / 'Keyposes'
sources.mkdir(0o777, False, True)
keys.mkdir(0o777, False, True)
source_path = Path(sys.argv[1])
prompt_path = Path(sys.argv[2])
source = Image.open(source_path).convert('RGBA')
if source.size != (2172, 724):
    raise ValueError(source.size)
if source_path.resolve() != (sources / 'growth-whole-drawings.png').resolve():
    shutil.copy2(source_path, sources / 'growth-whole-drawings.png')
guide = Path(r'H:\Spawner\$Trash\SporeNestGrowth02To03RedrawV2\size-layout-reference.png')
if guide.exists():
    shutil.copy2(guide, sources / 'size-layout-reference.png')
scale = 474 / 720
specs = [
    ('03-closed-small.png', (0, 0, 645, 724), 321.5, 603, '03  덮은 채 정지'),
    ('04-closed-medium.png', (645, 0, 1375, 724), 1027, 604, '04  1차 성장 후 정지'),
    ('05-closed-adult.png', (1375, 0, 2172, 724), 1781.5, 604, '05  2차 성장 후 정지')
]
images = []
records = []
for filename, rect, center_x, ground_y, title in specs:
    crop = source.crop(rect)
    resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    ground_after_resize = resized.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()[3] - 1
    position = (256 - round((center_x - rect[0]) * scale), 448 - ground_after_resize)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(resized, position)
    canvas.save(keys / filename)
    images.append(canvas)
    records.append({'file': 'Keyposes/' + filename, 'sourceRectangle': list(rect), 'uniformScaleSharedByAllPoses': scale, 'wholePoseTranslation': list(position), 'title': title})
font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 22)
for filename, background, text_color, line_color in [
    ('keyposes-light.png', (239, 233, 220, 255), (41, 52, 47, 255), (191, 185, 171, 255)),
    ('keyposes-dark.png', (24, 39, 35, 255), (235, 233, 220, 255), (67, 82, 75, 255))
]:
    sheet = Image.new('RGBA', (1536, 580), background)
    draw = ImageDraw.Draw(sheet)
    for index, entry in enumerate(specs):
        x = index * 512
        draw.text((x + 16, 16), entry[4], text_color, font)
        draw.line((x + 16, 493, x + 496, 493), line_color, 1)
        sheet.alpha_composite(images[index], (x, 42))
    sheet.convert('RGB').save(root / filename)
metadata = {
    'state': 'pending-user-keypose-review',
    'canvas': [512, 512],
    'groundContact': 448,
    'source': 'Sources/growth-whole-drawings.png',
    'construction': 'Three newly generated full-object drawings; common uniform export scale and whole-pose registration only.',
    'posture': 'Deeply closed canopy maintained through both growth jumps.',
    'riggingPerformed': False,
    'partsExtracted': False,
    'inbetweenFramesProduced': False,
    'keys': records
}
for filename, value in [('keyposes.json', metadata), ('generation-prompt.json', json.loads(prompt_path.read_text('utf-8')))]:
    text = json.dumps(value) + '\n'
    (root / filename).write_bytes(text.replace('\n', '\r\n').encode('utf-8'))
script = Path(__file__).read_text('utf-8')
(root / 'export_growth_keys.py').write_bytes(script.replace('\n', '\r\n').encode('utf-8'))
print(root)
