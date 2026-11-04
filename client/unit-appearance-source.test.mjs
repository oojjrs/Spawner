import test from 'node:test';import assert from 'node:assert/strict';
import {createUnitAppearanceSource}from'./unit-appearance-source.mjs';
import {createUnitAppearanceCache}from'./unit-appearance.mjs';
const file=(bytes=12)=>({script:'sprite.js',bytes,hash:'hash',mime:'image/webp'});
function fixture(overrides={}){const scope={},files={a:file(),b:file(),c:file()},revoked=[],loads=[];const source=createUnitAppearanceSource({scope,files,protocol:'file:',byteBudget:260,loadScript:async path=>{loads.push(path);scope.SpawnerUnitAppearanceData['a']='data:image/webp;base64,'+'A'.repeat(16)},decode:async()=>new Blob([new Uint8Array(12)],{type:'image/webp'}),verify:async()=>{},createObjectURL:()=>`blob:${loads.length}`,revokeObjectURL:url=>revoked.push(url),...overrides});return{source,scope,loads,revoked}}

test('file namespace is initialized, same-source requests share a load, and the data URI is discarded',async()=>{
 let scope={},loads=0;const {source}=fixture({scope,loadScript:async()=>{loads++;assert.ok(scope.SpawnerUnitAppearanceData);scope.SpawnerUnitAppearanceData.a='data:image/webp;base64,'+'A'.repeat(16)}});
 const [a,b]=await Promise.all([source.acquire('a'),source.acquire('a')]);assert.equal(loads,1);assert.equal(source.stats().leases,2);assert.equal(Object.keys(scope.SpawnerUnitAppearanceData).length,0);assert.equal(a.blob.size,12);a.release();a.release();b.release();assert.equal(source.stats().leases,0);source.clear();assert.equal(source.stats().residentBytes,0);
});
test('pinned leases are protected, idle LRU entries evict, object URLs revoke, and reservations stay within budget',async()=>{
 const scope={},revoked=[];let current='a';const source=createUnitAppearanceSource({scope,files:{a:file(60),b:file(60),c:file(60)},protocol:'file:',byteBudget:288,loadScript:async()=>{scope.SpawnerUnitAppearanceData[current]='data:image/webp;base64,'+'A'.repeat(80)},decode:async()=>new Blob([new Uint8Array(60)],{type:'image/webp'}),verify:async()=>{},createObjectURL:()=>`blob:${current}`,revokeObjectURL:u=>revoked.push(u)});
 const a=await source.acquire('a');assert.equal(a.url,'blob:a');current='b';await assert.rejects(source.acquire('b'),/BUDGET/);a.release();const b=await source.acquire('b');assert.deepEqual(revoked,['blob:a']);b.release();assert.ok(source.stats().peakBytes<=288);source.clear();assert.equal(source.stats().residentBytes,0);
});
test('failed load cleans up and retries; clear during an active lease waits for release',async()=>{
 let scope={},count=0;const {source,revoked}=fixture({scope,loadScript:async()=>{scope.SpawnerUnitAppearanceData.a='data:image/webp;base64,'+'A'.repeat(16);if(!count++)throw new Error('load failed')}});
 await assert.rejects(source.acquire('a'),/load failed/);assert.equal(source.stats().leases,0);assert.equal(source.stats().reservedBytes,0);assert.equal(Object.keys(scope.SpawnerUnitAppearanceData).length,0);
 const a=await source.acquire('a');a.url;source.clear();assert.equal(revoked.length,0);a.release();assert.equal(revoked.length,1);assert.equal(source.stats().residentBytes,0);
});
test('HTTP requests use direct URLs, check manifest bytes, and never run file wrappers',async()=>{
 let loads=0;const {source}=fixture({protocol:'https:',loadScript:()=>{throw new Error('eager script')},sourceUrl:p=>'/static/'+p,fetch:async url=>{assert.equal(url,'/static/a');loads++;return {ok:true,blob:async()=>new Blob([new Uint8Array(12)],{type:'image/webp'})}}});const a=await source.acquire('a');a.release();assert.equal(loads,1);await assert.rejects(source.acquire('unknown'),/UNKNOWN/);
});
test('bitmap cache releases source lease on successful decode and on failed decode',async()=>{
 const animation={image:'a',frameSize:16,columns:2,frameCount:2};let released=0,closed=0;
 for(const fail of [false,true]){
  const cache=createUnitAppearanceCache(async()=>({blob:new Blob([1],{type:'image/webp'}),release(){released++}}),async(_,options)=>{if(fail)throw new Error('decode');return{width:options.resizeWidth,height:options.resizeHeight,close(){closed++}}},1024);
  if(fail)await assert.rejects(cache.withImage(animation,1,()=>{}),/decode/);else assert.ok(await cache.withImage(animation,1,()=>{}));assert.equal(released,fail?2:1);cache.clear();
 }
 assert.equal(closed,1);
});
