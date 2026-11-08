import {afterPebbleScreenReview} from './test-support/approved-art-source.mjs';
// User reviewed the simple-reflection column, using the viewer's screen direction.
// Keep this correction separate from earlier audits, including earlier reflections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART} from './unit-birth-art-assets.mjs';
import {unitFrameMirror} from './unit-size.mjs';
const root=new URL('../',import.meta.url);
const load=name=>JSON.parse(readFileSync(new URL('tools/facing-combo-audit-20261108/'+name,root)));
const baseline=load('reaudit-current-catalog.json').forms;
const plan=load('bean-reflect-plan.json');
const changes=load('bean-reflect-image-changes.json');
const previews=load('bean-reflect-preview-changes.json');
const selected=['bean/blade-carapace','bean/blade-secretion-carapace-antenna'];
const current=key=>({...UNIT_ACTION_ART[key],actions:{...UNIT_ACTION_ART[key].actions,...(UNIT_BIRTH_ART[key]?{birth:UNIT_BIRTH_ART[key]}:{})}});
const rewrite=value=>typeof value==='string'?(changes.pathMap[value]||value):Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value;
function reflected(before){
 const after=structuredClone(before),width=before.frameSize??before.frameWidth;
 after.sourceFacing='left';
 if(Number.isFinite(before.pivotX))after.pivotX=width-before.pivotX;
 if(Number.isFinite(before.outletX))after.outletX=width-before.outletX;
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
test('screen-direction review changes only the two selected complete bean families, preserving clocks and frame order',()=>{
 assert.deepEqual(plan.candidateForms,selected);
 let clips=0;
 for(const key of selected){
  const old=baseline[key];
  const expected={...rewrite(old),reference:reflected(old.reference),actions:Object.fromEntries(Object.entries(old.actions).map(([action,clip])=>[action,reflected(clip)]))};
  compare(current(key),expected,key);
  clips+=1+Object.keys(old.actions).length;
 }
 assert.equal(clips,15);
});
test('all 53 source and 28 preview outputs match independently verified reflection hashes and retain protected shared originals',()=>{
 assert.equal(changes.status,'completed');assert.equal(previews.status,'completed');
 assert.equal(Object.keys(changes.changes).length,53);assert.equal(Object.keys(previews.changes).length,28);
 let protectedOriginals=0;
 for(const [path,change]of Object.entries(changes.changes)){
  assert.ok(change.selectedUsers.every(key=>selected.includes(key)),path+' selected owners only');
  assert.equal(change.verification.exactRgbaMirror,true);assert.equal(change.verification.alphaExact,true);assert.equal(change.verification.dimensionsUnchanged,true);
  assert.equal(hash(change.newImage),change.afterSha256,path+' reflected source output');
  if(change.newImage!==path){assert.equal(hash(path),change.beforeSha256,path+' protected shared original');protectedOriginals++;}
 }
 assert.ok(protectedOriginals>0);
 for(const[path,change]of Object.entries(previews.changes)){
  assert.equal(hash(path),change.afterSha256,path+' reflected temporal preview');
  for(const key of ['exactVisibleRgbaMirror','alphaExact','frameCountUnchanged','durationsUnchanged','loopUnchanged','dimensionsUnchanged'])assert.equal(change.verification[key],true,path+' '+key);
 }
});
test('the other 42 combinations retain their complete pre-review registrations',()=>{
 let untouched=0;
 for(const[key,before]of Object.entries(baseline)){
  if(selected.includes(key))continue;
  compare(current(key),afterPebbleScreenReview(key,before),key+' preserved plus exact later review');untouched++;
 }
 assert.equal(untouched,42);
});
test('native screen-left sources still use the existing target-facing conversion for either opponent side',()=>{
 for(const key of selected)for(const[action,clip]of Object.entries(current(key).actions)){
  assert.equal(clip.sourceFacing,'left',key+'/'+action);
  assert.equal(unitFrameMirror(clip.sourceFacing,-1),false,key+'/'+action+' left target uses native source');
  assert.equal(unitFrameMirror(clip.sourceFacing,1),true,key+'/'+action+' right target uses existing reflection');
 }
});
