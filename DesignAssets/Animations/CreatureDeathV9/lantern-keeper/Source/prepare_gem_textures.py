from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter

folder=Path(__file__).resolve().parent
atlas=Image.open(folder/'Generation/gems-unlit.png').convert('RGBA')
third=atlas.width//3
for index,side in enumerate(['near','far']):
    patch=atlas.crop((index*third,0,(index+1)*third,atlas.height))
    patch=patch.crop(patch.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox())
    lit=Image.open(folder/('Parts/drop-'+side+'.png')).convert('RGBA')
    bounds=lit.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
    color=lit.convert('RGB')
    color.paste(patch.resize((bounds[2]-bounds[0],bounds[3]-bounds[1]),Image.Resampling.LANCZOS).convert('RGB'),bounds[:2])
    Image.merge('RGBA',(*color.split(),lit.getchannel('A'))).save(folder/('Parts/drop-'+side+'-unlit.png'))
patch=atlas.crop((2*third,0,atlas.width,atlas.height))
patch=patch.crop(patch.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()).resize((65,79),Image.Resampling.LANCZOS)
for state in ['open','half','closed']:
    lit=Image.open(folder/('Parts/head-'+state+'.png')).convert('RGBA')
    registered=lit.convert('RGB');registered.paste(patch.convert('RGB'),(166,7))
    mask=Image.new('L',lit.size);draw=ImageDraw.Draw(mask)
    draw.polygon([(171,10),(184,15),(197,25),(206,38),(210,51),(206,61),(199,65),(187,64),(179,58),(174,45),(170,26)],255)
    draw.polygon([(214,55),(220,58),(225,65),(227,74),(224,80),(216,81),(211,77),(210,68)],255)
    mask=mask.filter(ImageFilter.GaussianBlur(.7))
    color=Image.composite(registered,lit.convert('RGB'),mask)
    Image.merge('RGBA',(*color.split(),lit.getchannel('A'))).save(folder/('Parts/head-'+state+'-unlit.png'))
    if state=='closed':mask.save(folder/'Expressions/forehead-emission-mask.png')