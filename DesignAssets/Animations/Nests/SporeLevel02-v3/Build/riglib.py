from PIL import Image
import numpy as np

def rgba(a):
    alpha=np.clip(a[:,:,3:4],0,1)
    rgb=a[:,:,:3]/np.maximum(alpha,1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb,alpha],2)*255+.5,0,255)),'RGBA')

def over(front,back):
    return front+back*(1-front[:,:,3:4])
