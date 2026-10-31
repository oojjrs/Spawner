from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFilter, _webp

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
DURATIONS=[100, 110, 110, 40, 200, 90, 130, 190]


def write_json(path,value):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    path.write_bytes((encoder.encode(value).replace('\n','\r\n')+'\r\n').encode('utf-8'))


def webp(path,picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))


def animate(path,pictures,durations):
    encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for picture,duration in zip(pictures,durations):
        encoder.add(picture.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))


def main():
    strip=Image.open(HERE/'Source/registered-drawn-strip.png').convert('RGBA')
    seed=Image.open(HERE/'Source/seed.png').convert('RGBA')
    frames=[strip.crop((i*512,0,(i+1)*512,512)) for i in range(8)]
    frames[0]=seed.copy()
    frames[-1]=seed.copy()
    correction=json.loads((HERE/'Source/eyes-correction.json').read_text('utf-8'))
    donor=Image.open(HERE/correction['generatedSource']).convert('RGBA').resize((2048,1024),Image.Resampling.LANCZOS)
    mask_sheet=Image.new('L',(2048,1024),0)
    for patch in correction['patches']:
        index=patch['frameIndex']
        local=Image.new('RGBA',(512,512))
        source=donor.crop((index%4*512,index//4*512,index%4*512+512,index//4*512+512))
        local.paste(source,tuple(patch['generatedEyeOffset']))
        mask=Image.new('L',(512,512),0)
        ImageDraw.Draw(mask).rounded_rectangle(tuple(patch['maskBounds']),10,255)
        mask=mask.filter(ImageFilter.GaussianBlur(2))
        frames[index]=Image.composite(local,frames[index],mask)
        mask_sheet.paste(mask,(index%4*512,index//4*512))
    mask_sheet.save(HERE/'Source/eyes-open-mask.png')
    (HERE/'Frames').mkdir(511,True,True)
    atlas=Image.new('RGBA',(2048,1024))
    for i,frame in enumerate(frames):
        frame.save(HERE/'Frames'/('%02d.png'%(i+1)))
        atlas.paste(frame,(i%4*512,i//4*512))
    webp(HERE/'attack.webp',atlas)
    contact=Image.new('RGBA',(2048,1024))
    pixels=contact.load()
    for y in range(1024):
        for x in range(2048):
            value=228 if (x//16+y//16)%2 else 240
            pixels[x,y]=(value,value,value,255)
    contact.alpha_composite(atlas)
    contact.convert('RGB').save(HERE/'contact.png')
    preview_durations=DURATIONS.copy()
    preview_durations[-1]+=800
    animate(HERE/'attack-preview.webp',frames,preview_durations)
    thumbnail=ROOT/'DesignAssets/Planning/UnitPreviews/dew-rabbit/attack-v2.webp'
    thumbnail.parent.mkdir(511,True,True)
    animate(thumbnail,[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],preview_durations)
    metadata={'name':'dew-rabbit','action':'attack','revision':2,'artworkMethod':'full-strip newly drawn cels','generationReferences':['DesignAssets/CreatureConcepts/v3/dew-rabbit.png','Source/seed.png','Source/edit-canvas.png'],'generationTool':'built-in image_gen','generationPrompt':'Source/prompt.txt','status':'parent-playback-review','method':'Eight-pose full-strip drawn animation from the locked approved seed using built-in image_gen. Six new intermediate drawings; exact approved seed at both endpoints. No mesh deformation, crossfades or synthetic inbetweens.','image':'DesignAssets/Animations/CreatureAttackV2/dew-rabbit/attack.webp','frameSize':512,'columns':4,'frameCount':8,'durationsMs':DURATIONS,'durationMs':sum(DURATIONS),'impactFrame':4,'impactAtMs':sum(DURATIONS[:4]),'impactHoldMs':DURATIONS[4],'loop':False,'previewPauseMs':800,'pivotX':256,'pivotY':448,'facing':'left','rootMotion':False,'trajectory':'Rear-foot loading, raised front paws, fast forward double-paw shove, short contact hold and paw/ear recoil. Pose 4 has a deliberate 12px takeoff lift; support feet share the approved seed baseline.','supportAnchor':'Source/normalization.json','source':'Source/raw-drawn-strip.png','seed':'Source/seed.png','normalization':'Source/normalization.json','preview':'attack-preview.webp','thumbnail':'DesignAssets/Planning/UnitPreviews/dew-rabbit/attack-v2.webp','sourceFrames':['Frames/%02d.png'%(i+1) for i in range(8)],'spineCompatibilityVerified':False}
    metadata['eyeCorrection']=correction
    metadata['artworkMethod']='Full-strip newly drawn cels with image_gen eye-open correction, composited only inside the declared eye masks.'
    write_json(HERE/'attack.json',metadata)
    print(metadata['frameCount'],metadata['durationMs'],metadata['impactAtMs'],metadata['impactHoldMs'])


if __name__=='__main__':
    main()