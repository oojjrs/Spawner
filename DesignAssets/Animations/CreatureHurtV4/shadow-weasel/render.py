from pathlib import Path
from PIL import Image, ImageDraw
import json
import math
import numpy as np

FOLDER = Path(__file__).resolve().parent

def save_json(path, value):
    path.write_bytes((json.dumps(value, **{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def transform(points, pivot, degrees):
    radians = math.radians(degrees)
    matrix = np.array([[math.cos(radians),-math.sin(radians)],[math.sin(radians),math.cos(radians)]])
    return (points-pivot)@matrix.T+pivot

def deform(texture, part, base_degrees, tip_degrees, supersample):
    if abs(base_degrees)+abs(tip_degrees)<1e-8:
        return texture.resize((texture.width*supersample,texture.height*supersample),Image.Resampling.LANCZOS)
    source = texture.resize((texture.width*supersample,texture.height*supersample),Image.Resampling.LANCZOS)
    source_array = np.asarray(source).astype(np.float32)
    source_array[:,:,:3] *= source_array[:,:,3:4]/255
    mesh = part['mesh']
    vertices = np.array(mesh['vertices'])*supersample
    pivot = np.array(part['pivot'])*supersample
    mid = np.array(part['mid'])*supersample
    first = transform(vertices,pivot,base_degrees)
    second = transform(transform(vertices,mid,tip_degrees),pivot,base_degrees)
    weights = np.array(mesh['weights'])
    target = first*weights[:,0:1]+second*weights[:,1:2]
    output = np.zeros_like(source_array)
    maximum = texture.width*supersample
    for triangle in mesh['triangles']:
        old = vertices[triangle]
        new = target[triangle]
        x0,y0 = np.maximum(0,np.floor(new.min(0)).astype(int))
        x1,y1 = np.minimum(maximum,np.ceil(new.max(0)).astype(int)+1)
        if x1<=x0 or y1<=y0: continue
        yy,xx = np.mgrid[y0:y1,x0:x1]
        points = np.stack([xx+.5,yy+.5],-1)
        basis = np.stack([new[1]-new[0],new[2]-new[0]],1)
        if abs(np.linalg.det(basis))<1e-8: continue
        bary = (points-new[0])@np.linalg.inv(basis).T
        inside = (bary[:,:,0]>=-1e-6)&(bary[:,:,1]>=-1e-6)&(bary.sum(-1)<=1.000001)
        mapped = old[0]+bary[:,:,0:1]*(old[1]-old[0])+bary[:,:,1:2]*(old[2]-old[0])-.5
        uv = np.clip(mapped,0,maximum-1.001)
        lo = np.floor(uv).astype(int)
        fraction = uv-lo
        x,y = lo[:,:,0],lo[:,:,1]
        fx,fy = fraction[:,:,0:1],fraction[:,:,1:2]
        pixels = source_array[y,x]*(1-fx)*(1-fy)+source_array[y,x+1]*fx*(1-fy)+source_array[y+1,x]*(1-fx)*fy+source_array[y+1,x+1]*fx*fy
        output[y0:y1,x0:x1][inside] = pixels[inside]
    alpha = output[:,:,3:4]
    output[:,:,:3] = np.divide(output[:,:,:3]*255,alpha,**{'out':np.zeros_like(output[:,:,:3]),'where':alpha>0})
    return Image.fromarray(np.uint8(np.clip(np.round(output),0,255)))

def main():
    config = json.loads((FOLDER/'rig.json').read_text('utf8'))
    size = config['size']
    ss = 2
    originals = {key:Image.open(FOLDER/'Source'/name).convert('RGBA') for key,name in [('open','seed.png'),('half','eyes-half.png'),('closed','eyes-closed.png')]}
    bodies = {key:Image.open(FOLDER/'Source'/('body-'+key+'.png')).convert('RGBA') for key in originals}
    masks = {part['name']:np.asarray(Image.open(FOLDER/'Masks'/(part['name']+'.png'))).astype(np.float32)/255 for part in config['parts']}
    textures = {}
    for expression,original in originals.items():
        for part in config['parts']:
            image = original.copy()
            image.putalpha(Image.fromarray(np.uint8(np.asarray(image.getchannel('A')).astype(np.float32)*masks[part['name']])))
            textures[(expression,part['name'])] = image
    root_profile = [0,.28,.65,.9,1,.92,.65,.35,.1,-.12,-.13,-.07,-.025,0,0,0]
    lag_profile = [0,.08,.42,.78,1,.96,.7,.35,-.18,-.30,-.22,-.10,-.025,0,0,0]
    tip_profile = [0,0,.14,.55,1,.98,.8,.40,-.12,-.34,-.28,-.14,-.04,0,0,0]
    expressions = ['open','half','closed','closed','closed','closed','closed','closed','half','half','open','open','open','open','open','open']
    frames = []
    timeline = []
    for index,expression in enumerate(expressions):
        p = root_profile[index]
        if p==0 and lag_profile[index]==0 and tip_profile[index]==0:
            frame = originals[expression].copy()
        else:
            frame = bodies[expression].resize((size*ss,size*ss),Image.Resampling.LANCZOS)
            for number,part in enumerate(sorted(config['parts'],**{'key':lambda part:part['order']})):
                bias = 1 if number%2==0 else .92
                base = part['degrees']*lag_profile[index]*bias
                tip = part['tipDegrees']*tip_profile[index]
                transformed = deform(textures[(expression,part['name'])],part,base,tip,ss)
                frame = Image.alpha_composite(frame,transformed)
            frame = frame.convert('RGBa').rotate(-config['bodyDegrees']*p,Image.Resampling.BICUBIC,False,tuple(v*ss for v in config['pivot']),(0,-config['bodyLift']*p*ss),(0,0,0,0)).resize((size,size),Image.Resampling.LANCZOS).convert('RGBA')
        frames.append(frame)
        timeline.append({'frame':index,'expression':expression,'durationMs':config['durationsMs'][index],'bodyDegrees':config['bodyDegrees']*p,'bodyLiftPixels':config['bodyLift']*p,'parts':[{'name':part['name'],'baseDegrees':part['degrees']*lag_profile[index]*(1 if number%2==0 else .92),'tipDegrees':part['tipDegrees']*tip_profile[index]} for number,part in enumerate(sorted(config['parts'],**{'key':lambda part:part['order']}))]})
    sheet = Image.new('RGBA',(size*4,size*4))
    matrix = Image.new('RGBA',(256,256))
    for index,frame in enumerate(frames):
        sheet.paste(frame,(index%4*size,index//4*size))
        matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(index%4*64,index//4*64))
    sheet.save(FOLDER/'hurt.webp','WEBP',**{'lossless':True,'exact':True,'method':4})
    matrix.save(FOLDER/'hurt-matrix.webp','WEBP',**{'lossless':True,'exact':True,'method':4})
    durations = config['durationsMs'].copy()
    durations[-1] += 900
    for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames])]:
        images[0].save(FOLDER/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,'lossless':True,'exact':True,'method':4})
    contact = Image.new('RGB',(size*4,size*2),(35,43,39))
    for index,key in enumerate([0,1,2,4,5,8,10,15]):
        contact.paste(frames[key],(index%4*size,index//4*size),frames[key])
        ImageDraw.Draw(contact).text((index%4*size+5,index//4*size+5),str(key),(255,255,255))
    contact.save(FOLDER/'hurt-contact.png')
    save_json(FOLDER/'timeline.json',{'durationMs':760,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'poses':timeline})
    save_json(FOLDER/'hurt.json',{'image':'DesignAssets/Animations/CreatureHurtV4/'+config['species']+'/hurt.webp','frameSize':size,'columns':4,'pivotX':config['pivot'][0],'pivotY':config['pivot'][1],'frameCount':16,'durationsMs':config['durationsMs'],'durationMs':760,'loop':False,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'source':'Source/seed.png','method':'Original registered expressions with separately extracted articulated attachments; generated hidden torso surfaces; local two-bone skinning per flexible part, fixed body scale, coherent ground-pivot recoil and delayed damped follow-through. Custom baked sprite renderer, not Spine.','rig':'rig.json','timeline':'timeline.json','renderer':'render.py','preview':'hurt-preview.webp','thumbnail':'hurt-thumbnail.webp','matrix':'hurt-matrix.webp','artworkScale':1,'previewPauseMs':900})
    print(config['species'],len(frames),sum(config['durationsMs']))

if __name__=='__main__':
    main()
