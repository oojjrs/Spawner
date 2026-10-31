from pathlib import Path
import shutil

folder=Path(__file__).resolve().parent.parent
(folder/'Parts').mkdir(511,True,True)
for source in (folder/'Source/EditableParts').glob('*.png'):
    shutil.copyfile(source,folder/'Parts'/source.name)
