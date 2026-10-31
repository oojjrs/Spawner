import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from engine import sample


HERE = Path(__file__).resolve().parent
SOURCE = HERE
CONFIG = json.loads((HERE / 'contact-registration.json').read_text('utf-8'))


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


ROWS, COLS = np.indices((512, 512))
FACE = Image.open(SOURCE / 'Parts/head-closed.png').convert('RGBA')
PROTECTION = FACE.getchannel('A').filter(ImageFilter.MaxFilter(9))
OUTSIDE = 1 - np.asarray(PROTECTION).astype(float) / 255
OUTSIDE[np.asarray(PROTECTION) > 250] = 0
FACE_REGION = Image.open(SOURCE / 'Generation/Masks/00.png').convert('L')
OUTSIDE[np.asarray(FACE_REGION) == 0] = 0
VERTICAL = smooth((ROWS - 270) / 60)
WEIGHTS = np.stack((smooth((195 - COLS) / 25), smooth((COLS - 310) / 25)), 2)
WEIGHTS *= (VERTICAL * OUTSIDE)[:, :, None]


def register(image, shifts):
    target_x = COLS.ravel().astype(float)
    target_y = ROWS.ravel().astype(float)
    source_x = target_x.copy()
    source_y = target_y.copy()
    for iteration in range(12):
        displacement = sample(WEIGHTS, source_x, source_y) @ shifts
        source_x = target_x - displacement[:, 0]
        source_y = target_y - displacement[:, 1]
    pixels = np.asarray(image).astype(float) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    values = sample(pixels, source_x, source_y)
    values[(source_x < 0) | (source_y < 0) | (source_x > 511) | (source_y > 511)] = 0
    values[:, :3] /= np.maximum(values[:, 3:4], 1e-10)
    return Image.fromarray(np.uint8(np.clip(values.reshape(512, 512, 4) * 255 + .5, 0, 255)))


if __name__ == '__main__':
    for record in CONFIG['keys']:
        suffix = str(record['drawing'] - 1).zfill(2) + '.png'
        original = Image.open(HERE / CONFIG['source'] / suffix).convert('RGBA')
        shifts = np.array(record['sourceDisplacement'])
        result = register(original, shifts) if np.any(shifts) else original
        result.save(HERE / ('Parts/HeadUnits/closed-' + suffix))
