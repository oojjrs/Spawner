from pathlib import Path
import json
import shutil
import runpy

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'Source/authoring.json').read_text('utf-8'))
for output, source in data['editablePartSources'].items():
    shutil.copyfile(root / source, root / output)
runpy.run_path(str(root / 'Source/pouch-fields.py'))
