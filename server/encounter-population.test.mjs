import test from "node:test";
import assert from "node:assert/strict";
import { createEncounters } from "./encounters.mjs";
import { generateWorld } from "./world.mjs";

function fixture(species, points, populationLimit) {
  const cells = new Set();
  for (const [x, y] of points) for (let cy = Math.floor(y / 16) * 16; cy < Math.floor(y / 16) * 16 + 16; cy++)
    for (let cx = Math.floor(x / 16) * 16; cx < Math.floor(x / 16) * 16 + 16; cx++) cells.add(cy * 320 + cx);
  const game = { agents: [], discoveredKinds: new Set(), colonyFood: 0, isVisible: () => false };
  const room = { simSeconds: 720, colonies: [], games: new Map([["test", game]]), food: new Map(), world: {
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), encounters: [
      { key: species, x: points[0][0], y: points[0][1], radius: 8, safeRadius: 0, terrains: [4], nearWater: false,
        cells: [...cells], route: [], spawnPoints: points.map(([x, y]) => y * 320 + x), populationLimit, homeId: null }
    ] } };
  const system = createEncounters(room, null, []), result = { room, system, game };
  room.creatureSystem = { get agents() { return result.system.agents; }, burrowAt() { return null; } };
  return result;
}

function advance(fixture, seconds) {
  fixture.room.simSeconds += seconds;
  fixture.system.tick();
}

function count(fixture, regionId) {
  return fixture.system.agents.filter(agent => agent.regionId === regionId).length;
}

test("개체가 출생 구역 밖으로 이동해도 같은 구역에 중복 보충하지 않는다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2);
  const [west, east] = f.system.agents;
  assert.notEqual(west.regionId, east.regionId);
  Object.assign(west, { x: 105, y: 40 });
  advance(f, 1000);
  assert.equal(f.system.agents.length, 2);
  assert.equal(count(f, west.regionId), 1);
  assert.equal(count(f, east.regionId), 1);
});

test("일반 12종은 처치한 개체를 보충하지 않고 남은 개체만 보존한다", () => {
  for (const species of ["flower-tail-bird", "dew-rabbit", "soil-mole", "bundle-snail", "cotton-sheep", "rolling-acorn",
    "soil-boar", "bubble-toad", "vine-turtle", "shadow-weasel", "snare-vine", "talon-owl"]) {
    const f = fixture(species, [[40, 40], [104, 40]], 2), [west, east] = f.system.agents;
    f.system.receiveDamage(west, west.health);
    advance(f, 36000);
    assert.deepEqual(f.system.agents.map(agent => agent.id), [east.id], species);
    assert.ok(f.system.save().records[0].regions.every(region => region.nextSpawnAt === null), species);
    f.system.receiveDamage(east, east.health);
    advance(f, 36000);
    assert.equal(f.system.agents.length, 0, species);
  }
});

test("최초 생성 자리가 막혀 있으면 빈자리를 무한 재탐색하거나 저장복원 후 채우지 않는다", () => {
  const f = fixture("dew-rabbit", [[40, 40]], 1);
  f.room.world.terrain.fill(0);
  f.system = createEncounters(f.room, null, []);
  assert.equal(f.system.agents.length, 0);
  assert.equal(f.system.save().records[0].spawned, true);
  f.room.world.terrain.fill(4);
  advance(f, 1000);
  assert.equal(f.system.agents.length, 0);
  f.system = createEncounters(f.room, JSON.parse(JSON.stringify(f.system.save())), []);
  advance(f, 1000);
  assert.equal(f.system.agents.length, 0);
});

test("일반 적대종의 최초 등장 지연은 유지하고 등장 후에는 다시 생성하지 않는다", () => {
  const f = fixture("soil-boar", [[40, 40]], 1);
  f.room.simSeconds = 0;
  f.system = createEncounters(f.room, null, []);
  advance(f, 239);
  assert.equal(f.system.agents.length, 0);
  advance(f, 1);
  assert.equal(f.system.agents.length, 1);
  f.system.receiveDamage(f.system.agents[0], 10000);
  advance(f, 36000);
  assert.equal(f.system.agents.length, 0);
});

test("버전 1·2·3 저장의 생존 개체는 보존하고 기존 보충 예약은 취소한다", () => {
  for (const version of [1, 2, 3]) {
    const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2), survivor = f.system.agents[1];
    f.system.receiveDamage(f.system.agents[0], 10000);
    const saved = JSON.parse(JSON.stringify(f.system.save())), record = saved.records[0];
    saved.version = version;
    if (version === 1) {
      delete record.regions;
      record.missingSince = 720; record.nextSpawnAt = 960;
      delete saved.agents[0].regionId;
    } else {
      record.regions[0].missingSince = 720; record.regions[0].nextSpawnAt = 960;
    }
    f.system = createEncounters(f.room, saved, []);
    assert.equal(f.system.agents[0].id, survivor.id);
    assert.equal(f.system.agents[0].health, survivor.health);
    assert.equal(f.system.save().records[0].nextSpawnAt, null);
    assert.ok(f.system.save().records[0].regions.every(region => region.nextSpawnAt === null && region.missingSince === null));
    advance(f, 36000);
    assert.deepEqual(f.system.agents.map(agent => agent.id), [survivor.id]);
  }
});

test("전멸한 종은 반복 tick에서도 시야·지형·생성 후보를 조회하지 않는다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2);
  for (const agent of [...f.system.agents]) f.system.receiveDamage(agent, agent.health);
  f.game.isVisible = () => { throw new Error("전멸 후 생성 시야 조회"); };
  Object.defineProperty(f.room.world, "terrain", { get() { throw new Error("전멸 후 지형 조회"); } });
  for (let index = 0; index < 1000; index++) advance(f, 1);
  assert.equal(f.system.agents.length, 0);
});

test("지역 저장의 중복 구역·잘못된 소속·불완전한 타이머는 거부한다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2);
  const saved = JSON.parse(JSON.stringify(f.system.save()));
  for (const mutate of [value => { value.records[0].regions[1].id = value.records[0].regions[0].id; },
    value => { value.agents[0].regionId = -1; }, value => { value.records[0].regions[0].nextSpawnAt = 960; }]) {
    const invalid = JSON.parse(JSON.stringify(saved));
    mutate(invalid);
    assert.throws(() => createEncounters(f.room, invalid, []), /중립 유닛.*지역/);
  }
});

test("유니크 6종은 후보 거점이 여러 개여도 종별 한 마리만 등장하고 사망 후 재등장하지 않는다", () => {
  for (const species of ["spring-keeper", "lantern-keeper", "old-garden-snail", "walking-forest", "white-paw", "spiny-back-leader"]) {
    const f = fixture(species, [[40, 40], [104, 40]], 2);
    assert.equal(f.system.agents.length, 1, species);
    const agent = f.system.agents[0];
    advance(f, 1200);
    assert.equal(f.system.agents[0], agent, species);
    f.system.receiveDamage(agent, agent.health);
    advance(f, 1200);
    assert.equal(f.system.agents.length, 0, species);
    assert.equal(f.system.save().records[0].dead, true, species);
    const saved = JSON.parse(JSON.stringify(f.system.save()));
    f.system = createEncounters(f.room, saved, []);
    advance(f, 1200);
    assert.equal(f.system.agents.length, 0, species);
  }
});

test("옛 저장에 남은 여러 유니크는 보존하지만 사망한 거점을 보충하지 않는다", () => {
  const f = fixture("spring-keeper", [[40, 40], [104, 40]], 2);
  const saved = JSON.parse(JSON.stringify(f.system.save())), record = saved.records[0];
  const second = { ...saved.agents[0], id: "legacy:second", regionId: record.regions[1].id, x: 104, homeX: 104 };
  saved.agents.push(second); record.regions[1].spawned = true;
  f.system = createEncounters(f.room, saved, []);
  assert.equal(f.system.agents.length, 2);
  f.system.receiveDamage(f.system.agents[0], f.system.agents[0].health);
  advance(f, 1200);
  assert.equal(f.system.agents.length, 1);
  assert.equal(f.system.agents[0].id, second.id);
  f.system = createEncounters(f.room, JSON.parse(JSON.stringify(f.system.save())), []);
  advance(f, 1200);
  assert.equal(f.system.agents.length, 1);
});

test("버전 1·2 저장의 유니크 사망 기록은 재생성 없이 보존한다", () => {
  for (const version of [1, 2]) {
    const f = fixture("spring-keeper", [[40, 40]], 1);
    f.system.receiveDamage(f.system.agents[0], 10000);
    const saved = JSON.parse(JSON.stringify(f.system.save())); saved.version = version;
    delete saved.records[0].regions;
    f.system = createEncounters(f.room, saved, []);
    advance(f, 1200);
    assert.equal(f.system.agents.length, 0);
  }
});

test("최초 유니크 등장 조건은 유지하고 사망 뒤 조건을 다시 충족해도 재등장하지 않는다", () => {
  const f = fixture("spring-keeper", [[40, 40], [104, 40]], 2);
  f.room.simSeconds = 0;
  f.system = createEncounters(f.room, null, []);
  assert.equal(f.system.agents.length, 0);
  f.game.discoveredKinds.add("creature:flower-tail-bird"); f.game.colonyFood = 10;
  advance(f, 120);
  assert.equal(f.system.agents.length, 1);
  f.system.receiveDamage(f.system.agents[0], f.system.agents[0].health);
  advance(f, 3600);
  assert.equal(f.system.agents.length, 0);
});

test("실제 맵 3개의 유니크는 종별 한 마리만 배치한다", () => {
  for (const seed of [13, 731047, 7]) {
    const world = generateWorld(seed, undefined, () => {}), room = {
      world, simSeconds: 720, colonies: [], games: new Map(), food: new Map() };
    const system = createEncounters(room, null, []);
    const uniquePlans = world.encounters.filter(plan => plan.unique), keys = new Set(uniquePlans.map(plan => plan.key));
    assert.equal(system.agents.filter(agent => keys.has(agent.species)).length,
      uniquePlans.reduce((sum, plan) => sum + plan.populationLimit, 0));
    for (const plan of uniquePlans) {
      const agents = system.agents.filter(agent => agent.species === plan.key);
      assert.equal(plan.populationLimit, 1, plan.key);
      assert.equal(agents.length, 1, plan.key);
      assert.equal(new Set(agents.map(agent => agent.regionId)).size, agents.length, plan.key);
      assert.deepEqual(agents.map(agent => agent.regionId).sort((a, b) => a - b), [...plan.spawnPoints].sort((a, b) => a - b), plan.key);
    }
  }
});

test("미등장 유니크의 조건 탐색은 매 프레임 대신 1초 간격으로 제한한다", () => {
  const f = fixture("spring-keeper", [[40, 40]], 1);
  f.room.simSeconds = 120;
  let checks = 0;
  f.game.discoveredKinds.has = () => { checks++; return false; };
  f.system = createEncounters(f.room, null, []);
  assert.equal(checks, 1);
  for (let index = 1; index <= 9; index++) { f.room.simSeconds = 120 + index / 10; f.system.tick(); }
  assert.equal(checks, 1);
  f.room.simSeconds = 121; f.system.tick();
  assert.equal(checks, 2);
});
