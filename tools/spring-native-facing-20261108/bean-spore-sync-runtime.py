#!/usr/bin/env python3
"""Reflect source-space registrations after exact native cel normalization.
No runtime reflection is introduced: facing labels describe physically left-facing
assets. Dynamic opponent-facing reflection remains owned by the existing renderer.
"""
import copy, hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
PLAN=json.loads((HERE/'bean-spore-technical-plan.json').read_text())
FORMS=set(PLAN['candidateForms'])
FILES={r['image']:r for r in PLAN['files']+PLAN['rawSourceFiles']}
CHANGES={}
TOUCHED=[]

def num(x):return isinstance(x,(int,float)) and not isinstance(x,bool)
def pathchange(p,owner=None):
 c=CHANGES.get(p)
 if not c:return None
 if FILES.get(p,{}).get('protectedOrOtherUsers') and owner not in FORMS:return None
 return c

def width(obj,p):
 return obj.get('frameSize') or obj.get('frameWidth') or (FILES[p].get('gridVariants') or [{}])[0].get('frameWidth')

def xrect(a,w,xywh=False):
 if isinstance(a,list) and len(a)==4 and all(num(x) for x in a):
  return [w-a[0]-a[2],*a[1:]] if xywh else [w-a[2],a[1],w-a[0],a[3]]
 return a

def geom(obj,w):
 out=copy.deepcopy(obj)
 if num(out.get('pivotX')):out['pivotX']=w-out['pivotX']
 if isinstance(out.get('pivot'),dict) and num(out['pivot'].get('x')):out['pivot']['x']=w-out['pivot']['x']
 if isinstance(out.get('pivot'),list):out['pivot'][0]=w-out['pivot'][0]
 for field in ['outletX']:
  if num(out.get(field)):out[field]=w-out[field]
 for field in ['scene','sceneAnchor']:
  if isinstance(out.get(field),dict):
   for x in ['outletX','x']:
    if num(out[field].get(x)):out[field][x]=w-out[field][x]
 for f in ['bodyBounds','referenceBounds','referenceBodyBBox','finalBodyBounds']:
  if f in out:out[f]=xrect(out[f],w)
 if 'finalBodyMeasurementRegion'in out:out['finalBodyMeasurementRegion']=[[w-x,y] for x,y in out['finalBodyMeasurementRegion']]
 for g in out.get('frameGeometry',{}).values():
  if num(g.get('pivotX')):g['pivotX']=w-g['pivotX']
 return out

def tree(value,owner=None):
 if isinstance(value,list):return [tree(v,owner) for v in value]
 if not isinstance(value,dict):return value
 # Preserve form identity through nested clips/layers, including shared seed source.
 old=value;out={k:tree(v,k if k in FORMS or k in PLAN['preservedForms'] else owner) for k,v in value.items()}
 p=old.get('image');c=pathchange(p,owner)
 if c:
  out['image']=c['afterPath']
  w=width(old,p)
  # A layer's sampling coordinates are transformed by the containing scene clip.
  layer='samples'in old and 'role'in old
  if not layer:
   if w is None:raise ValueError(('Unknown runtime width',p))
   out=geom(out,w);out['sourceFacing']='left'
   if old.get('sceneLayers'):
    for layerout in out['sceneLayers']['layers']:
     for sample in layerout['samples']:
      if sample:sample['destination'][0]=w-sample['destination'][0]-sample['destination'][2]
   permutation=c.get('framePermutation')
   # Canonical hurt references use one block, whereas held-hurt selectors explicitly
   # select impact-side blocks and therefore retain their temporal indices.
   if permutation and permutation!=list(range(len(permutation))) and 'times' not in old:
    original=old.get('frames',list(range(old.get('frameCount',0))))
    out['frames']=[permutation[i] for i in original]
  for k in ['imageHash','sha256','sourceSHA256']:
   if old.get(k)==c['beforeSha256']:out[k]=c['afterSha256']
 # Other explicit source references change only their corresponding source hash.
 for pf,hfs in [('sourceImage',['sourceHash']),('sourceAnimation',['sourceHash','sourceAnimationHash']),('bodyReferenceImage',[])]:
  sc=pathchange(old.get(pf),owner)
  if sc:
   out[pf]=sc['afterPath']
   for hf in hfs:
    if old.get(hf)==sc['beforeSha256']:out[hf]=sc['afterSha256']
 # Portrait references have no source-space geometry in the owner object.
 if pathchange(old.get('portrait'),owner):out['portrait']=CHANGES[old['portrait']]['afterPath']
 return out

def write(p,s):
 before=p.read_text()
 if s!=before:
  p.write_text(s);TOUCHED.append(p.relative_to(ROOT).as_posix())

def matching(s,start):
 depth=0;quote=None;escape=False
 for i in range(start,len(s)):
  ch=s[i]
  if quote:
   if escape:escape=False
   elif ch=='\\':escape=True
   elif ch==quote:quote=None
  elif ch in ['"',"'",'`']:quote=ch
  elif ch=='{':depth+=1
  elif ch=='}':
   depth-=1
   if depth==0:return i+1
 raise ValueError('Unbalanced object')

def json_registry(name,spread=False):
 p=ROOT/name;s=p.read_text();start=s.index('Object.freeze(')+len('Object.freeze(');end=matching(s,start)
 raw=s[start:end];prefix=''
 if spread:
  m=re.match(r'\{\s*((?:\s*\.\.\.[A-Z_]+,\s*)+)',raw)
  assert m
  prefix=m.group(1);raw='{'+raw[m.end():];raw=re.sub(r',\s*}$','}',raw)
 obj=json.loads(raw);out=tree(obj)
 body=json.dumps(out,ensure_ascii=False,indent=2)
 if spread:body='{\n  '+prefix+body[1:]
 write(p,s[:start]+body+s[end:])

def literal_clips(name):
 """Modify only independently parseable JSON clip objects in mixed JS sources."""
 p=ROOT/name;s=p.read_text();edits=[]
 for m in re.finditer(r'\{\s*"image"\s*:',s):
  start=m.start();end=matching(s,start)
  try:obj=json.loads(s[start:end])
  except json.JSONDecodeError:continue
  if obj.get('image') in CHANGES:
   out=tree(obj)
   if out!=obj:edits.append((start,end,json.dumps(out,ensure_ascii=False,indent=2)))
 for a,b,v in reversed(edits):s=s[:a]+v+s[b:]
 write(p,s)

def main():
 global CHANGES
 import sys
 report=json.loads(Path(sys.argv[1]).read_text());CHANGES=report['changes']
 if (HERE/'bean-spore-runtime-changes.json').exists():raise RuntimeError('Already transformed. Do not mirror coordinates twice.')
 completed=set(json.loads((HERE/'bean-spore-runtime-partial.json').read_text())) if (HERE/'bean-spore-runtime-partial.json').exists() else set()
 for name in ['client/antenna-combo-assets.mjs','client/blade-carapace-assets.mjs','client/secretion-combo-assets.mjs','client/defensive-attack-assets.mjs','client/unit-birth-art-assets.mjs','client/bean-held-hurt-assets.mjs','client/species-held-hurt-assets.mjs','client/bean-secretion-idle-assets.mjs','client/sprout-death-animations.mjs']:
  if name in completed:continue
  json_registry(name);completed.add(name);(HERE/'bean-spore-runtime-partial.json').write_text(json.dumps(sorted(completed)))
 if 'client/unit-action-art-assets.mjs' not in completed:
  json_registry('client/unit-action-art-assets.mjs',spread=True);completed.add('client/unit-action-art-assets.mjs');(HERE/'bean-spore-runtime-partial.json').write_text(json.dumps(sorted(completed)))
 # The following sources use small literal clips inside executable expressions.
 literal_clips('client/unit-ranged-assets.mjs')
 literal_clips('client/secretion-idle.mjs')
 literal_clips('client/tribe-minor-animations.mjs')
 (HERE/'bean-spore-runtime-changes.json').write_text(json.dumps({'files':sorted(set(TOUCHED)|completed),'status':'registry-transformed-needs-legacy-followup'},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'files':TOUCHED},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
