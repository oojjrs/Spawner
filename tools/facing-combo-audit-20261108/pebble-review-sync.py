from pathlib import Path
import json,hashlib,types,copy
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;O=R/'tools/spring-native-facing-20261108';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();plan=json.loads((H/'pebble-review-plan.json').read_text());ir=json.loads((H/'pebble-review-image-changes.json').read_text());pr=json.loads((H/'pebble-review-preview-changes.json').read_text());assert ir['status']==pr['status']=='completed';changes={**ir['changes'],**pr['changes']};key='pebble/blade-antenna';assert not(H/'pebble-review-metadata-done.json').exists()
m=types.ModuleType('runtime');m.__file__=str(O/'bean-spore-sync-runtime.py');exec(compile(Path(m.__file__).read_text(),m.__file__,'exec'),m.__dict__);m.FORMS={key};m.PLAN={'candidateForms':[key],'preservedForms':list(json.loads((H/'pebble-review-catalog-before.json').read_text()))};m.FILES={e['image']:{'gridVariants':[e['grid']],'protectedOrOtherUsers':['nonselected']} for e in plan['entries']};m.CHANGES={k:{**v,'afterPath':v['newImage']}for k,v in ir['changes'].items()}
file='client/antenna-combo-assets.mjs';before={file:(R/file).read_text()};m.json_registry(file)
# Scoped current publication data. Retain raw-source packCrop/sourceBodyBounds because those untracked source images are explicitly protected.
file=plan['publicationPacking'][0]['manifest'];p=R/file;before[file]=p.read_text();d=json.loads(before[file])
def hashes(o):
 if isinstance(o,str):
  found={v['afterSha256']for v in changes.values()if v['beforeSha256']==o};return next(iter(found))if len(found)==1 else o
 if isinstance(o,list):return[hashes(v)for v in o]
 if isinstance(o,dict):return{k:hashes(v)for k,v in o.items()}
 return o
def rect(o,w):
 if isinstance(o,list)and len(o)==4 and all(isinstance(v,(int,float))for v in o):return[w-o[2],o[1],w-o[0],o[3]]
 if isinstance(o,list):return[rect(v,w)for v in o]
 return o
d=hashes(d)
for action,c in d['actions'].items():
 if c.get('sheet')not in ir['changes']:continue
 w=c.get('frameSize',512)
 for field in ['pivotX','planningPivotX','outletX']:
  if isinstance(c.get(field),(int,float)):c[field]=w-c[field]
 for field in ['bodyBounds','referenceBounds','referenceBodyBBox','finalBodyBounds']:
  if field in c:c[field]=rect(c[field],w)
 if 'finalBodyMeasurementRegion'in c:c['finalBodyMeasurementRegion']=[[w-x,y]for x,y in c['finalBodyMeasurementRegion']]
 c['sourceFacing']='left'
d['sourceFacing']='left';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
file='DesignAssets/image-sizes.json';p=R/file;before[file]=p.read_text();d=json.loads(before[file])
for path,c in changes.items():
 if path in d.get('images',{}):d['images'][path]=hashes(d['images'][path])
s=json.dumps(d,ensure_ascii=False,indent=2)+'\n'
if s!=before[file]:p.write_text(s)
(H/'pebble-review-metadata-before.json').write_text(json.dumps(before,indent=2)+'\n');touched={n:dict(beforeSha256=hashlib.sha256(s.encode()).hexdigest(),afterSha256=sha(R/n))for n,s in before.items()if s!=(R/n).read_text()};(H/'pebble-review-metadata-done.json').write_text(json.dumps({'changes':touched,'rawSourceMetadataPolicy':'Untracked original raw sources and authoring coordinates preserved; output atlas geometry and hashes reflected. No historical importer or packer rerun.'},indent=2)+'\n');print(touched)
