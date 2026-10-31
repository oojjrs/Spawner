from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw,_webp
import numpy as np
import json,sys,subprocess,importlib.util
folder=Path(__file__).resolve().parent
root=folder.parents[3]
pipeline=Path(sys.argv[1])
source=folder/'Source'
profile=json.loads((source/'registration.json').read_text('utf-8'))
key=folder.name
frames_dir=folder/'Frames'
frames_dir.mkdir(511,True,True)
raw=Image.open(source/'raw-drawn-strip.png').convert('RGBA')
seed=Image.open(source/'seed.png').convert('RGBA')
owners=np.asarray(Image.open(source/'pose-owners.png'))
raw_pixels=np.asarray(raw)
scale=profile['commonScale']
strip=Image.new('RGBA',(4096,512),(0,0,0,0))
registrations=[]

def stabilize_contact(picture):
    mask=Image.new('L',(512,512),0)
    draw=ImageDraw.Draw(mask)
    draw.polygon([(0,0),(512,0),(512,512),(510,448),(445,448),(360,432),(318,414),(280,393),(247,365),(227,340),(213,318),(207,308),(0,308)],255)
    pixels=np.asarray(picture).astype(np.float32)/255
    pixels[:,:,3]*=1-np.asarray(mask)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    coordinates=np.arange(512,dtype=np.float32)
    mapped=np.where(coordinates<130,coordinates,np.where(coordinates<174,130+(coordinates-130)*110/44,coordinates+66))
    result=np.zeros_like(pixels)
    for channel in range(4):
        for row in range(512):
            result[row,:,channel]=np.interp(mapped,np.arange(512),pixels[row,:,channel],0,0)
    result[:,:,:3]/=np.maximum(result[:,:,3:4],1/255)
    corrected=Image.fromarray(np.uint8(np.clip(result*255+.5,0,255)))
    rigid=picture.copy()
    rigid.putalpha(Image.fromarray(np.minimum(np.asarray(picture)[:,:,3],np.asarray(mask))))
    corrected.alpha_composite(rigid,(-66,0))
    return corrected

for index in range(8):
    ys,xs=np.where(owners==index+1)
    left=max(0,int(xs.min())-2)
    right=min(raw.width,int(xs.max())+3)
    keep=Image.fromarray(np.uint8(owners==index+1)*255).filter(ImageFilter.MaxFilter(3))
    pixels=raw_pixels.copy()
    pixels[:,:,3]=np.minimum(pixels[:,:,3],np.asarray(keep))
    pixels[pixels[:,:,3]<8]=0
    picture=Image.fromarray(pixels).crop((left,150,right,550))
    picture=picture.resize((round(picture.width*scale),round(picture.height*scale)),Image.Resampling.LANCZOS)
    x=round(profile['targetLandmarkX'][index]-profile['localLandmarkX'][index]*scale-2*scale)
    if index==4:
        x+=66
    y=round(448+(150-profile['groundY'][index])*scale+profile['verticalMotion'][index])
    slot=Image.new('RGBA',(512,512),(0,0,0,0))
    slot.alpha_composite(picture,(x,y))
    if index==4:
        slot=stabilize_contact(slot)
    strip.alpha_composite(slot,(index*512,0))
    registrations.append({'cell':index,'rawCrop':[left,150,right,550],'sharedScale':scale,'landmark':profile['landmark'],'rawLandmarkLocalX':profile['localLandmarkX'][index],'targetLandmarkX':profile['targetLandmarkX'][index],'rawGroundContactY':profile['groundY'][index],'targetGroundY':448,'declaredVerticalMotion':profile['verticalMotion'][index],'translation':[x,y]})
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
durations=profile['durationsMs']
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
target=root/'DesignAssets/Planning/UnitPreviews'/key/'attack-v2.webp'
target.parent.mkdir(511,True,True)
target.write_bytes((folder/'attack-thumbnail.webp').read_bytes())
result=subprocess.run([sys.executable,str(pipeline/'render_sprite_preview_sheet.py'),'--frames-dir',str(frames_dir),'--out',str(folder/'contact.png'),'--columns','4','--gap','8'])
if result.returncode:
    raise SystemExit(result.returncode)
metadata={'species':key,'action':'attack','revision':2,'image':'DesignAssets/Animations/CreatureAttackV2/'+key+'/attack.webp','frameSize':512,'columns':4,'frameCount':8,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'pivotX':256,'pivotY':448,'impactFrame':4,'impactMs':sum(durations[:4]),'impactHoldMs':durations[4],'previewPauseMs':800,'facing':'left','rootMotion':False,'rootMotionDescription':profile['rootMotionDescription'],'description':profile['description'],'artworkMethod':'full-strip newly drawn cels with image_gen; fixed shell registration and local soft-neck compression at contact; no in-between crossfade or reused V1 artwork','actualSource':'Source/raw-drawn-strip.png','seed':'Source/seed.png','editCanvas':'Source/edit-canvas.png','prompt':'Source/prompt.txt','frames':'Frames','exporter':'export.py','preview':'attack-preview.webp','thumbnail':'attack-thumbnail.webp','sourceBounds':list(seed.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()),'normalization':{'pipeline':'OpenAI game-studio sprite-pipeline','officialNormalizer':'normalize_sprite_strip.py','wrapperPurpose':'Official slot extraction and frame-1 lockback are retained; explicit anatomical landmarks, ground contacts and one shared scale preserve the intended attack trajectory instead of fitting each pose to its own bounds.','commonScale':scale,'contactCorrection':profile['contactCorrection'],'registrations':registrations,'firstAndLast':'exact seed pixels'}}
encoder=json.JSONEncoder()
encoder.ensure_ascii=False
encoder.indent=2
(folder/'attack.json').write_bytes((encoder.encode(metadata)+'\n').replace('\n','\r\n').encode('utf-8'))
print(key,len(frames),sum(durations),'ms; hit',sum(durations[:4]),'hold',durations[4])
