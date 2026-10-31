from pathlib import Path
import sys
from PIL import ImageFont, WebPImagePlugin, PngImagePlugin
from riglib import *
from prepare_art import build_parts

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'Sources'
PARTS = ROOT / 'Parts'
FRAMES = ROOT / 'Frames'
for folder in [PARTS, FRAMES]:
    folder.mkdir(511, True, True)


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def breath(t):
    t = t % 1
    return math.sin(math.pi * t) ** 2 * (.5 + .8 * math.sin(2 * math.pi * t))


def grid(source, step):
    yy, xx = np.where(source[:, :, 3] > .001)
    left, right = max(0, int(xx.min()) - 4), min(511, int(xx.max()) + 4)
    top, bottom = max(0, int(yy.min()) - 4), min(511, int(yy.max()) + 4)
    xs = np.linspace(left, right, math.ceil((right - left) / step) + 1)
    ys = np.linspace(top, bottom, math.ceil((bottom - top) / step) + 1)
    vertices = np.array([(x, y) for y in ys for x in xs], np.float32)
    triangles = []
    for row in range(len(ys) - 1):
        for col in range(len(xs) - 1):
            k = row * len(xs) + col
            triangles.extend([(k, k + 1, k + len(xs)), (k + 1, k + len(xs) + 1, k + len(xs))])
    return vertices, np.array(triangles, int)


def chain_weights(vertices, points, names):
    points = np.array(points, float)
    distances = np.full(len(vertices), np.inf)
    coordinate = np.zeros(len(vertices))
    for index in range(len(points) - 1):
        a, b = points[index:index + 2]
        direction = b - a
        amount = np.clip(((vertices - a) @ direction) / (direction @ direction), 0, 1)
        closest = a + amount[:, None] * direction
        distance = np.linalg.norm(vertices - closest, None, 1)
        use = distance < distances
        coordinate[use] = index + smooth(amount[use])
        distances[use] = distance[use]
    return {name: np.clip(1 - np.abs(coordinate - index), 0, 1) for index, name in enumerate(names)}


layers, names = build_parts()

skeleton = Skeleton()
skeleton.add('root', None, (256, 448), 0, 0)
meshes = {}
for index, side in [(4, 'left'), (5, 'right')]:
    points = [(255, 365), (184, 283), (180, 223)] if side == 'left' else [(257, 365), (336, 283), (340, 223)]
    bone_names = [side + '-cup-' + str(i) for i in range(3)]
    for k, point in enumerate(points):
        other = points[min(k + 1, 2)]
        vector = np.array(other) - point
        angle = math.degrees(math.atan2(vector[1], vector[0])) if k < 2 else 0
        skeleton.add(bone_names[k], 'root' if k == 0 else bone_names[k - 1], point, angle, float(np.linalg.norm(vector)))
    vertices, triangles = grid(layers[index], 7)
    meshes[index] = (vertices, triangles, chain_weights(vertices, points, bone_names))
sprout_bones = [('stem-base', 'root', (260, 247), (260, 220)), ('stem-tip', 'stem-base', (260, 220), (260, 204)), ('sprout-left', 'stem-tip', (257, 219), (235, 204)), ('sprout-left-tip', 'sprout-left', (235, 204), (219, 192)), ('sprout-right', 'stem-tip', (264, 219), (286, 203)), ('sprout-right-tip', 'sprout-right', (286, 203), (303, 190))]
for name, parent, a, b in sprout_bones:
    vector = np.array(b) - a
    skeleton.add(name, parent, a, math.degrees(math.atan2(vector[1], vector[0])), float(np.linalg.norm(vector)))
vertices, triangles = grid(layers[11], 5)
upper = smooth((247 - vertices[:, 1]) / 25)
branch = smooth((225 - vertices[:, 1]) / 16)
left = smooth((264 - vertices[:, 0]) / 8)
tip_left = smooth((252 - vertices[:, 0]) / 25)
tip_right = smooth((vertices[:, 0] - 269) / 25)
weights = {'stem-base': 1 - upper, 'stem-tip': upper * (1 - branch), 'sprout-left': upper * branch * left * (1 - tip_left), 'sprout-left-tip': upper * branch * left * tip_left, 'sprout-right': upper * branch * (1 - left) * (1 - tip_right), 'sprout-right-tip': upper * branch * (1 - left) * tip_right}
meshes[11] = (vertices, triangles, weights)
timeline = []


def sample_mesh(source, vertices, destination, triangles):
    map_x = np.full((512, 512), -100, np.float32)
    map_y = map_x.copy()
    for tri in triangles:
        a, b = vertices[tri], destination[tri]
        x0 = max(0, int(np.floor(b[:, 0].min())))
        x1 = min(511, int(np.ceil(b[:, 0].max())))
        y0 = max(0, int(np.floor(b[:, 1].min())))
        y1 = min(511, int(np.ceil(b[:, 1].max())))
        if x1 < x0 or y1 < y0:
            continue
        matrix = np.vstack([b.T, np.ones(3)])
        weights = np.linalg.inv(matrix) @ np.vstack([X[y0:y1 + 1, x0:x1 + 1].ravel(), Y[y0:y1 + 1, x0:x1 + 1].ravel(), np.ones((y1 - y0 + 1) * (x1 - x0 + 1))])
        shape = (y1 - y0 + 1, x1 - x0 + 1)
        inside = np.all(weights >= -.0001, 0).reshape(shape)
        uv = (a.T @ weights).reshape(2, *shape)
        map_x[y0:y1 + 1, x0:x1 + 1][inside] = uv[0][inside]
        map_y[y0:y1 + 1, x0:x1 + 1][inside] = uv[1][inside]
    return cv2.remap(source, map_x, map_y, cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def shifted_breath(t, delay):
    return breath(t - delay) - breath(-delay)


def angles(t):
    value = {}
    for side, sign, delay in [('left', -1, 0), ('right', 1, .018)]:
        value[side + '-cup-0'] = sign * 3.5 * shifted_breath(t, delay)
        value[side + '-cup-1'] = sign * 4.5 * shifted_breath(t, delay + .018)
        value[side + '-cup-2'] = -sign * 1.2 * shifted_breath(t, delay + .040)
    value['stem-base'] = 1.1 * shifted_breath(t, .035)
    value['stem-tip'] = 3.1 * shifted_breath(t, .060)
    value['sprout-left'] = -3.0 * shifted_breath(t, .075)
    value['sprout-left-tip'] = 2.5 * shifted_breath(t, .105)
    value['sprout-right'] = 3.5 * shifted_breath(t, .090)
    value['sprout-right-tip'] = -2.8 * shifted_breath(t, .120)
    return value


def render(t):
    skeleton.pose(angles(t), {})
    posed_layers = dict(layers)
    for index, data in meshes.items():
        vertices, triangles, weights = data
        posed = skeleton.skin(vertices, weights)
        posed_layers[index] = layers[index].copy() if np.max(np.abs(posed - vertices)) < 1e-7 else sample_mesh(layers[index], vertices, posed, triangles)
    shadow = np.maximum(posed_layers[4][:, :, 3], posed_layers[5][:, :, 3])
    shadow = np.maximum(shadow, posed_layers[11][:, :, 3] * .3)
    shadow = cv2.GaussianBlur(shadow, (0, 0), 1.15)
    shadow = cv2.warpAffine(shadow, np.float32([[1, 0, 1], [0, 1, 2]]), (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT, 0)
    for background_index in [14, 12]:
        posed_layers[background_index] = posed_layers[background_index].copy()
        posed_layers[background_index][:, :, :3] *= 1 - shadow[:, :, None] * .12
    value = np.zeros((512, 512, 4), np.float32)
    for index in [14, 12, 11, 4, 5, 13]:
        value = over(posed_layers[index], value)
    return rgba(value)


def save_animation(images, path, durations):
    images[0].encoderinfo = {'append_images': images[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4}
    with path.open('wb') as output:
        WebPImagePlugin._save_all(images[0], output, str(path))


def export():
    draft = '--draft' in sys.argv
    indexes = list(range(0, 120, 15)) if draft else list(range(120))
    images = []
    board = Image.new('RGB', (2048, 1024), '#203028')
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
    render(0).save(ROOT / 'keypose.png')
    for index in indexes:
        t = index / 120
        image = render(t)
        images.append(image)
        timeline.append({'frame': index, 'seconds': index / 30, 'angles': angles(t)})
        image.save(FRAMES / ('frame-' + str(index).zfill(3) + '.png'))
        if index % 15 == 0:
            slot = index // 15
            x, y = slot % 4 * 512, slot // 4 * 512
            board.paste(image, (x, y), image)
            ImageDraw.Draw(board).text((x + 18, y + 18), str(round(index / 30, 2)) + 's', '#eef7dd', font)
        print('render', index)
    board.save(ROOT / 'rig-samples.png')
    durations = [500] * 8 if draft else [33, 34, 33] * 40
    save_animation(images, ROOT / ('draft.webp' if draft else 'idle.webp'), durations)
    if not draft:
        previews = []
        for image in images:
            background = Image.new('RGBA', (512, 512), '#203028')
            previews.append(Image.alpha_composite(background, image).convert('RGB'))
        save_animation(previews, ROOT / 'preview.webp', durations)
        small = [image.resize((128, 128), Image.Resampling.LANCZOS) for image in previews]
        save_animation(small, ROOT / 'preview-128.webp', durations)
        previews[0].encoderinfo = {'append_images': previews[1:], 'duration': durations, 'loop': 0, 'disposal': 0, 'blend': 0, 'compress_level': 7}
        with (ROOT / 'preview.png').open('wb') as output:
            PngImagePlugin._save_all(previews[0], output, str(ROOT / 'preview.png'))
        sheet = Image.new('RGBA', (4096, 7680))
        for index, image in enumerate(images):
            sheet.paste(image, (index % 8 * 512, index // 8 * 512))
        sheet.save(ROOT / 'idle-sheet.png')
        sheet.encoderinfo = {'lossless': True, 'quality': 100, 'method': 4, 'exact': True}
        with (ROOT / 'idle-sheet.webp').open('wb') as output:
            WebPImagePlugin._save(sheet, output, str(ROOT / 'idle-sheet.webp'))
        save_json(ROOT / 'animation.json', {'frameSize': [512, 512], 'frameCount': 120, 'columns': 8, 'rows': 15, 'durationsMs': durations, 'periodMs': 4000, 'pivot': [256, 448], 'rootMotion': False, 'loop': True, 'image': 'idle-sheet.webp', 'sourceImage': 'idle-sheet.png', 'animatedImage': 'idle.webp', 'sourceRig': 'rig.json', 'sourceKeyposes': ['keypose.png']})
    data = {'format': 'local-2d-weighted-skeletal-rig-v1', 'frameSize': [512, 512], 'pivot': [256, 448], 'rootMotion': False, 'sourceKeyposes': ['keypose.png'], 'additionalDrawnKeyposes': [], 'hiddenSurfaceSources': ['Sources/hidden-backplate.png', 'Sources/inner-lining.png'], 'bones': skeleton.bones, 'parts': {names[i]: {'image': 'Parts/' + names[i] + '.png', 'fixed': i not in meshes} for i in layers}, 'drawOrder': [names[i] for i in [14, 12, 11, 4, 5, 13]], 'meshes': {names[i]: {'vertices': mesh[0].tolist(), 'triangles': mesh[1].tolist(), 'weights': {name: amount.tolist() for name, amount in mesh[2].items()}} for i, mesh in meshes.items()}, 'timeline': timeline, 'periodSeconds': 4, 'loop': True, 'sourceParts': 'Parts', 'designAuthority': 'Sources/start.png', 'redrawnPartSources': ['Sources/paint-cup-left.png', 'Sources/paint-cup-right.png', 'Sources/paint-sprout.png'], 'spineCompatibilityVerified': False}
    save_json(ROOT / 'rig.json', data)
    print('exported', ROOT)


if __name__ == '__main__':
    export()
