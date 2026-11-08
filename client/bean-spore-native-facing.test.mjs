import {afterPebbleScreenReview} from './test-support/approved-art-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART} from './unit-birth-art-assets.mjs';
import {BEAN_HELD_HURT_SOURCES} from './bean-held-hurt-assets.mjs';
import {SPECIES_HELD_HURT_SOURCES} from './species-held-hurt-assets.mjs';
import {UNIT_RANGED_FORMS} from './unit-ranged.mjs';
import {UNIT_SECRETION_IDLE_ANIMATIONS} from './secretion-idle.mjs';
import {createUnitActionArt,unitActionArtPose} from './unit-action-art.mjs';
import {UNIT_COMBINATION_FORMS} from './unit-combination-forms.mjs';
import {drawBeanHeldHurt} from './bean-held-hurt.mjs';
import {drawSpeciesHeldHurt} from './species-held-hurt.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=n=>JSON.parse(readFileSync(new URL('../tools/spring-native-facing-20261108/'+n,import.meta.url)));
const before=load('bean-spore-plan-registry.json'),plan=load('bean-spore-technical-plan.json');
const springFollowup=load('followup13-integration-map.json').items;
const unchangedProjectiles=new Set(['bean','spore'].map(t=>before.UNIT_RANGED_FORMS[t].projectile.image));
const current={UNIT_ACTION_ART,UNIT_BIRTH_ART,BEAN_HELD_HURT_SOURCES,SPECIES_HELD_HURT_SOURCES,UNIT_RANGED_FORMS,UNIT_SECRETION_IDLE_ANIMATIONS};
const clean=x=>JSON.parse(JSON.stringify(x));
const heldKeys=['bean/base','bean/secretion','spore/base','spore/secretion','spore/antenna'];
function held(c,key){const[t,f]=key.split('/');return t==='bean'?c.BEAN_HELD_HURT_SOURCES[f]:c.SPECIES_HELD_HURT_SOURCES[t][f];}
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
// User revision 10758697 retimes this walk and removes unsupported blade ranged routes.
// Keep those exact upstream contracts while checking only source-facing transforms.
const upstreamGatherWalkDurations=[...Array(23).fill(40),20,20,40,25,25,20,20,10,10,10];
const upstreamRemovedRanged=new Set(['bean/blade','spore/blade','pebble/blade','spring/blade']);
const remainingNativeChanges=load('remaining-facing-pebble-image-changes.json').changes;
const remainingFullForms=new Set([...load('remaining-facing-pebble2-plan.json').targets,...load('remaining-facing-pebble-extra-plan.json').fullFamilyTargets]);
const remainingBirthLabels=new Map(load('remaining-facing-spring-birth-fix-plan.json').mainRuntimeRegistrations.map(r=>[r.key,r.image]));
const springBirthImages=new Set(load('remaining-facing-spring-birth-fix-plan.json').mainRuntimeRegistrations.map(r=>r.image));
function exactRemainingClip(original){
 const out=structuredClone(original),change=remainingNativeChanges[original.image];
 if(change){
  const w=original.frameSize??original.frameWidth;assert.ok(w,original.image+' fixed native cell width');out.image=change.afterPath;out.sourceFacing='left';
  if(original.pivotX!==undefined)out.pivotX=w-original.pivotX;
  if(original.outletX!==undefined)out.outletX=w-original.outletX;
  if(original.scene?.outletX!==undefined)out.scene.outletX=w-original.scene.outletX;
  if(original.sceneLayers)for(const layer of out.sceneLayers.layers){const layerChange=remainingNativeChanges[layer.image];if(layerChange)layer.image=layerChange.afterPath;for(const sample of layer.samples)if(sample)sample.destination[0]=w-sample.destination[0]-sample.destination[2];}
  if(change.framePermutation?.some((value,i)=>value!==i)&&!original.times)out.frames=(original.frames||Array.from({length:original.frameCount},(_,i)=>i)).map(i=>change.framePermutation[i]);
 }
 if(springBirthImages.has(original.image))out.sourceFacing='left';
 return out;
}

const confirmedFacing=JSON.parse(readFileSync(new URL('../tools/confirmed-facing-20261108/bean-spore-image-changes.json',import.meta.url))).changes;
const confirmedForms=new Set(['bean/blade-carapace-antenna','bean/blade-secretion-carapace-antenna']);
const confirmedLabel=label=>[...confirmedForms].some(k=>label===k||label.startsWith(k+'.'));
const laterFacing=JSON.parse(readFileSync(new URL('../tools/facing-combo-audit-20261108/bean-reflect-image-changes.json',import.meta.url))).changes;
const laterForms=new Set(['bean/blade-carapace','bean/blade-secretion-carapace-antenna']);
const laterLabel=label=>[...laterForms].some(k=>label===k||label.startsWith(k+'.'));
const reflectionParity=label=>1 ^ Number(confirmedLabel(label)) ^ Number(laterLabel(label));
const correctionDestinations=new Set([...Object.values(confirmedFacing),...Object.values(laterFacing)].map(c=>c.newImage));
const imagePairs=new Map(), extraImagePairs=[], pairParity=new Map();
function recordParity(old,now,label){
 const key=JSON.stringify([old,now]),parity=reflectionParity(label);
 if(pairParity.has(key))assert.equal(pairParity.get(key),parity,label+' consistent source/destination reflection parity');
 pairParity.set(key,parity);
}

function mapImages(a,b,label){
 if(!a||typeof a!=='object')return;
 if(typeof a.image==='string'){assert.ok(b?.image,label);recordParity(a.image,b.image,label);const old=imagePairs.get(a.image);if(old&&old!==b.image){assert.ok(confirmedLabel(label)||laterLabel(label)||correctionDestinations.has(old)||correctionDestinations.has(b.image),label+' only confirmed copy-on-write split');extraImagePairs.push([a.image,b.image]);}else imagePairs.set(a.image,b.image);}
 if(typeof a.portrait==='string'){recordParity(a.portrait,b.portrait,label);imagePairs.set(a.portrait,b.portrait);}
 for(const[k,v]of Object.entries(a))if(v&&typeof v==='object')mapImages(v,b?.[k],label+'.'+k);
}
for(const k of plan.candidateForms){mapImages(before.UNIT_ACTION_ART[k],UNIT_ACTION_ART[k],k);if(before.UNIT_BIRTH_ART[k])mapImages(before.UNIT_BIRTH_ART[k],UNIT_BIRTH_ART[k],k+'.birth');}
for(const k of heldKeys)mapImages(held(before,k),held(current,k),k+'.held');
for(const t of ['bean','spore']){mapImages(before.UNIT_RANGED_FORMS[t],clean(UNIT_RANGED_FORMS[t]),t+'.ranged');mapImages(before.UNIT_SECRETION_IDLE_ANIMATIONS[t],UNIT_SECRETION_IDLE_ANIMATIONS[t],t+'.secretionIdle');}
function verifyClip(old,now,label){
 assert.equal(now.sourceFacing,'left',label+' sourceFacing');
 near(now.pivotX,reflectionParity(label)?(old.frameSize??old.frameWidth)-old.pivotX:old.pivotX,label+' pivotX');
 assert.deepEqual(now.durationsMs,label==='bean/gather.walk'?upstreamGatherWalkDurations:old.durationsMs,label+' preserves approved clock');
 for(const key of ['frameSize','frameHeight','frameWidth','columns','frameCount','durationMs','loop','hitTimeMs','launchAtMs','releaseAtMs','pivotY','referenceLength','viewSize','registrationScale','times'])
  assert.deepEqual(now[key],old[key],label+' preserves '+key);
 const remap=label==='bean/secretion.hurt'?12:label==='spore/secretion.hurt'?14:0;
 const expectedFrames=remap?(old.frames||Array.from({length:old.durationsMs.length},(_,i)=>i)).map(i=>i+remap):old.frames;
 assert.deepEqual(now.frames,expectedFrames,label+' frame permutation');
 if(old.sceneLayers){
  assert.equal(now.sceneLayers.version,old.sceneLayers.version,label);
  assert.equal(now.sceneLayers.layers.length,old.sceneLayers.layers.length,label);
  old.sceneLayers.layers.forEach((layer,i)=>{
   const next=now.sceneLayers.layers[i];for(const key of ['role','wholeBody','frameSize','frameHeight','columns','frameCount'])assert.deepEqual(next[key],layer[key],label+' layer '+key);
   assert.equal(next.samples.length,layer.samples.length);
   layer.samples.forEach((sample,j)=>{const got=next.samples[j];if(sample===null){assert.equal(got,null);return;}assert.equal(got.frame,sample.frame);const[x,y,w,h]=sample.destination;near(got.destination[0],reflectionParity(label)?old.frameSize-x-w:x,label+' layer sample x');assert.deepEqual(got.destination.slice(1),[y,w,h]);});
  });
 }
}
test('bean/spore 28형태의 184 actions와 reference, birth override는 좌향 등록 및 타이밍·격자를 보존한다',()=>{
 assert.equal(plan.candidateForms.length,28);let count=0;
 for(const key of plan.candidateForms){const a=before.UNIT_ACTION_ART[key],b=UNIT_ACTION_ART[key];verifyClip(a.reference,b.reference,key+'.reference');assert.deepEqual(Object.keys(b.actions).sort(),Object.keys(a.actions).sort());for(const[act,c]of Object.entries(a.actions)){verifyClip(c,b.actions[act],key+'.'+act);count++;}if(before.UNIT_BIRTH_ART[key])verifyClip(before.UNIT_BIRTH_ART[key],UNIT_BIRTH_ART[key],key+'.birthOverride');}
 assert.equal(count,184);
 const canonical=new Set(['idle','walk','attack','ranged','hurt','birth','death']);
 assert.equal(plan.candidateForms.reduce((sum,k)=>sum+Object.keys(before.UNIT_ACTION_ART[k].actions).filter(a=>canonical.has(a)).length,0),171);
 const addedBirths=plan.candidateForms.filter(k=>!before.UNIT_ACTION_ART[k].actions.birth&&before.UNIT_BIRTH_ART[k]);
 assert.equal(addedBirths.length,5);assert.equal(171+addedBirths.length,176);
});
test('제외 6형태와 비선택 종족의 registry는 변하지 않는다',()=>{
 assert.equal(plan.preservedForms.length,6);
 assert.equal(springFollowup.length,13);
 const exceptions=new Set(springFollowup.map(r=>r.key+'/'+r.action));assert.equal(exceptions.size,13);
 for(const row of springFollowup){assert.ok(row.key.startsWith('spring/'));assert.equal(before.UNIT_ACTION_ART[row.key].actions[row.action].image,row.source);}
 for(const key of Object.keys(before.UNIT_ACTION_ART))if(!plan.candidateForms.includes(key)){
  const expected=structuredClone(before.UNIT_ACTION_ART[key]);
  if(upstreamRemovedRanged.has(key)){assert.ok(expected.actions.ranged,key+' upstream removal baseline');delete expected.actions.ranged;assert.equal(Object.hasOwn(UNIT_ACTION_ART[key].actions,'ranged'),false,key+' unsupported blade ranged stays removed');}
  for(const row of springFollowup.filter(r=>r.key===key)){for(const clip of Object.values(expected.actions))if(clip.image===row.source)clip.sourceFacing='left';assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.source,import.meta.url))).digest('hex'),row.candidateSHA256,key+'/'+row.action+' approved pixels');}
  if(key==='spring/gather'){for(const action of ['harvest','carry','throw'])expected.actions[action].sourceFacing='left';assert.equal(createHash('sha256').update(readFileSync(new URL('../'+expected.actions.throw.image,import.meta.url))).digest('hex'),'5dedec26a3c2f6ac5f31db25abbc0ad675bd3cf499ce9751940897168918eeaf',key+' approved left throw pixels');}
  if(remainingFullForms.has(key)){expected.reference=exactRemainingClip(expected.reference);for(const action of Object.keys(expected.actions))expected.actions[action]=exactRemainingClip(expected.actions[action]);}
  else if(key==='pebble/carapace-antenna')expected.actions.birth=exactRemainingClip(expected.actions.birth);
  if(remainingBirthLabels.has(key)&&expected.actions.birth)expected.actions.birth=exactRemainingClip(expected.actions.birth);
  if(key==='pebble/secretion')for(const clip of [expected.reference,...Object.values(expected.actions)])clip.sourceFacing='left';
  assert.deepEqual(UNIT_ACTION_ART[key],afterPebbleScreenReview(key,expected),key+' only exact approved native transforms and upstream contracts may change');
 }
 for(const key of Object.keys(before.UNIT_BIRTH_ART))if(!plan.candidateForms.includes(key)){const original=before.UNIT_BIRTH_ART[key],expected=remainingFullForms.has(key)||remainingBirthLabels.has(key)?exactRemainingClip(original):original;assert.deepEqual(UNIT_BIRTH_ART[key],key==='pebble/secretion'?{...expected,sourceFacing:'left'}:expected,key);}
 for(const t of ['pebble','spring']){const expected=structuredClone(before.UNIT_RANGED_FORMS[t]);if(t==='pebble'){for(const a of ['birth','death'])expected.lifecycle[a].sourceFacing='left';for(const a of ['idle','animation','walk','hurt'])expected[a].sourceFacing='left';}else expected.lifecycle.birth.sourceFacing='left';assert.deepEqual(clean(UNIT_RANGED_FORMS[t]),expected,t+' ranged keeps independent lifecycle source convention');}
});
test('공유 환경은 새 content-address 경로, bean-seed-b는 후보만 copy-on-write한다',()=>{
 const old='DesignAssets/Animations/BirthResolutionV1/bean-seed-b.png',replacement=imagePairs.get(old);assert.ok(replacement&&replacement!==old);
 const layers=k=>(UNIT_BIRTH_ART[k]||UNIT_ACTION_ART[k].actions.birth).sceneLayers.layers;
 for(const k of ['bean/gather','bean/secretion'])assert.equal(layers(k).find(l=>l.role==='environment').image,replacement);
 assert.equal(layers('bean/antenna').find(l=>l.role==='environment').image,old);
 for(const [oldPath,newPath]of imagePairs)if(oldPath.includes('/BirthSceneLayersV1/')){if(newPath===oldPath)assert.ok(correctionDestinations.has(newPath),'only confirmed family may return to prior content-addressed pixels');else assert.notEqual(newPath,oldPath);assert.match(newPath,/\/[a-f0-9]{64}\.png$/);}
});
// Independently decode the immutable Git baseline and current files. The plan's
// SHA must match the Git blob before it can be used as an expected pixel source.
const pixelCheck=String.raw`
import sys,json,subprocess,hashlib,io
from PIL import Image,ImageOps
import numpy as np
x=json.load(sys.stdin);plan={r['image']:r for r in x['files']};soil={r['image']:r for r in x['soilEdits']};counts={'files':0,'cells':0,'heldFiles':0,'protectedFiles':0}
for old,new in x['pairs']:
 r=plan.get(old)
 if old in x['unchangedProjectiles']:
  assert old==new, 'Projectile path changed '+old
  raw=subprocess.check_output(['git','show',x['commit']+':'+old]);assert hashlib.sha256(open(new,'rb').read()).digest()==hashlib.sha256(raw).digest(),('projectile must remain byte-identical',old)
  counts['protectedFiles']+=1
  continue
 assert r is not None, 'Missing baseline grid '+old
 raw=subprocess.check_output(['git','show',x['commit']+':'+old]);assert hashlib.sha256(raw).hexdigest()==r['sha256'], 'Git/plan baseline mismatch '+old
 src=Image.open(io.BytesIO(raw));size=src.size
 if old in soil: assert hashlib.sha256(open(new,'rb').read()).hexdigest()==soil[old]['sha256'],(old,'approved fertile-soil prop bytes')
 g=next((v for v in r['gridVariants'] if all(v.get(k) for k in ['frameWidth','frameHeight','columns'])), {'frameWidth':src.width,'frameHeight':src.height,'columns':1})
 w,h,cols=int(g['frameWidth']),int(g['frameHeight']),int(g['columns']);assert src.width%w==0 and src.height%h==0,old
 n=x['held'].get(old);cap=(src.width//w)*(src.height//h)
 def digest(cell,index):
  a=np.array(cell.convert('RGBA'));a[a[:,:,3]==0,:3]=0
  if old in soil:
   dx,dy=(index%cols)*w,(index//cols)*h
   # Mask only approved fertile-soil prop edits on both sides.
   for left,top,bw,bh in soil[old]['boxes']:
    x0,y0=max(0,left-dx),max(0,top-dy);x1,y1=min(w,left+bw-dx),min(h,top+bh-dy)
    if x1>x0 and y1>y0:a[y0:y1,x0:x1]=0
  return hashlib.sha256(a.tobytes()).digest()
 expected=[]
 for i in range(cap):
  source=(i+n if i<n else i-n) if n and i<2*n else i
  sx,sy=(source%cols)*w,(source//cols)*h
  cell=src.crop((sx,sy,sx+w,sy+h))
  expected.append(digest(ImageOps.mirror(cell) if x['pairParity'][json.dumps([old,new],separators=(',',':'))] else cell,i))
 src.close();del src,raw,cell
 import gc;gc.collect()
 # Decode one atlas at a time, particularly the 25M-pixel legacy WebP sheets.
 dst=Image.open(new);assert dst.size==size,(old,'dimensions')
 for i in range(cap):
  dx,dy=(i%cols)*w,(i//cols)*h
  assert expected[i]==digest(dst.crop((dx,dy,dx+w,dy+h)),i),(old,new,'cell',i,'visible RGBA differs from immutable baseline cell reflection')
  counts['cells']+=1
 dst.close();del dst,expected;gc.collect()
 counts['files']+=1;counts['heldFiles']+=bool(n)
for p in x['protected']:
 old=subprocess.check_output(['git','show',x['commit']+':'+p]);assert hashlib.sha256(open(p,'rb').read()).digest()==hashlib.sha256(old).digest(),('protected pixels changed',p);counts['protectedFiles']+=1
print(json.dumps(counts))
`;
const baselineCommit='958b999dc5109cb4827f2013916840c22c7adf07';
const soilEdits=JSON.parse(readFileSync(new URL('../tools/fertile-soil-cargo-review.json',import.meta.url))).files;
test('실제 RGBA 픽셀은 셀별 반전이며 held hurt는 두 블록을 교환하고 제외6형태 픽셀은 보존한다',()=>{
 const heldMap=Object.fromEntries(heldKeys.map(k=>{const s=held(before,k);return[s.image,s.times.length];}));
 const protectedPaths=new Set();function collect(x){if(!x||typeof x!=='object')return;if(x.image)protectedPaths.add(x.image);if(x.portrait)protectedPaths.add(x.portrait);Object.values(x).forEach(collect);}
 for(const k of plan.preservedForms){collect(before.UNIT_ACTION_ART[k]);collect(before.UNIT_BIRTH_ART[k]);}
 // Release decoded atlas memory between files. A single Python process retains
 // native image arenas across large birth sheets and can exceed the CI limit.
 const counts={files:0,cells:0,heldFiles:0,protectedFiles:0};
 const batches=[...[...imagePairs,...extraImagePairs].map(pair=>({pairs:[pair],protected:[]})),{pairs:[],protected:[...protectedPaths]}];
 for(const batch of batches){
  const result=execFileSync('python',['-c',pixelCheck],{cwd:root,input:JSON.stringify({commit:baselineCommit,files:plan.files,soilEdits,...batch,pairParity:Object.fromEntries(pairParity),held:heldMap,unchangedProjectiles:[...unchangedProjectiles]}),maxBuffer:1024*1024,timeout:600000}).toString();
  for(const[key,value]of Object.entries(JSON.parse(result)))counts[key]+=value;
 }
 assert.equal(counts.heldFiles,5);assert.equal(counts.files,imagePairs.size+extraImagePairs.length-unchangedProjectiles.size);console.log('bean/spore independent pixel coverage',counts);
});
function agentFor(key){const[tribe,form]=key.split('/');return{tribe,attributes:UNIT_COMBINATION_FORMS.find(f=>f.key===form)?.attributes||(form==='base'?{}:form==='gather'?{strength:1}:{[form]:1}),health:10,bornAt:0};}
function stateAgent(key,action,clip){const a=agentFor(key),seconds=clip.durationsMs.reduce((x,y)=>x+y,0)/1000;
 if(action==='death')Object.assign(a,{health:0,deathStartedAt:0});
 else if(action==='birth')a.birth={startedAt:0,readyAt:seconds};
 else if(action==='hurt')a.hurtStartedAt=0;
 else if(['attack','ranged'].includes(action))a.attack={startedAt:0,endsAt:seconds,mode:action==='ranged'?'ranged':'melee'};
 else if(['walk','carry'].includes(action))Object.assign(a,{moveStartedAt:0,moveDuration:seconds+1,carrying:action==='carry'?1:0});
 else if(action==='harvest')Object.assign(a,{mode:'harvest',harvestStarted:0});
 else if(action==='throw')Object.assign(a,{mode:'unload',foodDelivery:{startedAt:0}});
 return a;
}
test('실사용 188 route의 첫·끝 pose는 752 production draw에서 양방향과 birth override를 확인한다',async()=>{
 const surface=(w,h)=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(w*h*4).fill(255)})})});
 const art=createUnitActionArt(p=>p,surface,async image=>({image}));let draws=0;
 for(const key of plan.candidateForms){
 const effective={...UNIT_ACTION_ART[key].actions,...(UNIT_BIRTH_ART[key]?{birth:UNIT_BIRTH_ART[key]}:{})};
 // jump is a registered fallback clip, but unitActionArtPose has no jump state input.
 // Its metadata and pixels are covered above, without pretending this draw path reaches it.
 for(const[action,authored]of Object.entries(effective).filter(([a])=>a!=='jump')){
  const clip=action==='birth'?(UNIT_BIRTH_ART[key]||authored):authored;
  const sum=clip.durationsMs.reduce((a,b)=>a+b,0),times=[clip.durationsMs[0]/2,(sum-clip.durationsMs.at(-1)/2)];
  for(const ms of times){const agent=stateAgent(key,action,clip),time=ms/1000,pose=unitActionArtPose(agent,time);assert.equal(pose.action,action,key);assert.equal(pose.animation.image,clip.image,key+'.'+action);await art.prepare(agent,time);
   for(const facing of [-1,1]){const scales=[],calls=[],ctx={save(){},restore(){},translate(){},scale:(...v)=>scales.push(v),drawImage:(...v)=>calls.push(v)};
    assert.equal(art.draw(ctx,agent,time,200,400,100,facing===-1),true);assert.deepEqual(scales,[[facing===-1?1:-1,1]],key+'.'+action);
    const allowed=new Set([clip.image,...(clip.sceneLayers?.layers||[]).map(l=>l.image)]);for(const call of calls)assert.ok(allowed.has(call[0].image),key+' source');draws++;
   }
  }
 }
 }
 assert.equal(draws,752);
});
test('우선 held hurt 5개는 양쪽 facing 및 피격 방향의 264 draw에서 교환된 원본 블록을 선택한다',()=>{
 let draws=0;
 for(const key of heldKeys){const old=held(before,key),source=held(current,key);assert.equal(source.sourceFacing,'left');near(source.pivotX,old.frameWidth-old.pivotX,key);for(const f of ['frameWidth','frameHeight','columns','pivotY','times','referenceLength','bodyWidth','worldScale'])assert.deepEqual(source[f],old[f],key+'.'+f);
  const fn=key.startsWith('bean/')?drawBeanHeldHurt:drawSpeciesHeldHurt,agent={...agentFor(key),hurtStartedAt:0};
  const image={image:source.image,complete:true,width:source.frameWidth*source.columns,height:source.frameHeight*Math.ceil(source.times.length*2/source.columns)};
  for(let f=0;f<source.times.length;f++)for(const facing of [-1,1])for(const hitSide of [-1,1]){const calls=[],scales=[],ctx={save(){},restore(){},translate(){},scale:(...v)=>scales.push(v),drawImage:(...v)=>calls.push(v)};assert.equal(fn(ctx,agent,source.times[f]+1e-6,()=>image,{cell:100,mirror:facing===-1,hitSide}),true,key);
   const sx=facing===-1?1:-1,index=f+(hitSide*sx>0?source.times.length:0);assert.deepEqual(scales,[[sx,1]]);assert.deepEqual(calls[0].slice(1,5),[index%source.columns*source.frameWidth,Math.floor(index/source.columns)*source.frameHeight,source.frameWidth,source.frameHeight]);draws++;
  }
 }
 assert.equal(draws,264);
});
