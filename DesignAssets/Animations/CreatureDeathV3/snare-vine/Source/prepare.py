from pathlib import Path
from PIL import Image,ImageChops
import json,shutil
import numpy as np

FOLDER=Path(__file__).resolve().parent.parent

def main():
    data=json.loads((FOLDER/'Source/authoring.json').read_bytes())
    for target,source in data['editablePartSources'].items():
        shutil.copyfile(FOLDER/source,FOLDER/target)
    for target,source in data['editableTextureSources'].items():
        shutil.copyfile(FOLDER/source,FOLDER/target)
    if 'bodyCelPreparation' in data:
        setup=data['bodyCelPreparation'];atlas=Image.open(FOLDER/setup['drawing']).convert('RGBA')
        for cel in setup['cels']:
            mask=Image.open(FOLDER/cel['mask']).convert('L');image=atlas.copy();image.putalpha(ImageChops.multiply(atlas.getchannel('A'),mask));a=np.asarray(image).copy();a[a[:,:,3]==0]=0;image=Image.fromarray(a);image=image.resize(tuple(setup['resizedCanvas']),Image.Resampling.LANCZOS);out=Image.new('RGBA',(512,512));out.alpha_composite(image,tuple(cel['translation']));out.save(FOLDER/cel['output'])
    if 'shellForeground' in data:
        setup=data['shellForeground'];shell=Image.open(FOLDER/setup['shell']).convert('RGBA');mask=Image.open(FOLDER/setup['mask']).convert('L');shell.putalpha(ImageChops.multiply(shell.getchannel('A'),mask));shell.save(FOLDER/setup['output'])

if __name__=='__main__':
    main()
