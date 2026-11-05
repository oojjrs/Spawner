"""Export the approved V4 atlas without resampling or repainting any pixels.

Uses the repository's existing Pillow/libwebp exact-lossless encoding workflow.
The old V2 source cels remain historical authoring inputs, not the V4 runtime source.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, _webp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE / 'Source/ApprovedCrownV4/runtime.png'
OUTPUT = HERE / 'runtime.webp'
approval = json.loads((HERE / 'Source/ApprovedCrownV4/approval.json').read_text('utf-8'))
if approval['status'] != 'user-approved' or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != approval['sourceRuntimePngSha256']:
    raise ValueError('Runtime source does not match the approved V4 PNG')
image = Image.open(SOURCE).convert('RGBA')
if image.size != (1160, 580):
    raise ValueError('Unexpected approved atlas dimensions')
OUTPUT.write_bytes(_webp.WebPEncode(image.getim(), True, 100.0, 100.0, '', 6, 1, b'', ''))
if Image.open(OUTPUT).convert('RGBA').tobytes() != image.tobytes():
    raise ValueError('Approved RGBA pixels changed during lossless encoding')
asset = 'DesignAssets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp'
wrapper = ROOT / 'client/local-assets/Animations/CreatureAttackV2/cotton-sheep/runtime.webp.js'
newline = '\r\n' if b'\r\n' in wrapper.read_bytes() else '\n'
import base64
payload = 'data:image/webp;base64,' + base64.b64encode(OUTPUT.read_bytes()).decode('ascii')
wrapper.write_bytes(('globalThis.SpawnerLocalAssetSources[' + json.dumps(asset) + '] = ' + json.dumps(payload) + ';' + newline).encode('utf-8'))
print('Approved sheep V4 runtime and local wrapper exported; exact RGBA equality verified.')
