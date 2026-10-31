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

def deform(texture, part, supersample):
    if max(abs(v) for v in part['delta'])<1e-8:
        return texture.resize((texture.width*supersample,texture.height*supersample),Image.Resampling.LANCZOS)
    source = texture.resize((texture.width*supersample,texture.height*supersample),Image.Resampling.LANCZOS)
    source_array = np.asarray(source).astype(np.float32)
    source_array[:,:,:3] *= source_array[:,:,3:4]/255
    mesh = part['mesh']
    vertices = np.array(mesh['vertices'])*supersample
    weights = np.array(mesh['weights'])
    target = vertices+weights[:,1:2]*np.array(part['delta'])*supersample
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
    config=json.loads((FOLDER/'foot-settings.json').read_text('utf8'))
    size=json.loads((FOLDER/'settings.json').read_text('utf8'))['frameSize']
    target=np.array(config['anchor'])
    source_panel=Image.new('RGB',(size*4,(size+20)*2),(35,43,39))
    after_panel=source_panel.copy()
    all_records=[]
    for item in config['contacts']:
        cel=item['cel'];point=np.array(item['contact']);delta=target-point
        image=Image.open(FOLDER/item['source']).convert('RGBA')
        x,y=point;half=config['halfWidth'];top=y-config['jointRise'];bottom=y+4
        left=max(0,x-half);right=min(size-1,x+half)
        mask=Image.new('L',(size,size),0)
        ImageDraw.Draw(mask).polygon([(left+5,top),(right-5,top),(right,bottom),(left,bottom)],255)
        texture=image.copy();texture.putalpha(Image.fromarray(np.uint8(np.asarray(image.getchannel('A')).astype(np.float32)*np.asarray(mask)/255)))
        texture.save(FOLDER/'LegParts'/('%02d.png'%cel));mask.save(FOLDER/'Masks'/('%02d.png'%cel))
        vertices=np.array([[vx,vy]for vy in np.linspace(top-1,bottom+1,9)for vx in np.linspace(left-1,right+1,9)])
        progress=np.clip((vertices[:,1]-top)/(config['jointRise']-config['rigidRise']),0,1)
        weights=progress*progress*(3-2*progress)
        triangles=[]
        for row in range(8):
            for col in range(8):
                n=row*9+col;triangles.extend([[n,n+1,n+9],[n+1,n+10,n+9]])
        part={'delta':delta.tolist(),'mesh':{'vertices':vertices.tolist(),'triangles':triangles,'weights':[[float(1-w),float(w)]for w in weights]}}
        if cel==0 or np.max(np.abs(delta))==0:
            result=image.copy()
        else:
            body=image.copy();body.putalpha(Image.fromarray(np.uint8(np.asarray(image.getchannel('A')).astype(np.float32)*(1-np.asarray(mask).astype(np.float32)/255))))
            limb=deform(texture,part,1)
            result=Image.alpha_composite(body,limb)
        result.save(FOLDER/'Drawings'/('%02d.png'%cel))
        before_point=item['contact'];after_point=config['anchor']
        for panel,frame,p in [(source_panel,image,before_point),(after_panel,result,after_point)]:
            tile=Image.new('RGB',(size,size),(35,43,39));tile.paste(frame,(0,0),frame);draw=ImageDraw.Draw(tile)
            draw.line((p[0]-6,p[1],p[0]+6,p[1]),(255,220,60),1);draw.line((p[0],p[1]-6,p[0],p[1]+6),(255,220,60),1)
            sx=cel%4*size;sy=cel//4*(size+20);panel.paste(tile,(sx,sy+20));ImageDraw.Draw(panel).text((sx+5,sy+4),'cel '+str(cel)+' '+str(p),(240,245,225))
        iy=int(target[1]-.5);px=int(target[0]);alpha=result.getchannel('A')
        all_records.append({'cel':cel,'anatomicalSourceContact':item['contact'],'targetContact':config['anchor'],'deltaPixels':delta.tolist(),'source':item['source'],'drawing':'Drawings/%02d.png'%cel,'partTexture':'LegParts/%02d.png'%cel,'partMask':'Masks/%02d.png'%cel,'bones':[{'name':'proximal-hind-leg','parent':'drawn-body','translation':[0,0]},{'name':'planted-hind-foot','parent':'proximal-hind-leg','translation':delta.tolist()}],'mesh':part['mesh'],'targetSoleAlpha':alpha.getpixel((px,iy)),'belowTargetAlpha':alpha.getpixel((px,iy+1))})
    source_panel.save(FOLDER/'support-markers-source.png');after_panel.save(FOLDER/'support-markers-aligned.png')
    save_json(FOLDER/'leg-rig.json',{'species':config['species'],'sourceVersion':'CreatureHurtV5','worldPivotChanged':False,'artworkScale':1,'anchor':config['anchor'],'support':'Directly identified near hind hoof/foot sole. The existing planted near forefoot and other limbs are outside the corrected region and remain unchanged.','construction':'Complete drawn body poses retained. A separate near-hind-leg attachment has a fixed proximal joint and a rigid planted hoof/webbed-foot region, joined by smoothly weighted skin. No full-body translation or body scaling.','cells':all_records})
    print(config['species'],'local hind leg registration',config['anchor'])

if __name__=='__main__':main()
