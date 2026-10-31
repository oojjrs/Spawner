from pathlib import Path
import json
import shutil

root = Path(__file__).resolve().parent.parent
data = json.loads((root / 'Source/authoring.json').read_text('utf-8'))
(root / 'Parts').mkdir(0o777, True, True)
for output, source in data['editablePartSources'].items():
    shutil.copyfile(root / source, root / output)
