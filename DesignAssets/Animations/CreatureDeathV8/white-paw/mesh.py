from PIL import Image
import numpy as np
import math

def lattice(image,step):
    box=image.getchannel('A').getbbox()
    xs=np.linspace(max(0,box[0]-2),min(511,box[2]+2),math.ceil((box[2]-box[0]+4)/step)+1)
    ys=np.linspace(max(0,box[1]-2),min(511,box[3]+2),math.ceil((box[3]-box[1]+4)/step)+1)
    vertices=np.array([[x,y] for y in ys for x in xs])
    triangles=[]
    width=len(xs)
    for row in range(len(ys)-1):
        for column in range(width-1):
            a=row*width+column
            triangles.extend([(a,a+1,a+width),(a+1,a+width+1,a+width)])
    return vertices,np.array(triangles)

def warp(image,vertices,moved,triangles):
    texture=np.array(image).astype(float)/255
    texture[:,:,:3]*=texture[:,:,3,None]
    output=np.zeros((512,512,4),float)
    uv=np.full((512,512,2),-1000.)
    for triangle in triangles:
        a,b,c=moved[triangle]
        low=np.maximum(np.floor(np.minimum(np.minimum(a,b),c)).astype(int),0)
        high=np.minimum(np.ceil(np.maximum(np.maximum(a,b),c)).astype(int),511)
        if np.any(high<low):
            continue
        denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator)<.00001:
            continue
        yy,xx=np.mgrid[low[1]:high[1]+1,low[0]:high[0]+1]
        wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
        wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
        wc=1-wa-wb
        inside=(wa>=-.000001)&(wb>=-.000001)&(wc>=-.000001)
        if not np.any(inside):
            continue
        source=wa[:,:,None]*vertices[triangle[0]]+wb[:,:,None]*vertices[triangle[1]]+wc[:,:,None]*vertices[triangle[2]]
        u=np.clip(source[:,:,0],0,511)
        v=np.clip(source[:,:,1],0,511)
        x0=np.floor(u).astype(int)
        y0=np.floor(v).astype(int)
        x1=np.minimum(x0+1,511)
        y1=np.minimum(y0+1,511)
        fu=(u-x0)[:,:,None]
        fv=(v-y0)[:,:,None]
        sampled=(texture[y0,x0]*(1-fu)+texture[y0,x1]*fu)*(1-fv)+(texture[y1,x0]*(1-fu)+texture[y1,x1]*fu)*fv
        prior=uv[low[1]:high[1]+1,low[0]:high[0]+1]
        inside&=(np.sqrt(np.sum((prior-source)**2,2))>.001)&(sampled[:,:,3]>.00001)
        patch=output[low[1]:high[1]+1,low[0]:high[0]+1]
        patch[inside]=sampled[inside]+patch[inside]*(1-sampled[inside,3,None])
        prior[inside]=source[inside]
    output[:,:,:3]/=np.maximum(output[:,:,3,None],.000001)
    return Image.fromarray(np.clip(output*255,0,255).round().astype(np.uint8))

