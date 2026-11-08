"""Integrate only art modules into both existing user bundles and owned commit blobs."""
from pathlib import Path
import json,re,subprocess,hashlib
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent
changes=json.loads((H/'bean-reflect-image-changes.json').read_text())['changes']
allowed=set(changes)|{v['newImage']for v in changes.values()}
modules=['client/antenna-combo-assets.mjs','client/blade-carapace-assets.mjs','client/unit-birth-art-assets.mjs','client/unit-appearance-assets.mjs']
reports={}
for bundle in ['client/runtime.js','Combat.html']:
 built=(R/bundle).read_bytes().decode();head=subprocess.check_output(['git','show','HEAD:'+bundle],cwd=R).decode();prior=(H/('bean-reflect-worktree-before-'+Path(bundle).name)).read_bytes().decode()
 def merge(old):
  out=old;used=[]
  for module in modules:
   pattern=r'^modules\['+re.escape(json.dumps(module))+r'\] = \(\(\) => \{\r?\n[\s\S]*?^return \{ [^\r\n]* \};\r?\n\}\)\(\);'
   a=re.search(pattern,old,re.M);b=re.search(pattern,built,re.M);assert bool(a)==bool(b),(bundle,module)
   if a and a[0]!=b[0]:out=re.sub(pattern,lambda _:b[0],out,count=1,flags=re.M);used.append(module)
  if bundle=='client/runtime.js':
   pattern=r'(?<=, assets: )\{[^\r\n]*\}(?= \}\);\r?\n\}\)\(\);)'
   a=re.search(pattern,old);b=re.search(pattern,built);assert a and b
   oldAssets=json.loads(a[0]);newAssets=json.loads(b[0]);outAssets=dict(oldAssets)
   for key in set(oldAssets)|set(newAssets):
    if oldAssets.get(key)==newAssets.get(key):continue
    assert key in allowed or oldAssets.get(key)in allowed or newAssets.get(key)in allowed,(bundle,'unowned asset diff',key)
    if key in newAssets:outAssets[key]=newAssets[key]
    else:outAssets.pop(key,None)
   if oldAssets!=outAssets:out=re.sub(pattern,lambda _:json.dumps(outAssets,separators=(',',':')),out,count=1)
  return out,used
 owned,used=merge(head);working,usedWorking=merge(prior)
 (H/('bean-reflect-owned-'+Path(bundle).name)).write_bytes(owned.encode())
 (R/bundle).write_bytes(working.encode())
 # User's preexisting source text remains unchanged outside owned modules/assets.
 assert merge(prior)[0]==working
 reports[bundle]={'modules':used,'worktreeModules':usedWorking,'ownedSha256':hashlib.sha256(owned.encode()).hexdigest(),'worktreeBeforeSha256':hashlib.sha256(prior.encode()).hexdigest(),'worktreeAfterSha256':hashlib.sha256(working.encode()).hexdigest(),'userUnownedBytesPreserved':True}
(H/'bean-reflect-bundle-integration.json').write_text(json.dumps(reports,indent=2)+'\n');print(json.dumps(reports,indent=2))
