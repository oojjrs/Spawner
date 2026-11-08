#!/usr/bin/env python3
"""Synchronize active global descriptors, leaving historical rig snapshots intact."""
import copy,hashlib,importlib.util,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('sync',HERE/'bean-spore-sync-runtime.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
if (HERE/'bean-spore-global-manifest-changes.json').exists():raise RuntimeError('This completed source registration is one-shot; do not reflect coordinates twice.')
changes=json.loads((HERE/'bean-spore-image-changes.json').read_text())['changes'];m.CHANGES=changes

def resolve(p,file):
 if not isinstance(p,str):return None
 if p in changes:return p
 candidate=os.path.normpath(str(file.parent.relative_to(ROOT)/p));return candidate if candidate in changes else None

def tree(old,file,owner=None):
 if isinstance(old,list):return [tree(x,file,owner)for x in old]
 if not isinstance(old,dict):return old
 if 'slot'in old:owner='/'.join(old['slot'].split('/')[:2])
 out={k:tree(v,file,owner)for k,v in old.items()}
 paths=[p for v in old.values()if(p:=resolve(v,file))]
 # Hash fields belong only to paths explicitly named in the same record.
 for path in paths:
  c=changes[path]
  for k,v in old.items():
   if v==c['beforeSha256'] and ('hash'in k.lower()or'sha'in k.lower()):out[k]=c['afterSha256']
 own=resolve(old.get('image'),file)
 if own and 'frameSize'in old:
  # Use one-level geometry reflection: nested clip records were already visited.
  w=old['frameSize'];out=m.geom(out,w);out['sourceFacing']='left'
  c=changes[own];out['image']=c['afterPath']
  if c['framePermutation']!=list(range(len(c['framePermutation']))) and 'times'not in old:
   out['frames']=[c['framePermutation'][i]for i in old.get('frames',range(old.get('frameCount',0)))]
 if own and isinstance(old.get('calibration'),dict):
  w=changes[own]['frameWidth'];cal=out['calibration'];prev=old['calibration']
  if 'bounds'in cal:cal['bounds']=m.xrect(prev['bounds'],w,True)
  if 'pivot'in cal:cal['pivot'][0]=w-prev['pivot'][0]
 return out
files=[]
for name in ['DesignAssets/Animations/ApprovedActionsV1/actions-manifest.json','DesignAssets/Animations/ApprovedActionsV1/birth-manifest.json','DesignAssets/Animations/TribeMinorV1/manifest.json']:
 p=ROOT/name;old=json.loads(p.read_text());out=tree(old,p)
 if name.endswith('/actions-manifest.json'):out['registrySha256']=hashlib.sha256((ROOT/out['registry']).read_bytes()).hexdigest()
 if out!=old:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');files.append(name)
(HERE/'bean-spore-global-manifest-changes.json').write_text(json.dumps({'files':files,'historicalRigMetadataNotRebound':True},ensure_ascii=False,indent=2)+'\n')
print(files)
