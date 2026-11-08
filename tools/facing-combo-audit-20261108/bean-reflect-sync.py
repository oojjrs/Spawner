from pathlib import Path
import json,sys,types,copy,hashlib
H=Path(__file__).resolve().parent;R=H.parents[1];O=R/'tools/spring-native-facing-20261108';plan=json.loads((H/'bean-reflect-plan.json').read_text());changes=json.loads((H/'bean-reflect-image-changes.json').read_text());assert changes['status']=='completed'
def module(name,file):
 m=types.ModuleType(name);m.__file__=str(O/file);exec(compile((O/file).read_text(),m.__file__,'exec'),m.__dict__);return m
technical={'candidateForms':plan['candidateForms'],'preservedForms':list(set(json.loads((H/'reaudit-current-catalog.json').read_text())['forms'])-set(plan['candidateForms'])),'publicationPacking':plan['publicationPacking'],'files':[],'rawSourceFiles':[]}
for e in plan['entries']:
 technical['files'].append({'image':e['image'],'protectedOrOtherUsers':['all-nonselected-forms'],'gridVariants':[e['grid']]})
 if 'rawSource'in e['roles']:technical['rawSourceFiles'].append({'image':e['image'],'cellRectangles':e['cellRectangles']})
(H/'bean-reflect-technical-plan.json').write_text(json.dumps(technical,indent=2)+'\n')
if not(H/'bean-reflect-runtime-done.json').exists():
 m=module('runtime','bean-spore-sync-runtime.py');m.HERE=H;m.PLAN=technical;m.FORMS=set(technical['candidateForms']);m.FILES={e['image']:e for e in technical['files']};m.CHANGES={k:{**v,'afterPath':v['newImage']} for k,v in changes['changes'].items()}
 names=['client/antenna-combo-assets.mjs','client/blade-carapace-assets.mjs','client/unit-birth-art-assets.mjs','client/unit-action-art-assets.mjs']
 baseline={n:(R/n).read_text()for n in names};(H/'bean-reflect-runtime-before.json').write_text(json.dumps(baseline))
 for name in names:m.json_registry(name,spread=name.endswith('unit-action-art-assets.mjs'))
 (H/'bean-reflect-runtime-done.json').write_text(json.dumps(m.TOUCHED))
if '--sources'not in sys.argv:raise SystemExit()
assert json.loads((H/'bean-reflect-preview-changes.json').read_text())['status']=='completed'
m=types.ModuleType('metadata');m.__file__=str(O/'bean-spore-sync-source-manifests.py');s=Path(m.__file__).read_text().replace('bean-spore-','bean-reflect-');s=s.replace('old=o;out={};primary=None', "old=o;out={};primary=None\n   historical_sheet=resolve(old.get('sheet'))\n   if historical_sheet and historical_sheet not in ownerchanges and (ROOT/historical_sheet).is_file():return copy.deepcopy(old)");exec(compile(s,m.__file__,'exec'),m.__dict__);m.HERE=H;m.REPORT=H/'bean-reflect-source-metadata-changes.json';m.BASE=H/'bean-reflect-source-metadata-baseline.json';sys.argv=['sync','--apply'];m.main()
# Only authoritative neutral image 17 is in this selected source set. 03 is not a reflected source.
allchanges={**changes['changes'],**json.loads((H/'bean-reflect-preview-changes.json').read_text())['changes']};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def hashes(o):
 if isinstance(o,str):
  values={v['afterSha256']for v in allchanges.values()if v['beforeSha256']==o};return next(iter(values))if len(values)==1 else o
 if isinstance(o,list):return[hashes(v)for v in o]
 if isinstance(o,dict):return{k:hashes(v)for k,v in o.items()}
 return o
if not(H/'bean-reflect-neutral-done.json').exists():
 p=R/'DesignAssets/Animations/UnitAppearanceV1/bean/17/source.json';old=json.loads(p.read_text());d=hashes(old);W=old['frameWidth'];d['sourceFacing']='left';d['sourceHash']=sha(R/d['image'])
 if isinstance(d.get('pivot'),dict):d['pivot']['x']=W-d['pivot']['x']
 landmarks=d.get('coreReference',{}).get('landmarks',{})
 for key,value in landmarks.items():
  if isinstance(value,list)and len(value)==2:value[0]=W-value[0]
  elif key=='supportPixelBounds'and isinstance(value,list):value[0]=W-value[0]-value[2]
 if 'leftEye'in landmarks and 'rightEye'in landmarks:landmarks['leftEye'],landmarks['rightEye']=landmarks['rightEye'],landmarks['leftEye']
 box=d.get('coreReference',{}).get('measurement',{}).get('sourcePixelBounds')
 if isinstance(box,dict):box['x']=W-box['x']-box['width']
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');(H/'bean-reflect-neutral-done.json').write_text(json.dumps({str(p.relative_to(R)):old},indent=2)+'\n')
for entry in plan['publicationPacking']:
 p=R/entry['manifest'];d=json.loads(p.read_text())
 if 'geometry'in d:
  d['geometry']['sourceFacing']='left';d['geometry']['sourceFacingSign']=-1;d['geometry']['pivotX']=d['actions']['idle']['pivotX'];d['geometry']['pivotY']=d['actions']['idle']['pivotY'];p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=R/'DesignAssets/image-sizes.json';d=json.loads(p.read_text())
for path,c in allchanges.items():
 if path in d.get('images',{}):d['images'][c['newImage']]=hashes(copy.deepcopy(d['images'][path]))
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('scoped metadata completed')
