import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

HERE=Path(__file__).resolve().parent

def write_json(path,value):
    encoder=json.JSONEncoder()
    encoder.indent=2
    path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def smooth(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)

def mesh(image,joints):
    bounds=image.getchannel('A').getbbox()
    xs=list(range(max(0,bounds[0]-6),min(512,bounds[2]+12),4))
    ys=list(range(max(0,bounds[1]-6),min(512,bounds[3]+12),4))
    vertices=[[x,y] for y in ys for x in xs]
    hip,knee,ankle=np.asarray(joints,float)
    first=(knee-hip)/np.linalg.norm(knee-hip)
    second=(ankle-knee)/np.linalg.norm(ankle-knee)
    tangent=(first+second)/np.linalg.norm(first+second)
    weights=[]
    for point in vertices:
        point=np.asarray(point,float)
        a=float(smooth((np.dot(point-knee,tangent)+4)/8))
        b=float(smooth((np.dot(point-ankle,second)+3)/6))
        weights.append([1-a,a*(1-b),a*b])
    triangles=[]
    alpha=np.asarray(image)[:,:,3]
    for row in range(len(ys)-1):
        for col in range(len(xs)-1):
            if np.any(alpha[ys[row]:ys[row+1]+1,xs[col]:xs[col+1]+1]):
                n=row*len(xs)+col
                triangles.extend([[n,n+1,n+len(xs)],[n+1,n+len(xs)+1,n+len(xs)]])
    return {'vertices':vertices,'weights':weights,'triangles':triangles,'joints':joints,'step':4}

def main():
    source=HERE/'Source/Registered'
    reference=Image.open(HERE/'Source/reference.png').convert('RGBA')
    rgba=np.array(reference)
    y,x=np.mgrid[:512,:512]
    profile=np.interp(x,[0,90,115,150,185,220,250,300,350,400,440,480,512],[280,295,302,320,305,315,330,338,343,334,318,288,280])
    core=np.array(Image.open(source/'core.png').convert('RGBA'))
    jaws=np.zeros((512,512),bool)
    for name in ['jaw-far','jaw-near']:
        part=Image.open(source/(name+'.png')).convert('RGBA')
        part.save(HERE/'Parts'/(name+'.png'))
        jaws|=np.asarray(part)[:,:,3]>16
    restore=(rgba[:,:,3]>0)&(core[:,:,3]>200)&(y<=profile)&(~jaws)
    upper=(y<=profile)&(core[:,:,3]>0)
    closed=core.copy()
    closed[restore]=rgba[restore]
    for box in [(101,281,139,315),(184,282,230,324)]:
        a,b,c,d=box
        closed[b:d,a:c]=core[b:d,a:c]
    open_core=closed.copy()
    for box in [(101,281,139,315),(184,282,230,324)]:
        a,b,c,d=box
        window=(rgba[b:d,a:c,3]>0)&(~jaws[b:d,a:c])
        open_core[b:d,a:c][window]=rgba[b:d,a:c][window]
    for name,pixels in [('open',open_core),('closed',closed)]:
        Image.fromarray(pixels).save(HERE/'Parts'/('core-'+name+'.png'))
        cap=pixels.copy()
        cap[~upper]=0
        Image.fromarray(cap).save(HERE/'Parts'/('core-'+name+'-cap.png'))
    polygons={
        'far-leg':[(91,276),(108,292),(88,317),(74,340),(58,364),(38,375),(31,356),(40,329),(47,315),(58,303),(64,289)],
        'front-leg':[(234,314),(253,315),(279,333),(292,355),(294,374),(280,398),(266,426),(240,450),(229,442),(232,415),(240,400),(239,379),(241,368),(233,355),(228,338)],
        'middle-leg':[(310,331),(332,334),(354,342),(371,356),(379,379),(386,400),(390,419),(377,434),(362,424),(348,401),(339,381),(327,374),(314,365),(307,349)],
        'rear-leg':[(405,314),(428,312),(449,323),(462,342),(474,363),(478,386),(465,408),(452,399),(442,379),(431,365),(416,356),(405,339)]}
    joints={'far-leg':[[90,286],[65,315],[49,342]],'front-leg':[[247,328],[267,375],[247,414]],'middle-leg':[[323,340],[348,376],[367,407]],'rear-leg':[[419,320],[447,352],[461,381]]}
    meshes={}
    for name,polygon in polygons.items():
        mask=Image.new('L',(512,512),0)
        ImageDraw.Draw(mask).polygon(polygon,255)
        original=rgba.copy()
        original[:,:,3]=np.minimum(original[:,:,3],np.asarray(mask))
        original[jaws|(y<profile-2)]=0
        hidden=np.array(Image.open(source/('complete-'+name+'.png')).convert('RGBA'))
        cutoff=joints[name][0][1]+8
        hip=joints[name][0]
        hidden[(y>cutoff)|((x-hip[0])**2+(y-hip[1])**2>22**2)]=0
        part=Image.fromarray(hidden)
        part.alpha_composite(Image.fromarray(original))
        part.save(HERE/'Parts'/(name+'.png'))
        meshes[name]=mesh(part,joints[name])
    write_json(HERE/'meshes.json',meshes)
    write_json(HERE/'rig.json',{'format':'spawner-segmented-bone-mesh-v3','approvedDesign':'DesignAssets/CreatureConcepts/v3/spiny-back-leader.png','frameSize':512,'pivot':[256,448],'columns':8,'method':'complete hidden body with original rigid carapace and mandibles, four independently weighted jointed limbs','bones':[{'id':'body','parent':None,'pivot':[260,350]},{'id':'jaw-far','parent':'body','pivot':[117,310]},{'id':'jaw-near','parent':'body','pivot':[191,317]}]+[{'id':name+'-'+segment,'parent':'body' if index==0 else name+'-'+['upper','lower','claw'][index-1],'pivot':points[index]} for name,points in joints.items() for index,segment in enumerate(['upper','lower','claw'])],'meshes':'meshes.json','rootGroundY':447,'originalLegMasks':polygons,'hiddenLimbSources':'Source/Registered/limb-registration.json','sourceRegistration':'Source/Registered/registration.json','runtime':'local Python Pillow/numpy renderer; no Spine compatibility claim'})
    channels={
        'fall':[[0,0],[200,0],[400,0.08],[760,0.92],[920,1],[1000,0.976],[1120,1],[1280,1]],
        'pitch':[[0,0],[240,0],[500,-1],[920,-2.5],[1040,-2],[1280,-2]],
        'jawFar':[[0,0],[240,0],[760,50],[1040,56],[1280,56]],
        'jawNear':[[0,0],[280,0],[840,58],[1040,64],[1280,64]]}
    for name,phase,upper_angle,lower_angle,claw_angle in [('far-leg',200,-30,-36,-8),('front-leg',160,-40,-65,-12),('middle-leg',280,-20,-70,-10),('rear-leg',360,10,-75,-8)]:
        for segment,angle in [('upper',upper_angle),('lower',lower_angle),('claw',claw_angle)]:
            channels[name+'-'+segment]=[[0,0],[phase,0],[phase+200,angle*0.12],[phase+560,angle],[phase+720,angle+2],[1120,angle],[1280,angle]]
    write_json(HERE/'motion.json',{'channels':channels,'eyeCloseMs':320,'frameTimesMs':list(range(0,1281,40)),'durationsMs':[40]*32+[1000],'previewLoop':0,'timelineLoop':False})

if __name__=='__main__':
    main()
