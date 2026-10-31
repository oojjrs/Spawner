from pathlib import Path
from PIL import Image
import json

folder = Path(__file__).resolve().parent
data = json.loads((folder / 'hurt.json').read_bytes())
size, columns = data['frameSize'], data['columns']
cels = [Image.open(folder / 'Source/Cels' / (str(index + 1).zfill(2) + '.png')).convert('RGBA') for index in range(data['authoredCelCount'])]
frames = [cels[index] for index in data['runtimeCelMap']]
rows = (len(frames) + columns - 1) // columns
sheet = Image.new('RGBA', (size * columns, size * rows), (0, 0, 0, 0))
matrix = Image.new('RGBA', (64 * columns, 64 * rows), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.paste(frame, (index % columns * size, index // columns * size))
    matrix.paste(frame.resize((64, 64), Image.Resampling.LANCZOS), (index % columns * 64, index // columns * 64))
sheet.save(folder / 'hurt.webp', **{'lossless': True, 'method': 4})
matrix.save(folder / 'hurt-matrix.webp', **{'lossless': True, 'method': 4})
durations = data['durationsMs'].copy()
durations[-1] += 900
frames[0].save(folder / 'hurt-preview.webp', **{'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4})
small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
small[0].save(folder / 'hurt-thumbnail.webp', **{'save_all': True, 'append_images': small[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4})
