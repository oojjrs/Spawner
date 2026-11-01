import test from "node:test";
import assert from "node:assert/strict";
import { createEncounters } from "./encounters.mjs";
import { createCreatures } from "./creatures.mjs";

const movement = [
  ["flower-tail-bird", 2, 3], ["dew-rabbit", 2.6, 2.5], ["soil-mole", .8, 5],
  ["bundle-snail", .4, 6], ["cotton-sheep", .8, 4], ["rolling-acorn", 1.8, 6],
  ["bubble-toad", .8, 20], ["snare-vine", 1.4, 30], ["spiny-back-beetle", 1.2, 18],
  ["soil-boar", 1.6, 24], ["vine-turtle", .4, 30], ["shadow-weasel", 2.6, 30],
  ["talon-owl", 2, 40], ["spring-keeper", 1.6, 30], ["lantern-keeper", 2.8, 30],
  ["old-garden-snail", .3, 45], ["walking-forest", .3, 60], ["white-paw", 3.2, 90],
  ["spiny-back-leader", 1.4, 120]
];
const aggressive = new Set(["bubble-toad", "snare-vine", "spiny-back-beetle", "soil-boar", "vine-turtle",
  "shadow-weasel", "talon-owl", "white-paw", "spiny-back-leader"]);

function fixture(species) {
  const cells=[];
  for(let y=84;y<=116;y++)for(let x=84;x<=116;x++)cells.push(y*320+x);
  const player={id:"player",ownerId:"test",x:102,y:100,health:10000,mode:"gather",attributes:{},
    stats:{health:10000,combatStrength:20,speed:1,attack:1},moveStartedAt:0,moveDuration:0};
  const game={agents:[],discoveredKinds:new Set(),colonyFood:0,isVisible:()=>false,
    receiveDamage(agent,amount){agent.health-=amount;}};
  const room={seed:7,simSeconds:720,games:new Map([["test",game]]),colonies:[],food:new Map(),world:{
    seed:7,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320),sites:[],
    burrows:species==="spiny-back-beetle"?[{id:"small:1",type:"small",x:98,y:99,width:1,height:1,entrance:{x:99,y:100}}]:[],
    encounters:species==="spiny-back-beetle"?[]:[{key:species,x:100,y:100,radius:16,safeRadius:0,
      terrains:[4],nearWater:false,cells,route:[],spawnPoints:[32100],populationLimit:1,homeId:null}]}};
  let system=species==="spiny-back-beetle"?createCreatures(room,null):createEncounters(room,null,[]);
  const agent=system.agents[0];
  assert.ok(agent,species);
  Object.assign(agent,{x:100,y:100,homeX:100,homeY:100,renderFromX:100,renderFromY:100,
    moveStartedAt:720,moveDuration:0,nextActionAt:720,mode:"idle",hidden:false,stepCount:0});
  const result={room,game,player,agent,system,
    restore(saved){
      room.combatSystem=null;
      system=species==="spiny-back-beetle"?createCreatures(room,saved):createEncounters(room,saved,[]);
      this.system=system;this.agent=system.agents[0];
    }};
  room.creatureSystem={get agents(){return system.agents;},get burrows(){return system.burrows||[];},
    burrowAt(x,y){return species==="spiny-back-beetle"?system.burrowAt(x,y):null;}};
  return result;
}

function tick(f,time){f.room.simSeconds=time;f.system.tick();}
function readyToRoam(f,species){
  if(aggressive.has(species)&&species!=="spiny-back-beetle"){
    Object.assign(f.agent,{x:104,renderFromX:104,returningHome:true});
  }
  if(species==="soil-mole"){f.player.x=110;f.game.agents.push(f.player);}
  if(species==="walking-forest")f.agent.stepCount=3;
}

test("중립 생물 19종은 실제 이속을 유지하고 평상시에만 종별 휴지를 적용한다",()=>{
  for(const [species,speed,rest] of movement){
    const f=fixture(species);readyToRoam(f,species);
    tick(f,720);
    assert.equal(f.agent.stats.speed,speed,species);
    assert.equal(f.agent.mode,"walk",species);
    assert.ok(Math.abs(f.agent.moveDuration-1/speed)<1e-10,species);
    const step=f.agent.stepCount,endsAt=f.agent.moveStartedAt+f.agent.moveDuration;
    if(f.agent.returningHome){
      tick(f,endsAt);
      assert.equal(f.agent.stepCount,step+1,species);
      assert.equal(f.agent.nextActionAt,f.agent.moveStartedAt+f.agent.moveDuration,species);
      continue;
    }
    tick(f,endsAt);
    assert.equal(f.agent.mode,"idle",species);
    assert.equal(f.agent.animationStartedAt,endsAt,species);
    assert.equal(f.agent.nextActionAt,endsAt+rest,species);
    tick(f,endsAt+rest-.001);
    assert.equal(f.agent.stepCount,step,species);
    tick(f,endsAt+rest);
    assert.equal(f.agent.stepCount,step+1,species);
  }
});

test("선공 생물 9종은 평상시 대기 중 추격하고 목표 소멸 후 배회 휴지나 연속 귀환으로 전환한다",()=>{
  for(const [species,speed,rest] of movement.filter(([key])=>aggressive.has(key))){
    const f=fixture(species);
    f.agent.nextActionAt=720+rest;
    f.game.agents.push(f.player);
    for(let count=0;count<30&&f.agent.mode!=="walk";count++)tick(f,720+count*.1);
    assert.equal(f.agent.mode,"walk",species);
    assert.ok(Math.abs(f.agent.moveDuration-1/speed)<1e-10,species);
    const first=f.agent.stepCount;
    tick(f,f.agent.moveStartedAt+f.agent.moveDuration);
    assert.equal(f.agent.stepCount,first+1,species);
    assert.equal(f.agent.moveDuration,1/speed,species);
    f.game.agents=[];
    const endsAt=f.agent.moveStartedAt+f.agent.moveDuration;
    tick(f,endsAt);
    if(f.agent.returningHome){
      assert.equal(f.agent.mode,"walk",species);
      assert.equal(f.agent.nextActionAt,f.agent.moveStartedAt+f.agent.moveDuration,species);
      continue;
    }
    assert.equal(f.agent.mode,"idle",species);
    tick(f,endsAt+rest-.001);
    assert.equal(f.agent.stepCount,first+1,species);
  }
});

test("이전 저장은 진행 중인 이동 위치를 유지하면서 새 이속과 남은 휴지 시간을 적용한다",()=>{
  for(const [species,speed,rest] of movement){
    const f=fixture(species);readyToRoam(f,species);tick(f,720);
    const saved=JSON.parse(JSON.stringify(f.system.save())),agent=saved.agents[0];
    const step=agent.stepCount;
    agent.stats.speed=.5;agent.moveDuration=2;agent.nextActionAt=722;
    tick(f,720.25);
    f.restore(saved);
    assert.equal(f.agent.stats.speed,speed,species);
    assert.equal(f.agent.moveDuration,2,species);
    if(f.agent.returningHome){
      assert.equal(f.agent.nextActionAt,722,species);
      tick(f,722);
      assert.equal(f.agent.stepCount,step+1,species);
      continue;
    }
    assert.equal(f.agent.nextActionAt,722+rest,species);
    tick(f,722+rest-.001);
    assert.equal(f.agent.stepCount,step,species);
    tick(f,722+rest);
    assert.equal(f.agent.stepCount,step+1,species);
    assert.ok(Math.abs(f.agent.moveDuration-1/speed)<1e-10,species);
  }
});

test("비행 생물의 숲 감속과 지상 생물의 해안 감속은 실제 이동 시간에만 반영한다",()=>{
  for(const [species,terrain,speed,rest] of [["flower-tail-bird",5,2,3],["spiny-back-beetle",2,1.2,18]]){
    const f=fixture(species);f.room.world.terrain.fill(terrain);
    tick(f,720);
    assert.ok(Math.abs(f.agent.moveDuration-1/(speed*.8))<1e-10,species);
    const endsAt=f.agent.moveStartedAt+f.agent.moveDuration;
    tick(f,endsAt);
    assert.equal(f.agent.nextActionAt-endsAt,rest,species);
  }
});

test("선공 생물 9종은 추격 후 귀환에 이동 휴지를 적용하지 않는다",()=>{
  for(const [species,speed] of movement.filter(([key])=>aggressive.has(key))){
    const f=fixture(species);
    Object.assign(f.agent,{x:105,renderFromX:105,returningHome:true,nextActionAt:840});
    tick(f,720);
    assert.equal(f.agent.stepCount,1,species);
    assert.equal(f.agent.moveDuration,1/speed,species);
    assert.equal(f.agent.nextActionAt,f.agent.moveStartedAt+f.agent.moveDuration,species);
    tick(f,f.agent.moveStartedAt+f.agent.moveDuration);
    assert.equal(f.agent.stepCount,2,species);
    assert.equal(f.agent.nextActionAt,f.agent.moveStartedAt+f.agent.moveDuration,species);
  }
});
