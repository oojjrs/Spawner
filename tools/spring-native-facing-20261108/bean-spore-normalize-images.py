#!/usr/bin/env python3
"""Execute the explicitly approved 28-form source plan. No registry/manifest writes.
Preserves protected shared originals and content-addressed original layers.
Resume is safe via baseline hashes and the completed per-image journal.
"""
from pathlib import Path
import json,hashlib,os,tempfile,shutil,time
from PIL import Image
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
PLAN=HERE/'bean-spore-technical-plan.json';REPORT=HERE/'bean-spore-image-changes.json';BASELINE=HERE/'bean-spore-image-baseline.json'
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def atomic_json(path,obj):
 fd,tmp=tempfile.mkstemp(dir=HERE,prefix='.bean-spore-journal-')
 try:
  with os.fdopen(fd,'w') as f:json.dump(obj,f,indent=2);f.write('\n')
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def local(name):
 assert not Path(name).is_absolute() and '..' not in Path(name).parts
 p=ROOT/name
 for parent in p.parents:
  if parent==ROOT:break
  assert not parent.is_symlink(),parent
 return p

def prepare(plan):
 entries=[]
 for e in plan['files']:
  if e['image'] in ('DesignAssets/Animations/UnitRangedV1/bean/projectile.png','DesignAssets/Animations/UnitRangedV1/spore/projectile.png'):continue
  assert e['exists'] and e['temporalFrames']==1
  specs=[g for g in e['gridVariants'] if g.get('dimensionsMatch')]
  geometry={(g['frameWidth'],g['frameHeight'],g['columns']) for g in specs};assert len(geometry)==1,e['image']
  fw,fh,cols=next(iter(geometry));w,h=e['dimensions'];cells=[[x,y,x+fw,y+fh] for y in range(0,h,fh) for x in range(0,w,fw)]
  mapping=list(range(len(cells)));special='mirror-each-cell'
  if 'heldHurtTwoSides' in e['roles']:
   lengths={u['timing']['timeFrameCount'] for u in e['users'] if u['role']=='heldHurtTwoSides'};assert len(lengths)==1
   n=next(iter(lengths));assert len(cells)==2*n
   mapping=list(range(n,2*n))+list(range(n));special='mirror-each-cell-and-swap-hit-side-blocks'
  entries.append({'image':e['image'],'beforeSha256':e['sha256'],'dimensions':e['dimensions'],'grid':{'frameWidth':fw,'frameHeight':fh,'columns':cols,'cellCount':len(cells)},'cellRectangles':cells,'sourceToDestinationFrame':mapping,'operation':special,'destinationPolicy':e['proposedOperation'],'destination':e['proposedDestination'],'selectedUsers':e['selectedUsers'],'protectedUsers':e['protectedOrOtherUsers'],'roles':e['roles'],'references':[{'owner':u['owner'],'registry':u['registry'],'route':u['route'],'explicitFrames':u['grid'].get('explicitFrames')} for u in e['users']]})
 for e in plan['rawSourceFiles']:
  cells=e['cellRectangles'];assert cells
  entries.append({'image':e['image'],'beforeSha256':e['sha256'],'dimensions':e['dimensions'],'grid':{'explicitUnevenCells':e['unevenCells'],'cellCount':len(cells),'evidence':e['gridEvidence']},'cellRectangles':cells,'sourceToDestinationFrame':list(range(len(cells))),'operation':'mirror-each-explicit-raw-cell','destinationPolicy':'in_place_only_after_visual_approval','destination':e['image'],'selectedUsers':sorted({u['owner'] for u in e['users']}),'protectedUsers':[],'roles':['rawSource'],'references':e['users'],'rawExtractionRectangles':e.get('sourceExtractionRectangles'),'rawRegistrationBefore':e.get('registrationBefore')})
 assert len({e['image'] for e in entries})==len(entries)
 return entries

def main():
 plan=json.loads(PLAN.read_text());entries=prepare(plan)
 if BASELINE.exists():
  baseline=json.loads(BASELINE.read_text());assert baseline['planSha256']==sha(PLAN)
 else:
  for e in entries:assert sha(local(e['image']))==e['beforeSha256'],e['image']
  baseline={'planSha256':sha(PLAN),'entries':entries,'count':len(entries),'root':str(ROOT),'status':'all-baseline-SHA-verified-before-first-write'};atomic_json(BASELINE,baseline)
 report=json.loads(REPORT.read_text()) if REPORT.exists() else {'status':'in_progress','planSha256':baseline['planSha256'],'changes':{},'pathMap':{},'failures':{}}
 assert report['planSha256']==baseline['planSha256'];cache={}
 for e in entries:
  name=e['image'];source=local(name)
  if name in report['changes']:
   done=report['changes'][name];assert sha(local(done['newImage']))==done['afterSha256'],name
   signature=json.dumps([e['beforeSha256'],e['cellRectangles'],e['sourceToDestinationFrame']]);cache[signature]=done['newImage'];continue
  before=sha(source);assert before==e['beforeSha256'],name
  signature=json.dumps([before,e['cellRectangles'],e['sourceToDestinationFrame']])
  fd,temp=tempfile.mkstemp(dir=source.parent,prefix='.bean-spore-normalize-',suffix=source.suffix);os.close(fd)
  try:
   if signature in cache:
    shutil.copyfile(local(cache[signature]),temp);verification='byte-identical-to-previous-exact-RGBA-transform'
   else:
    with Image.open(source) as im:fmt=im.format;original=im.convert('RGBA')
    assert list(original.size)==e['dimensions'];out=Image.new('RGBA',original.size)
    for i,b in enumerate(e['cellRectangles']):
     target=e['cellRectangles'][e['sourceToDestinationFrame'][i]];patch=original.crop(b).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
     assert patch.size==(target[2]-target[0],target[3]-target[1]);out.paste(patch,target[:2])
    if fmt=='PNG':out.save(temp,format='PNG',compress_level=6)
    elif fmt=='WEBP':out.save(temp,format='WEBP',lossless=True,exact=True,method=0)
    else:raise ValueError('Unsupported format '+fmt)
    with Image.open(temp) as decoded:assert decoded.convert('RGBA').tobytes()==out.tobytes(),name
    verification='exact-decoded-RGBA-every-cell-alpha-and-frame-permutation';original.close();out.close()
   after=sha(Path(temp));dest=e['destination'].replace('<sha256-of-encoded-left-image>',after);target=local(dest)
   if target!=source and target.exists():assert sha(target)==after;os.unlink(temp)
   else:os.replace(temp,target)
   assert sha(target)==after
   if target!=source:assert sha(source)==before
   record={k:v for k,v in e.items() if k not in ('destination','image','destinationPolicy')}
   record.update(oldImage=name,newImage=dest,afterSha256=after,verification={'exactRgbaMirror':True,'alphaExact':True,'dimensionsUnchanged':True,'verifiedBy':verification,'originalPreserved':target!=source},destinationPolicy=e['destinationPolicy'])
   report['changes'][name]=record;report['pathMap'][name]=dest;report['failures'].pop(name,None);cache[signature]=dest;atomic_json(REPORT,report)
   print(json.dumps({'completed':len(report['changes']),'total':len(entries),'image':name,'newPath':dest if dest!=name else None}),flush=True)
  except Exception as ex:
   report['failures'][name]=str(ex);atomic_json(REPORT,report);raise
  finally:
   if os.path.exists(temp):os.unlink(temp)
 report['status']='completed';report['summary']={'files':len(report['changes']),'newPaths':sum(a!=b for a,b in report['pathMap'].items()),'rawFiles':sum('rawSource' in e['roles'] for e in entries),'sideBlockSwaps':sum('swap-hit-side-blocks' in e['operation'] for e in entries),'allExactRgba':True};atomic_json(REPORT,report)
if __name__=='__main__':main()
