from pathlib import Path
import json
import shutil
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image, ImageDraw, ImageFont

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03WholePlanV1')
sources = root / 'Sources'
keys = root / 'Keyposes'
thumbs = root / 'Thumbs'
for directory in [sources, keys, thumbs]:
    directory.mkdir(0o777, True, True)
existing = [
    ('00-start.png', Path(r'H:\Spawner\DesignAssets\Animations\Nests\SporeLevel02-v4\References\level-02.png')),
    ('01-gather.png', Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03RedrawV2\BridgeKeysV1\Keyposes\01-cover.png')),
    ('02-closed-small.png', Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03BlockGrowthV1\Keyposes\03-closed-small.png')),
    ('03-jump-one.png', Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03BlockGrowthV1\Keyposes\04-closed-medium.png')),
    ('04-jump-two.png', Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03BlockGrowthV1\Keyposes\05-closed-adult.png')),
    ('08-end.png', Path(r'H:\Spawner\DesignAssets\Animations\Nests\Idle03-v1\spore\poster.png'))
]
records = []
for filename, source_path in existing:
    source = Image.open(source_path).convert('RGBA')
    ground = source.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()[3] - 1
    translation = (0, 447 - ground)
    unchanged = translation == (0, 0)
    if unchanged:
        shutil.copy2(source_path, keys / filename)
    else:
        canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        canvas.alpha_composite(source, translation)
        canvas.save(keys / filename)
    records.append({'file': 'Keyposes/' + filename, 'sourceReference': str(source_path), 'copiedUnchanged': unchanged, 'wholePoseTranslation': list(translation)})
for filename, source_path in [('05-roll-start.png', Path(sys.argv[1])), ('06-roll-middle.png', Path(sys.argv[2])), ('07-unfold.png', Path(sys.argv[3]))]:
    raw_name = Path(filename).stem + '-raw.png'
    if source_path.resolve() != (sources / raw_name).resolve():
        shutil.copy2(source_path, sources / raw_name)
    source = Image.open(source_path).convert('RGBA')
    if source.width != source.height:
        raise ValueError(source.size)
    resized = source.resize((512, 512), Image.Resampling.LANCZOS)
    ground = resized.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()[3] - 1
    position = (0, 447 - ground)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(resized, position)
    canvas.save(keys / filename)
    records.append({'file': 'Keyposes/' + filename, 'source': 'Sources/' + raw_name, 'commonCanvasScale': 512 / source.width, 'wholePoseTranslation': list(position)})
record_lookup = {entry['file']: entry for entry in records}
filenames = ['00-start.png', '01-gather.png', '02-closed-small.png', '03-jump-one.png', '04-jump-two.png', '05-roll-start.png', '06-roll-middle.png', '07-unfold.png', '08-end.png']
records = [record_lookup['Keyposes/' + filename] for filename in filenames]
titles = ['시작', '갓 모으기', '완전히 덮음', '1차 성장', '2차 성장 완료', '앞벽 말림', '장치 일부 노출', '펼침 · 안착', '최종 형태']
frames = [0, 8, 18, 32, 44, 70, 88, 98, 108]
font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 20)
small_font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 14)
background = (239, 233, 220, 255)
ink = (41, 52, 47, 255)
line = (191, 185, 171, 255)
for index, record in enumerate(records):
    image = Image.open(root / record['file']).convert('RGBA')
    preview = Image.new('RGBA', (512, 512), background)
    ImageDraw.Draw(preview).line((14, 450, 498, 450), line, 1)
    preview.alpha_composite(image, (0, 0))
    thumbnail = Image.new('RGBA', (256, 282), background)
    draw = ImageDraw.Draw(thumbnail)
    draw.text((7, 5), f'K{index:02d} {titles[index]} · {frames[index] / 24:.2f}초', ink, small_font)
    thumbnail.alpha_composite(preview.resize((256, 256), Image.Resampling.LANCZOS), (0, 26))
    thumbnail.convert('RGB').save(thumbs / Path(record['file']).name)
for filename, fill, color, rule in [('keyposes-light.png', background, ink, line), ('keyposes-dark.png', (24, 39, 35, 255), (235, 233, 220, 255), (67, 82, 75, 255))]:
    sheet = Image.new('RGBA', (1536, 1740), fill)
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        x = (index % 3) * 512
        y = (index // 3) * 580
        draw.text((x + 12, y + 12), f'K{index:02d} {titles[index]} · {frames[index] / 24:.2f}초', color, font)
        draw.line((x + 14, y + 492, x + 498, y + 492), rule, 1)
        sheet.alpha_composite(Image.open(root / record['file']).convert('RGBA'), (x, y + 42))
    sheet.convert('RGB').save(root / filename)
stages = [
    {'key': 0, 'frame': 0, 'nextKeyFrame': 8, 'interpolation': 'layeredCapRig'},
    {'key': 1, 'frame': 8, 'nextKeyFrame': 18, 'interpolation': 'layeredCapRig'},
    {'key': 2, 'frame': 18, 'holdThroughFrame': 31, 'nextKeyFrame': 32, 'interpolation': 'instantCut'},
    {'key': 3, 'frame': 32, 'holdThroughFrame': 43, 'nextKeyFrame': 44, 'interpolation': 'instantCut'},
    {'key': 4, 'frame': 44, 'holdThroughFrame': 59, 'motionFromFrame': 60, 'nextKeyFrame': 70, 'interpolation': 'capFoldRigWithDrawnUnderside'},
    {'key': 5, 'frame': 70, 'nextKeyFrame': 88, 'interpolation': 'drawnFoldBridgeWithLocalRig'},
    {'key': 6, 'frame': 88, 'nextKeyFrame': 98, 'interpolation': 'drawnCapUnfoldWithLocalRig'},
    {'key': 7, 'frame': 98, 'nextKeyFrame': 108, 'interpolation': 'capRimSettleWithLocalRig'},
    {'key': 8, 'frame': 108, 'holdThroughFrame': 119, 'interpolation': 'hold'}
]
metadata = {'state': 'whole-keypose-and-interpolation-plan', 'frameSize': [512, 512], 'groundContact': 448, 'fps': 24, 'totalFrames': 120, 'durationSeconds': 5, 'newWholeDrawings': 3, 'existingSources': 6, 'riggingPerformed': False, 'inbetweenFramesProduced': False, 'keys': records, 'stages': stages}
(root / 'timing-plan.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
prompts = json.loads(Path(sys.argv[4]).read_text('utf-8'))
(root / 'generation-prompts.json').write_bytes((json.dumps(prompts) + '\r\n').encode('utf-8'))
code = Path(__file__).read_text('utf-8')
(root / 'export_whole_keypose_plan.py').write_bytes(code.replace('\n', '\r\n').encode('utf-8'))
print(root)
