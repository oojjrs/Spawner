import json
from PIL import Image


def smooth(value):
    t = max(0, min(1, value))
    return t * t * (3 - 2 * t)


def displacement(x, y, head, body, config):
    left, right = config['neckTransitionX']
    top, ground = config['verticalFadeY']
    weight = smooth((x - left) / (right - left))
    dx = head[0] * (1 - weight) + body[0] * weight
    dy = (head[1] * (1 - weight) + body[1] * weight) * (1 - smooth((y - top) / (ground - top)))
    return dx, dy


def source_point(x, y, head, body, config):
    sx, sy = x, y
    for _ in range(config['inverseIterations']):
        dx, dy = displacement(sx, sy, head, body, config)
        sx, sy = x - dx, y - dy
    return sx, sy


def stabilize_frames(folder):
    config = json.loads((folder / 'Source/registration.json').read_text('utf-8'))
    frames = []
    for entry in config['frames']:
        frame = Image.open(folder / 'Source/Drawings' / entry['file']).convert('RGBA')
        head = tuple(b - a for a, b in zip(entry['noseSource'], entry['noseTarget']))
        body = tuple(b - a for a, b in zip(entry['hipSource'], entry['hipTarget']))
        if head != (0, 0) or body != (0, 0):
            mesh = []
            step = config['meshStep']
            width, height = frame.size
            for y in range(0, height, step):
                for x in range(0, width, step):
                    right, bottom = min(x + step, width), min(y + step, height)
                    corners = [(x, y), (x, bottom), (right, bottom), (right, y)]
                    quad = sum((source_point(px, py, head, body, config) for px, py in corners), ())
                    mesh.append(((x, y, right, bottom), quad))
            frame = frame.transform(frame.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
        frame.save(folder / 'Source/Frames' / entry['file'])
        frames.append(frame)
    return frames
