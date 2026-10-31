from pathlib import Path
import sys,json,math,time
import numpy as np
from PIL import Image,ImageDraw,WebPImagePlugin
sys.path.insert(0,str(Path(__file__).parent))
from build_rig import Scene,ROOT,rgba,save_json,cross,rotation

def draw_grid(image,scene,t):
    result=image.copy();d=ImageDraw.Draw(result)
    for side in range(2):
        a,b,p=scene.interval(t,side);part=scene.front[side];vertices,cap=part.pose(a,b,p,scene.settle(t,side));g=part.skin.pose(a,b,p,np.repeat(np.eye(3)[None],4,0))[1]
        for tri in part.part.triangles[::12]:d.line([tuple(v) for v in vertices[tri]]+[tuple(vertices[tri[0]])],(40,180,245,170),1)
        centers=[tuple(v[:2,2]) for v in g];d.line(centers,(255,115,30,255),3)
        for x,y in centers:d.ellipse((x-3,y-3,x+3,y+3),(255,170,30,255))
    for record in scene.records[-1]['arms'].values():
        d.line([tuple(record[k]) for k in ['root','joint','tip']],(240,70,125,255),2)
        for k in ['root','joint','tip']:
            x,y=record[k];d.ellipse((x-3,y-3,x+3,y+3),(240,70,125,255))
    return result

def render(mode):
    scene=Scene();folder=ROOT/'Renders';folder.mkdir(511,True,True);records={};minimum=1e9;inverted=[]
    timeline=[0]+[.6+.04*i for i in range(100)]+[4.6]
    if mode=='pilot':indices=list(range(1,27))
    else:indices=list(range(102))
    for index in indices:
        t=timeline[index];im=rgba(scene.render(t));im.save(folder/('%03d.png'%index));records[str(index)]=scene.records[-1]
        for part in scene.front+scene.rear:
            side=part.side;a,b,p=scene.interval(t if part in scene.front else t-.1,side)
            vertices=part.pose(a,b,p,scene.settle(t,side))[0] if part in scene.front else part.vertices(a,b,p)
            triangles=part.part.triangles if part in scene.front else part.triangles
            v=vertices[triangles];areas=cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);minimum=min(minimum,float(areas.min()))
            if np.any(areas<-.0001):inverted.append([index,part.skin.name,int(np.sum(areas<-.0001))])
        if index%10==0:print('render',index,t)
    save_json(ROOT/(mode+'-records.json'),records)
    report={'frames':len(indices),'minimumSignedTriangleArea':minimum,'invertedTriangles':inverted,'arms':{k:{'maximumContactError':v.max_error,'reachClamps':v.clamped,'lengths':v.lengths} for k,v in scene.arms.items()}}
    save_json(ROOT/(mode+'-geometry.json'),report);print(json.dumps(report))
    cols=7;cell=256;rows=math.ceil(len(indices)/cols);board=Image.new('RGBA',(cols*cell,rows*cell),'#182923');d=ImageDraw.Draw(board)
    for i,index in enumerate(indices):
        im=Image.open(folder/('%03d.png'%index)).resize((cell,cell),Image.Resampling.LANCZOS);x=(i%cols)*cell;y=(i//cols)*cell;board.alpha_composite(im,(x,y));d.text((x+8,y+8),'%.2fs'%timeline[index],'white')
    board.convert('RGB').save(ROOT/(mode+'-filmstrip.png'))
    if mode=='pilot':
        frames=[]
        for index in indices:
            bg=Image.new('RGBA',(512,512),'#182923');bg.alpha_composite(Image.open(folder/('%03d.png'%index)));frames.append(bg.convert('RGB'))
        frames[0].encoderinfo={'append_images':frames[1:],'duration':40,'loop':0,'lossless':True,'method':4}
        with (ROOT/'close-pilot.webp').open('wb') as output:WebPImagePlugin._save_all(frames[0],output,str(ROOT/'close-pilot.webp'))
    else:
        save_json(ROOT/'rig.json',scene.data())
        board=Image.new('RGBA',(1536,1024),'#182923')
        for i,t in enumerate([0,1.15,1.5,2.4,3.2,4.2]):
            im=rgba(scene.render(t));board.alpha_composite(draw_grid(im,scene,t),((i%3)*512,(i//3)*512))
        board.convert('RGB').save(ROOT/'rig-controls.png')
    for part in scene.front+scene.rear:
        if np.max(abs(part.skin.weights.sum(1)-1))>1e-8:raise RuntimeError('Unnormalized weights')
        a,b,p='open03','closed03',.35
        offsets=np.repeat(np.eye(3)[None],4,0);base=part.skin.pose(a,b,p,offsets)[0]
        offsets[1]=rotation(8,[0,0]);edited=part.skin.pose(a,b,p,offsets)[0]
        if np.linalg.norm(base-edited)<1:raise RuntimeError('Bone edit did not affect mesh')
    print('weights and bone controls active')

if __name__=='__main__':render(sys.argv[1])
