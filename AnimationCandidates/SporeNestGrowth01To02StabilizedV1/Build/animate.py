from pathlib import Path
import sys
import json
import numpy as np
from PIL import Image,GifImagePlugin
from contour import profile,deform,smooth,bg,animated
from parts import extract,gills,linings,body_mask,over,clean
import cv2

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'Sources'
PARTS=SOURCE/'Parts'
SCRATCH=ROOT.parent/'$Trash'/'SporeStabilizedV1'
YY,XX=np.mgrid[:640,:640].astype(np.float32)


def prepare():
    material=linings()
    rigs={}
    manifest={}
    for j,(stage,middle) in enumerate([('small','halfclosed'),('adult','halflift')]):
        names=[stage+'-upright',stage+'-'+middle,stage+'-rest']
        pieces=[extract(n) for n in names]
        limits=[profile(p['cap']) for p in pieces]
        target_left=(limits[0]['left']+limits[2]['left'])/2
        target_right=(limits[0]['right']+limits[2]['right'])/2
        sx=(target_right-target_left)/(limits[1]['right']-limits[1]['left'])
        matrix=np.float32([[sx,0,target_left-limits[1]['left']*sx],[0,1,0]])
        pieces[1]['cap']=rigid(pieces[1]['cap'],matrix)
        Image.fromarray(pieces[1]['cap']).save(PARTS/(names[1]+'-cap.png'))
        back,secondary=gills(pieces[0],material[j])
        Image.fromarray(back).save(PARTS/(stage+'-gills-complete.png'))
        Image.fromarray(secondary).save(PARTS/(stage+'-secondary.png'))
        caps=[{'image':p['cap'],'profile':profile(p['cap'])} for p in pieces]
        rigs[stage]={'body':pieces[0]['body'],'gills':back,'secondary':secondary,'caps':caps}
        manifest[stage]={'fixedBody':'Sources/Parts/'+stage+'-upright-body.png','gills':'Sources/Parts/'+stage+'-gills-complete.png','secondary':'Sources/Parts/'+stage+'-secondary.png','headCels':['Sources/Parts/'+n+'-cap.png' for n in names],'headControls':[c['profile']['controls'].tolist() for c in caps],'middleHeadRegistration':{'originalBounds':[limits[1]['left'],limits[1]['right']],'targetBounds':[target_left,target_right],'matrix':matrix.tolist()},'secondaryClosedOffset':[-40,20],'root':[320,576]}
    manifest['method']='fixed-stage-body-with-independent-cap-and-lined-gills'
    manifest['drawOrder']=['secondary','gills','fixedBody','cap']
    manifest['fixedForegroundBandTop']=569
    manifest['growthBodies']={'small':'Sources/Parts/small-upright-body.png','medium':'Sources/Parts/medium-fixed-body.png','adult':'Sources/Parts/adult-upright-body.png','switchFramesInCoveredSequence':[21,46]}
    manifest['opacityTransitions']=False
    (ROOT/'rig.json').write_bytes((json.dumps(manifest)+'\r\n').encode('utf-8'))
    return rigs


def underside(rig,front,q):
    if q>=1:
        return np.zeros_like(front)
    source=rig['caps'][0]['profile']
    target=profile(front)
    norm=(XX-target['left'])/(target['right']-target['left'])
    sx=source['left']+norm*(source['right']-source['left'])
    sample=np.clip(norm*512,0,512)
    original_edge=np.interp(sample,np.arange(513),source['bottom'])
    current_edge=np.interp(sample,np.arange(513),target['bottom'])-3
    sy=original_edge+(YY-current_edge)/max((1-q)**1.3,.002)
    p=rig['gills'].astype(np.float32)/255
    p[:,:,:3]*=p[:,:,3:4]
    out=cv2.remap(p,sx.astype(np.float32),sy.astype(np.float32),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    out[(norm<0)|(norm>1)]=0
    out[:,:,:3]/=np.maximum(out[:,:,3:4],1e-8)
    back=np.uint8(np.clip(out*255+.5,0,255))
    back[back[:,:,3]<20]=0
    return back


def rigid(a,matrix):
    p=a.astype(np.float32)/255
    p[:,:,:3]*=p[:,:,3:4]
    p=cv2.warpAffine(p,matrix,(640,640),cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    p[:,:,:3]/=np.maximum(p[:,:,3:4],1e-8)
    out=np.uint8(np.clip(p*255+.5,0,255))
    out[out[:,:,3]<20]=0
    return out


def pose(rig,q):
    pair=0 if q<=.5 else 1
    amount=q*2 if pair==0 else (q-.5)*2
    caps=rig['caps']
    source=caps[pair] if amount<.5 else caps[pair+1]
    front=deform(source,caps[pair],caps[pair+1],amount)
    back=underside(rig,front,q)
    matrix=np.float32([[1,0,-40*q],[0,1,20*q]])
    secondary=rigid(rig['secondary'],matrix)
    result=over(front,over(rig['body'],over(back,secondary)))
    result[569:]=rig['body'][569:]
    return clean(result)


def preview(frames,target,stem):
    views=[bg(np.array(f),'#20282e').crop((0,240,640,608)) for f in frames]
    animated(views,target/(stem+'.webp'),0)
    board=Image.new('RGB',(7680,368*((len(frames)+11)//12)))
    for i,v in enumerate(views):
        board.paste(v,(i%12*640,i//12*368))
    palette=board.quantize(256,Image.Quantize.MEDIANCUT)
    gif=[v.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for v in views]
    gif[0].encoderinfo={'append_images':gif[1:],'duration':[50]*len(gif),'loop':0,'disposal':2,'optimize':False}
    with (target/(stem+'.gif')).open('wb') as f:
        GifImagePlugin._save_all(gif[0],f,str(target/(stem+'.gif')))
    return views


def connections(rigs):
    folder=SOURCE/'ConnectionFrames'
    folder.mkdir(511,True,True)
    groups={}
    for stage,phase,count in [('small','lower',20),('adult','lift',28)]:
        frames=[]
        for i in range(count+1):
            q=smooth(i/count)
            if stage=='adult':
                q=1-q
            frame=Image.fromarray(pose(rigs[stage],q))
            frame.save(folder/(phase+'-'+str(i).zfill(3)+'.png'))
            frames.append(frame)
        groups[phase]=frames
    return groups


def growth(rigs):
    sheet=Image.open(SOURCE/'covered-growth-sheet.png').convert('RGBA')
    folder=SCRATCH/'GrowthFrames'
    folder.mkdir(511,True,True)
    medium=rigid(rigs['small']['body'],np.float32([[1.33,0,320*(1-1.33)],[0,1.33,576*(1-1.33)]]))
    Image.fromarray(medium).save(PARTS/'medium-fixed-body.png')
    frames=[]
    for i in range(66):
        a=np.array(sheet.crop((i%11*640,i//11*640,(i%11+1)*640,(i//11+1)*640)))
        mask=body_mask(a,True)
        head=a.copy()
        head[mask>0]=0
        count,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(head[:,:,3]>0),8)
        main=1+int(np.argmax(stats[1:,4]))
        head[labels!=main]=0
        body=rigs['small']['body'] if i<21 else medium if i<46 else rigs['adult']['body']
        result=over(head,body)
        result[569:]=body[569:]
        frame=Image.fromarray(clean(result))
        frame.save(folder/(str(i).zfill(3)+'.png'))
        frames.append(frame)
    return frames


def main():
    rigs=prepare()
    if '--study' in sys.argv:
        groups=connections(rigs)
        frames=groups['lower']+[groups['lower'][-1]]*8+groups['lift']+[groups['lift'][-1]]*8
        animated(frames,SCRATCH/'connections-study.webp',1)
        views=preview(frames,SCRATCH,'connections-preview')
        board=Image.new('RGB',(3840,736),'#20282e')
        for j,i in enumerate([0,4,8,12,16,20,29,34,40,46,52,57]):
            board.paste(views[i],(j%6*640,j//6*368))
        board.save(SCRATCH/'connections-study-contact.png')
        print(json.dumps({'studyFrames':len(frames)}))
        return
    folder=SOURCE/'ConnectionFrames'
    entry=[Image.open(folder/('lower-'+str(i).zfill(3)+'.png')).convert('RGBA') for i in range(20)]
    lift=[Image.open(folder/('lift-'+str(i).zfill(3)+'.png')).convert('RGBA') for i in range(28)]
    final=Image.open(folder/'lift-028.png').convert('RGBA')
    frames=entry+growth(rigs)+lift+[final.copy() for i in range(10)]
    output=ROOT/'Frames'
    output.mkdir(511,True,True)
    sheet=Image.new('RGBA',(7680,7040))
    for i,f in enumerate(frames):
        f.save(output/(str(i).zfill(3)+'.png'))
        sheet.paste(f,(i%12*640,i//12*640))
    sheet.save(ROOT/'growth-sheet.png')
    animated(frames,ROOT/'growth.webp',1)
    views=preview(frames,ROOT,'preview')
    board=Image.new('RGB',(2560,1472),'#20282e')
    for j,i in enumerate([0,5,10,15,20,36,41,45,61,66,70,85,90,100,113,123]):
        board.paste(views[i],(j%4*640,j//4*368))
    board.save(ROOT/'contact.png')
    data={'frameSize':[640,640],'root':[320,576],'frameCount':124,'durationMs':6200,'frameDurationMs':50,'columns':12,'rows':11,'loop':False,'sheet':'growth-sheet.png','animation':'growth.webp','method':'fixed-stage-body-independent-painted-head-cels-and-complete-gill-lining','timingUnchangedFrom':'SporeNestGrowth01To02RedrawV2','holdsMs':[800,800,800],'growthMs':[450,450],'markersMs':{'covered':1000,'growth1':1800,'hold1':2250,'growth2':3050,'hold2':3500,'liftStart':4300,'liftEnd':5700,'completed':6200},'opacityTransitions':False}
    (ROOT/'animation.json').write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
    print(json.dumps({'frames':124,'durationMs':6200}))


main()
