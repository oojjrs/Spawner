from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def main():
    settings=json.loads((FOLDER/'settings.json').read_text('utf8'))
    size=settings['frameSize']
    cels={0:Image.open(FOLDER/'Source/seed.png').convert('RGBA')}
    for index in range(1,7): cels[index]=Image.open(FOLDER/'Drawings'/('%02d.png'%index)).convert('RGBA')
    sequence=[0,1,3,5,6,6,5,4,3,2,1,0,0,0,0,0]
    frames=[cels[index].copy() for index in sequence]
    sheet=Image.new('RGBA',(size*4,size*4));matrix=Image.new('RGBA',(256,256))
    for index,frame in enumerate(frames):
        sheet.paste(frame,(index%4*size,index//4*size))
        matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(index%4*64,index//4*64))
    sheet.save(FOLDER/'hurt.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
    matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**{'lossless':True,'method':4,'exact':True})
    preview=settings['durationsMs'].copy();preview[-1]+=900
    for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])]:
        images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':preview,'loop':0,'lossless':True,'method':4,'exact':True})
    timeline=[]
    for index,cel in enumerate(sequence):
        timeline.append({'frame':index,'durationMs':settings['durationsMs'][index],'source':'Source/seed.png' if cel==0 else 'Drawings/%02d.png'%cel,'phase':'contact' if index<4 else 'pain-hold' if index==4 else 'recovery','drawnPose':cel,'scale':1,'runtimeRotation':0})
    save_json(FOLDER/'timeline.json',{'durationMs':760,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'poses':timeline,'method':'Complete drawn body and joint poses. Every intermediate shape is newly drawn, registered with a common artwork scale. No temporal crossfade, whole-image squash, rotation or mesh interpolation.'})
    metadata={key:settings[key] for key in ['frameSize','columns','pivotX','pivotY','frameCount','durationsMs','durationMs','loop','closedEyeHold']}
    metadata.update({'image':'DesignAssets/Animations/CreatureHurtV5/'+FOLDER.name+'/hurt.webp','source':'Source/seed.png','method':'New complete anatomical crouch/curled key pose plus eight jointly generated complete in-between drawings. Seven selected poses use one common neutral registration scale and a planted near-forefoot anchor; first and final slots are exact original artwork. Drawn animation, no rig or whole-body animation transform.','timeline':'timeline.json','registration':'registration.json','renderer':'render.py','generation':'Source/generation.json','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','previewPauseMs':900,'artworkScale':1,'drawnPoseCount':7})
    save_json(FOLDER/'hurt.json',metadata)
    contact=Image.new('RGB',(size*4,(size+20)*2),(35,43,39));draw=ImageDraw.Draw(contact)
    for index,key in enumerate([0,1,2,4,6,7,9,15]):
        x=index%4*size;y=index//4*(size+20)
        contact.paste(frames[key],(x,y+20),frames[key]);draw.text((x+6,y+5),'frame '+str(key)+' / cel '+str(sequence[key]),(240,245,230))
    contact.save(FOLDER/'hurt-contact.png')
    print(FOLDER.name,len(frames),sum(settings['durationsMs']))

if __name__=='__main__':main()
