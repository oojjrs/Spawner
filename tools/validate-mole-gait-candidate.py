"""Check packaged review artifacts, including animated-frame clearing."""
from pathlib import Path
from PIL import Image
import numpy as np
import hashlib,json
base=Path('AnimationCandidates/mole-smooth-arm-v2-20261106/mole-grounded-walk-v3')
frames=[Image.open(str(base)+f'-frame-{i:02}.png').convert('RGBA') for i in range(8)]
assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})==8
for f in frames:
 a=np.array(f)[:,:,3]
 assert f.size==(512,512)
 assert max(a[0].max(),a[-1].max(),a[:,0].max(),a[:,-1].max())==0
sheet=Image.open(str(base)+'-sheet.png').convert('RGBA')
assert sheet.size==(2048,1024)
for i,f in enumerate(frames):
 assert np.array_equal(np.array(sheet.crop((i%4*512,i//4*512,(i%4+1)*512,(i//4+1)*512))),np.array(f))
results={}
for kind in ['gif','webp']:
 image=Image.open(str(base)+'-preview.'+kind)
 assert image.n_frames==8 and image.info['loop']==0
 rows=[]
 for i,f in enumerate(frames):
  image.seek(i);decoded=np.array(image.convert('RGBA'));original=np.array(f)
  a=decoded[:,:,3]>128;b=original[:,:,3]>128
  extra=int((a&~b).sum());missing=int((~a&b).sum())
  # A GIF palette may round alpha near 128; old disposal=1 left >16,000 pixels.
  assert extra<=16 and missing<=16,(kind,i,extra,missing)
  if kind=='gif': assert image.disposal_method==2 and image.info['duration']==80
  rows.append({'frame':i,'extraOpaquePixels':extra,'missingOpaquePixels':missing})
 results[kind]={'sha256':hashlib.sha256(Path(str(base)+'-preview.'+kind).read_bytes()).hexdigest(),'frames':rows}
# Product atlas is static; only the review GIF/thumbnail are animated containers.
publication=Path(str(base)+'-publication.json')
if publication.exists():
 pub=json.loads(publication.read_text())
 atlas=Image.open(pub['image'])
 assert atlas.size==(1024,512) and getattr(atlas,'n_frames',1)==1
 assert hashlib.sha256(Path(pub['image']).read_bytes()).hexdigest()==pub['imageSHA256']
 unique=[]
 for i in range(8):
  rgba=np.array(atlas.convert('RGBA').crop((i%4*256,i//4*256,(i%4+1)*256,(i//4+1)*256)))
  a=rgba[:,:,3]
  assert max(a[0].max(),a[-1].max(),a[:,0].max(),a[:,-1].max())==0
  unique.append(hashlib.sha256(rgba.tobytes()).hexdigest())
 assert len(set(unique))==8
 timed=Image.open(str(base)+'-timed-preview.gif')
 assert timed.n_frames==8
 for i,f in enumerate(frames):
  timed.seek(i)
  assert timed.disposal_method==2 and timed.info['duration']==pub['runtime']['durationsMs'][i]
  a=np.array(timed.convert('RGBA'))[:,:,3]>128;b=np.array(f)[:,:,3]>128
  assert int((a&~b).sum())<=16 and int((~a&b).sum())<=16
 results['product']={'staticAtlas':True,'uniqueFrames':8,'transparentEdges':True,'timedPreviewDisposal':2}
print(json.dumps({'passed':True,'uniqueFrames':8,'transparentEdges':True,'sheetMatchesFrames':True,'previewChecks':results},indent=2))
Path(str(base)+'-validation.json').write_text(json.dumps(results,indent=2)+'\n')
