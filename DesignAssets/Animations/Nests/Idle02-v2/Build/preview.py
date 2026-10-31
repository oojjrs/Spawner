from pathlib import Path
import sys
from PIL import Image
from render import animated

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'DesignAssets/Animations/Nests/Idle02-v2'
sources = []
for tribe in ['spore', 'pebble', 'spring']:
    sheet = Image.open(BASE / tribe / 'idle.webp').convert('RGBA')
    frames = []
    for i in range(80):
        x, y = i % 10 * 512, i // 10 * 512
        frames.append(sheet.crop((x, y, x + 512, y + 512)).resize((256, 256), Image.Resampling.LANCZOS))
    sources.append(frames)
frames = []
for i in range(240):
    surface = Image.new('RGB', (768, 256), '#13201c')
    for slot, choices in enumerate(sources):
        ms = i * 50 % (6000 if slot == 1 else 4000)
        index = max(0, (ms - 2000) // 50) if slot == 1 else ms // 50
        frame = choices[index]
        surface.paste(frame, (slot * 256, 0), frame)
    frames.append(surface)
animated(frames, ROOT / 'DesignAssets/Planning/Previews/Nests/idle-stage-02-v2.webp', [50] * 240)
