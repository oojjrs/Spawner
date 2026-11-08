#!/usr/bin/env python3
"""Exact normalization of missed bean/base birth publication, not runtime originals."""
from pathlib import Path
import json,hashlib,os,tempfile,runpy,copy
from PIL import Image
R=Path(__file__).resolve().parents[2];H=Path(__file__).parent;D=R/'AnimationCandidates/bean-base-birth-fullbody-v1-20261107'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def put(p,b):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-base-birth-');os.close(fd)
 try:Path(t).write_bytes(b);os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def save(p,d):put(p,(json.dumps(d,indent=2)+'\n').encode())
def main():
 report=H/'bean-spore-base-birth-changes.json';assert not report.exists()
 main=json.loads((H/'bean-spore-image-changes.json').read_text())['changes'];changes=dict(main);proof={'status':'in_progress','changes':{},'previewChanges':{},'metadataChanges':{},'nativeImagesRewritten':False,'limitations':['Historical packer not reexecuted; pack-body.py still imports external original generation job.']}
 baseline={str(p.relative_to(R)):{'beforeSha256':sha(p),'document':json.loads(p.read_text())} for p in D.glob('*.json')};save(H/'bean-spore-base-birth-metadata-baseline.json',baseline)
 cells={};raw=D/'Sources/birth-wholebody-generated.png';im=Image.open(raw);xs=[round(i*im.width/4) for i in range(5)];ys=[round(i*im.height/4) for i in range(5)];rawcells=[(xs[x],ys[y],xs[x+1],ys[y+1]) for y in range(4) for x in range(4)]
 boxes=json.loads((D/'source-layout.json').read_text());assert all(c[0]<=b[0]<b[2]<=c[2] and c[1]<=b[1]<b[3]<=c[3] for c,b in zip(rawcells,boxes))
 for p in list((D/'Sources').glob('*.png'))+list((D/'body-poses').glob('*.png'))+[D/'bean-base-birth-body-v1-sheet.png',D/'bean-base-birth-complete-v1-sheet.png']:
  name=str(p.relative_to(R));before=sha(p);a=Image.open(p).convert('RGBA');matches=[e for e in main.values() if e['beforeSha256']==before];e=matches[0] if matches else None
  if e:rects=e['cellRectangles'];copyfrom=e['afterPath']
  else:rects=rawcells if p==raw else [(0,0,a.width,a.height)];copyfrom=None
  out=a.copy()
  for rect in rects:out.paste(a.crop(rect).transpose(Image.Transpose.FLIP_LEFT_RIGHT),rect[:2])
  fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-base-birth-',suffix='.png');os.close(fd)
  try:
   if copyfrom:Path(t).write_bytes((R/copyfrom).read_bytes())
   else:out.save(t,format='PNG',compress_level=6)
   assert Image.open(t).convert('RGBA').tobytes()==out.tobytes();os.replace(t,p)
  finally:
   if os.path.exists(t):os.unlink(t)
  fw=rects[0][2]-rects[0][0];fh=rects[0][3]-rects[0][1];v={'oldImage':name,'newImage':name,'afterPath':name,'beforeSha256':before,'afterSha256':sha(p),'dimensions':list(a.size),'cellRectangles':rects,'grid':{'frameWidth':fw,'frameHeight':fh},'copyFrom':copyfrom,'verification':{'exactCellRgbaMirror':True}};proof['changes'][name]=v;changes[name]=v;save(report,proof)
 helper=runpy.run_path(str(R/'tools/source-facing-normalization-20261108/normalize_source_previews.py'))
 for p in D.glob('*preview.*'):
  before=sha(p);fmt,info,fs,ds=helper['read_frames'](p);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in fs];fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-base-birth-',suffix=p.suffix);os.close(fd)
  try:
   if fmt=='GIF':Path(t).write_bytes(helper['mirror_gif'](p.read_bytes()))
   else:expected[0].save(t,format='WEBP',lossless=True,exact=True,method=0,save_all=True,append_images=expected[1:],duration=ds,loop=info.get('loop',0))
   helper['verify'](expected,t,ds,info);os.replace(t,p)
  finally:
   if os.path.exists(t):os.unlink(t)
  name=str(p.relative_to(R));v={'beforeSha256':before,'afterSha256':sha(p),'newImage':name,'afterPath':name,'dimensions':list(fs[0].size),'frameCount':len(fs),'durationsMs':ds,'loop':info.get('loop'),'verification':{'exactVisibleRgbaMirror':True}};proof['previewChanges'][name]=v;changes[name]=v;save(report,proof)
 def resolve(s):
  if not isinstance(s,str):return None
  if s.startswith(('AnimationCandidates/','DesignAssets/')):return s
  return str((D/s).relative_to(R))
 def translate(s):
  if resolve(s) in changes:return changes[resolve(s)].get('newImage',s) if s.startswith(('AnimationCandidates/','DesignAssets/')) else os.path.relpath(R/changes[resolve(s)]['newImage'],D)
  vals={e['afterSha256'] for e in changes.values() if e['beforeSha256']==s};return next(iter(vals)) if len(vals)==1 else s
 def rect(b,w):return [w-b[2],b[1],w-b[0],b[3]]
 def rewrite(o,w=512,scene=512,key=''):
  if isinstance(o,str):return translate(o)
  if isinstance(o,list):return [rewrite(v,w,scene,key) for v in o]
  if not isinstance(o,dict):return o
  fs=o.get('frameSize',o.get('frameWidth',w));w=fs[0] if isinstance(fs,list) else fs
  out={k:rewrite(v,w,w if k=='sceneLayers' else scene,k) for k,v in o.items()}
  for k in ['pivotX','bodyOnlyPivotX']:
   if isinstance(o.get(k),(int,float)):out[k]=w-o[k]
  for k in ['pivot','sceneFinalPivot','nativeIdlePivot']:
   if isinstance(o.get(k),list) and len(o[k])==2:out[k]=[(631 if k=='nativeIdlePivot' else w)-o[k][0],o[k][1]]
  if 'destination' in o:
   x,y,ww,hh=o['destination'];out['destination']=[scene-x-ww,y,ww,hh]
  for k in ['bounds','opaqueBounds','bodyBounds']:
   b=o.get(k)
   if isinstance(b,list) and len(b)==4 and all(isinstance(v,(int,float)) for v in b):out[k]=rect(b,w)
  for k in ['sourceFacing','sourceFacingLabel']:
   if k in o:out[k]='left'
  if 'sourceRect' in o and 'index' in o:
   i=o['index'];l,t,r,b=o['sourceRect'];c=rawcells[i];out['sourceRect']=[c[0]+c[2]-r,t,c[0]+c[2]-l,b]
   if 'wholeCelTranslation' in o:out['wholeCelTranslation']=[631-o['wholeCelTranslation'][0]-round((r-l)*o['fixedWholeCelScale']),o['wholeCelTranslation'][1]]
  return out
 body=Image.open(D/'bean-base-birth-body-v1-sheet.png').convert('RGBA');last=body.crop((7*631,631,8*631,1262));lastsha=hashlib.sha256(last.tobytes()).hexdigest()
 assert last.tobytes()==Image.open(D/'Sources/approved-idle-frame0.png').convert('RGBA').tobytes()
 oldlast=baseline[str((D/'publication-manifest.json').relative_to(R))]['document']['bodyOnly']['lastFrameRGBA_SHA256']
 for name,b in baseline.items():
  p=R/name;old=b['document']
  if p.name=='source-layout.json':new=[[c[0]+c[2]-v[2],v[1],c[0]+c[2]-v[0],v[3]] for c,v in zip(rawcells,old)]
  else:new=rewrite(old)
  def lastfix(x):
   if isinstance(x,str):return lastsha if x==oldlast else x
   if isinstance(x,list):return [lastfix(v) for v in x]
   if isinstance(x,dict):return {k:lastfix(v) for k,v in x.items()}
   return x
  new=lastfix(new)
  if new==old:continue
  assert sha(p)==b['beforeSha256'];save(p,new);proof['metadataChanges'][name]={'beforeSha256':b['beforeSha256'],'afterSha256':sha(p)}
 proof['rawCellBoundaries']={'x':xs,'y':ys,'coordinates':rawcells};proof['verification']={'finalBodyEqualsNormalizedIdleFrame0':True,'allImageHashesCurrent':True,'nativeRuntimeNotRewritten':True};proof['status']='completed';save(report,proof);print('COMPLETE',len(proof['changes']),len(proof['previewChanges']),len(proof['metadataChanges']))
if __name__=='__main__':main()
