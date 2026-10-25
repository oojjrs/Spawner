from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import sys
import shutil
import subprocess

folder = Path(__file__).parent
work = folder.parents[4]/'$Trash/bean-layered-idle-20261025'
work.mkdir(511,True,True)
rig = json.loads((folder/'rig.json').read_text('utf-8'))
magick = shutil.which('magick')
mode = sys.argv[1] if len(sys.argv)>1 else 'all'
skins = [mode] if mode in rig['skins'] else list(rig['skins'])
count = rig['frameCount']
for name in ([] if mode=='comparison' else skins):
    paths = [work/'Frames'/name/(str(index).zfill(3)+'.png') for index in range(count)]
    for path in paths:
        if not path.exists():
            raise RuntimeError(str(path))
    atlas = Image.new('RGBA',(rig['columns']*512,((count+rig['columns']-1)//rig['columns'])*512),(0,0,0,0))
    for index,path in enumerate(paths):
        atlas.paste(Image.open(path).convert('RGBA'),(index%rig['columns']*512,index//rig['columns']*512))
    atlas.save(folder/(name+'-idle.png'))
    atlas.close()
    subprocess.check_call([magick,str(folder/(name+'-idle.png')),'-define','webp:lossless=true',str(folder/(name+'-idle.webp'))])
    subprocess.check_call([magick,'-delay','5','-loop','0',*[str(path) for path in paths],'-define','webp:lossless=true',str(folder/(name+'-idle-preview.webp'))])
    print(name+' atlas and animated WebP exported',flush=True)

if mode in rig['skins']:
    raise SystemExit(0)

preview = work/'ComparisonFrames'
preview.mkdir(511,True,True)
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
small_font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',13)
for index in range(count):
    canvas = Image.new('RGB',(768,430),'#26332b')
    draw = ImageDraw.Draw(canvas)
    for column,name in enumerate(skins):
        frame = Image.open(work/'Frames'/name/(str(index).zfill(3)+'.png')).convert('RGBA')
        large = frame.resize((300,300),Image.Resampling.LANCZOS)
        canvas.paste(large,(column*256-22,-6),large)
        text = rig['skins'][name]['name']
        width = draw.textlength(text,font)
        draw.text((column*256+128-width/2,282),text,'#e2edde',font)
        small = frame.resize((101,101),Image.Resampling.LANCZOS)
        canvas.paste(small,(column*256+77,316),small)
    draw.text((12,407),'동일 배율 · 6.4초 반복','#a9bcaa',small_font)
    canvas.save(preview/(str(index).zfill(3)+'.png'))
paths = [str(preview/(str(index).zfill(3)+'.png')) for index in range(count)]
subprocess.check_call([magick,'-delay','5','-loop','0',*paths,'-define','webp:lossless=true',str(folder/'idle-comparison.webp')])
palette = work/'comparison-palette.png'
subprocess.check_call([magick,*[paths[index] for index in [0,12,24,40,44,48,64,88,112,127]],'+append','-colors','256','-unique-colors',str(palette)])
subprocess.check_call([magick,'-delay','5','-loop','0',*paths,'+dither','-remap',str(palette),'-layers','Optimize',str(folder/'idle-comparison.gif')])
manifest = {
    'name':'sprout-layered-idle-v1',
    'frameSize':[512,512],
    'frameCount':count,
    'columns':rig['columns'],
    'durationMs':rig['periodMs'],
    'frameDurationMs':rig['frameDurationMs'],
    'pivot':rig['pivot'],
    'loop':True,
    'rootMotion':False,
    'rig':'rig.json',
    'render':'render.py',
    'export':'export.py',
    'comparison':'idle-comparison.webp',
    'variants':{name:{'name':rig['skins'][name]['name'],'atlas':name+'-idle.webp','preview':name+'-idle-preview.webp'} for name in skins}
}
(folder/'manifest.json').write_bytes((json.dumps(manifest)+'\n').replace('\n','\r\n').encode('utf-8'))
print('Three-skin comparison, stable-palette GIF and manifest exported',flush=True)
