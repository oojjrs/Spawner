import test from 'node:test';
import assert from 'node:assert/strict';
import { dnaCanMove, dnaCanHunt, dnaUnitStats } from './dna-unit.mjs';
import { createCombat } from './combat.mjs';
import { createGame } from './game.mjs';

const home = { id: 1, ownerId: 'home', x: 40, y: 40, occupiedCells: new Set(['2,2']) };
const legacy = () => ({ ownerId: 'home', attributes: {}, x: 44, y: 42 });
const dnaUnit = genes => {
  const dna = { version: 6, level: 2, pieces: genes.map(gene => ({ gene, grade: 2, rotation: 0, q: 0, r: 0 })) };
  return { ...legacy(), dna, stats: dnaUnitStats(dna) };
};

test('일반 이동은 안테나나 둥지 거리에 제한되지 않고 올바른 격자 좌표만 받는다', () => {
  for (const unit of [legacy(), dnaUnit([]), dnaUnit(['gather']), dnaUnit(['antenna'])]) {
    for (const [x,y] of [[47,42],[48,42],[47,47],[100,100]]) assert.equal(dnaCanMove(unit,x,y,[home]),true);
    for (const [x,y] of [[-1,42],[48,-1],[NaN,42],[48,Infinity],[48.5,42]]) assert.equal(dnaCanMove(unit,x,y,[home]),false);
  }
});

test('안테나는 칼날·분비기관·갑각 전투형만 적 탐색을 해금한다', () => {
  for (const genes of [[],['antenna'],['gather','antenna'],['blade'],['secretion'],['carapace']])
    assert.equal(dnaCanHunt(dnaUnit(genes)),false,genes.join(','));
  for (const genes of [['blade','antenna'],['secretion','antenna'],['carapace','antenna']])
    assert.equal(dnaCanHunt(dnaUnit(genes)),true,genes.join(','));
  assert.equal(dnaCanMove({species:'bubble-toad'},100,100,[]),true);
});

test('둥지 밖 구세이브는 귀환 우회로와 다른 자원 방향으로 이동할 수 있다', () => {
  const unit = {...legacy(),x:52};
  for (const [x,y] of [[51,42],[53,42],[52,43],[44,42]]) assert.equal(dnaCanMove(unit,x,y,[home]),true);
  assert.equal(dnaCanMove(unit,51,42,[]),true);
});

test('시작 일꾼은 저장 복원 뒤에도 적 탐색 없이 둥지 밖으로 이동할 수 있다', () => {
  const environment={simSeconds:0,world:{seed:13,terrain:new Uint8Array(320*320).fill(4),hazards:new Uint8Array(320*320)},
    colonies:[home], games:new Map(),food:new Map(),foodSpots:new Map()};
  const game=createGame(environment,home);environment.games.set('home',game);
  assert.ok(game.agents.length);
  for(const agent of game.agents) Object.assign(agent,{x:55,y:42,renderFromX:55,renderFromY:42});
  game.restore(game.save());
  for(const agent of game.agents) {
    assert.equal(agent.x,55);assert.equal(agent.stats.dna.hunting,false);
    assert.equal(dnaCanMove(agent,56,42,[home]),true);
  }
});

test('전투 도주는 안테나 없이도 옛 둥지 경계 밖의 안전한 칸을 사용한다', () => {
  const player = {...legacy(),id:'player',x:47,y:42,renderFromX:47,renderFromY:42,health:20,
    combatDisposition:'aggressive',stats:{health:100,attack:1,attackPower:1,speed:1,vision:4},moveStartedAt:0,moveDuration:0};
  const enemy = {...player,id:'enemy',ownerId:'enemy',health:100,attributes:{antenna:1}};
  const terrain=new Uint8Array(320*320);terrain[42*320+47]=4;terrain[42*320+48]=4;
  const environment={simSeconds:0,games:new Map(),colonies:[home],combatRandom:()=>0,damageRandom:()=>.5,
    world:{terrain,hazards:new Uint8Array(320*320)}};
  for(const agent of [player,enemy]) environment.games.set(agent.ownerId,{agents:[agent],receiveDamage(target,amount){target.health-=amount;}});
  const combat=createCombat(environment);
  for(const time of [0,.4,3]) {
    environment.simSeconds=time;
    combat.update(player,time);combat.update(enemy,time);
  }
  assert.ok(player.retreat);assert.equal(player.combat,null);
  assert.equal(player.x,48);assert.equal(player.y,42);
});
