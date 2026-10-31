from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import json, math, hashlib
import numpy as np

FOLDER = Path(__file__).resolve().parent
SIZE = 512


def save_json(path, data):
    path.write_bytes((json.dumps(data, **{'ensure_ascii': False, 'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf-8'))


def ease(value):
    x = max(0, min(1, value))
    return x * x * (3 - 2 * x)


def move(image, dx, dy):
    if float(dx).is_integer() and float(dy).is_integer():
        output = Image.new('RGBA', (SIZE, SIZE))
        output.paste(image, (int(dx), int(dy)))
        return output
    return image.transform((SIZE, SIZE), Image.Transform.AFFINE, (1, 0, -dx, 0, 1, -dy), Image.Resampling.BICUBIC)


def main():
    rig = json.loads((FOLDER / 'rig.json').read_bytes())
    neutral = Image.open(FOLDER / 'Source/neutral.png').convert('RGBA')
    shell = Image.open(FOLDER / 'Parts/shell-hidden-complete.png').convert('RGBA')
    shell_fixed = Image.open(FOLDER / 'Parts/shell-fixed.png').convert('RGBA')
    parts = {name: Image.open(FOLDER / part['image']).convert('RGBA') for name, part in rig['parts'].items()}
    gates = {}
    for name, points in rig['gates'].items():
        gate = Image.new('L', (SIZE, SIZE), 0)
        ImageDraw.Draw(gate).polygon([tuple(point) for point in points], 255)
        gates[name] = gate
        gate.save(FOLDER / 'Parts' / (name + '-aperture.png'))
    shell_neutral = shell.copy()
    shell_neutral.alpha_composite(shell_fixed)
    ground_y = int(np.argwhere(np.asarray(neutral)[:, :, 3] >= 64)[:, 0].max())
    shell_ground_y = int(np.argwhere(np.asarray(shell_neutral)[:, :, 3] >= 64)[:, 0].max())
    settle_px = ground_y - shell_ground_y
    frames = []
    states = []
    moving_alpha = []
    root_drops = []
    for time in rig['timesMs']:
        frame = shell.copy()
        live = Image.new('RGBA', (SIZE, SIZE))
        for name in ['tail', 'hind', 'fore-far', 'head', 'fore-near']:
            amount = ease((time - rig['delaysMs'][name]) / 850)
            dx, dy = rig['retraction'][name]
            moved = move(parts[name], dx * amount, dy * amount)
            if amount > 0:
                moved.putalpha(ImageChops.multiply(moved.getchannel('A'), gates[name]))
            live.alpha_composite(moved)
        frame.alpha_composite(live)
        frame.alpha_composite(shell_fixed)
        output = np.asarray(frame).copy()
        fixed_pixels = np.asarray(shell_fixed)
        output[fixed_pixels[:, :, 3] > 0] = fixed_pixels[fixed_pixels[:, :, 3] > 0]
        drop = round(settle_px * ease((time - 850) / 500))
        frame = move(Image.fromarray(output), 0, drop)
        root_drops.append(drop)
        frames.append(frame)
        moving_alpha.append(int(np.asarray(live)[:, :, 3].sum()))
        states.append({'timeMs': time, 'headRetraction': ease((time - 100) / 850), 'allRigidPartsScale': [1, 1], 'shellTranslation': [0, root_drops[-1]], 'shellRotation': 0, 'movingAlphaSum': moving_alpha[-1]})
    columns = rig['columns']
    sheet = Image.new('RGBA', (SIZE * columns, SIZE * math.ceil(len(frames) / columns)))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index % columns * SIZE, index // columns * SIZE))
    sheet.save(FOLDER / 'death.webp', 'WEBP', **{'lossless': True, 'method': 4})
    durations = rig['durationsMs']
    options = {'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4}
    frames[0].save(FOLDER / 'preview.webp', 'WEBP', **options)
    small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
    small[0].save(FOLDER / 'thumbnail.webp', 'WEBP', **{**options, 'append_images': small[1:]})
    contact = Image.new('RGB', (1024, 560), '#27352f')
    pen = ImageDraw.Draw(contact)
    for cell, index in enumerate([0, 3, 6, 10, 14, 19, 25, len(frames) - 1]):
        image = frames[index].resize((256, 256), Image.Resampling.LANCZOS)
        x, y = cell % 4 * 256, cell // 4 * 280
        contact.paste(image, (x, y), image)
        pen.text((x + 8, y + 257), str(rig['timesMs'][index]) + ' ms', '#e6eedc')
    contact.save(FOLDER / 'contact.png')
    overlay = Image.blend(neutral, frames[0], .5)
    overlay.save(FOLDER / 'source-overlay.png')
    difference = np.abs(np.asarray(neutral).astype(np.int16) - np.asarray(frames[0]).astype(np.int16))
    fixed_mask = np.asarray(shell_fixed)[:, :, 3] > 0
    fixed_errors = []
    for frame, drop in zip(frames, root_drops):
        unshifted = move(frame, 0, -drop)
        fixed_errors.append(int(np.max(np.abs(np.asarray(unshifted).astype(np.int16)[fixed_mask] - np.asarray(shell_fixed).astype(np.int16)[fixed_mask]))))
    active = (np.asarray(neutral)[:, :, 3] > 0) | (np.asarray(frames[0])[:, :, 3] > 0)
    visible_difference = difference[active]
    metrics = {'neutralMaxChannelDifference': int(difference.max()), 'neutralChangedPixels': int(np.any(difference, 2).sum()), 'neutralVisibleMaxChannelDifference': int(visible_difference.max()), 'neutralVisibleChangedPixels': int(np.any(difference, 2)[active].sum()), 'rootTranslationYByFrame': root_drops, 'finalShellGroundY': int(np.argwhere(np.asarray(frames[-1])[:, :, 3] >= 64)[:, 0].max()), 'originalFootGroundY': ground_y, 'groundAlphaThreshold': 64, 'rootFinalDropPx': settle_px, 'shellMaxChannelDifferenceByFrame': fixed_errors, 'finalMovingAlphaSum': moving_alpha[-1], 'shellFixedPixelCount': int(fixed_mask.sum()), 'allRigidPartsScale': [1, 1], 'limbLengths': 'Unchanged: only translation into shell apertures, no scale or deformation.'}
    save_json(FOLDER / 'identity-check.json', metrics)
    save_json(FOLDER / 'poses.json', states)
    prefix = 'DesignAssets/Animations/CreatureDeathV2/' + rig['name'] + '/'
    metadata = {'name': rig['name'], 'action': 'death', 'sourceImage': rig['sourceImage'], 'sourceAnimation': rig['sourceAnimation'], 'image': prefix + 'death.webp', 'frameSize': SIZE, 'columns': columns, 'frameCount': len(frames), 'pivotX': rig['pivotX'], 'pivotY': rig['pivotY'], 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': prefix + 'preview.webp', 'thumbnail': prefix + 'thumbnail.webp', 'rig': prefix + 'rig.json', 'renderer': prefix + 'render.py', 'contact': prefix + 'contact.png', 'sourceOverlay': prefix + 'source-overlay.png', 'identityCheck': prefix + 'identity-check.json', 'method': rig['method'], 'sourceCanvas': [512,512], 'sourcePlacement': {'scale': [1,1], 'translation': [0,0], 'groundY': ground_y}, 'previewLoop': 0, 'spineCompatibilityVerified': False}
    save_json(FOLDER / 'death.json', metadata)
    print(json.dumps(metrics))


if __name__ == '__main__':
    main()
