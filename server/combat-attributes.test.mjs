import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS, attributeCounts, attributeUpgradeCost, unitStats } from "./attributes.mjs";
import { combatDamage, combatStrength } from "./combat-stats.mjs";
import { createCombat } from "./combat.mjs";
import { createGame } from "./game.mjs";

function unit(id, ownerId, keys, levels) {
  const attributes = attributeCounts(keys, levels);
  return { id, ownerId, tribe: "bean", combatDisposition: "aggressive", x: 100, y: 100,
    renderFromX: 100, renderFromY: 100, moveStartedAt: 0, moveDuration: 0, health: 100,
    attributes, stats: unitStats(attributes, "bean"), mode: "idle", stepCount: 0 };
}

function battle(units) {
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    combatRandom: () => .99, damageRandom: () => .5 };
  for (const owner of new Set(units.map(agent => agent.ownerId))) environment.games.set(owner, {
    agents: units.filter(agent => agent.ownerId === owner),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); agent.hurtStartedAt = environment.simSeconds; }
  });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) environment.world.terrain[(100 + dy) * 320 + 100 + dx] = 0;
  const combat = createCombat(environment);
  return { combat, tick(time) {
    environment.simSeconds = time;
    for (const agent of units) if (agent.health > 0) combat.update(agent, time);
  } };
}

test("채집을 겸하는 전투 속성을 포함한 13종의 장착·강화 데이터를 제공한다", () => {
  assert.deepEqual(COMBAT_ATTRIBUTE_KEYS, ["blade", "piercing", "carapace", "guard", "regeneration", "secretion"]);
  assert.equal(ATTRIBUTES.length, 13);
  for (const attribute of ATTRIBUTES) {
    assert.equal(attributeCounts([attribute.key])[attribute.key], 1);
    for (const level of [2, 3, 4]) assert.ok(attributeUpgradeCost(attribute.key, level));
  }
});

test("칼날은 공격만 강화하고 관통은 갑피만 무시한다", () => {
  const plain = unit("plain", "a", [], {}), blade = unit("blade", "a", ["blade"], { blade: 4 });
  const shell = unit("shell", "b", ["carapace"], { carapace: 4 });
  const piercer = unit("piercer", "a", ["piercing"], { piercing: 4 });
  assert.ok(combatDamage(blade, plain, .5) > combatDamage(plain, plain, .5));
  assert.equal(combatDamage(plain, blade, .5), combatDamage(plain, plain, .5));
  assert.ok(combatDamage(plain, shell, .5) < combatDamage(plain, plain, .5));
  assert.equal(combatDamage(piercer, shell, .5), combatDamage(plain, plain, .5));
  shell.stats.guardProtection = .4;
  assert.ok(combatDamage(piercer, shell, .5) < combatDamage(plain, plain, .5));
  for (const level of [1, 2, 3, 4]) assert.ok(combatDamage(plain, unit("armor", "b", ["carapace"], { carapace: level }), .5) >= 1);
});

test("엄호는 같은 칸 아군에 가장 높은 단계만 적용하고 이탈하면 해제된다", () => {
  const strong = unit("a", "a", ["guard"], { guard: 3 }), weak = unit("b", "a", ["guard"], { guard: 1 });
  const ally = unit("c", "a", [], {}), enemy = unit("enemy", "b", [], {});
  const room = battle([strong, weak, ally, enemy]);
  assert.ok(room.combat.engage(strong, enemy, 0));
  room.tick(0);
  assert.ok(Math.abs(ally.combat.guardProtection - .42) < 1e-8);
  assert.equal(enemy.combat.guardProtection, 0);
  room.combat.release(strong, .1); strong.x = 102;
  room.tick(.1);
  assert.equal(ally.combat.guardProtection, .35);
});

test("재생은 가장 다친 아군을 한 번 치유하고 공격 차례를 소비한다", () => {
  const healer = unit("a", "a", ["regeneration"], { regeneration: 2 });
  const ally = unit("wounded", "a", [], {}), enemy = unit("enemy", "b", [], {});
  ally.health = 40;
  const room = battle([healer, ally, enemy]);
  assert.ok(room.combat.engage(healer, enemy, 0));
  room.tick(0);
  assert.equal(healer.support.kind, "heal");
  assert.equal(healer.support.targetId, ally.id);
  assert.equal(healer.attack, null);
  room.tick(.45);
  assert.equal(ally.health, 64);
  room.tick(.45);
  assert.equal(ally.health, 64);
  assert.equal(enemy.health, 100);
});

test("분비는 지원 차례 후 아군만 강화하고 중첩·재적용 없이 전투 종료에 해제된다", () => {
  const source = unit("a", "a", ["secretion"], { secretion: 2 });
  const ally = unit("ally", "a", ["secretion"], { secretion: 1 }), enemy = unit("enemy", "b", [], {});
  const room = battle([source, ally, enemy]);
  room.combat.engage(source, enemy, 0); room.tick(0);
  assert.equal(source.support.kind, "secretion");
  room.tick(.45);
  assert.equal(ally.combat.secretionBonus, 10);
  assert.equal(combatStrength(ally), 30);
  assert.equal(enemy.combat.secretionBonus, 0);
  room.tick(.45);
  assert.equal(combatStrength(ally), 30);
  room.combat.release(ally, 1);
  assert.equal(combatStrength(ally), 20);
  assert.equal(ally.support, null);
});

test("네 종족에서 전투 설계·탄생·강화·저장 복원을 지원한다", () => {
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
    const withLab = JSON.parse(game.save());
    withLab.state.buildings.push({ id: 1, key: "evolution-lab", x: 47, y: 47, health: 100 });
    game.restore(JSON.stringify(withLab));
    const blade = game.snapshot().templates.find(template => template.slots.includes("blade"));
    game.command({ type: "upgrade-attribute", templateId: blade.id, attributeKey: "blade" });
    const improved = game.command({ type: "birth", templateId: blade.id });
    assert.equal(game.agents.find(agent => agent.id === improved.agentId).stats.attackBonus, 15);
    const healer = game.agents.find(agent => agent.attributes.regeneration);
    healer.health = 50;
    game.prepare(20); game.tick(1);
    assert.ok(healer.health >= 52 && healer.health <= healer.stats.health);
    const saved = game.save(), ids = game.agents.filter(agent => COMBAT_ATTRIBUTE_KEYS.some(key => agent.attributes[key])).map(agent => agent.id);
    game.restore(saved);
    for (const id of ids) {
      const agent = game.agents.find(agent => agent.id === id);
      assert.ok(COMBAT_ATTRIBUTE_KEYS.some(key => agent.attributes[key] >= 1));
      assert.equal(agent.stats.health, 100);
    }
  }
});

test("재생은 자신의 치유량과 아군 치유량을 구분한다", () => {
  const healer = unit("self", "a", ["regeneration"], { regeneration: 1 });
  const enemy = unit("enemy", "b", [], {});
  healer.health = 40;
  const room = battle([healer, enemy]);
  assert.ok(room.combat.engage(healer, enemy, 0));
  room.tick(0);
  assert.equal(healer.support.targetId, healer.id);
  room.tick(.45);
  assert.equal(healer.health, 50);
});
