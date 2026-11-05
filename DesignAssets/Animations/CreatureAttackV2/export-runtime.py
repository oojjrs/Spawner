from pathlib import Path
import json
import subprocess
import sys
from PIL import Image, _webp

folder = Path(__file__).resolve().parent
for path in sorted(folder.glob('*/Source/runtime-registration.json')):
    config = json.loads(path.read_text('utf-8'))
    species = path.parent.parent
    approved_exporter = config.get('approvedRuntimeExporter')
    if approved_exporter:
        exporter = (species / approved_exporter).resolve()
        if exporter.parent != species.resolve() or exporter.suffix != '.py':
            raise ValueError('Approved runtime exporter must be a local Python file')
        subprocess.run([sys.executable, str(exporter)], check=True)
        print(species.name, 'approved runtime override')
        continue
    source = Image.open(species/'attack.webp').convert('RGBA')
    size = config['frameSize']
    columns = config['columns']
    count = config['frameCount']
    atlas = Image.new('RGBA',(size*columns,size*((count+columns-1)//columns)),(0,0,0,0))
    for index in range(count):
        x = index%columns*512
        y = index//columns*512
        frame = source.crop((x,y,x+512,y+512)).resize((size,size),Image.Resampling.LANCZOS)
        atlas.alpha_composite(frame,(index%columns*size,index//columns*size))
    (species/'runtime.webp').write_bytes(_webp.WebPEncode(atlas.getim(),True,100.0,100.0,'',6,1,b'',''))
    metadata = dict(config)
    metadata['source'] = 'attack.webp'
    metadata['exporter'] = '../export-runtime.py'
    metadata['processing'] = 'One common whole-cel scale for every frame. Original artwork, timing and source registration remain unchanged; runtime pivot aligns the exact seed to its accepted idle appearance.'
    encoder = json.JSONEncoder()
    encoder.ensure_ascii = False
    encoder.indent = 2
    (species/'runtime.json').write_bytes((encoder.encode(metadata)+'\n').replace('\n','\r\n').encode('utf-8'))
    print(species.name,size,count)
