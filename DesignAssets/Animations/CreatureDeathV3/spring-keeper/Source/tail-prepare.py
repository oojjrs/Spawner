from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'tail-registration.json').read_text('utf-8'))
atlas = Image.open(root / data['source']).convert('RGBA')
for entry in data['stages']:
    image = atlas.crop(tuple(entry['sourceRectangle']))
    image.putalpha(Image.open(root / entry['sourceAlpha']).convert('L'))
    pixels = np.array(image)
    pixels[pixels[:, :, 3] == 0] = 0
    image = Image.fromarray(pixels).convert('RGBa')
    matrix = np.vstack([np.array(entry['matrix']), [0, 0, 1]])
    inverse = np.linalg.inv(matrix)[:2].reshape(-1)
    output = image.transform(tuple(data['canvas']), Image.Transform.AFFINE, tuple(inverse), Image.Resampling.BICUBIC, 1, (0, 0, 0, 0)).convert('RGBA')
    pixels = np.array(output)
    pixels[pixels[:, :, 3] == 0] = 0
    Image.fromarray(pixels).save(root / entry['output'])
