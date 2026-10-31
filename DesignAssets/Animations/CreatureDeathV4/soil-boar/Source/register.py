from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'Source/registration.json').read_text('utf-8'))
(root / 'Source/CompleteParts').mkdir(0o777, True, True)
(root / 'Source/EditableParts').mkdir(0o777, True, True)
for name, spec in data.items():
    image = Image.open(root / spec['drawing']).convert('RGBA')
    rect = spec['rect']
    image = image.crop(rect)
    image.save(root / 'Source/CompleteParts' / (name + '.png'))
    matrix = np.asarray(spec['matrix'], float)
    offset = np.eye(3)
    offset[:2, 2] = rect[:2]
    inverse = np.linalg.inv(matrix @ offset)
    part = image.transform((512, 512), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC)
    part.save(root / 'Source/EditableParts' / (name + '.png'))
