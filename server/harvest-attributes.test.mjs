import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ATTRIBUTES, HARVEST_ATTRIBUTE_KEYS, attributeCounts, migrateAttributeSlots, migrateAttributeLevels } from "./attributes.mjs";
import { canHarvestResource, resourceHarvestMultiplier, resourceDefinition } from "./resources.mjs";
import { createGame } from "./game.mjs";
import { attributeEffect } from "../client/progression-ui.mjs";
import { codexAttributeEffect, codexAttributeDescription } from "../client/codex-content.mjs";

const groups = {
  blade: ["tree"],
  piercing: ["pebbles"]
};
const native = [["bean", "clay", null, 4], ["spore", "tree", "blade", 6],
  ["pebble", "pebbles", "piercing", 6]];

test("채집 속성은 모든 자원에 대응하며 주자원은 무속성 채집을 유지한다", () => {
  assert.deepEqual([...HARVEST_ATTRIBUTE_KEYS].sort(), Object.keys(groups).sort());
  const world = { generationVersion: 23 };
  for (const [tribe, primary] of native) for (const [key, resources] of Object.entries(groups)) {
    for (const resourceType of resources) {
      assert.equal(canHarvestResource({ resourceType }, world, {}, tribe), resourceType === primary, tribe + resourceType);
      assert.equal(canHarvestResource({ resourceType }, world, attributeCounts([key]), tribe), true, tribe + resourceType);
      for (const other of Object.keys(groups).filter(other => other !== key)) {
        assert.equal(canHarvestResource({ resourceType }, world, attributeCounts([other]), tribe), resourceType === primary, other + resourceType);
      }
    }
  }
});

test("대응 종족의 기본 자원에만 고정 채집 속도 보너스를 적용한다", () => {
  for (const [tribe, primary, nativeKey] of native) for (const [key, resources] of Object.entries(groups)) {
    const attribute = ATTRIBUTES.find(attribute => attribute.key === key);
    for (const resourceType of resources) {
      assert.equal(resourceHarvestMultiplier(resourceType, {}, tribe), 1);
      for (const [level, bonus] of [[1, .75], [2, .75], [3, .75], [4, .75]]) {
        const expected = key === nativeKey && resourceType === primary ? bonus : 1;
        assert.equal(resourceHarvestMultiplier(resourceType, { [key]: level }, tribe), expected, tribe + ":" + resourceType);
      }
    }
    for (const level of [1, 2, 3, 4]) for (const effect of [attributeEffect(attribute, level, tribe), codexAttributeEffect(attribute, level, tribe)]) {
      assert.equal(effect.includes("채집 시간"), key === nativeKey, tribe + ":" + key);
      assert.doesNotMatch(effect, /운반량/);
    }
    const description = codexAttributeDescription(attribute, tribe);
    assert.equal(description.includes("더 빠르게"), key === nativeKey, tribe + ":" + key);
    assert.doesNotMatch(description, /속성 없이|운반량/);
  }
});

test("통합한 저장 속성은 중복 슬롯을 합치고 삭제 속성과 옛 강화 단계를 정리한다", () => {
  const slots = ["botany", "blade", "mining", "piercing", "condensation", "butchery", "excavation"];
  const levels = { botany: 3, blade: 2, mining: 2, piercing: 4, condensation: 4, butchery: 2, excavation: 1 };
  assert.deepEqual(migrateAttributeSlots(slots), ["blade", "piercing"]);
  assert.deepEqual(migrateAttributeLevels(slots, levels, 4), { blade: 1, piercing: 1 });
  assert.deepEqual(migrateAttributeLevels(slots, undefined, 4), { blade: 1, piercing: 1 });
  const colony = { id: 1, ownerId: "migration", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 120, world: { generationVersion: 23, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4;
  saved.state.templates = [{ id: 99, name: "이전 설계", slots, attributeLevels: levels, unlockedAttributeLevels: levels, revision: 1 }];
  Object.assign(saved.state.agents[0], { slots, attributeLevels: levels });
  game.restore(JSON.stringify(saved));
  const template = game.snapshot().templates[0];
  assert.deepEqual(template.slots, ["blade", "piercing"]);
  assert.deepEqual(template.attributeLevels, { blade: 1, piercing: 1 });
  assert.deepEqual(template.unlockedAttributeLevels, template.attributeLevels);
  assert.deepEqual(game.agents[0].slots, template.slots);
  assert.equal(game.agents[0].attributes.blade, 1);
  assert.equal(game.agents[0].attributes.piercing, 1);
  assert.equal(Object.hasOwn(game.agents[0].attributes, "butchery"), false);
});

function harvesting(tribe, resourceType, slots) {
  const colony = { id: 1, ownerId: "harvest", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const food = { x: 46, y: 42, amount: 12, initialAmount: 12, resourceType, kind: "resource", terrain: resourceType === "tree" ? "forest" : "grassland" };
  const environment = { simSeconds: 120, world: { generationVersion: 23, terrain: new Uint8Array(320 * 320).fill(4),
    hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map([["46,42", food]]), foodSpots: new Map() };
  if (resourceType === "tree") environment.world.terrain[42 * 320 + 46] = 5;
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents.splice(1);
  saved.state.nestLevel = 4;
  Object.assign(saved.state.agents[0], { x: 46, y: 42, renderFromX: 46, renderFromY: 42, slots, attributeLevels: {},
    bornAt: 120, birth: null, mode: "approach", moveStartedAt: 0, moveDuration: 0, moveBudget: 0,
    carrying: 0, carryingType: null, growthActivity: 0, harvestResult: null, decisionPending: null, nextDecisionAt: 1000,
    utility: { action: "collect", target: { x: 46, y: 42, key: "46,42" }, route: [{ x: 46, y: 42 }], plannedCargo: 1 } });
  game.restore(JSON.stringify(saved));
  return { environment, game, food, agent: game.agents[0] };
}

function tick(fixture, time) {
  const elapsed = time - fixture.environment.simSeconds;
  fixture.environment.simSeconds = time;
  fixture.game.prepare(time);
  fixture.game.tick(elapsed);
}

test("실제 게임에서 종족 모두 기본 채집이 되고 대응 속성은 첫 채집부터 빨라진다", () => {
  for (const [tribe, resourceType, key, seconds] of native) for (const slots of (key ? [[], [key]] : [[]])) {
    const f = harvesting(tribe, resourceType, slots);
    tick(f, 120);
    assert.equal(f.agent.mode, "harvest", tribe);
    tick(f, 121);
    const duration = seconds * (slots.length ? .75 : 1);
    assert.ok(Math.abs(f.agent.harvestReady - (121 + duration)) < 1e-9, tribe);
    tick(f, 121 + duration - .001);
    assert.equal(f.agent.carrying, 0, tribe);
    tick(f, 121 + duration + .001);
    assert.equal(f.agent.carrying, 1, tribe);
    assert.equal(f.agent.carryingType, resourceType, tribe);
    assert.equal(f.food.amount, 11, tribe);
  }
});

test("추가 해금 자원과 다른 종족의 자원은 실제 게임에서도 정해진 시간에 채집한다", () => {
  for (const [tribe, primary] of native) for (const [key, resources] of Object.entries(groups)) for (const resourceType of resources) {
    if (resourceType === primary) continue;
    const f = harvesting(tribe, resourceType, [key]);
    tick(f, 120);
    assert.equal(f.agent.mode, "harvest", tribe + ":" + resourceType);
    tick(f, 121);
    assert.equal(f.agent.harvestReady, 121 + resourceDefinition(resourceType).harvestSeconds, tribe + ":" + resourceType);
  }
});

test("브라우저와 내장 워커가 속성의 채집 권한과 1레벨 보너스를 공유한다", () => {
  const source = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
  const browser = {};
  runInNewContext(source, browser);
  const workerSource = JSON.parse(source.match(/const workerSource = ("[^\r\n]+");/)[1]);
  const worker = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(workerSource.slice(0, workerSource.indexOf('modules["client/worker.mjs"]')) +
    'globalThis.rules = modules["server/resources.mjs"]; })();', worker);
  for (const rules of [browser.Spawner, worker.rules]) for (const [tribe, resourceType, key] of native) {
    assert.equal(rules.canHarvestResource({ resourceType }, { generationVersion: 23 }, {}, tribe), true);
    assert.equal(rules.resourceHarvestMultiplier(resourceType, {}, tribe), 1);
    assert.equal(rules.resourceHarvestMultiplier(resourceType, { [key]: 1 }, tribe), key ? .75 : 1);
    for (const [other, resources] of Object.entries(groups)) for (const type of resources) {
      assert.equal(rules.canHarvestResource({ resourceType: type }, { generationVersion: 23 }, { [other]: 1 }, tribe), true);
      assert.equal(rules.resourceHarvestMultiplier(type, { [other]: 1 }, tribe), type === resourceType && other === key ? .75 : 1);
    }
  }
});
