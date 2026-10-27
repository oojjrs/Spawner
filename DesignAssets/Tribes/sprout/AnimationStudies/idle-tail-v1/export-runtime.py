from pathlib import Path
from PIL import Image
import shutil
import subprocess

folder = Path(__file__).parent
root = folder.parents[4]
out = root / 'DesignAssets/Tribes/sprout/Animations/Attributes/decomposition-idle-v1'
work = root / '$Trash/bean-tail-install-20261027'
work.mkdir(511, True, True)
out.mkdir(511, True, True)
for name in ['basic', 'antenna', 'tail']:
    source = Image.open(folder / (name + '-idle.webp')).convert('RGBA')
    atlas = Image.new('RGBA', (2048, 4096), (0, 0, 0, 0))
    for index in range(128):
        x, y = index % 8 * 512, index // 8 * 512
        frame = source.crop((x, y, x + 512, y + 512)).resize((256, 256), Image.Resampling.LANCZOS)
        atlas.paste(frame, (index % 8 * 256, index // 8 * 256))
    path = work / (name + '-runtime.png')
    atlas.save(path)
    subprocess.check_call([shutil.which('magick'), str(path), '-define', 'webp:lossless=true', str(out / (name + '.webp'))])
    print(name + ' runtime atlas exported', flush=True)
