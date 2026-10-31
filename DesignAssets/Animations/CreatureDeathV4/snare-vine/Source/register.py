from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
records = json.loads((root / 'Source/registration.json').read_text('utf-8'))
(root / 'Source/EditableParts').mkdir(0o777, True, True)
for name, record in records.items():
    image = Image.open(root / record['source']).convert('RGBA')
    rect = record['rect']
    image = image.crop(rect)
    offset = np.eye(3)
    offset[:2, 2] = rect[:2]
    inverse = np.linalg.inv(np.asarray(record['matrix']) @ offset)
    image.transform((512, 512), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC).save(root / 'Source/EditableParts' / (name + '.png'))
