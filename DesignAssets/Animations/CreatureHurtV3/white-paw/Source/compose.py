from pathlib import Path
from PIL import Image
import json

source=Path(__file__).resolve().parent
folder=source.parent
timeline=json.loads((folder/'timeline.json').read_text('utf8'))
seed=Image.open(source/'seed.png').convert('RGBA')
for expression in ['half','pain']:
    image=seed.copy()
    for layer in timeline['expressionLayers']:
        texture=Image.open(folder/layer['texture']).convert('RGBA')
        mask=Image.open(folder/layer[expression+'Mask']).convert('L')
        image=Image.composite(texture,image,mask)
    image.save(source/(expression+'.png'))
