#!/usr/bin/env python3
"""Describe already-left-facing Spring idle/walk sources; never alter pixels or pivots."""
import json,re,os,tempfile
from pathlib import Path
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
records=json.loads((HERE/'original-clips.json').read_text())
if (HERE/'additional-original-clips.json').exists():records+=json.loads((HERE/'additional-original-clips.json').read_text())
images={c['before']['image'] for c in records};hashes={c['sourceSha256'] for c in records}
def write(p,s):
 if p.read_text()==s:return
 fd,tmp=tempfile.mkstemp(prefix='.source-label-',dir=p.parent)
 with os.fdopen(fd,'w')as f:f.write(s)
 os.replace(tmp,p);changed.append(p.relative_to(ROOT).as_posix())
changed=[]
for name in ['unit-action-art-assets.mjs','antenna-combo-assets.mjs','blade-carapace-assets.mjs','secretion-combo-assets.mjs']:
 p=ROOT/'client'/name;s=p.read_text()
 for image in images:
  pat=r'("image":\s*'+re.escape(json.dumps(image))+r',[^{}]*?"sourceFacing":\s*)"right"'
  s=re.sub(pat,r'\1"left"',s)
 write(p,s)
# Legacy fallback definitions also describe their native direction explicitly.
for name in ['unit-animation.mjs','unit-appearance-assets.mjs']:
 p=ROOT/'client'/name;s=p.read_text()
 for image in images:
  pat=r'("image":\s*'+re.escape(json.dumps(image))+r',)(?!\s*"sourceFacing")'
  s=re.sub(pat,r'\1 "sourceFacing": "left",',s)
 write(p,s)
def tree(v):
 if isinstance(v,list):return [tree(c)for c in v]
 if not isinstance(v,dict):return v
 out={k:tree(c)for k,c in v.items()}
 is_clip=any(v.get(k)in images for k in ['image','sheet','atlas','runtimeAtlas'] if isinstance(v.get(k),str))or any(v.get(k)in hashes for k in ['sheetSHA256','imageHash','atlasSHA256'] if isinstance(v.get(k),str))
 if is_clip and ('sourceFacing'in v or ('frameCount'in v and ('sheet'in v or 'image'in v))):out['sourceFacing']='left'
 return out
for folder in ['AnimationCandidates','DesignAssets']:
 for p in (ROOT/folder).rglob('*.json'):
  if p == ROOT/'DesignAssets/image-sizes.json':continue
  s=p.read_text()
  if not any(x in s for x in images|hashes):continue
  try:d=json.loads(s)
  except json.JSONDecodeError:continue
  out=tree(d)
  if out!=d:write(p,json.dumps(out,ensure_ascii=False,indent=2)+'\n')
previous=json.loads((HERE/'label-changes.json').read_text()) if (HERE/'label-changes.json').exists() else {}
changed=sorted(set(previous.get('files',[])+changed))
(HERE/'label-changes.json').write_text(json.dumps({'status':'completed','clips':len(records),'images':sorted(images),'files':changed,'pixelsChanged':False,'pivotsChanged':False},indent=2)+'\n')
print(json.dumps(changed,indent=2))
