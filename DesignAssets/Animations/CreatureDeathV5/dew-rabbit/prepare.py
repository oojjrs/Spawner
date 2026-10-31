import json
import shutil
from pathlib import Path
HERE=Path(__file__).resolve().parent
binding=json.loads((HERE/'Source/bindings.json').read_text('utf-8'))
for name in binding['activeParts']:
    shutil.copyfile(HERE/'Source/EditableParts'/name,HERE/'Parts'/name)
