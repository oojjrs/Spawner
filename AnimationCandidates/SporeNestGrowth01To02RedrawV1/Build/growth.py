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
SOURCE = ROOT / 'Sources' / 'approved-growth-atlas.png'
SCRATCH = BASE / '$Trash' / 'SporeRedrawV1'
NAMES = ['small-rest', 'small-squash', 'medium-peak', 'medium-rest', 'medium-reference', 'medium-squash', 'adult-peak', 'adult-rest']
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


def prepare():
    raw = np.array(Image.open(SOURCE).convert('RGBA'))
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(raw[:, :, 3] > 0), 8)
    ids = [v[2] for v in sorted((int(centers[k, 1] > 500), centers[k, 0], k) for k in range(1, count))]
    cels, records = {}, []
    for name, k in zip(NAMES, ids):
        x, y, w, h, area = [int(v) for v in stats[k]]
        crop = raw[y:y + h, x:x + w].copy()
        crop[labels[y:y + h, x:x + w] != k] = 0
        left, top = (SIZE - w) // 2, GROUND - h + 1
        a = np.zeros((SIZE, SIZE, 4), np.uint8)
        a[top:top + h, left:left + w] = crop
        Image.fromarray(a).save(ROOT / 'Sources' / (name + '.png'))
        cels[name] = {'image': a, 'profile': profile(a)}
        records.append({'id': name, 'sourceRect': [x, y, w, h], 'placement': [left, top], 'sourcePixels': area, 'transform': 'integer-translation-only'})
    return cels, records


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


def transition(cels, before, after, amount):
    a, b = cels[before], cels[after]
    cel = a if amount < .5 else b
    return deform(cel, a, b, smooth(amount)), before if amount < .5 else after


def bg(frame, color):
    image = Image.fromarray(frame)
    base = Image.new('RGB', image.size, color)
    base.paste(image, (0, 0), image)
    return base


def animated(frames, path, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': [50] * len(frames), 'loop': loop, 'lossless': True, 'method': 4, 'kmin': 1, 'kmax': 1}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0], f, str(path))


def main():
    (ROOT / 'Sources').mkdir(511, True, True)
    (ROOT / 'Frames').mkdir(511, True, True)
    cels, records = prepare()
    sequence, states = [], []
    for i in range(66):
        if i < 16:
            a, name, phase, stage = cels['small-rest']['image'], 'small-rest', 'covered-hold', 0
        elif i < 25:
            k, stage = i - 16, 1
            if k <= 2:
                a, name = transition(cels, 'small-rest', 'small-squash', k / 2)
                phase = 'squash-1'
            elif k <= 5:
                a, name = transition(cels, 'small-squash', 'medium-peak', (k - 2) / 3)
                phase = 'inflate-1'
            else:
                a, name = transition(cels, 'medium-peak', 'medium-rest', (k - 5) / 4)
                phase = 'settle-1'
        elif i < 41:
            a, name, phase, stage = cels['medium-rest']['image'], 'medium-rest', 'hold-1', 1
        elif i < 50:
            k, stage = i - 41, 2
            if k <= 2:
                a, name = transition(cels, 'medium-rest', 'medium-squash', k / 2)
                phase = 'squash-2'
            elif k <= 5:
                a, name = transition(cels, 'medium-squash', 'adult-peak', (k - 2) / 3)
                phase = 'inflate-2'
            else:
                a, name = transition(cels, 'adult-peak', 'adult-rest', (k - 5) / 4)
                phase = 'settle-2'
        else:
            a, name, phase, stage = cels['adult-rest']['image'], 'adult-rest', 'hold-2', 2
        frame = Image.fromarray(a.copy())
        frame.save(ROOT / 'Frames' / (str(i).zfill(3) + '.png'))
        sequence.append(frame)
        states.append({'frame': i, 'timeMs': i * 50, 'phase': phase, 'stage': stage, 'cel': name})
    animated(sequence, ROOT / 'covered-growth.webp', 1)
    previews = [bg(np.array(p), '#20282e').crop((0, 280, 640, 608)) for p in sequence]
    animated(previews, ROOT / 'covered-preview.webp', 0)
    palette_board = Image.new('RGB', (640 * 11, 328 * 6))
    for i, p in enumerate(previews):
        palette_board.paste(p, (i % 11 * 640, i // 11 * 328))
    palette = palette_board.quantize(256, Image.Quantize.MEDIANCUT)
    gif = [p.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for p in previews]
    gif[0].encoderinfo = {'append_images': gif[1:], 'duration': [50] * len(gif), 'loop': 0, 'disposal': 2, 'optimize': False}
    with (ROOT / 'covered-preview.gif').open('wb') as f:
        GifImagePlugin._save_all(gif[0], f, str(ROOT / 'covered-preview.gif'))
    sheet = Image.new('RGBA', (640 * 11, 640 * 6))
    for i, p in enumerate(sequence):
        sheet.paste(p, (i % 11 * 640, i // 11 * 640))
    sheet.save(ROOT / 'covered-growth-sheet.png')
    contact = Image.new('RGB', (640 * 4, 328 * 3), '#20282e')
    for j, i in enumerate([0, 16, 18, 20, 21, 24, 25, 41, 43, 46, 49, 50]):
        contact.paste(previews[i], (j % 4 * 640, j // 4 * 328))
    contact.save(ROOT / 'growth-contact.png')
    data = {'status': 'representative-covered-growth', 'approvedKeyframes': 'SporeNestGrowth01To02RedrawKeysV1', 'approval': 'user-continue-2026-10-31', 'frameSize': [640, 640], 'root': [320, GROUND], 'frameCount': len(sequence), 'durationMs': 3300, 'frameDurationMs': 50, 'holdsMs': [800, 800, 800], 'growthMs': [450, 450], 'method': 'fresh-painted-cels-with-thin-plate-geometric-inbetweens', 'opacityTransition': False, 'dependencies': ['numpy', 'Pillow', 'opencv-python-headless'], 'registrations': records, 'timeline': states}
    (ROOT / 'growth.json').write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))
    print(json.dumps({'frames': len(sequence), 'durationMs': 3300, 'output': str(ROOT)}))


main()
