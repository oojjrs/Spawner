from pathlib import Path
import json
from PIL import Image, _webp

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
DURATIONS=[100, 130, 120, 45, 220, 100, 140, 210]


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
    (HERE/'Frames').mkdir(511,True,True)
    atlas=Image.new('RGBA',(2048,1024))
    for i,frame in enumerate(frames):
        frame.save(HERE/'Frames'/('%02d.png'%(i+1)))
        atlas.paste(frame,(i%4*512,i//4*512))
    webp(HERE/'attack.webp',atlas)
    preview_durations=DURATIONS.copy()
    preview_durations[-1]+=800
    animate(HERE/'attack-preview.webp',frames,preview_durations)
    thumbnail=ROOT/'DesignAssets/Planning/UnitPreviews/bundle-snail/attack-v2.webp'
    thumbnail.parent.mkdir(511,True,True)
    animate(thumbnail,[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],preview_durations)
    metadata={'name':'bundle-snail','action':'attack','revision':2,'artworkMethod':'full-strip newly drawn cels','generationReferences':['DesignAssets/CreatureConcepts/v3/bundle-snail.png','Source/seed.png','Source/edit-canvas.png'],'generationTool':'built-in image_gen','generationPrompt':'Source/prompt.txt','status':'parent-playback-review','method':'Eight-pose full-strip drawn animation from the locked approved seed using built-in image_gen. Six new intermediate drawings; exact approved seed at both endpoints. No mesh deformation, crossfades or synthetic inbetweens.','image':'DesignAssets/Animations/CreatureAttackV2/bundle-snail/attack.webp','frameSize':512,'columns':4,'frameCount':8,'durationsMs':DURATIONS,'durationMs':sum(DURATIONS),'impactFrame':4,'impactAtMs':sum(DURATIONS[:4]),'impactHoldMs':DURATIONS[4],'loop':False,'previewPauseMs':800,'pivotX':256,'pivotY':448,'facing':'left','rootMotion':False,'trajectory':'Head and eyestalks fold toward the rigid shell, then the newly drawn continuous neck rams forward with closed eyes. The shell texture is anchored; neck and stalk overshoot settle back.','supportAnchor':'Source/normalization.json','source':'Source/raw-drawn-strip.png','seed':'Source/seed.png','normalization':'Source/normalization.json','preview':'attack-preview.webp','thumbnail':'DesignAssets/Planning/UnitPreviews/bundle-snail/attack-v2.webp','sourceFrames':['Frames/%02d.png'%(i+1) for i in range(8)],'spineCompatibilityVerified':False}
    write_json(HERE/'attack.json',metadata)
    print(metadata['frameCount'],metadata['durationMs'],metadata['impactAtMs'],metadata['impactHoldMs'])


if __name__=='__main__':
    main()