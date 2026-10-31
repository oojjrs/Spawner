from pathlib import Path
from PIL import Image

folder=Path(__file__).resolve().parent
atlas=Image.open(folder/'Generation/ears-unlit.png').convert('RGBA')
for side,limits in [('near',(0,0,atlas.width//2,atlas.height)),('far',(atlas.width//2,0,atlas.width,atlas.height))]:
    patch=atlas.crop(limits)
    patch=patch.crop(patch.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox())
    lit=Image.open(folder/('Parts/ear-'+side+'.png')).convert('RGBA')
    bounds=lit.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
    registered=Image.new('RGBA',lit.size)
    registered.paste(patch.resize((bounds[2]-bounds[0],bounds[3]-bounds[1]),Image.Resampling.LANCZOS),bounds[:2])
    mask=Image.open(folder/('Expressions/ear-'+side+'-emission-mask.png')).convert('L')
    color=Image.composite(registered.convert('RGB'),lit.convert('RGB'),mask)
    Image.merge('RGBA',(*color.split(),lit.getchannel('A'))).save(folder/('Parts/ear-'+side+'-unlit.png'))