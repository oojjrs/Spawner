#!/usr/bin/env python3
"""Keep existing fallback registrations consistent with transformed source pixels."""
import importlib.util, json, re, copy
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sync',HERE/'bean-spore-sync-runtime.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ROOT=mod.ROOT

def main():
 if (HERE/'bean-spore-legacy-changes.json').exists():raise RuntimeError('Legacy coordinates already reflected; do not apply twice.')
 report=json.loads((HERE/'bean-spore-image-changes.json').read_text());mod.CHANGES=report['changes']
 # Explicit native registrations are applied after imageScale in imageAnimation.
 p=ROOT/'client/unit-sprite-registration.mjs';s=p.read_text()
 pattern=r'("([^"]+)"\s*:\s*Object\.freeze\()'
 edits=[]
 for m in re.finditer(pattern,s):
  path=m.group(2)
  if path not in mod.CHANGES:continue
  start=m.end();end=mod.matching(s,start);obj=json.loads(s[start:end]);out=mod.geom(obj,obj['frameSize']);out['sourceFacing']='left'
  edits.append((start,end,json.dumps(out,separators=(',',':'))))
 for a,b,v in reversed(edits):s=s[:a]+v+s[b:]
 mod.write(p,s)
 # Legacy source descriptors are expressed in the old 512 source camera. Reflect
 # that camera, not the separately registered/cropped native cell dimensions.
 for name in ['client/unit-animation.mjs','client/agent-death.mjs','client/birth.mjs']:
  p=ROOT/name;s=p.read_text();edits=[]
  for m in re.finditer(r'\{\s*(?:"image"|image)\s*:\s*"([^"]+)"',s):
   path=m.group(1)
   if path not in mod.CHANGES:continue
   start=m.start();end=mod.matching(s,start);v=s[start:end]
   w=re.search(r'(?:"frameSize"|frameSize)\s*:\s*([\d.]+)',v)
   if not w:continue
   width=float(w.group(1))
   for field in ['pivotX','outletX']:
    v=re.sub(r'((?:"'+field+r'"|'+field+r')\s*:\s*)([\d.]+)',lambda m:m[1]+str(width-float(m[2])),v)
   if 'sourceFacing'in v:v=re.sub(r'((?:"sourceFacing"|sourceFacing)\s*:\s*)"right"',r'\1"left"',v)
   else:v=v.replace('image', 'sourceFacing: "left", image',1) if '"image"' not in v else v.replace('"image"','"sourceFacing": "left", "image"',1)
   edits.append((start,end,v))
  for a,b,v in reversed(edits):s=s[:a]+v+s[b:]
  mod.write(p,s)
 # Alternate ranged factories generate their own path rather than declaring it
 # literally. Only the two physically normalized species change registrations.
 for name,needle,rep in [
 ('client/secretion-walk.mjs','frameSize: 512, viewSize: 512, pivotX: 256, pivotY: 448, columns: 4,','frameSize: 512, viewSize: 512, pivotX: 256, pivotY: 448, columns: 4,\n      ...(["bean", "spore"].includes(tribe) ? { sourceFacing: "left" } : {}),'),
 ('client/unit-ranged.mjs','pivotX: 256, pivotY: 448, frameCount: 16, durationMs: 760,','pivotX: 256, pivotY: 448, frameCount: 16, durationMs: 760,\n    ...(["bean", "spore"].includes(tribe) ? { sourceFacing: "left" } : {}),'),
 ('client/secretion-lifecycle.mjs','bodyReferenceImage: body.image, secretionLifecycle: true,','bodyReferenceImage: body.image, secretionLifecycle: true,\n      ...(["bean", "spore"].includes(tribe) ? { sourceFacing: "left" } : {}),')]:
  p=ROOT/name;s=p.read_text();assert needle in s;mod.write(p,s.replace(needle,rep,1))
 p=ROOT/'client/unit-ranged.mjs';s=p.read_text()
 for suffix in ['Source/neutral.png','shoot.webp']:
  s=s.replace('image: root + "'+suffix+'",','image: root + "'+suffix+'", sourceFacing: "left",')
 # Projectile sprites and right-facing world launch anchors are independent of native body-facing registration.
 # Legacy appearance descriptors retain art pixels and track their new content.
 p=ROOT/'client/unit-appearance-assets.mjs';s=p.read_text();start=s.index('Object.freeze(')+len('Object.freeze(');end=mod.matching(s,start);obj=json.loads(s[start:end]);out=mod.tree(obj)
 hashes={v['beforeSha256']:v for v in mod.CHANGES.values() if v.get('oldImage',v.get('oldPath'))==v['afterPath']}
 for key,entry in out.items():
  src=entry.get('source');oldsrc=obj[key].get('source')
  if not src or oldsrc.get('sourceHash')not in hashes:continue
  c=hashes[oldsrc['sourceHash']];src['sourceHash']=c['afterSha256'];w=src['frameWidth']
  if isinstance(src.get('pivot'),dict):src['pivot']['x']=w-oldsrc['pivot']['x']
  core=src.get('coreReference',{});oldcore=oldsrc.get('coreReference',{})
  if 'coreBounds'in core:core['coreBounds']=mod.xrect(oldcore['coreBounds'],w,True)
  lm=core.get('landmarks',{})
  for k,v in oldcore.get('landmarks',{}).items():
   if isinstance(v,list)and len(v)==2:lm[k]=[w-v[0],v[1]]
   elif isinstance(v,list)and len(v)==4:lm[k]=mod.xrect(v,w,True)
  if 'leftEye'in lm and 'rightEye'in lm:lm['leftEye'],lm['rightEye']=lm['rightEye'],lm['leftEye']
  src['sourceNormalization']={'operation':'lossless native cell horizontal reflection','beforeSha256':c['beforeSha256'],'sourceFacing':'left'}
 mod.write(p,s[:start]+json.dumps(out,ensure_ascii=False,indent=2)+s[end:])
 (HERE/'bean-spore-legacy-changes.json').write_text(json.dumps({'files':mod.TOUCHED},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(mod.TOUCHED,ensure_ascii=False))
if __name__=='__main__':main()
