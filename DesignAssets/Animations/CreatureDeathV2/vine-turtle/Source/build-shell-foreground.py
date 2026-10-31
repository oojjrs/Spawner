from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json

folder=Path(__file__).resolve().parent.parent
rig=json.loads((folder/'rig.json').read_bytes())
shell=Image.open(folder/'Parts/shell-hidden-complete.png').convert('RGBA')
mask=Image.new('L',(512,512),255)
draw=ImageDraw.Draw(mask)
for name,points in rig['gates'].items():
    draw.polygon([tuple(point) for point in points],0)
front=shell.copy()
front.putalpha(ImageChops.multiply(shell.getchannel('A'),mask))
front.save(folder/'Parts/shell-fixed.png')
mask.save(folder/'Source/shell-foreground-occlusion-mask.png')
