from pathlib import Path
import json
import shutil
import subprocess
import sys
sys.path.insert(0, r'H:\Spawner\$Trash\creature-emergence-20261030\python')
from PIL import Image

root = Path(r'H:\Spawner\AnimationCandidates\SporeNestGrowth02To03RedrawV2')
output = root / 'GrowthPreviewV1'
temp = Path(r'H:\Spawner\$Trash\SporeNestGrowth02To03RedrawV2\GrowthPreviewV1')
output.mkdir(0o777, True, True)
temp.mkdir(0o777, True, True)
steps = [('03-closed-small.png', 14), ('04-closed-medium.png', 12), ('05-closed-adult.png', 16)]
for surface, color in [('transparent', None), ('dark', (24, 39, 35, 255)), ('light', (239, 233, 220, 255))]:
    directory = temp / surface
    directory.mkdir(0o777, True, True)
    index = 0
    for filename, count in steps:
        source = root / 'Keyposes' / filename
        first = directory / f'frame-{index:04d}.png'
        if color is None:
            shutil.copy2(source, first)
        else:
            background = Image.new('RGBA', (512, 512), color)
            background.alpha_composite(Image.open(source).convert('RGBA'), (0, 0))
            background.convert('RGB').save(first)
        for offset in range(1, count):
            shutil.copy2(first, directory / f'frame-{index + offset:04d}.png')
        index += count
    source_pattern = str(directory / 'frame-%04d.png')
    base = ['ffmpeg', '-y', '-v', 'error', '-framerate', '24', '-i', source_pattern, '-frames:v', '42']
    if color is None:
        arguments = ['-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '6', '-loop', '0', str(output / 'growth-transparent.webp')]
    else:
        arguments = ['-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none:new=0', '-loop', '0', str(output / f'growth-{surface}.gif')]
    subprocess.run(base + arguments).check_returncode()
metadata = {'approval': {'message': '좋아, 계속해', 'approvedKeyVersion': 'SporeNestGrowth02To03RedrawV2/Keyposes'}, 'frameSize': [512, 512], 'fps': 24, 'frames': 42, 'durationSeconds': 1.75, 'stages': [{'source': filename, 'holdFrames': count} for filename, count in steps], 'growthCutsAtFrames': [14, 26], 'construction': 'Complete approved key drawings held unchanged, with instantaneous whole-pose cuts at the two growth events.', 'rigging': False, 'interpolatedGrowthFrames': False, 'poseOpacityAnimation': False}
(output / 'timeline.json').write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
current = json.loads((root / 'keyposes.json').read_text('utf-8'))
current['state'] = 'user-keyposes-approved'
current['approvalMessage'] = '좋아, 계속해'
(root / 'keyposes.json').write_bytes((json.dumps(current) + '\r\n').encode('utf-8'))
code = Path(__file__).read_text('utf-8')
(output / 'build_growth_preview.py').write_bytes(code.replace('\n', '\r\n').encode('utf-8'))
print(output)
