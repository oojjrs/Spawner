from pathlib import Path
from PIL import Image,WebPImagePlugin
root=Path(__file__).parent
names=['sprout','spore','pebble','spring'];frames=[];sheets=[Image.open(root/name/'growth.png').convert('RGBA') for name in names]
for i in range(101):
    board=Image.new('RGBA',(768,768))
    for k,sheet in enumerate(sheets):
        image=sheet.crop(((i%8)*512,(i//8)*512,(i%8+1)*512,(i//8+1)*512)).resize((384,384),Image.Resampling.LANCZOS);board.alpha_composite(image,((k%2)*384,(k//2)*384))
    frames.append(board)
frames[0].encoderinfo={'append_images':frames[1:],'duration':[600]+[40]*99+[1000],'lossless':True,'loop':0,'method':4}
with (root/'preview.webp').open('wb') as stream:WebPImagePlugin._save_all(frames[0],stream,'')
