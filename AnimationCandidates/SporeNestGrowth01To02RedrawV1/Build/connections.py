from pathlib import Path
import sys
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / '$Trash' / 'deps'))
import cv2

GENERATED = ROOT / 'Sources' / 'fresh-connections.png'
NAMES = ['small-upright', 'small-halfclosed', 'small-closed-reference', 'adult-closed-reference', 'adult-halflift', 'adult-upright']
SIZE = 640
GROUND = 576


def place(a):
    h, w = a.shape[:2]
    frame = np.zeros((SIZE, SIZE, 4), np.uint8)
    left, top = (SIZE - w) // 2, GROUND - h + 1
    frame[top:top + h, left:left + w] = a
    return frame


def bg(a, color):
    image = Image.fromarray(a)
    base = Image.new('RGB', image.size, color)
    base.paste(image, (0, 0), image)
    return base


def main():
    source = ROOT / 'Sources'
    a = np.array(Image.open(GENERATED).convert('RGBA'))
    a[a[:, :, 3] < 20] = 0
    Image.fromarray(a).save(source / 'connection-atlas.png')
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(a[:, :, 3] > 0), 8)
    order = [v[2] for v in sorted((int(centers[k, 1] > 500), centers[k, 0], k) for k in range(1, count))]
    scales = [260 / stats[order[2], 2], 394 / stats[order[3], 2]]
    cels, records = {}, []
    for j, (name, k) in enumerate(zip(NAMES, order)):
        x, y, w, h, area = [int(v) for v in stats[k]]
        crop = a[y:y + h, x:x + w].copy()
        crop[labels[y:y + h, x:x + w] != k] = 0
        factor = float(scales[j // 3])
        width, height = int(round(w * factor)), int(round(h * factor))
        p = crop.astype(np.float32) / 255
        p[:, :, :3] *= p[:, :, 3:4]
        p = cv2.resize(p, (width, height), None, 0, 0, cv2.INTER_AREA)
        p[:, :, :3] /= np.maximum(p[:, :, 3:4], 1e-8)
        out = np.uint8(np.clip(p * 255 + .5, 0, 255))
        out[out[:, :, 3] < 20] = 0
        frame = place(out)
        cels[name] = frame
        if '-reference' not in name:
            Image.fromarray(frame).save(source / (name + '.png'))
        records.append({'id': name, 'sourceRect': [x, y, w, h], 'rowScale': factor, 'dimensions': [width, height], 'usedAsSprite': '-reference' not in name})
    small = np.array(Image.open(source / 'small-rest.png'))
    adult = np.array(Image.open(source / 'adult-rest.png'))
    poses = [cels['small-upright'], cels['small-halfclosed'], small, adult, cels['adult-halflift'], cels['adult-upright']]
    for color, suffix in [('#eeeeee', 'light'), ('#20282e', 'dark')]:
        board = Image.new('RGB', (SIZE * 3, 368 * 2), color)
        for i, pose in enumerate(poses):
            board.paste(bg(pose, color).crop((0, 240, 640, 608)), (i % 3 * SIZE, i // 3 * 368))
        board.save(ROOT / ('connection-keys-' + suffix + '.png'))
    payload = {'tool': 'built-in image_gen', 'method': 'freshly-drawn-connection-poses', 'status': 'awaiting-connection-keyframe-confirmation', 'generatedSource': GENERATED.name, 'cleanAtlas': 'Sources/connection-atlas.png', 'alphaExportFloor': 20, 'paintTransform': 'none', 'registration': 'one-uniform-scale-per-stage-based-on-closed-reference; integer-center-ground-translation', 'closedPosesUsed': ['Sources/small-rest.png', 'Sources/adult-rest.png'], 'newKeys': ['Sources/small-upright.png', 'Sources/small-halfclosed.png', 'Sources/adult-halflift.png', 'Sources/adult-upright.png'], 'registrations': records}
    (ROOT / 'connections.json').write_bytes((json.dumps(payload) + '\r\n').encode('utf-8'))
    scratch = ROOT.parent / '$Trash' / 'SporeRedrawV1'
    captures = sorted(scratch.glob('growth-[0-9][0-9].png'))
    contact = Image.new('RGB', (SIZE * 5, 328 * 3), '#20282e')
    for i, file in enumerate(captures):
        contact.paste(Image.open(file).crop((0, 280, 640, 608)), (i % 5 * SIZE, i // 5 * 328))
    contact.save(scratch / 'growth-browser-contact.png')
    print(json.dumps({'connectionSprites': count - 1, 'newKeys': 4, 'rowScales': [float(s) for s in scales], 'capturedFrames': len(captures)}))


main()
