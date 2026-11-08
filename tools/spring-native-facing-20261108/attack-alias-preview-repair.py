#!/usr/bin/env python3
"""Repair exact old-sheet aliases and authorized related previews from seven new atlases.
No metadata edits. Atomic writes; all hashes, image dimensions and timing journaled.
GIF previews require palette quantization (GIF cannot represent RGBA artwork); the
encoded preview is verified against the explicitly quantized frames, and retains
existing dimensions, temporal frame count, delays and loop setting.
"""
import hashlib, json, os, subprocess, tempfile
from pathlib import Path
from PIL import Image, GifImagePlugin
import numpy as np
ROOT=Path(__file__).absolute().parents[2]
EVIDENCE=ROOT/'tools/spring-native-facing-20261108'
REPORT=EVIDENCE/'attack-alias-preview-changes.json'
ART=Path('/workspace/scratch/cdf786db13f9/art-review/attack-left-source-repair-20261108')

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def atomic(data,p):
 fd,t=tempfile.mkstemp(prefix='.attack-repair-',dir=p.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(data)
  os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def save_report(r):atomic((json.dumps(r,indent=2)+'\n').encode(),REPORT)
def read(p):
 with Image.open(p) as im:
  fmt=im.format;info=dict(im.info);fs=[];ds=[]
  for i in range(im.n_frames):
   im.seek(i);fs.append(im.convert('RGBA').copy());ds.append(im.info.get('duration'))
  return fmt,info,fs,ds

def palette_frame(im):
 # Reserve index 255 for transparent background; never quantize transparent RGB.
 a=np.asarray(im);rgb=im.convert('RGB');rgb.paste((0,0,0),mask=im.getchannel('A').point(lambda v:255 if v==0 else 0))
 q=rgb.quantize(colors=255,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
 ix=np.array(q);ix[a[:,:,3]<128]=255
 out=Image.fromarray(ix,'P');pal=q.getpalette()[:765];out.putpalette(pal+[0]*(768-len(pal)))
 out.info['transparency']=255
 return out

def gif_bytes(frames,ds,info):
 # Write every full frame independently: no optimization that merges equal frames.
 import io
 out=io.BytesIO();params={'loop':info['loop']} if 'loop' in info else {}
 params.update(transparency=255,background=255)
 header,_=GifImagePlugin.getheader(frames[0],info=params)
 for block in header:out.write(block)
 for frame,d in zip(frames,ds):
  GifImagePlugin._write_frame_data(out,frame,(0,0),{'duration':d or 0,'disposal':2,'transparency':255,'include_color_table':True})
 out.write(b';');return out.getvalue()

def main():
 import argparse
 ap=argparse.ArgumentParser();ap.add_argument('--apply',action='store_true');args=ap.parse_args()
 maps=json.load(open(ART/'integration-map.json'));val={a['key']:a for a in json.load(open(ART/'validation.json'))['assets']}
 assets={m['key']:{**m,**val[m['key']]} for m in maps};oldkeys={a['sourceSHA256']:k for k,a in assets.items()}
 for k,a in assets.items():assert sha(ROOT/a['sourcePath'])==a['outputSHA256'],k
 report=json.load(open(REPORT)) if REPORT.exists() else {'changes':{},'failures':{},'missing':[]}
 if 'plan' not in report:
  sizes=set()
  for a in assets.values():
   blob=subprocess.check_output(['git','show','HEAD:'+a['sourcePath']],cwd=ROOT)
   assert hashlib.sha256(blob).hexdigest()==a['sourceSHA256'],a['key']
   sizes.add(len(blob))
  aliases={}
  for folder in ('DesignAssets','AnimationCandidates'):
   for p in (ROOT/folder).rglob('*'):
    if p.suffix.lower() not in ('.png','.webp') or not p.is_file() or p.stat().st_size not in sizes:continue
    h=sha(p)
    if h in oldkeys:aliases[p.relative_to(ROOT).as_posix()]=oldkeys[h]
  manifest_by_key={
   'pebble/carapace-antenna':'AnimationCandidates/pebble-carapace-antenna-defensive-attack-v1-20261107/publication-manifest.json',
   'spring/antenna':'AnimationCandidates/spring-defensive-counterattack-fullbody-v1-20261107/antenna/publication-manifest.json',
   'spring/carapace-antenna':'AnimationCandidates/spring-defensive-counterattack-fullbody-v1-20261107/carapace-antenna/publication-manifest.json',
   'spring/blade-antenna':'AnimationCandidates/spring-blade-antenna-fullbody-v1-20261107/publication-manifest.json',
   'spring/blade-carapace-antenna':'AnimationCandidates/spring-blade-carapace-antenna-fullbody-v1-20261107/publication-manifest.json',
   'spring/gather':'AnimationCandidates/spring-gather-actions-v1/spring-gather-attack-v1.json'}
  previews={}
  for k,m in manifest_by_key.items():
   doc=json.load(open(ROOT/m));row=doc.get('actions',{}).get('attack',doc)
   for field in ('preview','gif','cover'):
    if not isinstance(row.get(field),str):continue
    name=row[field];p=ROOT/name if name.startswith(('DesignAssets/','AnimationCandidates/')) else ROOT/Path(m).parent/name
    if p.exists():previews[p.relative_to(ROOT).as_posix()]={'key':k,'manifest':m,'field':field}
    else:report['missing'].append(p.relative_to(ROOT).as_posix())
  # Preview files neighboring an exact old-source alias use that canonical sheet.
  # Include only obvious sheet-stem previews, and record their provenance.
  for name,k in aliases.items():
   p=ROOT/name;stem=p.stem.removesuffix('-sheet')
   for tail in ('-preview.gif','-preview.webp','.gif'):
    q=p.with_name(stem+tail)
    if q.exists() and q!=p:previews.setdefault(q.relative_to(ROOT).as_posix(),{'key':k,'aliasSheet':name,'field':'preview'})
  report['plan']={'aliases':aliases,'previews':previews,'sources':{k:{'path':a['sourcePath'],'beforeSha256':a['sourceSHA256'],'afterSha256':a['outputSHA256']} for k,a in assets.items()}}
 print(json.dumps({'aliases':len(report['plan']['aliases']),'previews':len(report['plan']['previews']),'apply':args.apply}),flush=True)
 if not args.apply:
  save_report(report);return
 for name,k in report['plan']['aliases'].items():
  if name in report['changes']:assert sha(ROOT/name)==report['changes'][name]['afterSha256'];continue
  p=ROOT/name;a=assets[k];before=sha(p);assert before==a['sourceSHA256'],name
  atomic((ROOT/a['sourcePath']).read_bytes(),p);after=sha(p);assert after==a['outputSHA256']
  report['changes'][name]={'kind':'exactSourceAlias','key':k,'oldImage':name,'newImage':name,'beforeSha256':before,'afterSha256':after,'sourcePath':a['sourcePath'],'byteExactNewSource':True};save_report(report)
  print(json.dumps({'alias':name}),flush=True)
 for name,meta in report['plan']['previews'].items():
  if name in report['changes']:assert sha(ROOT/name)==report['changes'][name]['afterSha256'];continue
  p=ROOT/name;a=assets[meta['key']];before=sha(p);fmt,info,oldframes,ds=read(p)
  try:
   with Image.open(ROOT/a['sourcePath']) as sheet:
    sheet=sheet.convert('RGBA');fw=a['frameSize'];fh=a['frameHeight'];cols=a['columns'];n=a['frameCount']
    fs=[sheet.crop(((i%cols)*fw,(i//cols)*fh,(i%cols+1)*fw,(i//cols+1)*fh)) for i in range(n)]
   if len(oldframes)==1:fs=[fs[0]]
   else:assert len(oldframes)==n,f'Unexpected preview frame count {len(oldframes)} != {n}'
   fs=[f.resize(oldframes[0].size,Image.Resampling.LANCZOS) if f.size!=oldframes[0].size else f for f in fs]
   fd,tmp=tempfile.mkstemp(dir=p.parent,prefix='.attack-preview-',suffix=p.suffix);os.close(fd)
   try:
    expected=fs
    if fmt=='GIF':
     quant=[palette_frame(f) for f in fs];expected=[f.copy().convert('RGBA') for f in quant];Path(tmp).write_bytes(gif_bytes(quant,ds,info))
    elif fmt=='WEBP':
     fs[0].save(tmp,format='WEBP',lossless=True,exact=True,method=6,save_all=len(fs)>1,append_images=fs[1:],duration=ds,loop=info.get('loop',0))
    elif fmt=='PNG':fs[0].save(tmp,format='PNG',compress_level=9)
    else:raise ValueError('Unexpected format '+fmt)
    _,gotinfo,got,gotds=read(Path(tmp));assert len(got)==len(oldframes),'Frame count changed';assert gotds==ds,'Timing changed';assert gotinfo.get('loop')==info.get('loop'),'Loop changed'
    for want,actual in zip(expected,got):
     assert actual.size==oldframes[0].size
     aa=np.asarray(want);bb=np.asarray(actual);assert np.array_equal(aa[:,:,3],bb[:,:,3]),'Alpha encode mismatch';mask=aa[:,:,3]>0;assert np.array_equal(aa[mask],bb[mask]),'Visible RGB encode mismatch'
    after=sha(Path(tmp));os.replace(tmp,p)
    report['changes'][name]={'kind':'regeneratedPreview','key':meta['key'],'oldImage':name,'newImage':name,'beforeSha256':before,'afterSha256':after,'sourcePath':a['sourcePath'],'sourceSha256':a['outputSHA256'],'format':fmt,'width':got[0].width,'height':got[0].height,'frameCount':len(got),'durationsMs':ds,'loop':info.get('loop'),'verification':{'dimensionsUnchanged':True,'frameCountUnchanged':True,'timingUnchanged':True,'loopUnchanged':True,'exactEncodedFrames':True},'paletteQuantized':fmt=='GIF','gifAlphaThreshold':128 if fmt=='GIF' else None}
    report['failures'].pop(name,None);print(json.dumps({'preview':name}),flush=True)
   finally:
    if os.path.exists(tmp):os.unlink(tmp)
  except Exception as e:report['failures'][name]=str(e);print(json.dumps({'failed':name,'reason':str(e)}),flush=True)
  save_report(report)
 report['status']='completed' if not report['failures'] else 'blocked';save_report(report)
if __name__=='__main__':main()
