#!/usr/bin/env python3
"""Complete the two missing blade-carapace source manifests without runtime edits."""
from pathlib import Path
import hashlib,json,os,tempfile,shutil,runpy
from PIL import Image
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
PLAN=HERE/'bean-spore-extra-plan.json';REPORT=HERE/'bean-spore-extra-image-changes.json';PREPORT=HERE/'bean-spore-extra-preview-changes.json'
HELP=runpy.run_path(str(ROOT/'tools/source-facing-normalization-20261108/normalize_source_previews.py'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,o):
 fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-extra-json-')
 try:
  with os.fdopen(fd,'w') as f:json.dump(o,f,indent=2);f.write('\n')
  os.replace(t,p)
 finally:
  if os.path.exists(t):os.unlink(t)
def resolve(raw,mp):return Path(raw) if raw.startswith(('AnimationCandidates/','DesignAssets/')) else mp.parent/raw

def main():
 prior=json.loads((HERE/'bean-spore-image-changes.json').read_text());bysha={}
 for path,e in prior['changes'].items():bysha.setdefault(e['beforeSha256'],[]).append(e)
 if PLAN.exists():plan=json.loads(PLAN.read_text())
 else:
  imgs={};previews={};manifests=[];raws=[]
  for tribe in ('bean','spore'):
   owner=tribe+'/blade-carapace';mp=Path(f'AnimationCandidates/{tribe}-blade-carapace-fullbody-v1-20261107/publication-manifest.json');doc=json.loads((ROOT/mp).read_text());manifests.append({'owner':owner,'manifest':str(mp)})
   for action,row in doc['actions'].items():
    name=str(resolve(row['sheet'],mp));p=ROOT/name;before=sha(p);match=[e for e in bysha.get(before,[]) if owner in e['selectedUsers']];assert len(match)==1,(name,len(match));native=match[0]
    imgs[name]={'image':name,'beforeSha256':before,'selectedUsers':[owner],'kind':'exact-old-native-alias','copyFrom':native['newImage'],'expectedAfterSha256':native['afterSha256'],'dimensions':native['dimensions'],'grid':native['grid'],'cellRectangles':native['cellRectangles']}
    choices={str(resolve(row[k],mp)) for k in ('preview','gif','cover','webpPreview') if isinstance(row.get(k),str)}
    if tribe=='bean' and action in ('idle','attack','hurt','death'):choices.add(str(mp.parent/f'bean-blade-carapace-{action}-v1-preview.gif'))
    if tribe=='bean' and action=='birth':choices.add(str(mp.parent/'bean-blade-carapace-birth-complete-v1-preview.webp'))
    for pn in choices:
     if (ROOT/pn).is_file():previews.setdefault(pn,{'beforeSha256':sha(ROOT/pn),'users':[]})['users'].append({'owner':owner,'action':action,'manifest':str(mp)})
   source=resolve(doc['sourceAppearance'],mp);images=[(source,1,1,'source-appearance')]
   if tribe=='bean':
    for q in sorted((ROOT/mp.parent/'Sources').glob('*.png')):
     action=q.stem.replace('-wholebody-generated','');cols,rows=(4,4) if action=='birth' else (4,2) if '-wholebody-generated' in q.stem else (1,1)
     images.append((q.relative_to(ROOT),cols,rows,'raw-source'))
   for q,cols,rows,kind in images:
    assert str(q) not in prior['changes'];im=Image.open(ROOT/q);w,h=im.size;im.close();cells=[[round(i%cols*w/cols),round(i//cols*h/rows),round((i%cols+1)*w/cols),round((i//cols+1)*h/rows)] for i in range(cols*rows)]
    e={'image':str(q),'beforeSha256':sha(ROOT/q),'selectedUsers':[owner],'kind':kind,'dimensions':[w,h],'grid':{'columns':cols,'rows':rows,'cellCount':cols*rows,'frameWidth':w//cols if w%cols==0 else None,'frameHeight':h//rows if h%rows==0 else None,'explicitUnevenCells':w%cols!=0 or h%rows!=0},'cellRectangles':cells,'gridEvidence':'generation-prompts.json: explicit 4x2 whole-body actions, 4x4 birth; birth raw visually checked as sixteen row-major cels; reference images are single full portraits.'};imgs[str(q)]=e
    if kind=='raw-source':raws.append({'image':str(q),'cellRectangles':cells,'users':[{'owner':owner}]})
  plan={'candidateForms':['bean/blade-carapace','spore/blade-carapace'],'publicationPacking':manifests,'rawSourceFiles':raws,'images':imgs,'previews':previews,'historicalExcluded':['bean old walk-v1 and birth-body intermediate sheets/previews not active in publication manifest','spore generation raw sources absent from source directory'],'count':{'images':len(imgs),'previews':len(previews)}};write(PLAN,plan)
 print(plan['count'],flush=True)
 r=json.loads(REPORT.read_text()) if REPORT.exists() else {'status':'in_progress','changes':{},'pathMap':{}}
 for name,e in plan['images'].items():
  p=ROOT/name
  if name in r['changes']:assert sha(p)==r['changes'][name]['afterSha256'];continue
  assert sha(p)==e['beforeSha256'];fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-extra-image-',suffix=p.suffix);os.close(fd)
  try:
   with Image.open(p) as im:original=im.convert('RGBA')
   expected=Image.new('RGBA',original.size)
   for cell in e['cellRectangles']:expected.paste(original.crop(cell).transpose(Image.Transpose.FLIP_LEFT_RIGHT),cell[:2])
   if e.get('copyFrom'):shutil.copyfile(ROOT/e['copyFrom'],t);assert sha(t)==e['expectedAfterSha256']
   else:expected.save(t,format='PNG',compress_level=6)
   with Image.open(t) as got:assert got.convert('RGBA').tobytes()==expected.tobytes(),name
   after=sha(t);os.replace(t,p);r['changes'][name]={**e,'oldImage':name,'newImage':name,'afterPath':name,'afterSha256':after,'verification':{'exactRgbaPerCellMirror':True,'alphaExact':True,'geometryUnchanged':True,'byteIdenticalNewNative':bool(e.get('copyFrom'))}};r['pathMap'][name]=name;write(REPORT,r);print('image',len(r['changes']),name,flush=True)
  finally:
   if os.path.exists(t):os.unlink(t)
 r['status']='completed';write(REPORT,r)
 r=json.loads(PREPORT.read_text()) if PREPORT.exists() else {'status':'in_progress','changes':{}}
 for name,e in plan['previews'].items():
  p=ROOT/name
  if name in r['changes']:assert sha(p)==r['changes'][name]['afterSha256'];continue
  assert sha(p)==e['beforeSha256'];fmt,info,frames,ds=HELP['read_frames'](p);expected=[f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames];fd,t=tempfile.mkstemp(dir=p.parent,prefix='.bean-spore-extra-preview-',suffix=p.suffix);os.close(fd)
  try:
   if fmt=='GIF':Path(t).write_bytes(HELP['mirror_gif'](p.read_bytes()))
   else:expected[0].save(t,format=fmt,lossless=True,exact=True,method=0,save_all=len(frames)>1,append_images=expected[1:],duration=ds,loop=info.get('loop',0))
   HELP['verify'](expected,t,ds,info);after=sha(t);os.replace(t,p);r['changes'][name]={**e,'oldImage':name,'newImage':name,'afterSha256':after,'dimensions':list(frames[0].size),'frameCount':len(frames),'durationsMs':ds,'loop':info.get('loop'),'verification':{'exactVisibleRgbaMirror':True,'timingAndLoopUnchanged':True,'alphaExact':True}};write(PREPORT,r);print('preview',len(r['changes']),name,flush=True)
  finally:
   if os.path.exists(t):os.unlink(t)
 r['status']='completed';write(PREPORT,r)
if __name__=='__main__':main()
