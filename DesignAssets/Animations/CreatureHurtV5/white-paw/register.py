from pathlib import Path
from PIL import Image
import numpy as np
import json

FOLDER=Path(__file__).resolve().parent

def main():
 settings=json.loads((FOLDER/'settings.json').read_text('utf8'));registration=json.loads((FOLDER/'registration.json').read_text('utf8'));size=settings['frameSize'];raw=Image.open(FOLDER/'Source/bridge-drawings-generated.png').convert('RGBA');scale=registration['registrationScale']
 for record in registration['cells']:
  cell=raw.crop(tuple(record['rawCell']));cell=cell.convert('RGBa').resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS).convert('RGBA');canvas=Image.new('RGBA',(size,size));canvas.paste(cell,tuple(registration['commonTranslation']));registered=Image.new('RGBA',(size,size));registered.paste(canvas,tuple(record['translationPixels']));pixels=np.array(registered);pixels[pixels[:,:,3]<8]=0;Image.fromarray(pixels).save(FOLDER/'Drawings'/('%02d.png'%record['cel']))

if __name__=='__main__':main()
