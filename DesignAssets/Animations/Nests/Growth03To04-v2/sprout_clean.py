import sys
from PIL import WebPImagePlugin
from riglib import *
from prefab import Prefab,ArmRig
from assembly import center_of
import sprout_basis as f
old=f.old;new=f.new;ROOT=old.ROOT
KEYS=[0,12,24,32,40,48,54,60,72,84,88,100]
old_arms=[];new_arms=[]
for side in range(2):
    old_arms.append(ArmRig('old-arm-'+str(side),[137,361] if side==0 else [384,361],[102,309] if side==0 else [420,309],[153,198] if side==0 else [367,198],old.layers[8+side],old.arm_parts[side][0],old.arm_parts[side][1]))
    new_arms.append(ArmRig('new-arm-'+str(side),[155,321] if side==0 else [359,321],[131,268] if side==0 else [383,268],[170,158] if side==0 else [344,158],new.layers[8+side],new.arm_parts[side][0],new.arm_parts[side][1]))

def target_for(parts,arms,side,p):return parts[side].positions(p)[24]+arms[side].tip-parts[side].vertices[24]

def support(p,frame):
    value=over(new.layers[10],new.layers[12])
    for side in range(2):
        lower,body,slider=new_arms[side].render(target_for(new.rear_petals,new_arms,side,p),frame)
        value=over(slider,value);value=over(body,value);value=over(lower,value)
    return value

closed_support=support(1,60)
foundation=Prefab('foundation',new.layers[0],(257,448),(257,371),32,52,1)
canopy=Prefab('canopy',new.layers[11],(257,300),(257,371),37,59,-1)
frame_rig=Prefab('support-frame',closed_support,(257,320),(257,285),44,60,-1)
finished_foreground=over(closed_support,over(new.flower(1),new.layers[0]))
old_closed_targets=[target_for(old.rear_petals,old_arms,side,1) for side in range(2)]
retire=[]
for side in range(2):
    choices=[]
    for x in range(220,331,10):
        for y in range(270,381,10):
            parts=old_arms[side].render((x,y),60);all_parts=over(parts[0],over(parts[1],parts[2]));leak=float((all_parts[:,:,3]*np.clip(1-finished_foreground[:,:,3],0,1)).sum());choices.append((leak,x,y))
    leak,x,y=min(choices);retire.append(np.array([x,y],float));print('retired arm',side,'remaining alpha',round(leak,3))
for arm in old_arms+new_arms:arm.keys=[]

leaves=[]
for name,part,pivot,previous,unused in f.old_leaves:
    sign=1 if center_of(part)[0]<260 else -1;choices=[]
    for angle in [0,5,10,15,20,30,40,50,65,80]:
        posed=rigid(part,pivot,angle*sign,(0,0));leak=float((posed[:,:,3]*np.clip(1-finished_foreground[:,:,3],0,1)).sum());choices.append((leak,angle))
    passing=[v for v in choices if v[0]<.1];leak,angle=sorted([(v[1],v[0]) for v in passing])[0][::-1] if passing else min(choices);leaves.append((name,part,pivot,angle*sign))

def flower(frame):
    close=float(np.clip(frame/24,0,1));growth=float(np.clip((frame-44)/16,0,1));q=ease(growth)
    if frame<=44:return f.old_flower(close)
    if frame>=60:return new.flower(float(np.clip(1-(frame-60)/28,0,1)))
    value=np.zeros_like(old.old)
    for mesh in f.bridge_rear:value=over(mesh.render(growth),value)
    core=shift(old.layers[3],(-4*q,24-56*q)) if growth<.5 else shift(new.layers[3],(0,20));value=over(core,value)
    for mesh in f.bridge_front:value=over(mesh.render(growth),value)
    return value

def render(frame):
    close=float(np.clip(frame/24,0,1));growth=ease((frame-44)/16);retired=ease((frame-44)/14)
    value=canopy.render(frame)
    legacy=over(rigid(f.gadget,(76,299),f.gadget_angle*growth,(0,0)),shift(f.old_rim,(-4*growth,-56*growth)))
    legacy=over(f.old_shadow*(1-ease(close)),legacy)
    for name,part,pivot,angle in leaves:legacy=over(rigid(part,pivot,angle*growth,(0,0)),legacy)
    for side in range(2):
        target=target_for(old.rear_petals,old_arms,side,close)*(1-retired)+retire[side]*retired
        lower,barrel,slider=old_arms[side].render(target,frame);legacy=over(slider,legacy);legacy=over(barrel,legacy);legacy=over(lower,legacy)
    value=over(legacy,value);value=over(foundation.render(frame),value)
    if frame<60:value=over(frame_rig.render(frame),value)
    value=over(flower(frame),value)
    if frame>=60:value=over(support(float(np.clip(1-(frame-60)/28,0,1)),frame),value)
    if frame==0:value=old.old.copy()
    return value

def export(draft):
    indexes=KEYS if draft else list(range(101));frames=[];board=Image.new('RGBA',(2304,768),'#182923')
    for frame in indexes:
        image=rgba(render(frame));frames.append(image)
        if frame in KEYS:
            k=KEYS.index(frame);board.alpha_composite(image.resize((384,384),Image.Resampling.LANCZOS),((k%6)*384,(k//6)*384));image.save(ROOT/('clean-pose-'+str(frame)+'.png'))
            if frame==100:image.save(ROOT/'render-end.png')
    board.convert('RGB').save(ROOT/'clean-keyframes.png')
    for node in [foundation,canopy,frame_rig]:rgba(node.source).save(ROOT/'Parts'/(node.name+'.png'))
    for arm in old_arms+new_arms:
        for i,part in enumerate(arm.sources):rgba(part).save(ROOT/'Parts'/(arm.name+'-'+str(i)+'.png'))
    save_json(ROOT/'rig.json',{'root':[256,448],'frameSize':[512,512],'prefabs':[node.data() for node in [foundation,canopy,frame_rig]],'arms':[arm.data() for arm in old_arms+new_arms],'weightedParts':{mesh.name:mesh.data() for mesh in old.petals+old.rear_petals+f.bridge_front+f.bridge_rear+new.front_petals+new.rear_petals},'keys':KEYS})
    if draft:print('clean key poses exported');return
    durations=[600]+[40]*99+[1000];sheet=Image.new('RGBA',(4096,6656))
    for i,image in enumerate(frames):sheet.alpha_composite(image,((i%8)*512,(i//8)*512))
    sheet.save(ROOT/'growth.png');frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'lossless':True,'loop':1,'method':4}
    with (ROOT/'growth.webp').open('wb') as out:WebPImagePlugin._save_all(frames[0],out,'')
    small=[im.resize((384,384),Image.Resampling.LANCZOS) for im in frames];small[0].encoderinfo={'append_images':small[1:],'duration':durations,'lossless':True,'loop':0,'method':4}
    with (ROOT/'preview.webp').open('wb') as out:WebPImagePlugin._save_all(small[0],out,'')
    save_json(ROOT/'animation.json',{'frameSize':[512,512],'frameCount':101,'columns':8,'rows':13,'durationsMs':durations,'root':[256,448],'loop':False,'previewRepeats':True,'sources':{'start':'start.png','end':'end.png','parts':'Parts','rig':'rig.json'}})
    print('sprout clean animation exported')

if __name__=='__main__':export('--draft' in sys.argv)
