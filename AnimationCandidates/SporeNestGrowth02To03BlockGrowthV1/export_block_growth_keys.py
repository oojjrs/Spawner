from pathlib import Path
import json
import shutil
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image, ImageDraw, ImageFont

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03BlockGrowthV1')
sources = root / 'Sources'
keys = root / 'Keyposes'
sources.mkdir(0o777, True, True)
keys.mkdir(0o777, True, True)
small = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03RedrawV2\Keyposes\03-closed-small.png')
shutil.copy2(small, keys / '03-closed-small.png')
specs = [('04-closed-medium.png', Path(sys.argv[1]), 'medium-whole-drawing.png'), ('05-closed-adult.png', Path(sys.argv[2]), 'adult-whole-drawing.png'), ('06-lift-start.png', Path(sys.argv[3]), 'lift-whole-drawing.png')]
records = [{'file': 'Keyposes/03-closed-small.png', 'reference': str(small), 'unchangedApprovedSource': True}]
for filename, source_path, source_name in specs:
    if source_path.resolve() != (sources / source_name).resolve():
        shutil.copy2(source_path, sources / source_name)
    source = Image.open(source_path).convert('RGBA')
    if source.width != source.height:
        raise ValueError(source.size)
    resized = source.resize((512, 512), Image.Resampling.LANCZOS)
    ground = resized.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()[3] - 1
    position = (0, 448 - ground)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(resized, position)
    canvas.save(keys / filename)
    records.append({'file': 'Keyposes/' + filename, 'source': 'Sources/' + source_name, 'sourceSize': list(source.size), 'commonCanvasScale': 512 / source.width, 'wholePoseTranslation': list(position)})
temp = Path(r'H:\Spawner\$Trash\SporeNestGrowth02To03BlockGrowthV1')
for filename in ['medium-size-reference.png', 'adult-square-registered.png']:
    reference = temp / filename
    if reference.exists():
        shutil.copy2(reference, sources / filename)
titles = ['03  성장 전 · 덮음', '04  1차 성장 · 두께 확장', '05  2차 성장 완료 · 장치 덮음', '06  올리기 시작 · 부피 유지']
font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 21)
for filename, background, text_color, line_color in [('keyposes-light.png', (239, 233, 220, 255), (41, 52, 47, 255), (191, 185, 171, 255)), ('keyposes-dark.png', (24, 39, 35, 255), (235, 233, 220, 255), (67, 82, 75, 255))]:
    sheet = Image.new('RGBA', (2048, 580), background)
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        x = index * 512
        draw.text((x + 14, 14), titles[index], text_color, font)
        draw.line((x + 14, 491, x + 498, 491), line_color, 1)
        sheet.alpha_composite(Image.open(root / record['file']).convert('RGBA'), (x, 40))
    sheet.convert('RGB').save(root / filename)
metadata = {'state': 'pending-user-keypose-review', 'frameSize': [512, 512], 'groundContact': 448, 'newWholeDrawings': 3, 'unchangedApprovedReferences': 1, 'intent': 'Two discrete growth events into a broad, thick rounded-rectangular head enclosing all adult machinery; retain that mass at lift start.', 'riggingPerformed': False, 'partsExtracted': False, 'inbetweenFramesProduced': False, 'keys': records}
(root / 'keyposes.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
prompts = json.loads(Path(sys.argv[4]).read_text('utf-8'))
(root / 'generation-prompts.json').write_bytes((json.dumps(prompts) + '\r\n').encode('utf-8'))
code = Path(__file__).read_text('utf-8')
(root / 'export_block_growth_keys.py').write_bytes(code.replace('\n', '\r\n').encode('utf-8'))
print(root)
