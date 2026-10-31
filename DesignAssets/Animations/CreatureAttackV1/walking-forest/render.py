from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,_webp
import numpy as np
import math,json,sys
folder=Path(__file__).resolve().parent
root=folder.parents[3]
size=512
yy,xx=np.mgrid[:size,:size].astype(np.float32)

def write_json(path,data):
    encoder=json.JSONEncoder()
    encoder.indent=2
    encoder.ensure_ascii=False
    path.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    v=np.clip(value,0,1)
    return v*v*(3-2*v)

def track(keys,time):
    for a,b in zip(keys,keys[1:]):
        if time<=b[0]:
            u=float(ease((time-a[0])/(b[0]-a[0])))
            return [x+(y-x)*u for x,y in zip(a[1],b[1])]
    return keys[-1][1]

def sample(data,x,y):
    h,w=data.shape[:2]
    inside=(x>=0)&(x<=w-1)&(y>=0)&(y<=h-1)
    xc=np.clip(x,0,w-1.001)
    yc=np.clip(y,0,h-1.001)
    xi,yi=xc.astype(np.int32),yc.astype(np.int32)
    u,v=xc-xi,yc-yi
    if data.ndim==3:
        u,v,inside=u[:,:,None],v[:,:,None],inside[:,:,None]
    return ((data[yi,xi]*(1-u)+data[yi,xi+1]*u)*(1-v)+(data[yi+1,xi]*(1-u)+data[yi+1,xi+1]*u)*v)*inside

def rotation(pivot,control):
    angle,dx,dy=control
    rad=math.radians(angle)
    c,s=math.cos(rad),math.sin(rad)
    px,py=pivot
    return np.array([[c,-s,px-c*px+s*py+dx],[s,c,py-s*px-c*py+dy],[0,0,1]],np.float32)

def render(neutral,bones,weights,time):
    transforms={'root':np.eye(3,3,0,np.float32)}
    controls=[]
    grid=np.arange(0,513,8)
    gy,gx=np.mgrid[:513:8,:513:8]
    vx,vy=gx.astype(float),gy.astype(float)
    dx,dy=np.zeros(vx.shape),np.zeros(vy.shape)
    for bone,weight in zip(bones,weights):
        control=track(bone['keys'],time)
        controls.append(control)
        transform=transforms[bone['parent']]@rotation(bone['pivot'],control)
        transforms[bone['name']]=transform
        field=weight[np.minimum(gy,511),np.minimum(gx,511)]
        dx+=((transform[0,0]-1)*vx+transform[0,1]*vy+transform[0,2])*field
        dy+=(transform[1,0]*vx+(transform[1,1]-1)*vy+transform[1,2])*field
    if all(sum(abs(v) for v in control)<.00001 for control in controls):
        return neutral.copy()
    dest=np.stack((vx+dx,vy+dy),2).reshape((-1,2))
    source=np.stack((vx,vy),2).reshape((-1,2))
    texture=np.asarray(neutral).astype(np.float32)/255
    texture[:,:,:3]*=texture[:,:,3:4]
    canvas=np.zeros((512,512,4),np.float32)
    for row in range(64):
        for col in range(64):
            if not np.any(texture[row*8:min(row*8+10,512),col*8:min(col*8+10,512),3]):
                continue
            a=row*65+col
            for indices in [[a,a+1,a+65],[a+1,a+66,a+65]]:
                triangle=dest[indices]
                original=source[indices]
                x0=max(0,int(math.floor(triangle[:,0].min())))
                y0=max(0,int(math.floor(triangle[:,1].min())))
                x1=min(512,int(math.ceil(triangle[:,0].max()))+1)
                y1=min(512,int(math.ceil(triangle[:,1].max()))+1)
                if x1<=x0 or y1<=y0:
                    continue
                py,px=np.mgrid[y0:y1,x0:x1]
                p0,p1,p2=triangle
                det=(p1[1]-p2[1])*(p0[0]-p2[0])+(p2[0]-p1[0])*(p0[1]-p2[1])
                if abs(det)<.00001:
                    continue
                u=((p1[1]-p2[1])*(px-p2[0])+(p2[0]-p1[0])*(py-p2[1]))/det
                v=((p2[1]-p0[1])*(px-p2[0])+(p0[0]-p2[0])*(py-p2[1]))/det
                w=1-u-v
                inside=(u>=-.000001)&(v>=-.000001)&(w>=-.000001)
                sx=u*original[0,0]+v*original[1,0]+w*original[2,0]
                sy=u*original[0,1]+v*original[1,1]+w*original[2,1]
                pixels=sample(texture,sx,sy)*inside[:,:,None]
                tile=canvas[y0:y1,x0:x1]
                canvas[y0:y1,x0:x1]=pixels+tile*(1-pixels[:,:,3:4])
    canvas[:,:,:3]/=np.maximum(canvas[:,:,3:4],1/255)
    result=np.uint8(np.clip(canvas*255+.5,0,255))
    result[result[:,:,3]==0]=0
    return Image.fromarray(result)

def webp(path,picture):
    path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,frames,durations):
    enc=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        enc.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    enc.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(enc.assemble('','',''))

def main():
    rig=json.loads((folder/'rig.json').read_text('utf-8'))
    neutral=Image.open(folder/rig['source']).convert('RGBA')
    weights=[np.asarray(Image.open(folder/bone['weight']).convert('L')).astype(np.float32)/255 for bone in rig['bones']]
    frames=[render(neutral,rig['bones'],weights,time) for time in rig['sampleTimesMs']]
    columns=4
    atlas=Image.new('RGBA',(size*columns,size*math.ceil(len(frames)/columns)),(0,0,0,0))
    for i,frame in enumerate(frames):
        atlas.paste(frame,(i%columns*size,i//columns*size))
    webp(folder/'attack.webp',atlas)
    animate(folder/'attack-preview.webp',frames,rig['durationsMs'])
    animate(folder/'attack-thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],rig['durationsMs'])
    thumbnail=root/'DesignAssets/Planning/UnitPreviews'/rig['species']/'attack.webp'
    thumbnail.parent.mkdir(511,True,True)
    thumbnail.write_bytes((folder/'attack-thumbnail.webp').read_bytes())
    contact=Image.new('RGB',(1024,512),(35,42,40))
    samples=[0,round((len(frames)-1)*.2),round((len(frames)-1)*.32),rig['impactFrame'],round((len(frames)-1)*.5),round((len(frames)-1)*.65),round((len(frames)-1)*.83),len(frames)-1]
    for j,index in enumerate(samples):
        tile=Image.new('RGB',(256,256),(35,42,40))
        picture=frames[index].resize((256,256),Image.Resampling.LANCZOS)
        tile.paste(picture,(0,0),picture)
        ImageDraw.Draw(tile).text((6,5),str(index)+' / '+str(rig['sampleTimesMs'][index])+'ms',(235,235,235))
        contact.paste(tile,(j%4*256,j//4*256))
    contact.save(folder/'contact.png')
    bounds=neutral.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()
    metadata={'species':rig['species'],'action':'attack','description':rig['description'],'image':str((folder/'attack.webp').relative_to(root)).replace('\\','/'),'frameSize':size,'columns':columns,'frameCount':len(frames),'durationsMs':rig['durationsMs'],'durationMs':sum(rig['durationsMs']),'loop':False,'pivotX':rig['pivot'][0],'pivotY':rig['pivot'][1],'impactFrame':rig['impactFrame'],'impactMs':sum(rig['durationsMs'][:rig['impactFrame']]),'facing':'left','rootMotion':False,'preview':'attack-preview.webp','thumbnail':'attack-thumbnail.webp','rig':'rig.json','sourceBounds':list(bounds),'method':'Continuous original-texture mesh with local joint weights and planted contacts; no replacement drawings.'}
    write_json(folder/'attack.json',metadata)
    print(rig['species'],len(frames),sum(rig['durationsMs']),bounds)

if __name__=='__main__':
    main()
