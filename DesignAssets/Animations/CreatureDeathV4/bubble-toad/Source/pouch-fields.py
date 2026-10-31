from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
rig = json.loads((root / 'rig.json').read_text('utf-8'))
size = rig['pouch']['textureSize']
rows = rig['pouch']['contourSamples']
textures = []
contours = []
bounds = []

def sample(image, x, y):
    rgba = image.astype(float) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    x0 = np.clip(np.floor(x).astype('int32'), 0, image.shape[1] - 2)
    y0 = np.clip(np.floor(y).astype('int32'), 0, image.shape[0] - 2)
    u = np.clip(x - x0, 0, 1)[:, :, None]
    v = np.clip(y - y0, 0, 1)[:, :, None]
    value = rgba[y0, x0] * (1 - u) * (1 - v) + rgba[y0, x0 + 1] * u * (1 - v) + rgba[y0 + 1, x0] * (1 - u) * v + rgba[y0 + 1, x0 + 1] * u * v
    value[:, :, :3] /= np.maximum(value[:, :, 3:4], .000001)
    return np.clip(value * 255, 0, 255).astype('uint8')

for name in rig['pouch']['sourcePartNames']:
    image = np.array(Image.open(root / rig['parts'][name]).convert('RGBA'))
    opaque = image[:, :, 3] > 96
    ys, xs = np.nonzero(opaque)
    top, bottom = int(ys.min()), int(ys.max())
    left = []
    right = []
    for y in range(top, bottom + 1):
        x = np.flatnonzero(opaque[y])
        if len(x):
            left.append(float(x.min()))
            right.append(float(x.max()))
        else:
            left.append(left[-1])
            right.append(right[-1])
    source_y = np.arange(top, bottom + 1)
    contour_y = np.linspace(top, bottom, rows)
    contour = np.column_stack([np.interp(contour_y, source_y, left), np.interp(contour_y, source_y, right)])
    tex_y = np.linspace(top, bottom, size)
    tex_left = np.interp(tex_y, source_y, left)
    tex_right = np.interp(tex_y, source_y, right)
    u = np.linspace(0, 1, size)[None, :]
    xx = tex_left[:, None] * (1 - u) + tex_right[:, None] * u
    yy = np.repeat(tex_y[:, None], size, 1)
    textures.append(sample(image, xx, yy))
    contours.append(contour)
    bounds.append([top, bottom])
np.savez_compressed(root / rig['pouch']['fields'], np.array(textures), np.array(contours), np.array(bounds))
