from production import *
from prefab import Prefab
ROOT=Path(__file__).parent/'pebble';(ROOT/'Parts').mkdir(511,False,True)
old=read(ROOT/'start.png');new=read(ROOT/'reference-end.png');art=components(ROOT/'part-source.png',3);key_canvas=read(ROOT/'key-source.png');hh,ww=key_canvas.shape[:2];poses=[]
for row in range(2):
    for col in range(2):
        im=key_canvas[row*hh//2:(row+1)*hh//2,col*ww//2:(col+1)*ww//2];nn,ll,ss,cc=cv2.connectedComponentsWithStats(np.uint8(im[:,:,3]>.2),8);index=1+int(np.argmax(ss[1:,4]));x,y,w,h,area=ss[index];poses.append(im[y:y+h,x:x+w])

def normalized(im,width,height,bottom):
    scale=min(width/im.shape[1],height/im.shape[0]);w=round(im.shape[1]*scale);h=round(im.shape[0]*scale);out=np.zeros((512,512,4),np.float32);out[bottom-h:bottom,round(256-w/2):round(256-w/2)+w]=cv2.resize(im,(w,h),None,0,0,cv2.INTER_LANCZOS4);return out

closed_key3=normalized(poses[0],456,360,448);closed_key4=normalized(poses[2],480,400,448)
beam_mask=bezier((172,282),[((159,279),(155,287),(156,303)),((153,319),(162,328),(176,328)),((209,332),(284,331),(314,328)),((334,331),(338,316),(333,300)),((336,285),(328,279),(314,282)),((269,279),(214,278),(172,282))])
beam=old*beam_mask[:,:,None];lintel=fitted(art[8],(151,274,190,64));wall=over(old*(~beam_mask)[:,:,None],lintel*beam_mask[:,:,None])
weight_mask=bezier((430,327),[((429,312),(439,301),(453,302)),((469,300),(479,313),(480,329)),((482,334),(483,340),(480,345)),((478,362),(469,368),(451,367)),((435,369),(428,358),(428,341)),((426,335),(426,332),(430,327))]);weight=old*weight_mask[:,:,None]
clear_weight=dilate(weight_mask,4);wall=over(wall*(~clear_weight)[:,:,None],fitted(art[2],(324,301,150,78))*clear_weight[:,:,None]);rope_mask=(X>443)&(X<457)&(Y>241)&(Y<310);wall*=~rope_mask[:,:,None]
portal3=polygon([(171,320),(328,320),(328,365),(316,435),(180,435),(170,372)])
panel3=closed_key3*((X>=175)&(X<=321)&(Y>=279)&(Y<=397))[:,:,None]
col_l=polygon([(89,225),(154,225),(159,273),(170,355),(185,381),(180,432),(65,432),(62,397),(87,355),(101,274)])
col_r=polygon([(369,225),(432,225),(422,273),(442,355),(486,384),(494,431),(333,432),(331,385),(355,354),(371,273)])
steps=polygon([(138,381),(380,381),(379,407),(407,411),(407,447),(104,447),(104,411),(136,404)])
gear_masks=[((X-188)**2+(Y-175)**2<29**2),((X-335)**2+(Y-175)**2<29**2)]
owner=np.zeros((512,512),np.uint8);owner[col_l]=1;owner[col_r]=2;owner[steps]=3
for i,mask in enumerate(gear_masks):owner[mask]=4+i
native=[new*(owner==i)[:,:,None] for i in range(6)]
left_full=over(native[1],fitted(art[3],(64,224,124,209))*(new[:,:,3]>.98)[:,:,None]);right_full=over(native[2],fitted(art[5],(330,224,164,209))*(new[:,:,3]>.98)[:,:,None])
arch_helper=fitted(art[4],(145,237,215,163));crown_l=fitted(art[0],(106,141,171,107));crown_r=fitted(art[1],(262,136,162,111));rear=over(crown_l,crown_r);rear=over(arch_helper,rear);rear=over(native[0],rear*(new[:,:,3]>.98)[:,:,None])
step_full=native[3]
base=Prefab('steps',step_full,(256,448),(256,408),32,51,1);arch=Prefab('arch-and-wall',rear,(257,400),(257,424),36,57,-1);left=Prefab('left-pilaster',left_full,(121,427),(191,427),42,60,-1);right=Prefab('right-pilaster',right_full,(414,427),(331,427),42,60,1)
gear_sources=[fitted(art[6],(162,149,52,52)),fitted(art[7],(309,149,52,52))];gear_nodes=[Prefab('left-gear',gear_sources[0],(188,175),(188,204),45,60,1),Prefab('right-gear',gear_sources[1],(335,175),(335,204),45,60,-1)]
portal4=bezier((257,253),[((303,253),(341,286),(346,326)),((350,346),(350,370),(346,390)),((304,397),(215,397),(173,389)),((170,368),(169,348),(174,326)),((177,284),(214,253),(257,253))])
gate4=closed_key4*portal4[:,:,None];gate_node=Prefab('marble-gate',gate4,(257,390),(257,434),36,59,1)
nodes=[base,arch,left,right,gate_node]+gear_nodes;keys=[]
rope_sample=np.array(rgba(old))[255:280,447:454]

def rope(end):
    top=242;bottom=round(end);out=np.zeros_like(old)
    if bottom<=top:return out
    tile=np.tile(rope_sample,(int(np.ceil((bottom-top)/len(rope_sample))),1,1))[:bottom-top];array=tile.astype(np.float32)/255;array[:,:,:3]*=array[:,:,3:4];out[top:bottom,447:454]=array;return out

def render(frame):
    close=ease(frame/24);opening=ease((frame-60)/28);dy=112*close;weight_y=-56*close
    value=wall.copy();value=over(shift(panel3,(0,dy-112))*portal3[:,:,None],value);value=over(shift(beam,(0,dy)),value);value=over(rope(303+weight_y),value);value=over(shift(weight,(0,weight_y)),value)
    value=over(arch.render(frame),value)
    gate=gate_node.render(frame) if frame<60 else shift(gate4,(0,-146*opening));value=over(gate*portal4[:,:,None],value)
    for node in [left,right,base]:value=over(node.render(frame),value)
    for i,node in enumerate(gear_nodes):
        gear=node.render(frame) if frame<60 else rigid(gear_sources[i],(188,175) if i==0 else (335,175),(1 if i==0 else -1)*32*(1-opening),(0,0));value=over(gear,value)
    keys.append({'frame':frame,'oldGate':{'translation':[0,dy],'parent':'root','scale':[1,1]},'counterweight':{'translation':[0,weight_y],'ratio':-.5,'parent':'root','scale':[1,1]},'gate4':{'translation':[0,-146*opening],'parent':'root','scale':[1,1]},'gearDegrees':[32*(1-opening),-32*(1-opening)]})
    if frame==0:return old.copy()
    return value

def rig_data():
    for name,source in [('wall3',wall),('beam3',beam),('panel3',panel3),('counterweight3',weight)]+[(node.name,node.source) for node in nodes]:rgba(source).save(ROOT/'Parts'/(name+'.png'))
    return {'root':[256,448],'prefabs':[node.data() for node in nodes],'rigidKeys':keys,'portal3':np.argwhere(portal3).tolist()[::256],'portal4':np.argwhere(portal4).tolist()[::256],'keys':KEYS}

if __name__=='__main__':export_sequence(ROOT,render,rig_data,'--draft' in sys.argv)
