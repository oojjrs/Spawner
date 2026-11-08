#!/usr/bin/env python3
"""Exact visible-RGBA temporal mirror for explicitly linked selected-form previews."""
from pathlib import Path
import runpy,json,hashlib,os,tempfile,shutil
from PIL import Image
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
HELP=runpy.run_path(str(ROOT/'tools/source-facing-normalization-20261108/normalize_source_previews.py'))
PLAN=HERE/'bean-spore-preview-plan.json';REPORT=HERE/'bean-spore-preview-changes.json'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def journal(obj):
 fd,t=tempfile.mkstemp(dir=HERE,prefix='.bean-spore-preview-journal-')
 try:
  with os.fdopen(fd,'w') as f:json.dump(obj,f,indent=2);f.write('\n')
  os.replace(t,REPORT)
 finally:
  if os.path.exists(t):os.unlink(t)
def main():
 plan=json.loads(PLAN.read_text());r=json.loads(REPORT.read_text()) if REPORT.exists() else {'status':'in_progress','planSha256':sha(PLAN),'changes':{},'failures':{}}
 assert r['planSha256']==sha(PLAN)
 source_names={e['image'] for e in json.loads((HERE/'bean-spore-image-baseline.json').read_text())['entries']};assert not source_names&set(plan['files'])
 for name,e in plan['files'].items():
  if name in r['changes']:assert sha(ROOT/name)==r['changes'][name]['afterSha256'];continue
  assert sha(ROOT/name)==e['beforeSha256'],name
 # Process one temporal sequence at a time; verify before replacing any original.
 for name,e in plan['files'].items():
  if name in r['changes']:continue
  p=ROOT/name;before=sha(p);fmt,info,frames,ds=HELP['read_frames'](p);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames]
  fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-preview-',suffix=p.suffix);os.close(fd)
  try:
   if fmt=='GIF':Path(t).write_bytes(HELP['mirror_gif'](p.read_bytes()))
   elif fmt=='WEBP':
    options={'lossless':True,'exact':True,'method':4}
    if len(expected)>1:
     options.update(save_all=True,append_images=expected[1:],duration=ds)
     if 'loop' in info:options['loop']=info['loop']
     if 'background' in info:options['background']=info['background']
    expected[0].save(t,format='WEBP',**options)
   else:raise ValueError('Unexpected preview format '+fmt)
   HELP['verify'](expected,t,ds,info);after=sha(t);os.replace(t,p)
   r['changes'][name]={'oldImage':name,'newImage':name,'beforeSha256':before,'afterSha256':after,'format':fmt,'dimensions':list(frames[0].size),'frameCount':len(frames),'durationsMs':ds,'loop':info.get('loop'),'users':e['users'],'verification':{'exactVisibleRgbaMirror':True,'alphaExact':True,'frameCountUnchanged':True,'durationsUnchanged':True,'loopUnchanged':True,'dimensionsUnchanged':True,'originalGifPalettePreserved':fmt=='GIF'}};r['failures'].pop(name,None);journal(r);print(json.dumps({'completed':len(r['changes']),'total':len(plan['files']),'preview':name}),flush=True)
  except Exception as ex:r['failures'][name]=str(ex);journal(r);raise
  finally:
   if os.path.exists(t):os.unlink(t)
 r['status']='completed';journal(r)
if __name__=='__main__':main()
