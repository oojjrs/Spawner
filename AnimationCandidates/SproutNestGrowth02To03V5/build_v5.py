from pathlib import Path
from PIL import Image, ImageDraw, WebPImagePlugin
import numpy as np
import cv2
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parent.parent / '$Trash/SproutGrowth23V5'
NAMES = ['00-start', '01-closing', '02-small-hold', '03-middle-hold', '04-large-hold', '05-opening', '06-end']
INTERVALS = ['close1', 'close2', 'growth1', 'growth2', 'open1', 'open2']
PIVOT = np.array([256., 445.])


def read(path):
    return Image.open(path).convert('RGBA')


def write(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def anchor(image):
    a = np.array(image)
    ys, xs = np.where(a[250:500, 210:303, 3] > 180)
    bottom = int(ys.max()) + 250
    ys, xs = np.where(a[bottom-3:bottom+1, 210:303, 3] > 180)
    center = float(np.median(xs)) + 210
    return np.array([center, bottom], np.float64)


def silhouette_landmarks(image):
    a = np.array(image)
    ys, xs = np.where(a[:, :, 3] > 180)
    return np.float64([xs.min(), xs.max(), ys.min(), ys.max()])


def transform(image, scale, source_anchor):
    a = np.array(image).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    offset = PIVOT - source_anchor * scale
    matrix = np.float32([[scale[0], 0, offset[0]], [0, scale[1], offset[1]]])
    a = cv2.warpAffine(a, matrix, (512, 512), None, cv2.INTER_LANCZOS4, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
    a = np.clip(a, 0, 1)
    a[:, :, :3] /= np.maximum(a[:, :, 3:4], 1e-7)
    a[a[:, :, 3] < .004] = 0
    return Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + .5))


def normalized(interval, start, end):
    source = read(ROOT / 'Sources' / (interval + '.png'))
    w, h = source.size
    cels = []
    for i in range(4):
        cel = source.crop((i % 2 * w // 2, i // 2 * h // 2, (i % 2 + 1) * w // 2, (i // 2 + 1) * h // 2))
        side = max(cel.size)
        square = Image.new('RGBA', (side, side))
        square.alpha_composite(cel, ((side-cel.width)//2, (side-cel.height)//2))
        cels.append(square.resize((512, 512), Image.Resampling.LANCZOS))
    results = []
    records = []
    start_landmarks, end_landmarks = silhouette_landmarks(start), silhouette_landmarks(end)
    for i, cel in enumerate(cels):
        if interval == 'growth2' and i < 2:
            cel = read(ROOT/'Sources'/('growth2-cel'+str(i+1)+'-edit.png')).resize((512, 512), Image.Resampling.LANCZOS)
        point = anchor(cel)
        q = (i+1)/5
        source_landmarks = silhouette_landmarks(cel)
        target_landmarks = start_landmarks*(1-q)+end_landmarks*q
        source_size = source_landmarks[[1, 3]]-source_landmarks[[0, 2]]
        target_size = target_landmarks[[1, 3]]-target_landmarks[[0, 2]]
        scale = target_size/source_size
        results.append(transform(cel, scale, point))
        records.append({'cell': i, 'sourceAnchor': point.tolist(), 'sourceLandmarks': source_landmarks.tolist(), 'targetLandmarks': target_landmarks.tolist(), 'drawingScale': scale.tolist(), 'targetAnchor': PIVOT.tolist(), 'progress': q})
    return results, records


def background(image, size):
    result = Image.new('RGB', image.size, '#293338')
    result.paste(image, (0, 0), image.getchannel('A'))
    return result.resize((size, size), Image.Resampling.LANCZOS)


def animated(images, durations, path):
    images[0].encoderinfo = {'append_images': images[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'exact': True}
    with path.open('wb') as stream:
        WebPImagePlugin._save_all(images[0], stream, str(path))


def previews(images, destination, stem):
    data = b''.join(background(image, 512).tobytes() for image in images)
    base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', '512x512', '-framerate', '20', '-i', 'pipe:0']
    jobs = [(['-vf', 'split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0'], destination / (stem+'.gif')), (['-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'], destination / (stem+'.mp4'))]
    for options, path in jobs:
        process = subprocess.Popen(base+options+[str(path)], -1, None, subprocess.PIPE, subprocess.PIPE, subprocess.PIPE)
        stdout, stderr = process.communicate(data)
        if process.returncode:
            raise RuntimeError(stderr.decode('utf-8', 'replace'))


def contact(images, path):
    sheet = Image.new('RGB', (1536, 1080), '#293338')
    draw = ImageDraw.Draw(sheet)
    for i, image in enumerate(images):
        x, y = i % 3 * 512, i // 3 * 540
        draw.text((x+8, y+6), str(i*20)+'%', '#ffffff')
        sheet.paste(background(image, 512), (x, y+28))
    sheet.save(path)


def overview(images):
    sheet = Image.new('RGB', (1792, 1216), '#293338')
    draw = ImageDraw.Draw(sheet)
    for i, image in enumerate(images):
        x, y = i % 7 * 256, i // 7 * 243
        small = background(image, 216)
        sheet.paste(small, (x+20, y+23))
        draw.text((x+10, y+5), str(i).zfill(2)+(' KEY' if i % 5 == 0 else ''), '#ffffff')
    sheet.save(ROOT/'drawn-frames.png')
    detail = Image.new('RGB', (1800, 620), '#293338')
    draw = ImageDraw.Draw(detail)
    for i, image in enumerate(images[15:21]):
        x, y = i % 3 * 600, i // 3 * 310
        crop = background(image, 512).crop((22, 220, 434, 404)).resize((600, 268), Image.Resampling.LANCZOS)
        detail.paste(crop, (x, y+30))
        draw.text((x+10, y+6), str(i*20)+'%', '#ffffff')
    detail.save(ROOT/'mechanical-detail.png')


def representative():
    start, end = read(ROOT/'KeyPoses/03-middle-hold.png'), read(ROOT/'KeyPoses/04-large-hold.png')
    middle, records = normalized('growth2', start, end)
    drawings = [start]+middle+[end]
    frames = [start]*16+middle+[end]*16
    animated(drawings, [800, 50, 50, 50, 50, 800], TEMP/'growth2-representative.webp')
    previews(frames, TEMP, 'growth2-representative')
    contact(drawings, TEMP/'growth2-representative-contact.png')
    print('Representative:', len(frames), 'frames')


def build():
    for folder in ['Cels', 'Frames', 'Contacts']:
        (ROOT/folder).mkdir(511, True, True)
    keys = [read(ROOT/'KeyPoses'/(name+'.png')) for name in NAMES]
    cels = []
    normalization = {}
    for i, interval in enumerate(INTERVALS):
        middle, records = normalized(interval, keys[i], keys[i+1])
        normalization[interval] = records
        cels.extend([keys[i]]+middle)
        contact([keys[i]]+middle+[keys[i+1]], ROOT/'Contacts'/(interval+'.png'))
    cels.append(keys[-1])
    overview(cels)
    for i, cel in enumerate(cels):
        cel.save(ROOT/'Cels'/(str(i).zfill(2)+'.png'))
    sequence = []
    def append(index, count, phase):
        sequence.extend([{'cel': index, 'phase': phase} for _ in range(count)])
    append(0, 6, 'start-hold')
    for i in range(1, 10):
        append(i, 1, 'clump')
    append(10, 16, 'small-hold')
    for i in range(11, 15):
        append(i, 1, 'growth-1')
    append(15, 16, 'middle-hold')
    for i in range(16, 20):
        append(i, 1, 'growth-2')
    append(20, 16, 'large-hold')
    for i in range(21, 30):
        append(i, 2, 'open')
    append(30, 20, 'final-hold')
    frames = []
    for i, record in enumerate(sequence):
        record['frame'] = i
        record['timeMs'] = i*50
        cel = cels[record['cel']]
        frames.append(cel)
        cel.save(ROOT/'Frames'/(str(i).zfill(3)+'.png'))
    sheet = Image.new('RGBA', (4096, 2048))
    for i, image in enumerate(cels):
        sheet.paste(image, (i % 8 * 512, i // 8 * 512))
    sheet.save(ROOT/'growth-sheet.png')
    compressed, durations = [], []
    for record in sequence:
        if compressed and record['cel'] == compressed[-1]:
            durations[-1] += 50
        else:
            compressed.append(record['cel'])
            durations.append(50)
    animated([cels[i] for i in compressed], durations, ROOT/'growth.webp')
    previews(frames, ROOT, 'preview')
    write(ROOT/'timeline.json', sequence)
    write(ROOT/'normalization.json', normalization)
    write(ROOT/'animation.json', {'frameSize': [512, 512], 'pivotPixels': [256, 448], 'frameCount': len(sequence), 'celCount': len(cels), 'frameMs': 50, 'durationMs': len(sequence)*50, 'loopInGame': False, 'previewLoops': True, 'columns': 8, 'rows': 4, 'image': 'growth-sheet.png', 'animatedImage': 'growth.webp', 'frameFolder': 'Frames', 'celFolder': 'Cels', 'method': 'approved-seven-key-cels-and-twenty-four-imagegen-drawn-inbetweens', 'temporalPoseBlend': False, 'sourceKeyCelIndices': [0, 5, 10, 15, 20, 25, 30], 'holdDurationsMs': {'small': 800, 'middle': 800, 'large': 800}, 'materialMotion': 'drawn-occlusion-and-connected-wood-brass-assemblies'})
    print('Exported', len(cels), 'cels,', len(sequence), 'frames,', len(sequence)*50, 'ms')


if __name__ == '__main__':
    if sys.argv[1] == 'representative':
        representative()
    else:
        build()
