#!/usr/bin/env python3
"""Owner-scoped original-source metadata sync. Never writes runtime registries.
Historical intermediate sheets absent from the physical plan remain untouched.
Packer execution is deliberately excluded; old generation jobs can reimport art.
"""
from pathlib import Path
import json,hashlib,os,tempfile,copy,functools
from PIL import Image
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
REPORT=HERE/'bean-spore-extra-source-metadata-changes.json';BASE=HERE/'bean-spore-extra-source-metadata-baseline.json'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(path,obj):
 fd,t=tempfile.mkstemp(dir=path.parent,prefix='.bean-spore-metadata-')
 try:
  with os.fdopen(fd,'w') as f:json.dump(obj,f,ensure_ascii=False,indent=2);f.write('\n')
  os.replace(t,path)
 finally:
  if os.path.exists(t):os.unlink(t)
def num(v):return isinstance(v,(int,float)) and not isinstance(v,bool)
def rect(v,w):
 if isinstance(v,list) and len(v)==4 and all(num(a) for a in v):return [w-v[2],v[1],w-v[0],v[3]]
 if isinstance(v,list):return [rect(a,w) for a in v]
 return v
@functools.lru_cache(maxsize=2)
def decoded(name):
 with Image.open(ROOT/name) as im:return im.convert('RGBA')
def main():
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--apply',action='store_true');args=ap.parse_args()
 plan=json.loads((HERE/'bean-spore-extra-plan.json').read_text());image_report=json.loads((HERE/'bean-spore-image-changes.json').read_text());assert image_report['status']=='completed'
 preview_report=json.loads((HERE/'bean-spore-preview-changes.json').read_text())
 if args.apply:assert preview_report['status']=='completed'
 extra_images=json.loads((HERE/'bean-spore-extra-image-changes.json').read_text());extra_previews=json.loads((HERE/'bean-spore-extra-preview-changes.json').read_text());assert extra_images['status']==extra_previews['status']=='completed'
 changes={**image_report['changes'],**preview_report['changes'],**extra_images['changes'],**extra_previews['changes']};targets=set(plan['candidateForms'])
 if BASE.exists():baseline=json.loads(BASE.read_text())
 else:
  baseline={}
  for m in plan['publicationPacking']:
   folder=(ROOT/m['manifest']).parent
   for p in folder.glob('*.json'):
    try:doc=json.loads(p.read_text())
    except (ValueError,OSError):continue
    if isinstance(doc,dict) and any(k in doc for k in ('sheet','actions','sourceSHA256','registration','forms')):
     baseline[p.relative_to(ROOT).as_posix()]={'owner':m['owner'],'beforeSha256':sha(p),'document':doc}
   # Active walk/action manifests may be outside the original family directory.
   doc=json.loads((ROOT/m['manifest']).read_text())
   for row in doc.get('actions',{}).values():
    if not isinstance(row,dict) or not isinstance(row.get('manifest'),str):continue
    mp=ROOT/row['manifest'] if row['manifest'].startswith(('AnimationCandidates/','DesignAssets/')) else folder/row['manifest']
    if mp.is_file() and str(mp).startswith(str(ROOT/'AnimationCandidates')):
     baseline[mp.relative_to(ROOT).as_posix()]={'owner':m['owner'],'beforeSha256':sha(mp),'document':json.loads(mp.read_text())}
  for m in plan['publicationPacking']:
   p=(ROOT/m['manifest']).parent.parent/'source-layouts.json'
   if p.is_file():baseline[p.relative_to(ROOT).as_posix()]={'owner':'bean/*','beforeSha256':sha(p),'document':json.loads(p.read_text()),'sourceLayouts':True}
  write(BASE,baseline)
 result=json.loads(REPORT.read_text()) if REPORT.exists() else {'status':'in_progress','changes':{},'skippedHistorical':[],'warnings':[],'packerExecution':'NOT RUN: historical generation jobs can re-import old input and are outside this operation.'}
 for name,item in baseline.items():
  p=ROOT/name;owner=item['owner'];original=item['document']
  if name in result['changes']:assert sha(p)==result['changes'][name]['afterSha256'];continue
  assert sha(p)==item['beforeSha256'],f'Concurrent metadata change: {name}'
  ownerchanges={path:r for path,r in changes.items() if owner in r.get('selectedUsers',[]) or any(u.get('owner')==owner for u in r.get('users',[]))}
  def resolve(s):
   if not isinstance(s,str):return None
   if s.startswith(str(ROOT)+'/'):return s[len(str(ROOT))+1:]
   if s.startswith(('DesignAssets/','AnimationCandidates/','tools/')):return s
   if '/' in s or s.endswith(('.png','.webp','.gif')):
    return os.path.normpath(str(p.parent.relative_to(ROOT)/s))
   return None
  def translate(s):
   path=resolve(s);r=ownerchanges.get(path)
   if r:
    dest=r['newImage']
    return (str(ROOT/dest) if s.startswith(str(ROOT)+'/') else dest if s.startswith(('DesignAssets/','AnimationCandidates/','tools/')) else os.path.relpath(ROOT/dest,p.parent)),True
   candidates={r['afterSha256'] for r in ownerchanges.values() if r['beforeSha256']==s}
   if len(candidates)==1:return next(iter(candidates)),True
   return s,False
  def rewrite(o,ctx=None,key=''):
   ctx=dict(ctx or {});affected=ctx.get('affected',False)
   if isinstance(o,str):return translate(o)[0]
   if isinstance(o,list):
    return [rewrite(v,{**ctx,'index':i},key) for i,v in enumerate(o)]
   if not isinstance(o,dict):return o
   old=o;out={};primary=None
   historical_sheet=resolve(old.get('sheet'))
   if historical_sheet and historical_sheet not in ownerchanges and (ROOT/historical_sheet).is_file():return copy.deepcopy(old)
   for f in ('image','sheet','atlas','runtimeAtlas'):
    if resolve(old.get(f)) in ownerchanges:primary=resolve(old[f]);break
   if primary:
    rec=ownerchanges[primary];grid=rec.get('grid',{});ctx.update(image=primary,affected=True,width=grid.get('frameWidth',ctx.get('width')),height=grid.get('frameHeight',ctx.get('height')),columns=grid.get('columns',ctx.get('columns')));affected=True
   if not ctx.get('width'):
    fs=old.get('frameSize',old.get('frameWidth'));ctx['width']=fs[0] if isinstance(fs,list) else fs
   if not ctx.get('height'):ctx['height']=old.get('frameHeight',ctx.get('width'))
   if not ctx.get('columns'):ctx['columns']=old.get('columns')
   w=ctx.get('width');parent_scene=ctx.get('sceneWidth',w)
   for k,v in old.items():
    child=dict(ctx)
    if k=='sceneLayers':child['sceneWidth']=w
    out[k]=rewrite(v,child,k)
   if not affected:
    if old.get('sourceFacing') in ('left','right') and owner in targets and ('actions' in old or 'forms' in old):out['sourceFacing']='left'
    return out
   if num(w):
    for k in ('pivotX','planningPivotX','bodyOnlyPivotX','outletX','anchorX','referencePivotX'):
     if num(old.get(k)):out[k]=w-old[k]
    for k in ('pivot','anchor'):
     if isinstance(old.get(k),list) and len(old[k])==2 and all(num(v) for v in old[k]):out[k]=[w-old[k][0],old[k][1]]
    if key in ('finalBodyAnchor','bodyPivot','bodyFloor','seedFloor','outlet','anchor','floor') and num(old.get('x')):out['x']=w-old['x']
    for k,v in old.items():
     if (('Bounds' in k or 'BBox' in k or k in ('bbox','bounds','neutralBounds')) and k not in ('sourceOpaqueBounds','sourceBodyBounds')):out[k]=rect(v,w)
    if isinstance(old.get('destination'),list) and len(old['destination'])==4:
     x,y,dw,dh=old['destination'];out['destination']=[parent_scene-x-dw,y,dw,dh]
    for k in ('finalBodyMeasurementRegion','polygon','outline'):
     if isinstance(old.get(k),list) and all(isinstance(x,list) and len(x)==2 for x in old[k]):out[k]=[[w-x,y] for x,y in old[k]]
   for k in ('rotationRadians','rotationDegrees'):
    if num(old.get(k)):out[k]=-old[k] if old[k] else 0
   if primary or old.get('sourceFacing') in ('left','right'):out['sourceFacing']='left'
   if 'sourceFacingSign' in old:out['sourceFacingSign']=-1
   if old.get('sourceFacingLabel') in ('left','right'):out['sourceFacingLabel']='left'
   historical_body=resolve(old.get('bodySheet') or old.get('bodyOnlySheet') or old.get('bodySource'))
   if historical_body and historical_body not in ownerchanges:
    for bk in ('bodyPivot','bodyOnlyPivotX'):
     if bk in old:out[bk]=copy.deepcopy(old[bk])
   if old.get('direction')=='right':out['direction']='left'
   if isinstance(old.get('screenDirection'),list) and len(old['screenDirection'])==2:out['screenDirection']=[-old['screenDirection'][0],old['screenDirection'][1]]
   # Source-cell rectangles are extraction boundaries, not points to mirror.
   cell=old.get('sourceCell')
   if isinstance(cell,list) and len(cell)==4:
    rw=cell[2]-cell[0];out['sourceCell']=cell
    if 'sourceOpaqueBounds' in old:out['sourceOpaqueBounds']=rect(old['sourceOpaqueBounds'],rw)
    if isinstance(old.get('wholeFrameOffset'),list) and num(old.get('wholeFrameUniformScale')) and num(w):
     dx,dy=old['wholeFrameOffset'];out['wholeFrameOffset']=[w-dx-round(rw*old['wholeFrameUniformScale']),dy]
   if 'frameSHA256' in old and ctx.get('image') and ctx.get('columns') and num(w):
    i=old.get('index',ctx.get('index'));r=ownerchanges[ctx['image']]
    if isinstance(i,int):
     h=ctx.get('height',w);col=ctx['columns'];im=decoded(r['newImage']);frame=im.crop((i%col*w,i//col*h,(i%col+1)*w,(i//col+1)*h));out['frameSHA256']=hashlib.sha256(frame.tobytes()).hexdigest()
   return out
  if item.get('sourceLayouts'):
   updated=copy.deepcopy(original)
   raw_by_path={e['image']:e for e in plan['rawSourceFiles']}
   for form,actions in original.items():
    if 'bean/'+form not in targets:continue
    for action,layout in actions.items():
     rawpath=resolve(layout.get('source'));raw=raw_by_path.get(rawpath)
     if not raw:continue
     cells=raw['cellRectangles'];boxes=layout.get('boxes',[])
     if len(cells)!=len(boxes):raise ValueError('Raw extraction count mismatch '+rawpath)
     updated[form][action]['boxes']=[[c[0]+c[2]-b[2],b[1],c[0]+c[2]-b[0],b[3]] for c,b in zip(cells,boxes)]
   result.setdefault('sourceLayoutRules',{})[name]='Global source bbox reflected within original per-frame cell: x0New=cellLeft+cellRight-x1Old; x1New=cellLeft+cellRight-x0Old.'
  else:
   top_sheet=resolve(original.get('sheet'))
   if top_sheet and top_sheet not in ownerchanges:
    if name not in result['skippedHistorical']:result['skippedHistorical'].append(name)
    continue
   updated=rewrite(original)
  if updated==original:continue
  if args.apply:
   assert sha(p)==item['beforeSha256'];write(p,updated);after=sha(p)
   result['changes'][name]={'owner':owner,'beforeSha256':item['beforeSha256'],'afterSha256':after,'geometryRule':'Owner-scoped cell-space reflection; source-cell bounds retained, local source bounds mirrored, packed offsets W-oldX-round(rawWidth*scale).','historicalSourcesRetained':True};write(REPORT,result)
  else:result.setdefault('proposed',[]).append(name)
 result['status']='completed' if args.apply else 'dry_run';write(REPORT,result);print(json.dumps({'status':result['status'],'changed':len(result['changes']),'proposed':len(result.get('proposed',[])),'historicalSkipped':len(result['skippedHistorical'])}))
if __name__=='__main__':main()
