from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import sys
import shutil
import subprocess

folder = Path(__file__).parent
work = folder.parents[4] / '$Trash/bean-tail-idle-20261027'
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
magick = shutil.which('magick')
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
skins = [mode] if mode in rig['skins'] or mode == 'tail' else list(rig['skins'])
count = rig['frameCount']
for name in ([] if mode == 'comparison' else skins + (['tail'] if mode == 'all' else [])):
    paths = [work / 'Frames' / name / (str(index).zfill(3) + '.png') for index in range(count)]
    atlas = Image.new('RGBA', (4096, 8192), (0, 0, 0, 0))
    for index, path in enumerate(paths):
        atlas.paste(Image.open(path).convert('RGBA'), (index % 8 * 512, index // 8 * 512))
    atlas.save(folder / (name + '-idle.png'))
    atlas.close()
    subprocess.check_call([magick, str(folder / (name + '-idle.png')), '-define', 'webp:lossless=true', str(folder / (name + '-idle.webp'))])
    subprocess.check_call([magick, '-delay', '5', '-loop', '0', *[str(path) for path in paths], '-define', 'webp:lossless=true', str(folder / (name + '-idle-preview.webp'))])
    print(name + ' atlas and animated WebP exported', flush=True)

if mode in rig['skins'] or mode == 'tail':
    raise SystemExit(0)

preview = work / 'ComparisonFrames'
preview.mkdir(511, True, True)
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 20)
small_font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 14)
for index in range(count):
    canvas = Image.new('RGB', (768, 550), '#26332b')
    draw = ImageDraw.Draw(canvas)
    for column, name in enumerate(skins):
        frame = Image.open(work / 'Frames' / name / (str(index).zfill(3) + '.png')).convert('RGBA')
        large = frame.resize((384, 384), Image.Resampling.LANCZOS)
        canvas.paste(large, (column * 384, -10), large)
        text = rig['skins'][name]['name']
        width = draw.textlength(text, font)
        draw.text((column * 384 + 192 - width / 2, 378), text, '#e2edde', font)
        small = frame.resize((101, 101), Image.Resampling.LANCZOS)
        canvas.paste(small, (column * 384 + 141, 414), small)
    draw.text((18, 524), '동일 배율 · 6.4초 반복 · 아래는 게임 크기', '#a9bcaa', small_font)
    canvas.save(preview / (str(index).zfill(3) + '.png'))
paths = [str(preview / (str(index).zfill(3) + '.png')) for index in range(count)]
subprocess.check_call([magick, '-delay', '5', '-loop', '0', *paths, '-define', 'webp:lossless=true', str(folder / 'idle-comparison.webp')])
palette = work / 'comparison-palette.png'
subprocess.check_call([magick, *[paths[index] for index in [0, 12, 24, 40, 44, 48, 64, 88, 112, 127]], '+append', '-colors', '256', '-unique-colors', str(palette)])
subprocess.check_call([magick, '-delay', '5', '-loop', '0', *paths, '+dither', '-remap', str(palette), '-layers', 'Optimize', str(folder / 'idle-comparison.gif')])
manifest = {
    'name': 'sprout-layered-tail-idle-v1',
    'frameSize': [512, 512],
    'frameCount': count,
    'columns': 8,
    'durationMs': 6400,
    'frameDurationMs': 50,
    'pivot': rig['pivot'],
    'loop': True,
    'rootMotion': False,
    'rig': 'rig.json',
    'render': 'render.py',
    'export': 'export.py',
    'preview': 'preview.html',
    'tailPart': 'Parts/tail.png',
    'tailCutout': 'Parts/tail-cutout.png',
    'tailAnimation': 'tail-idle.webp',
    'runtimeExport': 'export-runtime.py',
    'runtime': {'frameSize': [256, 256], 'columns': 8, 'frames': 128, 'frameDurationMs': 50,
        'images': ['DesignAssets/Tribes/sprout/Animations/Attributes/decomposition-idle-v1/' + name + '.webp' for name in ['basic', 'antenna', 'tail']]},
    'comparison': 'idle-comparison.webp',
    'variants': {name: {'name': rig['skins'][name]['name'], 'atlas': name + '-idle.webp', 'preview': name + '-idle-preview.webp'} for name in skins}
}
(folder / 'manifest.json').write_bytes((json.dumps(manifest) + '\n').replace('\n', '\r\n').encode('utf-8'))
print('Two-skin comparison, stable-palette GIF and manifest exported', flush=True)
