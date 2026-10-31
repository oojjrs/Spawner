from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FOLDER=Path(__file__).resolve().parent
SIZE=512
YY,XX=np.mgrid[:SIZE,:SIZE].astype(np.float32)


def write_json(path,value):
    encoded=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    path.write_bytes(encoded.replace('\n','\r\n').encode('utf-8'))


def smooth(value):
    value=np.clip(value,0,1)
    return value*value*(3-2*value)


def mask(points,start,end):
    image=Image.new('L',(SIZE,SIZE))
    ImageDraw.Draw(image).polygon([tuple(p) for p in points],255)
    image=image.filter(ImageFilter.GaussianBlur(5))
    return np.asarray(image).astype(np.float32)/255*smooth((YY-start)/(end-start))


def curve(p,keys):
    for (a,x),(b,y) in zip(keys,keys[1:]):
        if p<=b:
            t=float(smooth((p-a)/(b-a)))
            return x+(y-x)*t
    return keys[-1][1]


def step(p,stride,lift):
    p=p%1
    if p<0.60:
        return stride*(.5-p/.60),0
    q=(p-.60)/.40
    return stride*(-.5+float(smooth(q))),-lift*math.sin(math.pi*q)


def sample(array,x,y):
    x=np.clip(x,0,SIZE-1.0001)
    y=np.clip(y,0,SIZE-1.0001)
    ix=x.astype(np.int32)
    iy=y.astype(np.int32)
    u=(x-ix)[...,None]
    v=(y-iy)[...,None]
    return (array[iy,ix]*(1-u)+array[iy,ix+1]*u)*(1-v)+(array[iy+1,ix]*(1-u)+array[iy+1,ix+1]*u)*v


def deform(texture,fx,fy):
    displacement=np.stack((fx,fy),2)
    sx=XX.copy()
    sy=YY.copy()
    for unused in range(5):
        delta=sample(displacement,sx,sy)
        sx=XX-delta[:,:,0]
        sy=YY-delta[:,:,1]
    pixels=sample(texture,sx,sy)
    alpha=pixels[:,:,3:4]
    rgb=pixels[:,:,:3]/np.maximum(alpha,.00001)
    result=np.concatenate((rgb,alpha),2)
    result=np.uint8(np.clip(result*255+.5,0,255))
    result[result[:,:,3]==0]=0
    return Image.fromarray(result)


def controls(key,p):
    tau=math.tau
    if key in ['soil-boar','vine-turtle','shadow-weasel']:
        stride={'soil-boar':24,'vine-turtle':18,'shadow-weasel':30}[key]
        lift={'soil-boar':13,'vine-turtle':10,'shadow-weasel':16}[key]
        bob={'soil-boar':3.2,'vine-turtle':1.5,'shadow-weasel':3.8}[key]*(1-math.cos(p*tau*2))/2
        poses={}
        for i in range(4):
            dx,dy=step(p+[0,.5,.5,0][i],stride,lift)
            poses['leg-'+str(i)]=[0,dx,dy-bob]
        poses['tail']=[4*math.sin(p*tau-.7),0,0]
        poses['leaves']=[2*math.sin(p*tau-.6),0,0]
        poses['head']=[.8*math.sin(p*tau*2),-1.5*math.sin(p*tau),0]
        return bob,poses
    if key=='bubble-toad':
        bob=curve(p,[(0,0),(.12,5),(.24,-2),(.46,-42),(.68,0),(.77,5),(1,0)])
        kick=curve(p,[(0,0),(.12,1),(.25,-1),(.46,.6),(.66,-.4),(.8,0),(1,0)])
        tuck=curve(p,[(0,0),(.22,0),(.40,1),(.56,.8),(.69,0),(1,0)])
        return bob,{'front-near':[0,6*tuck,-15*tuck],'front-far':[0,2*tuck,-10*tuck],'hind-near':[-4*kick,12*kick,-8*kick],'hind-far':[3*kick,8*kick,-6*kick],'sac':[0,0,1.8*math.sin(p*tau)],'head':[-1.4*kick,0,0]}
    if key=='snare-vine':
        bob=2.5*(1-math.cos(p*tau*2))/2
        dx0,dy0=step(p,22,12)
        dx1,dy1=step(p+.5,22,12)
        return bob,{'root-left':[0,dx0,dy0-bob],'root-right':[0,dx1,dy1-bob],'root-back':[0,-dx0*.45,0],'tendril-left':[3.8*math.sin(p*tau),0,0],'tendril-right':[-5*math.sin(p*tau-.8),0,0],'leaf':[2*math.sin(p*tau-.4),0,0]}
    bob=curve(p,[(0,0),(.13,5),(.25,-3),(.45,-35),(.65,0),(.76,4),(1,0)])
    tuck=curve(p,[(0,0),(.20,0),(.39,1),(.53,1),(.66,0),(1,0)])
    flap=curve(p,[(0,0),(.15,-1),(.32,1),(.48,.4),(.65,-.4),(1,0)])
    return bob,{'foot-near':[0,4*tuck,-10*tuck],'foot-far':[0,-3*tuck,-8*tuck],'wing-near':[-5*flap,0,0],'wing-far':[3*flap,0,0],'head':[1*math.sin(p*tau),0,0],'ear-left':[-2*flap,0,0],'ear-right':[2*flap,0,0]}


def definitions(key):
    if key=='soil-boar':
        return [('leg-0',[147,310],[(109,309),(178,302),(175,335),(149,372),(105,372)],312,350),('leg-1',[289,298],[(264,293),(324,289),(320,335),(280,390),(229,390),(238,353)],301,365),('leg-2',[354,302],[(321,299),(374,296),(373,333),(347,360),(316,359)],308,344),('leg-3',[406,288],[(384,281),(436,285),(445,329),(446,376),(386,376),(389,336)],294,351),('tail',[403,233],[(399,199),(448,193),(454,235),(428,251),(403,246)],190,195),('head',[247,277],[(79,164),(211,143),(264,199),(263,304),(198,327),(75,327)],0,1)]
    if key=='vine-turtle':
        return [('leg-0',[110,367],[(76,362),(137,359),(146,396),(135,430),(69,432),(61,408)],368,409),('leg-1',[275,363],[(245,353),(300,357),(317,397),(309,445),(239,451),(221,421)],368,424),('leg-2',[371,362],[(347,354),(395,356),(408,398),(399,430),(346,433),(336,405)],367,410),('leg-3',[452,358],[(426,348),(477,351),(492,394),(493,431),(426,433),(414,407)],366,416),('leaves',[265,245],[(117,129),(356,123),(435,173),(450,253),(285,272),(152,250)],0,1),('head',[226,356],[(84,294),(211,284),(242,320),(224,374),(159,397),(85,380)],0,1)]
    if key=='shadow-weasel':
        return [('leg-0',[149,369],[(122,367),(182,361),(177,398),(151,426),(106,426),(104,410)],372,411),('leg-1',[235,357],[(208,349),(265,349),(270,385),(240,430),(192,429),(190,410)],364,412),('leg-2',[290,356],[(266,353),(309,350),(319,373),(296,397),(264,393)],359,384),('leg-3',[358,340],[(334,334),(384,338),(396,371),(385,396),(341,396),(341,372)],349,383),('tail',[369,330],[(361,307),(421,316),(469,346),(478,385),(448,418),(403,424),(383,409),(422,384),(408,359)],0,1),('head',[208,365],[(73,303),(167,282),(211,300),(221,353),(199,394),(77,399),(61,370)],0,1)]
    if key=='bubble-toad':
        return [('front-near',[295,315],[(274,302),(321,301),(326,340),(311,382),(257,386),(238,375),(265,352)],315,364),('front-far',[129,327],[(103,322),(151,319),(156,350),(141,377),(92,374),(78,355)],329,357),('hind-near',[383,291],[(354,267),(429,258),(454,290),(448,337),(421,373),(351,376),(338,359),(367,335)],279,349),('hind-far',[413,290],[(401,292),(453,295),(450,342),(421,364),(394,361)],302,350),('sac',[213,264],[(88,185),(285,176),(305,249),(289,328),(239,352),(121,344),(75,283)],0,1),('head',[237,205],[(142,120),(250,114),(306,147),(312,207),(145,207)],0,1)]
    if key=='snare-vine':
        return [('root-left',[197,420],[(166,416),(216,414),(222,451),(198,463),(180,453)],423,448),('root-right',[266,422],[(238,415),(295,416),(291,459),(269,476),(242,467)],426,453),('root-back',[321,408],[(302,399),(337,402),(339,438),(318,449),(304,436)],413,435),('tendril-left',[248,317],[(139,122),(308,121),(346,149),(349,267),(284,323),(233,310),(281,256),(299,180),(235,151),(179,171),(174,254)],0,1),('tendril-right',[268,319],[(267,286),(361,256),(406,268),(409,312),(382,340),(331,343),(293,321)],0,1),('leaf',[249,315],[(109,247),(303,222),(327,296),(309,364),(233,355),(146,374),(122,330)],0,1)]
    return [('foot-near',[276,366],[(258,354),(301,358),(309,393),(287,408),(252,399),(247,379)],362,390),('foot-far',[214,366],[(189,352),(235,354),(241,389),(214,403),(186,393)],362,389),('wing-near',[310,258],[(306,238),(353,242),(398,293),(424,375),(413,423),(356,403),(325,350),(305,295)],0,1),('wing-far',[172,259],[(157,247),(188,237),(200,297),(184,345),(160,327),(151,291)],0,1),('head',[249,243],[(153,142),(223,113),(299,130),(316,215),(289,259),(193,254),(150,209)],0,1),('ear-left',[175,151],[(156,88),(190,115),(210,151),(179,178),(159,150)],0,1),('ear-right',[280,151],[(263,142),(300,100),(310,146),(289,179)],0,1)]


def main():
    key=FOLDER.name
    metadata=json.loads((FOLDER/'walk.json').read_text('utf-8'))
    duration=metadata['durationsMs']
    count=len(duration)
    original=Image.open(FOLDER/'source.png').convert('RGBA')
    pixels=np.asarray(original).astype(np.float32)/255
    pixels[:,:,:3]*=pixels[:,:,3:4]
    bones=definitions(key)
    weights={}
    (FOLDER/'Weights').mkdir(511,True,True)
    for name,pivot,points,start,end in bones:
        weight=mask(points,start,end)
        weights[name]=weight
        Image.fromarray(np.uint8(np.clip(weight*255+.5,0,255))).save(FOLDER/'Weights'/(name+'.png'))
    frames=[]
    timeline=[]
    for i in range(count):
        phase=i/count
        bob,poses=controls(key,phase)
        fx=np.zeros((SIZE,SIZE),np.float32)
        fy=np.full((SIZE,SIZE),bob,np.float32)
        for name,pivot,points,start,end in bones:
            angle,dx,dy=poses[name]
            angle=math.radians(angle)
            c=math.cos(angle)
            s=math.sin(angle)
            x,y=pivot
            weight=weights[name]
            fx+=((XX-x)*(c-1)-(YY-y)*s+dx)*weight
            fy+=((XX-x)*s+(YY-y)*(c-1)+dy)*weight
        frames.append(deform(pixels,fx,fy))
        timeline.append({'timeMs':sum(duration[:i]),'rootTranslation':[0,bob],'bones':poses})
    atlas=Image.new('RGBA',(256*8,256*math.ceil(count/8)))
    small=[]
    for i,frame in enumerate(frames):
        cell=frame.resize((256,256),Image.Resampling.LANCZOS)
        small.append(cell)
        atlas.paste(cell,((i%8)*256,(i//8)*256))
    atlas.save(FOLDER/'walk.webp','WEBP',**{'lossless':True,'method':4})
    thumbs=[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in small]
    thumbs[0].save(FOLDER/'thumb.webp','WEBP',**{'save_all':True,'append_images':thumbs[1:],'duration':duration,'loop':0,'lossless':True,'method':4,'minimize_size':False})
    small[0].save(FOLDER/'preview.webp','WEBP',**{'save_all':True,'append_images':small[1:],'duration':duration,'loop':0,'lossless':True,'method':4,'minimize_size':False})
    contact=Image.new('RGB',(1024,280),(38,48,43))
    pen=ImageDraw.Draw(contact)
    for j,i in enumerate([0,count//4,count//2,3*count//4]):
        contact.paste(small[i],(j*256,0),small[i])
        pen.text((j*256+10,258),str(i)+' / '+str(count),(240,240,230))
    contact.save(FOLDER/'contact.png')
    metadata['frameSize']=256
    if metadata['pivotX']>200:
        metadata['pivotX']*=.5
        metadata['pivotY']*=.5
    metadata['frameCount']=count
    metadata['durationMs']=sum(duration)
    write_json(FOLDER/'walk.json',metadata)
    rig={'format':'spawner-continuous-weighted-motion-v1','source':'source.png','sourceSha256':hashlib.sha256((FOLDER/'source.png').read_bytes()).hexdigest(),'canvas':[512,512],'runtimeFrameSize':256,'method':metadata['method'],'bones':[{'name':name,'parent':'root','pivot':pivot,'weightTexture':'Weights/'+name+'.png','weightPolygon':points,'blendStartY':start,'blendEndY':end} for name,pivot,points,start,end in bones],'weightMethod':'Continuous textured-surface displacement; rigid body translation and local articulated limb pivots. No cutout extraction or hidden-surface exposure.','timeline':timeline,'rootMotion':False,'airborneTrajectory':key in ['bubble-toad','talon-owl'],'perFrameFitting':False,'spineCompatibilityVerified':False}
    write_json(FOLDER/'rig.json',rig)
    print(json.dumps({'species':key,'frames':count,'frameSize':256,'durationMs':sum(duration),'sheet':list(atlas.size)}))


if __name__=='__main__':
    main()
