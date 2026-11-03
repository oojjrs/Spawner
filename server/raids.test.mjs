import test from "node:test";
import assert from "node:assert/strict";
import { colonyRaidCadence } from "./raid-pressure.mjs";
import { createCreatures } from "./creatures.mjs";
import { createCombat } from "./combat.mjs";
import { createUtilityAI } from "./utility.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

function fixture(extra) {
  const colony = { id:1, ownerId:"owner", x:98, y:98, occupiedCells:new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]) };
  const victim = { id:"unit:1", x:103, y:100, health:10000, combatDisposition:"peaceful", stats:{ health:10000, speed:1, attack:1, combatStrength:20 }, moveStartedAt:0, moveDuration:0 }, hits = [];
  const room = { seed:7, simSeconds:0, world:{ seed:7, sites:[[100,100]], terrain:new Uint8Array(102400).fill(4), hazards:new Uint8Array(102400), burrows:[
    { id:"large:1", type:"large", x:148, y:100, width:3, height:1, entrance:{x:149,y:101} },
    { id:"small:1", type:"small", x:140, y:140, width:1, height:1, entrance:{x:140,y:141} }
  ] }, colonies:[colony], food:new Map(), games:new Map([["owner", { agents:[victim], receiveDamage(agent, amount) { hits.push({time:room.simSeconds,amount}); agent.health -= amount; } }]]) };
  if (extra) room.world.burrows.push({ id:"large:2", type:"large", x:148, y:140, width:3, height:1, entrance:{x:149,y:141} });
  const system = createCreatures(room, null); room.creatureSystem = system;
  return { room, system, victim, hits };
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
  const record = fixture.system.save().burrows.find(record => record.id === "large:1"), first = record.nextRaidAt;
  advance(fixture.room, fixture.system, first);
  const agent = fixture.system.agents.find(agent => agent.raid);
  assert.ok(agent);
  record.nextRaidAt = first + 1000;
  fixture.system.save().raidCooldowns.find(entry => entry.colonyId === agent.raid.colonyId).nextRaidAt = first + 1000;
  return agent;
}

test("5분 전에는 습격하지 않고 큰 굴만 5분~5분 30초에 기존 개체 1마리를 보낸다", () => {
  const { room, system } = fixture(false), first = system.save().burrows[0].nextRaidAt;
  assert.ok(first >= 300 && first <= 330);
  advance(room, system, 299.999); assert.ok(system.agents.every(agent => !agent.raid));
  advance(room, system, first);
  const raids = system.agents.filter(agent => agent.raid);
  assert.equal(raids.length, 1); assert.equal(raids[0].burrowId, "large:1"); assert.equal(raids[0].raid.departedAt, first);
  assert.equal(system.agents.filter(agent => agent.burrowId === "large:1" && agent.health > 0).length, 6);
  assert.ok(system.agents.filter(agent => agent.burrowId === "large:1" && !agent.raid && agent.health > 0).length >= 3);
  const interval = system.save().burrows[0].nextRaidAt - first; assert.equal(interval, 135);
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

test("여러 큰 굴이 있어도 한 둥지에는 단계별 간격으로 1마리만 보내고 이동 중이거나 처치되어도 출발 간격을 지킨다", () => {
  for (const killed of [false, true]) {
    const { room, system, victim } = fixture(true);
    victim.x = victim.y = 0;
    const first = system.save().raidCooldowns[0].nextRaidAt;
    advance(room, system, first);
    const active = system.agents.filter(agent => agent.health > 0 && agent.raid); assert.equal(active.length, 1);
    const departed = active[0].raid.departedAt, cooldown = system.save().raidCooldowns[0].nextRaidAt;
    assert.equal(cooldown, departed + 135);
    if (killed) system.receiveDamage(active[0], 100);
    advance(room, system, cooldown - .001);
    assert.equal(system.agents.filter(agent => agent.health > 0 && agent.raid).length, killed ? 0 : 1);
    if (!killed) assert.ok(["outbound", "active"].includes(active[0].raid.phase));
    advance(room, system, cooldown);
    const next = system.agents.filter(agent => agent.health > 0 && agent.raid?.departedAt > departed);
    assert.equal(next.length, 1); assert.equal(next[0].raid.departedAt, cooldown);
    assert.ok(system.agents.filter(agent => agent.health > 0 && !agent.raid && agent.burrowId === next[0].burrowId).length >= 3);
  }
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

test("습격벌레는 도착 후 시간 제한 없이 습격지에서 활동하며 출발 굴로 돌아가지 않는다", () => {
  const setup = fixture(false), { room, system, victim } = setup, agent = start(setup);
  victim.x = victim.y = 0;
  until(room, system, () => agent.raid?.phase === "active", 500);
  const arrivedAt = room.simSeconds, id = agent.id;
  advance(room, system, arrivedAt + 120);
  assert.equal(agent.raid.phase, "active");
  assert.equal(agent.id, id);
  assert.equal(agent.burrowId, "large:1");
  assert.equal(Object.hasOwn(agent.raid, "activeUntil"), false);
  assert.ok(Math.hypot(agent.x - 100, agent.y - 100) <= 5);
  assert.ok(Math.hypot(agent.x - 149, agent.y - 101) > 8);
});


test("출정·활동 저장은 시한 없이 복원하고 이전 귀환 저장도 습격 활동으로 이행한다", () => {
  const setup = fixture(false), { room } = setup; let system = setup.system, agent = start(setup);
  for (const phase of ["outbound", "active"]) {
    if (phase === "active") until(room, system, () => agent.raid?.phase === "active", 500);
    const saved = JSON.parse(JSON.stringify(system.save())), expected = JSON.parse(JSON.stringify(agent.raid));
    system = createCreatures(room, saved); room.creatureSystem = system; agent = system.agents.find(other => other.id === agent.id);
    assert.deepEqual(agent.raid, expected);
  }
  const saved = JSON.parse(JSON.stringify(system.save()));
  const previous = saved.agents.find(other => other.id === agent.id);
  previous.raid.phase = "returning"; previous.raid.activeUntil = null;
  system = createCreatures(room, saved); room.creatureSystem = system;
  agent = system.agents.find(other => other.id === agent.id);
  assert.equal(agent.raid.phase, "active");
  assert.equal(Object.hasOwn(agent.raid, "activeUntil"), false);
});


test("출발 굴 파괴는 습격을 끝내지 않고 대상 군락 소멸은 현재 위치에서 습격을 끝낸다", () => {
  const setup = fixture(false), { room, system, victim } = setup, agent = start(setup), id = agent.id;
  victim.x = victim.y = 0;
  until(room, system, () => agent.raid?.phase === "active", 500);
  system.receiveBurrowDamage("large:1", 60);
  advance(room, system, room.simSeconds + 60);
  assert.equal(agent.raid.phase, "active");
  room.colonies.splice(0);
  const position = [agent.x, agent.y];
  advance(room, system, room.simSeconds + .25);
  assert.ok(!agent.raid);
  assert.deepEqual([agent.homeX, agent.homeY], position);
  assert.deepEqual([agent.x, agent.y], position);
  assert.equal(agent.id, id); assert.ok(agent.health > 0);
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
  assert.equal(restored.save().burrows[0].health, 60); assert.equal(restored.save().burrows[0].nextSpawnAt, 30);
  assert.ok(restored.save().burrows[0].nextRaidAt >= 900 && restored.save().burrows[0].nextRaidAt <= 930);
  const invalid = JSON.parse(JSON.stringify(restored.save())); invalid.raidCooldowns = null;
  assert.throws(() => createCreatures(room, invalid), /습격 저장 형식/);
});

test("유닛의 위험 판단은 굴에서 멀어진 습격 개체도 위협으로 계산한다", () => {
  const agent = { id:"unit", x:3,y:4,health:12,cost:4,carrying:0,visited:new Set(["3,4"]),personality:{boldness:.2,aggression:.2,curiosity:.2},
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

test("야생 개체 수가 가득 차도 담당 굴은 병력을 확보하고 단계별 간격으로 보충 출정한다", () => {
  const { room } = fixture(false);
  room.world.encounters = [{ key:"spiny-back-beetle", populationLimit:3,
    spawnPoints:[140 * 320 + 138, 143 * 320 + 140, 141 * 320 + 143] }];
  const system = createCreatures(room, null);
  room.creatureSystem = system;
  const first = system.save().raidCooldowns[0].nextRaidAt;
  assert.equal(system.agents.filter(agent => agent.burrowId === "large:1").length, 4);
  advance(room, system, first);
  const saved = JSON.parse(JSON.stringify(system.save())), restored = createCreatures(room, saved);
  assert.equal(restored.agents.length, system.agents.length);
  assert.deepEqual(restored.save(), saved);
  advance(room, system, first + 135);
  assert.equal(system.save().burrows[0].raidSequence, 2);
  assert.ok(system.agents.filter(agent => agent.health > 0 && !agent.raid && agent.burrowId === "large:1").length >= 3);
  assert.ok(system.agents.length <= 11);
});

test("각 군락이 담당 굴에서 첫 습격을 받고 다음 출정도 자기 쿨다운을 따른다", () => {
  const { room } = fixture(true), colony = room.colonies[0];
  room.colonies.push({ ...colony, id:2, ownerId:"second", x:198 });
  room.games.set("second", { agents:[], nest:{health:100000}, receiveNestDamage() {} });
  const system = createCreatures(room, null);
  advance(room, system, 330);
  const first = system.agents.filter(agent => agent.raid);
  assert.deepEqual(first.map(agent => agent.raid.colonyId).sort(), [1, 2]);
  assert.equal(new Set(first.map(agent => agent.burrowId)).size, 2);
  const departures = first.map(agent => ({ colonyId:agent.raid.colonyId, time:agent.raid.departedAt }));
  advance(room, system, 465);
  for (const departure of departures) assert.ok(system.agents.some(agent => agent.raid?.colonyId === departure.colonyId &&
    Math.abs(agent.raid.departedAt - departure.time - 135) < 1e-8));
});

test("느린 입지는 첫 접근을 늦추고 교체 여력에 따라 다른 출정 주기를 유지한다", () => {
  const outcomes = [];
  for (const delivered of [20,40]) {
    const {room,system} = fixture(false);
    room.games.get("owner").colonyFood = delivered;
    advance(room, system, 120);
    const cooldown = system.save().raidCooldowns[0];
    const first = cooldown.nextRaidAt, opening = structuredClone(cooldown.opening);
    advance(room, system, first);
    assert.equal(system.agents.filter(agent=>agent.raid).length, 1);
    assert.ok(Math.abs(cooldown.nextRaidAt - first - colonyRaidCadence(first, opening.pressure).interval) < 1e-8);
    const saved = structuredClone(system.save());
    room.games.get("owner").colonyFood = 10000;
    const restored = createCreatures(room, saved);
    assert.deepEqual(restored.save().raidCooldowns[0].opening, opening);
    assert.equal(restored.save().raidCooldowns[0].nextRaidAt, cooldown.nextRaidAt);
    outcomes.push({first,interval:opening.interval});
  }
  assert.ok(outcomes[0].first > outcomes[1].first);
  assert.ok(outcomes[0].interval > outcomes[1].interval);
});

test("이전 저장을 늦게 불러와도 전체 누적 수급을 첫 2분 수급으로 과대평가하지 않는다", () => {
  const {room,system} = fixture(false), saved = structuredClone(system.save());
  room.simSeconds = 600;
  room.games.get("owner").colonyFood = 80;
  const restored = createCreatures(room, saved);
  restored.tick();
  const opening = restored.save().raidCooldowns[0].opening;
  assert.equal(opening.rate, 8);
  assert.equal(opening.interval, 120);
});

test("습격벌레는 출정·활동 중 붙잡혀도 공격과 반격이 끝나기 전에 이탈하지 않는다", () => {
  for (const phase of ["outbound", "active"]) {
    const setup = fixture(false), { room, system, victim } = setup, agent = start(setup);
    agent.raid.phase = phase;
    agent.raid.activeUntil = phase === "active" ? room.simSeconds : null;
    Object.assign(agent, { x: 120, y: 100, renderFromX: 120, renderFromY: 100, moveDuration: 0 });
    Object.assign(victim, { x: agent.x, y: agent.y, combatDisposition: "aggressive" });
    const combat = createCombat(room);
    assert.equal(combat.engage(victim, agent, room.simSeconds), true, phase);
    combat.update(victim, room.simSeconds);
    const position = { x: agent.x, y: agent.y }, combatId = agent.combat.id;
    system.tick();
    assert.equal(agent.combat?.id, combatId, phase);
    assert.equal(agent.raid.phase, phase, phase);
    assert.deepEqual({ x: agent.x, y: agent.y }, position, phase);
    advance(room, system, victim.attack.hitAt);
    advance(room, system, victim.attack.exchangeEndsAt);
    assert.equal(agent.combat?.id, combatId, phase);
    assert.ok(agent.attack?.counter, phase);
    const before = victim.health;
    advance(room, system, agent.attack.hitAt);
    assert.ok(victim.health < before, phase);
    victim.health = 0;
    until(room, system, () => !agent.combat, room.simSeconds + 10);
    room.simSeconds += .25; system.tick();
    assert.equal(agent.raid.phase, phase);
  }
});
