from pathlib import Path
import importlib.util
import json
from PIL import Image

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('vine_asset_engine', root / 'engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
rig = json.loads((root / 'rig.json').read_text('utf-8'))
data = {}
for name, control in rig['leafControls'].items():
    vertices, weights, triangles = engine.leaf_mesh(Image.open(root / rig['parts'][name]).convert('RGBA'), control)
    data[name] = {'vertices': vertices.tolist(), 'distalWeights': weights.tolist(), 'triangles': triangles, 'rootBone': {'parent': 'bulb', 'pivot': control['root']}, 'bladeBone': {'parent': name + '-root', 'pivot': control['base']}}
encoder = json.JSONEncoder()
encoder.indent = 2
(root / 'Source/leaf-meshes.json').write_bytes((encoder.encode(data) + '\n').replace('\n', '\r\n').encode('utf-8'))
