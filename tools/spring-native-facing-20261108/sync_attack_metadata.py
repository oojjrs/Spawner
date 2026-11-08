#!/usr/bin/env python3
"""Register regenerated complete attack cells and their exact source copies."""
import json,os
from pathlib import Path
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
validation=json.loads((HERE/'attack-validation.json').read_text())['assets'];derivatives=json.loads((HERE/'attack-alias-preview-changes.json').read_text())
assert derivatives['status']=='completed'
changes=dict(derivatives['changes'])
for row in json.loads((HERE/'attack-integration-map.json').read_text()):
 v=next(v for v in validation if v['key']==row['key'])
 changes[row['sourcePath']]={'newImage':row['sourcePath'],'beforeSha256':v['sourceSHA256'],'afterSha256':row['sha256'],'kind':'nativeWholeBodyRepair'}
bodypaths={p for p,c in changes.items() if c['kind'] in ('nativeWholeBodyRepair','exactSourceAlias')}
hashes={c['beforeSha256']:c['afterSha256'] for c in changes.values()}
def pathkey(value,path):
 if not isinstance(value,str):return None
 if value in changes:return value
 key=os.path.normpath(path.parent.relative_to(ROOT).as_posix()+'/'+value)
 return key if key in changes else None
def tree(v,path):
 if isinstance(v,list):return [tree(c,path) for c in v]
 if not isinstance(v,dict):return v
 out={k:tree(c,path) for k,c in v.items()}
 owned={k:pathkey(value,path) for k,value in v.items() if isinstance(value,str)}
 owned={k:p for k,p in owned.items() if p}
 if owned:
  for k,value in v.items():
   if isinstance(value,str) and value in hashes and ('sha' in k.lower() or 'hash' in k.lower()):out[k]=hashes[value]
  if any(p in bodypaths for p in owned.values()) and ('sourceFacing' in out or 'frameCount' in out):out['sourceFacing']='left'
 return out
files=[]
for folder in ['DesignAssets','AnimationCandidates']:
 for p in (ROOT/folder).rglob('*.json'):
  if p==ROOT/'DesignAssets/image-sizes.json':continue
  s=p.read_text()
  if not any(x in s for x in set(changes)|set(hashes)):continue
  try:old=json.loads(s)
  except json.JSONDecodeError:continue
  new=tree(old,p)
  if new!=old:
   p.write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n');files.append(p.relative_to(ROOT).as_posix())
(HERE/'attack-metadata-changes.json').write_text(json.dumps({'status':'completed','files':files,'changes':changes,'pixelsAndPivotsChangedByMetadataSync':False},indent=2)+'\n')
print(json.dumps(files,indent=2))
