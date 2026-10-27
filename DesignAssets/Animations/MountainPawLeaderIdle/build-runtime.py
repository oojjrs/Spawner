from pathlib import Path
from PIL import Image
import json
import hashlib
import sys

folder = Path(__file__).resolve().parent
root = folder.parents[2]
for key in (sys.argv[1:] or ['walking-forest', 'spiny-back-leader']):
    target = folder / key
    planning = root / 'DesignAssets/Planning/Animations/MountainPawLeaderIdle' / key
    source_folder = planning if planning.exists() else target
    metadata = json.loads((source_folder / 'idle.json').read_text('utf-8'))
    species = metadata['name']
    target = folder / species
    target.mkdir(511, True, True)
    frame_size = metadata['frameSize'][0] // 2
    source = Image.open(source_folder / 'idle.webp').convert('RGBA')
    runtime = source.resize((source.width // 2, source.height // 2), Image.Resampling.LANCZOS)
    runtime.save(target / 'idle-runtime.webp', 'WEBP', **{'lossless': True, 'method': 4})
    record = {'image': 'DesignAssets/Animations/MountainPawLeaderIdle/' + species + '/idle-runtime.webp', 'frameSize': frame_size, 'columns': metadata['columns'], 'durationsMs': metadata['durationsMs'], 'loop': True, 'pivotX': metadata['pivotX'] / 2, 'pivotY': metadata['pivotY'] / 2, 'sourceAtlasSha256': hashlib.sha256((source_folder / 'idle.webp').read_bytes()).hexdigest(), 'sourceScale': 0.5}
    (target / 'runtime.json').write_bytes((json.dumps(record, **{'ensure_ascii': False, 'indent': 2}).replace('\n', '\r\n') + '\r\n').encode('utf-8'))
    print(key, runtime.size, (target / 'idle-runtime.webp').stat().st_size, flush=True)
