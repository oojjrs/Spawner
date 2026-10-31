import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import GifImagePlugin, Image, WebPImagePlugin

ROOT = Path(__file__).resolve().parent
if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
import cv2

Y, X = np.mgrid[:512, :512].astype(np.float32)


def read(path):
    image = np.asarray(Image.open(path).convert('RGBA'), np.float32) / 255
    image[:, :, :3] *= image[:, :, 3:4]
    return image


def rgba(image):
    image = np.clip(image, 0, 1)
    rgb = image[:, :, :3] / np.maximum(image[:, :, 3:4], 1e-8)
    result = np.uint8(np.clip(np.concatenate((rgb, image[:, :, 3:4]), 2) * 255 + 0.5, 0, 255))
    result[result[:, :, 3] == 0, :3] = 0
    return Image.fromarray(result)


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def dump(path, data):
    path.write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))


def translate(point):
    result = np.eye(3)
    result[:2, 2] = point
    return result


class CrownRig:
    def __init__(self, name, curve):
        self.name = name
        self.source = read(ROOT / 'Source' / f'{name}.png')
        self.curve = np.asarray(curve, np.float32)
        self.cut = np.interp(np.arange(512), self.curve[:, 0], self.curve[:, 1])
        mask = (Y < self.cut[None, :]) & (self.source[:, :, 3] > 0)
        self.crown = self.source * mask[:, :, None]
        self.carrier = self.source * (~mask[:, :, None])
        present = mask & (self.source[:, :, 3] > 0.05)
        yy, xx = np.where(present)
        self.left = float(xx.min())
        self.right = float(xx.max())
        self.top = float(yy.min())
        self.envelope = np.empty(512)
        for x in range(512):
            rows = np.where(present[:, x])[0]
            self.envelope[x] = rows.min() if len(rows) else self.cut[x]
        self.xs = np.linspace(max(0, xx.min() - 3), min(511, xx.max() + 3), 37)
        self.ys = np.linspace(max(0, yy.min() - 4), min(511, yy.max() + 4), 27)
        self.vertices = np.asarray([(x, y) for y in self.ys for x in self.xs])
        self.triangles = []
        for row in range(26):
            for column in range(36):
                first = row * 37 + column
                self.triangles.extend([(first, first + 1, first + 38), (first, first + 38, first + 37)])
        self.weights = self.make_weights(self.vertices)
        center = (self.left + self.right) / 2
        points = {
            'root': (256, 448),
            'cap-root': (center, float(np.interp(center, np.arange(512), self.cut))),
            'cap-left': ((self.left + center) / 2, self.top + 25),
            'cap-crown': (center, self.top),
            'cap-right': ((center + self.right) / 2, self.top + 25),
        }
        self.bones = []
        self.bind = {}
        for bone, point in points.items():
            parent = None if bone == 'root' else 'root' if bone == 'cap-root' else 'cap-root'
            world = translate(point)
            local = world if parent is None else np.linalg.inv(self.bind[parent]) @ world
            self.bind[bone] = world
            self.bones.append({'name': bone, 'parent': parent, 'localBind': local.tolist(), 'worldBind': world.tolist()})
        rgba(self.crown).save(ROOT / 'Parts' / f'{name}-crown.png')
        rgba(self.carrier).save(ROOT / 'Parts' / f'{name}-fixed-carrier.png')

    def make_weights(self, vertices):
        vx = vertices[:, 0]
        vy = vertices[:, 1]
        cut = np.interp(vx, np.arange(512), self.cut)
        top = np.interp(vx, np.arange(512), self.envelope)
        span = np.maximum(1, cut - top - 7)
        vertical = np.clip((cut - vy - 7) / span, 0, 1)
        horizontal = np.clip((vx - self.left) / (self.right - self.left), 0, 1)
        freedom = np.sin(horizontal * math.pi) ** 0.8
        freedom *= np.clip(span / 70, 0, 1)
        center = (self.left + self.right) / 2
        centers = [(self.left + center) / 2, center, (center + self.right) / 2]
        width = (self.right - self.left) / 4
        hats = np.asarray([np.exp(-0.5 * ((vx - point) / (width * 0.7)) ** 2) for point in centers])
        hats /= np.maximum(hats.sum(0), 1e-8)
        active = vertical * freedom
        result = {'cap-root': 1 - active}
        for index, bone in enumerate(['cap-left', 'cap-crown', 'cap-right']):
            result[bone] = active * hats[index]
        return result

    def skin(self, amplitude):
        offsets = {'cap-left': 0.72 * amplitude * 1.132, 'cap-crown': amplitude * 1.132, 'cap-right': 0.72 * amplitude * 1.132}
        world = {}
        for bone in self.bones:
            local = np.asarray(bone['localBind'])
            local[1, 2] += offsets.get(bone['name'], 0)
            world[bone['name']] = local if bone['parent'] is None else world[bone['parent']] @ local
        source = np.column_stack((self.vertices, np.ones(len(self.vertices))))
        result = np.zeros_like(self.vertices)
        for bone, weights in self.weights.items():
            transformed = (world[bone] @ np.linalg.inv(self.bind[bone]) @ source.T).T[:, :2]
            result += transformed * weights[:, None]
        return result

    def render(self, amplitude):
        if abs(amplitude) < 1e-8:
            return rgba(self.source)
        posed = self.skin(amplitude).reshape((27, 37, 2))
        columns = np.arange(512)
        rows = np.arange(512)
        field = np.asarray([np.interp(columns, self.xs, posed[row, :, 1]) for row in range(27)])
        if np.any(np.diff(field, 1, 0) <= 0):
            raise RuntimeError(f'Folded cap mesh: {self.name}, {amplitude}')
        inverse_y = np.empty((512, 512), np.float32)
        for x in columns:
            inverse_y[:, x] = np.interp(rows, field[:, x], self.ys)
            inverse_y[rows < field[0, x], x] = -100
            inverse_y[rows > field[-1, x], x] = -100
        crown = cv2.remap(self.crown, X, inverse_y, cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
        crown = np.clip(crown, 0, 1)
        crown[:, :, :3] = np.minimum(crown[:, :, :3], crown[:, :, 3:4])
        return rgba(over(crown, self.carrier))

    def data(self):
        return {
            'name': self.name,
            'construction': 'local-flexible-cap-crown-mesh-and-fixed-carrier',
            'fixedBoundary': self.curve.tolist(),
            'exposedSurfaces': 'crown-surface-only; lower-seam-has-seven-pixel-pinned-band; no-underlying-surface-uncovered',
            'bones': self.bones,
            'mesh': {'source': f'Parts/{self.name}-crown.png', 'vertices': self.vertices.tolist(), 'triangles': self.triangles, 'weights': {bone: weights.tolist() for bone, weights in self.weights.items()}},
            'fixedAttachment': f'Parts/{self.name}-fixed-carrier.png',
            'rendering': 'inverse-sampling-of-LBS-skinned-mesh; no-vertex-correction',
        }


def smooth(value):
    value = float(np.clip(value, 0, 1))
    return value * value * (3 - 2 * value)


def webp(path, frames, durations, loop):
    frames[0].encoderinfo = {'append_images': frames[1:], 'duration': durations, 'loop': loop, 'lossless': True, 'method': 4}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(frames[0], stream, '')


old_curve = [(38, 287), (62, 279), (89, 267), (123, 247), (148, 238), (172, 236), (199, 243), (225, 250), (255, 255), (284, 250), (310, 240), (335, 236), (365, 240), (399, 258), (430, 278), (454, 288), (473, 288)]
new_curve = [(38, 209), (61, 198), (76, 189), (100, 177), (132, 167), (156, 162.5), (184, 167), (212, 172), (257, 176), (291, 172), (322, 165), (357, 162.5), (395, 167), (433, 184), (447, 197), (473, 209)]
old = CrownRig('level03', old_curve)
new = CrownRig('level04', new_curve)
frames = []
durations = []
timeline = []


def add(image, duration, phase, level, amplitude):
    index = len(frames)
    frames.append(image)
    durations.append(duration)
    timeline.append({'frame': index, 'startMs': sum(durations[:-1]), 'durationMs': duration, 'phase': phase, 'level': level, 'crownOffset': amplitude})


add(old.render(0), 200, 'start', 3, 0)
for index in range(1, 13):
    pressure = 35 * smooth(index / 12)
    add(old.render(pressure), 20, 'anticipation', 3, pressure)
add(old.render(35), 60, 'compressed-hold', 3, 35)
for index in range(4):
    image = Image.open(ROOT / 'Source/Burst' / f'burst-{index + 1:02}.png').convert('RGBA')
    add(image, 20, 'drawn-growth-burst', 3 if index == 0 else 4, None)
add(new.render(-36), 40, 'growth-overshoot', 4, -36)
for index in range(1, 7):
    amplitude = -36 + 84 * smooth(index / 6)
    add(new.render(amplitude), 20, 'recoil', 4, amplitude)
for index in range(1, 13):
    amplitude = 48 * (1 - index / 12) ** 3
    add(new.render(amplitude), 20, 'settle', 4, amplitude)
add(new.render(0), 800, 'finish', 4, 0)

webp(ROOT / 'representative.webp', frames, durations, 0)
opaque = []
for frame in frames:
    background = Image.new('RGBA', (512, 512), (222, 218, 210, 255))
    background.alpha_composite(frame)
    opaque.append(background.convert('RGB'))
palette_sheet = Image.new('RGB', (8 * 96, math.ceil(len(frames) / 8) * 96), (222, 218, 210))
for index, frame in enumerate(opaque):
    palette_sheet.paste(frame.resize((96, 96), Image.Resampling.LANCZOS), ((index % 8) * 96, (index // 8) * 96))
palette = palette_sheet.quantize(256, Image.Quantize.MEDIANCUT)
gif = [frame.quantize(256, Image.Quantize.MEDIANCUT, 0, palette, Image.Dither.NONE) for frame in opaque]
gif[0].encoderinfo = {'append_images': gif[1:], 'duration': durations, 'loop': 0, 'disposal': 2, 'optimize': False}
with (ROOT / 'preview.gif').open('wb') as stream:
    GifImagePlugin._save_all(gif[0], stream, '')
selected = [0, 12, 14, 15, 17, 18, 24, len(frames) - 1]
contact = Image.new('RGBA', (2048, 1024), (222, 218, 210, 255))
for position, index in enumerate(selected):
    contact.alpha_composite(frames[index], ((position % 4) * 512, (position // 4) * 512))
contact.convert('RGB').save(ROOT / 'motion-contact.png')
parts = Image.new('RGBA', (1536, 1024), (222, 218, 210, 255))
for row, rig in enumerate([old, new]):
    for column, image in enumerate([rgba(rig.carrier), rgba(rig.crown), rig.render(35 if row == 0 else 48)]):
        parts.alpha_composite(image, (column * 512, row * 512))
parts.convert('RGB').save(ROOT / 'parts-and-extremes.png')
dump(ROOT / 'rig.json', {'canvas': [512, 512], 'root': [256, 448], 'rigs': [old.data(), new.data()], 'timeline': timeline, 'opacityPoseBlending': False})
dump(ROOT / 'animation.json', {'status': 'motion-study-with-browser-playback-samples', 'canvas': [512, 512], 'root': [256, 448], 'frameCount': len(frames), 'durationMs': sum(durations), 'timeline': timeline, 'construction': 'two-local-crown-rigs-plus-four-drawn-growth-inbetweens', 'dependencies': ['numpy', 'Pillow', 'opencv-python-headless']})
if len(sys.argv) > 2 and sys.argv[2] == 'final':
    sheet = Image.new('RGBA', (4096, math.ceil(len(frames) / 8) * 512), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        frame.save(ROOT / 'Frames' / f'{index:03}.png')
        sheet.alpha_composite(frame, ((index % 8) * 512, (index // 8) * 512))
    sheet.save(ROOT / 'growth.png')
    webp(ROOT / 'growth.webp', frames, durations, 1)
print(json.dumps({'frames': len(frames), 'durationMs': sum(durations), 'output': str(ROOT)}))
