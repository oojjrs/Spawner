from riglib import *

BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'spring'
PARTS=OUT/'Parts'
PARTS.mkdir(511,True,True)
main=premul(Image.open(BASE/'Sources/spring/start.png'))
atlas=Image.open(BASE/'Sources/spring-parts-clean-v4.png').convert('RGBA')
cw,ch=atlas.width//4,atlas.height//2
upper=clean_matte(atlas.crop((cw,ch,2*cw,2*ch)))
upper=upper.crop(upper.getbbox()).resize((180,85),Image.Resampling.LANCZOS)
upper_canvas=Image.new('RGBA',(512,512))
upper_canvas.paste(upper,(94,275))
upper=clean_matte(upper_canvas)
upper.save(PARTS/'upper-rising-v4.png')
rgba(main).save(PARTS/'main-water-v4.png')
upper=premul(upper)
apron_mask=np.zeros((512,512),np.uint8)
cv2.fillPoly(apron_mask,[np.int32([(177,312),(248,312),(273,354),(262,367),(183,367),(169,349)])],255,cv2.LINE_AA)
apron=upper*(apron_mask.astype(np.float32)/255)[:,:,None]
basin=upper.copy()
basin[Y>=346]=0
rgba(basin).save(PARTS/'upper-basin-v4.png')
rgba(apron).save(PARTS/'waterfall-v4.png')
pool_mask=np.zeros((512,512),np.uint8)
cv2.ellipse(pool_mask,(265,382),(141,24),0,0,360,255,cv2.FILLED,cv2.LINE_AA)
pool=main*(pool_mask.astype(np.float32)/255)[:,:,None]
rgba(pool).save(PARTS/'pool-surface-v4.png')


source_points=np.array([(40,270),(256,270),(476,270),(476,460),(256,460),(40,460),(63,380),(92,345),(141,332),(167,307),(190,299),(218,312),(204,327),(256,331),(390,347),(448,382),(428,419),(350,443),(256,448),(128,437),(75,411),(256,382),(128,382),(390,382)],np.float32)
end_points=source_points.copy()
for i,point in enumerate(source_points):
    if i<6:
        continue
    height=float(np.clip((390-point[1])/91,0,1))
    left=float(np.clip((250-point[0])/45,0,1))
    end_points[i,0]=256+(point[0]-256)*1.075-75*height*left
    end_points[i,1]=point[1]+34*height*left


def main_surface(index):
    fill=smooth(index/38)
    points=source_points+(end_points-source_points)*fill
    return water_surface(main,source_points,points)


def frame_at(index):
    rise=smooth((index-16)/30)
    spill=smooth((index-32)/20)
    offset=(0,90*(1-rise))
    raised=affine(basin,(184,345),(1,1),0,offset)
    raised*=np.clip((380-Y)/8,0,1)[:,:,None]
    value=over(main_surface(index),raised)
    if rise>0:
        falling=affine(apron,(184,345),(1,1),0,offset)
        falling*=np.clip((330+35*spill-Y)/3,0,1)[:,:,None]
        value=over(falling,value)
    if 5<index<52:
        ripple=math.sin(math.pi*(index-5)/47)**2
        q=(index-5)/47
        surface=affine(pool,(265,382),(.76+.24*q,.76+.24*q),0,(0,-1.5*ripple))
        value=over(surface*(.18*ripple),value)
    return rgba(value)


frames=[frame_at(i) for i in range(61)]
rig={'canvas':[512,512],'root':[256,448],'motion':'water-fill-upper-spring-rise-overflow','phaseKeys':[0,5,16,32,46,52,60],'drawOrder':['upper-basin','main-water','waterfall','pool-ripple'],'parts':{'main-water':{'source':'Parts/main-water-v4.png','pivot':[256,448],'deformation':'continuous-water-surface','sourceControls':source_points.tolist(),'targetControls':end_points.tolist(),'frames':[0,38]},'upper-basin':{'source':'Parts/upper-basin-v4.png','pivot':[184,345],'parent':'root','offsetY':[90,0],'frames':[16,46],'occlusion':'behind-main-water'},'waterfall':{'source':'Parts/waterfall-v4.png','parent':'upper-basin','revealY':[330,365],'frames':[32,52]},'pool-ripple':{'source':'Parts/pool-surface-v4.png','pivot':[265,382],'frames':[5,52]}}}
json_write(OUT/'rig.json',rig)
markers={'fillStart':500,'upperRise':1140,'overflow':1780,'settled':2540}
export(frames,OUT,{'source':'Parts','method':'layered-water-fill-rising-basin-overflow','phaseMarkers':markers})
