from pathlib import Path
from PIL import Image, ImageDraw, _webp
import numpy as np
import math
import json

folder = Path(__file__).resolve().parent
size = 512
names = ['far-hindleg','far-foreleg','near-hindleg','near-foreleg','body','collar','far-ear','head','near-ear','ear-root']
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in names}
images['head-closed'] = Image.open(folder / 'Parts/head-closed.png').convert('RGBA')
reference = np.asarray(Image.open(folder / 'Source/reference.png').convert('RGBA'))
ground = int(np.argwhere(reference[:, :, 3] > 64)[:, 0].max())
points = {}
for name,texture in images.items():
    positions = np.argwhere(np.asarray(texture)[:,:,3] > 64)
    points[name] = np.column_stack((positions[:,1],positions[:,0],np.ones(len(positions))))

def write_json(path, value):
    encoder = json.JSONEncoder()
    encoder.indent = 2
    encoder.ensure_ascii = False
    path.write_bytes((encoder.encode(value).replace('\n','\r\n') + '\r\n').encode('utf-8'))

def ease(time, start, end):
    amount = min(1, max(0, (time - start) / (end - start)))
    return amount * amount * (3 - 2 * amount)

def turn(pivot, degrees):
    angle = math.radians(degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    x, y = pivot
    return np.array([[cosine,-sine,x-cosine*x+sine*y],[sine,cosine,y-sine*x-cosine*y],[0,0,1]])

def paint(texture, matrix):
    offset = np.eye(3)
    offset[:2,2] = (256,256)
    inverse = np.linalg.inv(offset @ matrix)
    return texture.transform((1024,1024), Image.Transform.AFFINE, tuple(inverse[:2,:].flatten()), Image.Resampling.BICUBIC)

def render(time):
    collapse = ease(time,260,920)
    settle = ease(time,920,1250)
    body_angle = -10 * collapse + 2 * settle
    body = turn((308,280),body_angle)
    head = body @ turn((240,290),-60*ease(time,200,980)+4*ease(time,980,1350))
    local = {
        'body':body,
        'collar':body,
        'head':head,
        'ear-root':head,
        'near-ear':head @ turn((245,227),30*ease(time,330,1050)+8*ease(time,1050,1220)-8*ease(time,1220,1450)),
        'far-ear':head @ turn((135,190),60*ease(time,430,1120)),
        'near-foreleg':body @ turn((250,345),-82*ease(time,260,790)),
        'far-foreleg':body @ turn((201,343),-68*ease(time,310,850)),
        'near-hindleg':body @ turn((401,321),82*ease(time,450,1010)),
        'far-hindleg':body @ turn((337,321),66*ease(time,400,970))
    }
    lowest = max(float((points['head-closed' if name == 'head' and time >= 200 else name] @ local[name].T)[:,1].max()) for name in names)
    floor_shift = ground - lowest
    for matrix in local.values():
        matrix[1,2] += floor_shift
    canvas = Image.new('RGBA',(1024,1024))
    for name in names:
        source = images['head-closed'] if name == 'head' and time >= 200 else images[name]
        canvas.alpha_composite(paint(source,local[name]))
    frame = canvas.crop((256,256,768,768))
    return frame, {'timeMs':time,'floorShift':floor_shift,'groundY':ground,'matrices':{name:matrix.tolist() for name,matrix in local.items()}}

def encode(path, frames, durations):
    encoder = _webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp = 0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp += duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def main():
    times = list(range(0,1521,40))
    results = [render(time) for time in times]
    frames = [result[0] for result in results]
    frames[-1] = frames[-2].copy()
    durations = [40]*(len(frames)-1)+[1000]
    columns = 4
    sheet = Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
    for index,frame in enumerate(frames):
        sheet.alpha_composite(frame,(index%columns*512,index//columns*512))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(folder/'preview.webp',[frame.resize((256,256),Image.Resampling.LANCZOS) for frame in frames],durations)
    encode(folder/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
    prefix = 'DesignAssets/Animations/CreatureDeathV2/cotton-sheep/'
    metadata = {'name':'cotton-sheep','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/cotton-sheep.png','image':prefix+'death.webp','frameSize':512,'columns':4,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'pivotX':256,'pivotY':448,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','rig':prefix+'rig.json','renderer':prefix+'render.py','method':'Separate complete torso, head, four legs, ears and foreground collar with constant rigid source dimensions and FK pivots; local eyelid attachment swap; source textures retain the same anatomy throughout.'}
    write_json(folder/'death.json',metadata)
    write_json(folder/'poses.json',[result[1] for result in results])
    rig = {'canvas':[512,512],'source':'Source/reference.png','parts':{name:'Parts/'+name+'.png' for name in images},'drawOrder':names,'pivots':{'body':[308,280],'head':[240,290],'near-ear':[245,227],'far-ear':[135,190],'near-foreleg':[250,345],'far-foreleg':[201,343],'near-hindleg':[401,321],'far-hindleg':[337,321]},'scale':[1,1],'groundY':ground,'parent':{'head':'body','near-ear':'head','far-ear':'head','collar':'body','ear-root':'head','near-foreleg':'body','far-foreleg':'body','near-hindleg':'body','far-hindleg':'body'},'timeline':'poses.json','spineCompatibilityVerified':False}
    write_json(folder/'rig.json',rig)
    board = Image.new('RGB',(1536,612),'#263631')
    pen = ImageDraw.Draw(board)
    for column,index in enumerate([0,8,14,20,28,len(frames)-1]):
        large = frames[index].resize((256,256),Image.Resampling.LANCZOS)
        board.paste(large,(column*256,24),large)
        small = frames[index].resize((64,64),Image.Resampling.LANCZOS)
        board.paste(small,(column*256+96,310),small)
        pen.text((column*256+8,4),str(times[index])+' ms','#e6efdf')
    board.save(folder/'contact.png')
    frames[0].save(folder/'neutral-reassembled.png')
    print('cotton-sheep',len(frames),sum(durations))

if __name__ == '__main__':
    main()
