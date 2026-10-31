import json
import runpy
from pathlib import Path

from PIL import Image, _webp


folder = Path(__file__).resolve().parent.parent
meta = json.loads((folder / 'death.json').read_text('utf-8'))
runpy.run_path(str(folder / 'Source/render.py'))
frames = [Image.open(folder / name).convert('RGBA') for name in meta['sourceFrames']]
columns = meta['columns']
sheet = Image.new('RGBA', (columns * 512, ((len(frames) + columns - 1) // columns) * 512))
for index, frame in enumerate(frames):
    sheet.paste(frame, ((index % columns) * 512, (index // columns) * 512))
(folder / 'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(), True, 100.0, 100.0, '', 4, 1, b'', ''))


def encode(path, images, size):
    writer = _webp.WebPAnimEncoder(size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    for frame, duration in zip(images, meta['durationsMs']):
        writer.add(frame.getim(), timestamp, True, 100.0, 100.0, 4)
        timestamp += duration
    writer.add(None, timestamp, True, 100.0, 100.0, 0)
    path.write_bytes(writer.assemble('', '', ''))


encode(folder / 'preview.webp', frames, (512, 512))
encode(folder / 'thumbnail.webp', [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames], (64, 64))
