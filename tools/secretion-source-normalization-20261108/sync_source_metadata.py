#!/usr/bin/env python3
"""Synchronize native pixel normalization without introducing display transforms."""
import copy, hashlib, html, json, os, re, tempfile
from pathlib import Path
ROOT=Path(__file__).absolute().parents[2]
HERE=Path(__file__).absolute().parent
FORMS={'pebble/secretion-carapace','pebble/secretion-carapace-antenna'}

def write(path,text):
    previous=path.read_text()
    if previous==text:return False
    fd,tmp=tempfile.mkstemp(prefix='.facing-meta-',dir=path.parent)
    try:
        with os.fdopen(fd,'w')as f:f.write(text)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    return True

def main():
    report_path=HERE/'metadata-changes.json'
    if report_path.exists():raise RuntimeError('Metadata already synchronized; do not mirror coordinates twice')
    pixels=json.loads((HERE/'pixel-changes.json').read_text())
    assert pixels['status']=='completed'
    previews=json.loads((HERE/'preview-changes.json').read_text())
    assert previews['status']=='completed'
    changes=dict(pixels['changes']); changes.update(previews['changes'])
    hashes={d['beforeSha256']:d['afterSha256']for d in changes.values()}
    rows=json.loads((HERE/'catalog-before.json').read_text())
    clips={a['image']:a for a in rows if a['key']in FORMS and a['image'] in changes}
    for p,c in changes.items():
        if c.get('aliasOf')in clips:clips[p]=clips[c['aliasOf']]
    touched=[]
    def pathkey(value,path):
        if not isinstance(value,str):return None
        if value in changes:return value
        relative=(path.parent/str(value))
        try:key=relative.relative_to(ROOT).as_posix()
        except ValueError:return None
        return key if key in changes else None
    def rect(value,width):
        if isinstance(value,list)and len(value)==4 and all(isinstance(x,(int,float))for x in value):
            return [width-value[2],value[1],width-value[0],value[3]]
        if isinstance(value,list):return [rect(x,width)for x in value]
        return value
    def tree(value,path):
        if isinstance(value,list):return [tree(v,path)for v in value]
        if isinstance(value,str):return hashes.get(value,value)
        if not isinstance(value,dict):return value
        own=next((key for field in ['image','sheet','atlas','runtimeAtlas']if(key:=pathkey(value.get(field),path))),None)
        original=copy.deepcopy(value)
        value={k:tree(v,path)for k,v in value.items()}
        if own and own in clips:
            clip=clips[own];w=clip['frameSize']
            value['sourceFacing']='left'
            value['pivotX']=w-original.get('pivotX',clip['pivotX'])
            if 'pivot' in value and isinstance(value['pivot'],list):value['pivot'][0]=w-original['pivot'][0]
            if 'scene' in value and 'outletX'in value['scene']:value['scene']['outletX']=w-original['scene']['outletX']
            if 'outletX'in value:value['outletX']=w-original['outletX']
            for k in ['bodyBounds','referenceBounds','referenceBodyBBox','finalBodyBounds']:
                if k in value:value[k]=rect(original[k],w)
            if 'finalBodyMeasurementRegion' in value:
                value['finalBodyMeasurementRegion']=[[w-x,y] for x,y in original['finalBodyMeasurementRegion']]
            packing={k:original[k] for k in ['sourceSHA256','packScale','packCrop','packTranslationX','packTranslationY','sourceBodyBounds'] if k in original}
            if 'packScale' in packing:
                value['priorPackingProvenance']=packing
                for k in packing: value.pop(k,None)
                value['sourceNormalization']={'operation':'lossless horizontal mirror of each packed cell','rawSourceLocated':False,'originalPackedSHA256':changes[own]['beforeSha256']}
            if 'frameGeometry'in value:
                for frame,g in value['frameGeometry'].items():
                    if 'pivotX'in g:g['pivotX']=w-original['frameGeometry'][frame]['pivotX']
            if 'sceneLayers'in value:
                for layer in value['sceneLayers']['layers']:
                    for sample in layer['samples']:
                        if sample:sample['destination'][0]=w-sample['destination'][0]-sample['destination'][2]
        if original.get('tribe','')+'/'+original.get('form','')in FORMS:
            value['sourceFacing']='left'
        return value
    # Native registries retain unrelated definitions and all authored clocks.
    for name in ['client/secretion-combo-assets.mjs','client/antenna-combo-assets.mjs']:
        p=ROOT/name;s=p.read_text();start=s.index('Object.freeze(')+len('Object.freeze(')
        obj,length=json.JSONDecoder().raw_decode(s[start:]);new=tree(obj,p)
        text=s[:start]+json.dumps(new,ensure_ascii=False,indent=2)+s[start+length:]
        if write(p,text):touched.append(name)
    # All native/source manifests that actually reference changed assets/hashes.
    for folder in ['DesignAssets','AnimationCandidates']:
        for p in sorted((ROOT/folder).rglob('*.json')):
            s=p.read_text()
            if not any(h in s for h in hashes)and not any(name in s for name in changes):continue
            try:obj=json.loads(s)
            except json.JSONDecodeError:continue
            new=tree(obj,p)
            if new!=obj:
                if write(p,json.dumps(new,ensure_ascii=False,indent=2)+'\n'):touched.append(p.relative_to(ROOT).as_posix())
    # Defaults must not overwrite the authoritatively corrected manifest facing.
    p=ROOT/'scripts/register-blade-carapace.py';s=p.read_text()
    s=s.replace("sourceFacing='right',", "sourceFacing=record.get('sourceFacing', manifest.get('sourceFacing', 'right')),")
    if write(p,s):touched.append(p.relative_to(ROOT).as_posix())
    # Keep current planning facing metadata truthful even before full bundle build.
    p=ROOT/'client/unit-preview-facing-data.js';s=p.read_text();start=s.index('=')+1
    obj,length=json.JSONDecoder().raw_decode(s[start:])
    for row in rows:
        if row['image'] in clips: obj['forms'][row['key']]['base' if row['action']=='reference' else row['action']]='left'
    for image in clips:obj['images'][image]='left'
    if write(p,s[:start]+json.dumps(obj,separators=(',',':'))+s[start+length:]):touched.append(p.relative_to(ROOT).as_posix())
    report={'status':'completed','forms':sorted(FORMS),'files':touched,'nativePixelFiles':len(pixels['changes']),'previewFiles':len(previews['changes'])}
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
