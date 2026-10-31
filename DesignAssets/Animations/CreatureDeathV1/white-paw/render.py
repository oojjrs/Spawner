from pathlib import Path
from PIL import Image, ImageDraw
import json
import math

folder = Path(__file__).resolve().parent
root = folder.parents[3]
rig = json.loads((folder / 'rig.json').read_text('utf-8'))
size = rig['canvas'][0]
frames = [Image.open(folder / 'Drawings' / name).convert('RGBA') for name in rig['drawings']]
durations = rig['durationsMs']
columns = rig['columns']
sheet = Image.new('RGBA', (columns * size, math.ceil(len(frames) / columns) * size), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index % columns * size, index // columns * size))
sheet.save(folder / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4})
for name, dimension in [('preview.webp', 256), ('thumbnail.webp', 64)]:
    scaled = [frame.resize((dimension, dimension), Image.Resampling.LANCZOS) for frame in frames]
    scaled[0].save(folder / name, 'WEBP', **{'save_all': True, 'append_images': scaled[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'minimize_size': False})
relative = folder.relative_to(root).as_posix()
record = {'name': folder.name, 'action': 'death', 'sourceImage': 'DesignAssets/CreatureConcepts/v3/' + folder.name + '.png', 'image': relative + '/death.webp', 'frameSize': size, 'columns': columns, 'pivotX': rig['pivot'][0], 'pivotY': rig['pivot'][1], 'frameCount': len(frames), 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': relative + '/preview.webp', 'thumbnail': relative + '/thumbnail.webp', 'sourceNeutralBounds': list(Image.open(folder / 'Source/texture.png').getbbox()), 'thumbnailCanvasScale': 64 / size, 'thumbnailPivot': [rig['pivot'][0] / 8, rig['pivot'][1] / 8], 'method': rig['method'], 'rig': relative + '/rig.json', 'renderer': relative + '/render.py', 'sourceDrawings': relative + '/Drawings/'}
(folder / 'death.json').write_bytes((json.dumps(record, **{'ensure_ascii': False, 'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))
keys = [0, 2, 4, min(7, len(frames) - 1), min(10, len(frames) - 1), len(frames) - 1]
board = Image.new('RGB', (1536, 396), '#324340')
for column, index in enumerate(keys):
    image = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
    board.paste(image, (column * 256, 0), image)
    thumbnail = frames[index].resize((64, 64), Image.Resampling.LANCZOS)
    board.paste(thumbnail, (column * 256 + 96, 292), thumbnail)
    ImageDraw.Draw(board).text((column * 256 + 8, 260), str(sum(durations[:index])) + ' ms', 'white')
board.save(root / '$Trash/death-unique-20261029' / (folder.name + '-keyposes.png'))
print(folder.name, len(frames), sum(durations), flush=True)
