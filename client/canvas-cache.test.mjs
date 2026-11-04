import test from'node:test';import assert from'node:assert/strict';import{createCanvasCacheBudget}from'./canvas-cache.mjs';
test('legacy high-resolution caches share a pixel budget rather than retaining 192 giant canvases',()=>{
 const budget=createCanvasCacheBudget(8*1024*1024),frames=budget.createCache(),poses=budget.createCache(v=>v.surface.width*v.surface.height*2),bases=budget.createCache();
 for(let frame=0;frame<192;frame++){poses.set(frame,{surface:{width:632,height:632}});bases.set(frame,{width:632,height:632});frames.set(frame,{width:1264,height:1264});assert.ok(budget.stats().pixels<=8*1024*1024)}
 assert.ok(budget.stats().peakPixels<=8*1024*1024);assert.ok(frames.size<10);assert.ok(budget.stats().evictions>0);
});
test('LRU access, shared eviction, deletion and oversize transient results preserve accounting',()=>{
 const budget=createCanvasCacheBudget(100),a=budget.createCache(),b=budget.createCache();a.set('one',{width:5,height:10});b.set('two',{width:5,height:10});a.get('one');b.set('three',{width:5,height:10});assert.equal(b.has('two'),false);assert.equal(a.has('one'),true);a.set('huge',{width:101,height:2});assert.equal(a.has('huge'),false);a.delete('one');assert.equal(budget.stats().pixels,50);b.clear();assert.equal(budget.stats().pixels,0)
});
