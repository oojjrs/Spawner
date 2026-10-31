from pathlib import Path
from PIL import Image
import numpy as np
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Source'
TEMP = ROOT.parents[4] / '$Trash' / 'PebbleNestIdle04-Apply'


def prepare_runtime():
    TEMP.mkdir(0o777, True, True)
    reference = np.array(Image.open(SOURCE / 'runtime-reference.png').convert('RGBA'))
    base = np.array(Image.open(SOURCE / 'base.png').convert('RGBA').resize((384, 384), Image.Resampling.LANCZOS))
    sheet = Image.new('RGBA', (5120, 4096))
    for index in range(80):
        frame = np.array(Image.open(ROOT / 'Frames' / ('frame-%03d.png' % index)).convert('RGBA').resize((384, 384), Image.Resampling.LANCZOS))
        delta = frame[:, :, :3].astype(np.int16) - base[:, :, :3].astype(np.int16)
        output = reference.copy()
        region = output[64:448, 66:450, :3].astype(np.int16)
        output[64:448, 66:450, :3] = np.uint8(np.clip(region + delta, 0, 255))
        sheet.paste(Image.fromarray(output), ((index % 10) * 512, (index // 10) * 512))
    intermediate = TEMP / 'idle-runtime.png'
    sheet.save(intermediate)
    result = subprocess.call(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(intermediate), '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '5', str(ROOT / 'idle-sheet.webp')])
    if result:
        raise RuntimeError('Runtime sheet export failed')
    path = ROOT / 'animation.json'
    metadata = json.loads(path.read_text('utf-8'))
    metadata['runtimeAnimation'] = 'idle-sheet.webp'
    metadata['runtimeReference'] = 'Source/runtime-reference.png'
    metadata['runtimePlacement'] = {'x': 66, 'y': 64, 'width': 384, 'height': 384}
    metadata['runtimeConnected'] = True
    path.write_bytes((json.dumps(metadata) + '\r\n').encode('utf-8'))
    print(str(ROOT / 'idle-sheet.webp'))


if __name__ == '__main__':
    prepare_runtime()
