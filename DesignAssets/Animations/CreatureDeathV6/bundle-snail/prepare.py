from pathlib import Path
import json
from PIL import Image

folder = Path(__file__).resolve().parent
source = folder / 'Source'
authoring = json.loads((source / 'authoring.json').read_text('utf8'))
parts = folder / 'Parts'
parts.mkdir(**{'exist_ok': True})
for name, input_path in authoring['partInputs'].items():
    with Image.open(source / input_path) as image:
        image.save(parts / name)
(folder / 'rig.json').write_bytes((json.dumps(authoring['rig'], **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf8'))
print(json.dumps({'partsPrepared': len(authoring['partInputs'])}))
