import numpy as np
from PIL import Image
from deform import sample

def rasterize_depth(pixels,vertices,posed,triangles,depths):
    output=np.zeros((512,512,4),float);buffer=np.full((512,512),-np.inf)
    for indices in triangles:
        target=posed[indices];source=vertices[indices]
        lower=np.maximum(np.floor(target.min(0)).astype(int),0);upper=np.minimum(np.ceil(target.max(0)).astype(int),511)
        if np.any(upper<lower): continue
        system=np.vstack([target.T,np.ones(3)])
        if abs(np.linalg.det(system))<.001: continue
        x,y=np.meshgrid(np.arange(lower[0],upper[0]+1),np.arange(lower[1],upper[1]+1));bary=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
        inside=bary.min(0)>=-.00001
        if not inside.any(): continue
        xx=x.ravel()[inside];yy=y.ravel()[inside];bary=bary[:,inside];uv=source.T@bary;rgba=sample(pixels,uv[0],uv[1]);z=depths[indices]@bary
        visible=(rgba[:,3]>.0001)&(z>=buffer[yy,xx]-.00001);xx=xx[visible];yy=yy[visible];output[yy,xx]=rgba[visible];buffer[yy,xx]=z[visible]
    return output,buffer

def composite_layers(layers,depths):
    values=np.array(layers);order=np.argsort(np.array(depths),**{'axis':0});ordered=np.take_along_axis(values,order[:,:,:,None],**{'axis':0});output=np.zeros((512,512,4),float)
    for rgba in ordered: output=rgba+output*(1-rgba[:,:,3:4])
    output[:,:,:3]/=np.maximum(.000001,output[:,:,3:4])
    return Image.fromarray(np.uint8(np.clip(np.rint(output*255),0,255)))
