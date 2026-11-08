import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA as D } from "./dna.mjs";
import { dnaUnitStats, validateDna } from "./dna-unit.mjs";
import { combatProfile, unitCombatStats } from "./combat-stats.mjs";
import { createCombat } from "./combat.mjs";
import { combatPositionRadius } from "./combat-position.mjs";
import { attackAnimationElapsed, attackAnimationSegments } from "./attack.mjs";
import { unitActionState, createUnitAppearanceEventPlayback } from "../client/unit-appearance-state.mjs";
import { createGame } from "./game.mjs";

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,actual+" != "+expected);
const pieces=ids=>ids.map(gene=>({gene,grade:D.lookup.get(gene).grade,rotation:0,q:0,r:0}));

test("approved high-grade increments and combo timing retain their total caps",()=>{
  const stats=ids=>D.stats(pieces(["blade",...ids]),"bean");
  for(const [count,value] of [[0,50],[1,65],[2,80],[3,90],[4,90]])close(stats(Array(count).fill("blockPower")).blockPower,value);
  for(const [count,value] of [[0,0],[1,16],[2,32],[3,40],[4,40]])close(stats(Array(count).fill("reduction")).reduction,value);
  for(const [count,value] of [[0,.18],[1,.10],[2,.06],[3,.06]])close(stats(Array(count).fill("comboSpeed")).comboSpeed,value);
  close(stats(["power"]).meleePower,10);
  close(stats(["health"]).health,30);
  close(stats(["combo"]).hits,2);
  close(stats(["combo"]).comboPower,50);
});

function fixture(tribe,mode){
  const ids=[mode==="ranged"?"secretion":"blade",...Array(3).fill(mode==="ranged"?"rangedSpeed":"speed"),"combo","combo","comboSpeed","health"];
  const layout=D.pack(pieces(ids),4),dna={version:6,level:4,budget:D.price(layout),pieces:layout};
  assert.ok(validateDna(dna,4,dna.budget));
  const source={id:"a",ownerId:"a",tribe,dna,stats:dnaUnitStats(dna,tribe),health:1000,x:100,y:100,attributes:{},moveDuration:0};
  source.stats.health=1000;
  const target={...source,id:"b",ownerId:"b",stats:{...source.stats,dna:{...source.stats.dna,meleeSpeed:0,rangedSpeed:0}},health:1000};
  const events=[],environment={simSeconds:0,world:{size:320,terrain:new Uint8Array(320*320).fill(4)},games:new Map(),colonies:[],combatRandom:()=>.99,damageRandom:()=>.5,onCombatEvent(event){events.push(event);}};
  for(const unit of [source,target])environment.games.set(unit.ownerId,{agents:[unit],receiveDamage(agent,amount){agent.health=Math.max(0,agent.health-amount);}});
  const combat=createCombat(environment);
  assert.ok(combat.engage(source,target,0));
  const separation=combatPositionRadius(source)+combatPositionRadius(target)+(mode==="ranged"?2.3:.1);
  for(const [index,unit] of [source,target].entries())Object.assign(unit.combat.position,{x:index?separation:0,y:0,fromX:index?separation:0,fromY:0});
  const tick=time=>{environment.simSeconds=time;combat.update(source,time);combat.update(target,time);};
  return {source,target,events,tick};
}

for(const [tribe,meleeRate,rangedRate] of [["bean",1.6,1.6],["spore",1.54,1.69],["pebble",1.54,1.54],["spring",1.69,1.54]])for(const mode of ["melee","ranged"])
  test(tribe+" "+mode+" haste compresses preparation and recovery while retaining every combo cue",()=>{
    const rate=mode==="ranged"?rangedRate:meleeRate,f=fixture(tribe,mode);
    f.tick(0);const attack=f.source.attack;
    close(attack.timingRate,rate);close(attack.hitAt,.3/rate);close(attack.recovery,.7/rate);
    const clip={sourceId:"haste",durationsMs:[300,700],hitTimeMs:300,launchAtMs:300,events:[{type:mode==="ranged"?"launch":"contact",atMs:300}]};
    const animations={attack:clip,ranged:clip},playback=createUnitAppearanceEventPlayback(),cues=[];
    playback.update(unitActionState(f.source,0,{animations}),clip,0);
    const contacts=[.3/rate,.3/rate+.1,.3/rate+.2];
    for(const contact of contacts){
      f.tick(contact);
      const state=unitActionState(f.source,contact,{animations});
      close(state.elapsedMs,300);
      cues.push(...playback.update(state,clip,contact));
      assert.equal(playback.update(state,clip,contact).length,0);
    }
    assert.equal(cues.length,3);cues.forEach((cue,index)=>close(cue.at,contacts[index]));
    close(attack.endsAt,contacts[2]+.7/rate);
    const clock=mode==="ranged"?{...attack,hitAt:attack.launchedAt,meleeContacts:attack.shotLaunches}:attack;
    const middle=contacts[2]+.35/rate;
    close(attackAnimationElapsed(clock,middle,.3,1),.65);
    const segments=attackAnimationSegments(clock,middle,.3,1);
    close(segments.at(-1)[0],attack.endsAt);close(segments.at(-1)[1],1);
    const ready=f.source.attackReady;close(ready,attack.endsAt+combatProfile(f.source).attackInterval);
    f.tick(attack.endsAt);assert.equal(f.source.attack,null);
    f.tick(ready-.0001);assert.equal(f.source.attack,null);
    f.tick(ready);close(f.source.attack.startedAt,ready);
    const shots=f.events.filter(event=>event.kind==="shoot"&&event.sourceId==="a");
    if(mode==="ranged"){
      assert.equal(shots.length,3);
      for(const shot of shots)close(shot.arrivesAt-shot.at,Math.max(.1,Math.hypot(shot.arenaTo.x-shot.arenaFrom.x,shot.arenaTo.y-shot.arenaFrom.y)/6));
    }
  });

test("neutral innate attack rates and old recorded attacks keep their native timing",()=>{
  const native={species:"vine-turtle",stats:unitCombatStats("vine-turtle"),attributes:{}};
  const profile=combatProfile(native);
  close(profile.timingRate,1);close(profile.windup,native.stats.combat.focus);
  const old={startedAt:0,hitAt:.3,endsAt:1,recovery:.7,meleeContacts:[.3]};
  close(attackAnimationElapsed(old,.6,.3,1),.6);
  close(attackAnimationSegments(old,.6,.3,1).at(-1)[0],1);
});

test("DNA haste also reaches structure attacks without moving combo contacts or the cooldown",()=>{
  const colonies=[{id:1,ownerId:'a',tribe:'bean',x:40,y:40,occupiedCells:new Set(['2,2'])},{id:2,ownerId:'b',tribe:'bean',x:50,y:40,occupiedCells:new Set(['2,2'])}];
  const room={simSeconds:0,damageRandom:()=>.5,world:{seed:13,sites:[[42,42]],terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320),burrows:[]},colonies,games:new Map(),food:new Map(),foodSpots:new Map()};
  const [game,enemy]=colonies.map(colony=>{const value=createGame(room,colony);room.games.set(colony.ownerId,value);return value;});
  game.agents.splice(1);enemy.agents.splice(0);
  const layout=D.pack(pieces(['blade','speed','speed','speed','combo','comboSpeed']),4),dna={version:6,level:4,budget:D.price(layout),pieces:layout};
  const agent=game.agents[0],target=enemy.nest;
  Object.assign(agent,{dna,stats:dnaUnitStats(dna,'bean'),health:10,combatDisposition:'aggressive',x:49,y:42,renderFromX:49,renderFromY:42,moveStartedAt:0,moveDuration:0,mode:'fight',moveBudget:0,nextDecisionAt:100,decisionPending:null,knownEnemyIds:new Set([target.id]),utility:{action:'fight',target:{id:target.id,kind:'nest',x:target.x,y:target.y,key:target.id},route:[]}});
  room.simSeconds=10;game.prepare(10);enemy.prepare(10);game.tick(.01);
  const attack=agent.attack;assert.equal(attack.targetKind,'nest');close(attack.timingRate,1.6);close(attack.hitAt,10+.3/1.6);close(attack.recovery,.7/1.6);close(attack.endsAt,10+1/1.6+.1);
  const first=attack.hitAt;game.prepare(first-.0001);game.tick(.01);assert.equal(enemy.nest.health,100);
  game.prepare(first);game.tick(.0001);assert.ok(enemy.nest.health<100);close(attack.hitAt,first+.1);
  close(agent.attackReady,attack.endsAt+1/agent.stats.dna.meleeSpeed);
});
