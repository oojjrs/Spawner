from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, _webp
import numpy as np
import json

def components(mask):
 working=mask.copy()
 labels=np.zeros(mask.shape,np.int32)
 records=[]
 count=0
 for sy,sx in zip(*np.where(working)):
  if not working[sy,sx]:
   continue
  count+=1
  stack=[(int(sx),int(sy))]
  left,top,right,bottom=sx,sy,sx+1,sy+1
  area=0
  while stack:
   x,y=stack.pop()
   if not working[y,x]:
    continue
   missing=np.flatnonzero(~working[y,:x])
   lo=int(missing[-1]+1) if len(missing) else 0
   missing=np.flatnonzero(~working[y,x+1:])
   hi=int(x+1+missing[0]) if len(missing) else working.shape[1]
   working[y,lo:hi]=False
   labels[y,lo:hi]=count
   area+=hi-lo
   left=min(left,lo);top=min(top,y);right=max(right,hi);bottom=max(bottom,y+1)
   for ny in [y-1,y+1]:
    if ny<0 or ny>=working.shape[0]:
     continue
    strip=working[ny,lo:hi]
    starts=np.flatnonzero(strip&~np.concatenate(([False],strip[:-1])))
    stack.extend((int(lo+start),ny) for start in starts)
  records.append({'id':count,'bbox':[int(left),int(top),int(right),int(bottom)],'area':int(area)})
 return labels,records

def eye(image):
 pixels=np.asarray(image).astype(float)
 r,g,b,a=[pixels[:,:,i] for i in range(4)]
 mask=(a>128)&(g>r*1.15)&(g>b*1.03)&(g<150)
 unused,records=components(mask)
 alpha=np.where(a>128)
 minx,maxx=min(alpha[1]),max(alpha[1])
 miny,maxy=min(alpha[0]),max(alpha[0])
 options=[]
 for record in records:
  l,t,rr,bb=record['bbox'];w,h=rr-l,bb-t
  if w<4 or h<4 or w>0.3*(maxx-minx) or h>0.3*(maxy-miny) or not .55<w/h<1.65 or (l+rr)/2>minx+.7*(maxx-minx) or record['area']/(w*h)<.35:
   continue
  options.append(record)
 return sorted(options,key=lambda r:r['area'],reverse=True)[:3]

HERE=Path(__file__).resolve().parent
SIZE=420
PERIOD=5000

def json_file(path,value):
 encoder=json.JSONEncoder();encoder.ensure_ascii=False;encoder.indent=2
 path.write_bytes((encoder.encode(value)+'\n').replace('\n','\r\n').encode('utf-8'))

def webp(path,picture):
 path.write_bytes(_webp.WebPEncode(picture.getim(),True,100.0,100.0,'',6,1,b'',''))

def animate(path,pictures,durations):
 encoder=_webp.WebPAnimEncoder(pictures[0].size,0,0,False,9,17,False,False);timestamp=0
 for picture,duration in zip(pictures,durations):
  encoder.add(picture.getim(),timestamp,True,100.0,100.0,3);timestamp+=duration
 encoder.add(None,timestamp,True,100.0,100.0,0);path.write_bytes(encoder.assemble('','',''))

def rotation(pivot,degrees):
 angle=np.radians(degrees);c,s=np.cos(angle),np.sin(angle);x,y=pivot
 return np.array([[c,s,x-c*x-s*y],[-s,c,y+s*x-c*y],[0,0,1]],float)

def prepare():
 reference=Image.open(HERE/'Source/locked-neutral.png').convert('RGBA').resize((SIZE,SIZE),Image.Resampling.LANCZOS)
 body_part=Image.open(HERE/'Parts/body-complete.png').convert('RGBA')
 first_eye=eye(body_part)[0]['bbox'];ref_eye=eye(reference)[0]['bbox']
 body_scale=(ref_eye[2]-ref_eye[0]+ref_eye[3]-ref_eye[1])/(first_eye[2]-first_eye[0]+first_eye[3]-first_eye[1])
 body_part=body_part.resize((round(body_part.width*body_scale),round(body_part.height*body_scale)),Image.Resampling.LANCZOS)
 bx=round((ref_eye[0]+ref_eye[2])/2-(first_eye[0]+first_eye[2])/2*body_scale)
 by=round((ref_eye[1]+ref_eye[3])/2-(first_eye[1]+first_eye[3])/2*body_scale)
 body=Image.new('RGBA',(SIZE,SIZE));body.paste(body_part,(bx,by))
 bbox=body.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
 center=[(bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2]
 leaf=Image.open(HERE/'Parts/stem-leaf-complete.png').convert('RGBA')
 leaf=leaf.resize((round(leaf.width*.26),round(leaf.height*.26)),Image.Resampling.LANCZOS)
 width,height=leaf.size
 root=[width*.08,height*.85];joint=[width*.27,height*.43]
 xs=list(range(0,width,6))+[width];ys=list(range(0,height,6))+[height]
 vertices=np.array([[x,y] for y in ys for x in xs],float)
 influence=np.clip((vertices[:,0]-width*.15)/(width*.55),0,1);influence=influence*influence*(3-2*influence)
 triangles=[];alpha=np.array(leaf)[:,:,3]
 for row in range(len(ys)-1):
  for col in range(len(xs)-1):
   if not np.any(alpha[ys[row]:ys[row+1],xs[col]:xs[col+1]]):continue
   i=row*len(xs)+col;triangles.extend([[i,i+1,i+len(xs)],[i+1,i+len(xs)+1,i+len(xs)]])
 active=np.array(leaf.getchannel('A').filter(ImageFilter.MaxFilter(13)))
 active_vertices=np.array([active[min(height-1,int(y)),min(width-1,int(x))]>16 for x,y in vertices])
 mesh={'canvas':[width,height],'vertices':vertices.tolist(),'triangles':triangles,'weights':[[float(1-w),float(w)] for w in influence],'texture':'Parts/stem-leaf-complete.png','sourceTextureScale':.26,'root':root,'junction':joint}
 json_file(HERE/'leaf-mesh.json',mesh)
 rig={'format':'spawner-layered-rigid-roll-and-leaf-fk-v2','canvas':[SIZE,SIZE],'pivot':[210,349.453125],'periodMs':PERIOD,'cyclesPerCell':.4,'bodyTexture':'Parts/body-complete.png','bodyTextureScale':body_scale,'bodyNeutralPlacement':[bx,by],'bodyBindCenter':center,'capBindPoint':[252,158],'leafTexture':'Parts/stem-leaf-complete.png','leafMesh':'leaf-mesh.json','groundY':349,'bones':[{'name':'root','parent':None,'pivot':[210,349.453125]},{'name':'body-roll','parent':'root','pivot':center},{'name':'stem-base','parent':'body-roll','pivot':[252,158]},{'name':'leaf-tip','parent':'stem-base','pivot':joint}],'drawOrder':{'0-120':'leaf then body','120-300':'body then leaf','300-360':'leaf then body'},'timeline':[{'timeMs':0,'bodyDegrees':0},{'timeMs':PERIOD,'bodyDegrees':360}],'leafCounterBend':{'startDegrees':90,'endDegrees':360,'peakDegrees':140,'shapePower':1.5,'baseWeight':.7,'tipWeight':.3,'groundClearancePx':1},'method':'Complete body and separate complete curved stem/leaf were redrawn with built-in image_gen from the locked reference after the whole-strip pose study. The body remains rigid and rolls on its alpha silhouette. A two-bone weighted FK mesh bends the independent flexible leaf during ground contact; restored cap artwork remains underneath.','rootMotion':False,'spineCompatibilityVerified':False}
 json_file(HERE/'rig.json',rig)
 return reference,body,leaf,vertices,np.array(triangles),influence,active_vertices,rig

def leaf_pose(angle,extra,root_world,vertices,influence,rig):
 mesh=json.loads((HERE/'leaf-mesh.json').read_bytes());root=mesh['root'];joint=mesh['junction']
 base=rotation(root,angle+extra*.7)
 base[:2,2]+=np.asarray(root_world)-np.asarray(root)
 tip=base@rotation(joint,extra*.3)
 hom=np.column_stack((vertices,np.ones(len(vertices))))
 a=(base@hom.T).T[:,:2];b=(tip@hom.T).T[:,:2]
 return a*(1-influence[:,None])+b*influence[:,None]

def raster(texture,vertices,triangles,positions):
 output=np.zeros((SIZE,SIZE,4),float)
 for triangle in triangles:
  destination=positions[triangle];source=vertices[triangle]
  lo=np.maximum(0,np.floor(destination.min(0)).astype(int));hi=np.minimum(SIZE-1,np.ceil(destination.max(0)).astype(int))
  if np.any(hi<lo):continue
  x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
  system=np.vstack((destination.T,np.ones(3)))
  if abs(np.linalg.det(system))<.001:continue
  bary=np.linalg.inv(system)@np.array([x.ravel(),y.ravel(),np.ones(x.size)])
  inside=np.all(bary>=-.00001,0)
  if not inside.any():continue
  uv=source.T@bary[:,inside];u=np.clip(uv[0],0,texture.shape[1]-1.001);v=np.clip(uv[1],0,texture.shape[0]-1.001)
  ix,iy=u.astype(int),v.astype(int);fu,fv=(u-ix)[:,None],(v-iy)[:,None]
  sampled=(texture[iy,ix]*(1-fu)+texture[iy,ix+1]*fu)*(1-fv)+(texture[iy+1,ix]*(1-fu)+texture[iy+1,ix+1]*fu)*fv
  output[y.ravel()[inside],x.ravel()[inside]]=sampled
 alpha=output[:,:,3:4];output[:,:,:3]*=255/np.maximum(alpha,.0001)
 pixels=output.clip(0,255).round().astype('uint8');pixels[pixels[:,:,3]<8]=0
 return Image.fromarray(pixels)

def main():
 reference,body,leaf,vertices,triangles,influence,active,rig=prepare()
 texture=np.array(leaf).astype(float);texture[:,:,:3]*=texture[:,:,3:4]/255
 frames=[];records=[];minimum_area=1e9
 (HERE/'Frames').mkdir(511,True,True)
 for i in range(64):
  angle=i*360/64
  rotated=body.rotate(angle,Image.Resampling.BICUBIC,False,tuple(rig['bodyBindCenter']))
  bounds=rotated.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
  dy=rig['groundY']-(bounds[3]-1)
  base_body=Image.new('RGBA',(SIZE,SIZE));base_body.paste(rotated,(0,dy))
  cap=(rotation(rig['bodyBindCenter'],angle)@np.array(rig['capBindPoint']+[1]))[:2]+np.array([0,dy])
  phase=np.clip((angle-90)/270,0,1);extra=-140*float(np.sin(np.pi*phase)**1.5)
  positions=leaf_pose(angle,extra,cap,vertices,influence,rig)
  for correction in range(181):
   if positions[active,1].max()<=rig['groundY']-1:break
   extra-=1;positions=leaf_pose(angle,extra,cap,vertices,influence,rig)
  leaf_image=raster(texture,vertices,triangles,positions)
  if 120<=angle<=300:frame=Image.alpha_composite(base_body,leaf_image)
  else:frame=Image.alpha_composite(leaf_image,base_body)
  points=positions[triangles];a=points[:,1]-points[:,0];b=points[:,2]-points[:,0]
  area=a[:,0]*b[:,1]-a[:,1]*b[:,0];minimum_area=min(minimum_area,float(area.min()))
  record={'angle':angle,'bodySupportY':dy+bounds[3]-1,'leafMaximumY':float(positions[active,1].max()),'leafExtraDegrees':extra,'drawOrder':'front' if 120<=angle<=300 else 'behind'}
  records.append(record);frames.append(frame);frame.save(HERE/'Frames'/('%02d.png'%(i+1)))
 durations=[round((i+1)*PERIOD/64)-round(i*PERIOD/64) for i in range(64)]
 sheet=Image.new('RGBA',(SIZE*8,SIZE*8))
 for i,frame in enumerate(frames):sheet.paste(frame,(i%8*SIZE,i//8*SIZE))
 webp(HERE/'walk.webp',sheet)
 animate(HERE/'preview.webp',[im.resize((256,256),Image.Resampling.LANCZOS) for im in frames],durations)
 animate(HERE/'thumb.webp',[im.resize((64,64),Image.Resampling.LANCZOS) for im in frames],durations)
 contact=Image.new('RGB',(1024,858),(32,45,37))
 for j,i in enumerate([None,0,8,16,24,32,40,48,56]):
  x,y=j%4*256,j//4*286;im=(reference if i is None else frames[i]).resize((256,256),Image.Resampling.LANCZOS);contact.paste(im,(x,y),im)
 contact.save(HERE/'contact.png')
 metadata={'image':'DesignAssets/Animations/CreatureWalkV2/rolling-acorn/walk.webp','frameSize':SIZE,'columns':8,'durationsMs':durations,'loop':True,'pivotX':210,'pivotY':349.453125,'cyclesPerCell':.4,'frameCount':64,'durationMs':PERIOD,'method':rig['method'],'rig':'rig.json','mesh':'leaf-mesh.json','frames':'Frames','preview':'preview.webp','thumbnail':'thumb.webp','rootMotion':False,'bodyDiameterInCells':.796,'cyclesRationale':'Body screen diameter approximately 0.796 cells; circumference pi*0.796 yields about 0.4 revolutions per world cell.'}
 json_file(HERE/'walk.json',metadata)
 json_file(HERE/'contact-metrics.json',{'samples':records,'minimumTriangleArea2':minimum_area})
 print('rolling-acorn body floor',min(r['bodySupportY'] for r in records),max(r['bodySupportY'] for r in records),'leaf max',max(r['leafMaximumY'] for r in records),'minimum mesh area',minimum_area)

if __name__=='__main__':main()