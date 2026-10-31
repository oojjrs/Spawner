from pathlib import Path
from PIL import Image
import json

folder=Path(__file__).resolve().parent
source=folder/'Source'
authoring=json.loads((source/'authoring.json').read_text('utf-8'))
(folder/'Parts').mkdir(**{'exist_ok':True})
for name,path in authoring['editableParts'].items(): Image.open(source/path).save(folder/'Parts'/(name+'.png'))
