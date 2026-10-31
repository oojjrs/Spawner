from production import *
from prefab import Prefab
ROOT=Path(__file__).parent/'spring';(ROOT/'Parts').mkdir(511,False,True)
old=read(ROOT/'start.png');new=read(ROOT/'reference-end.png');parts=components(ROOT/'part-source.png',2);keys_art=components(ROOT/'key-source.png',2);controls=components(ROOT/'control-source.png',1)

def normalized(im,width,height,bottom):
    scale=min(width/im.shape[1],height/im.shape[0]);w=round(im.shape[1]*scale);h=round(im.shape[0]*scale);out=np.zeros((512,512,4),np.float32);out[bottom-h:bottom,round(256-w/2):round(256-w/2)+w]=cv2.resize(im,(w,h),None,0,0,cv2.INTER_LANCZOS4);return out

def ellipse(cx,cy,rx,ry):return ((X-cx)/rx)**2+((Y-cy)/ry)**2<1

def prepare(source,level):
    pixels=np.array(rgba(source));hsv=cv2.cvtColor(pixels[:,:,:3],cv2.COLOR_RGB2HSV);alpha=source[:,:,3]>.5;cyan=((hsv[:,:,0]>72)&(hsv[:,:,0]<111)&(hsv[:,:,1]>30))|((pixels[:,:,0]>180)&(pixels[:,:,1]>210)&(pixels[:,:,2]>210))
    if level==0:
        top=ellipse(185,242,62,14);pool=ellipse(284,366,151,35)
        main=polygon([(193,248),(256,248),(271,279),(270,293),(286,293),(303,328),(281,340),(259,333),(249,309),(232,298),(215,279)])
        side=polygon([(134,263),(158,266),(169,293),(176,316),(185,335),(161,347),(145,333),(140,307),(135,283)])
        wheel_roi=(X>67)&(X<177)&(Y>249)&(Y<341);valve_roi=(X>337)&(X<380)&(Y>240)&(Y<296);pivot=(96,309);vp=(345,280)
        upper=fitted(parts[0],(43,205,302,138));lower=fitted(parts[2],(28,315,456,133));dry=normalized(keys_art[1],456,300,448)
    else:
        top=ellipse(224,148,73,17);pool=ellipse(280,355,159,40)
        main=polygon([(212,164),(252,163),(266,194),(279,230),(285,262),(309,274),(323,303),(308,321),(287,317),(273,294),(259,285),(248,258),(243,219),(232,188)])
        side=polygon([(137,208),(155,210),(171,234),(179,266),(187,291),(171,308),(158,299),(154,274),(149,244)])
        wheel_roi=(X>65)&(X<211)&(Y>188)&(Y<306);valve_roi=ellipse(435,261,26,28);pivot=(91,271);vp=(435,261)
        upper=fitted(parts[3],(79,115,278,211));lower=fitted(parts[5],(16,302,481,146));dry=normalized(keys_art[3],480,400,448)
    flows=[dilate(main&cyan,1)&alpha,dilate(side&cyan,1)&alpha];liquids=[top&alpha,pool&alpha]+flows
    warm=(hsv[:,:,0]>8)&(hsv[:,:,0]<44)&(hsv[:,:,1]>70)&(hsv[:,:,2]>40)
    wheel_mask=dilate(wheel_roi&warm,2)&alpha;valve_mask=valve_roi&alpha
    wheel=source*wheel_mask[:,:,None];valve=fitted(controls[level],(337,243,42,51) if level==0 else (413,233,44,55));fluid=np.logical_or.reduce(liquids)
    architecture=source*(~(fluid|wheel_mask|valve_mask))[:,:,None]
    helper=over(upper,lower);helper=over(dry*fluid[:,:,None],helper*(~fluid)[:,:,None]);fill=(fluid|wheel_mask)&alpha;architecture=over(architecture,helper*fill[:,:,None])
    p=np.array(rgba(architecture));missing=valve_mask&alpha
    rgb=cv2.inpaint(p[:,:,:3],np.uint8(missing)*255,4,cv2.INPAINT_TELEA).astype(np.float32)/255;filled_alpha=architecture[:,:,3].copy();interior=missing&(((Y>276)&(X<353)) if level==0 else ((Y>263)&(X<450)));filled_alpha[interior]=1
    if level==0:
        sample=np.array(rgba(source))[282:303,310:335,:3];patch=cv2.resize(sample,(44,28),None,0,0,cv2.INTER_LANCZOS4).astype(np.float32)/255;yy,xx=np.where(interior);rgb[yy,xx]=patch[np.clip(yy-276,0,27),np.clip(xx-337,0,43)];filled_alpha[missing&~interior]=0
    if level==1:
        yy,xx=np.where(missing&(Y>263)&(X<450));sample=np.array(rgba(source))[275:296,402:420,:3];patch=cv2.resize(sample,(48,34),None,0,0,cv2.INTER_LANCZOS4).astype(np.float32)/255;good=(xx>=403)&(xx<451)&(yy>=264)&(yy<298);rgb[yy[good],xx[good]]=patch[yy[good]-264,xx[good]-403];filled_alpha[missing&~((Y>263)&(X<450))]=0
    architecture=np.concatenate([rgb*filled_alpha[:,:,None],filled_alpha[:,:,None]],2)
    return architecture,wheel,valve,liquids,pivot,vp

body3,wheel3,valve3,water3,pivot3,vp3=prepare(old,0);body4,wheel4,valve4,water4,pivot4,vp4=prepare(new,1)
base_mask=Y>326;body4_low=body4*base_mask[:,:,None];body4_upper=body4*(~base_mask)[:,:,None]
base=Prefab('marble-basin',body4_low,(256,448),(256,448),32,60,1);tower=Prefab('aqueduct-housing',body4_upper,(256,448),(256,448),32,60,1);wheel_node=Prefab('bronze-waterwheel',wheel4,(91,271),(116,307),44,60,-1);valve_node=Prefab('pressure-valve',valve4,(435,261),(375,290),44,60,1)
nodes=[base,tower,wheel_node,valve_node];rigid_keys=[];water_keys=[]

def fluid_layers(source,masks,amount,frame,level):
    result=np.zeros_like(source);pool_fill=1 if level==0 else ease((frame-71)/17);top_fill=1 if level==0 else ease((frame-61)/6)
    for i,mask in enumerate(masks):
        wet=source*mask[:,:,None]
        if i>=2:
            yy=np.where(mask)[0];top,bottom=float(yy.min()),float(yy.max());running=amount;head=top+(bottom-top)*(1-running);tail=top+(bottom-top)*running;wet*= ((Y>=head) if level==0 else (Y<=tail))[:,:,None]
        elif i==0:wet*=top_fill
        else:wet*=pool_fill
        result=over(wet,result)
    water_keys.append({'frame':frame,'level':level+3,'flow':amount,'poolFill':pool_fill,'topFill':top_fill,'parent':'root'})
    return result

def projected_spin(source,pivot,angle,ratio):
    camera=np.diag([ratio,1,1]);m=matrix(pivot,0)@camera@matrix((0,0),angle)@np.linalg.inv(camera)@matrix((-pivot[0],-pivot[1]),0);return affine(source,m)

def render(frame):
    close=ease(frame/24);q=ease((frame-44)/16);opening=ease((frame-60)/28)
    upper_move=(45*q,-60*q);upper_mask=(Y<334)&(X<380)&~((X>322)&(Y>317));value=over(shift(body3*upper_mask[:,:,None],upper_move),body3*(~upper_mask)[:,:,None]);old_liquid=fluid_layers(old,water3,1-close,frame,0);value=over(shift(old_liquid*upper_mask[:,:,None],upper_move),over(old_liquid*(~upper_mask)[:,:,None],value))
    angle3=2*math.sin(math.pi*close);value=over(rigid(wheel3,pivot3,angle3,upper_move),value);value=over(rigid(valve3,vp3,-48*close,upper_move),value)
    value=over(base.render(frame),value);value=over(tower.render(frame),value)
    if frame>=60:value=over(fluid_layers(new,water4,opening,frame,1),value)
    angle4=3*math.sin(math.pi*opening)
    value=over(wheel_node.render(frame) if frame<60 else rigid(wheel4,pivot4,angle4,(0,0)),value);value=over(valve_node.render(frame) if frame<60 else projected_spin(valve4,vp4,-55*(1-opening),.9),value)
    rigid_keys.append({'frame':frame,'wheel3':{'parent':'root','pivot':pivot3,'angle':angle3,'scale':[1,1]},'valve3':{'parent':'root','pivot':vp3,'angle':-48*close,'scale':[1,1]},'wheel4':{'parent':'root','pivot':pivot4,'angle':angle4,'scale':[1,1]},'valve4':{'parent':'root','pivot':vp4,'angle':-55*(1-opening),'scale':[1,1]}})
    if frame==0:return old.copy()
    return value

def rig_data():
    for name,source in [('dry3',body3),('dry4',body4),('wheel3',wheel3),('wheel4',wheel4),('valve3',valve3),('valve4',valve4)]+[(node.name,node.source) for node in nodes]:rgba(source).save(ROOT/'Parts'/(name+'.png'))
    for level,source,masks in [(3,old,water3),(4,new,water4)]:
        for i,mask in enumerate(masks):rgba(source*mask[:,:,None]).save(ROOT/'Parts'/('water'+str(level)+'-'+str(i)+'.png'))
    return {'root':[256,448],'prefabs':[node.data() for node in nodes],'rigidKeys':rigid_keys,'hydraulicKeys':water_keys,'keys':KEYS}

if __name__=='__main__':export_sequence(ROOT,render,rig_data,'--draft' in sys.argv)
