from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops

folder=Path(__file__).resolve().parent.parent
reference=Image.open(folder/'Source/reference.png').convert('RGBA')
mask=Image.new('L',(512,512))
ImageDraw.Draw(mask).polygon([(115,268),(210,240),(258,273),(316,282),(354,304),(369,337),(368,365),(344,378),(320,375),(279,384),(227,390),(168,397),(110,360)],255)
mask=mask.filter(ImageFilter.GaussianBlur(1.2))
reference.putalpha(ImageChops.multiply(reference.getchannel('A'),mask))
reference.save(folder/'Parts/body-core.png')