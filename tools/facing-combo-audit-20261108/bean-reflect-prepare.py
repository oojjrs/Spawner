from pathlib import Path
import json,hashlib,copy,subprocess
from PIL import Image
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;O=R/'tools/spring-native-facing-20261108';T={'bean/blade-carapace','bean/blade-secretion-carapace-antenna'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();entries={};preview={}
# Evidence records define exact raw-source extraction cells. Later records supersede prior operations.
for folder,fn in [('spring-native-facing-20261108','bean-spore-image-changes.json'),('spring-native-facing-20261108','bean-spore-extra-image-changes.json'),('confirmed-facing-20261108','bean-spore-image-changes.json')]:
 for oldpath,c in json.loads((R/'tools'/folder/fn).read_text())['changes'].items():
  selected=T.intersection(c.get('selectedUsers',[]))
  if not selected:continue
  path=c['newImage'];r=copy.deepcopy(c)
  # Current shared birth paths will be gathered from live scene registrations instead.
  if '/BirthSceneLayersV1/'in path:continue
  r.update(image=path,beforeSha256=sha(R/path),selectedUsers=sorted(selected),protectedUsers=sorted(set(c.get('selectedUsers',[]))-T),roles=c.get('roles',['rawSource' if c.get('kind')=='raw-source' else 'source-alias']))
  r.update(sourceToDestinationFrame=list(range(len(r['cellRectangles']))),operation='mirror-each-cell',destinationPolicy='in_place_user_confirmed_reflection',destination=path)
  for k in ['oldImage','newImage','afterSha256','verification','afterPath','copyFrom','expectedAfterSha256']:r.pop(k,None)
  entries[path]=r
catalog=json.loads((H/'reaudit-current-catalog.json').read_text())['forms']
def visit(o,owner):
 if isinstance(o,list):
  for v in o:visit(v,owner)
 elif isinstance(o,dict):
  p=o.get('image')
  if p and '/BirthSceneLayersV1/'in p:
   w=o.get('frameSize',o.get('frameWidth'));h=o.get('frameHeight',w);iw,ih=Image.open(R/p).size
   if p not in entries:entries[p]=dict(image=p,beforeSha256=sha(R/p),dimensions=[iw,ih],grid=dict(frameWidth=w,frameHeight=h,columns=iw//w,cellCount=iw//w*(ih//h)),cellRectangles=[[x,y,x+w,y+h]for y in range(0,ih,h)for x in range(0,iw,w)],operation='mirror-each-cell',destinationPolicy='copy-content-addressed-shared-layer',destination='DesignAssets/Animations/BirthSceneLayersV1/<sha256-of-encoded-left-image>.png',selectedUsers=[],protectedUsers=['other-forms'],roles=['sceneLayer:'+o.get('role','unknown')])
   if owner not in entries[p]['selectedUsers']:entries[p]['selectedUsers'].append(owner)
  for v in o.values():visit(v,owner)
for key in T:visit(catalog[key],key)
for folder,fn in [('spring-native-facing-20261108','bean-spore-preview-plan.json'),('spring-native-facing-20261108','bean-spore-extra-plan.json'),('confirmed-facing-20261108','plan.json')]:
 d=json.loads((R/'tools'/folder/fn).read_text());rows=d.get('files',d.get('previews',{}))
 for path,c in rows.items():
  users=[u for u in c.get('users',[])if u.get('owner')in T]
  if users:preview[path]=dict(beforeSha256=sha(R/path),users=users)
folders={'bean/blade-carapace':R/'AnimationCandidates/bean-blade-carapace-fullbody-v1-20261107','bean/blade-secretion-carapace-antenna':R/'AnimationCandidates/bean-antenna-combos-fullbody-v1-20261107/blade-secretion-carapace-antenna'}
for key,folder in folders.items():
 for p in folder.glob('*'):
  path=p.relative_to(R).as_posix()
  if subprocess.run(['git','ls-files','--error-unmatch',path],cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:continue
  if p.suffix.lower()in ['.gif','.webp']:preview[path]=dict(beforeSha256=sha(p),users=[dict(owner=key,manifest=str(folder.relative_to(R)/'publication-manifest.json'))])
  elif p.name.endswith('-sheet.png')and path not in entries:
   w,h=Image.open(p).size;assert w%512==h%512==0
   entries[path]=dict(image=path,beforeSha256=sha(p),dimensions=[w,h],grid=dict(frameWidth=512,frameHeight=512,columns=w//512,cellCount=w//512*(h//512)),cellRectangles=[[x,y,x+512,y+512]for y in range(0,h,512)for x in range(0,w,512)],operation='mirror-each-cell',destinationPolicy='in_place_user_confirmed_reflection',destination=path,selectedUsers=[key],protectedUsers=[],roles=['source-alias'])
plan=dict(status='approved',candidateForms=sorted(T),entries=list(entries.values()),previews=preview,publicationPacking=[dict(owner=k,manifest=str(v.relative_to(R)/'publication-manifest.json')) for k,v in folders.items()])
(H/'bean-reflect-plan.json').write_text(json.dumps(plan,indent=2)+'\n');(H/'bean-reflect-image-changes.json').write_text(json.dumps(dict(status='in_progress',changes={},pathMap={}),indent=2)+'\n');print(len(entries),'sources',len(preview),'previews')
# Adapt bounded independently verified helpers, leaving earlier audit evidence intact.
s=(R/'tools/confirmed-facing-20261108/reflect-sources-bounded.py').read_text().split("s=importlib.util.spec_from_file_location('previews'")[0]
s=s.replace("H/'plan.json'","H/'bean-reflect-plan.json'").replace("H/'bean-spore-image-changes.json'","H/'bean-reflect-image-changes.json'")
(H/'bean-reflect-sources.py').write_text(s)
s=(R/'tools/confirmed-facing-20261108/reflect-preview-one.py').read_text().replace("H/'plan.json'","H/'bean-reflect-plan.json'").replace("H/'bean-spore-preview-changes.json'","H/'bean-reflect-preview-changes.json'")
(H/'bean-reflect-preview-one.py').write_text(s)
