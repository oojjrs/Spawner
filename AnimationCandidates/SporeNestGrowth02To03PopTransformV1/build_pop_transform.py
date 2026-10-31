from pathlib import Path
import json
import math
import random
import shutil
import subprocess
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image, ImageDraw, ImageFont

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03PopTransformV1')
temp = Path(r'H:\Spawner\$Trash\SporeNestGrowth02To03PopTransformV1')
sources = root / 'Sources'
cels_path = root / 'Cels'
for directory in [root, temp, sources, cels_path]:
    directory.mkdir(0o777, True, True)
phase = sys.argv[1]
atlas_path = Path(sys.argv[2])
spore_path = Path(sys.argv[3])
prompt_path = Path(sys.argv[4])
for source, target in [(atlas_path, sources / 'poses-original.png'), (spore_path, sources / 'spore-original.png')]:
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
atlas = Image.open(atlas_path).convert('RGBA')
if atlas.width != atlas.height * 3:
    raise ValueError(atlas.size)
cell = atlas.height
original_start = Path(r'H:\Spawner\DesignAssets\Animations\Nests\SporeLevel02-v4\References\level-02.png')
original_end = Path(r'H:\Spawner\DesignAssets\Animations\Nests\Idle03-v1\spore\poster.png')
shutil.copy2(original_start, cels_path / '00-start.png')
shutil.copy2(original_end, cels_path / '04-final.png')
names = ['01-prepare-first.png', '02-first-grown.png', '03-prepare-second.png']
registrations = []
for index, filename in enumerate(names):
    image = atlas.crop((index * cell, 0, (index + 1) * cell, cell)).resize((512, 512), Image.Resampling.LANCZOS)
    bounds = image.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()
    position = (256 - round((bounds[0] + bounds[2] - 1) / 2), 447 - (bounds[3] - 1))
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(image, position)
    canvas.save(cels_path / filename)
    registrations.append({'file': filename, 'sourceCell': index, 'canvasScale': 512 / cell, 'wholeCelTranslation': list(position)})
spore = Image.open(spore_path).convert('RGBA')
spore = spore.crop(spore.getchannel('A').getbbox())
spore.save(sources / 'spore.png')
filenames = ['00-start.png'] + names + ['04-final.png']
cels = [Image.open(cels_path / filename).convert('RGBA') for filename in filenames]
font = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 20)
board = Image.new('RGBA', (2560, 560), (239, 233, 220, 255))
draw = ImageDraw.Draw(board)
for index, image in enumerate(cels):
    draw.text((index * 512 + 14, 12), filenames[index], (41, 52, 47, 255), font)
    board.alpha_composite(image, (index * 512, 40))
board.convert('RGB').save(root / 'source-cels.png')
rng = random.Random(20261031)
particles = []
for event, count, origins, life_range in [(12, 10, [(55, 272), (455, 272), (256, 142)], (11, 14)), (40, 15, [(45, 248), (467, 248), (250, 118)], (13, 17))]:
    for index in range(count):
        origin = origins[index % len(origins)]
        direction = -1 if origin[0] < 200 else (1 if origin[0] > 310 else 0)
        vx = direction * rng.uniform(22, 30) if direction else rng.uniform(-24, 24)
        particles.append({'birth': event + index % 3, 'life': rng.randint(*life_range), 'origin': list(origin), 'vx': vx, 'vy': rng.uniform(-65, -35), 'size': rng.randint(8, 14), 'angle': rng.uniform(-75, 75)})
textures = []
for particle in particles:
    height = particle['size']
    width = max(1, round(height * spore.width / spore.height))
    texture = spore.resize((width, height), Image.Resampling.LANCZOS).rotate(particle['angle'], Image.Resampling.BICUBIC, True)
    textures.append(texture)

def pose_at(frame):
    index = 0 if frame < 8 else (1 if frame < 12 else (2 if frame < 36 else (3 if frame < 40 else 4)))
    offset = 0
    if 12 <= frame <= 20:
        progress = (frame - 12) / 8
        offset = -round(4 * 12 * progress * (1 - progress))
    if 40 <= frame <= 50:
        progress = (frame - 40) / 10
        offset = -round(4 * 16 * progress * (1 - progress))
    return index, offset

def render(frame):
    index, offset = pose_at(frame)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    for particle, texture in zip(particles, textures):
        age = frame - particle['birth']
        if age < 0 or age >= particle['life']:
            continue
        progress = age / particle['life']
        strength = math.sin(math.pi * (age + 1) / (particle['life'] + 1)) ** 0.7
        painted = texture.copy()
        painted.putalpha(texture.getchannel('A').point([round(value * strength) for value in range(256)]))
        x = round(particle['origin'][0] + particle['vx'] * progress - painted.width / 2)
        y = round(particle['origin'][1] + particle['vy'] * progress + 28 * progress * progress - painted.height / 2)
        canvas.alpha_composite(painted, (x, y))
    canvas.alpha_composite(cels[index], (0, offset))
    return canvas

count = 36 if phase == 'sample' else 78
output = temp / 'Sample' if phase == 'sample' else root / 'Preview'
frames_path = temp / 'SampleFrames' if phase == 'sample' else root / 'Frames'
output.mkdir(0o777, True, True)
frames_path.mkdir(0o777, True, True)
surfaces = [('dark', (24, 39, 35, 255))] if phase == 'sample' else [('dark', (24, 39, 35, 255)), ('light', (239, 233, 220, 255))]
opaque_paths = []
for name, color in surfaces:
    path = temp / (phase + '-' + name)
    path.mkdir(0o777, True, True)
    opaque_paths.append((name, color, path))
frame_records = []
for frame in range(count):
    image = render(frame)
    image.save(frames_path / f'frame-{frame:04d}.png')
    index, offset = pose_at(frame)
    frame_records.append({'frame': frame, 'cel': filenames[index], 'rootOffset': [0, offset]})
    for name, color, path in opaque_paths:
        opaque = Image.new('RGBA', (512, 512), color)
        opaque.alpha_composite(image, (0, 0))
        opaque.convert('RGB').save(path / f'frame-{frame:04d}.png')
for name, color, path in opaque_paths:
    arguments = ['ffmpeg', '-y', '-v', 'error', '-framerate', '24', '-i', str(path / 'frame-%04d.png'), '-frames:v', str(count), '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:new=0', '-loop', '0', str(output / ('growth-' + name + '.gif'))]
    subprocess.run(arguments).check_returncode()
if phase == 'full':
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '24', '-i', str(frames_path / 'frame-%04d.png'), '-frames:v', str(count), '-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '6', '-loop', '1', str(output / 'growth-transparent.webp')]).check_returncode()
    sheet = Image.new('RGBA', (5120, 4096), (0, 0, 0, 0))
    for frame in range(count):
        sheet.alpha_composite(Image.open(frames_path / f'frame-{frame:04d}.png').convert('RGBA'), ((frame % 10) * 512, (frame // 10) * 512))
    sheet.save(root / 'growth-sheet.png')
    metadata = {'directionAuthority': 'User delegated creative direction and execution: 네가 할 수 있는 선으로 해봐. 처음부터 다시.', 'construction': 'New whole-cel drawings, two deliberate growth cuts, small declared whole-unit hops, generated spore particles.', 'fps': 24, 'frameSize': [512, 512], 'root': [256, 448], 'frames': count, 'durationSeconds': count / 24, 'growthCutFrames': [12, 40], 'poseOpacityAnimation': False, 'particleOpacityAnimation': True, 'riggingUsed': False, 'celRegistrations': registrations, 'particles': particles, 'timeline': frame_records, 'sheet': {'file': 'growth-sheet.png', 'columns': 10, 'rows': 8, 'usedCells': count}}
    (root / 'animation.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
    (root / 'generation-prompts.json').write_bytes((json.dumps(json.loads(prompt_path.read_text('utf-8'))) + '\r\n').encode('utf-8'))
    code = Path(__file__).read_text('utf-8')
    (root / 'build_pop_transform.py').write_bytes(code.replace('\n', '\r\n').encode('utf-8'))
preview = Image.open(output / 'growth-dark.gif')
samples = [0, 8, 12, 16, 20, 35] if phase == 'sample' else [0, 8, 12, 16, 28, 38, 40, 45, 50, 58, 68, 77]
board = Image.new('RGB', (1536, math.ceil(len(samples) / 3) * 548), (24, 39, 35))
draw = ImageDraw.Draw(board)
for index, frame in enumerate(samples):
    preview.seek(frame)
    x = (index % 3) * 512
    y = (index // 3) * 548
    draw.text((x + 12, y + 6), f'frame {frame:02d} / {frame / 24:.2f}s', (235, 233, 220), font)
    board.paste(preview.convert('RGB'), (x, y + 36))
contact_path = output / 'decoded-contact.png' if phase == 'sample' else temp / 'full-decoded-contact.png'
board.save(contact_path)
print(output)
