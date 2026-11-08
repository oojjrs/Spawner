// Independent regression: immutable Git pixels, exact metadata, and native Node Canvas.
// Native raster tests below use real source images, not mock contexts or a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {UNIT_ACTION_ART as A} from './unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART as B} from './unit-birth-art-assets.mjs';
import {SPECIES_HELD_HURT_SOURCES as H} from './species-held-hurt-assets.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG as P} from './pebble-packed-birth-catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir='tools/spring-native-facing-20261108/';
const read=name=>JSON.parse(readFileSync(root+dir+name));
const baseline=read('remaining-facing-runtime-baseline.json');
const commit='3d4b2214c2be9e69e002fd99704026b8b568fcb2';
const full=['base','gather','antenna','blade-secretion','blade-secretion-antenna','secretion-antenna','blade-secretion-carapace','blade-secretion-carapace-antenna'].map(f=>'pebble/'+f);
const partial='pebble/carapace-antenna';
const changes=read('remaining-facing-pebble-image-changes.json');
const packedChanges=read('remaining-facing-pebble-packed-gather-changes.json').changes;
const pixels={...changes.changes,...packedChanges};
const near=(a,b,p)=>assert.ok(Math.abs(a-b)<1e-8,`${p}: ${a} != ${b}`);
function expectedClip(before){
 const next=structuredClone(before),width=before.frameSize??before.frameWidth;
 next.sourceFacing='left';if(Number.isFinite(before.pivotX))next.pivotX=width-before.pivotX;
 if(before.scene&&Number.isFinite(before.scene.outletX))next.scene.outletX=width-before.scene.outletX;
 if(before.sceneLayers)for(const layer of next.sceneLayers.layers)for(const sample of layer.samples)if(sample)sample.destination[0]=width-sample.destination[0]-sample.destination[2];
 return next;
}
function compare(actual,expected,label){
 if(typeof expected==='number'){near(actual,expected,label);return;}
 if(!expected||typeof expected!=='object'){assert.equal(actual,expected,label);return;}
 assert.ok(actual&&typeof actual==='object',label);assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),label+' fields');
 for(const k of Object.keys(expected))compare(actual[k],expected[k],label+'/'+k);
}
const registeredGrids={};
function collectGrids(value){if(!value||typeof value!=='object')return;const width=value.frameSize??value.frameWidth,height=value.frameHeight??width;if(value.image&&Number.isInteger(width)&&Number.isInteger(height)&&Number.isInteger(value.columns)){const grid={frameWidth:width,frameHeight:height,columns:value.columns};if(registeredGrids[value.image])assert.deepEqual(registeredGrids[value.image],grid,value.image+' shared registered geometry');registeredGrids[value.image]=grid;}for(const v of Object.values(value))if(v&&typeof v==='object')collectGrids(v);}
function collectPaths(value,set){if(!value||typeof value!=='object')return;for(const[k,v]of Object.entries(value)){if(['image','portrait','sourceAnimation','sourceImage'].includes(k)&&typeof v==='string')set.add(v);else if(v&&typeof v==='object')collectPaths(v,set);}}
const protectedPaths=new Set();for(const[key,definition]of Object.entries(baseline.UNIT_ACTION_ART)){if(!key.startsWith('pebble/')||full.includes(key))continue;collectPaths({...definition,actions:Object.fromEntries(Object.entries(definition.actions).filter(([a])=>key!==partial||a!=='birth'))},protectedPaths);}for(const[key,clip]of Object.entries(baseline.UNIT_BIRTH_ART))if(key.startsWith('pebble/')&&!full.includes(key))collectPaths(clip,protectedPaths);for(const path of Object.keys(pixels))protectedPaths.delete(path);
for(const key of full){collectGrids(baseline.UNIT_ACTION_ART[key]);collectGrids(baseline.UNIT_BIRTH_ART[key]);}collectGrids(baseline.UNIT_ACTION_ART[partial].actions.birth);for(const f of ['base','antenna'])collectGrids(baseline.SPECIES_HELD_HURT_SOURCES.pebble[f]);
const registered=new Set();for(const key of full){collectPaths(baseline.UNIT_ACTION_ART[key],registered);collectPaths(baseline.UNIT_BIRTH_ART[key],registered);}collectPaths(baseline.UNIT_ACTION_ART[partial].actions.birth,registered);for(const f of ['base','antenna'])collectPaths(baseline.SPECIES_HELD_HURT_SOURCES.pebble[f],registered);

test('metadata: eight full families, 52 canonical actions, seven authored aliases, and one partial birth retain exact clocks/geometry except continuous x reflection',()=>{
 assert.equal(baseline.baselineCommit,commit);assert.equal(execFileSync('git',['rev-parse',commit],{cwd:root,encoding:'utf8'}).trim(),commit);
 let authored=0,effective=0,canonical=0,overrides=0;
 for(const key of full){const old=baseline.UNIT_ACTION_ART[key],now=A[key];compare(now.reference,expectedClip(old.reference),key+'/reference');assert.equal(now.portrait,old.portrait);const{reference:oldReference,actions:oldActions,...oldForm}=old;const{reference:newReference,actions:newActions,...newForm}=now;assert.deepEqual(newForm,oldForm,key+' non-clip metadata');assert.deepEqual(Object.keys(now.actions).sort(),Object.keys(old.actions).sort());
  for(const[action,clip]of Object.entries(old.actions)){compare(now.actions[action],expectedClip(clip),key+'/'+action);authored++;}
  if(baseline.UNIT_BIRTH_ART[key]){compare(B[key],expectedClip(baseline.UNIT_BIRTH_ART[key]),key+'/birthOverride');overrides++;}
  const selected={...old.actions,...(baseline.UNIT_BIRTH_ART[key]?{birth:baseline.UNIT_BIRTH_ART[key]}:{})};effective+=Object.keys(selected).length;canonical+=Object.keys(selected).filter(a=>['idle','walk','attack','ranged','hurt','birth','death'].includes(a)).length;
 }
 compare(A[partial].actions.birth,expectedClip(baseline.UNIT_ACTION_ART[partial].actions.birth),partial+'/birth');
 assert.equal(authored,58);assert.equal(overrides,2);assert.equal(effective,59);assert.equal(canonical,52);
 for(const p of registered)assert.ok(pixels[p],'registered source must be independently decoded: '+p);
 assert.equal(registered.size,68);
});

test('metadata: held base/antenna retain 14-frame clocks and reflected pivots, with two independent 14+14 source blocks',()=>{
 for(const f of ['base','antenna']){const old=baseline.SPECIES_HELD_HURT_SOURCES.pebble[f],now=H.pebble[f],expected=expectedClip(old);assert.equal(old.times.length,14);expected.sourceHash=createHash('sha256').update(readFileSync(root+(old.sourceImage||old.sourceAnimation))).digest('hex');if(old.sourceAnimationHash)expected.sourceAnimationHash=createHash('sha256').update(readFileSync(root+old.sourceAnimation)).digest('hex');compare(now,expected,'held/'+f);assert.deepEqual(pixels[old.image].framePermutation,[...Array.from({length:14},(_,i)=>i+14),...Array.from({length:14},(_,i)=>i)]);}
});

test('metadata: unselected Pebble forms and partial-form non-birth clips remain exact; user blade removals and bean gather clock survive',()=>{
 for(const[key,old]of Object.entries(baseline.UNIT_ACTION_ART).filter(([k])=>k.startsWith('pebble/'))){if(full.includes(key))continue;const expected=structuredClone(old);if(key===partial)expected.actions.birth=expectedClip(old.actions.birth);assert.deepEqual(A[key],expected,key);}
 for(const[key,old]of Object.entries(baseline.UNIT_BIRTH_ART).filter(([k])=>k.startsWith('pebble/')&&!full.includes(k)))assert.deepEqual(B[key],old,key);
 for(const f of ['secretion','blade','carapace'])assert.deepEqual(H.pebble[f],baseline.SPECIES_HELD_HURT_SOURCES.pebble[f],'held/'+f);
 for(const tribe of ['bean','spore','pebble','spring'])assert.equal(Object.hasOwn(A[tribe+'/blade'].actions,'ranged'),false,tribe+' unsupported ranged stays removed');
 assert.deepEqual(A['bean/gather'].actions.walk.durationsMs,[...Array(23).fill(40),20,20,40,25,25,20,20,10,10,10]);
});

test('metadata: packed gather keeps atlas coordinates and clocks while source-space bounds reflect around the full cell',async()=>{
 const source=execFileSync('git',['show',commit+':client/pebble-packed-birth-catalog.mjs'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
 const {PEBBLE_PACKED_BIRTH_CATALOG:old}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const f of ['blade','carapace','secretion'])assert.deepEqual(P[f],old[f],f+' packed unchanged');
 const expected=structuredClone(old.gather),width=expected.animation.frameSize;expected.animation=expectedClip(expected.animation);
 for(const frame of expected.frames){const[x1,y1,x2,y2]=frame.bounds;frame.bounds=[width-x2,y1,width-x1,y2];}
 compare(P.gather,expected,'packed gather');const{sceneLayers,...withoutLayers}=B['pebble/gather'];compare(P.gather.animation,withoutLayers,'packed animation matches current birth');assert.equal(P.gather.frames.length,66);
});

test('pixels: immutable Git sources are exact per cell; untracked extras have separate change-map SHA coverage',()=>{
 const value=JSON.parse(execFileSync('python',[dir+'remaining-facing-pebble-independent-pixels.py'],{cwd:root,encoding:'utf8',input:JSON.stringify({commit,registered:[...registered],registeredGrids,protected:[...protectedPaths]}),maxBuffer:2*1024*1024,timeout:600000}));
 assert.equal(value.independentGitSourceFiles,139);assert.equal(value.afterHashOnlySourceFiles,68);assert.equal(value.independentGitPreviewFiles,86);assert.equal(value.afterHashOnlyPreviewFiles,2);assert.equal(value.sourceCells,1479);assert.equal(value.protectedFiles,protectedPaths.size);assert.equal(value.sourceFiles,207);assert.equal(value.previewFiles,88);assert.equal(value.heldFiles,2);assert.equal(value.packedCrops,66);assert.equal(value.registeredFiles,registered.size);console.log('Pebble independent pixel coverage',JSON.stringify(value));
});

test('native Canvas: real production action art covers all reachable frames, both targets, held sides, native/failed-layer birth and packed samplers',()=>{
 const summaries=[];
 for(const key of [...full,partial]){const value=JSON.parse(execFileSync(process.execPath,['--expose-gc',dir+'remaining-facing-pebble-independent-native.mjs',key],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024,timeout:300000}));summaries.push(value);}
 const sum=field=>summaries.reduce((n,s)=>n+s[field],0);
 assert.equal(sum('routes'),69);assert.equal(sum('birthIdleHandoffs'),18);assert.equal(sum('heldDraws'),112);assert.equal(sum('layerFallbackDraws'),132);assert.equal(sum('packedNativeDraws'),132);assert.equal(sum('packedFallbackDraws'),132);
 assert.equal(sum('actionDraws'),1582);console.log('Pebble actual native Node Canvas (not browser or mock)',JSON.stringify({forms:summaries.length,routes:sum('routes'),actionDraws:sum('actionDraws'),birthIdleHandoffs:sum('birthIdleHandoffs'),heldDraws:sum('heldDraws'),layerFallbackDraws:sum('layerFallbackDraws'),packedNativeDraws:sum('packedNativeDraws'),packedFallbackFixtureDraws:sum('packedFallbackDraws'),referenceChecks:sum('referenceChecks'),portraitChecks:sum('portraitChecks')}));
});
