from pathlib import Path
from PIL import Image,ImageDraw,_webp
import numpy as np
import json,sys,subprocess,importlib.util,math
folder=Path(__file__).resolve().parent
root=folder.parents[3]
pipeline=Path(sys.argv[1])
source=folder/'Source'
frames_dir=folder/'Frames'
frames_dir.mkdir(511,True,True)
raw=Image.open(source/'raw-drawn-strip.png').convert('RGBA')
seed=Image.open(source/'seed.png').convert('RGBA')
cuts=[0,278,525,749,1104,1394,1648,1904,2172]
noses=[28,20,20,65,26,24,29,33]
target_x=[100,116,132,92,70,80,101,100]
scale=1.33
origin_y=448-458*scale
raw_band=(250,490)
strip=Image.new('RGBA',(4096,512),(0,0,0,0))
registrations=[]
for index,(left,right) in enumerate(zip(cuts,cuts[1:])):
    picture=raw.crop((left,raw_band[0],right,raw_band[1]))
    pixels=np.array(picture)
    pixels[pixels[:,:,3]<8]=0
    picture=Image.fromarray(pixels)
    picture=picture.resize((round(picture.width*scale),round(picture.height*scale)),Image.Resampling.LANCZOS)
    x=round(target_x[index]-noses[index]*scale)
    y=round(raw_band[0]*scale+origin_y)
    slot=Image.new('RGBA',(512,512),(0,0,0,0))
    slot.alpha_composite(picture,(x,y))
    strip.alpha_composite(slot,(index*512,0))
    registrations.append({'cell':index,'rawCrop':[left,raw_band[0],right,raw_band[1]],'commonScale':scale,'registrationLandmark':'nose tip','rawNoseLocalX':noses[index],'targetNoseX':target_x[index],'translation':[x,y],'commonRawGroundY':458,'targetGroundY':448})
strip.save(source/'registered-strip.png')
result=subprocess.run([sys.executable,str(pipeline/'normalize_sprite_strip.py'),'--input',str(source/'registered-strip.png'),'--out-dir',str(source/'official-normalized'),'--frames','8','--frame-size','512','--anchor',str(source/'seed.png'),'--lock-frame1'])
if result.returncode:
    raise SystemExit(result.returncode)
spec=importlib.util.spec_from_file_location('official_sprite_normalizer',pipeline/'normalize_sprite_strip.py')
normalizer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalizer)
frames=normalizer.split_strip(strip,8)
frames[0]=Image.open(source/'official-normalized/01.png').convert('RGBA')
frames[-1]=seed.copy()
for index,frame in enumerate(frames):
    frame.save(frames_dir/('%02d.png'%(index+1)))
durations=[70,100,90,40,260,110,130,120]
atlas=Image.new('RGBA',(2048,1024),(0,0,0,0))
for index,frame in enumerate(frames):
    atlas.alpha_composite(frame,(index%4*512,index//4*512))
(folder/'attack.webp').write_bytes(_webp.WebPEncode(atlas.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,pictures,timing):
    encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
    time=0
    for picture,duration in zip(pictures,timing):
        encoder.add(picture.getim(),time,True,100.0,100.0,3)
        time+=duration
    encoder.add(None,time,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

preview_durations=durations.copy()
preview_durations[-1]+=800
animate(folder/'attack-preview.webp',frames,preview_durations)
thumbnail=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames]
animate(folder/'attack-thumbnail.webp',thumbnail,preview_durations)
target=root/'DesignAssets/Planning/UnitPreviews/white-paw/attack-v2.webp'
target.parent.mkdir(511,True,True)
target.write_bytes((folder/'attack-thumbnail.webp').read_bytes())
result=subprocess.run([sys.executable,str(pipeline/'render_sprite_preview_sheet.py'),'--frames-dir',str(frames_dir),'--out',str(folder/'contact.png'),'--columns','4','--gap','8'])
if result.returncode:
    raise SystemExit(result.returncode)
metadata={'species':'white-paw','action':'attack','revision':2,'image':'DesignAssets/Animations/CreatureAttackV2/white-paw/attack.webp','frameSize':512,'columns':4,'frameCount':8,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'pivotX':256,'pivotY':448,'impactFrame':4,'impactMs':300,'impactHoldMs':260,'previewPauseMs':800,'facing':'left','rootMotion':True,'rootMotionDescription':'Drawn shoulder lunge and forepaw reach toward the left, hind-leg push, then deliberate foot replant; the common ground baseline is not fitted separately per pose.','description':'Coil weight onto the hindquarters, cock the near forepaw high, launch a reach, hold a snarling claw-rake contact, follow through and replant.','artworkMethod':'full-strip newly drawn cels with image_gen; no mesh warp, in-between crossfade or reused V1 artwork','actualSource':'Source/raw-drawn-strip.png','seed':'Source/seed.png','editCanvas':'Source/edit-canvas.png','prompt':'Source/prompt.txt','frames':'Frames','exporter':'export.py','preview':'attack-preview.webp','thumbnail':'attack-thumbnail.webp','sourceBounds':list(seed.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()),'normalization':{'pipeline':'OpenAI game-studio sprite-pipeline','officialNormalizer':'normalize_sprite_strip.py','wrapperPurpose':'Official extractor and frame-1 lockback are retained; its per-content bottom-center translation is replaced by explicit nose landmarks and one raw ground transform so the intended lunge and pose-height change survive.','scale':scale,'registrations':registrations,'firstAndLast':'exact seed pixels'}}
encoder=json.JSONEncoder()
encoder.ensure_ascii=False
encoder.indent=2
(folder/'attack.json').write_bytes((encoder.encode(metadata)+'\n').replace('\n','\r\n').encode('utf-8'))
prompt=(source/'generation-prompt.txt').read_text('utf-8-sig')
(source/'prompt.txt').write_bytes(prompt.replace('\r\n','\n').replace('\n','\r\n').encode('utf-8'))
print('white-paw',len(frames),sum(durations),'ms, contact 300-560ms')
