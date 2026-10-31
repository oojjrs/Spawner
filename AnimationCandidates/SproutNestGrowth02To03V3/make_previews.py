from pathlib import Path
from PIL import Image
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
TEMP = ROOT.parent.parent / '$Trash/SproutGrowth23V3'
frames = []
if sys.argv[1]=='representative':
    source = Image.open(TEMP/'representative.webp')
    for i in range(source.n_frames):
        source.seek(i)
        source.load()
        duration = source.info.get('duration',50)
        frames.extend([source.convert('RGB').tobytes()]*round(duration/50))
    destination = TEMP
    stem = 'representative'
else:
    for path in sorted((ROOT/'Frames').glob('*.png')):
        source = Image.open(path).convert('RGBA')
        background = Image.new('RGB',(512,512),'#25332e')
        background.paste(source,(0,0),source.getchannel('A'))
        frames.append(background.resize((384,384),Image.Resampling.LANCZOS).tobytes())
    destination = ROOT
    stem = 'preview'
data = b''.join(frames)
base = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','384x384','-framerate','20','-i','pipe:0']
jobs = [(['-vf','split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4','-loop','0'],destination/(stem+'.gif')),(['-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-an'],destination/(stem+'.mp4'))]
for options,output in jobs:
    process = subprocess.Popen(base+options+[str(output)],-1,None,subprocess.PIPE,subprocess.PIPE,subprocess.PIPE)
    stdout,stderr = process.communicate(data)
    if process.returncode:
        raise RuntimeError(stderr.decode('utf-8','replace'))
    print('Saved '+output.name)
