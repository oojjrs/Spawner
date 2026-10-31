from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent
reference = json.loads((root/'Source/reference-registration.json').read_text('utf-8'))
registration = json.loads((root/'Source/generated-registration.json').read_text('utf-8'))
authoring = json.loads((root/'Source/authoring.json').read_text('utf-8'))
placement = np.array(reference['placement'],float)
native_size = tuple(reference['nativeSize'])
(root/'Parts').mkdir(0o777,True,True)
(root/'Source/Registered').mkdir(0o777,True,True)

def warp(image,transform,size):
    inverse = np.linalg.inv(transform)
    return image.convert('RGBa').transform(size,Image.Transform.AFFINE,tuple(inverse[:2].ravel()),Image.Resampling.BICUBIC).convert('RGBA')

def generated(name):
    record = registration[name]
    image = Image.open(root/record['source']).convert('RGBA').crop(record['crop'])
    pixels = np.array(image)
    pixels[pixels[:,:,3]<16,3]=0
    image = Image.fromarray(pixels)
    transform = np.vstack([record['matrixNative'],[0,0,1]])
    return warp(image,transform,native_size)

body = generated('body')
closed = generated('body-closed')
labels=np.array(Image.open(root/'Source/part-labels.png'))
approved_alpha = np.array(Image.open(root/'Source/approved-original.png').convert('RGBA'))[:,:,3]
visible_body = Image.open(root/'Source/Visible/body.png').convert('RGBA')
visible_rgba = np.array(visible_body)
yy,xx = np.mgrid[:native_size[1],:native_size[0]]
visible_rgba[visible_rgba[:,:,3]<16,3]=0
visible_body = Image.fromarray(visible_rgba)
body_pixels=np.array(body)
body_pixels[:,:,3] *= (labels>0)&(approved_alpha>=250)
body=Image.fromarray(body_pixels)
body.save(root/'Source/Registered/body-hidden-native.png')
complete_body = body.copy()
complete_body.alpha_composite(visible_body)
pixels = np.array(complete_body)
closed_pixels = np.array(closed)
yy,xx = np.mgrid[:native_size[1],:native_size[0]]
approved_alpha = np.array(Image.open(root/'Source/approved-original.png').convert('RGBA'))[:,:,3]
near = np.clip((1-((xx-135)/19)**2-((yy-190)/13)**2)*5,0,1)
pixels[:,:,:3] = np.rint(pixels[:,:,:3]*(1-near[:,:,None])+closed_pixels[:,:,:3]*near[:,:,None]).astype('uint8')
near_to_far = np.array([[.35,0,85-.35*135],[0,.65,183-.65*190],[0,0,1]],float)
far = np.array(warp(closed,near_to_far,native_size))
far_mask = np.clip((1-((xx-85)/7)**2-((yy-183)/9)**2)*5,0,1)
far_rgb = np.clip(far[:,:,:3].astype(float)*np.array([.76,.72,.70]),0,255)
pixels[:,:,:3] = np.rint(pixels[:,:,:3]*(1-far_mask[:,:,None])+far_rgb*far_mask[:,:,None]).astype('uint8')
closed_complete = Image.fromarray(pixels)
warp(complete_body,placement,(512,512)).save(root/'Parts/body.png')
warp(body,placement,(512,512)).save(root/'Parts/body-base.png')
warp(closed_complete,placement,(512,512)).save(root/'Parts/body-closed.png')
warp(visible_body,placement,(512,512)).save(root/'Parts/body-visible.png')
visible_closed = np.array(visible_body)
visible_closed[:,:,:3] = pixels[:,:,:3]
warp(Image.fromarray(visible_closed),placement,(512,512)).save(root/'Parts/body-visible-closed.png')
for name,spec in authoring['appendages'].items():
    visible = Image.open(root/spec['visible']).convert('RGBA')
    data = np.array(visible)
    data[data[:,:,3]<16,3]=0
    pivot = np.array(spec['joint'],float)
    if spec['split'] is not None:
        axis = np.array(spec['axis'],float)
        axis /= np.linalg.norm(axis)
        projection = (xx-pivot[0])*axis[0]+(yy-pivot[1])*axis[1]
        data[:,:,3] *= projection >= -2 if spec['split']=='lower' else projection <= 3
    hidden = np.array(generated(spec['generated']))
    allowed = np.zeros((native_size[1],native_size[0]),float)
    for x,y,radius in spec['hiddenCaps']:
        allowed = np.maximum(allowed,np.clip((radius+1-np.hypot(xx-x,yy-y)),0,1))
    allowed *= approved_alpha>=250
    hidden[:,:,3] = np.rint(hidden[:,:,3]*allowed).astype('uint8')
    hidden_image = Image.fromarray(hidden)
    hidden_image.alpha_composite(Image.fromarray(data))
    if 'placementNative' in spec:
        hidden_image = warp(hidden_image,np.array(spec['placementNative']),native_size)
    hidden_image.save(root/'Source/Registered'/(name+'-native.png'))
    warp(hidden_image,placement,(512,512)).save(root/'Parts'/(name+'.png'))
print(json.dumps({'parts':len(authoring['appendages'])+5,'referenceScale':reference['commonScale']}))
