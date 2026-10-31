from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FOLDER = Path(__file__).resolve().parent
SIZE = 512


def save_json(path, value):
    text = json.dumps(value, **{'ensure_ascii': False, 'indent': 2}) + '\n'
    path.write_bytes(text.replace('\n', '\r\n').encode('utf-8'))


def clean(image):
    pixels = np.asarray(image.convert('RGBA')).copy()
    r, g, b, alpha = [pixels[:, :, index] for index in range(4)]
    foreign = ((r > 220) & (g < 75) & (b < 100)) | ((g > 220) & (r < 140) & (b < 130)) | ((r > 220) & (g > 220) & (b < 90))
    pixels[(alpha < 28) | foreign] = 0
    binary = np.uint8(pixels[:, :, 3] >= 60) * 255
    mask = Image.fromarray(binary).filter(ImageFilter.MaxFilter(3))
    active_y, active_x = np.where(binary > 0)
    if len(active_x) == 0:
        return Image.fromarray(pixels)
    x, y = active_x.mean(), active_y.mean()
    seed = int(np.argmin((active_x - x) ** 2 + (active_y - y) ** 2))
    ImageDraw.floodfill(mask, (int(active_x[seed]), int(active_y[seed])), 128)
    pixels[np.asarray(mask) != 128] = 0
    return Image.fromarray(pixels)


def row_ranges(sheet):
    array = np.asarray(sheet)
    occupied = (array[:, :, 3] > 160).sum(1) > 30
    groups = []
    for y in np.where(occupied)[0]:
        if groups and y - groups[-1][-1] < 10:
            groups[-1].append(int(y))
        else:
            groups.append([int(y)])
    if len(groups) != 4:
        raise ValueError('Expected four separated art rows, found ' + str([(group[0], group[-1]) for group in groups]))
    boundaries = [0] + [(left[-1] + right[0]) // 2 for left, right in zip(groups, groups[1:])] + [sheet.height]
    return list(zip(boundaries, boundaries[1:]))


def main():
    config = json.loads((FOLDER / 'drawing.json').read_bytes())
    raw = Image.open(FOLDER / config['sourceSheet']).convert('RGBA')
    source = np.asarray(raw).copy()
    r, g, b, alpha = [source[:, :, index] for index in range(4)]
    foreign = ((r > 220) & (g < 75) & (b < 100)) | ((g > 220) & (r < 140) & (b < 130)) | ((r > 220) & (g > 220) & (b < 90))
    source[(alpha < 28) | foreign] = 0
    source = Image.fromarray(source)
    rows = row_ranges(source)
    drawings = []
    crops = []
    for top, bottom in rows:
        for column in range(4):
            left, right = round(column * source.width / 4), round((column + 1) * source.width / 4)
            crops.append([left, top, right, bottom])
            drawings.append(clean(source.crop((left, top, right, bottom))))
    reference = Image.open(FOLDER / config['sourceNeutral']).convert('RGBA')
    original_bounds = reference.getbbox()
    first_bounds = drawings[0].getbbox()
    scale = (original_bounds[2] - original_bounds[0]) / (first_bounds[2] - first_bounds[0])
    ground = original_bounds[3] - 1
    horizontal = (original_bounds[0] + original_bounds[2]) / 2 - (first_bounds[0] + first_bounds[2]) / 2 * scale
    frames = []
    registrations = []
    (FOLDER / 'Drawings').mkdir(511, True, True)
    for index, drawing in enumerate(drawings):
        bounds = drawing.getbbox()
        vertical = ground - bounds[3] * scale
        sized = drawing.resize((round(drawing.width * scale), round(drawing.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (SIZE, SIZE))
        frame.alpha_composite(sized, (round(horizontal), round(vertical)))
        frame.save(FOLDER / 'Drawings' / (str(index).zfill(2) + '.png'))
        frames.append(frame)
        registrations.append({'frame': index, 'sourceCrop': crops[index], 'scale': scale, 'translation': [round(horizontal), round(vertical)], 'groundContactY': ground})
    columns = config['columns']
    atlas = Image.new('RGBA', (SIZE * columns, SIZE * math.ceil(len(frames) / columns)))
    for index, frame in enumerate(frames):
        atlas.paste(frame, (index % columns * SIZE, index // columns * SIZE))
    atlas.save(FOLDER / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4})
    durations = config['durationsMs']
    options = {'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'minimize_size': False}
    frames[0].save(FOLDER / 'preview.webp', 'WEBP', **options)
    small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
    small[0].save(FOLDER / 'thumbnail.webp', 'WEBP', **{**options, 'append_images': small[1:]})
    contact = Image.new('RGB', (1024, 560), '#27352f')
    pen = ImageDraw.Draw(contact)
    for cell, index in enumerate([0, 2, 4, 6, 8, 10, 12, 15]):
        frame = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
        x, y = cell % 4 * 256, cell // 4 * 280
        contact.paste(frame, (x, y), frame)
        pen.text((x + 8, y + 258), str(sum(durations[:index])) + ' ms / cel ' + str(index + 1), '#e6eedc')
    contact.save(FOLDER / 'contact.png')
    prefix = 'DesignAssets/Animations/CreatureDeathV1/' + config['name'] + '/'
    placement = {'canvas': [SIZE, SIZE], 'scale': scale, 'horizontalTranslation': horizontal, 'groundContactY': ground, 'sourceRows': rows, 'registration': 'All cels use one common scale and horizontal anchor. Per-cel vertical translation registers the drawn foot/belly ground contact; there is no per-cel fitting or scaling.'}
    metadata = {'name': config['name'], 'action': 'death', 'sourceImage': config['sourceImage'], 'sourceAnimation': config['sourceAnimation'], 'image': prefix + 'death.webp', 'frameSize': SIZE, 'columns': columns, 'frameCount': len(frames), 'pivotX': 256, 'pivotY': ground, 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'renderer': prefix + 'pack_drawn.py', 'rig': prefix + 'rig.json', 'rigUsed': False, 'drawing': prefix + 'drawing.json', 'sourceSheet': prefix + config['sourceSheet'], 'contact': prefix + 'contact.png', 'canvasPlacement': placement, 'method': config['method'], 'rootMotion': 'Drawn body collapse; settled belly/head retains the common ground contact.', 'provider': 'built-in image_gen', 'previewLoop': 'The preview repeats for inspection; runtime death is non-looping and holds the settled pose.'}
    save_json(FOLDER / 'death.json', metadata)
    save_json(FOLDER / 'drawn-registration.json', registrations)
    print(json.dumps({'name': config['name'], 'frameCount': len(frames), 'durationMs': sum(durations), 'scale': scale, 'groundContactY': ground, 'sourceRows': rows}))


if __name__ == '__main__':
    main()
