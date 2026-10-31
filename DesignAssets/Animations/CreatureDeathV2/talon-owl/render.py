from pathlib import Path
from PIL import Image, ImageDraw, _webp
import numpy as np
import math
import json

folder = Path(__file__).resolve().parent
size = 512
names = ['wing-far','tail','leg-far-lower','leg-far-upper','leg-near-lower','leg-near-upper','body','head','wing-near']
images = {name: Image.open(folder / 'Parts' / (name + '.png')).convert('RGBA') for name in names}
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
    collapse = ease(time,260,1000)
    settle = ease(time,1000,1350)
    body = turn((256,290),-75*collapse+3*settle)
    local = {
        'body':body,
        'head':body @ turn((228,242),-10*ease(time,100,350)-1*ease(time,350,1050)-2*ease(time,1050,1450)),
        'wing-near':body @ turn((282,255),32*ease(time,330,1100)+4*ease(time,1100,1250)-4*ease(time,1250,1470)),
        'wing-far':body @ turn((177,249),-15*ease(time,400,1120)),
        'tail':body @ turn((304,354),80*ease(time,480,1270)),
        'leg-near-upper':body @ turn((258,349),150*ease(time,260,860)),
        'leg-far-upper':body @ turn((209,351),140*ease(time,310,920))
    }
    tail_shift = np.eye(3)
    tail_shift[:2,2] = (-20*ease(time,480,1270),20*ease(time,480,1270))
    local['tail'] = body @ tail_shift @ turn((304,354),80*ease(time,480,1270))
    local['leg-near-lower'] = local['leg-near-upper'] @ turn((255,378),-35*ease(time,410,1010))
    local['leg-far-lower'] = local['leg-far-upper'] @ turn((202,376),-25*ease(time,450,1080))
    lowest = max(float((points[name] @ local[name].T)[:,1].max()) for name in names)
    floor_shift = ground - lowest
    for matrix in local.values():
        matrix[1,2] += floor_shift
    canvas = Image.new('RGBA',(1024,1024))
    for name in names:
        source = images[name]
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
    prefix = 'DesignAssets/Animations/CreatureDeathV2/talon-owl/'
    metadata = {'name':'talon-owl','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/talon-owl.png','image':prefix+'death.webp','frameSize':512,'columns':4,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'loop':False,'pivotX':256,'pivotY':448,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','rig':prefix+'rig.json','renderer':prefix+'render.py','method':'Complete torso, head, two wings, tail and two two-segment legs. Constant-scale FK collapse onto the breast and folded talons; analytic continuous floor support and delayed feather follow-through.'}
    write_json(folder/'death.json',metadata)
    write_json(folder/'poses.json',[result[1] for result in results])
    rig = {'canvas':[512,512],'source':'Source/reference.png','parts':{name:'Parts/'+name+'.png' for name in images},'drawOrder':names,'pivots':{'body':[256,290],'head':[228,242],'wing-near':[282,255],'wing-far':[177,249],'tail':[304,354],'leg-near-upper':[258,349],'leg-near-lower':[255,378],'leg-far-upper':[209,351],'leg-far-lower':[202,376]},'scale':[1,1],'groundY':ground,'parent':{'head':'body','wing-near':'body','wing-far':'body','tail':'body','leg-near-upper':'body','leg-near-lower':'leg-near-upper','leg-far-upper':'body','leg-far-lower':'leg-far-upper'},'timeline':'poses.json','spineCompatibilityVerified':False}
    write_json(folder/'rig.json',rig)
    board = Image.new('RGB',(1536,612),'#263631')
    pen = ImageDraw.Draw(board)
    for column,index in enumerate([0,8,16,24,32,len(frames)-1]):
        large = frames[index].resize((256,256),Image.Resampling.LANCZOS)
        board.paste(large,(column*256,24),large)
        small = frames[index].resize((64,64),Image.Resampling.LANCZOS)
        board.paste(small,(column*256+96,310),small)
        pen.text((column*256+8,4),str(times[index])+' ms','#e6efdf')
    board.save(folder/'contact.png')
    frames[0].save(folder/'neutral-reassembled.png')
    print('talon-owl',len(frames),sum(durations))

if __name__ == '__main__':
    main()
