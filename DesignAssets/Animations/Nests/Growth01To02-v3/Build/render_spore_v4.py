from riglib import *

BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'spore'
PARTS=OUT/'Parts'
RIG=json.loads((OUT/'rig.json').read_text('utf-8'))
layers=[{part:premul(Image.open(PARTS/(str(level)+'-'+str(part)+'.png'))) for part in range(3)} for level in range(3)]
body_points=[np.array(p) for p in RIG['bodyControls']]
anchors=[[(256,237),(98,331),(173,354),(256,355),(339,354),(414,331)],[(256,265),(108,384),(185,416),(256,414),(327,416),(404,384)],[(246,139),(49,272),(135,301),(254,302),(357,293),(441,269)]]
caps=[]
controls=[]
for level in range(3):
    cap=layers[level][1].copy()
    color=cap[:,:,:3]/np.maximum(cap[:,:,3:4],1e-6)
    red=(color[:,:,0]>color[:,:,1]*1.12)&(color[:,:,0]>color[:,:,2]*1.05)
    contours,hierarchy=cv2.findContours(np.uint8(red&(cap[:,:,3]>.15)),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    mask=np.zeros((512,512),np.uint8)
    cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],0,1,cv2.FILLED)
    cap*=mask[:,:,None]
    cap=premul(rgba(cap))
    caps.append(cap)
    controls.append(contour_points(cap,anchors[level]))
    rgba(cap).save(PARTS/(str(level)+'-complete-cap-v4.png'))
big=affine(caps[1],(256,424),(1.23,1.23),0,(0,-4))
big_controls=(controls[1]-np.array([256,424]))*1.23+np.array([256,420])


def frame_at(index):
    close,growth,opened=phases(index)
    body=morph(layers[0][0],layers[2][0],body_points[0],body_points[1],growth,(256,448),(256,350),0)
    secondary=np.zeros_like(body)
    born=growth*opened
    if born>0:
        secondary=affine(layers[2][2],(407,367),(max(.002,born),max(.002,born)),0,(-70*(1-born),20*(1-born)))
    if growth==0:
        cap=morph(caps[0],caps[1],controls[0],controls[1],close,(256,424),(256,320),0)
    elif growth<1:
        cap=morph(caps[1],big,controls[1],big_controls,growth,(256,424),(256,320),0)
    else:
        cap=morph(big,caps[2],big_controls,controls[2],opened,(256,420),(256,300),0)
    return rgba(over(cap,over(body,secondary)))


frames=[frame_at(i) for i in range(61)]
RIG['capControls']=[points.tolist() for points in controls]
RIG['drawOrder']=['side-cap','nursery','complete-canopy']
RIG['sourceCaps']=[str(i)+'-complete-cap-v4.png' for i in range(3)]
json_write(OUT/'rig.json',RIG)
export(frames,OUT,{'source':'Parts','method':'complete-drawn-canopy-keys-local-mesh'})
