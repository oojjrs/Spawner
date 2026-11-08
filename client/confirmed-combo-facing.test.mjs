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
const rewrite=value=>typeof value==='string'?(changes.pathMap[value]||value):Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value;
function reflected(before){
 const after=structuredClone(before),width=before.frameSize??before.frameWidth;
 after.sourceFacing='left';
 if(Number.isFinite(before.pivotX))after.pivotX=width-before.pivotX;
 if(Number.isFinite(before.scene?.outletX))after.scene.outletX=width-before.scene.outletX;
 if(after.sceneLayers)for(const layer of after.sceneLayers.layers)for(const sample of layer.samples)if(sample)sample.destination[0]=width-sample.destination[0]-sample.destination[2];
 return rewrite(after);
}
function compare(actual,expected,path){
 if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<1e-8,path+' exact registered number');return;}
 if(!expected||typeof expected!=='object'){assert.equal(actual,expected,path);return;}
 assert.ok(actual&&typeof actual==='object',path);
 assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),path+' exact fields');
 for(const key of Object.keys(expected))compare(actual[key],expected[key],path+'/'+key);
}
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex');
test('the two user-selected combo families preserve 15 clips except exact approved source-space reflection',()=>{
 assert.deepEqual(plan.candidateForms,selected);
 let clips=0;
 for(const key of selected){
  const old=baseline[key];
  const expected=rewrite({...old,reference:reflected(old.reference),actions:Object.fromEntries(Object.entries(old.actions).map(([action,clip])=>[action,reflected(clip)]))});
  compare(UNIT_ACTION_ART[key],expected,key);
  clips+=1+Object.keys(old.actions).length;
 }
 assert.equal(clips,15);
});
test('all 52 selected source/alias outputs retain verified reflected hashes and all three shared originals remain unchanged',()=>{
 assert.equal(changes.status,'completed');
 assert.equal(Object.keys(changes.changes).length,52);
 let protectedOriginals=0;
 for(const [path,change]of Object.entries(changes.changes)){
  assert.equal(hash(change.newImage),change.afterSha256,path+' verified reflected output');
  if(change.newImage!==path){assert.equal(hash(path),change.beforeSha256,path+' protected shared original');protectedOriginals++;}
 }
 assert.equal(protectedOriginals,3);
});
test('the other 42 combination registrations stay exactly equal to the pre-correction baseline',()=>{
 assert.equal(UNIT_COMBINATION_FORMS.length,11);
 let untouched=0;
 for(const tribe of ['bean','spore','pebble','spring'])for(const form of UNIT_COMBINATION_FORMS){
  const key=tribe+'/'+form.key;if(selected.includes(key))continue;
  assert.ok(baseline[key],key+' baseline exists');
  assert.deepEqual(UNIT_ACTION_ART[key],baseline[key],key+' unchanged complete registration');
  untouched++;
 }
 assert.equal(untouched,42);
});
