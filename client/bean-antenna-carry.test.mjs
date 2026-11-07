import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createUnitActionArt, unitActionArtDefinition, unitActionArtPose } from './unit-action-art.mjs';
const unit={tribe:'bean',attributes:{antenna:1},health:10,mode:'carry',carrying:3,moveStartedAt:0,moveDuration:2};
test('antenna carrier uses every native walking pose and preserves cargo and movement clock',()=>{
 const definition=unitActionArtDefinition(unit);assert.deepEqual(definition.actions.carry,definition.actions.walk);
 const before=structuredClone(unit),frames=new Set();
 for(let time=0;time<1;time+=.02){
  const loaded=unitActionArtPose(unit,time),empty=unitActionArtPose({...unit,carrying:0},time);
  assert.equal(loaded.action,'carry');assert.equal(loaded.animation.image,empty.animation.image);assert.equal(loaded.frame,empty.frame);frames.add(loaded.frame);
 }
 assert.equal(frames.size,25);assert.deepEqual(unit,before);
 assert.equal(unitActionArtPose({...unit,moveStartedAt:undefined,moveDuration:undefined},3).action,'idle');
 assert.equal(unitActionArtPose(unit,.1).frame,unitActionArtPose(unit,1.1).frame);
});
test('loaded and empty antenna walking have identical registration and both authored facings',async()=>{
 const surface=(width,height)=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(width*height*4).fill(255)})})});
 const art=createUnitActionArt(x=>x,surface,async image=>({image}));await art.prepare(unit,.4);
 for(const time of [.1,.4,.8,1.5])for(const mirror of [false,true]){
  const record=actor=>{const draws=[],transforms=[];const ctx={save(){},restore(){},translate(...a){transforms.push(a)},scale(...a){transforms.push(a)},drawImage(...a){draws.push(a)}};art.draw(ctx,actor,time,240,420,100,mirror);return{draws,transforms}};
  const loaded=record(unit),empty=record({...unit,carrying:0});assert.deepEqual(loaded,empty);assert.equal(loaded.draws.length,1);
 }
});
test('compiled runtime and design carrier reference the same approved walk',()=>{
 const scope={console,setTimeout,clearTimeout,URL,performance};runInNewContext(readFileSync(new URL('./runtime.js',import.meta.url),'utf8'),scope);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.Spawner.unitActionArtDefinition(unit).actions.carry)),unitActionArtDefinition(unit).actions.walk);
 let html='';runInNewContext(readFileSync(new URL('../DesignAssets/sections/unit-appearance.js',import.meta.url),'utf8'),{document:{write:s=>html+=s}});
 const antenna=html.match(/<tbody[^>]*data-appearance-gene="antenna"[^>]*>[\s\S]*?<\/tbody>/)[0];const row=[...antenna.matchAll(/<tr.*?<\/tr>/g)].map(x=>x[0]).find(row=>row.includes('새싹콩'));
 const carry=row.match(/<td data-action="carry"[\s\S]*?<\/td>/)[0];assert.ok(carry.includes('data-work-source="walk"'));assert.ok(carry.includes('bean-antenna-walk-approved-preview.gif'));assert.ok(!carry.includes('data-work-source="base"'));
});
