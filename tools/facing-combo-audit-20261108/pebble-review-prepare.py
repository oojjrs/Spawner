from pathlib import Path
import json,hashlib,subprocess
from PIL import Image
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;key='pebble/blade-antenna';F=R/'AnimationCandidates/pebble-blade-antenna-fullbody-v1-20261107';tracked=set(subprocess.check_output(['git','ls-files'],cwd=R,text=True).splitlines());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();catalog=json.loads((H/'pebble-review-catalog-before.json').read_text());form=catalog[key];entries={};previews={};protected={}
def add(path,w,h,role):
 if path not in tracked:protected[path]=sha(R/path);return
 im=Image.open(R/path);iw,ih=im.size;assert iw%w==ih%h==0
 entries[path]=dict(image=path,beforeSha256=sha(R/path),dimensions=[iw,ih],grid=dict(frameWidth=w,frameHeight=h,columns=iw//w,cellCount=iw//w*(ih//h)),cellRectangles=[[x,y,x+w,y+h]for y in range(0,ih,h)for x in range(0,iw,w)],operation='mirror-each-cell',destinationPolicy='in_place_user_confirmed_reflection',destination=path,selectedUsers=[key],protectedUsers=[],roles=[role])
for c in form['actions'].values():add(c['image'],c['frameSize'],c['frameHeight'],'atlas')
p=form['portrait'];w,h=Image.open(R/p).size;add(p,w,h,'portrait')
for p in F.rglob('*'):
 if not p.is_file():continue
 path=p.relative_to(R).as_posix()
 if path not in tracked:protected[path]=sha(p);continue
 if p.suffix.lower()in ['.gif','.webp']:previews[path]=dict(beforeSha256=sha(p),users=[dict(owner=key,manifest=form['sourceManifest'])])
 elif p.suffix.lower()=='.png':
  w,h=Image.open(p).size;fw,fh=(512,512)if p.name.endswith('-sheet.png')else(w,h);add(path,fw,fh,'source-alias')
plan=dict(status='approved',candidateForms=[key],entries=list(entries.values()),previews=previews,publicationPacking=[dict(owner=key,manifest=form['sourceManifest'])]);(H/'pebble-review-plan.json').write_text(json.dumps(plan,indent=2)+'\n');(H/'pebble-review-protected-untracked.json').write_text(json.dumps(protected,indent=2)+'\n');(H/'pebble-review-image-changes.json').write_text(json.dumps(dict(status='in_progress',changes={},pathMap={}),indent=2)+'\n')
for old,new in [('bean-reflect-sources.py','pebble-review-sources.py'),('bean-reflect-preview-one.py','pebble-review-preview-one.py')]: (H/new).write_text((H/old).read_text().replace('bean-reflect-','pebble-review-'))
print(len(entries),'sources;',len(previews),'previews;',len(protected),'protected untracked')
