from pathlib import Path
import shutil

folder=Path(__file__).resolve().parent.parent
for path in (folder/'Source/EditableParts').glob('*.png'):
    shutil.copyfile(path,folder/'Parts'/path.name)
