import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

folder=Path(__file__).resolve().parent
rig=json.loads((folder/'rig.json').read_text('utf-8'))
textures={name:Image.open(folder/entry['image']).convert('RGBA') for name,entry in rig['parts'].items()}


def smooth(value):
    value=min(1.0,max(0.0,value))
    return value*value*(3.0-2.0*value)


def mix(a,b,t):
    return a+(b-a)*t


def multiply(a,b):
    return [a[0]*b[0]+a[1]*b[3],a[0]*b[1]+a[1]*b[4],a[0]*b[2]+a[1]*b[5]+a[2],a[3]*b[0]+a[4]*b[3],a[3]*b[1]+a[4]*b[4],a[3]*b[2]+a[4]*b[5]+a[5]]


def point(matrix,p):
    return matrix[0]*p[0]+matrix[1]*p[1]+matrix[2],matrix[3]*p[0]+matrix[4]*p[1]+matrix[5]


def bone(position,angle,pivot):
    c=math.cos(angle);s=math.sin(angle)
    return [c,-s,position[0]-c*pivot[0]+s*pivot[1],s,c,position[1]-s*pivot[0]-c*pivot[1]]


def affine_image(texture,matrix):
    determinant=matrix[0]*matrix[4]-matrix[1]*matrix[3]
    inverse=[matrix[4]/determinant,-matrix[1]/determinant,0,-matrix[3]/determinant,matrix[0]/determinant,0]
    inverse[2]=-inverse[0]*matrix[2]-inverse[1]*matrix[5]
    inverse[5]=-inverse[3]*matrix[2]-inverse[4]*matrix[5]
    return texture.convert('RGBa').transform((512,512),Image.Transform.AFFINE,tuple(inverse),Image.Resampling.BICUBIC).convert('RGBA')


def axis_matrix(start,end,source_start,source_end,width_scale):
    ux=source_end[0]-source_start[0];uy=source_end[1]-source_start[1]
    length=math.hypot(ux,uy);ux/=length;uy/=length
    vx=end[0]-start[0];vy=end[1]-start[1]
    target_length=math.hypot(vx,vy);vx/=target_length;vy/=target_length
    along=target_length/length
    a=along*vx*ux+width_scale*vy*uy
    b=along*vx*uy-width_scale*vy*ux
    d=along*vy*ux-width_scale*vx*uy
    e=along*vy*uy+width_scale*vx*ux
    return [a,b,start[0]-a*source_start[0]-b*source_start[1],d,e,start[1]-d*source_start[0]-e*source_start[1]]


def ik(shoulder,paw,length1,length2):
    dx=paw[0]-shoulder[0];dy=paw[1]-shoulder[1]
    distance=min(length1+length2-0.01,max(abs(length1-length2)+0.01,math.hypot(dx,dy)))
    angle=math.atan2(dy,dx)-math.acos(min(1.0,max(-1.0,(length1*length1+distance*distance-length2*length2)/(2*length1*distance))))
    return shoulder[0]+length1*math.cos(angle),shoulder[1]+length1*math.sin(angle)


deformed_cache={}


def deform(texture,kind,progress):
    if progress<=0:return texture
    cache_key=(kind,round(progress,8))
    if cache_key in deformed_cache:return deformed_cache[cache_key]
    def displacement(x,y):
        if kind=='torso':
            weight=(1-smooth((x-235)/105))*smooth((438-y)/100)
            return -5*progress*weight,rig['chestDrop']*progress*weight
        weight=1-smooth((y-315)/100)
        return -12*progress,progress*(20+65*weight)
    step=8
    bounds=texture.getbbox()
    x0=max(0,(bounds[0]-32)//step*step);x1=min(512,((bounds[2]+23)//step)*step)
    y0=max(0,(bounds[1]-16)//step*step);y1=min(512,((bounds[3]+111)//step)*step)
    grid=[]
    for py in range(y0,y1+1,step):
        row=[]
        for px in range(x0,x1+1,step):
            sx=float(px)
            for iteration in range(5):
                lo,hi=-256.0,768.0
                for search in range(24):
                    sy=(lo+hi)*.5
                    _,dy=displacement(sx,sy)
                    if sy+dy<py:lo=sy
                    else:hi=sy
                sy=(lo+hi)*.5
                dx,_=displacement(sx,sy)
                sx=px-dx
            row.append((sx,sy))
        grid.append(row)
    cells=[]
    for row in range((y1-y0)//step):
        for column in range((x1-x0)//step):
            corners=[grid[row][column],grid[row+1][column],grid[row+1][column+1],grid[row][column+1]]
            cells.append(((x0+column*step,y0+row*step,x0+(column+1)*step,y0+(row+1)*step),tuple(v for p in corners for v in p)))
    result=texture.convert('RGBa').transform((512,512),Image.Transform.MESH,cells,Image.Resampling.BICUBIC).convert('RGBA')
    deformed_cache[cache_key]=result
    return result


def sample_track(t):
    if t<=0.2:
        return 0.0,rig['poses'][0]
    first,middle,last=rig['poses']
    if t<=0.6:
        a,b=first,middle;duration=.4;u=(t-.2)/duration;start_scale=0.0;end_scale=1.0
    else:
        a,b=middle,last;duration=.35;u=(min(t,.95)-.6)/duration;start_scale=1.0;end_scale=0.0
    def interpolate(x,y,initial,final):
        velocity=(final-initial)/.75
        return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*duration*velocity*start_scale+(-2*u**3+3*u*u)*y+(u**3-u*u)*duration*velocity*end_scale
    result={}
    for key in ['head','shoulder-near','shoulder-far']:
        result[key]=[interpolate(x,y,initial,final) for x,y,initial,final in zip(a[key],b[key],first[key],last[key])]
    result['headAngle']=interpolate(a['headAngle'],b['headAngle'],first['headAngle'],last['headAngle'])
    return smooth((min(t,.95)-.2)/.75),result

unlit_textures={name:Image.open(folder/path).convert('RGBA') for name,path in rig['earSettle']['unlitTextures'].items()}
lighting_cache={}


def light_texture(side,intensity):
    lit=textures['ear-'+side]
    if intensity>=1:return lit
    if intensity<=0:return unlit_textures[side]
    key=(side,round(intensity,8))
    if key not in lighting_cache:
        dark=unlit_textures[side]
        rgb=bytes(round(a+(b-a)*intensity) for a,b in zip(dark.convert('RGB').tobytes(),lit.convert('RGB').tobytes()))
        color=Image.frombytes('RGB',lit.size,rgb)
        lighting_cache[key]=Image.merge('RGBA',(*color.split(),lit.getchannel('A')))
    return lighting_cache[key]


def inverse_matrix(matrix):
    determinant=matrix[0]*matrix[4]-matrix[1]*matrix[3]
    a=matrix[4]/determinant;b=-matrix[1]/determinant;d=-matrix[3]/determinant;e=matrix[0]/determinant
    return [a,b,-a*matrix[2]-b*matrix[5],d,e,-d*matrix[2]-e*matrix[5]]


def ear_axis(entry):
    dx=entry['tip'][0]-entry['root'][0];dy=entry['tip'][1]-entry['root'][1]
    length=math.hypot(dx,dy)
    return dx/length,dy/length,length


def curved_point(p,entry,bend):
    if abs(bend)<1e-8:return p
    ex,ey,length=ear_axis(entry);root=entry['root']
    u=(p[0]-root[0])*ex+(p[1]-root[1])*ey
    v=-(p[0]-root[0])*ey+(p[1]-root[1])*ex
    radius=length/bend;theta=u/radius
    x=(radius-v)*math.sin(theta);y=radius-(radius-v)*math.cos(theta)
    return root[0]+ex*x-ey*y,root[1]+ey*x+ex*y


def curved_ear(texture,matrix,entry,bend):
    if abs(bend)<1e-8:return affine_image(texture,multiply(matrix,entry['bindMatrix']))
    inverse=inverse_matrix(matrix);bind_inverse=inverse_matrix(entry['bindMatrix'])
    ex,ey,length=ear_axis(entry);radius=length/bend;root=entry['root']
    step=rig['earSettle']['meshStepPixels'];grid=[]
    for y in range(0,513,step):
        row=[]
        for x in range(0,513,step):
            px,py=point(inverse,(x,y));px-=root[0];py-=root[1]
            along=px*ex+py*ey;across=-px*ey+py*ex
            theta=math.atan2(along/radius,1-across/radius)
            u=radius*theta;v=radius*(1-math.hypot(along/radius,1-across/radius))
            p=(root[0]+ex*u-ey*v,root[1]+ey*u+ex*v)
            row.append(point(bind_inverse,p))
        grid.append(row)
    cells=[]
    for row in range(512//step):
        for column in range(512//step):
            corners=[grid[row][column],grid[row+1][column],grid[row+1][column+1],grid[row][column+1]]
            cells.append(((column*step,row*step,(column+1)*step,(row+1)*step),tuple(v for p in corners for v in p)))
    return texture.convert('RGBa').transform((512,512),Image.Transform.MESH,cells,Image.Resampling.BICUBIC).convert('RGBA')


bind_images={name:affine_image(texture,rig['parts'][name]['bindMatrix']) for name,texture in textures.items() if 'bindMatrix' in rig['parts'][name]}

def render(t):
    progress,pose=sample_track(t)
    if t>.95:
        pose['head'][1]+=rig['settle']['headDropPixels']*smooth((t-.95)/.15)
    head_matrix=bone(pose['head'],math.radians(pose['headAngle']),rig['headBindPivot'])
    layers={name:bind_images[name] for name in ['pelvis','tail','hind-far','paw-far','paw-near']}
    layers['torso']=deform(bind_images['torso'],'torso',progress)
    layers['ruff']=deform(bind_images['ruff'],'ruff',progress)
    for side in ['far','near']:
        limb=rig['limbs'][side];shoulder=pose['shoulder-'+side];paw=limb['paw']
        elbow=ik(shoulder,paw,*limb['lengths'])
        for part,start,end in [('upper',shoulder,elbow),('lower',elbow,paw)]:
            name='fore-'+side+'-'+part;entry=rig['parts'][name]
            matrix=axis_matrix(start,end,*entry['sourceAxis'],entry['widthScale'])
            layers[name]=affine_image(textures[name],matrix)
    for side in ['far','near']:
        name='ear-'+side;entry=rig['parts'][name]
        settle=rig['earSettle']
        root_progress=smooth((t*1000-settle['startMs'])/(settle['rootEndMs']-settle['startMs']))
        bend_progress=smooth((t*1000-settle['bendStartMs'])/(settle['endMs']-settle['bendStartMs']))
        intensity=1-smooth((t*1000-settle['emissionStartMs'])/(settle['emissionEndMs']-settle['emissionStartMs']))
        angle=math.radians(rig['earRelaxDegrees'][side]*progress+settle['rootDegrees'][side]*root_progress)
        bend=math.radians(settle['bendDegrees'][side]*bend_progress)
        relative=bone(entry['root'],angle,entry['root'])
        ear_matrix=multiply(head_matrix,relative)
        layers[name]=curved_ear(light_texture(side,intensity),ear_matrix,entry,bend)
        tip=point(ear_matrix,curved_point(entry['tip'],entry,bend))
        drop_name='drop-'+side;drop=rig['parts'][drop_name]
        drop_matrix=bone(tip,0,drop['bindTip'])
        layers[drop_name]=affine_image(textures[drop_name],multiply(drop_matrix,drop['bindMatrix']))
    head_name='head-open' if t<.075 else 'head-half' if t<.155 else 'head-closed'
    layers['head']=affine_image(textures[head_name],multiply(head_matrix,rig['parts'][head_name]['bindMatrix']))
    result=Image.new('RGBA',(512,512))
    for name in rig['drawOrder']:result.alpha_composite(layers[name])
    return result


output=folder/'Frames';output.mkdir(0o777,True,True)
times=rig['sampleTimesMs']
if '--keys-only' not in sys.argv:
    for index,time in enumerate(times):render(time/1000).save(output/f'{index:03d}.png')
