#!/usr/bin/env python3
"""Register published whole-body art, copying sheets byte-exactly.
Only portraits are cropped, exactly to idle cell zero. Missing publications
are skipped so artists can publish tribes incrementally; --complete requires 12.
"""
from pathlib import Path
import argparse, hashlib, json, math, shutil
from PIL import Image
from birth_runtime import trim_bean_birth_review_hold
ROOT = Path(__file__).resolve().parents[1]
FORMS = {'secretion-carapace':18, 'blade-secretion':17, 'blade-secretion-carapace':19}
TRIBES = ('bean','spore','pebble','spring')
# Measured alpha>=16 idle longest dimension. Bean anchors come from packing.
# Pebble birth endpoints measured on final body, excluding the adjacent nest.
NEUTRAL = {
 'bean': {'secretion-carapace':(256,448,220),'blade-secretion':(256,448,262),'blade-secretion-carapace':(256,448,279)},
 'pebble': {'secretion-carapace':(256,448,425),'blade-secretion':(256,450,341),'blade-secretion-carapace':(256,450,362)},
}
BIRTH = {'pebble': {'secretion-carapace':(383,441,184),'blade-secretion':(377,444,160),'blade-secretion-carapace':(382,433,176)}}
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def manifest_path(tribe,form):
 if tribe == 'bean': return ROOT/f'AnimationCandidates/bean-secretion-combos-fullbody-v1-20261107/{form}/publication-manifest.json'
 return ROOT/f'AnimationCandidates/{tribe}-{form}-fullbody-v1-20261107/publication-manifest.json'
def register(policy,path,w,h,cols,rows):
 policy['images'][path.relative_to(ROOT).as_posix()] = dict(display=[256,round(256*h/w,6)],grid=[cols,rows],nativeSource=dict(sha256=sha(path),dimensions=list(Image.open(path).size),frame=[w,h]))
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--complete',action='store_true');args=parser.parse_args()
 policy_path=ROOT/'DesignAssets/image-sizes.json';policy=json.loads(policy_path.read_text());definitions={}
 for tribe in TRIBES:
  for form,mask in FORMS.items():
   path=manifest_path(tribe,form)
   if not path.exists(): continue
   manifest=json.loads(path.read_text());records=manifest['actions'];actions={}
   names=['idle','walk']+(['attack'] if mask&1 else [])+['ranged','hurt','birth','death']
   for action in names:
    record=records.get(action,records.get('ranged-attack') if action=='ranged' else None)
    assert record is not None,(path,action)
    source=ROOT/record['sheet'] if record['sheet'].startswith('AnimationCandidates/') else path.parent/record['sheet']
    assert sha(source)==record['sheetSHA256'],source
    size=record.get('frameSize',manifest.get('frameSize'));w,h=(size,size) if isinstance(size,int) else size
    h=record.get('frameHeight',h);cols=record.get('columns',manifest.get('columns'));count=record.get('frameCount',record.get('frames'));rows=math.ceil(count/cols)
    assert Image.open(source).size==(w*cols,h*rows),(source,w,h,cols,rows)
    assert record.get('durationMs',sum(record['durationsMs']))==sum(record['durationsMs'])
    assert len(record['durationsMs'])==count and all(d>0 for d in record['durationsMs'])
    fallback=NEUTRAL.get(tribe,{}).get(form)
    if action=='birth':
     fallback=BIRTH.get(tribe,{}).get(form)
     if tribe=='bean': fallback=(430,446,NEUTRAL[tribe][form][2]*.15625)
    values=tuple(record.get(k, fallback[i] if fallback else None) for i,k in enumerate(('pivotX','pivotY','referenceLength')))
    # Bean source planning birth pivots describe its body-only source, not scene.
    if action=='birth' and tribe=='bean': values=fallback
    assert all(v is not None for v in values),(path,action,'requires measured registration')
    px,py,length=values
    assert 0<=px<=w and 0<=py<=h and length>0,(path,action,values)
    output=ROOT/'DesignAssets/Animations/SecretionCombosV1'/tribe/form;output.mkdir(parents=True,exist_ok=True)
    dest=output/f'{action}.png';shutil.copyfile(source,dest)
    clip=dict(image=dest.relative_to(ROOT).as_posix(),sourceFacing=record.get('sourceFacing','right'),frameSize=w,frameHeight=h,columns=cols,frameCount=count,durationsMs=record['durationsMs'],durationMs=sum(record['durationsMs']),pivotX=px,pivotY=py,referenceLength=length,viewSize=length,registrationScale=1,loop=action in ('idle','walk'))
    if action=='birth': clip.update(fullScene=True,worldTravelIncludedInPixels=True,sceneAnchor='final-body-floor',sceneIncludesNest=True)
    if action=='birth' and tribe=='bean': trim_bean_birth_review_hold(clip, source)
    if action=='attack':
     # Visually measured peak contact: bean frame6, pebble frame4.
     hit=record.get('hitTimeMs',{'bean':350,'pebble':450}.get(tribe))
     assert hit is not None,(path,'attack needs peak contact timestamp')
     assert hit in [sum(record['durationsMs'][:i]) for i in range(count)]
     clip['hitTimeMs']=hit
    if action=='ranged':
     # Pebble: visually measured charge frames1–2, release/recoil frame3.
     launch=record.get('launchAtMs',470 if tribe=='pebble' else None)
     assert launch is not None,(path,'ranged needs artist release timestamp')
     starts=[sum(record['durationsMs'][:i]) for i in range(count)]
     assert launch in starts and 0<launch<clip['durationMs'],(path,launch,'not a release frame boundary')
     clip.update(rangedBody=True,launchAtMs=launch)
    actions[action]=clip;register(policy,dest,w,h,cols,rows)
    if action=='idle':
     portrait=output/'portrait.png';Image.open(dest).crop((0,0,w,h)).save(portrait);register(policy,portrait,w,h,1,1)
     assert Image.open(portrait).tobytes()==Image.open(source).crop((0,0,w,h)).tobytes()
   definitions[f'{tribe}/{form}']=dict(mask=mask,sourceManifest=path.relative_to(ROOT).as_posix(),portrait=portrait.relative_to(ROOT).as_posix(),reference=actions['idle'],actions=actions)
 if args.complete: assert len(definitions)==12,f'Only {len(definitions)}/12 published forms'
 header='// Generated by scripts/register-secretion-combos.py. Source sheets are byte-exact.\n// Birth scenes own their nest and travel; anchor is the final body floor.\n'
 text=header+'export const SECRETION_COMBO_ACTION_ART = Object.freeze('+json.dumps(definitions,indent=2)+');\n'
 text+='\nexport const SECRETION_COMBO_IMAGE_ASSETS = Object.freeze([...new Set(Object.values(SECRETION_COMBO_ACTION_ART).flatMap(definition => [definition.portrait, ...Object.values(definition.actions).map(action => action.image)]))]);\n'
 (ROOT/'client/secretion-combo-assets.mjs').write_text(text);policy_path.write_text(json.dumps(policy,indent=2)+'\n')
 print(f'Registered {len(definitions)} forms / {sum(len(d["actions"]) for d in definitions.values())} clips')
if __name__=='__main__':main()
