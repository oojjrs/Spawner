import numpy as np
from PIL import Image

def affine(image,matrix,size):
    width,height=size
    output=np.zeros((height,width,4),np.uint8)
    bounds=image.getchannel('A').getbbox()
    if bounds is None:
        return Image.fromarray(output)
    corners=np.array([[bounds[0],bounds[1],1],[bounds[2],bounds[1],1],[bounds[0],bounds[3],1],[bounds[2],bounds[3],1]],float)
    transformed=(matrix@corners.T).T[:,:2]
    lower=np.maximum(0,np.floor(transformed.min(0)).astype(int)-2)
    upper=np.minimum([width,height],np.ceil(transformed.max(0)).astype(int)+2)
    if np.any(upper<=lower):
        return Image.fromarray(output)
    pixels=np.asarray(image).astype(float)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    inverse=np.linalg.inv(matrix)
    y,x=np.indices((upper[1]-lower[1],upper[0]-lower[0]))
    y+=lower[1]
    x+=lower[0]
    coordinates=inverse@np.stack([x.ravel()+.5,y.ravel()+.5,np.ones(x.size)])
    xx,yy=coordinates[0]-.5,coordinates[1]-.5
    sx=np.clip(xx,0,image.width-1.000001)
    sy=np.clip(yy,0,image.height-1.000001)
    ix,iy=sx.astype(int),sy.astype(int)
    u,v=(sx-ix)[:,None],(sy-iy)[:,None]
    values=(pixels[iy,ix]*(1-u)+pixels[iy,ix+1]*u)*(1-v)+(pixels[iy+1,ix]*(1-u)+pixels[iy+1,ix+1]*u)*v
    values[(xx<0)|(yy<0)|(xx>image.width-1)|(yy>image.height-1)]=0
    rgb=values[:,:3]/np.maximum(1e-10,values[:,3:4])
    result=np.concatenate([rgb,values[:,3:4]],1).reshape(y.shape[0],y.shape[1],4)
    output[lower[1]:upper[1],lower[0]:upper[0]]=np.uint8(np.clip(result*255+.5,0,255))
    return Image.fromarray(output)
