from pathlib import Path
import sys,json,math,hashlib
import numpy as np
from PIL import Image,WebPImagePlugin
sys.path.insert(0,str(Path(__file__).parent))
import assemble as a
from meshlib import rgba
ROOT=a.ROOT

def write(path,data):path.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def save_webp(frames,path,durations,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':loop,'lossless':True,'method':4}
    with path.open('wb') as output:WebPImagePlugin._save_all(frames[0],output,str(path))

def export():
    folder=ROOT/'Frames';folder.mkdir(511,True,True)
    for node in a.modules.values():node.keys=[]
    for family in a.b.arms.values():
        for arm in family:arm.keys=[]
    times=[0]+[round(.6+i*.04,6) for i in range(100)]+[4.6]
    durations=[600]+[40]*100+[1000]
    frames=[]
    for i,t in enumerate(times):
        im=rgba(a.at(t));im.save(folder/('frame-'+str(i).zfill(3)+'.png'));frames.append(im)
        if i%10==0:print('render',i,'/',len(times),flush=True)
    columns=8;rows=math.ceil(len(frames)/columns)
    sheet=Image.new('RGBA',(columns*512,rows*512))
    for i,frame in enumerate(frames):sheet.paste(frame,((i%columns)*512,(i//columns)*512))
    sheet.save(ROOT/'growth.png')
    save_webp(frames,ROOT/'growth.webp',durations,1)
    previews=[]
    for frame in frames:
        bg=Image.new('RGBA',(512,512),'#182923')
        bg.alpha_composite(frame)
        previews.append(bg.convert('RGB').resize((320,320),Image.Resampling.LANCZOS))
    save_webp(previews,ROOT/'preview.webp',durations,0)
    master=Image.new('RGB',(320*4,320*4),'#182923')
    selected=np.linspace(0,len(previews)-1,16).astype(int)
    for k,i in enumerate(selected):master.paste(previews[i],((k%4)*320,(k//4)*320))
    palette=master.quantize(256,Image.Quantize.MEDIANCUT)
    gif_frames=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in previews]
    gif_frames[0].encoderinfo={'append_images':gif_frames[1:],'duration':durations,'loop':0,'disposal':1,'optimize':False}
    from PIL import GifImagePlugin
    with (ROOT/'preview.gif').open('wb') as output:GifImagePlugin._save_all(gif_frames[0],output,str(ROOT/'preview.gif'))
    board_times=[0,1.,1.5,2.1,2.55,2.8,3.,3.2,3.6,4.,4.3,4.6]
    board=Image.new('RGBA',(2048,1536),'#182923')
    for k,t in enumerate(board_times):
        index=int(np.argmin(np.abs(np.array(times)-t)))
        board.alpha_composite(frames[index],((k%4)*512,(k//4)*512))
    board.convert('RGB').save(ROOT/'keyframes.png')
    parts={}
    for family in [a.b.oldflower,a.grow,a.b.newflower]:
        for m in family.parts.values():parts[m.name]=m.data()
    for m in a.leaves:parts[m.name]=m.data()
    arms={}
    for kind,family in a.b.arms.items():
        for arm in family:
            images=[]
            for k,im in enumerate(arm.sources):
                name='rig-'+arm.name+'-'+str(k)+'.png';rgba(im).save(ROOT/'Parts'/name);images.append('Parts/'+name)
            arms[arm.name]={'root':arm.root.tolist(),'joint':arm.joint.tolist(),'tip':arm.tip.tolist(),'lengths':arm.lengths,'bindMatrices':[x.tolist() for x in arm.bind],'bones':[{'name':arm.name+'-'+str(k),'parent':'root' if k==0 else arm.name+'-'+str(k-1),'localBind':(np.linalg.inv(a.b.matrix((256,448),0) if k==0 else arm.bind[k-1])@arm.bind[k]).tolist(),'length':arm.lengths[min(k,1)]} for k in range(3)],'attachments':[{'image':image,'bone':arm.name+'-'+str(k),'rigid':True,'weights':[1,1,1,1]} for k,image in enumerate(images)],'keys':arm.keys,'opacityKeys':[]}
    rig={'format':'local-hybrid-sprite-rig-v1','frameSize':[512,512],'pivot':[256,448],'rootMotion':False,'camera':'orthographic-xy','sourceKeyframes':['References/level03-start.png','References/level03-closed.png','References/level04-closed.png','References/level04-end.png'],'approval':'keyframe-approval.json','weightedParts':parts,'arms':arms,'rigidModules':{n:m.data() for n,m in a.modules.items()},'stagesSeconds':{'rest':[0,.6],'close':[.6,1.5],'baseAssembly':[1.5,2.2],'domeAssembly':[2.2,2.8],'closedGrowth':[2.8,3.2],'open':[3.2,4.2],'settle':[4.2,4.6],'finalHold':[4.6,5.6]},'textureSelection':'single-source-per-interval-no-crossfade','settle':{'source':'References/level04-end.png','method':'local-tip-displacement','controls':[{'part':4,'center':[199,192],'pivot':[257,317],'maxDegrees':.7,'radius':34},{'part':5,'center':[320,192],'pivot':[261,317],'maxDegrees':-.7,'radius':34},{'part':3,'center':[238,190],'pivot':[259,218],'maxDegrees':-2.5,'radius':22},{'part':3,'center':[280,190],'pivot':[261,218],'maxDegrees':3,'radius':22}]},'opacityKeys':[],'spineCompatibilityVerified':False,'renderer':'Source/assemble.py'}
    write(ROOT/'rig.json',rig)
    metadata={'image':'growth.png','animatedImage':'growth.webp','preview':'preview.webp','frameSize':[512,512],'frameCount':len(frames),'columns':columns,'rows':rows,'durationsMs':durations,'durationMs':sum(durations),'pivot':[256,448],'rootMotion':False,'loop':False,'previewRepeats':True,'frameTimesSeconds':times,'sourceRig':'rig.json','sourceFrames':'Frames','sourceKeyframes':rig['sourceKeyframes'],'sourceApproval':'keyframe-approval.json','startSha256':hashlib.sha256(frames[0].tobytes()).hexdigest(),'endSha256':hashlib.sha256(frames[-1].tobytes()).hexdigest()}
    write(ROOT/'animation.json',metadata)
    print('export complete',sum(durations),'ms',len(frames),'frames',flush=True)

if __name__=='__main__':export()