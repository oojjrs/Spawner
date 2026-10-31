from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np,json,math,hashlib

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    x=max(0,min(1,value))
    return x*x*(3-2*x)

def track(keys,time):
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if time<=b:return x+(y-x)*ease((time-a)/(b-a))
    return keys[-1][1]

def translated(image,dx,dy):
    if float(dx).is_integer() and float(dy).is_integer():
        out=Image.new('RGBA',(512,512));out.paste(image,(int(dx),int(dy)));return out
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,(1,0,-dx,0,1,-dy),Image.Resampling.BICUBIC).convert('RGBA')

def main():
    rig=json.loads((FOLDER/'rig.json').read_bytes());shell=Image.open(FOLDER/rig['shell']).convert('RGBA');front=Image.open(FOLDER/rig['foreground']).convert('RGBA');parts={name:Image.open(FOLDER/data['image']).convert('RGBA') for name,data in rig['parts'].items()};closed=Image.open(FOLDER/'Parts/head-closed.png').convert('RGBA');gates={}
    for name,poly in rig['gates'].items():
        mask=Image.new('L',(512,512));ImageDraw.Draw(mask).polygon([tuple(p) for p in poly],255);gates[name]=mask
    frames=[];states=[]
    for time in rig['timesMs']:
        frame=shell.copy();moving=Image.new('RGBA',(512,512));amounts={}
        for name in ['tail','hind','fore-far','head','fore-near']:
            part=rig['parts'][name];amount=ease((time-part['startMs'])/(part['endMs']-part['startMs']));image=closed if name=='head' and time>=75 else parts[name];dx,dy=np.array(part['vector'])*amount;image=translated(image,dx,dy);image.putalpha(ImageChops.multiply(image.getchannel('A'),gates[name]));moving.alpha_composite(image);amounts[name]=amount
        frame.alpha_composite(moving);frame.alpha_composite(front);drop=round(track(rig['rootKeys'],time));frame=translated(frame,0,drop);frames.append(frame);states.append({'timeMs':time,'partRetractions':amounts,'rootTranslation':[0,drop],'rigidScale':[1,1],'visibleMovingAlpha':int(np.asarray(moving)[:,:,3].sum())})
    count=len(frames);columns=6;durations=[25]*(count-1)+[900];sheet=Image.new('RGBA',(512*columns,512*math.ceil(count/columns)))
    for i,frame in enumerate(frames):sheet.paste(frame,(i%columns*512,i//columns*512))
    sheet.save(FOLDER/'death.webp','WEBP',**{'lossless':True,'method':4});options={'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4};frames[0].save(FOLDER/'preview.webp','WEBP',**options);small=[im.resize((64,64),Image.Resampling.LANCZOS) for im in frames];small[0].save(FOLDER/'thumbnail.webp','WEBP',**{**options,'append_images':small[1:]});contact=Image.new('RGB',(1024,560),'#27352f');d=ImageDraw.Draw(contact)
    for cell,index in enumerate([0,4,8,12,17,21,25,count-1]):
        im=frames[index].resize((256,256),Image.Resampling.LANCZOS);x,y=cell%4*256,cell//4*280;contact.paste(im,(x,y),im);d.text((x+8,y+257),str(rig['timesMs'][index])+' ms','#e6eedc')
    contact.save(FOLDER/'contact.png');frames[-1].save(FOLDER/'final.png');Image.blend(Image.open(FOLDER/'Source/neutral.png').convert('RGBA'),frames[0],.5).save(FOLDER/'source-overlay.png');save_json(FOLDER/'poses.json',states);save_json(FOLDER/'identity-check.json',{'shellSourceSha256':hashlib.sha256((FOLDER/rig['shell']).read_bytes()).hexdigest(),'shellScale':[1,1],'shellGeometry':'One immutable complete painted source plus its matching foreground occlusion layer, translated rigidly without deformation.','finalMovingAlpha':states[-1]['visibleMovingAlpha'],'finalGroundY':int(np.argwhere(np.asarray(frames[-1])[:,:,3]>=64)[:,0].max()),'finalDropY':states[-1]['rootTranslation'][1]});prefix='DesignAssets/Animations/CreatureDeathV3/vine-turtle/';save_json(FOLDER/'death.json',{'name':'vine-turtle','action':'death','sourceImage':rig['sourceImage'],'sourceAnimation':rig['sourceAnimation'],'image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':count,'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'rig':prefix+'rig.json','renderer':prefix+'render.py','contact':prefix+'contact.png','sourceOverlay':prefix+'source-overlay.png','identityCheck':prefix+'identity-check.json','sourceAuthoring':prefix+'Source/authoring.json','prepare':prefix+'Source/prepare.py','sourcePlacement':{'referenceNormalization':json.loads((FOLDER/'Source/authoring.json').read_bytes())['referencePlacement'],'canvas':[512,512],'source':'approved idle first cell','translation':[0,-1],'scale':[1,1],'groundY':448},'method':rig['method']});print(json.dumps({'frames':count,'finalMovingAlpha':states[-1]['visibleMovingAlpha'],'finalDrop':states[-1]['rootTranslation'][1]}))

if __name__=='__main__':
    main()
