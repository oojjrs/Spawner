import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, _webp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE / 'Source'
DURATIONS = [70, 210, 50, 300, 170, 220]


def save_json(path, value):
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    path.write_bytes((encoder.encode(value) + '\n').replace('\n', '\r\n').encode('utf-8'))


def save_webp(path, picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(), True, 100.0, 100.0, '', 6, 1, b'', ''))


def animate(path, frames):
    encoder = _webp.WebPAnimEncoder(frames[0].size, 0, 0, False, 9, 17, False, False)
    timestamp = 0
    durations = DURATIONS.copy()
    durations[-1] += 800
    for picture, duration in zip(frames, durations):
        encoder.add(picture.getim(), timestamp, True, 100.0, 100.0, 3)
        timestamp += duration
    encoder.add(None, timestamp, True, 100.0, 100.0, 0)
    path.write_bytes(encoder.assemble('', '', ''))


def specks(pixels):
    output = pixels.copy()
    support = np.uint8(output[:, :, 3] > 16)
    exterior_distance = cv2.distanceTransform(1 - support, cv2.DIST_L2, 5)
    output[:, :, 3] = np.where((output[:, :, 3] < 16) & (exterior_distance > 8), 0, output[:, :, 3])
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(output[:, :, 3] > 4), 8)
    substantial = np.zeros(output.shape[:2], np.uint8)
    for index in range(1, count):
        if stats[index, 4] >= 64:
            substantial[labels == index] = 1
    distance = cv2.distanceTransform(1 - substantial, cv2.DIST_L2, 5)
    for index in range(1, count):
        selected = labels == index
        if stats[index, 4] < 64 and float(distance[selected].min()) > 8:
            output[selected, 3] = 0
    return output


def isolate(picture):
    pixels = np.array(picture)
    count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(pixels[:, :, 3] > 16), 8)
    selected = [index for area, index in sorted([(-int(stats[index, 4]), index) for index in range(1, count)])[:6]]
    selected = [index for x, index in sorted([(float(centers[index, 0]), index) for index in selected])]
    distances = []
    for component in selected:
        distances.append(cv2.distanceTransform(np.uint8(labels != component), cv2.DIST_L2, 5))
    owners = np.argmin(np.stack(distances), 0)
    results = []
    for index in range(6):
        cel = pixels.copy()
        cel[:, :, 3] = np.where(owners == index, cel[:, :, 3], 0)
        results.append(cel)
    return results


def clean_edges(cel):
    pixels = cel.copy()
    alpha = pixels[:, :, 3]
    interior = cv2.erode(np.uint8(alpha > 128), np.ones((3, 3), np.uint8)) > 0
    red = (pixels[:, :, 0] > 210) & (pixels[:, :, 1] < 72) & (pixels[:, :, 2] < 64)
    yellow = (pixels[:, :, 0] > 199) & (pixels[:, :, 1] > 178) & (pixels[:, :, 2] < 64)
    neon_green = (pixels[:, :, 0] < 102) & (pixels[:, :, 1] > 191) & (pixels[:, :, 2] < 102)
    pixels[:, :, 3] = np.where((red | yellow | neon_green) & ~interior, 0, alpha)
    return pixels


def main():
    raw = Image.open(SOURCE / 'raw-drawn-strip.png').convert('RGBA')
    seed = Image.open(SOURCE / 'seed.png').convert('RGBA')
    source_cels = isolate(raw)
    seed_bounds = seed.getchannel('A').point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
    first_bounds = Image.fromarray(source_cels[0]).getchannel('A').point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
    scale = (seed_bounds[2] - seed_bounds[0]) / (first_bounds[2] - first_bounds[0])
    offset_x = seed_bounds[0] - first_bounds[0] * scale
    offset_y = seed_bounds[3] - first_bounds[3] * scale
    slot_width = raw.width / 6
    frames = []
    records = []
    (SOURCE / 'Frames').mkdir(511, True, True)
    for index, source_pixels in enumerate(source_cels):
        if index in [0, 5]:
            frame = seed.copy()
        else:
            pixels = clean_edges(source_pixels).astype(np.float32) / 255
            pixels[:, :, :3] *= pixels[:, :, 3:4]
            matrix = np.array([[scale, 0, offset_x - index * slot_width * scale], [0, scale, offset_y]], np.float32)
            warped = cv2.warpAffine(pixels, matrix, (512, 512), None, cv2.INTER_LANCZOS4, cv2.BORDER_CONSTANT)
            warped[:, :, :3] /= np.maximum(warped[:, :, 3:4], 1 / 255)
            frame = Image.fromarray(specks(np.uint8(np.clip(warped * 255 + .5, 0, 255))))
        frame.save(SOURCE / 'Frames' / ('pose-%02d.png' % (index + 1)), 'PNG')
        frames.append(frame)
        records.append({'index': index, 'file': 'Source/Frames/pose-%02d.png' % (index + 1), 'durationMs': DURATIONS[index], 'exactSeed': index in [0, 5], 'sourceCellOriginX': index * slot_width, 'sharedScale': scale, 'sharedOffset': [offset_x, offset_y], 'bounds': list(frame.getbbox())})
    atlas = Image.new('RGBA', (3072, 512), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.paste(frame, (index * 512, 0))
    save_webp(HERE / 'attack.webp', atlas)
    animate(HERE / 'attack-preview.webp', [frame.resize((256, 256), Image.Resampling.LANCZOS) for frame in frames])
    thumb = ROOT / 'DesignAssets/Planning/UnitPreviews/soil-boar/attack-v2.webp'
    thumb.parent.mkdir(511, True, True)
    animate(thumb, [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames])
    contact = Image.new('RGB', (1536, 282), (31, 42, 36))
    draw = ImageDraw.Draw(contact)
    for index, frame in enumerate(frames):
        small = frame.resize((256, 256), Image.Resampling.LANCZOS)
        contact.paste(small, (index * 256, 0), small)
        draw.text((index * 256 + 8, 260), '%d / %d ms' % (index + 1, DURATIONS[index]), (245, 246, 239))
    contact.save(HERE / 'contact.png', 'PNG')
    metadata = {'name': 'soil-boar', 'action': 'attack', 'status': 'representative awaiting actual playback review', 'image': 'DesignAssets/Animations/CreatureAttackV2/soil-boar/attack.webp', 'frameSize': 512, 'columns': 6, 'frameCount': 6, 'durationsMs': DURATIONS, 'durationMs': sum(DURATIONS), 'loop': False, 'rootMotion': True, 'rootMotionNote': 'Intentional short charge inside fixed sprite canvas: body mass moves left, near forehoof lifts and reaches, front hooves replant; returns exactly to neutral.', 'pivotX': 256, 'pivotY': 394, 'impactFrame': 3, 'hitAtMs': sum(DURATIONS[:3]), 'impactHoldMs': 300, 'previewPauseMs': 800, 'facing': 'left', 'provider': 'built-in image_gen', 'artworkMethod': 'Six full-body hand-drawn-style cels generated in one edit strip. Source cels 2-5 newly drawn; first and last locked to shipped neutral. No local mesh deformation, crossfade, synthetic tweening, or per-frame rescaling.', 'motion': 'Weight shifts back and up with a lifted forehoof, rapid short charge, low tusk shove with replanted forehooves and 300ms contact hold, weight recoil, exact return.', 'source': 'Source/raw-drawn-strip.png', 'seed': 'Source/seed.png', 'editCanvas': 'Source/edit-canvas.png', 'prompt': 'Source/prompt.txt', 'renderer': 'export.py', 'preview': 'attack-preview.webp', 'contact': 'contact.png', 'thumbnail': 'DesignAssets/Planning/UnitPreviews/soil-boar/attack-v2.webp', 'normalization': 'Official build_sprite_edit_canvas.py and normalize_sprite_strip.py used; export wrapper keeps one shared affine map of original slot coordinates to preserve intentional root and hoof trajectories. Connected components only isolate overhanging tail/hoof pixels crossing nominal cell boundaries.', 'normalizationScale': scale, 'normalizationOffset': [offset_x, offset_y], 'firstAndLastFrameIdentical': True, 'frames': records}
    save_json(HERE / 'attack.json', metadata)
    save_json(SOURCE / 'normalization.json', {'rawSize': list(raw.size), 'sourceSlots': 6, 'slotWidth': slot_width, 'sharedScale': scale, 'sharedOffset': [offset_x, offset_y], 'perFrameFit': False, 'perFrameTranslation': False, 'firstAndLastLockedToSeed': True, 'edgeCleanup': 'Only exterior neon matte fringe, detached components smaller than64px farther than8px from substantive artwork, and alpha below16 farther than8px from visible artwork are cleared. Raw source and exact seed are preserved.', 'frames': records})
    print('soil-boar: six drawn cels, contact at330ms held300ms, total1020ms, shared scale', scale)


if __name__ == '__main__':
    main()
