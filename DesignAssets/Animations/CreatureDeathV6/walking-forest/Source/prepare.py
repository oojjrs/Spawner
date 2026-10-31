import json
import shutil
from pathlib import Path


source = Path(__file__).resolve().parent
manifest = json.loads((source / 'authoring.json').read_text('utf-8'))
for part in manifest['parts']:
    shutil.copyfile(source / part['source'], source.parent / part['output'])
print(json.dumps({'parts': len(manifest['parts'])}))
