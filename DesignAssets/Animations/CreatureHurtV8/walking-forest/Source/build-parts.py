from pathlib import Path

from PIL import Image

import numpy as np,json

FOLDER=Path(__file__).resolve().parent.parent



def main():

 rig=json.loads((FOLDER/'rig.json').read_text('utf8'));anatomy=np.asarray(Image.open(FOLDER/rig['sources']['registeredAnatomy']).convert('RGBA'))

 for state in ['seed','half','pain']:

  original=np.asarray(Image.open(FOLDER/rig['sources'][state]).convert('RGBA'))

  for part in rig['attachments']:

   visible=np.asarray(Image.open(FOLDER/part['visibleMask']).convert('L'))>0;layer=np.zeros_like(original)

   if part['name']!='rock-shell':

    underlap=np.asarray(Image.open(FOLDER/part['underlapMask']).convert('L'))>0;layer[underlap]=anatomy[underlap]

   layer[visible]=original[visible];Image.fromarray(layer).save(FOLDER/part['texturePattern'].replace('{expression}',state))

 seed=Image.open(FOLDER/rig['sources']['seed']).convert('RGBA')

 for contact in rig['fixedContactAttachments']:

  image=Image.new('RGBA',(256,256));rect=contact['region'];image.paste(seed.crop(tuple(rect)),tuple(rect[:2]));image.save(FOLDER/contact['texture'])



if __name__=='__main__':main()

