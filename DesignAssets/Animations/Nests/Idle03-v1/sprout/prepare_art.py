from pathlib import Path
from riglib import *

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'Sources'


def cleaned(source):
    count, ids, stats, centers = cv2.connectedComponentsWithStats(np.uint8(source[:, :, 3] > .1), 8)
    largest = 1 + int(np.argmax(stats[1:, 4]))
    keep = cv2.dilate(np.uint8(ids == largest), np.ones((5, 5), np.uint8))
    return source * keep[:, :, None]


def ends(source, center_top):
    yy, xx = np.where(source[:, :, 3] > .4)
    top, bottom = int(yy.min()), int(yy.max())
    a = (float(np.mean(xx[yy > bottom - 3])), float(np.mean(yy[yy > bottom - 3])))
    b = (float((xx.min() + xx.max()) / 2), float(top)) if center_top else (float(np.mean(xx[yy < top + 3])), float(np.mean(yy[yy < top + 3])))
    return a, b


def place_filtered(source, a, b, c, d):
    scale = np.linalg.norm(np.array(d) - c) / np.linalg.norm(np.array(b) - a)
    factor = min(1.0, scale * 2)
    height, width = source.shape[:2]
    size = (max(1, round(width * factor)), max(1, round(height * factor)))
    reduced = cv2.resize(source, size, None, 0, 0, cv2.INTER_AREA)
    ratios = np.array([size[0] / width, size[1] / height])
    return place_two(reduced, np.array(a) * ratios, np.array(b) * ratios, c, d)


def build_parts():
    reference = read(SOURCE / 'start.png')
    original = {i: read(SOURCE / 'Parts' / ('old-' + str(i) + '.png')) for i in range(11)}
    layers = {}
    registration = {}
    for index, name in [(4, 'cup-left'), (5, 'cup-right')]:
        source = cleaned(read(SOURCE / ('paint-' + name + '.png')))
        a, b = ends(source, False)
        unused, d = ends(original[index], False)
        c = (255, 365) if index == 4 else (257, 365)
        layers[index] = place_filtered(source, a, b, c, d)
        registration[name] = {'source': 'Sources/paint-' + name + '.png', 'sourceBase': a, 'sourceTop': b, 'bindBase': c, 'bindTop': d}
    source = cleaned(read(SOURCE / 'paint-sprout.png'))
    a, b = ends(source, True)
    layers[11] = place_filtered(source, a, b, (260, 247), (261, 184))
    registration['sprout'] = {'source': 'Sources/paint-sprout.png', 'sourceBase': a, 'sourceTop': b, 'bindBase': [260, 247], 'bindTop': [261, 184]}
    background = Image.open(SOURCE / 'hidden-backplate.png').convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS)
    background = np.array(background).astype(np.float32) / 255
    background[:, :, :3] *= background[:, :, 3:4]
    yy, xx = np.where((background[:, :, 3] > .8) & (X > 205) & (X < 307))
    bottom = int(yy.max())
    center = float(xx[yy == bottom].mean())
    background = shift(background, (260 - center, 446 - bottom))
    tip = int(np.where((background[:, :, 3] > .5) & (X > 155) & (X < 220) & (Y < 200))[0].min())
    delta = 135 - tip
    source_y = Y.copy()
    for iteration in range(8):
        q = np.clip((245 - source_y) / 100, 0, 1)
        source_y = Y - delta * q * q * (3 - 2 * q)
    background = cv2.remap(background, X, source_y.astype(np.float32), cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
    pixels = np.array(rgba(background))
    hsv = cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2HSV)
    domain = polygon([(126, 325), (140, 210), (177, 126), (201, 126), (260, 230), (319, 126), (346, 126), (380, 213), (392, 325), (314, 367), (207, 367)])
    pale = ((hsv[:, :, 0] > 30) & (hsv[:, :, 0] < 105) & (hsv[:, :, 1] < 195) & (hsv[:, :, 2] > 80)) | ((hsv[:, :, 1] < 110) & (hsv[:, :, 2] > 95))
    gold = (X > 180) & (X < 341) & (Y > 230) & (Y < 365) & (hsv[:, :, 0] < 38) & (hsv[:, :, 1] > 75) & (hsv[:, :, 2] > 80)
    interior = (pale | gold) & domain & (pixels[:, :, 3] > 180)
    count, ids, stats, centers = cv2.connectedComponentsWithStats(np.uint8(interior), 8)
    keep = np.zeros((512, 512), np.uint8)
    for i in range(1, count):
        if stats[i, 4] > 600:
            keep[ids == i] = 1
    keep = cv2.dilate(keep, np.ones((9, 9), np.uint8))
    layers[12] = background * keep[:, :, None]
    lower_y = np.where(Y > 245, 245 + (Y - 245) / .84, Y).astype(np.float32)
    layers[12] = cv2.remap(layers[12], X, lower_y, cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
    foreground = np.zeros_like(reference)
    for i in [0, 6, 7, 8, 9, 10]:
        foreground = over(original[i], foreground)
    layers[13] = foreground
    lining = Image.open(SOURCE / 'inner-lining.png').convert('RGBA').resize((512, 512), Image.Resampling.LANCZOS)
    lining = np.array(lining).astype(np.float32) / 255
    lining[:, :, :3] *= lining[:, :, 3:4]
    yy, xx = np.where((lining[:, :, 3] > .8) & (X > 205) & (X < 307))
    bottom = int(yy.max())
    center = float(xx[yy == bottom].mean())
    lining = shift(lining, (260 - center, 446 - bottom))
    lining_mask = reference[:, :, 3] * (Y >= 250) * (foreground[:, :, 3] < .001)
    layers[14] = lining * lining_mask[:, :, None]
    names = {4: 'cup-left', 5: 'cup-right', 11: 'sprout', 12: 'rear-leaves-and-bean', 13: 'fixed-frame-and-ground', 14: 'inner-lining'}
    folder = ROOT / 'Parts'
    folder.mkdir(511, True, True)
    for i, image in layers.items():
        rgba(image).save(folder / (names[i] + '.png'))
    save_json(ROOT / 'registration.json', registration)
    return layers, names


if __name__ == '__main__':
    layers, names = build_parts()
    value = np.zeros((512, 512, 4), np.float32)
    for i in [14, 12, 11, 4, 5, 13]:
        value = over(layers[i], value)
    rgba(value).save(ROOT / 'assembled-source.png')
