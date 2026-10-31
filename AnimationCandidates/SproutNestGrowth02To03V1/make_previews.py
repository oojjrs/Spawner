from pathlib import Path
from PIL import Image
import subprocess

ROOT = Path(__file__).resolve().parent
frames = []
for index in range(100):
    source = Image.open(ROOT / 'Frames' / (str(index).zfill(3) + '.png')).convert('RGBA')
    background = Image.new('RGB', (512, 512), '#25332e')
    background.paste(source, (0, 0), source)
    frames.append(background.resize((384, 384), Image.Resampling.LANCZOS).tobytes())
data = b''.join(frames)
base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgb24', '-video_size', '384x384', '-framerate', '20', '-i', 'pipe:0']
for options, output in [(['-vf', 'split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0'], ROOT / 'preview.gif'), (['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'], ROOT / 'preview.mp4')]:
    process = subprocess.Popen(base + options + [str(output)], -1, None, subprocess.PIPE, subprocess.PIPE, subprocess.PIPE)
    stdout, stderr = process.communicate(data)
    if process.returncode:
        raise RuntimeError(stderr.decode('utf-8', 'replace'))
    print('saved', output.name, flush=True)
