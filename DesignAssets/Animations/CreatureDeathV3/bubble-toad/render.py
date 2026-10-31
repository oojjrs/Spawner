from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,math,hashlib

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def transform(pivot,angle,translation):
    theta=math.radians(angle);c,s=math.cos(theta),math.sin(theta);m=np.array([[c,-s,0],[s,c,0],[0,0,1]],float);m[:2,2]=np.asarray(pivot)+translation-m[:2,:2]@np.asarray(pivot)
    return m

def placed(image,matrix):
    inv=np.linalg.inv(matrix)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inv[:2].reshape(-1)),Image.Resampling.BICUBIC).convert('RGBA')

def main():
    rig=json.loads((FOLDER/'rig.json').read_bytes());head=Image.open(FOLDER/rig['headImage']).convert('RGBA');neutral=Image.open(FOLDER/'Source/neutral.png').convert('RGBA');frames=[neutral];states=[{'head':'approved neutral drawing','scale':[1,1]}]
    for key in rig['keys']:
        image=Image.open(FOLDER/key['image']).convert('RGBA');dx,dy,angle=key['headPose'];m=transform(rig['headPivot'],angle,np.array([dx,dy]));image.alpha_composite(placed(head,m));frames.append(image);states.append({'bodyImage':key['image'],'headMatrix':m.tolist(),'headScale':[1,1]})
    durations=rig['durationsMs'];columns=6;sheet=Image.new('RGBA',(512*columns,512))
    for i,im in enumerate(frames):sheet.paste(im,(i*512,0))
    sheet.save(FOLDER/'death.webp','WEBP',**{'lossless':True,'method':4});opts={'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4};frames[0].save(FOLDER/'preview.webp','WEBP',**opts);small=[im.resize((64,64),Image.Resampling.LANCZOS) for im in frames];small[0].save(FOLDER/'thumbnail.webp','WEBP',**{**opts,'append_images':small[1:]});contact=Image.new('RGB',(1280,300),'#27352f');d=ImageDraw.Draw(contact)
    for i,im in enumerate(frames):
        p=im.resize((256,256),Image.Resampling.LANCZOS);contact.paste(p,(i*256,0),p);d.text((i*256+10,265),['neutral','strength loss','sac release','chest contact','final contact'][i],'#e6eedc')
    contact.save(FOLDER/'contact.png');frames[-1].save(FOLDER/'final.png');save_json(FOLDER/'poses.json',states);save_json(FOLDER/'identity-check.json',{'headImage':rig['headImage'],'headSha256':hashlib.sha256((FOLDER/rig['headImage']).read_bytes()).hexdigest(),'headSize':[172,98],'headScaleByBodyCel':[[1,1]]*4,'bodyCelSources':[k['image'] for k in rig['keys']],'sourceArtworkScale':.6,'worldContactY':448,'runtimePerFrameFit':False});prefix='DesignAssets/Animations/CreatureDeathV3/bubble-toad/';save_json(FOLDER/'death.json',{'name':'bubble-toad','action':'death','sourceImage':rig['sourceImage'],'image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'rig':prefix+'rig.json','renderer':prefix+'render.py','contact':prefix+'contact.png','identityCheck':prefix+'identity-check.json','sourceAuthoring':prefix+'Source/authoring.json','prepare':prefix+'Source/prepare.py','sourcePlacement':{'referenceNormalization':json.loads((FOLDER/'Source/authoring.json').read_bytes())['referencePlacement'],'canvas':[512,512],'bodySourceScale':.6,'groundY':448},'method':rig['method']});print(json.dumps({'frames':len(frames),'headScale':[1,1],'durationMs':sum(durations)}))

if __name__=='__main__':
    main()
