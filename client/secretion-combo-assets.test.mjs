import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SECRETION_COMBO_ACTION_ART as art, SECRETION_COMBO_IMAGE_ASSETS as images } from './secretion-combo-assets.mjs';
import { auditImages, imageDimensions } from './image-audit.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const sha = path => createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
test('all twelve secretion combinations are published', () => {
 assert.equal(Object.keys(art).length,12);
 assert.equal(images.length,92);
});
test('published secretion combinations expose exact source clips and portraits', () => {
 for(const [key,definition] of Object.entries(art)) {
  const manifest=JSON.parse(readFileSync(resolve(root,definition.sourceManifest)));
  const names=['idle','walk',...(definition.mask&1?['attack']:[]),'ranged','hurt','birth','death'];
  assert.deepEqual(Object.keys(definition.actions),names,key);
  assert.equal(definition.reference.image,definition.actions.idle.image);
  assert.deepEqual(imageDimensions(resolve(root,definition.portrait)),[definition.reference.frameSize,definition.reference.frameHeight]);
  for(const [action,clip] of Object.entries(definition.actions)) {
   const source=manifest.actions[action]??manifest.actions['ranged-attack'];
   assert.equal(sha(clip.image),source.sheetSHA256,`${key}/${action}`);
   const reviewHold=key.startsWith('bean/')&&action==='birth';
   if(reviewHold) { assert.equal(source.durationsMs.at(-1),650); assert.equal(source.durationsMs.reduce((a,b)=>a+b,0),4500); }
   assert.deepEqual(clip.durationsMs,reviewHold?source.durationsMs.slice(0,-1):source.durationsMs);
   assert.equal(clip.frameCount,clip.durationsMs.length);
   assert.equal(clip.durationMs,clip.durationsMs.reduce((a,b)=>a+b,0));
   assert.equal(clip.loop,action==='idle'||action==='walk');
   if(action==='ranged'&&source.launchAtMs!==undefined) assert.equal(clip.launchAtMs,source.launchAtMs);
   if(action==='attack') {
    assert.ok(clip.hitTimeMs>0&&clip.hitTimeMs<clip.durationMs);
    if(source.hitTimeMs!==undefined) assert.equal(clip.hitTimeMs,source.hitTimeMs);
    assert.ok(clip.durationsMs.some((_,i)=>clip.durationsMs.slice(0,i).reduce((a,b)=>a+b,0)===clip.hitTimeMs));
   }
   assert.equal(clip.sourceFacing,'right');
   assert.ok(clip.referenceLength>0&&clip.referenceLength===clip.viewSize);
   assert.deepEqual(imageDimensions(resolve(root,clip.image)),[clip.frameSize*clip.columns,clip.frameHeight*Math.ceil(clip.frameCount/clip.columns)]);
  }
 }
});
test('birth includes nest/travel and anchors the finished body; ranged uses exact release timing',()=>{
 for(const definition of Object.values(art)) {
  const birth=definition.actions.birth,ranged=definition.actions.ranged;
  assert.equal(birth.fullScene,true);
  assert.equal(birth.sceneIncludesNest,true);
  assert.equal(birth.worldTravelIncludedInPixels,true);
  assert.equal(birth.sceneAnchor,'final-body-floor');
  assert.ok(birth.referenceLength<definition.reference.referenceLength);
  assert.ok(birth.pivotX>birth.frameSize/2&&birth.pivotY>birth.frameHeight/2);
  assert.equal(ranged.rangedBody,true);
  assert.ok(ranged.launchAtMs>0&&ranged.launchAtMs<ranged.durationMs);
  let elapsed=0;const starts=ranged.durationsMs.map(ms=>{const start=elapsed;elapsed+=ms;return start;});
  assert.ok(starts.includes(ranged.launchAtMs),'release must match the start of its authored frame');
 }
});
test('published runtime images have exact native-size audit registration',()=>assert.equal(auditImages(root,images),images.length));
