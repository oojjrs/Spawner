#!/usr/bin/env python3
import json,copy
from pathlib import Path
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
raw=json.loads((HERE/'raw-changes.json').read_text());assert raw['status']=='completed'
old=json.loads((HERE/'secretion-carapace-antenna-manifest-before.json').read_text())
base=ROOT/'AnimationCandidates/pebble-secretion-carapace-antenna-fullbody-v1-20261107'
p=base/'publication-manifest.json';d=json.loads(p.read_text());changes=raw['changes']
def bounds(box,width):return [width-box[2],box[1],width-box[0],box[3]]
for action,recipe in raw['recipes'].items():
 c=d['actions'][action];before=old['actions'][action];c['sourceFacing']='left'
 if action=='birth':
  c['pivotX']=512-before['pivotX']
  for field in ['bodyBounds','referenceBounds','referenceBodyBBox','finalBodyBounds']:
   if field in before:
    v=before[field];c[field]=[bounds(b,512)for b in v]if isinstance(v[0],list)else bounds(v,512)
  if 'finalBodyMeasurementRegion'in before:c['finalBodyMeasurementRegion']=[[512-x,y]for x,y in before['finalBodyMeasurementRegion']]
 c['sheetSHA256']=changes[c['sheet']]['afterSha256'] if c['sheet']in changes else c['sheetSHA256']
 for pathField,hashField in [('preview','previewSHA256'),('gif','gifSHA256'),('cover','coverSHA256')]:
  if c.get(pathField)in changes:c[hashField]=changes[c[pathField]]['afterSha256']
 c['sourceSHA256']=recipe['rawAfterSha256'];c['rawSource']=recipe['rawImage'];c['rawFrameCells']=recipe['cellRectangles']
 c['packScale']=recipe['packScale'];c.pop('packCrop',None);c['packCropByFrame']=recipe['packCropByFrame'];c['packTranslationByFrame']=recipe['packTranslationByFrame']
 c['packTranslationX']=recipe['packTranslationByFrame'][0][0];c['packTranslationY']=[xy[1]for xy in recipe['packTranslationByFrame']]
 c['sourceBodyBounds']=[bounds(b,rect[2]-rect[0])for b,rect in zip(before['sourceBodyBounds'],recipe['cellRectangles'])]
 c['sourceNormalization']={'operation':'lossless horizontal mirror of each authored cell','rawSourceLocated':True,'exactNormalizedRawRepack':True,'evidence':'tools/secretion-source-normalization-20261108/raw-changes.json'}
d['sourceFacing']='left';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
# The original authoring manifest remains usable and retains its unrelated notes.
p2=base/'manifest.json';other=json.loads(p2.read_text())
for action,c in d['actions'].items():other['actions'][action]={**other['actions'].get(action,{}),**c}
other['sourceFacing']='left'
for field in ['sourceAppearance','sourceAppearanceSHA256']:
 if field in d:other[field]=d[field]
p2.write_text(json.dumps(other,ensure_ascii=False,indent=2)+'\n')
# Runtime source registration: preserve the native clock and vertical geometry.
p3=ROOT/'client/antenna-combo-assets.mjs';s=p3.read_text();start=s.index('Object.freeze(')+len('Object.freeze(');obj,n=json.JSONDecoder().raw_decode(s[start:])
c=obj['pebble/secretion-carapace-antenna']['actions']['birth'];c['sourceFacing']='left';c['pivotX']=512-old['actions']['birth']['pivotX']
p3.write_text(s[:start]+json.dumps(obj,ensure_ascii=False,indent=2)+s[start+n:])
(HERE/'raw-metadata-changes.json').write_text(json.dumps({'status':'completed','files':[p.relative_to(ROOT).as_posix()for p in [p,p2,p3]],'birthPivotX':c['pivotX'],'rawSourcesLocated':6,'perFramePackingVerified':48},indent=2)+'\n')
print('Recovered all six raw sources; native birth pivot',c['pivotX'])
