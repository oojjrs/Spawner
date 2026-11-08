#!/usr/bin/env python3
"""Explicit active alias origins; output geometry reflection, historical inputs retained."""
from pathlib import Path
import runpy,json,hashlib,os,tempfile,copy
from PIL import Image
R=Path(__file__).resolve().parents[2];H=Path(__file__).parent
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def put(p,b):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-origin-');os.close(fd)
 try:Path(t).write_bytes(b);os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def save(p,d):put(p,(json.dumps(d,indent=2)+'\n').encode())
def main():
 report=H/'bean-spore-global-source-metadata-changes.json';assert not report.exists()
 plan=json.loads((H/'bean-spore-global-source-alias-plan.json').read_text());helper=runpy.run_path(str(R/'tools/source-facing-normalization-20261108/normalize_source_previews.py'));allchanges={}
 for f in ['bean-spore-image-changes.json','bean-spore-preview-changes.json','bean-spore-extra-image-changes.json','bean-spore-extra-preview-changes.json','bean-spore-global-source-alias-changes.json']:allchanges.update(json.loads((H/f).read_text())['changes'])
 baseline={};r={'status':'in_progress','changes':{},'previewChanges':{},'historicalInputPolicy':'Raw generation inputs retained; output sheet coordinate records reflected once; re-generation requires final per-cell mirror. Packers not reexecuted.','sharingVerification':{'globalActionsOwnersChecked':True,'protectedSixUnitActionAndBirthRegistryChecked':True,'protectedShares':[]}}
 for path,e in plan['files'].items():
  for name in e['sourceMetadata']:
   if not name.endswith('.json'):continue
   p=R/name;doc=json.loads(p.read_text());baseline[name]={'beforeSha256':sha(p),'document':doc,'alias':path}
 save(H/'bean-spore-global-source-metadata-baseline.json',baseline)
 for name,base in baseline.items():
  p=R/name;old=base['document'];new=copy.deepcopy(old);entry=plan['files'][base['alias']];W=entry['grid']['frameWidth']
  prev=old.get('preview');q=(R/prev if prev and prev.startswith(('AnimationCandidates/','DesignAssets/')) else p.parent/prev) if prev else None
  if q and q.exists() and q.relative_to(R).as_posix() not in allchanges:
   pn=q.relative_to(R).as_posix();before=sha(q);fmt,info,fs,ds=helper['read_frames'](q);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in fs];fd,t=tempfile.mkstemp(dir=q.parent,suffix=q.suffix,prefix='.bean-spore-origin-preview-');os.close(fd)
   try:
    if fmt=='GIF':Path(t).write_bytes(helper['mirror_gif'](q.read_bytes()))
    else:expected[0].save(t,format='WEBP',lossless=True,exact=True,save_all=True,append_images=expected[1:],duration=ds,loop=info.get('loop',0))
    helper['verify'](expected,t,ds,info);os.replace(t,q)
   finally:
    if os.path.exists(t):os.unlink(t)
   v={'beforeSha256':before,'afterSha256':sha(q),'afterPath':pn,'dimensions':list(fs[0].size),'frameCount':len(fs),'durationsMs':ds,'loop':info.get('loop'),'verification':{'exactVisibleRgbaMirror':True,'timingAndLoopPreserved':True}};r['previewChanges'][pn]=v;allchanges[pn]=v
  def rec(o):
   if isinstance(o,str):
    vals={v['afterSha256'] for v in allchanges.values() if v['beforeSha256']==o};return next(iter(vals)) if len(vals)==1 else o
   if isinstance(o,list):return [rec(v) for v in o]
   if isinstance(o,dict):return {k:rec(v) for k,v in o.items()}
   return o
  new=rec(new)
  for k in ('pivotX','planningPivotX'):
   if isinstance(old.get(k),(int,float)):new[k]=W-old[k]
  # Historical authoring poses/records stay in their original source coordinate space.
  for collection in ['sourceFrameRegistration','cells']:
   for a,b in zip(old.get(collection,[]),new.get(collection,[])):
    for k in ['opaqueBounds','bboxAlpha128']:
     if k in a:x0,y0,x1,y1=a[k];b[k]=[W-x1,y0,W-x0,y1]
    for k,widthkey in [('destinationOffset','wholeFrameBounds'),('wholeFrameTranslation','sourceBox')]:
     if k in a and widthkey in a:
      x0,y0,x1,y1=a[widthkey];b[k]=[W-a[k][0]-(x1-x0),a[k][1]]
  for k in ['nativeCombatFacing','impactFrom','reactionTowards']:
   if old.get(k) in ['left','right']:new[k]='left' if old[k]=='right' else 'right'
  new['sourceFacing']='left';new['sheetSHA256']=sha(R/base['alias'])
  if q and q.exists():new['previewSHA256']=sha(q)
  new['sourceNormalization']={'operation':'exact horizontal mirror within each output atlas cell','frameWidth':W,'frameHeight':entry['grid']['frameHeight'],'beforeSheetSHA256':entry['beforeSha256'],'afterSheetSHA256':entry['afterSha256'],'historicalGenerationInputsRetained':True,'authoringPosesAndRecordsRemainHistorical':True,'reproduction':'Generate historical sheet then mirror each output cell; no packer execution performed.'}
  assert sha(p)==base['beforeSha256'];save(p,new);r['changes'][name]={'beforeSha256':base['beforeSha256'],'afterSha256':sha(p),'alias':base['alias'],'preservedHistoricalFields':['sourceCell','sourceBox','wholeFrameBounds','poses','records']};save(report,r);print(name,flush=True)
 r['status']='completed';save(report,r);print('COMPLETE',len(r['changes']),len(r['previewChanges']),flush=True)
if __name__=='__main__':main()
