import test from 'node:test';
import assert from 'node:assert/strict';
import { dnaCanMove, dnaUnitStats } from './dna-unit.mjs';
import { createCombat } from './combat.mjs';
import { createGame } from './game.mjs';

const home = { id: 1, ownerId: 'home', x: 40, y: 40, occupiedCells: new Set(['2,2']) };
const foreign = { ...home, ownerId: 'foreign', x: 70 };
const legacy = () => ({ ownerId: 'home', attributes: {}, x: 44, y: 42 });
const dnaUnit = (antenna = false) => {
  const dna = {version: 3, level: 2, pieces: antenna ? [{gene:'antenna', grade:2, rotation:0, shape:[0,1,2]}] : []};
  return { ...legacy(), dna, stats: dnaUnitStats(dna) };
};

test('starting and DNA units without antenna share the 3-cell nest boundary', () => {
  for (const unit of [legacy(), dnaUnit()]) {
    assert.equal(dnaCanMove(unit,47,42,[home]),true);
    assert.equal(dnaCanMove(unit,48,42,[home]),false);
    assert.equal(dnaCanMove(unit,46,46,[home]),true);
    assert.equal(dnaCanMove(unit,47,47,[home]),false);
    assert.equal(dnaCanMove(unit,72,42,[home,foreign]),false);
  }
});

test('antenna grants roaming; wild creatures retain independent movement', () => {
  for (const unit of [{...legacy(),attributes:{antenna:1}}, dnaUnit(true), {species:'bubble-toad'}])
    assert.equal(dnaCanMove(unit,100,100,[home]),true);
  assert.equal(dnaCanMove({...legacy(),species:'flower-tail-bird'},100,100,[home]),false);
});

test('out-of-range legacy saves can only approach home until they return', () => {
  const unit = {...legacy(),x:52};
  assert.equal(dnaCanMove(unit,51,42,[home]),true);
  assert.equal(dnaCanMove(unit,53,42,[home]),false);
  assert.equal(dnaCanMove(unit,52,43,[home]),false);
  assert.equal(dnaCanMove(unit,44,42,[home]),true);
  assert.equal(dnaCanMove(unit,51,42,[]),false);
});

test('starting units cannot wander outside home across ticks and save/restore', () => {
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[home], games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,home);environment.games.set('home',game);
  assert.ok(game.agents.length);
  assert.ok(game.agents.every(agent=>agent.dna && !agent.stats.dna.roaming));
  const bounds = agent => {
    const dx=Math.max(home.x-agent.x,0,agent.x-home.x-4),dy=Math.max(home.y-agent.y,0,agent.y-home.y-4);
    assert.ok(Math.hypot(dx,dy)<=3, `${agent.id}: ${agent.x},${agent.y}`);
  };
  for(let i=0;i<1200;i++) {
    environment.simSeconds+=.1;game.prepare(environment.simSeconds);game.tick(.1);
    game.agents.filter(agent=>!agent.attributes.antenna).forEach(bounds);
    if(i===600)game.restore(game.save());
  }
  assert.ok(game.agents.some(agent=>agent.stepCount>0));
});

test('combat escape cannot step outside the nest range without antenna', () => {
  const player = {...legacy(),id:'player',x:47,y:42,renderFromX:47,renderFromY:42,health:20,
    combatDisposition:'aggressive',stats:{health:100,attack:1,attackPower:1,speed:1,vision:4},moveStartedAt:0,moveDuration:0};
  const enemy = {...player,id:'enemy',ownerId:'enemy',health:100,attributes:{antenna:1}};
  const environment={simSeconds:0,games:new Map(),colonies:[home],combatRandom:()=>0,damageRandom:()=>.5,
    world:{terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)}};
  for(const agent of [player,enemy]) environment.games.set(agent.ownerId,{agents:[agent],receiveDamage(target,amount){target.health-=amount;}});
  const combat=createCombat(environment);
  for(const time of [0,.4,2.5]) {
    environment.simSeconds=time;
    combat.update(player,time);combat.update(enemy,time);
  }
  assert.ok(player.retreat);
  assert.equal(player.combat,null);
  const dx=Math.max(home.x-player.x,0,player.x-home.x-4),dy=Math.max(home.y-player.y,0,player.y-home.y-4);
  assert.ok(Math.hypot(dx,dy)<=3);
  assert.ok(Math.abs(player.x-47)+Math.abs(player.y-42)===1);
});
