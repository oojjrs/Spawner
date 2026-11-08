import {afterPebbleScreenReview} from './test-support/approved-art-source.mjs';
// Contract: reflect exactly the two user-selected complete families, without
// treating source-facing labels or a single pose as visual direction evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {UNIT_COMBINATION_FORMS} from './unit-combination-forms.mjs';
const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL('tools/confirmed-facing-20261108/'+name,root)));
const baseline=read('runtime-before.json').UNIT_ACTION_ART;
const plan=read('plan.json');
const changes=read('bean-spore-image-changes.json');
const selected=['bean/blade-carapace-antenna','bean/blade-secretion-carapace-antenna'];
const later=JSON.parse(readFileSync(new URL('tools/facing-combo-audit-20261108/bean-reflect-image-changes.json',root)));
const laterSelected=new Set(['bean/blade-carapace','bean/blade-secretion-carapace-antenna']);
const rewrite=value=>typeof value==='string'?(changes.pathMap[value]||value):Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value;
function reflected(before){
 const after=structuredClone(before),width=before.frameSize??before.frameWidth;
 after.sourceFacing='left';
 if(Number.isFinite(before.pivotX))after.pivotX=width-before.pivotX;
 if(Number.isFinite(before.scene?.outletX))after.scene.outletX=width-before.scene.outletX;
 if(after.sceneLayers)for(const layer of after.sceneLayers.layers)for(const sample of layer.samples)if(sample)sample.destination[0]=width-sample.destination[0]-sample.destination[2];
 return after;
}
function rewriteLater(value){
 return typeof value==='string'?(later.pathMap[value]||value):Array.isArray(value)?value.map(rewriteLater):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewriteLater(v)])):value;
}
function laterFamily(key,family){
 if(!laterSelected.has(key))return family;
 return rewriteLater({...family,reference:reflected(family.reference),actions:Object.fromEntries(Object.entries(family.actions).map(([action,clip])=>[action,reflected(clip)]))});
}
function currentHash(path,sha){
 const next=later.changes[path];
 if(!next||next.beforeSha256!==sha)return {path,sha};
 assert.equal(later.status,'completed');
 assert.equal(next.verification.exactRgbaMirror,true);assert.equal(next.verification.alphaExact,true);
 return {path:next.newImage,sha:next.afterSha256};
}
function compare(actual,expected,path){
 if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<1e-8,path+' exact registered number');return;}
 if(!expected||typeof expected!=='object'){assert.equal(actual,expected,path);return;}
 assert.ok(actual&&typeof actual==='object',path);
 assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),path+' exact fields');
 for(const key of Object.keys(expected))compare(actual[key],expected[key],path+'/'+key);
}
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
test('the original two selected families preserve 15 clips through chronological approved reflections',()=>{
 assert.deepEqual(plan.candidateForms,selected);
 let clips=0;
 for(const key of selected){
  const old=baseline[key];
  const expected=rewrite({...old,reference:reflected(old.reference),actions:Object.fromEntries(Object.entries(old.actions).map(([action,clip])=>[action,reflected(clip)]))});
  compare(UNIT_ACTION_ART[key],laterFamily(key,expected),key);
  clips+=1+Object.keys(old.actions).length;
 }
 assert.equal(clips,15);
});
test('all 52 historical outputs and three protected originals retain hashes through exact later corrections',()=>{
 assert.equal(changes.status,'completed');
 assert.equal(Object.keys(changes.changes).length,52);
 let protectedOriginals=0;
 for(const [path,change]of Object.entries(changes.changes)){
  const output=currentHash(change.newImage,change.afterSha256);
  assert.equal(hash(output.path),output.sha,path+' chronological reflected output');
  if(change.newImage!==path){const next=later.changes[path];const expected=next?.newImage===path&&next.beforeSha256===change.beforeSha256?next.afterSha256:change.beforeSha256;assert.equal(hash(path),expected,path+' protected original or explicit later in-place correction');protectedOriginals++;}
 }
 assert.equal(protectedOriginals,3);
});
test('the other 42 combination registrations preserve baseline plus only the later selected correction',()=>{
 assert.equal(UNIT_COMBINATION_FORMS.length,11);
 let untouched=0;
 for(const tribe of ['bean','spore','pebble','spring'])for(const form of UNIT_COMBINATION_FORMS){
  const key=tribe+'/'+form.key;if(selected.includes(key))continue;
  assert.ok(baseline[key],key+' baseline exists');
  compare(UNIT_ACTION_ART[key],afterPebbleScreenReview(key,laterFamily(key,baseline[key])),key+' complete chronological registration');
  untouched++;
 }
 assert.equal(untouched,42);
});
