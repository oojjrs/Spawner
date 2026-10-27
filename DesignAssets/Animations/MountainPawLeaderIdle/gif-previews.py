from pathlib import Path
from PIL import Image
import json
import math
import sys

folder = Path(__file__).resolve().parent
planning = folder.parents[2] / 'DesignAssets/Planning/Animations/MountainPawLeaderIdle'
if planning.exists():
    folder = planning
background = (35, 43, 46)
for key in (sys.argv[1:] or ['walking-forest', 'white-paw', 'spiny-back-leader']):
    target = folder / key
    source = Image.open(target / 'idle-preview.webp')
    frames, durations = [], []
    for index in range(source.n_frames):
        source.seek(index)
        source.load()
        frame = Image.new('RGBA', source.size, background + (255,))
        frame.alpha_composite(source.convert('RGBA'))
        frames.append(frame.convert('RGB'))
        durations.append(source.info['duration'])
    palette_sheet = Image.new('RGB', (320, 80 * math.ceil(len(frames) / 4)), background)
    for index, frame in enumerate(frames):
        palette_sheet.paste(frame.resize((80, 80), Image.Resampling.LANCZOS), (index % 4 * 80, index // 4 * 80))
    palette = palette_sheet.quantize(256, Image.Quantize.MEDIANCUT)
    colors = palette.getpalette()
    background_index = min(range(256), **{'key': lambda index: sum((colors[index * 3 + channel] - background[channel]) ** 2 for channel in range(3))})
    indexed = [frame.quantize(**{'palette': palette, 'dither': Image.Dither.NONE}) for frame in frames]
    indexed[0].save(target / 'idle-preview.gif', 'GIF', **{'save_all': True, 'append_images': indexed[1:], 'duration': durations, 'loop': 0, 'disposal': 2, 'background': background_index, 'optimize': False})
    result = Image.open(target / 'idle-preview.gif')
    actual_duration = 0
    for index in range(result.n_frames):
        result.seek(index)
        actual_duration += result.info['duration']
    expected = json.loads((target / 'idle.json').read_text('utf-8'))['durationMs']
    if result.size != (320, 320) or result.info.get('loop') != 0 or actual_duration != expected:
        raise ValueError('GIF preview contract mismatch: ' + key)
    print(json.dumps({'key': key, 'file': str(target / 'idle-preview.gif'), 'size': result.size, 'frames': result.n_frames, 'durationMs': actual_duration, 'loop': 0}), flush=True)
