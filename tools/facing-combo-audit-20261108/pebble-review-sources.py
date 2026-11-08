from pathlib import Path
import json,hashlib,os,gc,tempfile,importlib.util
from PIL import Image
H=Path(__file__).resolve().parent;R=H.parents[1];P=json.loads((H/'pebble-review-plan.json').read_text());J=H/'pebble-review-image-changes.json';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();report=json.loads(J.read_text())
for e in P['entries']:
 name=e['image'];src=R/name
 if name in report['changes']:
  assert sha(R/report['changes'][name]['newImage'])==report['changes'][name]['afterSha256'];continue
 assert sha(src)==e['beforeSha256'],name
 fd,temp=tempfile.mkstemp(dir=src.parent,prefix='.confirmed-facing-',suffix=src.suffix);os.close(fd);tmp=Path(temp)
 try:
  im=Image.open(src);fmt=im.format;im.load()
  if im.mode!='RGBA':old=im;im=im.convert('RGBA');old.close()
  out=Image.new('RGBA',im.size);expected=[]
  for box in e['cellRectangles']:
   cell=im.crop(box).transpose(Image.Transpose.FLIP_LEFT_RIGHT);expected.append(hashlib.sha256(cell.tobytes()).hexdigest());out.paste(cell,box[:2]);cell.close()
  im.close();gc.collect()
  if fmt=='PNG':out.save(tmp,format='PNG',compress_level=6)
  else:out.save(tmp,format='WEBP',lossless=True,exact=True,method=0)
  out.close();gc.collect()
  im=Image.open(tmp);im.load()
  for box,digest in zip(e['cellRectangles'],expected):
   cell=im.crop(box).convert('RGBA');assert hashlib.sha256(cell.tobytes()).hexdigest()==digest,(name,box);cell.close()
  im.close();gc.collect();after=sha(tmp);dest=e['destination'].replace('<sha256-of-encoded-left-image>',after)
  if dest!=name and (R/dest).exists():assert sha(R/dest)==after;tmp.unlink()
  else:os.replace(tmp,R/dest)
  if dest!=name:assert sha(src)==e['beforeSha256']
  rec={k:v for k,v in e.items()if k not in ['image','destination']};rec.update(oldImage=name,newImage=dest,afterSha256=after,verification={'exactRgbaMirror':True,'alphaExact':True,'dimensionsUnchanged':True,'originalPreserved':dest!=name,'method':'independent per-cell RGBA hashes before and after encoding'})
  report['changes'][name]=rec;report['pathMap'][name]=dest;J.write_text(json.dumps(report,indent=2)+'\n');print(len(report['changes']),name,flush=True)
 finally:
  if tmp.exists():tmp.unlink()
 if os.environ.get('ONE_SOURCE')=='1':break
if len(report['changes'])<len(P['entries']):raise SystemExit(0)
report['status']='completed';J.write_text(json.dumps(report,indent=2)+'\n')
if os.environ.get('ONE_SOURCE')=='1':raise SystemExit(0)
