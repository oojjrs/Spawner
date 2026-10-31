from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import math,json
P=Path(__file__).resolve().parent

def save_json(path,data):
 path.write_bytes((json.dumps(data,**{'ensure_ascii':False,'indent':2})+'\n').replace('\n','\r\n').encode('utf-8'))

def affine(image,pivot,degrees,delta):
 if abs(degrees)+sum(abs(v)for v in delta)<1e-8:return image.copy()
 scale=3;large=image.convert('RGBa').resize((image.width*scale,image.height*scale),Image.Resampling.BILINEAR);px,py=[v*scale for v in pivot];dx,dy=[v*scale for v in delta];r=math.radians(degrees);c=math.cos(r);s=math.sin(r)
 inverse=[c,s,px-c*(px+dx)-s*(py+dy),-s,c,py+s*(px+dx)-c*(py+dy)]
 return large.transform(large.size,Image.Transform.AFFINE,inverse,Image.Resampling.BICUBIC).resize(image.size,Image.Resampling.LANCZOS).convert('RGBA')

def angle(v):return math.degrees(math.atan2(v[1],v[0]))

def solve(leg,delta):
 hip=np.asarray(leg['hip'],float);knee=np.asarray(leg['knee'],float);toe=np.asarray(leg['toe'],float);root=hip+delta;direction=toe-root;distance=float(np.linalg.norm(direction));direction/=distance;perp=np.array([-direction[1],direction[0]]);l1,l2=leg['lengths'];a=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-a*a));joint=root+direction*a+perp*height*leg['bendSign']
 return {'hip':root.tolist(),'knee':joint.tolist(),'toe':toe.tolist(),'upperDegrees':angle(joint-root)-angle(knee-hip),'lowerDegrees':angle(joint-toe)-angle(knee-toe),'lengths':[float(np.linalg.norm(joint-root)),float(np.linalg.norm(toe-joint))]}

def pose_frame(rig,textures,p,head_p,claw_p,state):
 delta=np.asarray(rig['bodyTranslationAtPeak'])*p;head_delta=delta+np.asarray(rig['headRetractionAtPeak'])*head_p;head_angle=rig['headPeakDegrees']*head_p;frame=Image.new('RGBA',(256,256));solved={leg['name']:solve(leg,delta)for leg in rig['legs']}
 def leg_image(leg):
  value=solved[leg['name']];upper=affine(textures[(state,leg['name']+'-upper')],leg['hip'],value['upperDegrees'],delta);lower=affine(textures[(state,leg['name']+'-lower')],leg['toe'],value['lowerDegrees'],[0,0]);return Image.alpha_composite(upper,lower)
 for leg in rig['legs']:
  if leg['depth']=='behind':frame.alpha_composite(leg_image(leg))
 frame.alpha_composite(affine(textures[(state,'body-under')],[128,150],0,delta))
 for leg in rig['legs']:
  if leg['depth']=='front':frame.alpha_composite(leg_image(leg))
 for claw in rig['mandibles']:
  part=affine(textures[(state,claw['name'])],claw['pivot'],claw['peakDegrees']*claw_p,[0,0]);part=affine(part,rig['headPivot'],head_angle,head_delta);frame.alpha_composite(part)
 frame.alpha_composite(affine(textures[(state,'head')],rig['headPivot'],head_angle,head_delta))
 frame.alpha_composite(affine(textures[(state,'carapace-foreground')],[128,150],0,delta))
 return frame,{'bodyTranslationPixels':delta.tolist(),'bodyDegrees':0,'bodyScale':[1,1],'headTranslationPixels':head_delta.tolist(),'headDegrees':head_angle,'mandibleDegrees':{claw['name']:claw['peakDegrees']*claw_p for claw in rig['mandibles']},'legs':solved}

def main():
 rig=json.loads((P/'rig.json').read_text('utf-8'));meta=json.loads((P/'hurt.json').read_text('utf-8'));names=['body-under','carapace-foreground','head']+[p['name']for p in rig['attachments']];textures={(state,name):Image.open(P/'Parts'/(name+'-'+state+'.png')).convert('RGBA')for state in ['seed','half','pain']for name in names};originals={state:Image.open(P/'Source'/(state+'.png')).convert('RGBA')for state in ['seed','half','pain']};body=[0,.28,.65,.9,1,.96,.72,.38,.10,-.05,-.025,0,0,0,0,0];head=[0,.20,.65,.9,1,.95,.70,.35,.05,-.05,0,0,0,0,0,0];claw=[0,.10,.50,.85,1,.98,.80,.45,.08,-.10,-.05,0,0,0,0,0];states=['seed','half','pain','pain','pain','pain','pain','pain','half','half','seed','seed','seed','seed','seed','seed'];frames=[];poses=[]
 neutral,_=pose_frame(rig,textures,0,0,0,'seed');neutral.save(P/'neutral-assembly.png')
 for i,(p,h,c,state)in enumerate(zip(body,head,claw,states)):
  frame,pose=pose_frame(rig,textures,p,h,c,state)
  if p==0 and h==0 and c==0:frame=originals[state].copy()
  frame.save(P/'Source'/('rendered-'+str(i).zfill(2)+'.png'));frames.append(frame);poses.append({'frame':i,'durationMs':meta['durationsMs'][i],'expression':state,**pose})
 sheet=Image.new('RGBA',(1024,1024));matrix=Image.new('RGBA',(256,256))
 for i,frame in enumerate(frames):sheet.paste(frame,(i%4*256,i//4*256));matrix.paste(frame.resize((64,64),Image.Resampling.LANCZOS),(i%4*64,i//4*64))
 options={'lossless':True,'exact':True,'method':4};sheet.save(P/'hurt.webp','WEBP',**options);matrix.save(P/'hurt-matrix.webp','WEBP',**options);durations=meta['durationsMs'].copy();durations[-1]+=900
 for name,images in [('hurt-preview.webp',frames),('hurt-thumbnail.webp',[frame.resize((64,64),Image.Resampling.LANCZOS)for frame in frames])]:images[0].save(P/name,'WEBP',**{'save_all':True,'append_images':images[1:],'duration':durations,'loop':0,**options})
 contact=Image.new('RGB',(1024,552),(35,45,38));draw=ImageDraw.Draw(contact)
 for n,i in enumerate([0,1,2,4,6,8,10,15]):
  x=n%4*256;y=n//4*276;contact.paste(frames[i],(x,y+20),frames[i]);draw.text((x+5,y+5),'frame '+str(i),(245,245,220))
 contact.save(P/'hurt-contact.png');save_json(P/'timeline.json',{'durationMs':760,'closedEyeHold':{'fromMs':110,'toMs':510,'durationMs':400},'poses':poses,'registration':'Unchanged original canvas and pivot; independent fixed world-space toe targets.'})
 print('spiny-back-leader four fixed-toe leg chains, 16 frames / 760 ms')
 print('peak joint angles',[(name,round(v['upperDegrees'],2),round(v['lowerDegrees'],2))for name,v in poses[4]['legs'].items()])

if __name__=='__main__':main()
