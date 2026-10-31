import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, _webp

HERE=Path(__file__).resolve().parent
SIZE=512

def write_json(path,data):
    encoder=json.JSONEncoder()
    encoder.ensure_ascii=False
    encoder.indent=2
    path.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)

def rot(pivot,degrees):
    a=math.radians(degrees)
    c,s=math.cos(a),math.sin(a)
    x,y=pivot
    return np.array([[c,-s,x-c*x+s*y],[s,c,y-s*x-c*y],[0,0,1]],float)

def affine(image,matrix):
    inverse=np.linalg.inv(matrix)
    return image.transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC)

def sample(pixels,x,y):
    x=np.clip(x,0,510.9999)
    y=np.clip(y,0,510.9999)
    ix,iy=x.astype(int),y.astype(int)
    u,v=(x-ix)[:,None],(y-iy)[:,None]
    return (pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v

def mesh_render(image,mesh,matrices):
    pixels=np.array(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    vertices=np.asarray(mesh['vertices'],float)
    homogeneous=np.column_stack((vertices,np.ones(len(vertices))))
    transformed=np.einsum('bij,vj->bvi',np.asarray(matrices),homogeneous)[:,:,:2]
    posed=np.einsum('vb,bvi->vi',np.asarray(mesh['weights']),transformed)
    output=np.zeros((512,512,4),float)
    for indices in mesh['triangles']:
        destination=posed[indices]
        source=vertices[indices]
        lower=np.maximum(np.floor(destination.min(0)).astype(int),0)
        upper=np.minimum(np.ceil(destination.max(0)).astype(int),511)
        if np.any(upper<lower):
            continue
        x,y=np.meshgrid(np.arange(lower[0],upper[0]+1),np.arange(lower[1],upper[1]+1))
        system=np.vstack((destination.T,np.ones(3)))
        if abs(np.linalg.det(system))<0.01:
            continue
        barycentric=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
        inside=np.all(barycentric>=-0.00001,0)
        coordinates=source.T@barycentric[:,inside]
        output[y.ravel()[inside],x.ravel()[inside]]=sample(pixels,coordinates[0],coordinates[1])
    alpha=output[:,:,3:4]
    rgb=output[:,:,:3]/np.maximum(alpha,1/255)
    result=np.concatenate((rgb,alpha),2)
    return Image.fromarray(np.uint8(np.clip(result*255+.5,0,255))),posed

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def main():
    rig=json.loads((HERE/'rig.json').read_text('utf-8'))
    records=json.loads((HERE/'landmarks.json').read_text('utf-8'))
    metadata=json.loads((HERE/'death.json').read_text('utf-8'))
    mesh=json.loads((HERE/'leaf-mesh.json').read_text('utf-8'))
    body=Image.open(HERE/'Parts/body-open.png').convert('RGBA')
    closed=Image.open(HERE/'Parts/body-closed.png').convert('RGBA')
    leaf=Image.open(HERE/'Parts/leaf.png').convert('RGBA')
    frames=[]
    for record in records:
        i=record['frame']
        root=np.asarray(record['bodyMatrix'],float)
        angles=record['leafAngles']
        m1=root@rot((330,145),angles[0])
        m2=m1@rot((368,148),angles[1])
        m3=m2@rot((407,167),angles[2])
        frame=affine(closed if record['timeMs']>=300 else body,root)
        if i==0:
            frame.alpha_composite(leaf)
        else:
            moving,posed=mesh_render(leaf,mesh,[root,m1,m2,m3])
            frame.alpha_composite(moving)
        if record['timeMs']>=1360 and frames:
            frame=frames[-1].copy()
        frames.append(frame)
        frame.save(HERE/'Frames'/('frame-'+str(i).zfill(3)+'.png'))
    atlas=Image.new('RGBA',(2048,512*math.ceil(len(frames)/4)),(0,0,0,0))
    for i,frame in enumerate(frames):
        atlas.alpha_composite(frame,(i%4*512,i//4*512))
    (HERE/'death.webp').write_bytes(_webp.WebPEncode(atlas.getim(),True,100.0,100.0,'',4,1,b'',''))
    encode(HERE/'preview.webp',frames,metadata['durationsMs'])
    encode(HERE/'thumbnail.webp',[f.resize((64,64),Image.Resampling.LANCZOS) for f in frames],metadata['durationsMs'])
    contact=Image.new('RGB',(1024,536),(35,42,37))
    draw=ImageDraw.Draw(contact)
    for i,index in enumerate([0,6,12,18,22,26,31,len(frames)-1]):
        cel=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        x,y=i%4*256,i//4*268
        contact.paste(cel,(x,y),cel)
        draw.text((x+8,y+254),str(index),(240,240,230))
    contact.save(HERE/'contact.jpg')
    frames[0].save(HERE/'neutral-reassembled.png')
    print(json.dumps({'name':HERE.name,'frames':len(frames),'durationMs':sum(metadata['durationsMs'])}))

if __name__=='__main__':
    main()
