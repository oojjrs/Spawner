"""Pack the generated 4 x 2 drawing grid with one fixed camera transform."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
source=Image.open(root/'drawn-sequence.png').convert('RGBA')
assert source.width==source.height*2
cell=source.width/4
sheet=Image.new('RGBA',(1024,512))
for frame in range(8):
    x,y=frame%4,frame//4
    image=source.transform((256,256),Image.Transform.EXTENT,(x*cell,y*cell,(x+1)*cell,(y+1)*cell),resample=Image.Resampling.BICUBIC)
    sheet.paste(image,(x*256,y*256))
sheet.save(root/'hit.webp',lossless=True)
