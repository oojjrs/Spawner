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

test("서쪽 구역에서 죽은 개체는 4분 대기 후 같은 구역에서만 보충한다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2), [west, east] = f.system.agents;
  f.system.receiveDamage(west, 1000);
  advance(f, 239.999);
  assert.equal(f.system.agents.length, 1);
  advance(f, .001);
  assert.equal(f.system.agents.length, 2);
  const replacement = f.system.agents.find(agent => agent.id !== east.id);
  assert.notEqual(replacement.id, west.id);
  assert.equal(replacement.regionId, west.regionId);
  assert.ok(replacement.homeX >= 32 && replacement.homeX < 48 && replacement.homeY >= 32 && replacement.homeY < 48);
  assert.equal(f.system.agents.find(agent => agent.id === east.id), east);
});

test("두 구역의 사망 시각과 재생성 타이머는 각각 독립적으로 유지한다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2), [west, east] = f.system.agents;
  f.system.receiveDamage(west, 1000);
  advance(f, 120);
  f.system.receiveDamage(east, 1000);
  advance(f, 120);
  assert.equal(count(f, west.regionId), 1);
  assert.equal(count(f, east.regionId), 0);
  advance(f, 119.999);
  assert.equal(count(f, east.regionId), 0);
  advance(f, .001);
  assert.equal(count(f, east.regionId), 1);
});

test("같은 구역에서 여러 개체가 죽으면 목표 수까지 기존 간격으로 한 마리씩 보충한다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [44, 40], [104, 40]], 3);
  const west = f.system.agents.filter(agent => agent.homeX < 48), east = f.system.agents.find(agent => agent.homeX > 96);
  assert.equal(west.length, 2);
  for (const agent of west) f.system.receiveDamage(agent, 1000);
  advance(f, 240);
  assert.equal(count(f, west[0].regionId), 1);
  advance(f, 0);
  assert.equal(count(f, west[0].regionId), 1);
  advance(f, 240);
  assert.equal(count(f, west[0].regionId), 2);
  assert.equal(count(f, east.regionId), 1);
  assert.equal(f.system.agents.length, 3);
});

test("시야에 보이거나 생성 자리가 막힌 구역은 기다리고 다른 구역으로 보충을 넘기지 않는다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2), [west, east] = f.system.agents;
  for (const agent of [...f.system.agents]) f.system.receiveDamage(agent, 1000);
  f.game.isVisible = x => x < 64;
  advance(f, 240);
  assert.equal(count(f, west.regionId), 0);
  assert.equal(count(f, east.regionId), 1);
  f.game.isVisible = () => false;
  for (let y = 32; y < 48; y++) for (let x = 32; x < 48; x++) f.room.world.terrain[y * 320 + x] = 0;
  advance(f, .25);
  assert.equal(count(f, west.regionId), 0);
  assert.equal(count(f, east.regionId), 1);
  f.room.world.terrain[41 * 320 + 40] = 4;
  advance(f, .25);
  assert.equal(count(f, west.regionId), 1);
  const replacement = f.system.agents.find(agent => agent.regionId === west.regionId);
  assert.deepEqual([replacement.homeX, replacement.homeY], [40, 41]);
});

test("지역별 대기 시간을 저장·복원해도 새로 시작하거나 즉시 보충하지 않는다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40]], 2), west = f.system.agents[0];
  f.system.receiveDamage(west, 1000);
  advance(f, 90);
  const saved = JSON.parse(JSON.stringify(f.system.save()));
  f.system = createEncounters(f.room, saved, []);
  assert.equal(f.system.save().version, 3);
  assert.deepEqual(f.system.save(), saved);
  advance(f, 149.999);
  assert.equal(count(f, west.regionId), 0);
  advance(f, .001);
  assert.equal(count(f, west.regionId), 1);
});

test("버전 1 저장의 살아 있는 개체와 기존 대기를 보존하며 중복 출생지는 가까운 빈 소속 구역에 배분한다", () => {
  const f = fixture("dew-rabbit", [[40, 40], [104, 40], [168, 40]], 3);
  f.system.receiveDamage(f.system.agents[2], 1000);
  const saved = JSON.parse(JSON.stringify(f.system.save()));
  saved.version = 1;
  const record = saved.records[0];
  delete record.regions;
  record.missingSince = 720; record.nextSpawnAt = 960;
  for (const agent of saved.agents) { delete agent.regionId; agent.homeX = 40; agent.homeY = 40; }
  const expected = JSON.parse(JSON.stringify(saved.agents));
  f.system = createEncounters(f.room, saved, []);
  assert.equal(f.system.save().version, 3);
  assert.deepEqual(f.system.agents.map(({ regionId, ...agent }) => agent), expected);
  assert.equal(new Set(f.system.agents.map(agent => agent.regionId)).size, 2);
  advance(f, 239.999);
  assert.equal(f.system.agents.length, 2);
  advance(f, .001);
  assert.equal(f.system.agents.length, 3);
  const replacement = f.system.agents.find(agent => !expected.some(before => before.id === agent.id));
  assert.ok(replacement.homeX >= 160 && replacement.homeX < 176);
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
    f.system.receiveDamage(agent, 1000);
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
  f.system.receiveDamage(f.system.agents[0], 1000);
  advance(f, 1200);
  assert.equal(f.system.agents.length, 1);
  assert.equal(f.system.agents[0].id, second.id);
  f.system = createEncounters(f.room, JSON.parse(JSON.stringify(f.system.save())), []);
  advance(f, 1200);
  assert.equal(f.system.agents.length, 1);
});

test("버전 1·2 저장의 유니크 사망 기록과 일반종의 남은 보충 시간을 보존한다", () => {
  for (const version of [1, 2]) {
    const f = fixture("spring-keeper", [[40, 40]], 1);
    f.system.receiveDamage(f.system.agents[0], 1000);
    const saved = JSON.parse(JSON.stringify(f.system.save())); saved.version = version;
    delete saved.records[0].regions;
    f.system = createEncounters(f.room, saved, []);
    advance(f, 1200);
    assert.equal(f.system.agents.length, 0);
  }
  const f = fixture("dew-rabbit", [[40, 40]], 1);
  f.system.receiveDamage(f.system.agents[0], 1000);
  advance(f, 60);
  const saved = JSON.parse(JSON.stringify(f.system.save())); saved.version = 2;
  assert.equal(saved.records[0].regions[0].nextSpawnAt, 960);
  f.system = createEncounters(f.room, saved, []);
  assert.equal(f.system.save().records[0].regions[0].nextSpawnAt, 960);
  advance(f, 179.999);
  assert.equal(f.system.agents.length, 0);
  advance(f, .001);
  assert.equal(f.system.agents.length, 1);
});

test("최초 유니크 등장 조건은 유지하고 사망 뒤 조건을 다시 충족해도 재등장하지 않는다", () => {
  const f = fixture("spring-keeper", [[40, 40], [104, 40]], 2);
  f.room.simSeconds = 0;
  f.system = createEncounters(f.room, null, []);
  assert.equal(f.system.agents.length, 0);
  f.game.discoveredKinds.add("creature:flower-tail-bird"); f.game.colonyFood = 10;
  advance(f, 0);
  assert.equal(f.system.agents.length, 1);
  f.system.receiveDamage(f.system.agents[0], 1000);
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
