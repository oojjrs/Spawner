// Reviewed frontal/left-consistent birth sources retain exact pixels; only registration changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {UNIT_ACTION_ART as A} from './unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART as B} from './unit-birth-art-assets.mjs';
import {createUnitActionArt,unitActionArtPose} from './unit-action-art.mjs';
import {unitFrameMirror,unitDisplaySize} from './unit-size.mjs';
const root=new URL('../',import.meta.url),here=new URL('../tools/spring-native-facing-20261108/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,here)));
const frozen=read('remaining-facing-spring-birth-current-catalog.json');
const baseline=read('remaining-facing-spring-birth-fix-source-baseline.json');
const inventory=read('remaining-facing-spring-birth-metadata-inventory.json');
const expectedFacing='left';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const keys=Object.keys(frozen);
const sha=path=>createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex');
const selected=k=>B[k]||A[k].actions.birth;
function actor(key,clip){const form=key.split('/')[1];return{tribe:'spring',attributes:form==='base'?{}:Object.fromEntries(form.split('-').map(g=>[g==='gather'?'strength':g,1])),health:10,birth:{startedAt:10,readyAt:10+clip.durationsMs.reduce((s,n)=>s+n,0)/1000}};}
function recordContext(){const canvas=createCanvas(768,768),native=canvas.getContext('2d'),calls=[];const context=new Proxy(native,{get(t,k){if(k==='drawImage')return(...args)=>{calls.push({args,sign:Math.sign(t.getTransform().a)});return t.drawImage(...args)};const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;},set(t,k,v){Reflect.set(t,k,v,t);return true;}});return{canvas,context,calls};}
function expectedDraws(clip,frame,layered){return layered?clip.sceneLayers.layers.filter(l=>l.samples[frame]).map(l=>({image:l.image,frame:l.samples[frame].frame,w:l.frameSize,h:l.frameHeight,cols:l.columns,destination:l.samples[frame].destination})): [{image:clip.image,frame,w:clip.frameSize,h:clip.frameHeight||clip.frameSize,cols:clip.columns}];}
async function verifyFrames(key,forceFallback=false){const clip=selected(key),agent=actor(key,clip),loads=[],imagePaths=new WeakMap();const layers=clip.sceneLayers?.layers||[];const art=createUnitActionArt(p=>p,createCanvas,async p=>{loads.push(p);if(forceFallback&&layers.some(l=>l.image===p))throw Error('deliberate layer load failure');const image=await loadImage(new URL(p,root));imagePaths.set(image,p);return image;});await art.prepare(agent,10);let elapsed=0,draws=0,lastSigns={};
 for(let frame=0;frame<clip.frameCount;frame++){const time=10+(elapsed+clip.durationsMs[frame]/2)/1000,pose=unitActionArtPose(agent,time);assert.equal(pose.animation,clip,key+' priority');assert.equal(pose.frame,frame,key+' exact source frame');
  for(const target of [-1,1]){const c=recordContext();assert.equal(art.draw(c.context,agent,time,384,640,128,target===-1),true);const expected=expectedDraws(clip,frame,layers.length>0&&!forceFallback);assert.equal(c.calls.length,expected.length,key+' draw ownership');
   expected.forEach((e,j)=>{const call=c.calls[j];assert.equal(imagePaths.get(call.args[0]),e.image);assert.deepEqual(call.args.slice(1,5),[e.frame%e.cols*e.w,Math.floor(e.frame/e.cols)*e.h,e.w,e.h]);assert.equal(call.sign,unitFrameMirror(expectedFacing,target)?-1:1,key+' target transform');if(e.destination){const s=128*unitDisplaySize(agent)/clip.referenceLength;assert.deepEqual(call.args.slice(5),[(e.destination[0]-clip.pivotX)*s,(e.destination[1]-clip.pivotY)*s,e.destination[2]*s,e.destination[3]*s]);}});lastSigns[target]=c.calls.at(-1).sign;draws++;}
  elapsed+=clip.durationsMs[frame];
 }
 if(!forceFallback){const after=agent.birth.readyAt+1e-6;const idle=unitActionArtPose(agent,after);assert.equal(idle.action,'idle',key+' boundary handoff');await art.prepare(agent,after);for(const target of[-1,1]){const c=recordContext();assert.equal(art.draw(c.context,agent,after,384,640,128,target===-1),true);assert.equal(c.calls.length,1);assert.equal(c.calls[0].sign,unitFrameMirror('left',target)?-1:1);assert.equal(lastSigns[target]===c.calls[0].sign,true,key+' birth to idle same target');draws++;}}
 if(layers.length&&!forceFallback)assert.ok(!loads.includes(clip.image),key+' native path does not load baked fallback');
 if(forceFallback)assert.ok(loads.includes(clip.image),key+' fallback exercised');
 return draws;
}
test('Spring birth15 and two shadowed action records change only sourceFacing; exact geometry/clock/layers remain',()=>{
 assert.equal(keys.length,15);let aliases=0;for(const k of keys){const before=frozen[k];assert.deepEqual(selected(k),{...before.birth,sourceFacing:expectedFacing},k);assert.equal(Boolean(B[k]),before.selectedFrom==='UNIT_BIRTH_ART');if(before.bakedActionBirth){assert.deepEqual(A[k].actions.birth,{...before.bakedActionBirth,sourceFacing:expectedFacing},k+' action alias');aliases++;}}
 assert.equal(aliases,14);assert.equal(keys.reduce((s,k)=>s+selected(k).frameCount,0),271);
});
test('101 source atlases, originals, previews, body/environment layers keep exact frozen SHA-256',()=>{
 assert.equal(baseline.files.length,101);for(const f of baseline.files){assert.equal(sha(f.path),f.sha256,f.path);assert.equal(fs.statSync(new URL(f.path,root)).size,f.bytes,f.path+' bytes');}
});
test('all 271 birth frames and15 idle handoffs use native Canvas with exact cells and both target transforms',async()=>{
 let draws=0;for(const k of keys)draws+=await verifyFrames(k);assert.equal(draws,572);
});
test('all120 layered birth fallback frames retain exact source orientation for both targets',async()=>{
 let draws=0;for(const k of keys)if(selected(k).sceneLayers)draws+=await verifyFrames(k,true);assert.equal(draws,240);
});
test('11 publication regeneration inputs explicitly preserve native left orientation after the fix',()=>{
 const rows=inventory.publicationAndSourceBirthRecords.filter(r=>r.role==='regeneration-input');assert.equal(rows.length,11);
 for(const row of rows){const file=JSON.parse(fs.readFileSync(new URL(row.path,root))),current=file.actions.birth.sourceFacing;assert.equal(current,'left',row.path+' /actions/birth/sourceFacing');}
});
test('four Spring layered planning payloads retain the exact publication sourceFacing through helper and inline data',()=>{
 const py=`import importlib.util,json\ns=importlib.util.spec_from_file_location('p','scripts/publish-antenna-combo-docs.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nr=[]\nfor path in json.loads(m.INDEX.read_text()):\n p=json.loads((m.ROOT/path).read_text())\n if p['tribe']=='spring' and p['actions']['birth'].get('sceneLayers'):r.append({'key':'unit-spring-'+p['form'],'sourceFacing':p['actions']['birth'].get('sourceFacing'),'clip':m.birth_scene_clip(p['actions']['birth'])})\nprint(json.dumps(r))`;
 const generated=JSON.parse(execFileSync('python',['-c',py],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));assert.equal(generated.length,4);
 let html='';vm.runInNewContext(fs.readFileSync(new URL('DesignAssets/sections/unit-appearance.js',root),'utf8'),{document:{write:s=>html+=s}});
 for(const row of generated){const actual=html.match(new RegExp('<tr[^>]*id="'+row.key+'"[\\s\\S]*?</tr>'))?.[0];assert.ok(actual,row.key);const raw=actual.match(/data-birth-scene="([^"]+)"/)?.[1];assert.ok(raw);const inline=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&amp;','&'));assert.equal(row.clip.sourceFacing,row.sourceFacing,row.key+' helper pass-through');assert.equal(inline.sourceFacing,'left',row.key+' inline native facing');for(const field of['frameSize','frameHeight','durationsMs','loop','sceneLayers'])assert.deepEqual(inline[field],row.clip[field],row.key+' exact helper payload '+field);}
});

// Exact non-technical provenance exclusions only. Geometry, clocks, source paths and hashes stay strict.
const nonTechnicalSourceFields=new Set(["authorizationMessageId","authorizationScope","approvalMessageId","sheetLibraryFileId","previewLibraryFileId","designEditedByWorker","pushedByWorker","generatedWith","generatedWithBuiltInImagegen","sourceApproval"]);
function technicalSourceMetadata(value){
 if(Array.isArray(value))return value.map(technicalSourceMetadata);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!nonTechnicalSourceFields.has(key)).map(([key,entry])=>[key,technicalSourceMetadata(entry)]));
 return value;
}

test('37 active Spring source metadata documents change only the audited birth sourceFacing field',()=>{
 const evidence=read('remaining-facing-spring-birth-source-metadata-before.json');
 assert.equal(evidence.records.length,37);
 for(const record of evidence.records){
  assert.deepEqual(record.document,technicalSourceMetadata(record.document),record.path+' baseline contains technical fields only');
  const expected=structuredClone(record.document);
  const path=record.pointer.slice(1).split('/').map(s=>s.replaceAll('~1','/').replaceAll('~0','~'));
  let target=expected;
  for(const part of path.slice(0,-1))target=target[part];
  assert.equal(path.at(-1),'sourceFacing');
  assert.ok(target.sourceFacing===undefined||target.sourceFacing==='right',record.path+' reviewed prior metadata');
  target.sourceFacing='left';
  assert.deepEqual(technicalSourceMetadata(JSON.parse(fs.readFileSync(new URL(record.path,root)))),expected,record.path+' all non-facing technical metadata preserved');
 }
});

test('publication helper passes an existing facing unchanged and never invents a left default',()=>{
 const py=`import importlib.util,json,copy
s=importlib.util.spec_from_file_location('p','scripts/publish-antenna-combo-docs.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=json.loads((m.ROOT/'AnimationCandidates/spring-blade-antenna-fullbody-v1-20261107/publication-manifest.json').read_text())['actions']['birth']
a=copy.deepcopy(p);a.pop('sourceFacing',None)
b=copy.deepcopy(a);b['sourceFacing']='right'
c=copy.deepcopy(a);c['sourceFacing']='left'
print(json.dumps({'missing':m.birth_scene_clip(a),'right':m.birth_scene_clip(b),'left':m.birth_scene_clip(c)}))`;
 const value=JSON.parse(execFileSync('python',['-c',py],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
 assert.equal(Object.hasOwn(value.missing,'sourceFacing'),false);
 assert.deepEqual(value.right,{...value.missing,sourceFacing:'right'});
 assert.deepEqual(value.left,{...value.missing,sourceFacing:'left'});
});
