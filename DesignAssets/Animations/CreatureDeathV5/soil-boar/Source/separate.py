from pathlib import Path
import json
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=np.array(Image.open(root/'Source/approved-original.png').convert('RGBA'))
labels=np.array(Image.open(root/'Source/part-labels.png'))
names=json.loads((root/'Source/reference-registration.json').read_text('utf-8'))['labelNames']
for index,name in enumerate(names):
    part=source.copy()
    part[:,:,3]*=labels==index
    Image.fromarray(part).save(root/'Source/Visible'/(name+'.png'))
