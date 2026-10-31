from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, _webp
import numpy as np
import math
import json
import hashlib
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent
SIZE = 512
STEP = 8
KEYS = ['flower-tail-bird', 'dew-rabbit', 'soil-mole', 'bundle-snail', 'cotton-sheep', 'rolling-acorn']
OUTPUT_SIZE = {'flower-tail-bird':388,'dew-rabbit':417,'soil-mole':355,'bundle-snail':398,'cotton-sheep':256,'rolling-acorn':420}
IDLE_SOURCES = {
 'flower-tail-bird':['CreatureIdleV3/flower-tail-bird/idle.webp',4],
 'dew-rabbit':['CreatureIdleV3/dew-rabbit/idle.webp',4],
 'soil-mole':['CreatureIdleV3/soil-mole/idle.webp',4],
 'bundle-snail':['CreatureIdleV4/bundle-snail/idle.webp',4],
 'cotton-sheep':['CottonSheepIdle/CalmV5/idle-runtime.webp',8],
 'rolling-acorn':['RollingAcornIdle/v1/idle.webp',4]
}
CONFIG = {
 'flower-tail-bird': {'period': 800, 'pivot': [256, 448], 'method': 'Continuous original-art mesh with a shoulder wing joint, feather follow-through, folded feet and an intentional low flight trajectory.', 'regions': [
  ['wing', [(204,251),(238,236),(297,245),(366,291),(395,352),(320,373),(268,343),(228,315)], [229,262], 13],
  ['tail', [(324,243),(343,176),(437,163),(449,276),(401,338),(354,324)], [328,292], 14],
  ['feet', [(137,373),(302,370),(306,430),(138,426)], [224,377], 8]]},
 'dew-rabbit': {'period': 1000, 'pivot': [256,448], 'method': 'Continuous original-art mesh with articulated forepaws, hindquarter push-off, two ear chains and an intentional hop with planted contact phases.', 'regions': [
  ['fore-near', [(227,330),(282,325),(292,430),(228,439),(210,408)], [259,343], 13],
  ['fore-far', [(174,333),(216,339),(226,421),(170,425)], [195,349], 10],
  ['hind', [(309,311),(382,306),(405,403),(366,440),(299,435)], [355,339], 17],
  ['ear-near', [(316,238),(314,166),(331,106),(381,81),(413,85),(427,121),(411,181),(372,237)], [330,229], 13],
  ['ear-far', [(235,224),(200,201),(161,190),(140,162),(147,128),(179,116),(221,129),(248,173)], [240,214], 12]]},
 'soil-mole': {'period': 1120, 'pivot':[256,448], 'method':'Continuous original-art mesh with alternating rigid forepaw strokes, local elbow blending and hindpaw recovery; body retains its original volume.', 'regions':[
  ['paw-near', [(276,286),(307,265),(358,277),(391,322),(382,368),(335,398),(285,391),(266,353)], [325,288], 13],
  ['paw-far', [(109,278),(150,270),(187,302),(183,348),(132,369),(76,369),(69,330)], [143,294], 12],
  ['rear', [(425,289),(455,284),(479,310),(474,341),(432,345)], [449,300], 10],
  ['head', [(127,166),(173,150),(248,173),(286,246),(264,299),(203,315),(123,277),(105,234)], [231,259], 18]]},
 'bundle-snail': {'period': 1600, 'pivot':[256,448], 'method':'Continuous original-art mesh with a travelling muscular foot wave, head extension and eyestalk follow-through; shell and load move as a rigid mass.', 'regions':[
  ['head', [(103,279),(91,225),(139,204),(191,214),(216,279),(226,334),(199,374),(143,378),(104,340)], [202,346], 16],
  ['eye-left', [(69,207),(105,195),(134,212),(150,280),(127,298),(98,253)], [133,284], 10],
  ['eye-right', [(166,207),(191,207),(208,232),(214,294),(188,306),(182,255)], [203,292], 10]]},
 'cotton-sheep': {'period': 1120, 'pivot':[256,448], 'method':'Continuous original-art mesh with four alternating hip/shoulder leg joints, planted stance and raised recovery arcs; head and fleece retain their original proportions.', 'regions':[
  ['fore-near', [(239,346),(282,346),(287,419),(277,438),(237,433),(228,404)], [260,350], 11],
  ['fore-far', [(176,337),(216,342),(220,404),(200,420),(172,415),(169,392)], [196,345], 9],
  ['hind-near', [(365,325),(401,326),(420,383),(410,409),(371,405),(360,379)], [383,337], 12],
  ['hind-far', [(312,331),(344,332),(345,377),(325,395),(302,388)], [325,341], 9],
  ['ear', [(268,233),(281,228),(311,238),(332,263),(321,280),(292,275),(269,254)], [272,240], 8]]},
 'rolling-acorn': {'period': 1280, 'pivot':[256,426], 'method':'Rigid full shell roll around its center with a separately weighted flexible stem/leaf, fixed output scale and intentional airborne clearance for the leaf.', 'regions':[
  ['stem', [(279,197),(293,111),(307,100),(325,114),(320,171),(336,191)], [298,194], 9],
  ['leaf', [(319,148),(343,105),(394,88),(435,103),(458,139),(468,195),(454,212),(398,190),(356,177)], [324,145], 12]]}
}

def write_json(path,value):
 encoder=json.JSONEncoder()
 encoder.indent=2
 encoder.ensure_ascii=False
 path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def webp(path,picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,pictures,durations):
 encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False)
 timestamp=0
 for picture,duration in zip(pictures,durations):
  encoder.add(picture.getim(),timestamp,True,100.0,100.0,3)
  timestamp+=duration
 encoder.add(None,timestamp,True,100.0,100.0,0)
 path.write_bytes(encoder.assemble('','',''))

def smooth(value):
 value=np.clip(value,0,1)
 return value*value*(3-2*value)

def rotation(pivot,degrees,shift):
 angle=math.radians(degrees)
 c,s=math.cos(angle),math.sin(angle)
 x,y=pivot
 return np.array([[c,-s,x-c*x+s*y+shift[0]],[s,c,y-s*x-c*y+shift[1]],[0,0,1]],float)

def pose(key,fraction):
 p=fraction*2*math.pi
 c=CONFIG[key]
 values={region[0]:[0,[0,0]] for region in c['regions']}
 root=[0,[0,0]]
 if key=='flower-tail-bird':
  root=[0,[0,-13-5*math.sin(p-0.6)]]
  values['wing']=[17*math.sin(p),[0,0]]
  values['tail']=[5*math.sin(p-0.8),[0,0]]
  values['feet']=[-12,[0,-8]]
 elif key=='dew-rabbit':
  f=(fraction-0.12)/0.67
  airborne=math.sin(math.pi*np.clip(f,0,1))
  root=[-3*math.sin(p),[0,-26*airborne]]
  values['fore-near']=[-12*math.sin(p-0.5),[6*math.sin(p),-10*airborne]]
  values['fore-far']=[-9*math.sin(p-0.25),[4*math.sin(p),-8*airborne]]
  values['hind']=[14*math.sin(p+0.7),[-7*math.sin(p),-5*airborne]]
  values['ear-near']=[8*math.sin(p-0.75),[0,0]]
  values['ear-far']=[6*math.sin(p-1.05),[0,0]]
 elif key=='soil-mole':
  root=[0,[0,-1.5*(1-math.cos(2*p))]]
  values['paw-near']=[10*math.sin(p),[-12*math.sin(p),-6*max(0,-math.cos(p))]]
  values['paw-far']=[-10*math.sin(p),[12*math.sin(p),-6*max(0,math.cos(p))]]
  values['rear']=[-8*math.sin(p),[5*math.sin(p),-4*max(0,-math.cos(p))]]
  values['head']=[1.2*math.sin(p-0.7),[0,-1.5*math.sin(p)]]
 elif key=='bundle-snail':
  root=[0,[0,0]]
  values['head']=[0,[-7*math.sin(p),-1.5*math.cos(p)]]
  values['eye-left']=[3*math.sin(p-0.7),[0,0]]
  values['eye-right']=[3*math.sin(p-0.85),[0,0]]
 elif key=='cotton-sheep':
  root=[0,[0,-1.2*(1-math.cos(2*p))]]
  for name,phase in [('fore-near',0),('fore-far',math.pi),('hind-near',math.pi),('hind-far',0)]:
   phase+=p
   values[name]=[9*math.sin(phase),[5*math.sin(phase),-8*max(0,math.cos(phase))]]
  values['ear']=[3*math.sin(p-0.9),[0,0]]
 elif key=='rolling-acorn':
  root=[fraction*360,[0,-18-4*math.sin(2*p)]]
  values['stem']=[-10*math.sin(p-0.6),[0,0]]
  values['leaf']=[-17*math.sin(p-1.1),[0,0]]
 return root,values

def prepare(key):
 folder=BASE/key
 folder.mkdir(511,True,True)
 if (folder/'source.png').exists() and (folder/'rig.json').exists() and (folder/'mesh.json').exists():
  return Image.open(folder/'source.png').convert('RGBA'),json.loads((folder/'mesh.json').read_bytes()),json.loads((folder/'rig.json').read_bytes())
 idle_path,idle_columns=IDLE_SOURCES[key]
 idle_atlas=Image.open(ROOT/'DesignAssets/Animations'/idle_path).convert('RGBA')
 idle_size=idle_atlas.width//idle_columns
 source=idle_atlas.crop((0,0,idle_size,idle_size)).resize((SIZE,SIZE),Image.Resampling.LANCZOS)
 pixels=np.array(source)
 pixels[pixels[:,:,3]<8]=0
 source=Image.fromarray(pixels)
 source.save(folder/'source.png')
 c=CONFIG[key]
 yy,xx=np.mgrid[0:SIZE+1:STEP,0:SIZE+1:STEP]
 vertices=np.stack((xx,yy),2).reshape((-1,2)).astype(float)
 weights=[]
 for name,polygon,pivot,blur in c['regions']:
  mask=Image.new('L',(SIZE+1,SIZE+1),0)
  ImageDraw.Draw(mask).polygon(polygon,255)
  mask=mask.filter(ImageFilter.GaussianBlur(blur))
  weights.append(np.asarray(mask).astype(float)[yy,xx]/255)
 weights=np.stack(weights,2)
 total=weights.sum(2)
 weights/=np.maximum(1,total)[:,:,None]
 weights=np.concatenate((np.maximum(0,1-weights.sum(2))[:,:,None],weights),2)
 triangles=[]
 count=SIZE//STEP+1
 for row in range(count-1):
  for col in range(count-1):
   i=row*count+col
   triangles.extend([[i,i+1,i+count],[i+1,i+count+1,i+count]])
 mesh={'canvas':[SIZE,SIZE],'step':STEP,'columns':count,'vertices':vertices.tolist(),'triangles':triangles,'weights':np.round(weights.reshape((-1,weights.shape[2])),6).tolist()}
 write_json(folder/'mesh.json',mesh)
 timeline=[]
 for i in range(25):
  root,bones=pose(key,i/24)
  timeline.append({'timeMs':round(i*c['period']/24),'root':root,'bones':bones})
 rig={'format':'spawner-continuous-weighted-mesh-v1','source':'source.png','mesh':'mesh.json','reference':'DesignAssets/Animations/'+idle_path,'referenceSha256':hashlib.sha256((ROOT/'DesignAssets/Animations'/idle_path).read_bytes()).hexdigest(),'referenceFrame':0,'referenceCellSize':idle_size,'method':c['method'],'canvas':[SIZE,SIZE],'pivot':c['pivot'],'periodMs':c['period'],'rootMotion':False,'rootTrajectory': 'Intentional vertical hop/flight; horizontal translation is supplied by the game.' if key in ['flower-tail-bird','dew-rabbit','rolling-acorn'] else 'No horizontal root displacement.','bones':[{'name':'root','parent':None,'pivot':[276,292] if key=='rolling-acorn' else c['pivot']}]+[{'name':r[0],'parent':'root','pivot':r[2]} for r in c['regions']],'timeline':timeline,'spineCompatibilityVerified':False}
 if key=='bundle-snail':
  rig['footWave']={'amplitudeX':11,'amplitudeY':6,'wavelengthX':45,'wavelengthY':40,'regionStartY':337,'regionEndY':393}
 write_json(folder/'rig.json',rig)
 return source,mesh,rig

def interpolate(grid,x,y):
 gx=np.clip(x/STEP,0,63.99999)
 gy=np.clip(y/STEP,0,63.99999)
 ix,iy=gx.astype(int),gy.astype(int)
 u,v=(gx-ix)[:,:,None],(gy-iy)[:,:,None]
 a,b,c,d=grid[iy,ix],grid[iy,ix+1],grid[iy+1,ix],grid[iy+1,ix+1]
 return np.where(u+v<=1,a+(b-a)*u+(c-a)*v,d+(c-d)*(1-u)+(b-d)*(1-v))

def render(key,source,mesh,rig,fraction):
 times=rig['timeline']
 time=fraction*rig['periodMs']
 index=min(len(times)-2,int(fraction*(len(times)-1)))
 left,right=times[index],times[index+1]
 amount=(time-left['timeMs'])/(right['timeMs']-left['timeMs'])
 def blend(a,b):
  return [a[0]+(b[0]-a[0])*amount,[a[1][i]+(b[1][i]-a[1][i])*amount for i in range(2)]]
 root_pose=blend(left['root'],right['root'])
 bone_poses={name:blend(left['bones'][name],right['bones'][name]) for name in left['bones']}
 root=rotation(rig['bones'][0]['pivot'],root_pose[0],root_pose[1])
 if key=='rolling-acorn':
  root[:2,2]+=np.array([-20,-26])
 matrices=[root]
 for bone in rig['bones'][1:]:
  angle,shift=bone_poses[bone['name']]
  matrices.append(root@rotation(bone['pivot'],angle,shift))
 vertices=np.asarray(mesh['vertices'])
 homogeneous=np.column_stack((vertices,np.ones(len(vertices))))
 posed=np.einsum('bij,vj->bvi',np.asarray(matrices),homogeneous)[:,:,:2]
 positions=np.einsum('vb,bvi->vi',np.asarray(mesh['weights']),posed)
 if key=='bundle-snail':
  wave=rig['footWave']
  vx,vy=vertices[:,0],vertices[:,1]
  foot=smooth((vy-337)/56)*smooth((vx-106)/35)*smooth((443-vx)/35)
  positions[:,0]+=wave['amplitudeX']*np.sin(fraction*2*math.pi-(vx-100)/45)*foot
  positions[:,1]+=wave['amplitudeY']*np.sin(fraction*2*math.pi-(vx-100)/40)*foot
 delta=(positions-vertices).reshape((65,65,2))
 yy,xx=np.mgrid[:SIZE,:SIZE]
 target=np.stack((xx,yy),2).astype(float)
 coordinates=target.copy()
 inverse=np.linalg.inv(root)
 coordinates[:,:,0]=inverse[0,0]*xx+inverse[0,1]*yy+inverse[0,2]
 coordinates[:,:,1]=inverse[1,0]*xx+inverse[1,1]*yy+inverse[1,2]
 local_grid=(np.linalg.inv(root)@np.column_stack((positions,np.ones(len(positions)))).T).T[:,:2]-vertices
 local_grid=local_grid.reshape((65,65,2))
 local_target=coordinates.copy()
 for unused in range(7):
  displacement=interpolate(local_grid,coordinates[:,:,0],coordinates[:,:,1])
  coordinates=local_target-displacement
 x,y=coordinates[:,:,0],coordinates[:,:,1]
 valid=(x>=0)&(x<=SIZE-1)&(y>=0)&(y<=SIZE-1)
 x=np.clip(x,0,SIZE-1.00001)
 y=np.clip(y,0,SIZE-1.00001)
 ix,iy=x.astype(int),y.astype(int)
 u,v=(x-ix)[:,:,None],(y-iy)[:,:,None]
 texture=np.asarray(source).astype(float)
 texture[:,:,:3]*=texture[:,:,3:4]/255
 sampled=(texture[iy,ix]*(1-u)+texture[iy,ix+1]*u)*(1-v)+(texture[iy+1,ix]*(1-u)+texture[iy+1,ix+1]*u)*v
 sampled[:,:,:3]*=255/np.maximum(sampled[:,:,3:4],0.0001)
 sampled*=valid[:,:,None]
 pixels=sampled.clip(0,255).round().astype('uint8')
 pixels[pixels[:,:,3]<8]=0
 frame=Image.fromarray(pixels)
 return frame

def main(key):
 folder=BASE/key
 source,mesh,rig=prepare(key)
 frames=[render(key,source,mesh,rig,i/24) for i in range(24)]
 if key=='rolling-acorn':
  all_bounds=[frame.getchannel('A').getbbox() for frame in frames]
  print(key,'bounds',all_bounds)
 durations=[round((i+1)*rig['periodMs']/24)-round(i*rig['periodMs']/24) for i in range(24)]
 columns=6
 output_size=OUTPUT_SIZE[key]
 atlas=Image.new('RGBA',(output_size*columns,output_size*4))
 for i,frame in enumerate(frames):
  atlas.paste(frame.resize((output_size,output_size),Image.Resampling.LANCZOS),(i%columns*output_size,i//columns*output_size))
 webp(folder/'walk.webp',atlas)
 animate(folder/'thumb.webp',[frame.resize((64,64),Image.Resampling.LANCZOS) for frame in frames],durations)
 animate(folder/'preview.webp',[frame.resize((256,256),Image.Resampling.LANCZOS) for frame in frames],durations)
 contact=Image.new('RGB',(1024,256),(28,38,32))
 for j,i in enumerate([0,6,12,18]):
  small=frames[i].resize((256,256),Image.Resampling.LANCZOS)
  contact.paste(small,(j*256,0),small)
 contact.save(folder/'contact.png')
 meta={'image':'DesignAssets/Animations/CreatureWalkV1/'+key+'/walk.webp','frameSize':output_size,'columns':columns,'durationsMs':durations,'loop':True,'pivotX':CONFIG[key]['pivot'][0]*output_size/SIZE,'pivotY':CONFIG[key]['pivot'][1]*output_size/SIZE,'cyclesPerCell':1,'method':rig['method'],'rig':'rig.json','mesh':'mesh.json','preview':'preview.webp','thumbnail':'thumb.webp','frameCount':len(frames),'durationMs':sum(durations),'rootMotion':False}
 write_json(folder/'walk.json',meta)
 print(key,'exported',len(frames),sum(durations),atlas.size)

if __name__=='__main__':
 for key in sys.argv[1:] or [HERE.name]:
  main(key)
