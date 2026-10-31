from pathlib import Path
import sys
import json
import numpy as np
from PIL import Image, WebPImagePlugin, GifImagePlugin

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT.parent
sys.path.insert(0, str(BASE / '$Trash' / 'deps'))
import cv2

SIZE = 640
GROUND = 576
YY, XX = np.mgrid[:SIZE, :SIZE].astype(np.float32)


def profile(a):
    mask = a[:, :, 3] > 19
    ys, xs = np.where(mask)
    left, right = int(xs.min()), int(xs.max())
    columns, tops, bottoms = [], [], []
    for x in range(left, right + 1):
        rows = np.where(mask[:, x])[0]
        if len(rows):
            columns.append(x)
            tops.append(int(rows.min()))
            bottoms.append(int(rows.max()))
    sample = np.linspace(left, right, 513)
    top = cv2.GaussianBlur(np.interp(sample, columns, tops).astype(np.float32)[None, :], (11, 1), 2)[0]
    bottom = cv2.GaussianBlur(np.interp(sample, columns, bottoms).astype(np.float32)[None, :], (11, 1), 2)[0]
    controls = []
    for q in np.linspace(.02, .98, 11):
        x = left + (right - left) * q
        lo, hi = np.interp(q * 512, np.arange(513), top), np.interp(q * 512, np.arange(513), bottom)
        for v in [0, .5, 1]:
            controls.append([x, lo + (hi - lo) * v])
    return {'left': left, 'right': right, 'top': top, 'bottom': bottom, 'controls': np.array(controls)}


def deform(cel, start, end, amount):
    if amount <= 0 and cel is start:
        return cel['image'].copy()
    if amount >= 1 and cel is end:
        return cel['image'].copy()
    src, pa, pb = cel['profile'], start['profile'], end['profile']
    target = (pa['controls'] + (pb['controls'] - pa['controls']) * amount) / SIZE
    original = src['controls'] / SIZE
    delta = target[:, None, :] - target[None, :, :]
    r2 = np.sum(delta * delta, 2)
    kernel = r2 * np.log(np.maximum(r2, 1e-12))
    affine = np.column_stack([np.ones(len(target)), target])
    system = np.block([[kernel + np.eye(len(target)) * 1e-7, affine], [affine.T, np.zeros((3, 3))]])
    weights = np.linalg.solve(system, np.vstack([original, np.zeros((3, 2))]))
    queries = np.column_stack([XX.ravel(), YY.ravel()]) / SIZE
    mapped = np.empty_like(queries)
    for k in range(0, len(queries), 16384):
        block = queries[k:k + 16384]
        delta = block[:, None, :] - target[None, :, :]
        r2 = np.sum(delta * delta, 2)
        basis = r2 * np.log(np.maximum(r2, 1e-12))
        mapped[k:k + len(block)] = basis @ weights[:-3] + np.column_stack([np.ones(len(block)), block]) @ weights[-3:]
    sx = (mapped[:, 0] * SIZE).reshape(SIZE, SIZE)
    sy = (mapped[:, 1] * SIZE).reshape(SIZE, SIZE)
    p = cel['image'].astype(np.float32) / 255
    p[:, :, :3] *= p[:, :, 3:4]
    out = cv2.remap(p, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, None, cv2.BORDER_CONSTANT)
    out[:, :, :3] /= np.maximum(out[:, :, 3:4], 1e-8)
    a = np.uint8(np.clip(out * 255 + .5, 0, 255))
    a[a[:, :, 3] < 20] = 0
    return a


def smooth(v):
    return v * v * (3 - 2 * v)


def bg(frame, color):
    image = Image.fromarray(frame)
    base = Image.new('RGB', image.size, color)
    base.paste(image, (0, 0), image)
    return base


def animated(frames, path, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': [50] * len(frames), 'loop': loop, 'lossless': True, 'method': 4, 'kmin': 1, 'kmax': 1}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0], f, str(path))


