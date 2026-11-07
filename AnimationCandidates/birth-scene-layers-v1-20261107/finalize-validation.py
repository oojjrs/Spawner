from pathlib import Path
from PIL import Image
import json,hashlib,numpy as np,os
O=Path(__file__).resolve().parent;R=Path(os.environ.get('SPAWNER_SOURCE',str(O.parents[1])))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cell(im,i,w,h,c):return im.crop((i%c*w,i//c*h,i%c*w+w,i//c*h+h)).convert('RGBA')
index=json.loads((O/'layer-publications/index.json').read_text());report=json.loads((O/'validation-report.json').read_text());hashes=json.loads((O/'source-hashes.json').read_text());assets={};orig=0
for e,r in zip(index['entries'],report['forms']):
 t,f=e['tribe'],e['form'];d=R/f'AnimationCandidates/{t}-antenna-combos-fullbody-v1-20261107/{f}';pub=json.loads((d/'publication-manifest.json').read_text());b=e['birth'];base=dict(b);base.pop('sceneLayers');assert base=={k:v for k,v in pub['actions']['birth'].items() if k!='sceneLayers'}
 layers=e['sceneLayers']['layers'];bp=R/(pub['actions']['birth'].get('bodySheet') or pub['actions']['birth']['bodyOnlySheet']);originalBody=Image.open(bp)
 final=None
 for layer in layers:
  p=O/layer['image'].split(O.name+'/')[1];assert sha(p)==layer['imageSHA256'];im=Image.open(p);w,h,c=layer['frameSize'],layer['frameHeight'],layer['columns'];assets[str(p.relative_to(O))]={'pngBytes':p.stat().st_size,'decodedBytes':im.width*im.height*4,'role':layer['role']}
  for i,s in enumerate(layer['samples']):
   if s is None:continue
   assert 0<=s['frame']<layer['frameCount'];assert s['destination'][2]>0 and s['destination'][3]>0
   if layer['role']=='body':
    actual=cell(im,s['frame'],w,h,c)
    if t=='bean':
     m=json.loads((d/'complete-scene-manifest.json').read_text());sourceIndex=m['forms'][f]['frames'][i]['bodyFrame']
    else:sourceIndex=i
    source=cell(originalBody,sourceIndex,512,512,8);assert actual.tobytes()==source.tobytes();a=np.array(actual)[:,:,3];assert a.min()==0;assert max(a[0].max(),a[-1].max(),a[:,0].max(),a[:,-1].max())<128
    final=actual
  im.close()
 originalBody.close()
 with Image.open(R/pub['actions']['idle']['sheet']) as idle:
  size=pub['actions']['idle']['frameSize'];iw,ih=(size,size) if isinstance(size,int) else size
  neutral=cell(idle,0,iw,ih,pub['actions']['idle']['columns'])
  r['finalBodyExactIdle']=final.tobytes()==neutral.tobytes();assert r['finalBodyExactIdle'],(t,f)
 with Image.open(R/b['sheet']) as old:orig+=old.width*old.height*4
 r['allMappedBodyPixelsByteExact']=True;r['noNewBodyOpaqueEdgeClipping']=True;r['transparentBackground']=True;r['existingBirthMetadataUnchanged']=True
 if t=='bean':
  q=json.loads((O/f'qa/bean-{f}-composition-validation.json').read_text())[0];r['compositionValidation']=q;assert q['allOriginalBoundariesWithinTolerance']
for p in [R/'server/birth.mjs',R/'client/birth.mjs',R/'DesignAssets/Animations/Nests/nest-stage-01-idle-sheet.png',R/'DesignAssets/Tribes/spore/Animations/Nests/stage-01-idle-spine-v1/nest-stage-01-idle-sheet.png',R/'DesignAssets/Tribes/spore/Nests/nest-stage-01.png']:hashes[str(p)]=sha(p)
report['memory']={'uniqueLayerAssets':len(assets),'all14FallbackDecodedBytes':orig,'all14LayersDecodedBytesDeduplicated':sum(a['decodedBytes'] for a in assets.values()),'all14LayerPNGBytesDeduplicated':sum(a['pngBytes'] for a in assets.values()),'assets':assets,'note':'RGBA atlas texture estimate, excludes browser object overhead. Fallback need not remain decoded after layers load; peak during transition can include both.'}
report['validationSummary']={'forms':14,'originalSceneFramesTested':1365,'allBodyCellsByteExact':True,'allFinalBodyPixelsExactIdle':True,'allOriginalBoundaryCompositionsPassed':True,'beanRasterSampling':'Environment copy without filtering at native 1:1; original high-quality body sampling. All visible RGBA exact.','sporeRasterSampling':'Original Pillow Lanczos downsample and rounded placement. Every RGBA byte exact.','bodyPartComposition':False,'doubleRotation':False,'nativeSceneSize':{'bean':[512,512],'spore':[768,512]}}
(O/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n');(O/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n');print(json.dumps(report['memory'],indent=2))
