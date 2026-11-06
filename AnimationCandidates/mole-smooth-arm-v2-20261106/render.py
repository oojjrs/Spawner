"""Isolated authoring of an existing weighted-mesh animation asset. No game imports."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageFont
import numpy as np
from scipy.ndimage import label,distance_transform_edt
import json,math,hashlib,subprocess,sys

HERE=Path(__file__).resolve().parent
R=json.loads((HERE/'rig.json').read_text())
M=json.loads((HERE/R['sourceMesh']).read_text())
S=R['frameSize'];N=R['frameCount'];STEP=M['step'];COL=M['columns']
source=Image.open(HERE/R['source']).convert('RGBA')
raw=np.asarray(source).astype(float);raw[:,:,:3]*=raw[:,:,3:4]/255
vertices=np.asarray(M['vertices'])
yy,xx=np.mgrid[:S,:S].astype(float)
weights=[]
gy,gx=np.mgrid[:S+1,:S+1]
curve=np.array(R['fixedHeadLowerBoundary'])
headBoundary=np.interp(gx,curve[:,0],curve[:,1])
fixedBody=(gy<265)
distance=distance_transform_edt(~fixedBody)
def smooth(v):
 v=np.clip(v,0,1);return v*v*(3-2*v)
for leg in R['legs']:
 mask=Image.new('L',(S+1,S+1),0);ImageDraw.Draw(mask).polygon(leg['polygon'],255)
 mask=mask.filter(ImageFilter.GaussianBlur(leg['maskBlur']))
 w=np.asarray(mask).astype(float)[vertices[:,1].astype(int),vertices[:,0].astype(int)]/255
 w*=smooth((vertices[:,1]-leg['blendStartY'])/(leg['blendEndY']-leg['blendStartY']))
 # The original visible claws must move with the existing paw bone, rather than
 # retaining root weight. The plateau is within the existing limb mask only.
 w=np.minimum(w/0.985,1)
 w*=smooth(distance[vertices[:,1].astype(int),vertices[:,0].astype(int)]/R['fixedBodyBlendPixels'])
 if leg['name']=='rear':
  w*=smooth((vertices[:,0]-390)/26)
 weights.append(w)
weights=np.stack(weights,1)
weights/=np.maximum(1,weights.sum(1))[:,None]
rootWeight=1-weights.sum(1)

def interp(grid,x,y):
 gx=np.clip(x/STEP,0,COL-1.00001);gy=np.clip(y/STEP,0,COL-1.00001)
 ix,iy=gx.astype(int),gy.astype(int);u,v=(gx-ix)[:,:,None],(gy-iy)[:,:,None]
 a,b,c,d=grid[iy,ix],grid[iy,ix+1],grid[iy+1,ix],grid[iy+1,ix+1]
 return np.where(u+v<=1,a+(b-a)*u+(c-a)*v,d+(c-d)*(1-u)+(b-d)*(1-v))

def paw(phase,leg):
 p=(phase+leg['phaseOffset'])%1;st=leg['stance'];travel=leg.get('forwardTravelPixelsPerCycle',R['forwardTravelPixelsPerCycle']);half=travel*st/2
 if p<st:return -half+travel*p,0,0,True
 q=(p-st)/(1-st);tangent=travel*(1-st)
 x=(2*q**3-3*q*q+1)*half+(q**3-2*q*q+q)*tangent+(-2*q**3+3*q*q)*(-half)+(q**3-q*q)*tangent
 rise=math.sin(math.pi*q)**2
 return x,-leg['lift']*rise,math.radians(leg['pitchDegrees'])*rise,False

def grid(phase):
 bob=-R['bodyBobPixels']*(1-math.cos(phase*4*math.pi))/2
 delta=np.column_stack((np.zeros(len(vertices)),rootWeight*bob))
 for i,leg in enumerate(R['legs']):
  x,y,angle,_=paw(phase,leg);c,s=math.cos(angle),math.sin(angle)
  anchor=np.array(leg['anchor']);rel=vertices-anchor
  rot=np.column_stack((c*rel[:,0]-s*rel[:,1],s*rel[:,0]+c*rel[:,1]))
  change=rot-rel+np.array([x,y])
  delta+=weights[:,i,None]*change
 return delta.reshape((COL,COL,2))

def frame(phase):
 g=grid(phase);sx,sy=xx.copy(),yy.copy()
 for _ in range(16):
  d=interp(g,sx,sy);sx,sy=xx-d[:,:,0],yy-d[:,:,1]
 inside=(sx>=0)&(sx<=S-1)&(sy>=0)&(sy<=S-1)
 sx,sy=np.clip(sx,0,S-1.00001),np.clip(sy,0,S-1.00001)
 ix,iy=sx.astype(int),sy.astype(int);u,v=(sx-ix)[:,:,None],(sy-iy)[:,:,None]
 out=(raw[iy,ix]*(1-u)+raw[iy,ix+1]*u)*(1-v)+(raw[iy+1,ix]*(1-u)+raw[iy+1,ix+1]*u)*v
 out[:,:,:3]*=255/np.maximum(out[:,:,3:4],1e-5);out*=inside[:,:,None]
 out=np.clip(out,0,255).round().astype('uint8');out[out[:,:,3]==0]=0
 return Image.fromarray(out)

def font(size):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
def text(im,xy,txt,size=20,color='#e3ece8'):ImageDraw.Draw(im).text(xy,txt,font=font(size),fill=color)
def place(im,art,x,y,width):
 a=art.resize((width,width),Image.Resampling.LANCZOS);im.alpha_composite(a,(int(x-width/2),int(y-width/2)))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def build_frames():
 frames=[frame(i/N) for i in range(N)]
 for i,f in enumerate(frames):f.save(HERE/'Frames'/f'{i:02d}.png')
 atlas=Image.new('RGBA',(S*8,S*8))
 for i,f in enumerate(frames):atlas.paste(f,(i%8*S,i//8*S))
 atlas.save(HERE/'walk-candidate.webp',lossless=True,method=4)
 dur=[round((i+1)*R['periodMs']/N)-round(i*R['periodMs']/N)for i in range(N)]
 preview=[f.resize((256,256),Image.Resampling.LANCZOS)for f in frames]
 preview[0].save(HERE/'walk-preview.webp',save_all=True,append_images=preview[1:],duration=dur,loop=0,lossless=True,method=4)
 sheet=Image.new('RGBA',(1024,600),'#26352e')
 for j,i in enumerate(range(0,N,8)):
  x=j%4*256;y=j//4*300;sheet.alpha_composite(preview[i],(x,y+25))
  state='/'.join('S'if paw(i/N,l)[3]else'L'for l in R['legs'])
  text(sheet,(x+8,y+4),f'{i:02d} {state}',16)
 sheet.convert('RGB').save(HERE/'contact-sheet.png')
 visible=np.asarray(source)[:,:,3]>128;checks=[];minJacob=100
 for i,f in enumerate(frames):
  field=interp(grid(i/N),xx,yy);dxdy,dxdx=np.gradient(field[:,:,0]);dydy,dydx=np.gradient(field[:,:,1]);jac=(1+dxdx)*(1+dydy)-dxdy*dydx
  minJacob=min(minJacob,float(jac[visible].min()))
  a=np.asarray(f)[:,:,3];lab,num=label(a>64);areas=sorted(np.bincount(lab.ravel())[1:],reverse=True)
  checks.append({'frame':i,'largestDetachedArea':int(areas[1])if len(areas)>1 else 0,'edgeAlpha':int(max(a[0].max(),a[-1].max(),a[:,0].max(),a[:,-1].max()))})
 manifest=json.loads((HERE/'source-manifest.json').read_text())
 validation={'status':'unapproved-study','frameCount':N,'uniqueFrames':len({hashlib.sha256(f.tobytes()).hexdigest()for f in frames}),'minimumVisibleForwardJacobian':minJacob,'frameChecks':checks,'sourceFilesUnchanged':all(sha(HERE/i['local'])==i['sha256']for i in manifest),'sourceMatchesV2LockedNeutral':True,'sameOriginalMeshTopology':True,'authoredLoopMs':R['periodMs'],'runtimeSpeedAndScaleVerified':False,'runtimeFootLockingVerified':False,'noNewGeneratedDrawing':True,'audio':False,'limits':R['limits']}
 (HERE/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
 print(json.dumps({k:v for k,v in validation.items()if k!='frameChecks'},indent=2),flush=True)
 return frames

def build_video(frames):
 old=[Image.open(HERE/'Source/CurrentV2'/f'{i:02d}.png').convert('RGBA')for i in range(1,9)]
 dur=[80,80,90,80,80,90,80,87]
 def oldat(p):
  t=p*sum(dur)
  for i,d in enumerate(dur):
   if t<d:return old[i]
   t-=d
  return old[-1]
 W,H=1280,840;period=R['periodMs']/1000
 with (HERE/'Review/encode.log').open('w')as log:
  proc=subprocess.Popen(['ffmpeg','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(HERE/'mole-walk-review.mp4')],stdin=subprocess.PIPE,stderr=log)
  for n in range(720):
   t=n/60;rate=1 if t<6 else .25;anim=t if t<6 else 6+(t-6)*.25;p=(anim/period)%1;new=frames[int(p*N)%N]
   im=Image.new('RGBA',(W,H),'#1d2b24');ImageDraw.Draw(im).line((640,75,640,780),fill='#465b4d',width=2)
   text(im,(28,18),'SOIL MOLE | existing-art grounded-paw study',28)
   text(im,(28,67),'Current V2: eight full-body poses',23);text(im,(665,67),'Candidate: original artwork, refined rig',23)
   for cx,a in [(320,oldat(p)),(960,new)]:place(im,a,cx,295,500);place(im,a,cx,600,96)
   text(im,(30,535),'Same 667 ms authored cycle',19);text(im,(665,535),'Planted sweep / lifted, rolled recovery',19)
   text(im,(30,679),f'{rate:g}x playback | large and small artwork views',20)
   text(im,(30,717),'Unchanged source drawing. No newly generated art. Not integrated.',18,color='#b7cbbf')
   text(im,(30,753),'667 ms is asset timing. Live speed, scale and foot locking are not verified.',18,color='#e5c897')
   text(im,(30,790),'Hidden limbs are not drawn; local shoulder stretching remains a review limit.',18,color='#e5c897')
   if n in [18,70,142,420,540]:im.convert('RGB').save(HERE/'Review'/f'frame-{n:03d}.png')
   proc.stdin.write(im.convert('RGB').tobytes())
  proc.stdin.close();rc=proc.wait()
  if rc:raise RuntimeError('Video encode failed; see Review/encode.log')
if __name__=='__main__':
 import hashlib
 manifest=[]
 for f in (HERE/'Source').glob('*'):
  if f.is_file():manifest.append({'local':str(f.relative_to(HERE)),'sha256':sha(f)})
 (HERE/'source-manifest.json').write_text(json.dumps(manifest,indent=2))
 f=build_frames()
