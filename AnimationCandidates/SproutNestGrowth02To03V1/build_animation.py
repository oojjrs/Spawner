from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, WebPImagePlugin
import numpy as np
import concurrent.futures
import json
import hashlib
import frame_interpolation as neural
from rigid_assembly import Assembly

ROOT = Path(__file__).resolve().parent
FRAMES = ROOT / 'Frames'
TIMES = [500, 950, 1400, 2100, 2450, 3000, 3600, 3850, 4100]


def write(path, value):
    path.write_bytes((json.dumps(value) + '\r\n').encode('utf-8'))


def animated(images, path, loops):
    images[0].encoderinfo = {'append_images': images[1:], 'duration': [50] * len(images), 'loop': loops, 'lossless': True, 'method': 4, 'minimize_size': False}
    with path.open('wb') as output:
        WebPImagePlugin._save_all(images[0], output, str(path))


def register(image):
    a = np.array(image.getchannel('A'))
    ys, xs = np.where(a > 127)
    y = int(ys.max())
    foot = xs[ys >= y - 4]
    delta = (round(256 - (float(foot.min()) + float(foot.max())) / 2), 448 - y - 1)
    result = Image.new('RGBA', (512, 512))
    result.alpha_composite(image, delta)
    return result, list(delta)


def build():
    FRAMES.mkdir(511, True, True)
    neural.prepare()
    tasks, sources = [], []
    for frame in range(100):
        time = frame * 50
        if time <= 500:
            sources.append({'frame': frame, 'timeMs': time, 'key': 0})
            continue
        if time >= 4100:
            sources.append({'frame': frame, 'timeMs': time, 'key': 8})
            continue
        exact = next((i for i, value in enumerate(TIMES) if value == time), None)
        if exact is not None:
            sources.append({'frame': frame, 'timeMs': time, 'key': exact})
            continue
        key = max(i for i in range(8) if TIMES[i] < time)
        t = round((time - TIMES[key]) / (TIMES[key + 1] - TIMES[key]), 7)
        pairs = [(20, 30), (21, 31)] if key == 2 else [(key, key + 1)]
        for a, b in pairs:
            for kind in ['RGB', 'Alpha']:
                name = str(a) + '-' + str(b) + '-' + str(t) + '-' + kind + '.png'
                tasks.append((a, b, t, kind, name))
        sources.append({'frame': frame, 'timeMs': time, 'fromKey': key, 'toKey': key + 1, 'fraction': t, 'rigidAssembly': key == 2})
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        for i, result in enumerate(pool.map(neural.execute, tasks)):
            if (i + 1) % 24 == 0:
                print('motion samples', i + 1, '/', len(tasks), flush=True)
    assembly = Assembly()
    assembly.save()
    images, offsets = [], []
    for entry in sources:
        if 'key' in entry:
            image = Image.open(ROOT / 'KeyPoses' / ('K' + str(entry['key']) + '.png')).convert('RGBA')
            offset = [0, 0]
        elif entry['rigidAssembly']:
            t = entry['fraction']
            image = assembly.render(t)
            image.alpha_composite(neural.reconstruct(20, 30, t))
            image.alpha_composite(neural.reconstruct(21, 31, t))
            image, offset = register(image)
        else:
            image = neural.reconstruct(entry['fromKey'], entry['toKey'], entry['fraction'])
            image, offset = register(image)
        image.save(FRAMES / (str(entry['frame']).zfill(3) + '.png'))
        images.append(image)
        offsets.append(offset)
    atlas = Image.new('RGBA', (5120, 5120))
    previews = []
    contact = Image.new('RGB', (1536, 1680), '#25332e')
    draw = ImageDraw.Draw(contact)
    font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
    for index, image in enumerate(images):
        atlas.paste(image, (index % 10 * 512, index // 10 * 512))
        back = Image.new('RGB', (512, 512), '#25332e')
        back.paste(image, (0, 0), image)
        previews.append(back.resize((384, 384), Image.Resampling.LANCZOS))
        if index % 3 == 0:
            slot = index // 3
            pos = (slot % 6 * 256, slot // 6 * 280 + 24)
            contact.paste(back.resize((256, 256), Image.Resampling.LANCZOS), pos)
            draw.text((pos[0] + 8, pos[1] - 23), str(round(index * 0.05, 2)) + 's', '#ffffff', font)
    atlas.save(ROOT / 'growth-sheet.png')
    contact.save(ROOT / 'playback-contact.png')
    animated(images, ROOT / 'growth.webp', 1)
    animated(previews, ROOT / 'preview.webp', 0)
    write(ROOT / 'frame-sources.json', sources)
    write(ROOT / 'root-offsets.json', offsets)
    write(ROOT / 'animation.json', {'frameSize': [512, 512], 'frameCount': 100, 'columns': 10, 'rows': 10, 'frameMs': 50, 'durationsMs': [50] * 100, 'periodMs': 5000, 'pivot': [256, 448], 'rootMotion': False, 'loop': False, 'image': 'growth-sheet.png', 'animatedImage': 'growth.webp', 'keyTimesMs': [0] + TIMES[1:], 'holdStartUntilMs': 500, 'holdEndFromMs': 4100, 'method': 'imagegen-drawn-keyposes-motion-compensated-inbetweens-and-rigid-growth-attachments', 'interpolation': 'local-RIFE-v4.6', 'matte': 'opaque-geometric-silhouette-with-edge-antialiasing', 'poseOpacityBlend': False, 'rig': 'assembly-rig.json', 'sourceFrames': 'Frames', 'sourceKeys': 'KeyPoses', 'sourceProvider': 'OpenAI-built-in-imagegen', 'keyframeApproval': '2026-10-31 user: 흠, 계속해봐', 'endpointSha256': {name: hashlib.sha256((ROOT / 'Sources' / name).read_bytes()).hexdigest() for name in ['level-02.png', 'level-03.png']}})
    print('5-second / 100-frame candidate rendered', flush=True)


if __name__ == '__main__':
    build()
