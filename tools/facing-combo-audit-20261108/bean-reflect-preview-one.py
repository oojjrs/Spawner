from pathlib import Path
import json,hashlib,os,tempfile,gc,runpy
from PIL import Image
H=Path(__file__).resolve().parent;R=H.parents[1];P=json.loads((H/'bean-reflect-plan.json').read_text());J=H/'bean-reflect-preview-changes.json';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();report=json.loads(J.read_text())if J.exists()else {'status':'in_progress','changes':{}};helper=runpy.run_path(str(R/'tools/source-facing-normalization-20261108/normalize_source_previews.py'))
for name,e in P['previews'].items():
 if name in report['changes']:assert sha(R/name)==report['changes'][name]['afterSha256'];continue
 src=R/name;assert sha(src)==e['beforeSha256'];im=Image.open(src);fmt=im.format;size=im.size;info=dict(im.info);ds=[];expected=[];frames=[]
 for i in range(im.n_frames):
  im.seek(i);cel=im.convert('RGBA').transpose(Image.Transpose.FLIP_LEFT_RIGHT);raw=bytearray(cel.tobytes())
  for j in range(0,len(raw),4):
   if raw[j+3]==0:raw[j:j+3]=b'\0\0\0'
  expected.append(hashlib.sha256(raw).hexdigest());ds.append(im.info.get('duration',0))
  if fmt=='WEBP':frames.append(cel)
  else:cel.close()
 im.close();fd,temp=tempfile.mkstemp(dir=src.parent,prefix='.confirmed-preview-',suffix=src.suffix);os.close(fd);tmp=Path(temp)
 try:
  if fmt=='GIF':tmp.write_bytes(helper['mirror_gif'](src.read_bytes()))
  else:
   args=dict(lossless=True,exact=True,method=4,save_all=True,append_images=frames[1:],duration=ds)
   if 'loop'in info:args['loop']=info['loop']
   if 'background'in info:args['background']=info['background']
   frames[0].save(tmp,format='WEBP',**args)
  for f in frames:f.close()
  frames.clear();gc.collect();got=Image.open(tmp);assert got.size==size and got.n_frames==len(expected)
  for i,h in enumerate(expected):
   got.seek(i);cel=got.convert('RGBA');raw=bytearray(cel.tobytes())
   for j in range(0,len(raw),4):
    if raw[j+3]==0:raw[j:j+3]=b'\0\0\0'
   assert hashlib.sha256(raw).hexdigest()==h,(name,i);assert got.info.get('duration',0)==ds[i];cel.close()
  assert got.info.get('loop')==info.get('loop');got.close();after=sha(tmp);os.replace(tmp,src)
  report['changes'][name]={'oldImage':name,'newImage':name,'beforeSha256':e['beforeSha256'],'afterSha256':after,'users':e['users'],'dimensions':list(size),'frameCount':len(expected),'durationsMs':ds,'loop':info.get('loop'),'verification':{'exactVisibleRgbaMirror':True,'alphaExact':True,'frameCountUnchanged':True,'durationsUnchanged':True,'loopUnchanged':True,'dimensionsUnchanged':True}}
  print(len(report['changes']),name,flush=True)
 finally:
  if tmp.exists():tmp.unlink()
 break
if len(report['changes'])==len(P['previews']):report['status']='completed'
J.write_text(json.dumps(report,indent=2)+'\n')
