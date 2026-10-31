from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import math,json,hashlib
FOLDER=Path(__file__).resolve().parent
SIZE=512

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def ease(value):
    x=max(0,min(1,value))
    return x*x*(3-2*x)

def matrix(pivot,angle,translation):
    theta=math.radians(angle);c,s=math.cos(theta),math.sin(theta)
    out=np.array([[c,-s,0],[s,c,0],[0,0,1]],float)
    out[:2,2]=np.asarray(pivot)+np.asarray(translation)-out[:2,:2]@np.asarray(pivot)
    return out

def posed(image,transform):
    inverse=np.linalg.inv(transform)
    return image.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse[:2].reshape(-1)),Image.Resampling.BICUBIC).convert('RGBA')

def ribbon(points,radii):
    tang=np.gradient(points,axis=0);normal=np.column_stack((-tang[:,1],tang[:,0]));normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],.01)
    return np.stack((points+normal*radii[:,None],points-normal*radii[:,None]),1)

def sample(texture,uv):
    h,w=texture.shape[:2];x=np.clip(uv[0],0,w-1.001);y=np.clip(uv[1],0,h-1.001);ix=x.astype(int);iy=y.astype(int);u=(x-ix)[:,None];v=(y-iy)[:,None]
    return (texture[iy,ix]*(1-u)+texture[iy,ix+1]*u)*(1-v)+(texture[iy+1,ix]*(1-u)+texture[iy+1,ix+1]*u)*v

def mesh(texture,source,destination):
    canvas=np.zeros((512,512,4),np.float32);src=source.reshape(-1,2);dst=destination.reshape(-1,2)
    for i in range(len(source)-1):
        for ids in [[2*i,2*i+1,2*i+2],[2*i+1,2*i+3,2*i+2]]:
            a=src[ids];b=dst[ids];lo=np.maximum(np.floor(b.min(0)).astype(int)-1,0);hi=np.minimum(np.ceil(b.max(0)).astype(int)+1,511)
            if np.any(hi<lo):continue
            x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));system=np.vstack((b.T,np.ones(3)))
            if abs(np.linalg.det(system))<.0001:continue
            bc=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)]);inside=np.all(bc>=-.00001,0)
            if not np.any(inside):continue
            pix=sample(texture,a.T@bc[:,inside]);canvas[y.ravel()[inside],x.ravel()[inside]]=pix
    alpha=canvas[:,:,3:4];canvas[:,:,:3]=canvas[:,:,:3]*255/np.maximum(alpha,.00001);canvas[canvas[:,:,3]==0]=0
    return Image.fromarray(np.uint8(np.clip(canvas,0,255)+.5))

def moving_body(rig,time,drop):
    weakness=ease((time-120)/440)
    angle=-10*weakness
    descent=drop*ease((time-180)/380)
    if 560<time<740:
        descent-=2*math.sin((time-560)/180*math.pi)
    return matrix(rig['bodyPivot'],angle,[0,descent])

def contact_curve(points,lengths):
    points=np.array(points,float);q=np.vstack((points[0],points,points[-1]));dense=[]
    for i in range(len(points)-1):
        a,b,c,d=q[i:i+4]
        for u in np.linspace(0,1,30,False):dense.append(.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u))
    dense=np.vstack((dense,points[-1]));distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(dense,axis=0),axis=1))];wanted=np.r_[0,np.cumsum(lengths)]
    return np.column_stack((np.interp(wanted,distance,dense[:,0]),np.interp(wanted,distance,dense[:,1])))

def simulate(rest,radii,times,rig,drop):
    positions=rest.copy();previous=positions.copy();lengths=np.linalg.norm(np.diff(rest,axis=0),axis=1);saved=[];errors=[];clock=0;control=rig['tendrilContactCurves']['main' if len(rest)==len(rig['mainCenterline']) else 'side'];target_relative=contact_curve(control,lengths)
    for time in times:
        while clock<time:
            clock+=10;amount=ease((clock-100)/140);root=(moving_body(rig,clock,drop)@np.array([rest[0,0],rest[0,1],1]))[:2];velocity=(positions-previous)*.89;previous=positions.copy();positions+=velocity+np.array([0,.85])*amount
            for iteration in range(70):
                positions[0]=root
                if iteration<58:
                    guide=ease((clock-200)/480)
                    positions[1:]+=.035*guide*(target_relative[1:]+root-positions[1:])
                if iteration<58:
                    positions[1:-1]+=.06*((positions[:-2]+positions[2:])*.5-positions[1:-1])
                for j,length in enumerate(lengths):
                    delta=positions[j+1]-positions[j];distance=max(np.linalg.norm(delta),.0001);correction=delta*((distance-length)/distance)
                    if j==0:positions[j+1]-=correction
                    else:positions[j]+=.5*correction;positions[j+1]-=.5*correction
                positions[:,0]=np.clip(positions[:,0],24+radii,488-radii);positions[:,1]=np.minimum(positions[:,1],448-radii)
            previous[0]=root
        saved.append(positions.copy());errors.append(float(np.max(np.abs(np.linalg.norm(np.diff(positions,axis=0),axis=1)-lengths))))
    return saved,errors,lengths

def surface_mesh(image,control,body,amount):
    pixels=np.asarray(image).astype(float);pixels[:,:,:3]*=pixels[:,:,3:4]/255
    active=np.argwhere(pixels[:,:,3]>24);lo=active.min(0)[::-1]-2;hi=active.max(0)[::-1]+2;xs=np.linspace(lo[0],hi[0],14);ys=np.linspace(lo[1],hi[1],14);xx,yy=np.meshgrid(xs,ys);source=np.column_stack((xx.ravel(),yy.ravel()));root=np.array(control['root']);tip=np.array(control['tip']);axis=(tip-root).astype(float);distance=np.linalg.norm(axis);axis/=distance;mid=root+(tip-root)*.5;first=matrix(root,control['rootAngle']*amount,[0,0]);second=first@matrix(mid,control['bendAngle']*amount,[0,0]);p=np.column_stack((source,np.ones(len(source))));weight=np.clip(((source-root)@axis/distance-.25)/.5,0,1);weight=weight*weight*(3-2*weight);dest=(p@first.T)[:,:2]*(1-weight[:,None])+(p@second.T)[:,:2]*weight[:,None];dest=np.column_stack((dest,np.ones(len(dest))))@body.T
    canvas=np.zeros((512,512,4),float)
    for row in range(13):
        for col in range(13):
            i=row*14+col
            for ids in [[i,i+1,i+14],[i+1,i+15,i+14]]:
                a=source[ids];b=dest[ids,:2];low=np.maximum(np.floor(b.min(0)).astype(int)-1,0);high=np.minimum(np.ceil(b.max(0)).astype(int)+1,511)
                if np.any(high<low):continue
                x,y=np.meshgrid(np.arange(low[0],high[0]+1),np.arange(low[1],high[1]+1));system=np.vstack((b.T,np.ones(3)))
                if abs(np.linalg.det(system))<.00001:continue
                bc=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)]);inside=np.all(bc>=-.00001,0)
                if not np.any(inside):continue
                canvas[y.ravel()[inside],x.ravel()[inside]]=sample(pixels,a.T@bc[:,inside])
    alpha=canvas[:,:,3:4];canvas[:,:,:3]=canvas[:,:,:3]*255/np.maximum(alpha,.00001);canvas[canvas[:,:,3]==0]=0
    return Image.fromarray(np.uint8(np.clip(canvas,0,255)+.5))

def tube(texture,points,radii):
    lengths=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))];total=lengths[-1];count=max(2,int(total/1.8));distance=np.linspace(0,total,count);x=np.interp(distance,lengths,points[:,0]);y=np.interp(distance,lengths,points[:,1]);rr=np.interp(distance,lengths,radii);tangent=np.column_stack((np.gradient(x),np.gradient(y)));tangent/=np.maximum(np.linalg.norm(tangent,axis=1)[:,None],.0001);normal=np.column_stack((-tangent[:,1],tangent[:,0]));canvas=np.zeros((512,512,4),float)
    for i in range(count):
        radius=max(.7,rr[i]);lo=np.maximum(np.floor([x[i]-radius-1,y[i]-radius-1]).astype(int),0);hi=np.minimum(np.ceil([x[i]+radius+1,y[i]+radius+1]).astype(int),511)
        if np.any(hi<lo):continue
        xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));dx=xx-x[i];dy=yy-y[i];across=(dx*normal[i,0]+dy*normal[i,1])/radius;along=dx*tangent[i,0]+dy*tangent[i,1];u=np.clip((across+1)*31.5,0,63);v=np.clip((distance[i]+along)/total*511,0,511);pix=sample(texture,np.array([u.ravel(),v.ravel()])).reshape(xx.shape+(4,));coverage=np.clip(radius+.6-np.sqrt(dx*dx+dy*dy),0,1);pix*=coverage[:,:,None];old=canvas[lo[1]:hi[1]+1,lo[0]:hi[0]+1];alpha=pix[:,:,3:4]/255;canvas[lo[1]:hi[1]+1,lo[0]:hi[0]+1]=pix+old*(1-alpha)
    alpha=canvas[:,:,3:4];canvas[:,:,:3]=canvas[:,:,:3]*255/np.maximum(alpha,.00001);canvas[canvas[:,:,3]==0]=0
    return Image.fromarray(np.uint8(np.clip(canvas,0,255)+.5))

def main():
    rig=json.loads((FOLDER/'rig.json').read_bytes());times=rig['timesMs'];parts={p['name']:Image.open(FOLDER/p['image']).convert('RGBA') for p in rig['parts']};closed=Image.open(FOLDER/'Parts/bulb-closed.png').convert('RGBA');node=Image.open(FOLDER/'Parts/crown-knot.png').convert('RGBA');body=parts['bulb'];at_contact=posed(body,matrix(rig['bodyPivot'],-10,[0,0]));drop=448-int(np.argwhere(np.asarray(at_contact)[:,:,3]>=64)[:,0].max());main=np.array(rig['mainCenterline']);side=np.array(rig['sideCenterline']);mr=np.array(rig['mainRadius']);sr=np.array(rig['sideRadius']);main_frames,me,ml=simulate(main,mr,times,rig,drop);side_frames,se,sl=simulate(side,sr,times,rig,drop);strip=np.asarray(Image.open(FOLDER/'Source/main-tendril-clean.png').convert('RGBA')).astype(float);strip[:,:,:3]*=strip[:,:,3:4]/255;reference=Image.open(FOLDER/'Source/neutral.png').convert('RGBA');original=np.asarray(reference).astype(float);original[:,:,:3]*=original[:,:,3:4]/255;uv=np.zeros((len(main),2,2));uv[:,1,0]=63;uv[:,:,1]=np.linspace(0,511,len(main))[:,None];sideuv=ribbon(side,sr);frames=[];states=[]
    for index,time in enumerate(times):
        body_matrix=moving_body(rig,time,drop);frame=Image.new('RGBA',(512,512));frame.alpha_composite(tube(strip,main_frames[index],mr));frame.alpha_composite(tube(strip,side_frames[index],sr));weakness=ease((time-120)/430)
        for offset,pivot,angle in [([0,0],[195,418],-55),([55,9],[250,427],15),([104,-4],[299,414],45)]:
            initial=matrix([0,0],0,offset);local=matrix(pivot,angle*weakness,[0,-20*weakness]);frame.alpha_composite(posed(parts['foot'],body_matrix@local@initial))
        for name in ['leaf-upper-left','leaf-upper-right']:
            control=next(p for p in rig['leafControls'] if p['name']==name);frame.alpha_composite(surface_mesh(parts[name],control,body_matrix,ease((time-control['startMs'])/550)))
        frame.alpha_composite(posed(closed if time>=125 else body,body_matrix))
        for name in ['leaf-lower-left','leaf-lower-right']:
            control=next(p for p in rig['leafControls'] if p['name']==name);frame.alpha_composite(surface_mesh(parts[name],control,body_matrix,ease((time-control['startMs'])/550)))
        frame.alpha_composite(posed(node,body_matrix));frames.append(frame);states.append({'timeMs':time,'bodyMatrix':body_matrix.tolist(),'bodyScale':[1,1],'mainCenterline':main_frames[index].tolist(),'sideCenterline':side_frames[index].tolist()})
    columns=6;durations=[25]*(len(frames)-1)+[900];sheet=Image.new('RGBA',(512*columns,512*math.ceil(len(frames)/columns)))
    for i,frame in enumerate(frames):sheet.paste(frame,(i%columns*512,i//columns*512))
    sheet.save(FOLDER/'death.webp','WEBP',**{'lossless':True,'method':4});opts={'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4};frames[0].save(FOLDER/'preview.webp','WEBP',**opts);small=[im.resize((64,64),Image.Resampling.LANCZOS) for im in frames];small[0].save(FOLDER/'thumbnail.webp','WEBP',**{**opts,'append_images':small[1:]});contact=Image.new('RGB',(1024,560),'#27352f');pen=ImageDraw.Draw(contact)
    for cell,i in enumerate([0,6,12,17,22,27,34,len(frames)-1]):
        image=frames[i].resize((256,256),Image.Resampling.LANCZOS);x,y=cell%4*256,cell//4*280;contact.paste(image,(x,y),image);pen.text((x+8,y+257),str(times[i])+' ms','#e6eedc')
    contact.save(FOLDER/'contact.png');frames[-1].save(FOLDER/'final.png');Image.blend(reference,frames[0],.5).save(FOLDER/'source-overlay.png');save_json(FOLDER/'poses.json',states);save_json(FOLDER/'identity-check.json',{'bulbSource':hashlib.sha256((FOLDER/'Parts/bulb.png').read_bytes()).hexdigest(),'bulbScale':[1,1],'finalRootDrop':drop,'mainSegmentLengths':ml.tolist(),'sideSegmentLengths':sl.tolist(),'maxSegmentErrorPx':max(me+se),'groundY':448});prefix='DesignAssets/Animations/CreatureDeathV3/snare-vine/';save_json(FOLDER/'death.json',{'name':'snare-vine','action':'death','sourceImage':rig['sourceImage'],'sourceAnimation':rig['sourceAnimation'],'image':prefix+'death.webp','frameSize':512,'columns':columns,'frameCount':len(frames),'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','previewLoop':0,'rig':prefix+'rig.json','renderer':prefix+'render.py','sourceAuthoring':prefix+'Source/authoring.json','prepare':prefix+'Source/prepare.py','sourcePlacement':{'referenceNormalization':json.loads((FOLDER/'Source/authoring.json').read_bytes())['referencePlacement'],'canvas':[512,512],'scale':[1,1],'groundY':448},'method':rig['method']});print(json.dumps({'frames':len(frames),'rootDrop':drop,'lengthError':max(me+se),'finalBounds':frames[-1].getbbox()}))

if __name__=='__main__':
    main()
