from pathlib import Path
import sys
import math
import json
import shutil

VENDOR = Path('H:/Spawner/$Trash/NestGrowth03To04-v1/vendor')
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'Sources'
PARTS = ROOT / 'Parts'
SCRATCH = Path('H:/Spawner/$Trash/SproutNestIdle04-v2')
RENDER_SCALE = 2
RENDER_SIZE = 512 * RENDER_SCALE
Y, X = np.mgrid[:RENDER_SIZE, :RENDER_SIZE].astype(np.float32) / RENDER_SCALE


def save_json(path, value):
    path.write_bytes((json.dumps(value).replace('\n', '\r\n') + '\r\n').encode('utf-8'))


def read(path):
    pixels = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def rgba(pixels):
    if pixels.shape[:2] == (RENDER_SIZE, RENDER_SIZE):
        pixels = cv2.resize(pixels, (512, 512), None, 0, 0, cv2.INTER_AREA)
    pixels = np.clip(pixels, 0, 1)
    pixels[pixels[:, :, 3] < 2 / 255] = 0
    rgb = pixels[:, :, :3] / np.maximum(pixels[:, :, 3:4], 1e-7)
    result = np.uint8(np.clip(np.concatenate([rgb, pixels[:, :, 3:4]], 2) * 255 + .5, 0, 255))
    result[result[:, :, 3] == 0, :3] = 0
    return Image.fromarray(result)


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * value * (10 + value * (-15 + 6 * value))


def polygon(points):
    canvas = Image.new('L', (2048, 2048))
    ImageDraw.Draw(canvas).polygon([tuple(np.array(p) * 4) for p in points], 255)
    return np.array(canvas.resize((512, 512), Image.Resampling.LANCZOS)).astype(np.float32) / 255


def expand(mask, amount):
    radius = int(math.ceil(amount))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    return cv2.dilate(np.float32(mask), kernel)


def segment(image):
    pixels = np.array(rgba(image))
    rgb = pixels[:, :, :3]
    ink = (rgb.max(2) < 112) & (rgb[:, :, 1] < 105)
    inside = (pixels[:, :, 3] > 220) & ~cv2.dilate(np.uint8(ink), np.ones((2, 2), np.uint8)).astype(bool)
    return cv2.connectedComponentsWithStats(np.uint8(inside), 8)


def region(labels, index, amount):
    inside = np.uint8(labels == index)
    distance = cv2.distanceTransform(1 - inside, cv2.DIST_L2, 5)
    return np.clip(amount + .5 - distance, 0, 1)


def bounded(image, mask):
    return image * mask[:, :, None]


def mat(point, angle):
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return np.array([[c, -s, point[0]], [s, c, point[1]], [0, 0, 1]], float)


def transform(matrix, points):
    return (matrix @ np.c_[points, np.ones(len(points))].T).T[:, :2]


def rigid(image, source_pivot, target_pivot, angle):
    matrix = mat(target_pivot, angle) @ mat(-np.array(source_pivot), 0)
    scale_matrix = np.diag([RENDER_SCALE, RENDER_SCALE, 1])
    matrix = scale_matrix @ matrix @ np.linalg.inv(scale_matrix)
    return cv2.warpAffine(image, matrix[:2].astype(np.float32), (RENDER_SIZE, RENDER_SIZE), None, cv2.INTER_CUBIC, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def angle_between(a, b):
    return math.degrees(math.atan2(b[1], b[0]) - math.atan2(a[1], a[0]))


class Skeleton:
    def __init__(self):
        self.bones = []
        self.bind = {}
        self.current = {}

    def add(self, name, parent, point, angle, length):
        world = mat(point, angle)
        local = world if parent is None else np.linalg.inv(self.bind[parent]) @ world
        self.bones.append({'name': name, 'parent': parent, 'localBind': local.tolist(), 'worldBind': world.tolist(), 'length': length})
        self.bind[name] = world
        self.current[name] = world.copy()

    def pose(self, angles):
        for bone in self.bones:
            name = bone['name']
            local = np.array(bone['localBind']) @ mat((0, 0), angles.get(name, 0))
            parent = bone['parent']
            self.current[name] = local if parent is None else self.current[parent] @ local

    def skin(self, vertices, weights):
        result = np.zeros_like(vertices)
        for name, values in weights.items():
            result += transform(self.current[name] @ np.linalg.inv(self.bind[name]), vertices) * np.array(values)[:, None]
        return result


def make_mesh(alpha):
    alpha = cv2.resize(alpha, (512, 512), None, 0, 0, cv2.INTER_AREA)
    mask = np.uint8(expand(alpha, 2) > .1)
    contours = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
    contour = contours[int(np.argmax([cv2.contourArea(c) for c in contours]))][:, 0, :]
    boundary = contour[::3]
    yy, xx = np.where(mask > 0)
    points = [tuple(map(float, p)) for p in boundary]
    for y in range(int(yy.min()), int(yy.max()) + 1, 7):
        for x in range(int(xx.min()), int(xx.max()) + 1, 7):
            if mask[y, x]:
                points.append((float(x), float(y)))
    points = list(dict.fromkeys(points))
    subdiv = cv2.Subdiv2D((0, 0, 512, 512))
    for p in points:
        subdiv.insert(p)
    vertices = np.array(points)
    lookup = {tuple(np.round(p, 3)): i for i, p in enumerate(vertices)}
    triangles = []
    for triangle in subdiv.getTriangleList().reshape(-1, 3, 2):
        keys = [tuple(np.round(p, 3)) for p in triangle]
        if any(k not in lookup for k in keys):
            continue
        low = np.maximum(np.floor(triangle.min(0)).astype(int), 0)
        high = np.minimum(np.ceil(triangle.max(0)).astype(int) + 1, 512)
        region_mask = np.zeros((high[1] - low[1], high[0] - low[0]), np.uint8)
        cv2.fillConvexPoly(region_mask, np.round(triangle - low).astype(np.int32), 255)
        if not np.any((region_mask > 0) & (alpha[low[1]:high[1], low[0]:high[0]] > 4 / 255)):
            continue
        triangles.append([lookup[k] for k in keys])
    return vertices, np.array(triangles, int)


def tps(source, target, points):
    a, b = np.array(source, float), np.array(target, float)
    distances = np.linalg.norm(a[:, None] - a[None, :], None, 2) ** 2
    kernel = distances * np.log(distances + 1e-7)
    affine = np.c_[np.ones(len(a)), a]
    matrix = np.block([[kernel + np.eye(len(a)) * .01, affine], [affine.T, np.zeros((3, 3))]])
    solution = np.linalg.solve(matrix, np.vstack([b - a, np.zeros((3, 2))]))
    d = np.linalg.norm(points[:, None] - a[None, :], None, 2) ** 2
    return points + np.c_[d * np.log(d + 1e-7), np.ones(len(points)), points] @ solution


def chain_weights(vertices, joints, names):
    joints = np.array(joints, float)
    distances = np.full(len(vertices), np.inf)
    coordinate = np.zeros(len(vertices))
    for i in range(len(joints) - 1):
        a, b = joints[i:i + 2]
        direction = b - a
        amount = np.clip((vertices - a) @ direction / (direction @ direction), 0, 1)
        distance = np.linalg.norm(vertices - (a + amount[:, None] * direction), None, 1)
        update = distance < distances
        coordinate[update] = i + smooth(amount[update])
        distances[update] = distance[update]
    return {name: np.clip(1 - np.abs(coordinate - i), 0, 1) for i, name in enumerate(names)}


def remap_mesh(image, source, destination, triangles):
    map_x = np.full((RENDER_SIZE, RENDER_SIZE), -100, np.float32)
    map_y = map_x.copy()
    for triangle in triangles:
        a, b = source[triangle], destination[triangle]
        x0 = max(0, int(np.floor(b[:, 0].min() * RENDER_SCALE)))
        x1 = min(RENDER_SIZE - 1, int(np.ceil(b[:, 0].max() * RENDER_SCALE)))
        y0 = max(0, int(np.floor(b[:, 1].min() * RENDER_SCALE)))
        y1 = min(RENDER_SIZE - 1, int(np.ceil(b[:, 1].max() * RENDER_SCALE)))
        matrix = np.vstack([b.T, np.ones(3)])
        if x1 < x0 or y1 < y0 or abs(np.linalg.det(matrix)) < 1e-7:
            continue
        xx, yy = X[y0:y1 + 1, x0:x1 + 1], Y[y0:y1 + 1, x0:x1 + 1]
        weights = np.linalg.inv(matrix) @ np.vstack([xx.ravel(), yy.ravel(), np.ones(xx.size)])
        inside = np.all(weights >= -.0001, 0).reshape(xx.shape)
        uv = (a.T @ weights).reshape(2, *xx.shape) * RENDER_SCALE
        map_x[y0:y1 + 1, x0:x1 + 1][inside] = uv[0][inside]
        map_y[y0:y1 + 1, x0:x1 + 1][inside] = uv[1][inside]
    return cv2.remap(image, map_x, map_y, cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))


def prepare():
    import runpy
    runpy.run_path(str(ROOT / 'repair_sources.py'))['build']()


class Petal:
    def __init__(self, side):
        self.side = side
        self.image = read(PARTS / ('petal-' + side + '.png'))
        self.vertices, self.triangles = make_mesh(self.image[:, :, 3])
        a = np.array([(250, 302), (255, 287), (245, 259), (230, 239), (211, 219), (199, 204), (195, 195), (205, 191), (209, 180), (197, 170), (176, 173), (152, 190), (137, 215), (133, 240), (147, 265), (170, 280), (201, 292), (237, 303)], float)
        b = np.array([(250, 302), (254, 286), (243, 257), (225, 232), (203, 212), (190, 196), (185, 187), (197, 181), (198, 171), (184, 163), (164, 166), (143, 184), (130, 211), (127, 237), (140, 260), (165, 278), (198, 291), (237, 303)], float)
        joints = np.array([(250, 302), (188, 255), (194, 181)], float)
        self.maximum_angles = [2.0, -5.0, 2.0]
        if side == 'right':
            a[:, 0] = 519 - a[:, 0]
            b[:, 0] = 519 - b[:, 0]
            joints[:, 0] = 519 - joints[:, 0]
            self.maximum_angles = [-v for v in self.maximum_angles]
        self.target = tps(a, b, self.vertices)
        self.skeleton = Skeleton()
        self.skeleton.add('root', None, (256, 448), 0, 0)
        self.names = [side + '-petal-' + str(i) for i in range(3)]
        for i, point in enumerate(joints):
            vector = joints[min(i + 1, 2)] - point
            angle = math.degrees(math.atan2(vector[1], vector[0])) if i < 2 else 0
            self.skeleton.add(self.names[i], 'root' if i == 0 else self.names[i - 1], point, angle, float(np.linalg.norm(vector)))
        self.weights = chain_weights(self.vertices, joints, self.names)
        self.skeleton.pose(dict(zip(self.names, self.maximum_angles)))
        self.corrective = self.target - self.skeleton.skin(self.vertices, self.weights)

    def positions(self, progress):
        self.skeleton.pose({n: a * progress for n, a in zip(self.names, self.maximum_angles)})
        return self.skeleton.skin(self.vertices, self.weights) + self.corrective * progress

    def render(self, progress):
        if abs(progress) < 1e-8:
            return self.image
        return remap_mesh(self.image, self.vertices, self.positions(progress), self.triangles)

    def data(self):
        return {'image': 'Parts/petal-' + self.side + '.png', 'bones': self.skeleton.bones, 'vertices': self.vertices.tolist(), 'triangles': self.triangles.tolist(), 'weights': {k: v.tolist() for k, v in self.weights.items()}, 'maximumAngles': dict(zip(self.names, self.maximum_angles)), 'maximumCorrectiveDisplacements': self.corrective.tolist(), 'approvedTargetVertices': self.target.tolist(), 'texturePolicy': 'single persistent neutral texture with completed hidden surfaces; no time-weighted pose texture blending'}


class Sprout:
    def __init__(self):
        self.image = read(PARTS / 'sprout.png')
        self.vertices, self.triangles = make_mesh(self.image[:, :, 3])
        self.skeleton = Skeleton()
        self.skeleton.add('root', None, (256, 448), 0, 0)
        specs = [('stem-base', 'root', (259, 211), (259, 196)), ('stem-top', 'stem-base', (259, 196), (259, 186)), ('leaf-left', 'stem-top', (256, 189), (237, 175)), ('leaf-left-tip', 'leaf-left', (237, 175), (225, 163)), ('leaf-right', 'stem-top', (262, 189), (281, 175)), ('leaf-right-tip', 'leaf-right', (281, 175), (295, 164))]
        for name, parent, a, b in specs:
            vector = np.array(b) - a
            self.skeleton.add(name, parent, a, math.degrees(math.atan2(vector[1], vector[0])), float(np.linalg.norm(vector)))
        points = self.vertices
        upper = smooth((211 - points[:, 1]) / 20)
        branch = smooth((196 - points[:, 1]) / 10)
        left = smooth((262 - points[:, 0]) / 6)
        tip_left = smooth((251 - points[:, 0]) / 22)
        tip_right = smooth((points[:, 0] - 267) / 22)
        self.weights = {'stem-base': 1 - upper, 'stem-top': upper * (1 - branch), 'leaf-left': upper * branch * left * (1 - tip_left), 'leaf-left-tip': upper * branch * left * tip_left, 'leaf-right': upper * branch * (1 - left) * (1 - tip_right), 'leaf-right-tip': upper * branch * (1 - left) * tip_right}

    def angles(self, time):
        def wave(delay):
            p = envelope((time - delay) % 4)
            q = math.exp(-((time - 3.38 - delay * .2) / .24) ** 2)
            q *= 1 - float(smooth((time - 3.55) / .3))
            return p - q * .13
        values = {'stem-base': 1.0 * wave(.08), 'stem-top': 1.6 * wave(.16), 'leaf-left': -3.2 * wave(.25), 'leaf-left-tip': 2.2 * wave(.31), 'leaf-right': 3.6 * wave(.30), 'leaf-right-tip': -2.4 * wave(.36)}
        return values

    def render(self, time):
        self.skeleton.pose(self.angles(time))
        return remap_mesh(self.image, self.vertices, self.skeleton.skin(self.vertices, self.weights), self.triangles)

    def data(self):
        return {'image': 'Parts/sprout.png', 'bones': self.skeleton.bones, 'vertices': self.vertices.tolist(), 'triangles': self.triangles.tolist(), 'weights': {k: v.tolist() for k, v in self.weights.items()}}


def envelope(time):
    if time < .35:
        return 0.0
    if time < 1.45:
        return float(smooth((time - .35) / 1.1))
    if time < 1.65:
        return 1.0
    if time < 3.15:
        return float(1 - smooth((time - 1.65) / 1.5))
    return 0.0


class Linkage:
    def __init__(self, side):
        self.side = side
        self.a = np.array([164., 317.])
        self.c = np.array([137., 272.])
        self.b = np.array([115., 260.])
        self.d = np.array([189., 162.])
        self.sign = 1
        if side == 'right':
            for point in [self.a, self.b, self.c, self.d]:
                point[0] = 520 - point[0]
            self.sign = -1
        self.lengths = [float(np.linalg.norm(self.c - self.a)), float(np.linalg.norm(self.b - self.c)), float(np.linalg.norm(self.d - self.b))]
        self.images = {name: read(PARTS / (side + '-' + name + '.png')) for name in ['rod', 'coupler', 'crank']}

    def solve(self, progress):
        theta = math.radians(5.5 * self.sign * progress)
        rotation = np.array([[math.cos(theta), -math.sin(theta)], [math.sin(theta), math.cos(theta)]])
        c = self.a + rotation @ (self.c - self.a)
        distance = np.linalg.norm(self.d - c)
        axis = (self.d - c) / distance
        r, s = self.lengths[1:]
        u = (r * r - s * s + distance * distance) / (2 * distance)
        h = math.sqrt(max(0, r * r - u * u))
        normal = np.array([-axis[1], axis[0]])
        candidates = [c + axis * u + normal * h, c + axis * u - normal * h]
        b = candidates[int(np.argmin([np.linalg.norm(p - self.b) for p in candidates]))]
        return b, c

    def render(self, progress):
        b, c = self.solve(progress)
        angles = {'crank': angle_between(self.c - self.a, c - self.a), 'rod': angle_between(self.b - self.d, b - self.d), 'coupler': angle_between(self.c - self.b, c - b)}
        images = {'crank': rigid(self.images['crank'], self.a, self.a, angles['crank']), 'rod': rigid(self.images['rod'], self.d, self.d, angles['rod']), 'coupler': rigid(self.images['coupler'], self.b, b, angles['coupler'])}
        return images, {'rearEnd': b.tolist(), 'frontElbow': c.tolist(), 'angles': angles}

    def data(self):
        return {'fixedPedestalPivot': self.a.tolist(), 'fixedRearPivot': self.d.tolist(), 'bindElbow': self.c.tolist(), 'bindRearEnd': self.b.tolist(), 'rigidLinkLengths': self.lengths, 'maximumCrankRotationDegrees': 5.5 * self.sign, 'mechanism': 'closed four-bar linkage, circle-intersection coupler solve, no scaling', 'images': {k: 'Parts/' + self.side + '-' + k + '.png' for k in self.images}}


class Scene:
    def __init__(self):
        self.petals = [Petal('left'), Petal('right')]
        self.sprout = Sprout()
        self.links = [Linkage('left'), Linkage('right')]
        self.back = read(PARTS / 'fixed-backplate.png')
        self.rear_occluder = read(PARTS / 'fixed-rear-occluder.png')
        self.front = read(PARTS / 'fixed-foreground.png')
        self.timeline = []

    def render(self, time):
        progress = envelope(time % 4)
        link_layers = []
        link_states = []
        for linkage in self.links:
            layers, state = linkage.render(progress)
            link_layers.append(layers)
            link_states.append(state)
        value = self.back.copy()
        for layers in link_layers:
            value = over(layers['rod'], value)
        value = over(self.rear_occluder, value)
        value = over(self.sprout.render(time), value)
        for petal in self.petals:
            value = over(petal.render(progress), value)
        for layers in link_layers:
            value = over(layers['coupler'], value)
            value = over(layers['crank'], value)
        value = over(self.front, value)
        self.timeline.append({'time': time, 'opening': progress, 'sproutAngles': self.sprout.angles(time), 'linkages': link_states})
        return rgba(value)

    def data(self):
        return {'format': 'layered-weighted-mesh-rig-v1', 'frameSize': [512, 512], 'partCanvasSize': [1024, 1024], 'renderScale': 2, 'pivot': [256, 448], 'durationMs': 4000, 'rootMotion': False, 'approvedReferences': ['Sources/neutral.png', 'Sources/open.png'], 'keyposeApproval': 'User explicitly requested rigging the original and this keypose into a 4-second idle loop.', 'petals': {p.side: p.data() for p in self.petals}, 'sprout': self.sprout.data(), 'linkages': {p.side: p.data() for p in self.links}, 'drawOrder': ['fixed-backplate', 'left-rod', 'right-rod', 'fixed-rear-occluder', 'sprout', 'petal-left', 'petal-right', 'left-coupler', 'left-crank', 'right-coupler', 'right-crank', 'fixed-foreground'], 'timeline': self.timeline, 'poseCrossfades': False, 'spineCompatibilityClaimed': False}


def animated_webp(images, path, durations):
    from PIL import WebPImagePlugin
    images[0].encoderinfo = {'append_images': images[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True, 'minimize_size': False, 'kmin': 9, 'kmax': 17}
    with path.open('wb') as output:
        WebPImagePlugin._save_all(images[0], output, str(path))


def contact(images, times, path):
    canvas = Image.new('RGB', (1536, 1064), '#283f3a')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
    for i, image in enumerate(images):
        x, y = i % 3 * 512, i // 3 * 532
        canvas.paste(image, (x, y + 20), image)
        ImageDraw.Draw(canvas).text((x + 12, y + 2), str(round(times[i], 2)) + 's', '#eff8e9', font)
    canvas.save(path)


def draft():
    SCRATCH.mkdir(511, True, True)
    scene = Scene()
    times = [0, .8, 1.45, 1.8, 2.55, 3.4]
    images = [scene.render(t) for t in times]
    contact(images, times, SCRATCH / 'rig-poses.png')
    for t, image in zip(times, images):
        image.save(SCRATCH / ('pose-' + str(t) + '.png'))
    interval = [scene.render(i / 15) for i in range(30)]
    animated_webp(interval, SCRATCH / 'opening-draft.webp', [67, 66, 67] * 10)
    save_json(ROOT / 'rig.json', scene.data())
    print('Representative opening interval and six poses rendered.', flush=True)


def export():
    scene = Scene()
    frame_folder = ROOT / 'Frames'
    frame_folder.mkdir(511, True, True)
    images = []
    for i in range(120):
        image = scene.render(i / 30)
        image.save(frame_folder / ('idle-' + str(i).zfill(3) + '.png'))
        images.append(image)
        if i % 15 == 0:
            print('frame', i, flush=True)
    durations = [33, 34, 33] * 40
    animated_webp(images, ROOT / 'idle.webp', durations)
    previews = []
    small = []
    for image in images:
        bg = Image.new('RGBA', (512, 512), '#283f3a')
        frame = Image.alpha_composite(bg, image)
        previews.append(frame.convert('RGB'))
        small.append(frame.resize((160, 160), Image.Resampling.LANCZOS).convert('RGB'))
    animated_webp(previews, ROOT / 'preview.webp', durations)
    animated_webp(small, ROOT / 'preview-160.webp', durations)
    sheet = Image.new('RGBA', (4096, 7680))
    for i, image in enumerate(images):
        sheet.paste(image, (i % 8 * 512, i // 8 * 512))
    sheet.save(ROOT / 'idle-sheet.png')
    sheet.encoderinfo = {'lossless': True, 'method': 4, 'exact': True}
    from PIL import WebPImagePlugin
    with (ROOT / 'idle-sheet.webp').open('wb') as output:
        WebPImagePlugin._save(sheet, output, str(ROOT / 'idle-sheet.webp'))
    save_json(ROOT / 'rig.json', scene.data())
    save_json(ROOT / 'animation.json', {'frameSize': [512, 512], 'frameCount': 120, 'columns': 8, 'rows': 15, 'durationsMs': durations, 'periodMs': 4000, 'pivot': [256, 448], 'rootMotion': False, 'loop': True, 'image': 'idle-sheet.webp', 'sourceImage': 'idle-sheet.png', 'animatedImage': 'idle.webp', 'sourceRig': 'rig.json', 'sourceRenderer': 'build_idle.py'})
    contact([images[i] for i in [0, 24, 44, 54, 77, 102]], [0, .8, 44 / 30, 1.8, 77 / 30, 3.4], ROOT / 'contact-sheet.png')
    print('Export complete:', ROOT, flush=True)


if __name__ == '__main__':
    if '--prepare' in sys.argv:
        prepare()
    if '--draft' in sys.argv:
        draft()
    if '--export' in sys.argv:
        export()
