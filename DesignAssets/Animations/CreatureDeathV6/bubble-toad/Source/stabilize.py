import json

import cv2
import numpy as np
from PIL import Image


def source_frame(folder, placement, scale, pivot):
    pixels = np.array(Image.open(folder / placement['source']).convert('RGBA'))
    alpha = pixels[:, :, 3].astype(np.float32)
    alpha[alpha < 8] = 0
    pixels[:, :, 3] = np.minimum(255, alpha * 255 / 253).astype(np.uint8)
    count, labels, stats, centers = cv2.connectedComponentsWithStats((pixels[:, :, 3] > 32).astype(np.uint8), 8)
    largest = 1 + int(stats[1:, cv2.CC_STAT_AREA].argmax())
    pixels[labels != largest] = 0
    x0, y0, x1, y1 = placement['rect']
    image = Image.fromarray(pixels).crop((x0, y0, x1, y1)).convert('RGBa')
    px, py = placement['origin']
    matrix = (1 / scale, 0, px - x0 - pivot[0] / scale, 0, 1 / scale, py - y0 - pivot[1] / scale)
    return image.transform((512, 512), Image.Transform.AFFINE, matrix, Image.Resampling.BICUBIC).convert('RGBA')


def premultiply(frame):
    pixels = np.array(frame).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def flow_guide(frame):
    pixels = premultiply(frame)
    rgb = pixels[:, :, :3] + 0.3 * (1 - pixels[:, :, 3:4])
    return cv2.cvtColor(np.uint8(np.clip(rgb * 255, 0, 255)), cv2.COLOR_RGB2GRAY)


def warp(pixels, flow, fraction):
    height, width = pixels.shape[:2]
    grid_x, grid_y = np.meshgrid(np.arange(width).astype(np.float32), np.arange(height).astype(np.float32))
    map_x, map_y = grid_x.copy(), grid_y.copy()
    for _ in range(5):
        sampled = cv2.remap(flow, map_x, map_y, cv2.INTER_LINEAR, None, cv2.BORDER_REPLICATE)
        map_x = grid_x - fraction * sampled[:, :, 0]
        map_y = grid_y - fraction * sampled[:, :, 1]
    return cv2.remap(pixels, map_x, map_y, cv2.INTER_CUBIC, None, cv2.BORDER_CONSTANT)


def interpolate(first, last, fractions, method):
    solver = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    guide_a, guide_b = flow_guide(first), flow_guide(last)
    backward = solver.calc(guide_b, guide_a, None)
    forward = solver.calc(guide_a, guide_b, None) if method == 'bidirectional-flow' else None
    a, b = premultiply(first), premultiply(last)
    frames = []
    for fraction in fractions:
        pixels = warp(b, backward, 1 - fraction)
        if forward is not None:
            pixels = warp(a, forward, fraction) * (1 - fraction) + pixels * fraction
        alpha = np.clip(pixels[:, :, 3:4], 0, 1)
        pixels[:, :, :3] /= np.maximum(alpha, 0.01)
        pixels[alpha[:, :, 0] < 0.01] = 0
        frames.append(Image.fromarray(np.uint8(np.clip(pixels * 255, 0, 255))))
    return frames


def render_frames(folder, meta):
    source = folder / 'Source'
    registration = json.loads((source / 'registration.json').read_text('utf-8'))
    stabilization = registration['stabilization']
    translations = stabilization['translationsXPx']
    scale = registration['scale']
    frames = []
    for index, placement in enumerate(registration['frames']):
        pivot_x = meta['pivotX'] + translations[index]
        frames.append(source_frame(source, placement, scale, (pivot_x, meta['pivotY'])))
    timestamps = [0]
    for duration in meta['durationsMs']:
        timestamps.append(timestamps[-1] + duration)
    for span in stabilization['interpolations']:
        first, last = span['first'], span['last']
        fractions = [(timestamps[index] - timestamps[first]) / (timestamps[last] - timestamps[first]) for index in span['frames']]
        if span['easing'] == 'ease-out-quadratic':
            fractions = [1 - (1 - value) ** 2 for value in fractions]
        for index, frame in zip(span['frames'], interpolate(frames[first], frames[last], fractions, span['method'])):
            frames[index] = frame
    for name, frame in zip(meta['sourceFrames'], frames):
        frame.save(folder / name)
    return frames
