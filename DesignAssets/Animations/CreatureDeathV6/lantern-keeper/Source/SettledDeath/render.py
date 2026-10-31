import json
import math
from pathlib import Path

from PIL import Image


folder = Path(__file__).resolve().parent
rig = json.loads((folder / 'rig.json').read_text('utf-8'))


def smooth(value):
    value = min(1.0, max(0.0, value))
    return value * value * (3.0 - 2.0 * value)


def stabilized(source, registration):
    head_dx, body_dx, body_dy, nose_y = registration
    def displacement(x, y):
        body_weight = smooth((x - 245.0) / 90.0) * smooth((y - 300.0) / 50.0)
        ground_weight = smooth((448.0 - y) / 55.0)
        return head_dx * (1.0 - body_weight) + body_dx * body_weight, body_dy * body_weight * ground_weight
    def inverse(x, y):
        sx, sy = x, y
        for iteration in range(8):
            dx, dy = displacement(sx, sy)
            sx, sy = x - dx, y - dy
        return sx, sy
    cells = []
    for y in range(0, 512, 16):
        for x in range(0, 512, 16):
            corners = [inverse(x, y), inverse(x, y + 16), inverse(x + 16, y + 16), inverse(x + 16, y)]
            cells.append(((x, y, x + 16, y + 16), tuple(value for point in corners for value in point)))
    return source.convert('RGBa').transform((512, 512), Image.Transform.MESH, cells, Image.Resampling.BICUBIC).convert('RGBA')


def complete_frame(image, registration, model):
    scale = registration['scale']
    offset_x, offset_y = registration['offset']
    cel = image.crop(tuple(registration['sourceCell'])).convert('RGBA')
    cel.putalpha(cel.getchannel('A').point(lambda value: 0 if value < 8 else value))
    matrix = (1 / scale, 0, -offset_x / scale, 0, 1 / scale, -offset_y / scale)
    cel = cel.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, matrix, Image.Resampling.BICUBIC)
    controls = model['controls']
    coefficients = model['coefficients']
    count = len(controls)
    step = model['step']
    def inverse(x, y):
        x, y = x / 512.0, y / 512.0
        sx = coefficients[count][0] + coefficients[count + 1][0] * x + coefficients[count + 2][0] * y
        sy = coefficients[count][1] + coefficients[count + 1][1] * x + coefficients[count + 2][1] * y
        for control, coefficient in zip(controls, coefficients):
            radius_squared = (x - control[0]) ** 2 + (y - control[1]) ** 2
            kernel = radius_squared * math.log(radius_squared + 1e-12)
            sx += coefficient[0] * kernel
            sy += coefficient[1] * kernel
        return sx * 512.0, sy * 512.0
    grid = [[inverse(x, y) for x in range(0, 513, step)] for y in range(0, 513, step)]
    cells = []
    for row in range(512 // step):
        for column in range(512 // step):
            corners = [grid[row][column], grid[row + 1][column], grid[row + 1][column + 1], grid[row][column + 1]]
            cells.append(((column * step, row * step, (column + 1) * step, (row + 1) * step), tuple(value for point in corners for value in point)))
    return cel.transform((512, 512), Image.Transform.MESH, cells, Image.Resampling.BICUBIC).convert('RGBA')


frames = []
for index, registration in enumerate(rig['bodyRegistration']):
    source = Image.open(folder / rig['bodySources'][index]).convert('RGBA')
    frames.append(stabilized(source, registration))
sheet = Image.open(folder / rig['earGenerationSource']).convert('RGBA')
models = json.loads((folder / rig['drawnAlignment']).read_text('utf-8'))
for registration, model in zip(rig['drawnRegistration'], models):
    frames.append(complete_frame(sheet, registration, model))
output = folder / 'Frames'
output.mkdir(0o777, True, True)
for index, frame in enumerate(frames):
    frame.save(output / f'{index:03d}.png')
