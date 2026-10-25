from pathlib import Path
import json
import math
import random
import subprocess
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parents[3]
settings = json.loads((folder / 'emitter.json').read_bytes())
work = root / '$Trash' / 'sand-burst-20261025' / 'frames'
work.mkdir(parents=True, exist_ok=True)
size = settings['frameSize']
base = Image.open(root / settings['source']).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
grain = Image.open(folder / settings['grain']).convert('RGBA')
rng = random.Random(settings['seed'])
particles = []
for burst in settings['bursts']:
    for index in range(burst['count']):
        spread = rng.uniform(-1, 1)
        speed = rng.uniform(370, 495) * (1 - abs(spread) * 0.12)
        particles.append({
            'time': burst['time'] + rng.uniform(0, 0.045),
            'x': burst['origin'][0] + rng.uniform(-5, 5),
            'y': burst['origin'][1] + rng.uniform(-2, 2),
            'vx': spread * 170 + burst['direction'] * 18,
            'vy': -speed,
            'size': rng.uniform(0.8, 2.7) if index % 9 else rng.uniform(3, 4),
            'angle': rng.uniform(0, 360),
            'spin': rng.uniform(-180, 180),
            'landing': rng.uniform(184, 199)
        })

frames = []
for index in range(settings['frameCount']):
    now = index * settings['frameMs'] / 1000
    overlay = Image.new('RGBA', (size * 3, size * 3), (0, 0, 0, 0))
    for particle in particles:
        age = now - particle['time']
        if age <= 0:
            continue
        x = particle['x'] + particle['vx'] * age
        y = particle['y'] + particle['vy'] * age + settings['gravity'] * age * age / 2
        if settings['gravity'] * age + particle['vy'] > 0 and y >= particle['landing']:
            continue
        width = max(2, round(particle['size'] * 3))
        sprite = grain.resize((width, width), Image.Resampling.LANCZOS)
        sprite = sprite.rotate(particle['angle'] + particle['spin'] * age, Image.Resampling.BICUBIC, True)
        overlay.alpha_composite(sprite, (round(x * 3 - sprite.width / 2), round(y * 3 - sprite.height / 2)))
    frame = base.copy()
    frame.alpha_composite(overlay.resize((size, size), Image.Resampling.LANCZOS))
    frame.save(work / ('frame-%02d.png' % index))
    frames.append(frame)

rows = math.ceil(len(frames) / settings['columns'])
sheet = Image.new('RGBA', (size * settings['columns'], size * rows), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.alpha_composite(frame, (index % settings['columns'] * size, index // settings['columns'] * size))
sheet.save(folder / 'harvest-sheet.png')
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(1000 / settings['frameMs']),
    '-i', str(work / 'frame-%02d.png'), '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0',
    str(folder / 'sand-harvest.webp')
]).check_returncode()
metadata = {
    'source': settings['source'], 'frameWidth': size, 'frameHeight': size,
    'frameCount': settings['frameCount'], 'columns': settings['columns'], 'rows': rows,
    'durationsMs': [settings['frameMs']] * settings['frameCount'],
    'cycleMs': settings['frameMs'] * settings['frameCount'], 'loop': True,
    'preview': 'sand-harvest.webp', 'sheet': 'harvest-sheet.png',
    'sourceMethod': 'Locked sand artwork with ballistic instances of the existing sand grain part.',
    'emitter': 'emitter.json', 'renderer': 'render.py', 'runtimeIntegrated': True,
    'runtime': {'contactFrame': settings['contactFrame'], 'settleFrame': settings['settleFrame'], 'postSeconds': 0.6},
    'pivot': settings['pivot'], 'viewSize': settings['viewSize']
}
(folder / 'animation.json').write_bytes((json.dumps(metadata, ensure_ascii=False, indent=2) + '\n').replace('\n', '\r\n').encode('utf-8'))
