from pathlib import Path
from PIL import Image
import json

FOLDER=Path(__file__).resolve().parent

def main():
 data=json.loads((FOLDER/'registration.json').read_text('utf8'));size=data['canvas'][0]
 for record in data['records']:
  image=Image.open(FOLDER/record['source']).convert('RGBA');canvas=Image.new('RGBA',(size,size));canvas.paste(image,tuple(record['translationPixels']));canvas.save(FOLDER/'Drawings'/('%02d.png'%record['cel']))

if __name__=='__main__':main()
