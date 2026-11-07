import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {UNIT_ACTION_ART} from './unit-action-art-assets.mjs';
import {auditImages} from './image-audit.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const base='AnimationCandidates/bean-combo-walk-approved-v2-20261107';
const json=p=>JSON.parse(fs.readFileSync(resolve(root,p),'utf8'));
const sha=p=>createHash('sha256').update(fs.readFileSync(resolve(root,p))).digest('hex');
const approval=json(base+'/approval.json');
test('ten approved bean walk replacements retain exact PNG bytes, clocks and native facing',()=>{
 assert.equal(approval.approvedForms.length,10);
 for(const {form,sha256} of approval.approvedForms){
  const clip=UNIT_ACTION_ART['bean/'+form].actions.walk,meta=json(base+'/'+form+'/manifest.json');
  assert.equal(sha(clip.image),sha256);assert.equal(sha(meta.sheet),sha256);
  assert.equal(sha(meta.originalSource),meta.originalSourceSHA256);
  assert.equal(clip.sourceFacing,'right');assert.equal(meta.previewTargetFacing,'left');
  assert.equal(clip.frameSize,512);assert.equal(clip.frameHeight,512);assert.equal(clip.columns,8);assert.equal(clip.frameCount,24);
  assert.deepEqual(clip.durationsMs,Array(24).fill(40));assert.equal(clip.durationMs,960);assert.equal(clip.loop,true);
  for(const k of ['pivotX','pivotY','referenceLength'])assert.equal(clip[k],meta[k]);
  assert.equal(meta.fullBody,true);assert.deepEqual(meta.redrawnCells,[2,4,17,19,21]);
  assert.equal(auditImages(root,[clip.image,meta.sheet,meta.preview]),3);
 }
 assert.deepEqual(approval.excludedForms,['blade-secretion-carapace']);
});
test('planning walk and carry cells select the approved replacement and new preview',()=>{
 const code=fs.readFileSync(resolve(root,'DesignAssets/sections/unit-appearance.js'),'utf8');
 const doc=code.split('\n').filter(l=>l.trimStart().startsWith('"')).map(l=>JSON.parse(l.trim().replace(/\+$/,'').trim())).join('');
 for(const {form} of approval.approvedForms){
  const row=doc.match(new RegExp('<tr id="unit-bean-'+form+'"[^>]*>([\\s\\S]*?)</tr>'))?.[1];assert.ok(row);
  const meta=json(base+'/'+form+'/manifest.json');
  for(const action of ['walk','carry']){
   const cell=row.match(new RegExp('<td data-action="'+action+'"[^>]*>([\\s\\S]*?)</td>'))?.[1];assert.ok(cell);
   assert.ok(cell.includes('href="'+meta.sheet+'"'));assert.ok(cell.includes('data-preview="'+meta.preview+'"'));
  }
 }
});
