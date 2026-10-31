from pathlib import Path
import sys
import json
import numpy as np
from PIL import Image, GifImagePlugin
from contour import profile, deform, smooth, bg, animated
import cv2

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'Sources'
SCRATCH = ROOT.parent / '$Trash' / 'SporeRedrawV2'
SIZE = 640
GROUND = 576


def read(name):
    return np.array(Image.open(SOURCE / (name + '.png')).convert('RGBA'))


def cel(a, name, q):
    return {'image': a, 'profile': profile(a), 'id': name, 'q': q}


def height(a):
    rows = np.where(a[:, :, 3] > 19)[0]
    return int(rows.max() - rows.min() + 1)


def prepare():
    rigs, records = {}, []
    output = SOURCE / 'DrawnCels'
    output.mkdir(511, True, True)
    for stage, names, positions, factor in [
        ('small', ['small-upright','small-halfclosed','small-rest'], [(0,.1),(1,.2),(2,.3),(3,.4),(4,.6),(5,.7),(6,.8),(7,.9)], 260 / 326),
        ('adult', ['adult-upright','adult-halflift','adult-rest'], [(0,.92),(1,.75),(2,.6),(4,.2)], 394 / 374)
    ]:
        keys = [read(n) for n in names]
        cels = [cel(a,n,q) for a,n,q in zip(keys,names,[0,.5,1])]
        raw = read(stage + '-inbetweens-raw')
        raw[raw[:, :, 3] < 20] = 0
        Image.fromarray(raw).save(SOURCE / (stage + '-inbetweens.png'))
        count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(raw[:, :, 3] > 0), 8)
        ordered = [v[2] for v in sorted((int(centers[k, 1] > 500), centers[k, 0], k) for k in range(1,count))]
        for j, q in positions:
            k = ordered[j]
            x,y,w,h,area = [int(v) for v in stats[k]]
            image = raw[y:y+h,x:x+w].copy()
            image[labels[y:y+h,x:x+w] != k] = 0
            target_height = int(round(np.interp(q,[0,.5,1],[height(a) for a in keys])))
            target_width = int(round(w * factor))
            p = image.astype(np.float32) / 255
            p[:, :, :3] *= p[:, :, 3:4]
            p = cv2.resize(p,(target_width,target_height),None,0,0,cv2.INTER_AREA)
            p[:, :, :3] /= np.maximum(p[:, :, 3:4],1e-8)
            image = np.uint8(np.clip(p * 255 + .5,0,255))
            image[image[:, :, 3] < 20] = 0
            frame = np.zeros((SIZE,SIZE,4),np.uint8)
            left,top = (SIZE-target_width)//2,GROUND-target_height+1
            frame[top:top+target_height,left:left+target_width] = image
            name = stage + '-' + str(int(round(q * 100))).zfill(2)
            Image.fromarray(frame).save(output / (name + '.png'))
            cels.append(cel(frame,name,q))
            records.append({'id':name,'sourceAtlas':stage+'-inbetweens-raw.png','sourceRect':[x,y,w,h],'closure':q,'stageWidthScale':factor,'headToRootSpan':target_height,'placement':[left,top],'pixels':area})
        rigs[stage] = [v[1] for v in sorted((c['q'],c) for c in cels)]
    data = {'canvas':[640,640],'root':[320,576],'method':'complete-fresh-painted-inbetween-cels','registration':'common-stage-width-scale-and-approved-head-to-root-motion-trajectory','opacityTransitions':False,'keysApproved':True,'cels':records,'sequence':{name:[{'id':c['id'],'closure':c['q'],'controls':c['profile']['controls'].tolist()} for c in values] for name,values in rigs.items()}}
    (ROOT / 'cels.json').write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))
    return rigs


def pose(rig,q):
    for c in rig:
        if abs(c['q']-q) < 1e-8:
            return c['image'].copy(), c['id']
    for a,b in zip(rig[:-1],rig[1:]):
        if a['q'] <= q <= b['q']:
            amount = (q-a['q'])/(b['q']-a['q'])
            source = a if amount < .5 else b
            return deform(source,a,b,amount),source['id']
    raise ValueError(str(q))


def connections(rigs):
    folder = SOURCE / 'ConnectionFrames'
    folder.mkdir(511,True,True)
    manifest,frames = {},{}
    for stage,phase,count in [('small','lower',20),('adult','lift',28)]:
        images,states = [],[]
        for i in range(count+1):
            q = smooth(i/count)
            if stage == 'adult':
                q = 1-q
            a,name = pose(rigs[stage],q)
            image = Image.fromarray(a)
            image.save(folder / (phase+'-'+str(i).zfill(3)+'.png'))
            images.append(image)
            states.append({'frame':i,'closure':q,'cel':name})
        manifest[phase] = states
        frames[phase] = images
    (ROOT / 'connections-timeline.json').write_bytes((json.dumps(manifest)+'\r\n').encode('utf-8'))
    return frames,manifest


def preview(frames,target,stem):
    views = [bg(np.array(f),'#20282e').crop((0,240,640,608)) for f in frames]
    animated(views,target/(stem+'.webp'),0)
    columns = 12
    rows = (len(views)+columns-1)//columns
    palette_board = Image.new('RGB',(640*columns,368*rows))
    for i,v in enumerate(views):
        palette_board.paste(v,(i%columns*640,i//columns*368))
    palette = palette_board.quantize(256,Image.Quantize.MEDIANCUT)
    gif = [v.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for v in views]
    gif[0].encoderinfo = {'append_images':gif[1:],'duration':[50]*len(gif),'loop':0,'disposal':2,'optimize':False}
    with (target/(stem+'.gif')).open('wb') as f:
        GifImagePlugin._save_all(gif[0],f,str(target/(stem+'.gif')))
    return views


def main():
    SCRATCH.mkdir(511,True,True)
    if '--study' in sys.argv:
        rigs = prepare()
        groups,states = connections(rigs)
        frames = groups['lower']+[groups['lower'][-1]]*8+groups['lift']+[groups['lift'][-1]]*8
        animated(frames,SCRATCH/'connections-study.webp',1)
        views = preview(frames,SCRATCH,'connections-preview')
        board = Image.new('RGB',(640*6,368*2),'#20282e')
        for j,k in enumerate([0,4,8,12,16,20,29,34,40,46,52,57]):
            board.paste(views[k],(j%6*640,j//6*368))
        board.save(SCRATCH/'connections-study-contact.png')
        print(json.dumps({'studyFrames':len(frames),'durationMs':len(frames)*50}))
        return
    folder = SOURCE/'ConnectionFrames'
    entry = [Image.open(folder/('lower-'+str(i).zfill(3)+'.png')).convert('RGBA') for i in range(20)]
    growth_sheet = Image.open(SOURCE/'covered-growth-sheet.png').convert('RGBA')
    growth = [growth_sheet.crop((i%11*640,i//11*640,(i%11+1)*640,(i//11+1)*640)) for i in range(66)]
    lift = [Image.open(folder/('lift-'+str(i).zfill(3)+'.png')).convert('RGBA') for i in range(28)]
    final = Image.open(folder/'lift-028.png').convert('RGBA')
    frames = entry+growth+lift+[final.copy() for i in range(10)]
    output = ROOT/'Frames'
    output.mkdir(511,True,True)
    sheet = Image.new('RGBA',(7680,7040))
    for i,f in enumerate(frames):
        f.save(output/(str(i).zfill(3)+'.png'))
        sheet.paste(f,(i%12*640,i//12*640))
    sheet.save(ROOT/'growth-sheet.png')
    animated(frames,ROOT/'growth.webp',1)
    views = preview(frames,ROOT,'preview')
    board = Image.new('RGB',(2560,1472),'#20282e')
    for j,k in enumerate([0,5,10,15,20,36,41,45,61,66,70,85,90,100,113,123]):
        board.paste(views[k],(j%4*640,j//4*368))
    board.save(ROOT/'contact.png')
    previous = json.loads((SOURCE/'growth.json').read_text('utf-8'))
    connections_data = json.loads((ROOT/'connections-timeline.json').read_text('utf-8'))
    metadata = {'status':'completed-candidate','frameSize':[640,640],'root':[320,576],'frameCount':len(frames),'durationMs':len(frames)*50,'frameDurationMs':50,'columns':12,'rows':11,'sheet':'growth-sheet.png','animation':'growth.webp','loop':False,'keysApproved':True,'connectionApproval':'user-approved-connection-poses-and-requested-full-animation-2026-10-31','sourceVersion':'SporeNestGrowth01To02RedrawV1','coveredGrowthReusedWithoutChanges':True,'holdsMs':[800,800,800],'growthMs':[450,450],'markersMs':{'lowerStart':0,'covered':1000,'growth1':1800,'hold1':2250,'growth2':3050,'hold2':3500,'liftStart':4300,'liftEnd':5700,'completed':6200},'method':'freshly-painted-complete-connection-cels-and-short-geometric-inbetweens-with-approved-covered-growth','opacityTransitions':False,'dependencies':['numpy','Pillow','opencv-python-headless'],'coveredTimeline':previous['timeline'],'connectionsTimeline':connections_data}
    (ROOT/'animation.json').write_bytes((json.dumps(metadata)+'\r\n').encode('utf-8'))
    print(json.dumps({'frames':len(frames),'durationMs':len(frames)*50,'output':str(ROOT)}))


main()
