import numpy as np
from PIL import Image,ImageFilter
from ribbon import rasterize
from surface import pose_actor
from depth import rasterize_depth,composite_layers

def prepare_scene(images,actor,limbs,rig):
    names=['skin']+list(limbs);textures={}
    for expression in ['skin','skin-closed']:
        atlas=Image.new('RGBA',(512*len(names),512))
        for index,name in enumerate(names):
            image=images[expression if name=='skin' else name]
            if name=='fore-near':
                pixels=np.array(image)
                y,x=np.mgrid[:512,:512]
                start,stop=rig['nearShoulder']['alphaY']
                blend=np.clip((y-start)/(stop-start),0,1)
                blend=blend*blend*(3-2*blend)
                covered=np.array(images['skin'])[:,:,3]/255
                pixels[:,:,3]=np.round(pixels[:,:,3]*(1-covered*(1-blend))).astype(np.uint8)
                margin=rig['nearShoulder']['edgeFeatherPixels']
                source_alpha=np.array(image)[:,:,3]
                edge=np.array(Image.fromarray(np.uint8(source_alpha>128)*255).filter(ImageFilter.MinFilter(margin*2+1)).filter(ImageFilter.GaussianBlur(1.5)))/255
                first,last=rig['nearShoulder']['edgeFeatherY']
                amount=np.clip((last-y)/(last-first),0,1)*covered
                pixels[:,:,3]=np.round(pixels[:,:,3]*(1-amount*(1-edge))).astype(np.uint8)
                image=Image.fromarray(pixels)
            atlas.paste(image,(index*512,0))
        pixels=np.asarray(atlas).astype(float)/255;pixels[:,:,:3]*=pixels[:,:,3:4];textures[expression]=pixels
    vertices=[];triangles=[];depths=[];offset=0
    for index,name in enumerate(names):
        mesh=actor if name=='skin' else limbs[name];points=np.array(mesh['vertices']);vertices.extend((points+[index*512,0]).tolist());triangles.extend((np.array(mesh['triangles'])+offset).tolist());offset+=len(points)
        if name=='skin': depths.append(None);continue
        if name=='fore-far': depth=np.full(len(points),-10.0)
        elif name=='fore-near':
            start,stop=rig['nearShoulder']['depthY']
            low,high=rig['nearShoulder']['depthZ']
            blend=np.clip((points[:,1]-start)/(stop-start),0,1)
            blend=blend*blend*(3-2*blend)
            depth=low+(high-low)*blend
        else:
            alpha=np.asarray(images[name+'-visible'])[:,:,3];field=np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(3)))/255;xy=np.clip(np.rint(points).astype(int),0,511);known=field[xy[:,1],xy[:,0]]
            depth=(-15+35*known) if name=='hind-far' else (-15+95*known)
        depths.append(depth)
    return {'names':names,'textures':textures,'vertices':np.array(vertices),'triangles':np.array(triangles),'depths':depths}

def render_scene(scene,actor,limbs,state,pouch,rig,expression):
    layers=[];buffers=[]
    for index,name in enumerate(scene['names']):
        if name=='skin':
            mesh=actor;posed,depth=pose_actor(actor,state,pouch,rig);vertices=np.array(actor['vertices'])
        else:
            mesh=limbs[name];vertices=np.array(mesh['vertices']);source=np.column_stack([vertices,np.ones(len(vertices))]);weights=np.array(mesh['weights']);posed=np.zeros_like(vertices)
            for bone,matrix in enumerate(state['legs'][name]): posed+=(source@matrix.T)[:,:2]*weights[:,bone:bone+1]
            depth=scene['depths'][index]
        layer,buffer=rasterize_depth(scene['textures'][expression],vertices+[index*512,0],posed,mesh['triangles'],depth);layers.append(layer);buffers.append(buffer)
    return composite_layers(layers,buffers)
