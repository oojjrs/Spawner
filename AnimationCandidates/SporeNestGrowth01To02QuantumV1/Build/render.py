from pathlib import Path
import sys
import json
import numpy as np
from PIL import Image, WebPImagePlugin, GifImagePlugin

ROOT = Path(__file__).resolve().parent.parent
DEPS = ROOT.parent / '$Trash' / 'deps'
sys.path.insert(0, str(DEPS))
import cv2

SOURCE = ROOT / 'Sources'
PARTS = SOURCE / 'Parts'
PARTS.mkdir(511, True, True)
FRAMES = ROOT / 'Frames'
FRAMES.mkdir(511, True, True)
SIZE = 512
Y, X = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)


def read(path):
    return Image.open(path).convert('RGBA')


def array(im):
    return np.array(im).astype(np.float32) / 255


def premul(im):
    a = array(im)
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def rgba(a):
    a = a.copy()
    a[:, :, :3] /= np.maximum(a[:, :, 3:4], 1e-6)
    a[a[:, :, 3] < 0.003] = 0
    return Image.fromarray(np.uint8(np.clip(a * 255 + 0.5, 0, 255)))


def clean(im):
    a = np.array(im).copy()
    n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(a[:, :, 3] > 80), 8)
    keep = np.zeros(n, np.uint8)
    for i in range(1, n):
        if stats[i, 4] > 100:
            keep[i] = 1
    mask = cv2.dilate(keep[labels], np.ones((3, 3), np.uint8))
    a[:, :, 3] *= mask
    a[a[:, :, 3] < 5] = 0
    return Image.fromarray(a)


def main_cap(im):
    a = np.array(im)
    hsv = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2HSV)
    red = np.uint8((a[:, :, 3] > 100) & ((hsv[:, :, 0] < 13) | (hsv[:, :, 0] > 170)) & (hsv[:, :, 1] > 65) & (hsv[:, :, 2] > 40))
    red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contour = contours[int(np.argmax([cv2.contourArea(item) for item in contours]))]
    mask = np.zeros(a.shape[:2], np.uint8)
    cv2.drawContours(mask, [contour], 0, 1, cv2.FILLED)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    cap = a.copy()
    cap[:, :, 3] *= mask
    cap[cap[:, :, 3] == 0] = 0
    body = a.copy()
    yy, xx = np.where(mask > 0)
    lo, hi = int(xx.min()), int(xx.max())
    lower = np.zeros(a.shape[1], np.float32)
    for x in range(lo, hi + 1):
        values = np.where(mask[:, x] > 0)[0]
        lower[x] = values.max() if len(values) else 0
    lower[:lo] = lower[lo]
    lower[hi + 1:] = lower[hi]
    for x in range(max(0, lo - 8), min(a.shape[1], hi + 9)):
        body[:int(lower[x]) + 1, x] = 0
    body[body[:, :, 3] == 0] = 0
    return Image.fromarray(cap), Image.fromarray(body), mask


def transformed(im, scale, dx, dy):
    matrix = np.float32([[scale, 0, dx], [0, scale, dy]])
    return rgba(cv2.warpAffine(premul(im), matrix, (SIZE, SIZE), cv2.INTER_LANCZOS4, cv2.BORDER_CONSTANT))


def registered_cap(im, width, bottom):
    a = np.array(im)[:, :, 3]
    yy, xx = np.where(a > 100)
    left, right = int(xx.min()), int(xx.max())
    center = (left + right) / 2
    bottom_center = int(np.where(a[:, round(center)] > 100)[0].max())
    scale = width / (right - left + 1)
    return transformed(im, scale, 256 - scale * center, bottom - scale * bottom_center)


def registered_body(im, width):
    a = np.array(im)[:, :, 3]
    yy, xx = np.where(a > 100)
    left, right, bottom = int(xx.min()), int(xx.max()), int(yy.max())
    center = (left + right) / 2
    scale = width / (right - left + 1)
    return transformed(im, scale, 256 - scale * center, 447 - scale * bottom)


def registered_top(im, width, top):
    alpha = np.array(im)[:, :, 3]
    yy, xx = np.where(alpha > 100)
    left, right = int(xx.min()), int(xx.max())
    center = (left + right) / 2
    scale = width / (right - left + 1)
    return transformed(im, scale, 256 - scale * center, top - scale * int(yy.min()))


def profiles(im):
    alpha = np.array(im)[:, :, 3]
    top = np.zeros(SIZE, np.float32)
    bottom = np.zeros(SIZE, np.float32)
    valid = []
    for x in range(SIZE):
        yy = np.where(alpha[:, x] > 80)[0]
        if len(yy):
            top[x] = yy.min()
            bottom[x] = yy.max()
            valid.append(x)
    all_x = np.arange(SIZE)
    top = np.interp(all_x, valid, top[valid]).astype(np.float32)
    bottom = np.interp(all_x, valid, bottom[valid]).astype(np.float32)
    return top, bottom, min(valid), max(valid)


def compose(cap, body):
    top, bottom, left, right = profiles(cap)
    a = np.array(body).copy()
    mask = (X > 195) & (X < 318) & (Y < top[None, :] + 2)
    a[mask] = 0
    return Image.alpha_composite(Image.fromarray(a), cap)


def shifted(im, dy):
    return transformed(im, 1, 0, dy)


def smooth(q):
    q = float(np.clip(q, 0, 1))
    return q * q * (3 - 2 * q)


def animated(frames, path, durations, loops):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': loops, 'lossless': True, 'method': 4, 'minimize_size': False, 'kmin': 1, 'kmax': 1}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0], f, str(path))


start = read(SOURCE / 'start.png')
end = read(SOURCE / 'end.png')
sheet = read(SOURCE / 'key-drawings.png')
cels = []
for i in range(9):
    x0, x1 = round(i % 3 * sheet.width / 3), round((i % 3 + 1) * sheet.width / 3)
    y0, y1 = round(i // 3 * sheet.height / 3), round((i // 3 + 1) * sheet.height / 3)
    cels.append(clean(sheet.crop((x0, y0, x1, y1))))

small_open, small_body, _ = main_cap(start)
sb = np.array(small_body).copy()
sb[(X < 146) | (X > 369) | (Y < 321)] = 0
small_body = Image.fromarray(sb)
adult_body = read(SOURCE / 'adult-body-complete.png')
ab = np.array(adult_body).copy()
ab[Y < 248] = 0
adult_body = Image.fromarray(ab)
ao = np.array(read(SOURCE / 'adult-canopy-complete.png')).copy()
stem_mask = (ab[:, :, 3] > 30) & (X > 209) & (X < 310) & (Y < 336)
ao[stem_mask] = 0
rear = read(SOURCE / 'adult-rear.png')
adult_body = Image.alpha_composite(rear, adult_body)
adult_native = np.array(adult_body).copy()
adult_native[314:] = np.array(end)[314:]
adult_body = Image.fromarray(adult_native)
ao[ao[:, :, 3] < 15] = 0
ao[(Y > 313) | (X > 437)] = 0
n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(ao[:, :, 3] > 80), 8)
label = 1 + int(np.argmax(stats[1:, 4]))
main_mask = cv2.dilate(np.uint8(labels == label), np.ones((5, 5), np.uint8))
ao[:, :, 3] *= main_mask
ao[ao[:, :, 3] == 0] = 0
adult_open = Image.fromarray(ao)
caps_sheet = clean(read(SOURCE / 'closed-caps.png'))
cs = np.array(caps_sheet)
n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(cs[:, :, 3] > 100), 8)
ids = [i for i in range(1, n) if stats[i, 4] > 10000]
ids = [ids[i] for i in np.argsort([centers[j, 0] for j in ids])]
closed = []
for i in ids:
    mask = cv2.dilate(np.uint8(labels == i), np.ones((5, 5), np.uint8))
    layer = cs.copy()
    layer[:, :, 3] *= mask
    closed.append(Image.fromarray(layer))
medium_down = registered_cap(closed[1], 340, 398)
drawn_sheet = read(SOURCE / 'canopy-cels.png')
drawn = []
for i in range(16):
    x0, x1 = round(i % 4 * drawn_sheet.width / 4), round((i % 4 + 1) * drawn_sheet.width / 4)
    y0, y1 = round(i // 4 * drawn_sheet.height / 4), round((i // 4 + 1) * drawn_sheet.height / 4)
    drawn.append(clean(drawn_sheet.crop((x0, y0, x1, y1))))
small_down = registered_top(drawn[5], 298, 285)
adult_down = registered_top(drawn[6], 380, 237)
mb = np.array(cels[3]).copy()
mb[:195] = 0
medium_body = registered_body(Image.fromarray(mb), 275)
parts = {'small-open-cap': small_open, 'small-down-cap': small_down, 'small-body': small_body, 'medium-down-cap': medium_down, 'medium-body': medium_body, 'adult-down-cap': adult_down, 'adult-open-cap': adult_open, 'adult-body': adult_body}
for name, im in parts.items():
    im.save(PARTS / (name + '.png'))

frames = []
states = []
for i in range(48):
    ms = i * 50
    if i < 8:
        q = smooth(i / 7)
        cel = max(0, min(5, round((i - 1) * 5 / 6)))
        cap = small_open if i == 0 else registered_top(drawn[cel], 298, 251 + 34 * q)
        body = small_body
        stage = 0
        phase = 'lower'
    elif i < 19:
        cap = shifted(medium_down, 3 if i == 8 else 1 if i == 9 else 0)
        body = medium_body
        stage = 1
        phase = 'growth-1' if i < 10 else 'hold-1'
    elif i < 29:
        cap = shifted(adult_down, 3 if i == 19 else 1 if i == 20 else 0)
        body = adult_body
        stage = 2
        phase = 'growth-2' if i < 21 else 'hold-2'
    elif i < 42:
        q = smooth((i - 29) / 12)
        cel = 6 + round((i - 29) * 8 / 12)
        cap = registered_top(drawn[cel], 380, 237 - 88 * q)
        body = adult_body
        stage = 2
        phase = 'lift'
    else:
        cap = adult_open
        body = adult_body
        stage = 2
        phase = 'rest'
    frame = compose(cap, body)
    if i == 0:
        frame = start.copy()
    if i >= 41:
        frame = end.copy()
    frames.append(frame)
    states.append({'frame': i, 'timeMs': ms, 'stage': stage, 'phase': phase})
    frame.save(FRAMES / (str(i).zfill(3) + '.png'))

runtime = Image.new('RGBA', (4096, 3072))
for i, frame in enumerate(frames):
    runtime.paste(frame, (i % 8 * SIZE, i // 8 * SIZE))
runtime.save(ROOT / 'growth-sheet.png')
animated(frames, ROOT / 'growth.webp', [50] * 48, 1)
preview = []
for frame in frames:
    bg = Image.new('RGB', (SIZE, SIZE), '#20282e')
    bg.paste(frame, (0, 0), frame)
    preview.append(bg)
animated(preview, ROOT / 'preview.webp', [50] * 48, 0)
contact = Image.new('RGB', (2048, 1536), '#20282e')
for j, i in enumerate([0, 3, 7, 8, 10, 18, 19, 28, 31, 35, 39, 47]):
    contact.paste(preview[i], (j % 4 * SIZE, j // 4 * SIZE))
contact.save(ROOT / 'contact.png')
small_previews = [im.resize((256, 256), Image.Resampling.LANCZOS) for im in preview]
palette_board = Image.new('RGB', (256 * 8, 256 * 6))
for i, im in enumerate(small_previews):
    palette_board.paste(im, (i % 8 * 256, i // 8 * 256))
palette = palette_board.quantize(256, Image.Quantize.MEDIANCUT)
gif_frames = [im.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for im in small_previews]
gif_frames[0].encoderinfo = {'append_images': gif_frames[1:], 'duration': [50] * 48, 'loop': 0, 'optimize': False, 'disposal': 2}
with (ROOT / 'preview.gif').open('wb') as f:
    GifImagePlugin._save_all(gif_frames[0], f, str(ROOT / 'preview.gif'))
metadata = {'frameSize': [512, 512], 'frameCount': 48, 'columns': 8, 'rows': 6, 'root': [256, 448], 'durationsMs': [50] * 48, 'durationMs': 2400, 'loop': False, 'previewRepeats': True, 'sheet': 'growth-sheet.png', 'animation': 'growth.webp', 'source': 'Sources/canopy-cels.png', 'additionalSources': ['Sources/key-drawings.png', 'Sources/closed-caps.png', 'Sources/adult-body-complete.png', 'Sources/adult-rear.png'], 'reference': {'start': 'Sources/start.png', 'end': 'Sources/end.png'}, 'method': 'drawn-canopy-cels-with-fixed-cradle-layers-and-step-growth', 'growthEventsMs': [400, 950], 'markersMs': {'lowerStart': 0, 'lowered': 350, 'growth1': 400, 'hold1': 500, 'growth2': 950, 'hold2': 1050, 'liftStart': 1450, 'liftEnd': 2050, 'completed': 2400}, 'states': states}
(ROOT / 'animation.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
drawings = {'canvas': [512, 512], 'root': [256, 448], 'canopyGrid': [4, 4], 'smallCanopyCells': [0, 1, 2, 3, 4, 5], 'adultCanopyCells': [6, 7, 8, 9, 10, 11, 12, 13, 14], 'smallWidth': 298, 'mediumWidth': 340, 'adultWidth': 380, 'smallTopY': [251, 285], 'adultTopY': [237, 149], 'frameSchedule': states}
(SOURCE / 'drawings.json').write_bytes((json.dumps(drawings) + '\r\n').encode('utf-8'))
print(json.dumps({'frames': len(frames), 'durationMs': 2400, 'output': str(ROOT), 'parts': {name: list(im.getbbox()) for name, im in parts.items()}}))
