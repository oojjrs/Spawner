from pathlib import Path
import sys
import json
import hashlib
import numpy as np
from PIL import Image, WebPImagePlugin, GifImagePlugin

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Sources'
PARTS = SOURCE / 'Parts'
SCRATCH = ROOT.parent / '$Trash' / 'SporeDrapedV2'
sys.path.insert(0, str(ROOT.parent / '$Trash' / 'deps'))
import cv2

SIZE = 640
FRAME_COUNT = 112
DURATION_MS = 5600
COLUMNS = 12
ROWS = 10
Y, X = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)


def read(path):
    return np.array(Image.open(path).convert('RGBA'))


def premul(a):
    p = a.astype(np.float32) / 255
    p[:, :, :3] *= p[:, :, 3:4]
    return p


def rgba(p):
    p = p.copy()
    p[:, :, :3] /= np.maximum(p[:, :, 3:4], 1e-8)
    p[p[:, :, 3] < .002] = 0
    return np.uint8(np.clip(p * 255 + .5, 0, 255))


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def pad(a):
    out = np.zeros((SIZE, SIZE, 4), np.uint8)
    out[128:640, 64:576] = a
    return out


def bounds(a):
    yy, xx = np.where(a[:, :, 3] > 60)
    left, right = int(xx.min()), int(xx.max())
    top, bottom, columns = [], [], []
    for x in range(left, right + 1):
        rows = np.where(a[:, x, 3] > 60)[0]
        if len(rows):
            columns.append(x)
            top.append(int(rows.min()))
            bottom.append(int(rows.max()))
    u = np.linspace(left, right, 257)
    upper = cv2.GaussianBlur(np.interp(u, columns, top).astype(np.float32)[None, :], (9, 1), 1.6)[0]
    lower = cv2.GaussianBlur(np.interp(u, columns, bottom).astype(np.float32)[None, :], (9, 1), 1.6)[0]
    return {'left': left, 'right': right, 'top': upper, 'bottom': lower, 'bbox': [left, int(yy.min()), right + 1, int(yy.max()) + 1]}


def register(a, box):
    b = bounds(a)['bbox']
    sx, sy = (box[2] - box[0]) / (b[2] - b[0]), (box[3] - box[1]) / (b[3] - b[1])
    matrix = np.float32([[sx, 0, box[0] - b[0] * sx], [0, sy, box[1] - b[1] * sy]])
    return rgba(cv2.warpAffine(premul(a), matrix, (SIZE, SIZE), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT))


def rig_native(name):
    native = pad(read(SOURCE / ('start.png' if name == 'small' else 'end.png')))
    body = read(PARTS / (name + '-body.png'))
    before = body.copy()
    n, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(body[:, :, 3] > 20), 8)
    main = 1 + int(np.argmax(stats[1:, 4]))
    area = cv2.dilate(np.uint8(labels == main), np.ones((5, 5), np.uint8)) > 0
    body[:, :, 3][~area] = 0
    body[body[:, :, 3] == 0] = 0
    secondary = read(PARTS / (name + '-secondary.png'))
    cap = native.copy()
    cap[:, :, 3][(body[:, :, 3] > 0) | (secondary[:, :, 3] > 0)] = 0
    points = [[105,338],[125,329],[155,322],[180,312],[202,310],[225,317],[250,322],[277,322],[302,316],[325,309],[348,316],[377,327],[407,337]] if name == 'small' else [[55,266],[80,265],[110,253],[142,238],[173,231],[198,237],[225,246],[252,250],[279,249],[306,242],[332,231],[351,235],[377,247],[406,251],[438,257]]
    points = np.float32(points) + np.float32([64,128])
    profile = np.interp(np.arange(SIZE), points[:, 0], points[:, 1]).astype(np.float32)
    profile = cv2.GaussianBlur(profile[None, :], (9,1), 1.5)[0]
    mask = np.clip(profile[None, :] - Y + .5, 0, 1)
    whole = premul(cap)
    front = whole * mask[:, :, None]
    back = (whole - front) / np.maximum(1 - front[:, :, 3:4], 1e-8)
    hidden = premul(read(PARTS / (name + '-gills.png')))
    protected = cv2.erode(np.uint8(body[:, :, 3] == 255), np.ones((3,3),np.uint8)) > 0
    back[protected] = hidden[protected]
    return native, body, rgba(front), rgba(back)


rigs = {}
atlas_path = SOURCE / 'painted-head-atlas.png'
if not atlas_path.exists():
    raise FileNotFoundError(str(atlas_path))
atlas = Image.open(atlas_path).convert('RGBA')
cell_width, cell_height = atlas.width // 4, atlas.height // 2
for row, name in enumerate(['small', 'adult']):
    native, body, head, gills = rig_native(name)
    closed = read(PARTS / (name + '-cape.png'))
    first_box = np.float32(bounds(head)['bbox'])
    last_box = np.float32(bounds(closed)['bbox'])
    cels = [{'q': 0, 'image': head}]
    for col, q in enumerate([.15, .35, .55, .8]):
        a = np.array(atlas.crop((col * cell_width, row * cell_height, (col + 1) * cell_width, (row + 1) * cell_height)))
        contours, hierarchy = cv2.findContours(np.uint8(a[:, :, 3] > 100), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask = np.zeros(a.shape[:2], np.uint8)
        cv2.drawContours(mask, [contours[int(np.argmax([cv2.contourArea(c) for c in contours]))]], -1, 1, cv2.FILLED)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3)))
        edge_alpha = cv2.GaussianBlur(mask.astype(np.float32), (3,3), .5)
        a[:, :, 3] = np.uint8(np.minimum(np.clip(a[:, :, 3].astype(np.float32) / 245, 0, 1), edge_alpha) * 255 + .5)
        a[a[:, :, 3] == 0] = 0
        a = register(a, first_box + (last_box - first_box) * q)
        cels.append({'q': q, 'image': a})
    cels.append({'q': 1, 'image': closed})
    for i, cel in enumerate(cels):
        cel['shape'] = bounds(cel['image'])
        cel['path'] = 'Sources/Parts/' + name + '-head-' + str(i) + '.png'
        Image.fromarray(cel['image']).save(ROOT / cel['path'])
    Image.fromarray(body).save(PARTS / (name + '-fixed-body.png'))
    Image.fromarray(gills).save(PARTS / (name + '-back-gills.png'))
    rigs[name] = {'body': body, 'cels': cels, 'native': native, 'gills': gills, 'secondary': read(PARTS / (name + '-secondary.png'))}


def pose(name, q, impact):
    rig = rigs[name]
    cels = rig['cels']
    source_index = 0 if q < .20 else 1 if q < .30 else 2 if q < .50 else 3 if q < .70 else 4 if q < .90 else 5
    cel = cels[source_index]
    if q == cel['q'] and impact == 0:
        head = cel['image']
    else:
        a = np.float32(cels[0]['shape']['bbox'])
        b = np.float32(cels[-1]['shape']['bbox'])
        box = a + (b - a) * q
        box[1] += impact
        box[3] += impact
        head = register(cel['image'], box)
    gs = 1 + .1 * q if q < .7 else 1.07 + (.8 - 1.07) * (q - .7) / .3
    gill_matrix = np.float32([[gs, 0, 320 * (1 - gs)], [0, 1, 55 * q]])
    gills = cv2.warpAffine(premul(rig['gills']), gill_matrix, (SIZE, SIZE), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    if q > 0:
        occupied = head[:, :, 3] > 30
        edge = np.max(np.where(occupied, Y, -1000), 0)[None, :]
        below = np.clip(Y - edge + 1, 0, 1)
        inside = np.clip(edge + 50 * (1 - q) - Y + 1, 0, 1)
        inside *= (edge > 0)
        gills *= (below * inside)[:, :, None]
        if q >= 1:
            gills[:] = 0
    sx, sy = 1 - .45 * q, 1 - .25 * q
    secondary_matrix = np.float32([[sx, 0, 454 * (1 - sx) - 12 * q], [0, sy, 478 * (1 - sy) + 30 * q]])
    secondary = cv2.warpAffine(premul(rig['secondary']), secondary_matrix, (SIZE, SIZE), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
    back = over(gills, secondary)
    return rgba(over(premul(head), over(premul(rig['body']), back)))


def smooth(q):
    q = min(1, max(0, q))
    return q * q * (3 - 2 * q)


def background(a):
    im = Image.fromarray(a)
    out = Image.new('RGB', (SIZE, SIZE), '#20282e')
    out.paste(im, (0, 0), im)
    return out


def animated(frames, path, durations, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': loop, 'lossless': True, 'method': 3, 'kmin': 1, 'kmax': 1}
    with path.open('wb') as f:
        WebPImagePlugin._save_all(frames[0], f, str(path))


study = []
for name in ['small', 'adult']:
    for q in [0, .2, .4, .6, .8, 1]:
        study.append(background(pose(name, q, 0)))
contact = Image.new('RGB', (SIZE * 6, SIZE * 2), '#20282e')
for i, im in enumerate(study):
    contact.paste(im, (i % 6 * SIZE, i // 6 * SIZE))
contact.save(SCRATCH / 'representative-contact.png')
if '--quickstudy' in sys.argv:
    sys.exit(0)
if '--full' not in sys.argv:
    cycle = []
    for name in ['small', 'adult']:
        cycle += [background(pose(name, smooth(i / 10), 0)) for i in range(11)]
        cycle += [cycle[-1]] * 4
        cycle += [background(pose(name, 1 - smooth(i / 14), 0)) for i in range(15)]
        cycle += [cycle[-1]] * 5
    animated(cycle, SCRATCH / 'representative.webp', [50] * len(cycle), 0)
    print('representative-complete')
    sys.exit(0)

frames, states = [], []
medium_body = rgba(cv2.warpAffine(premul(rigs['adult']['body']), np.float32([[.84, 0, 320 * .16], [0, .84, 576 * .16]]), (SIZE, SIZE), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT))
medium_head = read(PARTS / 'medium-cape.png')
Image.fromarray(medium_body).save(PARTS / 'medium-fixed-body.png')
for i in range(FRAME_COUNT):
    if i < 20:
        q, impact, stage, name = smooth(i / 20), 0, 0, 'small'
        phase = 'lower'
    elif i < 36:
        q, impact, stage, name = 1, 0, 0, 'small'
        phase = 'covered-hold'
    elif i < 55:
        q, impact, stage, name = 1, 3 if i == 36 else 1 if i == 37 else 0, 1, 'medium'
        phase = 'growth-1' if i < 39 else 'hold-1'
    elif i < 74:
        q, impact, stage, name = 1, 3 if i == 55 else 1 if i == 56 else 0, 2, 'adult'
        phase = 'growth-2' if i < 58 else 'hold-2'
    elif i < 102:
        q, impact, stage, name = 1 - smooth((i - 74) / 28), 0, 2, 'adult'
        phase = 'lift'
    else:
        q, impact, stage, name = 0, 0, 2, 'adult'
        phase = 'rest'
    if name == 'medium':
        head = rgba(cv2.warpAffine(premul(medium_head), np.float32([[1, 0, 0], [0, 1, impact]]), (SIZE, SIZE), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT))
        a = rgba(over(premul(head), premul(medium_body)))
    else:
        a = pose(name, q, impact)
    frames.append(Image.fromarray(a))
    states.append({'frame': i, 'timeMs': i * 50, 'stage': stage, 'phase': phase, 'closure': q, 'impactY': impact, 'headCel': 0 if name == 'medium' or q < .2 else 1 if q < .3 else 2 if q < .5 else 3 if q < .7 else 4 if q < .9 else 5})

folder = ROOT / 'Frames'
folder.mkdir(511, True, True)
sheet = Image.new('RGBA', (SIZE * COLUMNS, SIZE * ROWS))
previews = []
for i, fr in enumerate(frames):
    fr.save(folder / (str(i).zfill(3) + '.png'))
    sheet.paste(fr, (i % COLUMNS * SIZE, i // COLUMNS * SIZE))
    previews.append(background(np.array(fr)))
sheet.save(ROOT / 'growth-sheet.png')
animated(frames, ROOT / 'growth.webp', [50] * FRAME_COUNT, 1)
animated(previews, ROOT / 'preview.webp', [50] * FRAME_COUNT, 0)
contact = Image.new('RGB', (SIZE * 4, SIZE * 3), '#20282e')
for j, i in enumerate([0, 10, 20, 35, 36, 45, 55, 65, 74, 88, 101, 111]):
    contact.paste(previews[i], (j % 4 * SIZE, j // 4 * SIZE))
contact.save(ROOT / 'contact.png')
small_previews = [p.crop((0, 224, 640, 608)) for p in previews]
board = Image.new('RGB', (640 * COLUMNS, 384 * ROWS))
for i, p in enumerate(small_previews):
    board.paste(p, (i % COLUMNS * 640, i // COLUMNS * 384))
palette = board.quantize(256, Image.Quantize.MEDIANCUT)
gif = [p.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for p in small_previews]
gif[0].encoderinfo = {'append_images': gif[1:], 'duration': [50] * FRAME_COUNT, 'loop': 0, 'disposal': 2, 'optimize': False}
with (ROOT / 'preview.gif').open('wb') as f:
    GifImagePlugin._save_all(gif[0], f, str(ROOT / 'preview.gif'))
rig_data = {'canvas': [640, 640], 'root': [320, 576], 'drawOrder': ['secondary', 'gills', 'fixed-body', 'painted-head'], 'celThresholds': [.2, .3, .5, .7, .9], 'gills': {'dropY': 55, 'hangDepth': 50, 'closedWidth': .8}, 'secondary': {'pivot': [454,478], 'closedScale': [.55,.75], 'closedOffset': [-12,30]}, 'rigs': {}, 'timeline': states}
for name, rig in rigs.items():
    rig_data['rigs'][name] = {'body': 'Sources/Parts/' + name + '-fixed-body.png', 'gills': 'Sources/Parts/' + name + '-back-gills.png', 'secondary': 'Sources/Parts/' + name + '-secondary.png', 'cels': [{'q': cel['q'], 'path': cel['path'], 'shape': {k: v.tolist() if isinstance(v, np.ndarray) else v for k, v in cel['shape'].items()}} for cel in rig['cels']]}
rig_data['rigs']['medium'] = {'body': 'Sources/Parts/medium-fixed-body.png', 'cels': [{'q': 1, 'path': 'Sources/Parts/medium-cape.png'}]}
metadata = {'frameSize': [640, 640], 'frameCount': FRAME_COUNT, 'columns': COLUMNS, 'rows': ROWS, 'root': [320, 576], 'durationMs': DURATION_MS, 'durationsMs': [50] * FRAME_COUNT, 'loop': False, 'sheet': 'growth-sheet.png', 'animation': 'growth.webp', 'rig': 'rig.json', 'growthEventsMs': [1800, 2750], 'markersMs': {'lowerStart': 0, 'covered': 1000, 'growth1': 1800, 'hold1': 1950, 'growth2': 2750, 'hold2': 2900, 'liftStart': 3700, 'liftEnd': 5100, 'completed': 5600}, 'holdsMs': {'covered': 800, 'afterGrowth1': 800, 'afterGrowth2': 800}, 'method': 'painted-front-cels-with-affine-registration-and-layered-native-body', 'keyframeVersion': 'DrapedV1', 'keyframesApproved': True, 'keyframeHashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE / 'Keyframes').glob('*.png')}}
for name, obj in [('rig.json', rig_data), ('animation.json', metadata)]:
    (ROOT / name).write_bytes((json.dumps(obj) + '\r\n').encode('utf-8'))
print(json.dumps({'frames': FRAME_COUNT, 'durationMs': DURATION_MS, 'output': str(ROOT)}))
