from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import numpy as np
import math,json,sys

FOLDER=Path(__file__).resolve().parent
SIZE=512


def save_json(path,data):
    path.write_bytes((json.dumps(data,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))


def ease(v):
    x=max(0,min(1,v))
    return x*x*(3-2*x)


def progress(time,delay):
    return ease((time-delay)/900)


def transform(pivot,degrees,translation,scale):
    theta=math.radians(degrees)
    c,s=math.cos(theta),math.sin(theta)
    m=np.array([[c*scale[0],-s*scale[1],0],[s*scale[0],c*scale[1],0],[0,0,1]],np.float64)
    m[:2,2]=np.array(pivot)+np.array(translation)-m[:2,:2]@np.array(pivot)
    return m


def pose_image(image,matrix):
    if np.max(np.abs(matrix-np.eye(3)))<1e-9:
        return image.copy()
    inverse=np.linalg.inv(matrix)
    coefficients=tuple(inverse[:2].reshape(-1))
    return image.convert('RGBa').transform((SIZE,SIZE),Image.Transform.AFFINE,coefficients,Image.Resampling.BICUBIC).convert('RGBA')


def point(matrix,position):
    return (matrix@np.array([position[0],position[1],1]))[:2]


def segment_matrix(start,end,target_start,target_end):
    before=math.atan2(end[1]-start[1],end[0]-start[0])
    after=math.atan2(target_end[1]-target_start[1],target_end[0]-target_start[0])
    return transform(start,math.degrees(after-before),np.array(target_start)-np.array(start),[1,1])


def ik_matrices(chain,body,amount):
    shoulder=np.array(chain['shoulder'],float)
    knee=np.array(chain['knee'],float)
    foot=np.array(chain['foot'],float)
    start=point(body,shoulder)
    target=foot+np.array(chain['slide'])*amount+np.array([0,chain.get('contactOffset',0)])
    l1=np.linalg.norm(knee-shoulder)
    l2=np.linalg.norm(foot-knee)
    vector=target-start
    distance=np.linalg.norm(vector)
    if distance>l1+l2-.001:
        target=start+vector*(l1+l2-.001)/distance
        vector=target-start
        distance=l1+l2-.001
    distance=max(distance,abs(l1-l2)+.001)
    base=math.atan2(vector[1],vector[0])
    cosine=np.clip((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1)
    v1,v2=knee-shoulder,foot-knee
    side=v1[0]*v2[1]-v1[1]*v2[0]
    direction=-1 if side>=0 else 1
    angle=base+direction*math.acos(float(cosine))
    mid=start+l1*np.array([math.cos(angle),math.sin(angle)])
    upper=segment_matrix(shoulder,knee,start,mid)
    lower=segment_matrix(knee,foot,mid,target)
    error=max(abs(np.linalg.norm(mid-start)-l1),abs(np.linalg.norm(target-mid)-l2))
    return upper,lower,float(error),[start.tolist(),mid.tolist(),target.tolist()]


def controls(rig,time):
    amount=progress(time,180)
    body=transform(rig['bodyPivot'],rig['bodyAngle']*amount,[0,rig['bodyDrop']*amount],[1,1])
    matrices={'body':body}
    ik_errors=[]
    ik_joints=[]
    for chain in rig['ik']:
        chain['contactOffset']=0
        for contact_step in range(18):
            upper,lower,error,joints=ik_matrices(chain,body,amount)
            hull=np.asarray(chain['contactHull'])
            posed=hull@lower.T
            excess=float(posed[:,1].max())-rig['groundY']
            if abs(excess)<.1:
                break
            chain['contactOffset']-=excess*.7
        matrices[chain['upper']]=upper
        matrices[chain['lower']]=lower
        ik_errors.append(error)
        ik_joints.append(joints)
    for part in rig['parts']:
        name=part['name']
        if part['parent']=='ik':
            continue
        p=progress(time,part['delayMs'])
        local=transform(part['pivot'],part['angle']*p,np.array(part['translation'])*p,[1+(part['scale'][0]-1)*p,1+(part['scale'][1]-1)*p])
        matrices[name]=matrices[part['parent']]@local
    return matrices,ik_errors,ik_joints


def sample_pixels(array,x,y):
    xx=np.clip(x,0,510.999)
    yy=np.clip(y,0,510.999)
    ix,iy=xx.astype(np.int32),yy.astype(np.int32)
    u,v=(xx-ix)[...,None],(yy-iy)[...,None]
    return (array[iy,ix]*(1-u)+array[iy,ix+1]*u)*(1-v)+(array[iy+1,ix]*(1-u)+array[iy+1,ix+1]*u)*v


def skin_limb(image,chain,upper,lower):
    yy,xx=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)
    points=np.stack((xx,yy,np.ones_like(xx)),2)
    knee=np.array(chain['knee'])
    direction=np.array(chain['foot'])-knee
    direction=direction/np.linalg.norm(direction)
    projected=(xx-knee[0])*direction[0]+(yy-knee[1])*direction[1]
    radius=chain['jointBlendRadius']
    amount=np.clip((projected+radius)/(2*radius),0,1)
    amount=amount*amount*(3-2*amount)
    posed_upper=points@upper.T
    posed_lower=points@lower.T
    destination=posed_upper[:,:,:2]*(1-amount[:,:,None])+posed_lower[:,:,:2]*amount[:,:,None]
    displacement=(destination-points[:,:,:2]).astype(np.float32)
    sx,sy=xx.copy(),yy.copy()
    for iteration in range(10):
        offset=sample_pixels(displacement,sx,sy)
        sx=.3*sx+.7*(xx-offset[:,:,0])
        sy=.3*sy+.7*(yy-offset[:,:,1])
    texture=np.asarray(image).astype(np.float32)
    texture[:,:,:3]*=texture[:,:,3:4]/255
    pixels=sample_pixels(texture,sx,sy)
    alpha=pixels[:,:,3:4]
    pixels[:,:,:3]=pixels[:,:,:3]*255/np.maximum(alpha,.00001)
    pixels=np.uint8(np.clip(pixels,0,255)+.5)
    outside=(sx<0)|(sx>=SIZE)|(sy<0)|(sy>=SIZE)
    pixels[outside]=0
    pixels[pixels[:,:,3]==0]=0
    return Image.fromarray(pixels)


def main():
    rig=json.loads((FOLDER/'rig.json').read_bytes())
    neutral=Image.open(FOLDER/'Source/neutral.png').convert('RGBA')
    source=np.asarray(neutral)
    images={'body':Image.open(FOLDER/rig['bodyImage']).convert('RGBA')}
    parts={part['name']:part for part in rig['parts']}
    for part in rig['parts']:
        images[part['name']]=Image.open(FOLDER/part['visibleSource']).convert('RGBA')
    for chain in rig['ik']:
        skin=np.asarray(images[chain['lower']])
        yy,xx=np.where(skin[:,:,3]>=64)
        chain['contactHull']=np.column_stack((xx,yy,np.ones(len(xx)))).tolist()
    continuous={chain['upper']:(chain,Image.open(FOLDER/chain['image']).convert('RGBA')) for chain in rig['continuousLimbs']}
    continuous_lower={chain['lower'] for chain in rig['continuousLimbs']}
    bridges={part['name']:Image.open(FOLDER/part['bridgeImage']).convert('RGBA') for part in rig['parts'] if 'bridgeImage' in part}
    closed=Image.open(FOLDER/'Source/CleanAttachments/head-closed.png').convert('RGBA')
    hidden={part['name']:Image.open(FOLDER/part['hiddenImage']).convert('RGBA') for part in rig['parts']}
    foreground=Image.open(FOLDER/rig['bodyForeground']).convert('RGBA')
    root_mask=Image.new('L',(SIZE,SIZE),0)
    root_draw=ImageDraw.Draw(root_mask)
    for occluder in rig['rootOccluders']:
        x,y=occluder['pivot'];radius=occluder['radius']
        root_draw.ellipse((x-radius,y-radius,x+radius,y+radius),255)
    root_cover=images['body'].copy()
    root_cover.putalpha(ImageChops.multiply(root_cover.getchannel('A'),root_mask))
    frames=[]
    states=[]
    indices=[0,8,14,20,26,30,34,len(rig['timesMs'])-1]
    times=rig['timesMs'] if '--keys' not in sys.argv else [rig['timesMs'][i] for i in indices]
    for time in times:
        matrices,errors,joints=controls(rig,time)
        frame=Image.new('RGBA',(SIZE,SIZE))
        for name,image in hidden.items():
            if False:
                frame.alpha_composite(pose_image(image,matrices[name]))
        for name in rig['order']:
            if name in continuous_lower:
                continue
            if name in continuous:
                chain,limb_image=continuous[name]
                frame.alpha_composite(skin_limb(limb_image,chain,matrices[chain['upper']],matrices[chain['lower']]))
                continue
            if name in bridges:
                frame.alpha_composite(pose_image(bridges[name],matrices[name]))
            image=closed if name=='head' and time>=250 else images[name]
            frame.alpha_composite(pose_image(image,matrices[name]))
        frame.alpha_composite(pose_image(root_cover,matrices['body']))
        body_front=pose_image(foreground,matrices['body'])
        body_front_for_identity = body_front
        pixels=np.asarray(frame).copy()
        fg=np.asarray(body_front)
        if False:
            pixels[source[:,:,3]>0]=source[source[:,:,3]>0]
            pixels[source[:,:,3]==0]=0
        pixels[pixels[:,:,3]==0]=0
        frame=Image.fromarray(pixels)
        frames.append(frame)
        determinants={name:float(np.linalg.det(matrix[:2,:2])) for name,matrix in matrices.items()}
        states.append({'timeMs':time,'matrices':{name:np.round(matrix,7).tolist() for name,matrix in matrices.items()},'rigidDeterminants':determinants,'maxJointLengthError':max(errors) if errors else 0,'joints':joints})
    contact=Image.new('RGB',(1024,560),'#27352f')
    draw=ImageDraw.Draw(contact)
    selected=frames if '--keys' in sys.argv else [frames[i] for i in indices]
    selected_times=times if '--keys' in sys.argv else [times[i] for i in indices]
    for cell,(image,time) in enumerate(zip(selected,selected_times)):
        small=image.resize((256,256),Image.Resampling.LANCZOS)
        x,y=cell%4*256,cell//4*280
        contact.paste(small,(x,y),small)
        draw.text((x+8,y+257),str(time)+' ms','#e6eedc')
    contact.save(FOLDER/('keys.png' if '--keys' in sys.argv else 'contact.png'))
    if '--keys' in sys.argv:
        frames[-1].save(FOLDER/'key-last.png')
        print(json.dumps({'name':rig['name'],'keys':len(frames),'maxIKError':max(state['maxJointLengthError'] for state in states),'sourceGround':int(np.argwhere(source[:,:,3]>=64)[:,0].max()),'finalGround':int(np.argwhere(np.asarray(frames[-1])[:,:,3]>=64)[:,0].max())}))
        return
    columns=rig['columns']
    sheet=Image.new('RGBA',(SIZE*columns,SIZE*math.ceil(len(frames)/columns)))
    for i,frame in enumerate(frames):
        sheet.paste(frame,(i%columns*SIZE,i//columns*SIZE))
    sheet.save(FOLDER/'death.webp','WEBP',**{'lossless':True,'method':4})
    durations=rig['durationsMs']
    options={'save_all':True,'append_images':frames[1:],'duration':durations,'loop':0,'lossless':True,'method':4}
    frames[0].save(FOLDER/'preview.webp','WEBP',**options)
    small=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames]
    small[0].save(FOLDER/'thumbnail.webp','WEBP',**{**options,'append_images':small[1:]})
    Image.blend(neutral,frames[0],.5).save(FOLDER/'source-overlay.png')
    active=(source[:,:,3]>0)|(np.asarray(frames[0])[:,:,3]>0)
    difference=np.abs(source.astype(np.int16)-np.asarray(frames[0]).astype(np.int16))
    rigid_errors=[]
    for state in states:
        for name,matrix in state['matrices'].items():
            if name=='sac':
                continue
            linear=np.array(matrix)[:2,:2]
            rigid_errors.append(float(np.max(np.abs(linear.T@linear-np.eye(2)))))
    identity={'neutralVisibleMaxChannelDifference':int(difference[active].max()),'neutralVisibleChangedPixels':int(np.any(difference,2)[active].sum()),'maxRigidOrthogonalityError':max(rigid_errors),'maxIKSegmentLengthError':max(state['maxJointLengthError'] for state in states),'sourcePartDimensions':{name:image.getbbox() for name,image in images.items()},'construction':'No frame-dependent registration, dimensions or source drawings. Unit-scale rigid transforms per attachment; only declared sac may contract.'}
    save_json(FOLDER/'identity-check.json',identity)
    save_json(FOLDER/'poses.json',states)
    prefix='DesignAssets/Animations/CreatureDeathV2/'+rig['name']+'/'
    metadata={'name':rig['name'],'action':'death','sourceImage':rig['sourceImage'],'sourceAnimation':rig['sourceAnimation'],'image':prefix+'death.webp','frameSize':SIZE,'columns':columns,'frameCount':len(frames),'pivotX':rig['pivotX'],'pivotY':rig['pivotY'],'durationsMs':durations,'durationMs':sum(durations),'loop':False,'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','rig':prefix+'rig.json','renderer':prefix+'render.py','contact':prefix+'contact.png','sourceOverlay':prefix+'source-overlay.png','identityCheck':prefix+'identity-check.json','method':rig['method'],'spineCompatibilityVerified':False}
    save_json(FOLDER/'death.json',metadata)
    print(json.dumps({'name':rig['name'],'frames':len(frames),'identity':identity,'finalBounds':frames[-1].getbbox()}))


if __name__=='__main__':
    main()
