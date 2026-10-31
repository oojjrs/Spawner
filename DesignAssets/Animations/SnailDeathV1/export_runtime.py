from pathlib import Path
import json
import math
import hashlib
import numpy as np
from PIL import Image

assets = Path(__file__).resolve().parent
project = assets.parents[2]
policy = json.loads((project / 'DesignAssets/image-sizes.json').read_text('utf8'))

def bounds(image):
    return Image.fromarray(np.uint8(np.array(image)[:, :, 3] >= 16) * 255).getbbox()

for name in ['bundle-snail', 'old-garden-snail']:
    folder = assets / name
    meta = json.loads((folder / 'death.json').read_text('utf8'))
    reference = json.loads((folder / 'Source/runtime-reference.json').read_text('utf8'))
    size = 256
    frames = [Image.open(folder / 'Source/Frames' / (str(index).zfill(3) + '.png')).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS) for index in range(meta['frameCount'])]
    idle = Image.open(project / reference['image']).convert('RGBA').crop((0, 0, reference['frameSize'], reference['frameSize']))
    a, b = bounds(idle), bounds(frames[0])
    reference_extent = max(a[2] - a[0], a[3] - a[1])
    extent = max(b[2] - b[0], b[3] - b[1])
    ratio = extent / reference_extent
    view = reference['frameSize'] * ratio
    pivot_x = (b[0] + b[2]) / 2 - ((a[0] + a[2]) / 2 - reference['pivotX']) * ratio
    pivot_y = b[3] - (a[3] - reference['pivotY']) * ratio
    columns = meta['columns']
    sheet = Image.new('RGBA', (size * columns, size * math.ceil(len(frames) / columns)))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index % columns * size, index // columns * size))
    sheet.save(folder / 'runtime.webp', 'WEBP', **{'lossless': True, 'exact': True, 'method': 4})
    prefix = 'DesignAssets/Animations/SnailDeathV1/' + name + '/'
    scale = reference['frameSize'] / 512 * 480 / reference_extent
    display = policy['baseZoom'] * 1.4 * scale * size / view
    runtime = {
        'name': name, 'action': 'death', 'image': prefix + 'runtime.webp', 'frameSize': size,
        'viewSize': view, 'pivotX': pivot_x, 'pivotY': pivot_y, 'columns': columns,
        'frameCount': len(frames), 'durationsMs': meta['durationsMs'], 'durationMs': meta['durationMs'], 'loop': False,
        'sourceAtlas': meta['image'], 'sourceAtlasSha256': hashlib.sha256((folder / 'death.webp').read_bytes()).hexdigest(),
        'sourceScale': 0.5, 'displaySize': display,
        'alignment': {'reference': reference, 'referenceBounds': list(a), 'runtimeFirstBounds': list(b)},
    }
    (folder / 'runtime.json').write_bytes((json.dumps(runtime, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf8'))
    print(json.dumps({key: runtime[key] for key in ['name', 'frameSize', 'viewSize', 'pivotX', 'pivotY', 'displaySize']}))
