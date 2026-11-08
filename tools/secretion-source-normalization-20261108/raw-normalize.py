#!/usr/bin/env python3
"""Normalize six uneven raw atlases, complete birth, and reproduce packed RGBA.
Only this form; source cells use the original pack.py round() boundaries.
--repack-only reproduces the six published sheets from normalized sources and
recorded per-frame crop/translation. It does not read legacy generation jobs.
"""
from pathlib import Path
import hashlib,json,os,tempfile,runpy,sys
from PIL import Image
import numpy as np
ROOT=Path(__file__).absolute().parents[2]
HERE=Path(__file__).absolute().parent
REPORT=HERE/'raw-changes.json'
BASE=ROOT/'AnimationCandidates/pebble-secretion-carapace-antenna-fullbody-v1-20261107'
OLD=json.loads((HERE/'secretion-carapace-antenna-manifest-before.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def atomic_bytes(p,data):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.raw-normalize-')
 try:
  with os.fdopen(fd,'wb') as f:f.write(data)
  os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def journal(r):atomic_bytes(REPORT,(json.dumps(r,indent=2)+'\n').encode())
def save_png(p,im):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.raw-normalize-',suffix='.png');os.close(fd)
 try:
  im.save(t,format='PNG',compress_level=9)
  with Image.open(t) as got:assert got.convert('RGBA').tobytes()==im.tobytes()
  os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def boxes(im):return [[round(i%4*im.width/4),round(i//4*im.height/2),round((i%4+1)*im.width/4),round((i//4+1)*im.height/2)] for i in range(8)]
def mirrored(im,cells):
 out=Image.new('RGBA',im.size)
 for b in cells:out.paste(im.crop(b).transpose(Image.Transpose.FLIP_LEFT_RIGHT),b[:2])
 return out

def packed(recipe):
 with Image.open(ROOT/recipe['rawImage']) as src:im=src.convert('RGBA')
 assert sha(ROOT/recipe['rawImage'])==recipe['rawAfterSha256']
 full=[]
 for b,crop,pos in zip(recipe['cellRectangles'],recipe['packCropByFrame'],recipe['packTranslationByFrame']):
  frame=Image.new('RGBA',(512,512));frame.paste(im.crop(b).crop(crop).resize(tuple(recipe['resizedCropDimensions']),Image.Resampling.LANCZOS),tuple(pos));full.append(frame)
 sheet=Image.new('RGBA',(2048,1024))
 for i,f in enumerate(full):sheet.paste(f,(i%4*512,i//4*512))
 return sheet

def main():
 r=json.loads(REPORT.read_text()) if REPORT.exists() else {'changes':{},'recipes':{},'status':'in_progress'}
 if '--repack-only' in sys.argv:
  assert r['status']=='completed'
  for action,recipe in r['recipes'].items():
   sheet=packed(recipe);assert hashlib.sha256(sheet.tobytes()).hexdigest()==recipe['packedRgbaSha256'];save_png(ROOT/recipe['packedImage'],sheet)
  print('Reproduced six published sheets exactly from normalized raw cells.');return
 for action,old in OLD['actions'].items():
  p=BASE/'Sources'/f'{action}-generated.png';name=p.relative_to(ROOT).as_posix()
  if name in r['changes']:assert sha(p)==r['changes'][name]['afterSha256'];continue
  before=sha(p);assert before==old['sourceSHA256']
  with Image.open(p) as source:im=source.convert('RGBA')
  cells=boxes(im);out=mirrored(im,cells);crop=old['packCrop'];size=[round((crop[2]-crop[0])*old['packScale']),round((crop[3]-crop[1])*old['packScale'])]
  crops=[[b[2]-b[0]-crop[2],crop[1],b[2]-b[0]-crop[0],crop[3]] for b in cells]
  xs=512-old['packTranslationX']-size[0];positions=[[xs,y] for y in old['packTranslationY']]
  save_png(p,out);after=sha(p)
  recipe={'rawImage':name,'rawAfterSha256':after,'packedImage':old['sheet'],'cellRectangles':cells,'rawDimensions':list(im.size),'packedFrameDimensions':[512,512],'packScale':old['packScale'],'originalPackCrop':crop,'packCropByFrame':crops,'originalPackTranslationX':old['packTranslationX'],'resizedCropDimensions':size,'packTranslationByFrame':positions,'calculation':'cropX=(rawFrameWidth-oldCropRight, rawFrameWidth-oldCropLeft); translationX=512-oldTranslationX-round(oldCropWidth*packScale); Y, scale, frame order unchanged.'}
  rebuilt=packed(recipe)
  with Image.open(ROOT/old['sheet']) as published:expected=published.convert('RGBA')
  if action=='birth':expected=mirrored(expected,[[i%4*512,i//4*512,(i%4+1)*512,(i//4+1)*512] for i in range(8)])
  assert rebuilt.tobytes()==expected.tobytes(),action
  recipe['packedRgbaSha256']=hashlib.sha256(rebuilt.tobytes()).hexdigest();recipe['exactExistingPackedPixelsReproduced']=True;r['recipes'][action]=recipe
  r['changes'][name]={'kind':'rawUnevenCellMirror','beforeSha256':before,'afterSha256':after,'dimensions':list(im.size),'cellRectangles':cells,'exactRgbaMirror':True};journal(r);print('raw verified',action,flush=True)
 # Birth sheets only: exact existing published-byte aliases, never re-flip other sheets.
 birth=OLD['actions']['birth'];oldsha=birth['sheetSHA256']
 if 'birthAliasPlan' not in r:
  size=(ROOT/birth['sheet']).stat().st_size;matches=[]
  for directory in ('AnimationCandidates','DesignAssets'):
   for p in (ROOT/directory).rglob('*.png'):
    if p.is_file() and p.stat().st_size==size and sha(p)==oldsha:matches.append(p.relative_to(ROOT).as_posix())
  r['birthAliasPlan']=matches;journal(r)
 for name in r['birthAliasPlan']:
  p=ROOT/name
  if name in r['changes']:assert sha(p)==r['changes'][name]['afterSha256'];continue
  before=sha(p);assert before==oldsha;im=packed(r['recipes']['birth']);save_png(p,im)
  r['changes'][name]={'kind':'packedBirthCellMirror','beforeSha256':before,'afterSha256':sha(p),'dimensions':list(im.size),'cellRectangles':[[i%4*512,i//4*512,(i%4+1)*512,(i//4+1)*512] for i in range(8)],'exactRgbaMirror':True,'exactNormalizedRawRepack':True};journal(r);print('birth sheet verified',name,flush=True)
 helpers=runpy.run_path(str(HERE/'normalize_source_previews.py'))
 for field in ('preview','gif','cover'):
  name=birth[field];p=ROOT/name
  if not p.exists():continue
  if name in r['changes']:assert sha(p)==r['changes'][name]['afterSha256'];continue
  before=sha(p);fmt,info,frames,ds=helpers['read_frames'](p);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames]
  fd,t=tempfile.mkstemp(dir=p.parent,prefix='.raw-preview-',suffix=p.suffix);os.close(fd)
  try:
   if fmt=='GIF':Path(t).write_bytes(helpers['mirror_gif'](p.read_bytes()))
   elif fmt=='WEBP':expected[0].save(t,format=fmt,lossless=True,exact=True,method=6,save_all=True,append_images=expected[1:],duration=ds,loop=info.get('loop',0))
   else:expected[0].save(t,format=fmt,compress_level=9)
   helpers['verify'](expected,t,ds,info);after=sha(Path(t));os.replace(t,p)
   r['changes'][name]={'kind':'birthPreviewMirror','beforeSha256':before,'afterSha256':after,'dimensions':list(frames[0].size),'frameCount':len(frames),'durationsMs':ds,'loop':info.get('loop'),'exactVisibleRgbaMirror':True,'alphaExact':True};journal(r);print('birth preview verified',field,flush=True)
  finally:
   if os.path.exists(t):os.unlink(t)
 r['status']='completed';journal(r)
if __name__=='__main__':main()
