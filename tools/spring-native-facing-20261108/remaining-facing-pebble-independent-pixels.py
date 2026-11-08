"""Independent immutable-Git decoder. No normalizer verification flags are read.

One source atlas pair is decoded at a time; equality is checked per crop instead
of allocating full-atlas NumPy arrays. Fully transparent RGB has no display
meaning and is zeroed; alpha and every visible RGBA channel remain exact.
"""
import hashlib, io, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

cfg=json.load(sys.stdin)
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
commit=cfg['commit']
changes=json.loads((HERE/'remaining-facing-pebble-image-changes.json').read_text())
packed=json.loads((HERE/'remaining-facing-pebble-packed-gather-changes.json').read_text())['changes']
plans={}
for name in ['remaining-facing-pebble2-plan.json','remaining-facing-pebble-extra-plan.json']:
    plans.update(json.loads((HERE/name).read_text())['files'])
static={**changes['changes'],**packed}
held={
 'DesignAssets/Animations/SpeciesHeldHurtV1/pebble-base.webp':14,
 'DesignAssets/Animations/MinorHeldHurtV1/pebble-antenna.webp':14,
}
result={'scope':'Independent Git baseline decoded visible RGBA; not verification flags',
        'sourceFiles':0,'sourceCells':0,'heldFiles':0,'packedCrops':0,'independentGitSourceFiles':0,'afterHashOnlySourceFiles':0,'gitAliasSourceFiles':0,
        'registeredFiles':0,'previewFiles':0,'previewFrames':0,
        'exactPreviewFiles':0,'quantizedGifFiles':0,'maxGifMeanError':0,'independentGitPreviewFiles':0,'afterHashOnlyPreviewFiles':0,
        'sources':[],'previews':[],'protectedFiles':0,'protectedSources':[]}

tracked=set(subprocess.check_output(['git','ls-tree','-r','--name-only',commit],cwd=ROOT,text=True).splitlines())
all_records={**static,**changes['previewChanges']}
def baseline_path(path,record):
    if path in tracked:return path
    return next((name for name,r in all_records.items() if name in tracked and r['beforeSha256']==record['beforeSha256']),None)
def git(path):
    return subprocess.check_output(['git','show',commit+':'+path],cwd=ROOT)
def rgba(im):
    arr=np.array(im.convert('RGBA'))
    arr[arr[:,:,3]==0,:3]=0
    return arr
def check(a,b,label):
    assert np.array_equal(a,b),(label,'visible RGBA difference',int(np.count_nonzero(a!=b)))

def crop_rectangles(path,src,record):
    # Derive actual registered atlas grids from immutable plan geometry, not
    # the implementation's rectangle/permutation verification output.
    if path in packed:
        old_catalog=json.loads(git('client/pebble-packed-birth-catalog.mjs').decode().split('=',1)[1].strip().rstrip(';'))
        return list(dict.fromkeys((f['packed'][0],f['packed'][1],f['packed'][0]+f['bounds'][2]-f['bounds'][0],f['packed'][1]+f['bounds'][3]-f['bounds'][1]) for f in old_catalog['gather']['frames']))
    plan=plans[path]
    grid=plan.get('grid')
    registered_grid=cfg.get('registeredGrids',{}).get(path)
    if registered_grid:
        assert all(record.get(k)==v for k,v in registered_grid.items()),(path,'normalized grid disagrees with actual registered geometry')
        grid=registered_grid
    if path in ['AnimationCandidates/pebble-antenna-walk-stable-v6/walk-sheet.png','AnimationCandidates/pebble-gather-motion-v1-20261107/pebble-gather-attack-v1-sheet.png']:
        meta=json.loads(git((Path(path).parent/'manifest.json').as_posix()))
        grid={'frameWidth':meta['frameSize'],'frameHeight':meta.get('frameHeight',meta['frameSize']),'columns':meta['columns']}
    if grid:
        w,h,cols=grid['frameWidth'],grid['frameHeight'],grid['columns']
        assert src.width==cols*w and src.height%h==0,(path,'grid dimensions')
        return [(x,y,x+w,y+h) for y in range(0,src.height,h) for x in range(0,src.width,w)]
    # Source pack sheets can have an explicit non-uniform rectangle inventory.
    if plan.get('cellRectangles'):
        return [tuple(r) for r in plan['cellRectangles']]
    return [(0,0,src.width,src.height)]

for path,record in static.items():
    assert hashlib.sha256((ROOT/record['afterPath']).read_bytes()).hexdigest()==record['afterSha256'],(path,'current after SHA')
    origin=baseline_path(path,record)
    if origin is None:
        assert path not in cfg['registered'],(path,'registered source missing immutable baseline')
        result['sourceFiles']+=1;result['afterHashOnlySourceFiles']+=1
        result['sources'].append({'path':path,'independentRGBA':False,'scope':'Current SHA equals execution change map; pre-normalization raw/cover is not in Git', 'afterSHA256':record['afterSha256']})
        continue
    raw=git(origin)
    assert hashlib.sha256(raw).hexdigest()==record['beforeSha256'],(path,'Git baseline differs from expected source')
    src=Image.open(io.BytesIO(raw));dst=Image.open(ROOT/record['afterPath'])
    assert src.size==dst.size,(path,'dimensions changed')
    assert getattr(src,'n_frames',1)==getattr(dst,'n_frames',1)==1,(path,'source atlas unexpectedly animated')
    rectangles=crop_rectangles(path,src,record)
    n=held.get(path)
    for i,r in enumerate(rectangles):
        source_index=(i+n if i<n else i-n) if n and i<2*n else i
        a=rgba(ImageOps.mirror(src.crop(rectangles[source_index])));b=rgba(dst.crop(r))
        check(a,b,(path,'destination-cell',i,'source-cell',source_index));result['sourceCells']+=1
    if path in packed:
        result['packedCrops']+=len(rectangles)
        # Ensure no accidental whole-atlas flip or edits in the packing gutters.
        for y in range(src.height):
            a=rgba(src.crop((0,y,src.width,y+1)));b=rgba(dst.crop((0,y,dst.width,y+1)))
            mask=np.ones(src.width,dtype=bool)
            for x0,y0,x1,y1 in rectangles:
                if y0<=y<y1: mask[x0:x1]=False
            check(a[:,mask],b[:,mask],(path,'unchanged gutter row',y))
    result['sourceFiles']+=1;result['heldFiles']+=bool(n);result['independentGitSourceFiles']+=1;result['gitAliasSourceFiles']+=origin!=path
    result['registeredFiles']+=path in cfg['registered']
    result['sources'].append({'path':path,'baselineGitPath':origin,'cells':len(rectangles),'exactVisibleRGBA':True,'heldBlockSwap':bool(n)})
    src.close();dst.close();del raw,a,b

for path,record in changes['previewChanges'].items():
    assert hashlib.sha256((ROOT/record['afterPath']).read_bytes()).hexdigest()==record['afterSha256'],(path,'preview current after SHA')
    origin=baseline_path(path,record)
    if origin is None:
        dst=Image.open(ROOT/record['afterPath']);assert list(dst.size)==record['dimensions'];assert dst.n_frames==record['frameCount'];assert dst.info.get('loop')==record['loop']
        for frame,duration in enumerate(record['durationsMs']):
            dst.seek(frame);rgba(dst);assert dst.info.get('duration')==duration
        result['previewFiles']+=1;result['afterHashOnlyPreviewFiles']+=1
        result['previews'].append({'path':path,'independentRGBA':False,'scope':'Current SHA/frame count/timing/loop equal execution map; original preview not in Git','afterSHA256':record['afterSha256']})
        dst.close();continue
    raw=git(origin);assert hashlib.sha256(raw).hexdigest()==record['beforeSha256'],(path,'preview Git baseline')
    src=Image.open(io.BytesIO(raw));dst=Image.open(ROOT/record['afterPath'])
    assert src.size==dst.size,(path,'preview dimensions')
    assert src.n_frames==dst.n_frames,(path,'preview temporal frame count')
    assert src.info.get('loop')==dst.info.get('loop'),(path,'preview loop')
    exact=True;worst=0
    for frame in range(src.n_frames):
        src.seek(frame);dst.seek(frame)
        a=rgba(ImageOps.mirror(src));b=rgba(dst)
        assert src.info.get('duration')==dst.info.get('duration'),(path,'preview duration',frame)
        if not np.array_equal(a,b):
            assert path.endswith('.gif'),(path,'lossless preview changed',frame)
            check(a[:,:,3],b[:,:,3],(path,'GIF alpha',frame))
            mask=a[:,:,3]>0
            error=np.abs(a[:,:,:3].astype(np.int16)-b[:,:,:3].astype(np.int16))[mask]
            mean=float(error.mean()) if error.size else 0
            assert mean<=4 and (not error.size or np.quantile(error,.95)<=16),(path,'GIF palette error exceeds bounded tolerance',frame,mean)
            exact=False;worst=max(worst,mean)
        result['previewFrames']+=1
    result['previewFiles']+=1;result['independentGitPreviewFiles']+=1;result['exactPreviewFiles']+=exact;result['quantizedGifFiles']+=not exact
    result['maxGifMeanError']=max(result['maxGifMeanError'],worst)
    result['previews'].append({'path':path,'frames':src.n_frames,'timingLoopDimensionsPreserved':True,'exactVisibleRGBA':exact,'maxPaletteMeanError':worst})
    src.close();dst.close();del raw,a,b
# A later visual review explicitly reflects only this previously protected family.
# Keep every protected path covered, proving its exact per-cell mirror against Git.
later=json.loads((ROOT/'tools/facing-combo-audit-20261108/pebble-review-image-changes.json').read_text())
assert later['status']=='completed'
for path in cfg.get('protected',[]):
    raw=git(path);expected=hashlib.sha256(raw).hexdigest();actual=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
    correction=later['changes'].get(path)
    if correction:
        assert correction['selectedUsers']==['pebble/blade-antenna'],(path,'exact later owner')
        assert correction['beforeSha256']==expected,(path,'later mirror starts at immutable baseline')
        assert correction['newImage']==path,(path,'expected in-place later mirror')
        assert actual==correction['afterSha256'],(path,'later output hash')
        src=Image.open(io.BytesIO(raw));dst=Image.open(ROOT/path)
        assert src.size==dst.size,(path,'later dimensions')
        width=correction['frameWidth'];height=correction['frameHeight']
        assert src.width%width==0 and src.height%height==0,(path,'later complete cell grid')
        rectangles=[[x,y,x+width,y+height] for y in range(0,src.height,height) for x in range(0,src.width,width)]
        assert correction['cellRectangles']==rectangles,(path,'later covers every source cell')
        for left,top,right,bottom in rectangles:
            check(rgba(ImageOps.mirror(src.crop((left,top,right,bottom)))),rgba(dst.crop((left,top,right,bottom))),(path,'independent later mirror',left,top))
        src.close();dst.close()
    else:
        assert actual==expected,(path,'unselected source bytes changed')
    result['protectedFiles']+=1;result['protectedSources'].append({'path':path,'sha256':actual,'laterIndependentMirror':bool(correction)})
assert set(cfg['registered'])<=set(static),'Missing registered source coverage'
(HERE/'remaining-facing-pebble-independent-pixel-report.json').write_text(json.dumps(result,indent=2)+'\n')
summary={k:v for k,v in result.items() if k not in ['sources','previews','protectedSources']}
print(json.dumps(summary))
