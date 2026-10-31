from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

destination = Path(__file__).resolve().parent
settings = {
    'bundle-snail': {
        'raw': 'exec-47cf2432-a805-4ee3-80f2-8e16615aa802.png',
        'bodyBox': [70, 390, 626], 'cargoCut': 290, 'cavitySeed': [246, 448], 'cavityRight': 337,
        'cavityPolygon': [[215, 382], [234, 384], [254, 397], [274, 419], [291, 447], [307, 478], [325, 513], [337, 537], [337, 627], [235, 627], [235, 503], [222, 490], [211, 470], [203, 447], [199, 424], [201, 405], [207, 390]],
        'eyePolygons': [[[25, 299], [126, 299], [139, 379], [145, 441], [85, 445], [57, 398], [25, 385]], [[128, 300], [225, 300], [229, 379], [221, 429], [165, 429], [144, 382]]],
        'eyeCenters': [[77, 347], [177, 351]], 'eyeRadii': [47, 44], 'eyeRoots': [[133, 475], [197, 458]],
        'anchorX': 418, 'motionMs': 1680, 'eyeEndMs': 320, 'bodyStartMs': 220, 'bodyEndMs': 1480, 'settleStartMs': 850, 'settleEndMs': 1640,
    },
    'old-garden-snail': {
        'raw': 'exec-c5859566-37d1-4878-8aaa-97e190426a10.png',
        'bodyBox': [35, 435, 571], 'cargoCut': 310, 'cavitySeed': [177, 514], 'cavityRight': 276,
        'cavityPolygon': [[161, 466], [180, 467], [201, 478], [220, 497], [239, 525], [258, 556], [277, 583], [277, 627], [171, 627], [171, 560], [155, 548], [144, 530], [138, 509], [139, 490], [147, 474]],
        'eyePolygons': [[[6, 351], [96, 351], [112, 429], [130, 491], [69, 498], [36, 452], [6, 442]], [[94, 354], [174, 354], [183, 432], [188, 481], [126, 481], [112, 441]]],
        'eyeCenters': [[53, 399], [132, 401]], 'eyeRadii': [43, 41], 'eyeRoots': [[107, 510], [167, 490]],
        'anchorX': 370, 'motionMs': 1920, 'eyeEndMs': 360, 'bodyStartMs': 260, 'bodyEndMs': 1700, 'settleStartMs': 960, 'settleEndMs': 1880,
    },
}

def cleaned(image):
    pixels = np.array(image.convert('RGBA'))
    pixels[pixels[:, :, 3] <= 8] = 0
    return Image.fromarray(pixels)

def opaque_box(image):
    return Image.fromarray(np.uint8(np.array(image)[:, :, 3] > 128) * 255).getbbox()

def masked(image, mask):
    pixels = np.array(image)
    pixels[:, :, 3] = np.uint8(np.rint(pixels[:, :, 3].astype(float) * np.array(mask) / 255))
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)

def cavity_mask(polygon, shift):
    mask = Image.new('L', (627 * 4, 627 * 4))
    points = [(round((x + shift[0]) * 4), round((y + shift[1]) * 4)) for x, y in polygon]
    ImageDraw.Draw(mask).polygon(points, 255)
    return mask.resize((627, 627), Image.Resampling.LANCZOS)

for name, config in settings.items():
    folder = destination / name
    source = folder / 'Source'
    parts = source / 'Parts'
    parts.mkdir(0o777, True, True)
    neutral = cleaned(Image.open(source / 'approved-neutral.png'))
    empty = cleaned(Image.open(source / 'approved-empty.png'))
    body_raw = cleaned(Image.open(source / 'body-underpaint-generated.png'))
    neutral.save(source / 'approved-neutral.png')
    empty.save(source / 'approved-empty.png')
    alpha_neutral = np.array(neutral)[:, :, 3]
    alpha_empty = np.array(empty)[:, :, 3]
    rows, cols = np.indices(alpha_neutral.shape)
    cargo_neutral = (alpha_neutral > 128) & (rows < config['cargoCut'])
    cargo_empty = (alpha_empty > 128) & (rows < config['cargoCut'])
    x_shift = float(cols[cargo_neutral].mean() - cols[cargo_empty].mean())
    y_shift = float(rows[cargo_neutral].min() - rows[cargo_empty].min())
    shell = empty.transform((627, 627), Image.Transform.AFFINE, (1, 0, -x_shift, 0, 1, -y_shift), Image.Resampling.BICUBIC)
    cavity = cavity_mask(config['cavityPolygon'], [x_shift, y_shift])
    if np.count_nonzero(np.array(cavity)) < 1000:
        raise RuntimeError('Cavity extraction did not find the approved opening: ' + name)
    shell_back = masked(shell, cavity)
    shell_front = masked(shell, Image.fromarray(255 - np.array(cavity)))
    shell.save(parts / 'shell-whole.png')
    shell_back.save(parts / 'shell-interior.png')
    shell_front.save(parts / 'shell-rim-and-cargo.png')
    cavity.save(parts / 'cavity-mask.png')
    red, green, blue, alpha = [np.array(neutral)[:, :, i].astype(float) for i in range(4)]
    white = (alpha > 128) & (red > 90) & (green >= red * 0.97) & (blue > red * 0.77) & (rows > 430)
    ground = int(rows[white].max())
    left, top, right = config['bodyBox']
    bounds = opaque_box(body_raw)
    bounds = (max(0, bounds[0] - 2), max(0, bounds[1] - 2), min(body_raw.width, bounds[2] + 2), min(body_raw.height, bounds[3] + 2))
    texture = body_raw.crop(bounds).resize((right - left, ground - top + 1), Image.Resampling.LANCZOS)
    body = Image.new('RGBA', (627, 627))
    body.alpha_composite(texture, (left, top))
    preserve = white & (rows >= top + 65)
    preserve_mask = Image.fromarray(np.uint8(preserve) * 255).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(3))
    body = Image.composite(neutral, body, preserve_mask)
    body.save(parts / 'body-complete.png')
    eye_records = []
    for index, polygon in enumerate(config['eyePolygons']):
        outline = Image.new('L', (627, 627))
        ImageDraw.Draw(outline).polygon([tuple(p) for p in polygon], 255)
        cx, cy = config['eyeCenters'][index]
        radius = config['eyeRadii'][index]
        ball = Image.new('L', (627, 627))
        ImageDraw.Draw(ball).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), 255)
        whole = masked(neutral, outline)
        bulb = masked(whole, ball)
        stem_mask = Image.new('L', (627, 627), 255)
        inset = radius - 5
        ImageDraw.Draw(stem_mask).ellipse((cx - inset, cy - inset, cx + inset, cy + inset), 0)
        stem = masked(whole, stem_mask)
        bulb.save(parts / ('eye-' + str(index) + '-bulb.png'))
        stem.save(parts / ('eye-' + str(index) + '-stalk.png'))
        eye_records.append({'bulb': 'eye-' + str(index) + '-bulb.png', 'stalk': 'eye-' + str(index) + '-stalk.png', 'tip': [cx, cy], 'root': config['eyeRoots'][index]})
    reference = cleaned(Image.open(source / 'reference.png'))
    key_box = opaque_box(neutral)
    ref_box = opaque_box(reference)
    scale = (ref_box[2] - ref_box[0]) / (key_box[2] - key_box[0])
    translate = [(ref_box[0] + ref_box[2]) / 2 - scale * (key_box[0] + key_box[2]) / 2, 448 - scale * ground]
    rig = {
        'name': name, 'canvas': [627, 627], 'outputCanvas': [512, 512], 'pivot': [256, 448],
        'groundY': ground, 'registration': {'scale': scale, 'translation': translate},
        'shellSourceTranslation': [x_shift, y_shift], 'shellDropY': ground - (opaque_box(shell)[3] - 1),
        'cavityPolygon': config['cavityPolygon'],
        'body': {'image': 'body-complete.png', 'anchor': [config['anchorX'], ground], 'scaleY': 1},
        'shell': {'back': 'shell-interior.png', 'front': 'shell-rim-and-cargo.png', 'scale': [1, 1], 'rotation': 0},
        'eyes': eye_records,
        'timeline': {key: config[key] for key in ['motionMs', 'eyeEndMs', 'bodyStartMs', 'bodyEndMs', 'settleStartMs', 'settleEndMs']},
        'bones': ['root', 'body', 'shell', 'eye-0-stalk', 'eye-0-bulb', 'eye-1-stalk', 'eye-1-bulb'],
        'drawOrder': ['shell-interior', 'eye-stalks', 'eye-bulbs', 'body', 'shell-rim-and-cargo'],
        'poseOpacityAnimation': False,
    }
    (source / 'rig.json').write_bytes((json.dumps(rig, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf8'))
    print(json.dumps({'name': name, 'groundY': ground, 'shellDropY': rig['shellDropY'], 'scale': scale, 'shellShift': [x_shift, y_shift]}))

