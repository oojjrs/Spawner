import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { createDetailCombatDeath, detailDeathForm, DETAIL_DEATH_CREATURES, detailCreatureDeathShadow } from './combat-detail-death.mjs';
import { createCombatVfxCursor } from './combat-vfx-events.mjs';
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from './combat-detail-vfx.mjs';
import { CREATURE_IDLE_ANIMATIONS, CREATURE_DEATH_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, unitAnimationFrame, creatureHurtPose, creatureAttackPose, creatureWalkPose } from './unit-animation.mjs';
import { imageFrameGeometry } from './image-geometry.mjs';
import { imageDimensions } from './image-audit.mjs';
import { UNIT_DISPLAY_SIZES, combatViewLayout, unitDisplaySize, unitFrameMirror } from './unit-size.mjs';

// Cached alpha>=16 first-cell bounds are pinned to the audited original images.
// They are test inputs for native size preparation, not replacement registration.
const cases = [
  { species: 'cotton-sheep', frames: 8, duration: 1760, finalAt: 760, viewSize: 256,
    idleBounds: {x:29,y:50,width:192,height:175}, deathBounds: {x:27,y:49,width:193,height:175},
    runtimeHash: 'd7b2455df814b0709930db882dbf42011e1e75a4a58ce3ec3fe5275a1a132c93', sourceHash: '198c4d38e2a96dfc77b53a0be59bd054ac14d7b9b54add429e4b018efd668466' },
  { species: 'lantern-keeper', frames: 41, duration: 2070, finalAt: 1300, viewSize: 248.71174377224202,
    idleBounds: {x:40,y:81,width:281,height:256}, deathBounds: {x:31,y:52,width:182,height:172},
    runtimeHash: '75de77efea52a26e3de6a10bc5d55e28108e5e26c037b04c6fd708da7307b4ba', sourceHash: 'dbc2112237e9d5d64071dbca3bc5c64cfe0320e694bb4af04531f8a6508889ae' },
  { species: 'spiny-back-leader', frames: 3, duration: 720, finalAt: 200, viewSize: 256,
    idleBounds: {x:10,y:33,width:220,height:191}, deathBounds: {x:11,y:49,width:203,height:176},
    runtimeHash: '2c15d5441d1f1ac514d9593c5a29be49ca165e696b0471c4c87e7cf4889f4255', sourceHash: 'f86aff28f6b8e9015e00227aff83e7b671bb45cf939bc0008a56989ac9518e77' }
];
const source = unitPresentationTestSource(readFileSync(new URL('./game.js', import.meta.url), 'utf8'));
const extract = name => { const value=source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))?.[0];assert.ok(value,name);return value; };
const baseTest = readFileSync(new URL('./combat-detail-creature-death.test.mjs',import.meta.url),'utf8');
const fixture = baseTest.slice(baseTest.indexOf('const source ='),baseTest.indexOf('// The approved list'));
const fixtureRead = (path, encoding) => {
  const value = readFileSync(path, encoding);
  return typeof value === "string" && String(path).replaceAll("\\", "/").endsWith("/client/game.js") ? unitPresentationTestSource(value) : value;
};
const box = { combatViewLayout, unitDisplaySize, unitFrameMirror, drawUnitAttackRing, creatureWalkPose, assert,readFileSync:fixtureRead,createContext,runInContext,structuredClone,URL,createDetailCombatDeath,detailDeathForm,DETAIL_DEATH_CREATURES,detailCreatureDeathShadow,
  createCombatVfxCursor,createDetailCombatVfx,DETAIL_COMBAT_VFX_ASSETS,drawDetailVfxCell,drawDetailVitalEffect,CREATURE_IDLE_ANIMATIONS,CREATURE_DEATH_ANIMATIONS,
  CREATURE_ATTACK_ANIMATIONS,unitAnimationFrame,creatureHurtPose,creatureAttackPose,imageFrameGeometry,imageDimensions };
createContext(box);runInContext(fixture.replaceAll('import.meta.url',JSON.stringify(new URL('./combat-detail-creature-death.test.mjs',import.meta.url).href)),box);
function prepare(row) {
  const species=row.species, idle=CREATURE_IDLE_ANIMATIONS[species], animation=CREATURE_DEATH_ANIMATIONS[species];
  const idleScale=idle.frameSize/512*480/Math.max(row.idleBounds.width,row.idleBounds.height);
  const scope={Spawner:{UNIT_DISPLAY_SIZES},tribeArt:{bounds:sprite=>sprite.bounds},unitDisplayScales:new Map(),unitDisplayBounds:new Map(),unitGroundShapes:new Map()};
  createContext(scope);runInContext(extract('prepareUnitDisplaySize')+'\n'+extract('prepareCreatureDeathSize'),scope);
  scope.prepareUnitDisplaySize(species,{bounds:row.idleBounds},idle,1.4*idleScale*(idle.registrationScale||1));
  const entry={animation,sprite:{bounds:row.deathBounds}};scope.prepareCreatureDeathSize(species,entry);
  return {entry,idleScale,outer:scope.unitDisplayScales.get(species)};
}

test('the three approved death atlases retain native timing, source bytes, registration and offline wrappers',()=>{
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  for(const row of cases){
    assert.equal(detailDeathForm({species:row.species}),'creature/'+row.species);
    const a=CREATURE_DEATH_ANIMATIONS[row.species],dir=a.image.slice(0,a.image.lastIndexOf('/'));
    assert.equal(hash(readFileSync(a.image)),row.runtimeHash);assert.equal(hash(readFileSync(dir+'/death.webp')),row.sourceHash);
    const wrapper=readFileSync('client/local-assets/'+a.image.slice('DesignAssets/'.length)+'.js','utf8');
    assert.equal(hash(Buffer.from(wrapper.match(/data:image\/webp;base64,([^"]+)/)[1],'base64')),row.runtimeHash);
    assert.equal(a.frameCount,row.frames);assert.equal(a.durationMs,row.duration);assert.equal(a.loop,false);
    assert.equal(a.frameSize,256);assert.equal(a.viewSize,row.viewSize);assert.equal(a.registrationScale,1);
    assert.equal(a.durationMs-a.durationsMs.at(-1),row.finalAt);assert.equal(unitAnimationFrame(a,2999),a.frameCount-1);
    assert.equal(unitAnimationFrame(a,row.finalAt-1),a.frameCount-2);assert.equal(unitAnimationFrame(a,row.finalAt),a.frameCount-1);
    if(row.species==='spiny-back-leader')assert.deepEqual(a.durationsMs,[80,120,520]);
  }
});

test('actual one-time prepared scales and all 52 native body/shadow frames stay intact in both directions and sizes',()=>{
  let draws=0;
  for(const row of cases)for(const side of [0,1])for(const growth of [1,1.35]){
    const prepared=prepare(row),scale=prepared.outer*growth,view=box.modal(row.species,side,scale),a=prepared.entry.animation;
    view.entry.scale=prepared.entry.scale;view.idleEntry.scale=prepared.idleScale;view.draw(.9);view.kill();
    const saved=JSON.stringify(view.sandbox.state.corpses[0]);let elapsed=0;
    for(let frame=0;frame<a.frameCount;frame++){
      const age=(elapsed+1)/1000,calls=view.draw(1+age),body=calls.find(c=>c.image===a.image),shadow=calls.find(c=>c.image==='existing-ground-shadow');
      assert.ok(body,row.species+'/'+frame);assert.ok(shadow);assert.ok(calls.indexOf(shadow)<calls.indexOf(body));
      assert.deepEqual(body.args.slice(0,4),[frame%a.columns*a.frameSize,Math.floor(frame/a.columns)*a.frameSize,a.frameSize,a.frameSize]);
      const g=imageFrameGeometry(a,frame),size=body.args[6];
      assert.equal(size,body.args[7]);assert.ok(Math.abs(body.args[4]+size*g.pivotX/a.frameSize)<1e-8);assert.ok(Math.abs(body.args[5]+size*g.pivotY/a.frameSize)<1e-8);
      assert.equal(body.matrix.sx,side?scale:-scale);assert.equal(body.matrix.sy,scale);
      const cell=size/(1.4*prepared.entry.scale*a.frameSize/a.viewSize);
      const expected=detailCreatureDeathShadow({corpse:view.sandbox.state.corpses[0],age,scale,cell},view.entry);
      assert.ok(Math.abs(shadow.args[2]-expected.radiusX*2)<1e-8);assert.ok(Math.abs(shadow.args[3]-expected.radiusY*2)<1e-8);
      assert.equal(view.entry.scale,prepared.entry.scale);assert.equal(JSON.stringify(view.sandbox.state.corpses[0]),saved);
      elapsed+=a.durationsMs[frame];draws++;
    }
    assert.equal(view.draw(4).filter(c=>c.image===a.image).length,0);
  }
  assert.equal(draws,208);
});

test('late authoritative deaths, absence, duplicate corpses and species mismatches retain the existing lifecycle guards',()=>{
  for(const row of cases){
    const tracker=createDetailCombatDeath(),view={scope:'fight',roomId:'room',streamId:'stream',width:1000,height:500,snapshotTime:.95};
    const unit={id:'target',species:row.species,health:1,x:100,y:100,combat:{id:'fight'}};
    const point={x:700,y:350,width:90,height:130},camera={width:1000,height:500,cell:120};
    tracker.begin(1.1,{...view,visibleIds:['target'],livingAgents:[unit]});tracker.observe(unit,point,{scale:.8,facing:-1});
    tracker.begin(1.12,{...view,snapshotTime:1.05,visibleIds:[],livingAgents:[]});
    const corpse={kind:'corpse',id:'corpse:target',agentId:'target',species:row.species,x:100,y:100,diedAt:1,decaysAt:4};
    assert.equal(tracker.commands([],1.12,camera).length,0);
    assert.equal(tracker.commands([corpse,corpse],1.12,camera).length,1);
    assert.equal(tracker.commands([{...corpse,species:'bubble-toad'}],1.2,camera).length,0);
    assert.equal(tracker.commands([{...corpse,x:101}],1.2,camera).length,0);
    assert.equal(tracker.commands([corpse],3.999,camera).length,1);assert.equal(tracker.commands([corpse],4,camera).length,0);
    tracker.clear();assert.equal(tracker.commands([corpse],1.2,camera).length,0);
  }
});
