from pathlib import Path
from PIL import Image
import numpy as np
import math,json

folder = Path(__file__).resolve().parent
rig = json.loads((folder/'rig.json').read_bytes())
landmarks = {
    'fore-upper':[(.50,.12),(.50,.88)],
    'fore-lower':[(.65,.14),(.43,.80)],
    'hind-upper':[(.40,.15),(.61,.88)],
    'hind-lower':[(.27,.15),(.65,.83)],
    'fore-far':[(.58,.10),(.45,.83)],
    'hind-far':[(.32,.15),(.65,.86)]
}
registration = []
for part in rig['parts']:
    name = part['name']
    if name not in landmarks:
        continue
    image = Image.open(folder/'Source/RegistrationInputs'/(name+'.png')).convert('RGBA')
    left,top,right,bottom = image.getchannel('A').point(lambda alpha:255 if alpha>=64 else 0).getbbox()
    source = np.array([[left+u*(right-left),top+v*(bottom-top)] for u,v in landmarks[name]])
    target = np.array(part['jointLandmarks'],float)
    before,after = source[1]-source[0],target[1]-target[0]
    scale = np.linalg.norm(after)/np.linalg.norm(before)
    theta = math.atan2(after[1],after[0])-math.atan2(before[1],before[0])
    cosine,sine = math.cos(theta),math.sin(theta)
    matrix = np.eye(3)
    matrix[:2,:2] = scale*np.array([[cosine,-sine],[sine,cosine]])
    matrix[:2,2] = target[0]-matrix[:2,:2]@source[0]
    inverse = np.linalg.inv(matrix)
    complete = image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].flatten()),Image.Resampling.BICUBIC).convert('RGBA')
    complete.save(folder/part['visibleSource'])
    registration.append({'part':name,'sourceJointPixels':source.tolist(),'bindJointPixels':target.tolist(),'sourceToBind':matrix.tolist(),'runtimeScale':[1,1]})
encoder = json.JSONEncoder()
encoder.indent = 2
(folder/'Source/registration.json').write_bytes((encoder.encode(registration).replace('\n','\r\n')+'\r\n').encode('utf-8'))
