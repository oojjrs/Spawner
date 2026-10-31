from pathlib import Path
from PIL import Image
import json

folder=Path(__file__).resolve().parent
authoring=json.loads((folder/'Source/authoring.json').read_text('utf-8'))
for name,source in authoring['boundLayers'].items():
    with Image.open(folder/source) as image:
        image.convert('RGBA').save(folder/'Parts'/(name+'.png'))
print(json.dumps({'name':folder.name,'preparedLayers':len(authoring['boundLayers'])}))
