import test from "node:test";
import assert from "node:assert/strict";
import { createEncounters } from "./encounters.mjs";
import { createUtilityAI } from "./utility.mjs";

function fixture(species, radius) {
  const cells = [];
  for (let y = 70; y <= 130; y++) for (let x = 70; x <= 140; x++) cells.push(y * 320 + x);
  const player = { id: "player", ownerId: "test", x: 114, y: 100, health: 100,
    attributes: {}, stats: { health: 100, combatStrength: 20, attack: 1, speed: 1 }, moveStartedAt: 0, moveDuration: 0 };
  const game = { agents: [], discoveredKinds: new Set(), colonyFood: 0, isVisible: () => false,
    receiveDamage(agent, amount) { agent.health -= amount; } };
  const room = { simSeconds: 720, colonies: [], games: new Map([["test", game]]), food: new Map(), world: {
    terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320), encounters: [
      { key: species, x: 100, y: 100, radius, safeRadius: 0, terrains: [4], nearWater: false,
        cells, route: [], spawnPoints: [32100], populationLimit: 1, homeId: null }
    ] } };
  const system = createEncounters(room, null, []), result = { room, system, player, game, agent: system.agents[0] };
  room.creatureSystem = { get agents() { return result.system.agents; }, burrowAt() { return null; } };
  assert.ok(result.agent);
  return result;
}

function advance(fixture, seconds) {
  for (let step = 0; step < seconds * 4; step++) {
    fixture.room.simSeconds += .25;
    fixture.system.tick();
  }
}

function position(fixture, x, y) {
  Object.assign(fixture.agent, { x, y, renderFromX: x, renderFromY: y, moveStartedAt: fixture.room.simSeconds,
    moveDuration: 0, nextActionAt: fixture.room.simSeconds, mode: "idle" });
}

test("선공 야생종 8종은 표적이 없으면 각 출생지의 4칸 안에서만 배회한다", () => {
  for (const [species, radius] of [["soil-boar", 14], ["bubble-toad", 10], ["vine-turtle", 4], ["shadow-weasel", 18],
    ["snare-vine", 4], ["talon-owl", 22], ["white-paw", 24], ["spiny-back-leader", 16]]) {
    const f = fixture(species, radius);
    for (let tick = 0; tick < 240; tick++) {
      advance(f, .25);
      assert.ok(Math.hypot(f.agent.x - 100, f.agent.y - 100) <= 4, species);
    }
  }
});

test("멧돼지는 감지 4칸 안의 목표를 추격하고 출생지 6칸 밖으로 나가면 귀환을 마칠 때까지 재추격하지 않는다", () => {
  const f = fixture("soil-boar", 14);
  position(f, 105, 100);
  f.player.x = 106;
  f.game.agents.push(f.player);
  f.system.tick();
  advance(f, 1);
  assert.equal(f.agent.x, 106);
  f.player.x = 107;
  advance(f, 2);
  assert.equal(f.agent.returningHome, true);
  assert.equal(f.agent.x, 105);
  Object.assign(f.player, { x: 104, y: 102 });
  advance(f, 2);
  assert.equal(f.agent.x, 104);
  for (let tick = 0; tick < 160 && f.agent.returningHome; tick++) advance(f, .25);
  assert.equal(f.agent.returningHome, false);
  assert.ok(Math.hypot(f.agent.x - 100, f.agent.y - 100) <= 4);
});

test("이전 저장에서 영역 밖에 있는 개체는 걸어서 귀환하며 저장·복원 후에도 귀환을 이어간다", () => {
  const f = fixture("soil-boar", 14);
  position(f, 120, 100);
  f.system.tick();
  assert.equal(f.agent.x, 119);
  assert.equal(f.agent.returningHome, true);
  f.agent.stats.vision = 24;
  const saved = JSON.parse(JSON.stringify(f.system.save()));
  f.system = createEncounters(f.room, saved, []);
  f.agent = f.system.agents[0];
  assert.equal(f.agent.x, 119);
  assert.equal(f.agent.returningHome, true);
  assert.equal(f.agent.stats.vision, 4);
  for (let tick = 0; tick < 240 && f.agent.returningHome; tick++) advance(f, .25);
  assert.equal(f.agent.returningHome, false);
  assert.ok(Math.hypot(f.agent.x - 100, f.agent.y - 100) <= 4);
});

test("평화형 동물 6종과 비선공 유니크 4종은 기존 배회·대기 동작을 유지한다", () => {
  for (const [species, radius] of [["flower-tail-bird", 10], ["dew-rabbit", 8], ["soil-mole", 6], ["bundle-snail", 3],
    ["cotton-sheep", 12], ["rolling-acorn", 10], ["spring-keeper", 12], ["lantern-keeper", 10],
    ["old-garden-snail", 4], ["walking-forest", 5]]) {
    const f = fixture(species, radius);
    position(f, 110, 100);
    f.agent.stepCount = 2;
    f.system.tick();
    assert.equal(f.agent.x, 110, species);
    assert.equal(f.agent.y, ["soil-mole", "rolling-acorn"].includes(species) ? 100 : 99, species);
    assert.equal(f.agent.returningHome, undefined, species);
    assert.equal(f.agent.stats.vision, radius, species);
  }
});

function decisions(x, species) {
  const agent = { id: "unit", ownerId: "test", x, y: 100, health: 100, cost: 3, slots: [], carrying: 0, visited: new Set([x + ",100"]),
    personality: { boldness: 0, aggression: 0, curiosity: 0 },
    stats: { health: 100, combatStrength: 20, attack: 1, speed: 1, vision: 3, capacity: 1, resistance: 1 } };
  const enemy = { id: "wild", species, x: x - 1, y: 100, homeX: 100, homeY: 100, health: 100,
    stats: { health: 100, combatStrength: 36, attack: 1, speed: .5 } };
  const explored = new Set();
  for (let y = 95; y <= 105; y++) for (let cx = 95; cx <= 125; cx++) explored.add(y * 320 + cx);
  const state = { simSeconds: 0, nestLevel: 1, evolutionPoints: 0, agents: [agent], knownFood: new Map(), markers: [], explored };
  return createUtilityAI({ state, size: 320, homeCells: () => [{ x: 100, y: 100 }], deliveryCells: () => [{ x: 100, y: 100 }],
    walkable: () => true, hazardAt: () => 0, enemies: () => [enemy], synergy: () => false, canHarvest: () => true }).evaluate(agent, false);
}

test("아군은 멧돼지의 6칸 추격 경계 안은 위험으로 보고 경계 밖은 안전 후보로 판단한다", () => {
  assert.ok(decisions(106, "soil-boar").some(candidate => candidate.action === "flee"));
  assert.ok(!decisions(107, "soil-boar").some(candidate => candidate.action === "flee"));
  assert.ok(!decisions(110, "spiny-back-beetle").some(candidate => candidate.action === "flee"));
  assert.ok(!decisions(110, "flower-tail-bird").some(candidate => candidate.action === "flee"));
  assert.ok(!decisions(110, "spring-keeper").some(candidate => candidate.action === "flee"));
});

test("선공종의 감지는 축소한 별도 수치를 적용하고 이전 맵의 넓은 반경을 사용하지 않는다", () => {
  for (const [species, radius, detection] of [["soil-boar", 14, 4], ["bubble-toad", 10, 3], ["vine-turtle", 4, 3],
    ["shadow-weasel", 18, 5], ["snare-vine", 4, 2], ["talon-owl", 22, 6], ["white-paw", 24, 6], ["spiny-back-leader", 16, 5]]) {
    const f = fixture(species, radius);
    assert.equal(f.agent.stats.vision, detection, species);
  }
  for (const [species, radius, detection] of [["soil-boar", 14, 4], ["white-paw", 24, 6]]) {
    const f = fixture(species, radius);
    f.player.x = 100 + detection + 1;
    f.game.agents.push(f.player);
    f.system.tick();
    assert.equal(f.agent.x, 99, species);
    assert.equal(f.agent.warningUntil, null, species);
    position(f, 100, 100);
    f.player.x = 100 + detection;
    f.system.tick();
    if (species === "soil-boar") advance(f, 1);
    assert.equal(f.agent.x, 101, species);
  }
});
