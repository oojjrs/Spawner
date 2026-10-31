from pathlib import Path
from PIL import Image,ImageDraw,_webp
import numpy as np,json,math,sys

folder = Path(__file__).resolve().parent
rig = json.loads((folder/'rig.json').read_bytes())
bodies = [Image.open(folder/'Source'/('body-cel-'+str(i)+'.png')).convert('RGBA') for i in range(6)]
head = Image.open(folder/'Parts/head.png').convert('RGBA')
alternate = Image.open(folder/'Parts/head-alternate.png').convert('RGBA')
accessories = {name:Image.open(folder/'Parts'/(name+'.png')).convert('RGBA') for name in rig['accessories']}

def ease(time,start,end):
    value = max(0,min(1,(time-start)/(end-start)))
    return value*value*(3-2*value)

def turn(pivot,angle,offset):
    angle = math.radians(angle)
    cosine,sine = math.cos(angle),math.sin(angle)
    matrix = np.eye(3)
    matrix[:2,:2] = [[cosine,-sine],[sine,cosine]]
    matrix[:2,2] = np.array(pivot)+np.array(offset)-matrix[:2,:2]@np.array(pivot)
    return matrix

def paint(image,matrix):
    inverse = np.linalg.inv(matrix)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].flatten()),Image.Resampling.BICUBIC).convert('RGBA')

def render(time):
    phase = max(i for i,start in enumerate(rig['bodyTimesMs']) if time>=start)
    body_index = rig['bodyIndices'][phase]
    frame = bodies[body_index].copy()
    amount = ease(time,rig['headStartMs'],rig['headContactMs'])
    offset = np.array(rig['headDrop'])*amount
    angle = rig['headAngle']*ease(time,rig['headStartMs']+80,rig['headContactMs'])
    contact_settle = ease(time,rig['headContactMs'],rig['headContactMs']+100)-ease(time,rig['headContactMs']+100,rig['headContactMs']+240)
    offset[1] += rig['contactSettlePx']*contact_settle
    matrix = turn(rig['headPivot'],angle,offset)
    for name,part in accessories.items():
        config = rig['accessories'][name]
        follow = config['angle']*ease(time,rig['headContactMs']-20,1050)
        follow += config['overshoot']*(ease(time,1050,1130)-ease(time,1130,1240))
        frame.alpha_composite(paint(part,matrix@turn(config['pivot'],follow,[0,0])))
    if rig['name']=='talon-owl':
        source = alternate if time<rig['eyesCloseMs'] else head
    else:
        source = head if time<rig['eyesCloseMs'] else alternate
    frame.alpha_composite(paint(source,matrix))
    return frame,{'timeMs':time,'bodyCel':body_index,'headMatrix':matrix.tolist(),'headRigidScale':[1,1]}

def write_json(path,value):
    encoder = json.JSONEncoder()
    encoder.indent = 2
    path.write_bytes((encoder.encode(value).replace('\n','\r\n')+'\r\n').encode('utf-8'))

def encode(path,frames,durations):
    encoder = _webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    time = 0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),time,True,100.0,100.0,3)
        time += duration
    encoder.add(None,time,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def main():
    key_only = '--keys' in sys.argv
    times = [0,200,320,440,600,760,1040,1280] if key_only else list(range(0,1281,40))
    results = [render(time) for time in times]
    frames = [result[0] for result in results]
    contact = Image.new('RGB',(2048,408),'#263631')
    pen = ImageDraw.Draw(contact)
    indices = list(range(8)) if key_only else [0,5,8,11,15,19,26,32]
    for column,index in enumerate(indices):
        image = frames[index].resize((256,256),Image.Resampling.LANCZOS)
        contact.paste(image,(column*256,20),image)
        small = frames[index].resize((64,64),Image.Resampling.LANCZOS)
        contact.paste(small,(column*256+96,310),small)
        pen.text((column*256+5,3),str(times[index])+' ms','#e8efdf')
    contact.save(folder/('keys.png' if key_only else 'contact.png'))
    frames[-1].save(folder/'final.png')
    if key_only:
        print(rig['name'],'keys')
        return
    columns = 4
    durations = [40]*(len(frames)-1)+[1000]
    sheet = Image.new('RGBA',(columns*512,math.ceil(len(frames)/columns)*512))
    for i,frame in enumerate(frames):
        sheet.alpha_composite(frame,(i%columns*512,i//columns*512))
    (folder/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(folder/'preview.webp',frames,durations)
    encode(folder/'thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
    prefix = 'DesignAssets/Animations/CreatureDeathV3/'+rig['name']+'/'
    metadata = {'name':rig['name'],'action':'death','image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'durationsMs':durations,'durationMs':sum(durations),'pivotX':256,'pivotY':448,'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','rig':prefix+'rig.json','renderer':prefix+'render.py','sourceImage':rig['approvedImage'],'method':'New drawn body collapse/contact cels, one locked complete rigid skull source with expression attachment, independent delayed ear/feather controls; common cel physical scale and explicit support/contact registration.','spineCompatibilityVerified':False}
    write_json(folder/'death.json',metadata)
    write_json(folder/'poses.json',[result[1] for result in results])
    print(rig['name'],len(frames),sum(durations))

if __name__=='__main__':
    main()
