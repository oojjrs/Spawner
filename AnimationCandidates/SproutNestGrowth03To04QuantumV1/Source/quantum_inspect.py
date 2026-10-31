from pathlib import Path
import sys,json
import numpy as np
from PIL import Image,ImageDraw,GifImagePlugin
sys.path.insert(0,str(Path(__file__).parent))
from quantum_scene import Scene,rotation,sprout_parent
from quantum_mesh import rgba,cross,Y,X,over
ROOT=Path(__file__).resolve().parent.parent

def write(file,data):file.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def main():
    scene=Scene();report={'meshes':[],'boneResponse':[]};minimum=1e9
    for plant in scene.plants.values():
        for mesh in plant.front+plant.rear:
            base=mesh.bind_vertices[mesh.triangles];sign=np.sign(cross(base[:,1]-base[:,0],base[:,2]-base[:,0]));areas=[];identity=np.repeat(np.eye(3)[None],len(mesh.bind),0)
            for q in np.linspace(0,1,81):
                v,g=mesh.pose(q,identity);v=v[mesh.triangles];a=cross(v[:,1]-v[:,0],v[:,2]-v[:,0])*sign;areas.append(float(a.min()))
            changed=identity.copy();changed[-1]=rotation(7);v0,g=mesh.pose(.5,identity);v1,g=mesh.pose(.5,changed);response=float(np.linalg.norm(v1-v0,None,1).max());report['boneResponse'].append({'mesh':mesh.name,'sevenDegreeTipEditMaxPixels':response});report['meshes'].append({'name':mesh.name,'minimumSignedDoubleArea':min(areas),'weightError':float(abs(mesh.weights.sum(1)-1).max())});minimum=min(minimum,min(areas))
            if min(areas)<=0 or response<.2 or abs(mesh.weights.sum(1)-1).max()>1e-8:raise RuntimeError('Invalid deformation '+mesh.name)
        for q in np.linspace(0,1,41):
            parent=sprout_parent(plant.level,q);v,g=plant.stem.pose([0,0],parent);items=[(plant.stem,v)]
            for side,mesh in enumerate(plant.leaves):
                sign=1 if side==0 else -1;v,unused=mesh.pose([sign*54*q,sign*8*q],g[1]);items.append((mesh,v))
            for mesh,v in items:
                base=mesh.bind_vertices[mesh.triangles];sign=np.sign(cross(base[:,1]-base[:,0],base[:,2]-base[:,0]));a=v[mesh.triangles];value=float((cross(a[:,1]-a[:,0],a[:,2]-a[:,0])*sign).min());minimum=min(minimum,value)
                if value<=0:raise RuntimeError('Invalid FK '+mesh.name)
    frames=[];times=[i*.05 for i in range(8,26)]+[i*.05 for i in range(74,95)]
    board=Image.new('RGBA',(2048,1280),'#14251f');closeup=Image.new('RGBA',(1920,1440),'#14251f');draw=ImageDraw.Draw(board)
    for i,t in enumerate(times):
        im=rgba(scene.render(t));frames.append(im);board.alpha_composite(im.resize((256,256),Image.Resampling.LANCZOS),((i%8)*256,(i//8)*256));draw.text(((i%8)*256+8,(i//8)*256+8),format(t,'.2f'),'white')
        crop=im.crop((136,170,376,350)).resize((240,180));closeup.alpha_composite(crop,((i%8)*240,(i//8)*180))
    board.convert('RGB').save(ROOT/'motion-filmstrip.png');closeup.crop((0,0,1920,900)).convert('RGB').save(ROOT/'joint-filmstrip.png')
    images=[]
    for a in frames:
        bg=Image.new('RGBA',(512,512),'#14251f');bg.alpha_composite(a);images.append(bg.convert('RGB'))
    samples=Image.new('RGB',(512*8,512),'#14251f')
    for i,index in enumerate(np.linspace(0,len(images)-1,8).astype(int)):samples.paste(images[index],(i*512,0))
    palette=samples.quantize(256,Image.Quantize.MEDIANCUT);indexed=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in images];indexed[0].encoderinfo={'append_images':indexed[1:],'duration':[50]*len(indexed),'loop':0,'disposal':1,'optimize':False}
    with (ROOT/'motion-pilot.gif').open('wb') as file:GifImagePlugin._save_all(indexed[0],file,str(ROOT/'motion-pilot.gif'))
    report['minimumAreaAllMeshes']=minimum;report['intervalFrames']=len(frames);report['intervalMs']=50;write(ROOT/'rig-audit.json',report);print(json.dumps(report))

if __name__=='__main__':main()
