import json
import shutil
from pathlib import Path

def main():
    here=Path(__file__).resolve().parent
    manifest=json.loads((here/'Source'/'bindings.json').read_text('utf-8'))
    target=here/'Parts'
    if not target.exists():target.mkdir()
    for name in manifest['activeParts']:
        shutil.copyfile(here/'Source'/'EditableParts'/name,target/name)
    print(here.name,len(manifest['activeParts']))

if __name__=='__main__':
    main()
