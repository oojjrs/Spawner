import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {UNIT_ACTION_ART as A} from './unit-action-art-assets.mjs';
import {UNIT_BIRTH_ART as B} from './unit-birth-art-assets.mjs';
import {SPECIES_HELD_HURT_SOURCES as H} from './species-held-hurt-assets.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG as P} from './pebble-packed-birth-catalog.mjs';
import {UNIT_RANGED_FORMS as R} from './unit-ranged.mjs';
import {UNIT_SECRETION_IDLE_ANIMATIONS as I} from './secretion-idle.mjs';
const root=new URL('../',import.meta.url);
const {before,hashes}=JSON.parse(readFileSync(new URL('tools/pebble-secretion-facing-20261108/before.json',root)));
const left=clip=>({...clip,sourceFacing:'left'});
test('pebble secretion corrects labels only: every registered action, reference, effective birth, held source and packed catalog keeps exact geometry/clocks',()=>{
 assert.deepEqual(A['pebble/secretion'],{...before.action,reference:left(before.action.reference),actions:Object.fromEntries(Object.entries(before.action.actions).map(([a,c])=>[a,left(c)]))});
 assert.deepEqual(B['pebble/secretion'],left(before.birth));
 assert.deepEqual(H.pebble.secretion,left(before.held));
 assert.deepEqual(P.secretion,{...before.packed,animation:left(before.packed.animation)});
 for(const clip of [I.pebble,R.pebble.idle,R.pebble.animation,R.pebble.walk,R.pebble.hurt,...Object.values(R.pebble.lifecycle)])assert.equal(clip.sourceFacing,'left',clip.image);
});
test('pebble secretion label correction preserves all registered source, layer, portrait and packed image bytes',()=>{
 assert.ok(Object.keys(hashes).length>=10);
 for(const [path,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash,path+' unchanged original bytes');
});

test('native Canvas: nine production action routes and held-hit sides retain original left art and mirror for right targets',async()=>{
 const {execFileSync}=await import('node:child_process');
 const summaries=['idle','walk','ranged','hurt','birth','death','harvest','carry','throw'].map(action=>JSON.parse(execFileSync(process.execPath,['--expose-gc',new URL('tools/pebble-secretion-facing-20261108/native.mjs',root).pathname,'pebble/secretion',action],{encoding:'utf8',timeout:120000,maxBuffer:1024*1024})));
 const sum=key=>summaries.reduce((n,s)=>n+s[key],0);
 assert.equal(sum('routes'),9);assert.equal(sum('actionDraws'),54);assert.equal(sum('heldDraws'),56);assert.equal(sum('birthIdleHandoffs'),2);assert.equal(sum('layerFallbackDraws'),6);
});
test('native Canvas: actual welcome enter/perform/exit and stationary ranged match world rendering',async()=>{
 const {execFileSync}=await import('node:child_process');
 const result=JSON.parse(execFileSync(process.execPath,['--expose-gc',new URL('tools/pebble-secretion-facing-20261108/welcome-world.mjs',root).pathname],{encoding:'utf8',timeout:120000}));
 assert.equal(result.exactWelcomeWorldRasterMatches,4);assert.equal(result.draws,12);assert.equal(result.leftTargetNative,true);assert.equal(result.rightTargetMirrored,true);
});
