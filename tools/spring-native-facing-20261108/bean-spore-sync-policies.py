#!/usr/bin/env python3
"""Update source integrity policy and explicit legacy JSON consumers."""
import copy, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sync',HERE/'bean-spore-sync-runtime.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
if (HERE/'bean-spore-policy-changes.json').exists():raise RuntimeError('This completed source registration is one-shot; do not reflect coordinates twice.')
changes=json.loads((HERE/'bean-spore-image-changes.json').read_text())['changes'];m.CHANGES=changes
allchanges=dict(changes)
for name in ['bean-spore-preview-changes.json','followup13-integration-changes.json']:
 for path,row in json.loads((HERE/name).read_text())['changes'].items():
  if Path(path).suffix.lower()in['.png','.webp','.gif','.jpg']:allchanges[path]=row
files=[]
p=ROOT/'DesignAssets/image-sizes.json';policy=json.loads(p.read_text());count=0
for path,c in allchanges.items():
 if path not in policy['images']:continue
 dest=c.get('afterPath',c.get('newImage',path));entry=copy.deepcopy(policy['images'][path]);native=entry.get('nativeSource')
 if native:native['sha256']=c['afterSha256']
 policy['images'][dest]=entry;count+=1
p.write_text(json.dumps(policy,ensure_ascii=False,indent=2)+'\n');files.append(p.relative_to(ROOT).as_posix())

def apply(v):
 if isinstance(v,list):return [apply(x)for x in v]
 if not isinstance(v,dict):return v
 out={k:apply(x)for k,x in v.items()};path=v.get('image');change=changes.get(path)
 if not change:return out
 # Reflection and owner-specific scene layers are handled by the runtime tree.
 out=m.tree(out)
 if v.get('sourceHash')==change['beforeSha256']:out['sourceHash']=change['afterSha256']
 cm=out.get('cameraMapping')
 if cm and v['cameraMapping'].get('sourceHash')==change['beforeSha256']:
  cm['sourceHash']=change['afterSha256'];cm['offsetX']=512-v['frameSize']*cm['scale']-v['cameraMapping']['offsetX']
 core=out.get('coreReference')
 if core:
  w=v['frameWidth'];old=v['coreReference']
  if 'coreBounds'in core:core['coreBounds']=m.xrect(old['coreBounds'],w,True)
  lm=core.get('landmarks',{})
  for k,a in old.get('landmarks',{}).items():
   if isinstance(a,list)and len(a)==2:lm[k]=[w-a[0],a[1]]
   elif isinstance(a,list)and len(a)==4:lm[k]=m.xrect(a,w,True)
  if 'leftEye'in lm and 'rightEye'in lm:lm['leftEye'],lm['rightEye']=lm['rightEye'],lm['leftEye']
 return out
# This is active legacy source metadata, not archived review evidence. Avoid
# historical pixel snapshots; they deliberately document pre-normalization art.
for p in (ROOT/'DesignAssets/Animations/UnitAppearanceV1').rglob('*.json'):
 if p.name not in ['source.json','motions.json','manifest.json']:continue
 s=p.read_text()
 if not any(path in s for path in changes):continue
 old=json.loads(s);new=apply(old)
 if new!=old:p.write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n');files.append(p.relative_to(ROOT).as_posix())
(HERE/'bean-spore-policy-changes.json').write_text(json.dumps({'files':files,'policyEntries':count},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':files,'policyEntries':count},ensure_ascii=False,indent=2))
