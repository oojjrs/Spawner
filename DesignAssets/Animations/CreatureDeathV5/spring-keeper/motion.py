from pathlib import Path
from PIL import Image
import json
import dynamics

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'Source/physics-config.json').read_text('utf8'))
images={name:Image.open(folder/'Parts'/(path+'.png')).convert('RGBA') for name,path in {'body':'body','head':'head-collider','tail':'tail','near-wing':'near-wing','far-wing':'far-wing'}.items()}
samples=dynamics.simulate(rig,images)
output=[]
for sample in samples:
    output.append({'timeMs':sample['timeMs'],'body':sample['body'].tolist(),'head':sample['head'].tolist(),'parts':{name:value.tolist() for name,value in sample['parts'].items()},'landmarks':sample['landmarks'],'bodyContact':sample['bodyContact'],'headContact':sample['headContact']})
(folder/'motion.json').write_bytes((json.dumps(output,**{'indent':2}).replace('\n','\r\n')+'\r\n').encode('utf8'))
print(json.dumps({'frames':len(output),'last':output[-1]}))
