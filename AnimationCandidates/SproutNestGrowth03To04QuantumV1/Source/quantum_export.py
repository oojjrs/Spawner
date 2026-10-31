from pathlib import Path
import json
import numpy as np
from PIL import Image,ImageDraw,GifImagePlugin,WebPImagePlugin
from quantum_scene import Scene,sprout_parent
from quantum_mesh import rgba,read,over,apply,smooth
ROOT=Path(__file__).resolve().parent.parent

def write(file,data):file.write_bytes((json.dumps(data)+'\r\n').encode('utf-8'))

def encode_webp(path,frames,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':[50]*len(frames),'loop':loop,'lossless':True,'method':4}
    with path.open('wb') as file:WebPImagePlugin._save_all(frames[0],file,str(path))

def encode_gif(path,frames):
    images=[]
    for im in frames:
        bg=Image.new('RGBA',(512,512),'#14251f');bg.alpha_composite(im);images.append(bg.convert('RGB'))
    sample=Image.new('RGB',(4096,1024))
    for i,k in enumerate(np.linspace(0,len(images)-1,16).astype(int)):sample.paste(images[k],((i%8)*512,(i//8)*512))
    palette=sample.quantize(256,Image.Quantize.MEDIANCUT);indexed=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in images];indexed[0].encoderinfo={'append_images':indexed[1:],'duration':[50]*len(indexed),'loop':0,'disposal':1,'optimize':False}
    with path.open('wb') as file:GifImagePlugin._save_all(indexed[0],file,str(path))

def rig_view(scene):
    board=Image.new('RGBA',(2048,1024),'#14251f')
    for col,(level,q) in enumerate([(3,0),(3,1),(4,1),(4,0)]):
        plant=scene.plants[level];im=rgba(plant.render(q));board.alpha_composite(im,(col*512,0));overlay=im.copy();draw=ImageDraw.Draw(overlay)
        for mesh in plant.front+plant.rear:
            v,g=mesh.pose(q,np.repeat(np.eye(3)[None],len(mesh.bind),0))
            for tri in mesh.triangles:draw.line([tuple(p) for p in np.vstack([v[tri],v[tri[0]]])],(55,220,220,120),1)
            points=g[:,:2,2]
            draw.line([tuple(p) for p in points],(255,100,20),3)
            for x,y in points:draw.ellipse((x-3,y-3,x+3,y+3),(255,240,50),(40,30,20),1)
        parent=sprout_parent(level,q);v,g=plant.stem.pose([0,0],parent);chains=[g]
        for side,leaf in enumerate(plant.leaves):
            sign=1 if side==0 else -1;v,g2=leaf.pose([sign*54*q,sign*8*q],g[1]);chains.append(g2)
        for chain in chains:draw.line([tuple(p) for p in chain[:,:2,2]],(255,0,220),3)
        board.alpha_composite(overlay,(col*512,512))
    board.convert('RGB').save(ROOT/'rig-view.png')

def main():
    (ROOT/'Frames').mkdir(511,True,True);scene=Scene();frames=[];cache={};sheet=Image.new('RGBA',(4096,7168));contact=Image.new('RGBA',(2048,3584),'#14251f');draw=ImageDraw.Draw(contact)
    for i in range(112):
        t=i/20
        if t<=.4:key='start'
        elif 1.25<=t<1.7:key='closed03'
        elif 1.7<=t<2.5:key='stage1'
        elif 2.5<=t<3.3:key='stage2'
        elif 3.3<=t<=3.7:key='closed04'
        elif t>=4.7:key='end'
        else:key='frame'+str(i)
        pixels=scene.render(t) if key not in cache else None
        if pixels is not None:cache[key]=rgba(pixels)
        else:
            previous=dict(scene.keys[-1]);previous['seconds']=t;scene.keys.append(previous)
        im=cache[key].copy();frames.append(im);im.save(ROOT/'Frames'/('growth-'+str(i).zfill(3)+'.png'));sheet.paste(im,((i%8)*512,(i//8)*512));contact.alpha_composite(im.resize((256,256),Image.Resampling.LANCZOS),((i%8)*256,(i//8)*256));draw.text(((i%8)*256+6,(i//8)*256+6),str(i)+' '+format(t,'.2f'),'white')
    sheet.save(ROOT/'growth.png');contact.convert('RGB').save(ROOT/'frames-contact.png');encode_webp(ROOT/'growth.webp',frames,1);encode_webp(ROOT/'preview.webp',frames,0);encode_gif(ROOT/'preview.gif',frames);rig_view(scene)
    rig=scene.data();write(ROOT/'rig.json',rig)
    records=[{'index':i,'file':'Frames/growth-'+str(i).zfill(3)+'.png','seconds':i/20,'durationMs':50,'rect':[(i%8)*512,(i//8)*512,512,512],'state':rig['timeline'][i]['stage']} for i in range(112)]
    write(ROOT/'animation.json',{'name':'SproutNestGrowth03To04QuantumV1','frameSize':[512,512],'pivotPixels':[256,448],'fps':20,'durationMs':5600,'loop':False,'frameCount':112,'sheet':{'file':'growth.png','size':[4096,7168],'columns':8,'rows':14},'quantumJumps':[{'seconds':1.7,'frame':34,'state':1},{'seconds':2.5,'frame':50,'state':2},{'seconds':3.3,'frame':66,'state':3}],'frames':records})
    print('exported',len(frames),'frames; 5600 ms; 40 deform/FK bones; 20 part layers')

if __name__=='__main__':main()
