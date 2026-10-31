from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw,_webp
p=Path(__file__).resolve().parent
r=json.loads((p/'rig.json').read_text('utf8'))
size=r['frameSize']
images={name:{i:Image.open(p/'Parts'/(name+'-'+str(i)+'.png')).convert('RGBA') for i in numbers} for name,numbers in r['partAttachments'].items()}

def sample(times, keys, time):
    values = np.array(keys, float)
    if time <= times[0]:
        return values[0].copy()
    if time >= times[-1]:
        return values[-1].copy()
    ts = np.array(times, float)
    spans = np.diff(ts)
    delta = np.diff(values, 1, 0) / spans[:, None, None]
    slopes = np.zeros_like(values)
    for i in range(1, len(ts) - 1):
        same = delta[i - 1] * delta[i] > 0
        w1 = 2 * spans[i] + spans[i - 1]
        w2 = spans[i] + 2 * spans[i - 1]
        denominator = w1 / np.where(same, delta[i - 1], 1) + w2 / np.where(same, delta[i], 1)
        slopes[i] = np.where(same, (w1 + w2) / np.where(np.abs(denominator) > 1e-12, denominator, 1), 0)
    index = int(np.searchsorted(ts, time) - 1)
    h = spans[index]
    t = (time - ts[index]) / h
    return (2*t**3-3*t**2+1)*values[index] + (t**3-2*t**2+t)*h*slopes[index] + (-2*t**3+3*t**2)*values[index+1] + (t**3-t**2)*h*slopes[index+1]


def warp(image,source,target):
 source=np.array(source,float);target=np.array(target,float)
 if np.max(np.abs(source-target))<.001:return image.copy()
 a=target/size;d=a[:,None]-a[None,:];rr=np.sum(d*d,2);kernel=rr*np.log(np.maximum(rr,1e-12))+np.eye(len(a))*1e-3
 affine=np.column_stack([np.ones(len(a)),a]);matrix=np.block([[kernel,affine],[affine.T,np.zeros((3,3))]])
 w=np.linalg.solve(matrix,np.vstack([source,np.zeros((3,2))]))
 edges=list(range(0,size,8))+[size];q=np.array([[x,y] for y in edges for x in edges],float)/size
 d=q[:,None]-a[None,:];rr=np.sum(d*d,2);uv=np.column_stack([rr*np.log(np.maximum(rr,1e-12)),np.ones(len(q)),q])@w;uv=uv.reshape(len(edges),len(edges),2)
 mesh=[]
 for y in range(len(edges)-1):
  for x in range(len(edges)-1):mesh.append(((edges[x],edges[y],edges[x+1],edges[y+1]),tuple(np.array([uv[y,x],uv[y+1,x],uv[y+1,x+1],uv[y,x+1]]).ravel())))
 return image.convert('RGBa').transform((size,size),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC).convert('RGBA')

def nearest(times,time):return int(np.argmin(np.abs(np.array(times)-time)))

def controls(name):return np.array(r[name+'Controls'],float)+32

contours=json.loads((p/'crown-contours.json').read_text('utf8'))
body=controls('body');feet=controls('feet');tail=controls('tail')
roots=np.array(r['crownRoots'],float);tips=np.array(r['crownTips'],float)
crown_contours=np.array(contours['crown'])
crown=np.concatenate([roots,tips],1)+32
head_centers=np.array(r['headCenters'])+32
head_angles=np.array([[[0,0]],[[-5,0]],[[-25,0]],[[-35,0]]],float)
closed=Image.open(p/'Parts'/'head-closed-0.png').convert('RGBA')
scalp=Image.open(p/'Parts'/'scalp.png').convert('RGBA')
head_times=[0,300,500,800]
tail_indices=[0,1,2,3,5,6]

def crown_surface(image,outline):
 mask=Image.new('L',(size*3,size*3));ImageDraw.Draw(mask).polygon([tuple(point*3) for point in outline],255);mask=np.array(mask.resize((size,size),Image.Resampling.LANCZOS))
 data=np.array(image);valid=data[:,:,3]>64;wanted=mask>0
 for _ in range(32):
  missing=wanted&~valid
  if not np.any(missing):break
  changed=False
  for dy,dx in [(0,1),(0,-1),(1,0),(-1,0),(1,1),(-1,1),(1,-1),(-1,-1)]:
   neighbor=np.roll(valid,(dy,dx),(0,1));take=missing&neighbor
   if np.any(take):
    data[take]=np.roll(data,(dy,dx),(0,1))[take];valid[take]=True;missing[take]=False;changed=True
  if not changed:break
 data[:,:,3]=mask;return Image.fromarray(data)

def frame(time):
 out=Image.new('RGBA',(size,size))
 ti=nearest(r['tailTimesMs'],time);out.alpha_composite(warp(images['tail'][tail_indices[ti]],tail[ti],sample(r['tailTimesMs'],tail,time)))
 absolute_angle=float(sample(head_times,head_angles,time)[0,0])*math.pi/180
 sc,ss=math.cos(absolute_angle),math.sin(absolute_angle);origin=head_centers[0];center=sample(head_times,head_centers[:,None,:],time)[0]
 sx=center[0]-sc*origin[0]+ss*origin[1];sy=center[1]-ss*origin[0]-sc*origin[1]
 out.alpha_composite(scalp.convert('RGBa').transform((size,size),Image.Transform.AFFINE,(sc,ss,-sc*sx-ss*sy,-ss,sc,ss*sx-sc*sy),Image.Resampling.BICUBIC).convert('RGBA'))
 bi=nearest(head_times,time)
 target=sample(head_times,body,time)
 out.alpha_composite(warp(images['feet'][bi],feet[bi],sample(head_times,feet,time)))
 out.alpha_composite(warp(images['body'][bi],body[bi],target))
 angle=float(sample(head_times,head_angles,time)[0,0]-head_angles[bi,0,0])*math.pi/180
 c,s=math.cos(angle),math.sin(angle);origin=head_centers[bi];center=sample(head_times,head_centers[:,None,:],time)[0]
 tx=center[0]-c*origin[0]+s*origin[1];ty=center[1]-s*origin[0]-c*origin[1]
 image=closed if bi==0 and time>=100 else images['head'][bi]
 out.alpha_composite(image.convert('RGBa').transform((size,size),Image.Transform.AFFINE,(c,s,-c*tx-s*ty,-s,c,s*tx-c*ty),Image.Resampling.BICUBIC).convert('RGBA'))
 ci=nearest(r['timesMs'],time)
 points=crown if time<=800 else crown_contours
 crown_target=sample(r['timesMs'],points,time)
 crown_layer=warp(images['crown'][ci],points[ci],crown_target)
 if 800<time<1500 and time not in r['timesMs']:crown_layer=crown_surface(crown_layer,crown_target)
 out.alpha_composite(crown_layer)
 return out

def encode(frames,durations,path):
 writer=_webp.WebPAnimEncoder((size,size),0,0,False,9,17,False,False);t=0
 for image,duration in zip(frames,durations):writer.add(image.getim(),t,True,100.,100.,4);t+=duration
 writer.add(None,t,True,100.,100.,0);path.write_bytes(writer.assemble('','',''))

if __name__=='__main__':
 times=[round(i*1000/30) for i in range(60)]
 durations=[b-a for a,b in zip(times,times[1:])]+[2000-times[-1]]
 frames=[]
 final=frame(1500)
 rendered=p/'RenderedFrames';rendered.mkdir(511,True,True)
 for i,time in enumerate(times):
  image=frame(time) if time<1500 else final.copy();frames.append(image);image.save(rendered/(str(i).zfill(3)+'.png'))
 sheet=Image.new('RGBA',(size*4,size*15))
 for i,image in enumerate(frames):sheet.alpha_composite(image,(i%4*size,i//4*size))
 output=p.parent
 (output/'death.webp').write_bytes(_webp.WebPEncode(sheet.getim(),True,100.,100.,'',4,1,b'',''))
 encode(frames,durations,output/'preview.webp')
 thumb=frames[0].resize((64,64),Image.Resampling.LANCZOS)
 (output/'thumbnail.webp').write_bytes(_webp.WebPEncode(thumb.getim(),True,100.,100.,'',4,1,b'',''))
 metadata={'name':'spring-keeper','action':'death','sourceImage':'DesignAssets/CreatureConcepts/v3/spring-keeper.png','image':'DesignAssets/Animations/CreatureDeathV8/spring-keeper/death.webp','frameSize':size,'columns':4,'frameCount':60,'durationsMs':durations,'durationMs':2000,'pivotX':288,'pivotY':480,'loop':False,'preview':'DesignAssets/Animations/CreatureDeathV8/spring-keeper/preview.webp','thumbnail':'DesignAssets/Animations/CreatureDeathV8/spring-keeper/thumbnail.webp','renderer':'DesignAssets/Animations/CreatureDeathV8/spring-keeper/Source/render.py','sourceAuthoring':'DesignAssets/Animations/CreatureDeathV8/spring-keeper/Source/rig.json','keyPoseTimesMs':r['timesMs'],'sourceFrames':['Source/RenderedFrames/'+str(i).zfill(3)+'.png' for i in range(60)]}
 (output/'death.json').write_bytes((json.dumps(metadata)+'\n').replace('\n','\r\n').encode('utf8'))
 print(json.dumps({'frameCount':60,'durationMs':sum(durations),'frameSize':size,'output':str(output)}))
