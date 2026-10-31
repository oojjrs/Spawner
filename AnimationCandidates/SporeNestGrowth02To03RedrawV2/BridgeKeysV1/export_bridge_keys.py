from pathlib import Path
import json
import shutil
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image, ImageDraw, ImageFont

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03RedrawV2')
output = root / 'BridgeKeysV1'
sources = output / 'Sources'
keys = output / 'Keyposes'
sources.mkdir(0o777, True, True)
keys.mkdir(0o777, True, True)
specs = [('01-cover.png', Path(sys.argv[1]), 'cover-whole-drawing.png'), ('06-lift.png', Path(sys.argv[2]), 'lift-whole-drawing.png')]
records = []
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
    records.append({'file': 'Keyposes/' + filename, 'source': 'Sources/' + source_name, 'commonCanvasScale': 512 / source.width, 'wholePoseTranslation': list(position)})
original_start = Path(r'H:\Spawner\DesignAssets\Animations\Nests\SporeLevel02-v4\References\level-02.png')
original_end = Path(r'H:\Spawner\DesignAssets\Animations\Nests\Idle03-v1\spore\poster.png')
panels = [(original_start, '시작 · 2레벨 원화'), (keys / '01-cover.png', '덮기 연결 · 새 작화'), (root / 'Keyposes' / '03-closed-small.png', '덮음 · 승인된 포즈'), (root / 'Keyposes' / '05-closed-adult.png', '2차 성장 · 승인된 포즈'), (keys / '06-lift.png', '올리기 연결 · 새 작화'), (original_end, '완료 · 3레벨 원화')]
font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 21)
for filename, background, text_color, line_color in [('bridge-keyposes-light.png', (239, 233, 220, 255), (41, 52, 47, 255), (191, 185, 171, 255)), ('bridge-keyposes-dark.png', (24, 39, 35, 255), (235, 233, 220, 255), (67, 82, 75, 255))]:
    sheet = Image.new('RGBA', (1536, 1120), background)
    draw = ImageDraw.Draw(sheet)
    for index, (path, title) in enumerate(panels):
        x = (index % 3) * 512
        y = (index // 3) * 560
        draw.text((x + 16, y + 12), title, text_color, font)
        draw.line((x + 16, y + 491, x + 496, y + 491), line_color, 1)
        sheet.alpha_composite(Image.open(path).convert('RGBA'), (x, y + 40))
    sheet.convert('RGB').save(output / filename)
metadata = {'state': 'pending-user-keypose-review', 'scope': 'Two new full-object bridge keys for covering and lifting; approved growth keys are unchanged.', 'frameSize': [512, 512], 'groundContact': 448, 'keys': records, 'riggingPerformed': False, 'partsExtracted': False, 'inbetweenFramesProduced': False}
(output / 'keyposes.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
prompt_path = Path(sys.argv[3])
prompts = json.loads(prompt_path.read_text('utf-8'))
(output / 'generation-prompts.json').write_bytes((json.dumps(prompts) + '\r\n').encode('utf-8'))
code = Path(__file__).read_text('utf-8')
(output / 'export_bridge_keys.py').write_bytes(code.replace('\n', '\r\n').encode('utf-8'))
print(output)
