from pathlib import Path
from PIL import Image
import json
import dynamics

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'Source/physics-config.json').read_text('utf-8'))
images={'body':Image.open(folder/'Parts/torso.png').convert('RGBA'),'head':Image.open(folder/'Parts/head-skull.png').convert('RGBA')}
samples=dynamics.simulate(rig,images)
output=[]
for sample in samples:
    output.append({'timeMs':sample['timeMs'],'body':sample['body'].tolist(),'head':sample['head'].tolist(),'landmarks':sample['landmarks'],'velocity':sample['velocity'],'bodyContact':sample['bodyContact'],'headContact':sample['headContact']})
(folder/'physics-samples.json').write_bytes((json.dumps(output,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf-8'))
