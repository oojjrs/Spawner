from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import json

folder = Path(__file__).resolve().parent
records = json.loads((folder/'Source/registration.json').read_bytes())
atlas = Image.open(folder/'Source/parts-atlas.png').convert('RGBA')
for record in records:
    raw = atlas.crop(record['atlasRect'])
    left,top,right,bottom = record['bindRect']
    part = Image.new('RGBA',(512,512))
    part.alpha_composite(raw.resize((right-left,bottom-top),Image.Resampling.LANCZOS),(left,top))
    part.save(folder/'Parts'/(record['part']+'.png'))
base = Image.open(folder/'Parts/head.png').convert('RGBA')
edit = Image.open(folder/'Source/eye-variant-drawing.png').convert('RGBA')
source_bounds = edit.getchannel('A').point(lambda value:255 if value>=32 else 0).getbbox()
target_bounds = base.getchannel('A').point(lambda value:255 if value>=32 else 0).getbbox()
paint = Image.new('RGBA',(512,512))
paint.alpha_composite(edit.crop(source_bounds).resize((target_bounds[2]-target_bounds[0],target_bounds[3]-target_bounds[1]),Image.Resampling.LANCZOS),target_bounds[:2])
mask = Image.new('L',(512,512))
pen = ImageDraw.Draw(mask)
rig = json.loads((folder/'rig.json').read_bytes())
for rectangle in rig['expressionPatchBoxes']:
    pen.ellipse(rectangle,255)
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
variant = Image.composite(paint,base,mask)
variant.putalpha(base.getchannel('A'))
variant.save(folder/'Parts/head-alternate.png')
