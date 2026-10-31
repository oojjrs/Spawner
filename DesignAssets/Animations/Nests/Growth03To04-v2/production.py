import sys
from riglib import *
from PIL import WebPImagePlugin

KEYS=[0,12,24,32,40,48,54,60,72,84,88,100]

def fitted(source,box):
    x,y,w,h=box;scale=min(w/source.shape[1],h/source.shape[0]);im=cv2.resize(source,(round(source.shape[1]*scale),round(source.shape[0]*scale)),None,0,0,cv2.INTER_LANCZOS4);canvas=np.zeros((512,512,4),np.float32);xx=round(x+(w-im.shape[1])/2);yy=round(y+(h-im.shape[0])/2);canvas[yy:yy+im.shape[0],xx:xx+im.shape[1]]=im;return canvas

def dilate(mask,amount):return cv2.dilate(np.uint8(mask),np.ones((amount*2+1,amount*2+1),np.uint8))>0

def smooth_mesh(name,a,b,marks_a,marks_b,pivot,span,delta):
    mesh=Petal(name,a,b,marks_a,marks_b,pivot,pivot,[pivot,(pivot[0]-span,pivot[1]-30),(pivot[0]+span,pivot[1]-30)],[0,8,-8]);mesh.preserve_texture()
    try:
        ca=mesh.vertices[:mesh.boundaryCount];cb=mesh.target[:mesh.boundaryCount];ka=kernel_center(ca,np.mean(ca,0));kb=kernel_center(cb,np.mean(cb,0));va,tri=fan_mesh(ca,ka);vb,unused=fan_mesh(cb,kb);n=len(ca);order=np.r_[1+2*n+np.arange(n),0,1+np.arange(2*n)];inverse=np.argsort(order);mesh.vertices=va[order];mesh.target=vb[order];mesh.triangles=inverse[tri]
    except ValueError:pass
    rig=Skeleton();rig.add('root',None,(256,448),0,0);rig.add(name+'-carrier','root',pivot,0,0);rig.add(name+'0',name+'-carrier',pivot,-90,span)
    rig.add(name+'1',name+'0',(pivot[0]-span/2,pivot[1]-25),-135,span);rig.add(name+'2',name+'0',(pivot[0]+span/2,pivot[1]-25),-45,span);mesh.skeleton=rig
    u=np.clip((mesh.vertices[:,0]-pivot[0])/span,-1,1);mesh.weights={name+'0':(1-np.abs(u)).tolist(),name+'1':np.maximum(-u,0).tolist(),name+'2':np.maximum(u,0).tolist()};mesh.motion(delta);return mesh

def export_sequence(root,render,rig_data,draft):
    ids=KEYS if draft else list(range(101));frames=[];board=Image.new('RGBA',(2304,768),'#182923')
    for frame in ids:
        image=rgba(render(frame));frames.append(image)
        if frame in KEYS:
            k=KEYS.index(frame);board.alpha_composite(image.resize((384,384),Image.Resampling.LANCZOS),((k%6)*384,(k//6)*384));image.save(root/('pose-'+str(frame)+'.png'))
        if frame==100:image.save(root/'render-end.png')
    board.convert('RGB').save(root/'keyframes.png');save_json(root/'rig.json',rig_data())
    if draft:print(root.name+' key poses exported');return
    durations=[600]+[40]*99+[1000];sheet=Image.new('RGBA',(4096,6656))
    for i,image in enumerate(frames):sheet.alpha_composite(image,((i%8)*512,(i//8)*512))
    sheet.save(root/'growth.png')
    for name,items in [('growth',frames),('preview',[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames])]:
        items[0].encoderinfo={'append_images':items[1:],'duration':durations,'lossless':True,'loop':1 if name=='growth' else 0,'method':4}
        with (root/(name+'.webp')).open('wb') as stream:WebPImagePlugin._save_all(items[0],stream,'')
    save_json(root/'animation.json',{'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True,'sources':{'start':'start.png','end':'end.png','parts':'Parts','rig':'rig.json'}});print(root.name+' animation exported')
