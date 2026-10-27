from pathlib import Path
from PIL import Image
import numpy as np
import json
import hashlib
import shutil
import math
import sys
import os

folder = Path(__file__).resolve().parent
root = folder.parents[2]
work = root / '$Trash/unique-idle-three-20261027'

def write_json(path, value):
    path.write_bytes((json.dumps(value, **{'ensure_ascii': False, 'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))

keys = sys.argv[1:] or ['walking-forest', 'white-paw', 'spiny-back-leader']
for key in keys:
    target = folder / key
    planning = root / 'DesignAssets/Planning/Animations/MountainPawLeaderIdle'
    output = planning / key if planning.exists() else target
    output.mkdir(511, True, True)
    rig_path = output / 'rig.json' if (output / 'rig.json').exists() else target / 'rig.json'
    rig = json.loads(rig_path.read_text('utf-8'))
    species = rig.get('species', key)
    frame_size = rig.get('frameSize', 512)
    preview = root / rig.get('thumbnailTarget', 'DesignAssets/UnitPreviews/' + key + '/idle.webp')
    if (root / 'DesignAssets/Planning/UnitPreviews').exists():
        preview = Path(preview.as_posix().replace('DesignAssets/UnitPreviews/', 'DesignAssets/Planning/UnitPreviews/'))
    if preview.exists():
        if (output / 'idle-thumbnail.webp').exists():
            if preview.read_bytes() != (output / 'idle-thumbnail.webp').read_bytes():
                raise ValueError('Unexpected pre-existing preview: ' + str(preview))
        elif not (output / 'idle.json').exists() or json.loads((output / 'idle.json').read_text('utf-8')).get('name') != species:
            raise ValueError('Unexpected pre-existing preview: ' + str(preview))
    timing = json.loads((work / key / 'timing.json').read_text('utf-8'))
    drawings, durations, hashes, original_indices = [], [], [], []
    previous = None
    for index, path in enumerate(sorted((work / key / 'Frames').glob('idle-*.png'))):
        frame = Image.open(path).convert('RGBA')
        frame_pixels = np.array(frame)
        frame_pixels[frame_pixels[:, :, 3] == 0] = 0
        frame = Image.fromarray(frame_pixels)
        digest = hashlib.sha256(frame.tobytes()).hexdigest()
        if previous == digest:
            durations[-1] += timing['durationsMs'][index]
        else:
            drawings.append(frame)
            durations.append(timing['durationsMs'][index])
            hashes.append(digest)
            original_indices.append(index)
            previous = digest
    columns = 8
    atlas = Image.new('RGBA', (frame_size * columns, frame_size * math.ceil(len(drawings) / columns)), (0, 0, 0, 0))
    for index, frame in enumerate(drawings):
        atlas.alpha_composite(frame, (index % columns * frame_size, index // columns * frame_size))
    atlas.save(output / 'idle.webp', 'WEBP', **{'lossless': True, 'method': 4})
    for filename, size in [('idle-preview.webp', 320), ('idle-thumbnail.webp', 64)]:
        frames = [frame.resize((size, size), Image.Resampling.LANCZOS) for frame in drawings]
        frames[0].save(output / filename, 'WEBP', **{'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True, 'method': 4, 'background': (0, 0, 0, 0)})
    pivot = rig.get('pivot', [256, 448])
    metadata = {'name': species, 'action': 'idle', 'designReference': '../../../CreatureConcepts/v3/' + species + '.png', 'frameSize': [frame_size, frame_size], 'columns': columns, 'frameCount': len(drawings), 'durationsMs': durations, 'durationMs': sum(durations), 'loop': True, 'rootMotion': False, 'pivotX': pivot[0], 'pivotY': pivot[1], 'atlas': 'idle.png', 'runtimeAtlas': 'idle.webp', 'preview': 'idle-preview.webp', 'rig': 'rig.json', 'renderer': rig.get('renderer', '../render.py'), 'sourceFrames': original_indices, 'frameSha256': hashes, 'source': 'Source', 'spineCompatibilityVerified': False}
    metadata['atlas'] = 'idle.webp'
    reference = root / 'DesignAssets/CreatureConcepts/v3' / (species + '.png')
    if not reference.exists():
        reference = root / 'DesignAssets/Planning/CreatureConcepts/v3' / (species + '.png')
    metadata['designReference'] = os.path.relpath(reference, output).replace('\\', '/')
    if output != target:
        metadata['rig'] = os.path.relpath(rig_path, output).replace('\\', '/')
        metadata['renderer'] = '../../../../Animations/MountainPawLeaderIdle/' + rig.get('renderer', '../render.py').removeprefix('../')
        metadata['source'] = '../../../../Animations/MountainPawLeaderIdle/' + key + '/Source'
    write_json(output / 'idle.json', metadata)
    preview.parent.mkdir(511, True, True)
    shutil.copyfile(output / 'idle-thumbnail.webp', preview)
    print(key, len(drawings), sum(durations), flush=True)
