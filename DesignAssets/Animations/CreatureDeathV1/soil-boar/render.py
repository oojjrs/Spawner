from pathlib import Path
import json
import math
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FOLDER = Path(__file__).resolve().parent
SIZE = 512
YY, XX = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)


def save_json(path, value):
    text = json.dumps(value, **{'ensure_ascii': False, 'indent': 2}) + '\n'
    path.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def smooth(value):
    v = np.clip(value, 0, 1)
    return v * v * (3 - 2 * v)


def progress(time, delay):
    time -= delay
    if time < 180:
        return -.045 * math.sin(math.pi * max(0, time) / 180)
    if time < 720:
        return float(smooth((time - 180) / 540)) * 1.045
    if time < 1120:
        return 1.045 - float(smooth((time - 720) / 400)) * .045
    return 1


def mask(points):
    image = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(image).polygon([tuple(point) for point in points], 255)
    return np.asarray(image.filter(ImageFilter.GaussianBlur(16))).astype(np.float32) / 255


def matrix(pivot, values):
    a = math.radians(values[0])
    c, s = math.cos(a), math.sin(a)
    result = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], np.float32)
    result[:2, 2] = np.array(pivot) + np.array(values[1:]) - result[:2, :2] @ np.array(pivot)
    return result


def sample(array, x, y):
    sx = np.clip(x, 0, SIZE - 1.001)
    sy = np.clip(y, 0, SIZE - 1.001)
    ix, iy = sx.astype(np.int32), sy.astype(np.int32)
    u, v = (sx - ix)[..., None], (sy - iy)[..., None]
    upper = array[iy, ix] * (1 - u) + array[iy, ix + 1] * u
    lower = array[iy + 1, ix] * (1 - u) + array[iy + 1, ix + 1] * u
    return upper * (1 - v) + lower * v


def export(rig, frames):
    columns = rig['columns']
    atlas = Image.new('RGBA', (SIZE * columns, SIZE * math.ceil(len(frames) / columns)))
    for i, frame in enumerate(frames):
        atlas.paste(frame, (i % columns * SIZE, i // columns * SIZE))
    atlas.save(FOLDER / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4})
    options = {'save_all': True, 'append_images': frames[1:], 'duration': rig['durationsMs'], 'loop': 0, 'lossless': True, 'method': 4, 'minimize_size': False}
    frames[0].save(FOLDER / 'preview.webp', 'WEBP', **options)
    small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
    small[0].save(FOLDER / 'thumbnail.webp', 'WEBP', **{**options, 'append_images': small[1:]})
    contact = Image.new('RGB', (1024, 560), '#27352f')
    pen = ImageDraw.Draw(contact)
    for cell, index in enumerate([0, 3, 6, 9, 12, 15, 19, 23]):
        frame = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
        x, y = cell % 4 * 256, cell // 4 * 280
        contact.paste(frame, (x, y), frame)
        pen.text((x + 8, y + 258), str(rig['timesMs'][index]) + ' ms', '#e6eedc')
    contact.save(FOLDER / 'contact.png')
    prefix = 'DesignAssets/Animations/CreatureDeathV1/' + rig['name'] + '/'
    metadata = {'name': rig['name'], 'action': 'death', 'sourceImage': rig['sourceImage'], 'image': prefix + 'death.webp', 'frameSize': SIZE, 'columns': columns, 'frameCount': len(frames), 'pivotX': rig['pivotX'], 'pivotY': rig['pivotY'], 'durationsMs': rig['durationsMs'], 'durationMs': sum(rig['durationsMs']), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'rig': prefix + 'rig.json', 'renderer': prefix + 'render.py', 'contact': prefix + 'contact.png', 'canvasPlacement': rig['canvasPlacement'], 'method': rig['method'], 'rootMotion': rig['rootMotion'], 'previewLoop': 'The preview repeats for inspection; runtime death is non-looping and holds the settled pose.'}
    save_json(FOLDER / 'death.json', metadata)


def main():
    rig = json.loads((FOLDER / 'rig.json').read_bytes())
    neutral = Image.open(FOLDER / rig['texture']).convert('RGBA')
    bones = rig['bones']
    influences = [np.ones((SIZE, SIZE), np.float32)]
    for bone in bones:
        influence = mask(bone['polygon'])
        influences = [weight * (1 - influence) for weight in influences]
        influences.append(influence)
    weights = np.stack(influences, 2)
    np.savez_compressed(FOLDER / 'weights.npz', **{'weights': weights[::8, ::8], 'gridSpacing': np.array([8, 8]), 'boneNames': np.array(['root'] + [bone['name'] for bone in bones])})
    base = np.asarray(neutral).astype(np.float32)
    closed = None
    if 'closedEyes' in rig:
        eye = rig['closedEyes']
        attachment = Image.open(FOLDER / eye['texture']).convert('RGBA')
        blend = Image.new('L', (SIZE, SIZE), 0)
        ImageDraw.Draw(blend).polygon([tuple(point) for point in eye['polygon']], 255)
        blend = blend.filter(ImageFilter.GaussianBlur(2))
        closed = np.asarray(Image.composite(attachment, neutral, blend)).astype(np.float32)
    textures = []
    for pixels in [base, closed]:
        if pixels is None:
            textures.append(None)
            continue
        pixels = pixels.copy()
        pixels[:, :, :3] *= pixels[:, :, 3:4] / 255
        textures.append(pixels)
    points = np.stack((XX, YY, np.ones_like(XX)), 2)
    frames = []
    states = []
    for time in rig['timesMs']:
        if time == 0:
            frames.append(neutral.copy())
            states.append({'timeMs': 0, 'pose': 'neutral'})
            continue
        matrices = {'root': np.eye(3, 3, 0, np.float32)}
        displacement = np.zeros((SIZE, SIZE, 2), np.float32)
        state = {'timeMs': time, 'bones': {}}
        for index, bone in enumerate(bones):
            amount = progress(time, bone['delayMs'])
            values = [value * amount for value in bone['final']]
            local = matrix(bone['pivot'], values)
            transform = matrices[bone['parent'] or 'root'] @ local
            matrices[bone['name']] = transform
            posed = points @ transform.T
            displacement += (posed[:, :, :2] - points[:, :, :2]) * weights[:, :, index + 1:index + 2]
            state['bones'][bone['name']] = [round(value, 4) for value in values]
        source_x, source_y = XX.copy(), YY.copy()
        for iteration in range(10):
            offset = sample(displacement, source_x, source_y)
            source_x = .25 * source_x + .75 * (XX - offset[:, :, 0])
            source_y = .25 * source_y + .75 * (YY - offset[:, :, 1])
        texture = textures[1] if closed is not None and time >= rig['closedEyes']['atMs'] else textures[0]
        pixels = sample(texture, source_x, source_y)
        alpha = pixels[:, :, 3:4]
        pixels[:, :, :3] = pixels[:, :, :3] * 255 / np.maximum(alpha, .00001)
        pixels = np.uint8(np.clip(pixels, 0, 255) + .5)
        outside = (source_x < 0) | (source_y < 0) | (source_x >= SIZE) | (source_y >= SIZE)
        pixels[outside] = 0
        frames.append(Image.fromarray(pixels))
        states.append(state)
    save_json(FOLDER / 'poses.json', states)
    export(rig, frames)
    print(json.dumps({'name': rig['name'], 'frameCount': len(frames), 'durationMs': sum(rig['durationsMs']), 'bounds': [frames[i].getbbox() for i in [0, 12, 23]]}))


if __name__ == '__main__':
    main()
