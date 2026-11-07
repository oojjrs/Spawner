#!/usr/bin/env python3
"""Reproducible lossless whole-cell birth layers; no source mutations."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,math,subprocess,os,numpy as np,gc,ctypes
def release():
 gc.collect();ctypes.CDLL(None).malloc_trim(0)
OUT=Path(__file__).resolve().parent
R=Path(os.environ.get('SPAWNER_SOURCE',str(OUT.parents[1])))
SP=Path(os.environ.get('SPORE_BUILD_SOURCE',str(R/'AnimationCandidates/spore-antenna-combos-fullbody-v1-20261107')))
PREFIX='AnimationCandidates/'+OUT.name+'/'
forms=['blade-antenna','carapace-antenna','secretion-antenna','blade-carapace-antenna','blade-secretion-antenna','secretion-carapace-antenna','blade-secretion-carapace-antenna']
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def cell(im,i,w=512,h=512,cols=8):return im.crop((i%cols*w,i//cols*h,i%cols*w+w,i//cols*h+h)).convert('RGBA')
def bounds(im):return im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
def pack(frames,path,trim=False):
 box=None
 if trim:
  boxes=[f.getbbox() for f in frames if f.getbbox()]
  box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
 unique=[];lookup={};mapping=[]
 for f in frames:
  c=f.crop(box) if box else f;h=hashlib.sha256(c.tobytes()).hexdigest()
  if h not in lookup:lookup[h]=len(unique);unique.append(c)
  elif box:c.close()
  mapping.append(lookup[h])
 w,h=unique[0].size;cols=min(8,len(unique));sheet=Image.new('RGBA',(w*cols,h*math.ceil(len(unique)/cols)))
 for i,f in enumerate(unique):sheet.paste(f,(i%cols*w,i//cols*h))
 path.parent.mkdir(parents=True,exist_ok=True);sheet.save(path)
 # Prove all stored cells byte-identical, including transparent RGB.
 for i,f in enumerate(unique):assert cell(sheet,i,w,h,cols).tobytes()==f.tobytes()
 info={'imageSHA256':sha(path),'image':PREFIX+str(path.relative_to(OUT)),'frameSize':w,'frameHeight':h,'columns':cols,'frameCount':len(unique)}
 stats={'sheetSHA256':sha(path),'uniqueFrames':len(unique),'decodedBytes':sheet.width*sheet.height*4,'pngBytes':path.stat().st_size,'cellPixelHashes':list(lookup),'uniformTrim':box}
 sheet.close()
 if box:
  for f in unique:f.close()
 return info,mapping,stats,box
# Extract original environment draw calls, before any body draw, from the original bean builder.
broot=R/'AnimationCandidates/bean-antenna-combos-fullbody-v1-20261107'
src=(broot/forms[0]/'render-complete-scene.mjs').read_text()
start=src.index('const W=512');end=src.index('const hash=')
setup=src[start:end].replace("const nestPath=", "const nestPath=")
loop=src[src.index('  const t=times[i]/1000'):src.index('  let frame=null')]
node="""import {createRequire} from 'node:module';import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';
"""+f"import {{agentBirthMotion,AGENT_BIRTH_DURATION}} from '{(R/'server/birth.mjs').as_uri()}';\nimport {{drawBirthSeed,drawBirthFragments,drawBirthImpact}} from '{(R/'client/birth.mjs').as_uri()}';\nconst {{createCanvas,loadImage}}=createRequire('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json')('@napi-rs/canvas');const repo={json.dumps(str(R))};const out={json.dumps(str(OUT))};\n"+setup+"\nmkdirSync(out+'/bean/environment-frames',{recursive:true});\nfor(let i=0;i<times.length;i++){\n"+loop+"\nwriteFileSync(out+'/bean/environment-frames/'+i+'.png',c.toBuffer('image/png'));}\n"
(OUT/'extract-bean-environment.mjs').write_text(node)
subprocess.run(['node',str(OUT/'extract-bean-environment.mjs')],check=True)
envs=[Image.open(OUT/f'bean/environment-frames/{i}.png').convert('RGBA') for i in range(117)]
einfo,emap,estats,ebox=pack(envs,OUT/'bean/environment.png',True)
for f in envs:f.close()
entries=[];reports=[];sourcehashes={}
# Bean body mapping is taken directly from every original scene manifest.
for form in forms:
 d=broot/form;pub=json.loads((d/'publication-manifest.json').read_text());birth=pub['actions']['birth'];manifest=json.loads((d/'complete-scene-manifest.json').read_text());records=manifest['forms'][form]['frames'];bp=d/f'bean-{form}-birth-body-v1-sheet.png'
 with Image.open(bp) as im:body=[cell(im,i) for i in range(16)]
 bi,bmap,bstats,_=pack(body,OUT/f'bean/{form}/body.png');samples=[]
 for rec in records:
  k=rec['bodyFrame'];samples.append(None if k is None else {'frame':bmap[k],'destination':[390,rec['bodyFloor']-70,80,80]})
 ei=dict(einfo,role='environment',samples=[{'frame':k,'destination':[ebox[0],ebox[1],ebox[2]-ebox[0],ebox[3]-ebox[1]]} for k in emap]);bi.update(role='body',wholeBody=True,samples=samples)
 layers={'version':1,'layers':[ei,bi]};entry={'tribe':'bean','form':form,'sourcePublication':str((d/'publication-manifest.json').relative_to(R)),'birth':dict(birth,sceneLayers=layers),'sceneLayers':layers};entries.append(entry)
 dump(OUT/f'layer-publications/bean-{form}.json',entry)
 sourcehashes.update({str(p):sha(p) for p in [bp,d/'complete-scene-manifest.json',d/'render-complete-scene.mjs',d/'publication-manifest.json']})
 assert len(samples)==117 and sum(birth['durationsMs'])==4500
 reports.append({'tribe':'bean','form':form,'bodyPixelsByteExact':True,'frameCount':117,'durationMs':4500,'body':bstats,'environment':estats,'mappingMatchesOriginalManifest':True})
 for f in body:f.close()
 print('packed bean',form,flush=True)
# Spore: use original environment-only builder statements and original already-rotated body cells.
senvinfo=None
for form in forms:
 d=R/f'AnimationCandidates/spore-antenna-combos-fullbody-v1-20261107/{form}';bd=SP/form
 pub=json.loads((d/'publication-manifest.json').read_text());birth=pub['actions']['birth'];trace=json.loads((bd/'birth-runtime-trace.json').read_text());bp=d/f'spore-{form}-birth-body-v1-sheet.png'
 with Image.open(bp) as im:body=[cell(im,i) for i in range(78)]
 height=bounds(body[-1])[3]-bounds(body[-1])[1]
 src=(bd/'build_package.py').read_text();geometry=src[src.index('ns=Image.open('):src.index('for i,sample in enumerate(trace[\'samples\']):',src.index('ns=Image.open('))]
 ctx=dict(Image=Image,R=R,trace=trace,bounds=bounds,height=height);exec(geometry,ctx)
 ns=ctx['ns'];sceneScale=ctx['sceneScale'];outlet=ctx['outlet'];cellsize=ctx['cell'];env=[];dest=[];comparisons=[];contacts=[]
 original=Image.open(d/f'spore-{form}-birth-v1-sheet.png')
 for i,sample in enumerate(trace['samples']):
  t=sample['time'];p=sample['placement'];f=Image.new('RGBA',(768,512));j=int(t/(4/96))%96;n=cell(ns,j,512,512,12).resize((round(ctx['sz']),round(ctx['sz'])),Image.Resampling.LANCZOS);f.alpha_composite(n,(round(ctx['nx']),round(ctx['ny'])));env.append(f)
  placement=None;composed=f.copy()
  if p['unitVisible']:
   root=(outlet[0]+p['rootX']*cellsize,outlet[1]+p['rootY']*cellsize);size=round(512*sceneScale);placement=[round(root[0]-256*sceneScale),round(root[1]-416*sceneScale),size,size]
   composed.alpha_composite(body[i].resize((size,size),Image.Resampling.LANCZOS),placement[:2])
  dest.append(placement);old=cell(original,i,768,512);a=np.array(composed);b=np.array(old);assert np.array_equal(a,b),(form,i,int(np.abs(a.astype(int)-b.astype(int)).max()))
  comparisons.append({'frame':i,'timeMs':round(t*1000),'exactRGBA':True})
  if i in [0,20,21,30,51,60,61,77]:contacts.extend([old.copy(),composed.copy()])
 original.close();ns.close();ctx['nest'].close();del original,ctx;release()
 print('spore comparison passed',form,flush=True)
 ei,em,es,box=pack(env,OUT/f'spore/environment-{form}.png',True)
 # Share by complete pixel-hash identity, independent of form.
 if senvinfo is None:senvinfo=(ei,em,es,box)
 else:
  assert es['cellPixelHashes']==senvinfo[2]['cellPixelHashes'] and box==senvinfo[3]
  (OUT/f'spore/environment-{form}.png').unlink();ei,em,es,box=senvinfo
 for f in env:f.close()
 env=[];release()
 print('spore environment packed',form,flush=True)
 bi,bmap,bs,_=pack(body,OUT/f'spore/{form}/body.png');bi.update(role='body',wholeBody=True,samples=[None if p is None else {'frame':bmap[i],'destination':p} for i,p in enumerate(dest)])
 ei=dict(ei,role='environment',samples=[{'frame':k,'destination':[box[0],box[1],box[2]-box[0],box[3]-box[1]]} for k in em]);layers={'version':1,'layers':[ei,bi]}
 entry={'tribe':'spore','form':form,'sourcePublication':str((d/'publication-manifest.json').relative_to(R)),'birth':dict(birth,sceneLayers=layers),'sceneLayers':layers};entries.append(entry);dump(OUT/f'layer-publications/spore-{form}.json',entry)
 assert len(dest)==78 and sum(birth['durationsMs'])==3120
 reports.append({'tribe':'spore','form':form,'bodyPixelsByteExact':True,'compositionEveryOriginalBoundaryExact':True,'comparisons':comparisons,'frameCount':78,'durationMs':3120,'body':bs,'environment':es,'sourceRotationAlreadyBaked':True})
 contact=Image.new('RGB',(768,256*8),'#ddd9cf')
 for i,f in enumerate(contacts):bg=Image.new('RGBA',f.size,'#ddd9cf');bg.alpha_composite(f);contact.paste(bg.convert('RGB').resize((384,256)),(i%2*384,i//2*256))
 (OUT/'qa').mkdir(exist_ok=True);contact.save(OUT/f'qa/spore-{form}-original-layered.jpg',quality=90)
 for f in env+body+contacts:f.close()
 sourcehashes.update({str(p):sha(p) for p in [bp,bd/'birth-runtime-trace.json',bd/'build_package.py',d/'publication-manifest.json']})
 release();print('packed and exact-validated spore',form,flush=True)
dump(OUT/'layer-publications/index.json',{'version':1,'entries':entries})
dump(OUT/'source-hashes.json',sourcehashes);dump(OUT/'validation-report.json',{'forms':reports,'fallbackUntouched':True,'masterTimelineUntouched':True})
