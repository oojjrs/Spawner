import test from "node:test";
import assert from "node:assert/strict";
import { createCreatures } from "./creatures.mjs";
import { createUtilityAI } from "./utility.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

function fixture(extra) {
  const colony = { id:1, ownerId:"owner", x:98, y:98, occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]) };
  const victim = { id:"unit:1", x:103, y:100, health:10000, moveStartedAt:0, moveDuration:0 }, hits = [];
  const room = { seed:7, simSeconds:0, world:{ seed:7, sites:[[100,100]], terrain:new Uint8Array(102400).fill(4), hazards:new Uint8Array(102400), burrows:[
    { id:"large:1", type:"large", x:148, y:100, width:3, height:1, entrance:{x:149,y:101} },
    { id:"small:1", type:"small", x:140, y:140, width:1, height:1, entrance:{x:140,y:141} }
  ] }, colonies:[colony], food:new Map(), games:new Map([["owner", { agents:[victim], receiveDamage(agent, amount) { hits.push({time:room.simSeconds,amount}); agent.health -= amount; } }]]) };
  if (extra) room.world.burrows.push({ id:"large:2", type:"large", x:148, y:140, width:3, height:1, entrance:{x:149,y:141} });
  return { room, system:createCreatures(room, null), victim, hits };
}
function advance(room, system, until) {
  while (room.simSeconds + .25 < until) { room.simSeconds += .25; system.tick(); }
  room.simSeconds = until; system.tick();
}
function until(room, system, predicate, limit) {
  while (!predicate() && room.simSeconds < limit) { room.simSeconds += .25; system.tick(); }
  assert.ok(predicate(), "시간 안에 습격 상태에 도달하지 못했습니다: " + room.simSeconds);
}
function start(fixture) {
  const first = fixture.system.save().burrows.find(record => record.id === "large:1").nextRaidAt;
  advance(fixture.room, fixture.system, first);
  const agent = fixture.system.agents.find(agent => agent.raid);
  assert.ok(agent);
  return agent;
}

test("3분 전에는 습격하지 않고 큰 굴만 3분~3분 30초에 기존 개체 1마리를 보낸다", () => {
  const { room, system } = fixture(false), first = system.save().burrows[0].nextRaidAt;
  assert.ok(first >= 180 && first <= 210);
  advance(room, system, 179.999); assert.ok(system.agents.every(agent => !agent.raid));
  advance(room, system, first);
  const raids = system.agents.filter(agent => agent.raid);
  assert.equal(raids.length, 1); assert.equal(raids[0].burrowId, "large:1"); assert.equal(raids[0].raid.departedAt, first);
  assert.equal(system.agents.filter(agent => agent.burrowId === "large:1" && agent.health > 0).length, 6);
  assert.ok(system.agents.filter(agent => agent.burrowId === "large:1" && !agent.raid && agent.health > 0).length >= 3);
  const interval = system.save().burrows[0].nextRaidAt - first; assert.ok(interval >= 120 && interval <= 180);
});

test("수비가 3마리뿐이거나 굴이 파괴되면 습격을 보내지 않는다", () => {
  for (const destroyed of [false,true]) {
    const { room, system } = fixture(false), record = system.save().burrows[0], first = record.nextRaidAt;
    advance(room, system, first - .001); record.nextSpawnAt = first + 1000;
    if (destroyed) system.receiveBurrowDamage(record.id, 60);
    else for (const agent of system.agents.filter(agent => agent.burrowId === record.id).slice(3)) system.receiveDamage(agent, 100);
    advance(room, system, first + 5);
    assert.ok(system.agents.every(agent => !agent.raid));
  }
});

test("여러 큰 굴이 있어도 한 둥지에는 한 습격대만 보내고 처치되어도 최소 출발 간격을 지킨다", () => {
  const { room, system } = fixture(true);
  advance(room, system, 211);
  const active = system.agents.filter(agent => agent.health > 0 && agent.raid); assert.equal(active.length, 1);
  const departed = active[0].raid.departedAt, cooldown = system.save().raidCooldowns[0].nextRaidAt;
  system.receiveDamage(active[0], 100);
  advance(room, system, cooldown - .001); assert.ok(!system.agents.some(agent => agent.health > 0 && agent.raid));
  advance(room, system, cooldown + 5);
  const next = system.agents.filter(agent => agent.health > 0 && agent.raid); assert.equal(next.length, 1);
  assert.ok(next[0].raid.departedAt - departed >= 120);
  assert.ok(system.agents.filter(agent => agent.health > 0 && !agent.raid && agent.burrowId === next[0].burrowId).length >= 3);
});

test("이동 경로가 없으면 출발하지 않고 통로가 열리면 실제 지형을 따라 이동한다", () => {
  const setup = fixture(false), { room, system } = setup;
  for (let y = 0; y < 320; y++) room.world.terrain[y * 320 + 125] = 0;
  const first = system.save().burrows[0].nextRaidAt; advance(room, system, first);
  assert.ok(!system.agents.some(agent => agent.raid));
  room.world.terrain[101 * 320 + 125] = 4;
  advance(room, system, first + 5);
  const agent = system.agents.find(agent => agent.raid); assert.ok(agent);
  until(room, system, () => agent.raid?.phase === "active", first + 200);
  assert.ok(agent.x < 125); assert.ok(Math.hypot(agent.x - agent.homeX, agent.y - agent.homeY) > 8);
  assert.equal(room.world.terrain[agent.y * 320 + agent.x], 4);
});

test("도착 후 30초 안에서만 교전하고 귀환해도 생존 개체와 소속을 유지한다", () => {
  const setup = fixture(false), { room, system, hits } = setup, agent = start(setup), id = agent.id;
  until(room, system, () => agent.raid?.phase === "active", 400);
  const end = agent.raid.activeUntil; advance(room, system, end);
  assert.equal(agent.raid.phase, "returning"); assert.ok(hits.length > 0); assert.ok(hits.every(hit => hit.time < end));
  const count = hits.length;
  until(room, system, () => !agent.raid, end + 200);
  assert.equal(hits.length, count); assert.equal(agent.id, id); assert.equal(agent.burrowId, "large:1");
  assert.ok(Math.abs(agent.x - 149) + Math.abs(agent.y - 101) <= 1);
  assert.ok(system.agents.filter(other => other.burrowId === "large:1" && other.health > 0).length <= 6);
});

test("출정·교전·복귀 중 저장을 복원해도 대상과 30초 종료 시각·다음 출발 시각이 유지된다", () => {
  const setup = fixture(false), { room } = setup; let system = setup.system, agent = start(setup);
  for (const phase of ["outbound","active","returning"]) {
    if (phase === "active") until(room, system, () => agent.raid?.phase === "active", 400);
    if (phase === "returning") advance(room, system, agent.raid.activeUntil);
    const saved = JSON.parse(JSON.stringify(system.save())), expected = JSON.parse(JSON.stringify(agent.raid));
    system = createCreatures(room, saved); agent = system.agents.find(other => other.id === agent.id);
    assert.deepEqual(system.save(), saved); assert.deepEqual(agent.raid, expected);
  }
  until(room, system, () => !agent.raid, 600);
});

test("파괴된 출발 굴과 사라진 대상 둥지는 출정 개체를 삭제하지 않는다", () => {
  const setup = fixture(false), { room, system } = setup, agent = start(setup), id = agent.id;
  system.receiveBurrowDamage("large:1", 60); room.colonies.splice(0);
  until(room, system, () => !agent.raid, room.simSeconds + 200);
  assert.equal(agent.id, id); assert.ok(agent.health > 0);
  advance(room, system, room.simSeconds + 600);
  assert.ok(system.agents.includes(agent)); assert.ok(!system.agents.some(other => other.raid));
});

test("둥지 안전권 안에서 처치한 습격 개체도 사체를 한 번만 남긴다", () => {
  const setup = fixture(false), { room, system } = setup, agent = start(setup);
  until(room, system, () => agent.raid?.phase === "active", 400);
  system.receiveDamage(agent, 100); advance(room, system, room.simSeconds + 5);
  assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, 1);
  system.tick(); assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, 1);
});

test("이전 버전 4 저장은 개체·굴 체력·증식 시각을 보존하고 습격은 불러온 시점 이후에 시작한다", () => {
  const { room, system } = fixture(false), saved = JSON.parse(JSON.stringify(system.save()));
  saved.version = 4; delete saved.raidCooldowns;
  for (const record of saved.burrows) { delete record.nextRaidAt; delete record.raidSequence; }
  room.simSeconds = 900;
  const restored = createCreatures(room, saved);
  assert.equal(restored.save().version, 5); assert.deepEqual(restored.agents, saved.agents);
  assert.equal(restored.save().burrows[0].health, 60); assert.equal(restored.save().burrows[0].nextSpawnAt, 60);
  assert.ok(restored.save().burrows[0].nextRaidAt >= 900 && restored.save().burrows[0].nextRaidAt <= 930);
  const invalid = JSON.parse(JSON.stringify(restored.save())); invalid.raidCooldowns = null;
  assert.throws(() => createCreatures(room, invalid), /습격 저장 형식/);
});

test("유닛의 위험 판단은 굴에서 멀어진 습격 개체도 위협으로 계산한다", () => {
  const agent = { id:"unit", x:3,y:4,health:12,cost:4,carrying:0,personality:{boldness:.2,aggression:.2,curiosity:.2},
    stats:{health:12,attack:1,speed:1,vision:3,capacity:2,resistance:1} };
  const enemy = { id:"beetle",x:4,y:4,health:20,species:"spiny-back-beetle",homeX:200,homeY:200,stats:{attack:3,speed:1/1.28} };
  const state = { simSeconds:0,nestLevel:1,agents:[agent],knownFood:new Map(),markers:[],evolutionPoints:0,explored:new Set(Array.from({length:81},(_,i)=>Math.floor(i/9)*320+i%9)) };
  const ai = createUtilityAI({state,size:320,homeCells:()=>[{x:1,y:1}],deliveryCells:()=>[{x:1,y:1}],walkable:()=>true,hazardAt:()=>0,enemies:()=>[enemy],synergy:()=>false,canHarvest:()=>true});
  assert.ok(!ai.evaluate(agent,false).some(candidate=>candidate.action==="flee"));
  enemy.raid = {phase:"active"};
  assert.ok(ai.evaluate(agent,false).some(candidate=>candidate.action==="flee"));
});

test("실제 월드 저장·복원은 습격 주기와 쿨다운을 포함한 버전 5를 보존한다", () => {
  const room = createRoom("습격 저장 확인", 731047), saved = JSON.parse(JSON.stringify(saveRoom(room))), restored = restoreRoom(saved);
  assert.equal(saved.creatures.version, 5); assert.deepEqual(restored.creatureSystem.save(), saved.creatures);
});
