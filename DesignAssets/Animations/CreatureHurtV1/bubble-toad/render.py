from pathlib import Path
import json
import math
import numpy as np
from PIL import Image

FOLDER = Path(__file__).resolve().parent

def sample(array, x, y):
    h, w = array.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    ix, iy = x.astype(np.int32), y.astype(np.int32)
    u, v = (x - ix)[..., None], (y - iy)[..., None]
    return (array[iy, ix] * (1-u) + array[iy, ix+1] * u) * (1-v) + (array[iy+1, ix] * (1-u) + array[iy+1, ix+1] * u) * v

def render_frame(rig, source, index):
    if index == 0 or index == len(rig['timeline']) - 1:
        return source.copy()
    size = source.width
    yy, xx = np.mgrid[:size, :size].astype(np.float32)
    delta = np.zeros((size, size, 2), np.float32)
    pose = rig['timeline'][index]
    for bone in rig['bones']:
        grid = np.asarray(bone['weights'], np.float32).reshape(rig['gridShape'])
        weight = np.asarray(Image.fromarray(grid).resize((size,size), Image.Resampling.BILINEAR))
        a, dx, dy, sx, sy = pose[bone['name']]
        a = math.radians(a)
        c, s = math.cos(a), math.sin(a)
        px, py = bone['pivot']
        delta[:,:,0] += (((xx-px)*c*sx - (yy-py)*s*sy + px + dx)-xx) * weight
        delta[:,:,1] += (((xx-px)*s*sx + (yy-py)*c*sy + py + dy)-yy) * weight
    coords = np.stack((xx, yy), 2)
    target = coords.copy()
    for unused in range(7):
        coords = target - sample(delta, coords[:,:,0], coords[:,:,1])
    pixels = np.asarray(source).astype(np.float32)
    pixels[:,:,:3] *= pixels[:,:,3:4]/255
    result = sample(pixels, coords[:,:,0], coords[:,:,1])
    result[:,:,:3] *= 255/np.maximum(result[:,:,3:4], .0001)
    result = np.round(np.clip(result,0,255)).astype(np.uint8)
    result[result[:,:,3] == 0] = 0
    return Image.fromarray(result)

def main():
    rig = json.loads((FOLDER/'rig.json').read_text('utf-8'))
    source = Image.open(FOLDER/rig['texture']).convert('RGBA')
    frames = [render_frame(rig, source, i) for i in range(len(rig['timeline']))]
    frames = [f.resize(tuple(rig['outputCanvas']), Image.Resampling.LANCZOS) for f in frames]
    size = frames[0].width
    cols = rig['columns']
    sheet = Image.new('RGBA',(size*cols, size*math.ceil(len(frames)/cols)))
    matrix = Image.new('RGBA',(64*cols,64*math.ceil(len(frames)/cols)))
    contact = Image.new('RGBA',(256*cols,256*math.ceil(len(frames)/cols)),(38,46,40,255))
    for i,frame in enumerate(frames):
        sheet.paste(frame,(i%cols*size,i//cols*size))
        matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%cols*64,i//cols*64))
        contact.alpha_composite(frame.resize((256,256),Image.Resampling.LANCZOS),(i%cols*256,i//cols*256))
    sheet.save(FOLDER/'hurt.webp','WEBP',**{'lossless':True,'method':4})
    matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**{'lossless':True,'method':4})
    previews=[f.resize((256,256),Image.Resampling.LANCZOS) for f in frames]
    previews[0].save(FOLDER/'hurt-preview.webp','WEBP',**{'save_all':True,'append_images':previews[1:],'duration':rig['durationsMs'],'loop':0,'lossless':True,'method':4,'minimize_size':False})
    contact.save(FOLDER/'hurt-contact.png')
    print(json.dumps({'name':FOLDER.name,'frames':len(frames),'durationMs':sum(rig['durationsMs']),'sheet':sheet.size}))

if __name__ == '__main__':
    main()
