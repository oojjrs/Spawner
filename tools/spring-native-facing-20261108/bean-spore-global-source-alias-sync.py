#!/usr/bin/env python3
"""Narrow exact-original aliases and approved held-hurt planning preview synchronization."""
from pathlib import Path
import json,hashlib,os,tempfile,runpy
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]; H=Path(__file__).parent
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def put(p,data):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-alias-');os.close(fd)
 try:Path(t).write_bytes(data);os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def save(p,d):put(p,(json.dumps(d,indent=2)+'\n').encode())
def main():
 plan=json.loads((H/'bean-spore-global-source-alias-plan.json').read_text()); report=H/'bean-spore-global-source-alias-changes.json'
 previous=json.loads(report.read_text()) if report.exists() else None
 assert not previous or previous['status']!='completed','Already completed'
 r={'status':'in_progress','changes':{},'pathMap':{},'metadataChanges':{},'preserved':{},'scope':'11 global source-byte-copy aliases plus held-hurt planning preview; no global manifest writes'}
 if previous:r=previous
 registry=json.loads((H/'bean-spore-plan-registry.json').read_text()); protected=json.loads((H/'bean-spore-technical-plan.json').read_text())['preservedForms']
 for name,e in plan['files'].items():
  assert sha(ROOT/name)==(e['afterSha256'] if name in r['changes'] else e['beforeSha256']);assert sha(ROOT/e['copyFrom'])==e['afterSha256'];assert not e['protectedUsers']
  for form in protected:
   for key in ('UNIT_ACTION_ART','UNIT_BIRTH_ART'):
    assert name not in json.dumps(registry[key].get(form,{})),(name,form)
 for name,e in plan['files'].items():
  if name in r['changes']:continue
  a=Image.open(ROOT/name).convert('RGBA'); b=Image.open(ROOT/e['copyFrom']).convert('RGBA');assert a.size==b.size
  rects=e['cellRectangles']; perm=e['framePermutation'] or list(range(len(rects)))
  for i,rect in enumerate(rects):assert a.crop(rect).transpose(Image.Transpose.FLIP_LEFT_RIGHT).tobytes()==b.crop(rects[perm[i]]).tobytes(),(name,i)
  put(ROOT/name,(ROOT/e['copyFrom']).read_bytes()); assert sha(ROOT/name)==e['afterSha256']
  r['changes'][name]={**e,'afterPath':name,'oldImage':name,'newImage':name,'frameWidth':e['grid']['frameWidth'],'frameHeight':e['grid']['frameHeight'],'verification':{'exactNativeBytes':True,'exactPerCellRgbaMirror':True}};r['pathMap'][name]=name;save(report,r);print('alias',name,flush=True)
 helper=runpy.run_path(str(ROOT/'tools/source-facing-normalization-20261108/normalize_source_previews.py'))
 name='DesignAssets/Planning/Animations/BeanHeldHurtV1/secretion.webp';p=ROOT/name;before=sha(p)
 protectedp=ROOT/'DesignAssets/Planning/Animations/BeanHeldHurtV1/antenna.webp';r['preserved'][str(protectedp.relative_to(ROOT))]=sha(protectedp)
 fmt,info,frames,ds=helper['read_frames'](p);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames]
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-planning-',suffix='.webp');os.close(fd)
 try:
  expected[0].save(t,format='WEBP',lossless=True,exact=True,method=4,save_all=True,append_images=expected[1:],duration=ds,loop=info.get('loop',0))
  helper['verify'](expected,t,ds,info)
  source='DesignAssets/Animations/BeanHeldHurtV1/secretion.webp';atlas=Image.open(ROOT/source).convert('RGBA');cols=atlas.width//256
  for i,f in enumerate(expected):
   idx=([12]+list(range(14,24)))[i];crop=atlas.crop(((idx%cols)*256,(idx//cols)*216,(idx%cols+1)*256,(idx//cols+1)*216))
   # Ignore hidden RGB only, matching the animated WebP lossless-visible contract.
   assert f.size==crop.size
   assert all(x==y or x[3]==y[3]==0 for x,y in zip(f.getdata(),crop.getdata())),i
  os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
 r['changes'][name]={'afterPath':name,'beforeSha256':before,'afterSha256':sha(p),'dimensions':list(expected[0].size),'frameCount':len(expected),'durationsMs':ds,'loop':info.get('loop'),'verification':{'exactVisibleRgbaMirror':True,'matchesNormalizedAtlasFrames':[12]+list(range(14,24)),'duplicateFirstTwoFramesCoalescedByWebp':True}}
 j=p.with_suffix('.json');old=json.loads(j.read_text());new=dict(old);new.update(sourceSHA256=sha(ROOT/source),frames=list(range(12,24)),sourceReferenceSHA256=sha(ROOT/old['sourceReference']),previewSHA256=sha(p),sourceFacing='left',side='normalized first impact sequence, now atlas frames 12..23 after side-block swap',purpose='planning-table preview synchronized with normalized left-facing source')
 beforej=sha(j);save(j,new);r['metadataChanges'][str(j.relative_to(ROOT))]={'beforeSha256':beforej,'afterSha256':sha(j),'before':old,'after':new}
 assert sha(protectedp)==next(iter(r['preserved'].values()));r['status']='completed';save(report,r)
 # Verify prior extra outputs without modifying those reports.
 v={'reports':{},'failures':[]}
 for filename in ['bean-spore-extra-image-changes.json','bean-spore-extra-preview-changes.json','bean-spore-extra-source-metadata-changes.json']:
  d=json.loads((H/filename).read_text());assert d['status']=='completed';v['reports'][filename]=len(d['changes'])
  for path,e in d['changes'].items():
   if sha(ROOT/e.get('afterPath',e.get('newImage',path)))!=e['afterSha256']:v['failures'].append(path)
 save(H/'bean-spore-extra-verification.json',v);assert not v['failures'];print('COMPLETE',len(r['changes']),v,flush=True)
if __name__=='__main__':main()
