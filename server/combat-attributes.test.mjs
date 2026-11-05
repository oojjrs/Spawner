import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS, attributeCounts, attributeUpgradeCost, unitStats } from "./attributes.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { createGame } from "./game.mjs";

function unit(id, ownerId, keys) {
  const attributes = attributeCounts(keys);
  return { id, ownerId, tribe: "bean", combatDisposition: "aggressive", x: 100, y: 100,
    renderFromX: 100, renderFromY: 100, moveStartedAt: 0, moveDuration: 0, health: 100,
    attributes, stats: unitStats(attributes, "bean"), mode: "idle", stepCount: 0 };
}

test("채집을 겸하는 전투 속성을 포함한 속성은 고정 효과를 적용하고 강화는 제공하지 않는다", () => {
  assert.deepEqual(COMBAT_ATTRIBUTE_KEYS, ["blade", "piercing", "carapace"]);
  assert.equal(ATTRIBUTES.length, 6);
  for (const attribute of ATTRIBUTES) {
    assert.equal(attributeCounts([attribute.key])[attribute.key], 1);
    for (const level of [2, 3, 4]) assert.equal(attributeUpgradeCost(attribute.key, level), null);
  }
});

test("기본 전투력과 별도로 칼날의 공격 보너스와 관통의 갑피 무시를 적용한다", () => {
  const plain = unit("plain", "a", []), blade = unit("blade", "a", ["blade"]);
  const shell = unit("shell", "b", ["carapace"]);
  const piercer = unit("piercer", "a", ["piercing"]);
  // unitStats includes attribute strength bonuses; combatProfile removes those
  // legacy aggregate bonuses before applying each RPG attack/defense effect.
  assert.ok(combatDamage(blade, plain, .5) > combatDamage(plain, plain, .5));
  assert.equal(combatDamage(plain, blade, .5), combatDamage(plain, plain, .5));
  assert.ok(combatDamage(plain, shell, .5) < combatDamage(plain, plain, .5));
  assert.ok(combatDamage(piercer, shell, .5) > combatDamage(plain, shell, .5));
  assert.ok(combatDamage(piercer, shell, .5) < combatDamage(piercer, plain, .5));
  assert.equal(piercer.stats.armorPenetration, .5);
  assert.ok(combatDamage(plain, unit("armor", "b", ["carapace"]), .5) >= 1);
});

test("네 종족에서 고정 속성 설계·탄생·저장 복원을 지원하고 강화는 거부한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const colony = { id: 1, ownerId: tribe, tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
      colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = createGame(environment, colony); environment.games.set(tribe, game);
    game.command({ type: "cheat-evolution-points" });
    for (let level = 1; level < 4; level++) game.command({ type: "cheat-upgrade" });
    for (const attribute of ATTRIBUTES) {
      for (const [index, agent] of game.agents.entries()) {
        agent.birth = null; agent.x = 80 + index; agent.y = 80; agent.moveDuration = 0;
      }
      const result = game.command({ type: "design", templateId: null, name: attribute.name, slots: [attribute.key], birth: attribute.kind === "combat" });
      assert.ok(result.templateId);
      if (attribute.kind === "combat") assert.equal(game.agents.find(agent => agent.id === result.agentId).attributes[attribute.key], 1);
    }
    game.command({ type: "cheat-resources" });
    const blade = game.snapshot().templates.find(template => template.slots.includes("blade"));
    assert.throws(() => game.command({ type: "upgrade-attribute", templateId: blade.id, attributeKey: "blade" }), /최대/);
    const child = game.command({ type: "birth", templateId: blade.id });
    assert.equal(game.agents.find(agent => agent.id === child.agentId).stats.attackBonus, 12);
    const saved = game.save(), ids = game.agents.filter(agent => COMBAT_ATTRIBUTE_KEYS.some(key => agent.attributes[key])).map(agent => agent.id);
    game.restore(saved);
    for (const id of ids) {
      const agent = game.agents.find(agent => agent.id === id);
      assert.ok(COMBAT_ATTRIBUTE_KEYS.some(key => agent.attributes[key] >= 1));
      assert.equal(agent.stats.health, 100);
      assert.ok(agent.stats.combatStrength >= unitStats(agent.attributes, tribe).combatStrength);
      assert.ok(agent.stats.combatStrength > unitStats({}, tribe).combatStrength);
    }
  }
});

test("이전 저장의 분비 속성과 전투 강화는 제거하고 나머지 속성은 보존한다", () => {
  const colony = { id: 1, ownerId: "legacy", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony); environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save()), agent = saved.state.agents[0], slots = [...agent.slots];
  saved.state.nestLevel = 4;
  saved.state.templates.push({ id: 71, name: "기존 설계", slots: ["carapace", "guard", "regeneration", "secretion"],
    attributeLevels: { carapace: 1, guard: 1, regeneration: 1, secretion: 4 }, unlockedAttributeLevels: { carapace: 1, guard: 1, regeneration: 1, secretion: 4 } });
  agent.slots.push("secretion", "guard", "regeneration"); agent.attributeLevels.secretion = 4;
  agent.combat = { id: "legacy", x: agent.x, y: agent.y, teams: ["colony:legacy", "colony:enemy"], side: 0,
    secretionBonus: 12, secretionActive: true };
  agent.support = { kind: "secretion", combatId: "legacy", startedAt: 0, hitAt: .45, endsAt: 1.2 };
  game.restore(JSON.stringify(saved));
  const restored = game.agents.find(entry => entry.id === agent.id), template = game.snapshot().templates.find(entry => entry.id === 71);
  assert.deepEqual(restored.slots, slots);
  assert.equal(Object.hasOwn(restored.attributes, "secretion"), false);
  assert.equal(Object.hasOwn(restored.stats, "secretionBonus"), false);
  assert.equal(restored.combat, null); // Legacy support combat is discarded on restore.
  assert.equal(Object.hasOwn(restored, "support"), false);
  assert.deepEqual(template.slots, ["carapace"]);
  assert.equal(Object.hasOwn(template.attributeLevels, "secretion"), false);
  assert.equal(Object.hasOwn(template.unlockedAttributeLevels, "secretion"), false);
});
