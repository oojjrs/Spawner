import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS, attributeCounts, attributeUpgradeCost, unitStats } from "./attributes.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { createCombat } from "./combat.mjs";
import { createGame } from "./game.mjs";

function unit(id, ownerId, keys) {
  const attributes = attributeCounts(keys);
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

test("채집을 겸하는 전투 속성을 포함한 12종의 속성은 고정 효과를 적용하고 강화는 제공하지 않는다", () => {
  assert.deepEqual(COMBAT_ATTRIBUTE_KEYS, ["blade", "piercing", "carapace", "guard", "regeneration"]);
  assert.equal(ATTRIBUTES.length, 12);
  for (const attribute of ATTRIBUTES) {
    assert.equal(attributeCounts([attribute.key])[attribute.key], 1);
    for (const level of [2, 3, 4]) assert.equal(attributeUpgradeCost(attribute.key, level), null);
  }
});

test("칼날은 공격만 강화하고 관통은 갑피만 무시한다", () => {
  const plain = unit("plain", "a", []), blade = unit("blade", "a", ["blade"]);
  const shell = unit("shell", "b", ["carapace"]);
  const piercer = unit("piercer", "a", ["piercing"]);
  assert.ok(combatDamage(blade, plain, .5) > combatDamage(plain, plain, .5));
  assert.equal(combatDamage(plain, blade, .5), combatDamage(plain, plain, .5));
  assert.ok(combatDamage(plain, shell, .5) < combatDamage(plain, plain, .5));
  assert.ok(combatDamage(piercer, shell, .5) > combatDamage(plain, shell, .5));
  assert.ok(combatDamage(piercer, shell, .5) < combatDamage(plain, plain, .5));
  assert.equal(piercer.stats.armorPenetration, .5);
  shell.stats.guardProtection = .4;
  assert.ok(combatDamage(piercer, shell, .5) < combatDamage(plain, plain, .5));
  assert.ok(combatDamage(plain, unit("armor", "b", ["carapace"]), .5) >= 1);
});

test("엄호는 같은 칸 아군에게 중첩되지 않고 마지막 시전자가 이탈하면 해제된다", () => {
  const first = unit("a", "a", ["guard"]), second = unit("b", "a", ["guard"]);
  const ally = unit("c", "a", []), enemy = unit("enemy", "b", []);
  const room = battle([first, second, ally, enemy]);
  assert.ok(room.combat.engage(first, enemy, 0));
  room.tick(0);
  assert.ok(Math.abs(ally.combat.guardProtection - .35) < 1e-8);
  assert.equal(enemy.combat.guardProtection, 0);
  room.combat.release(first, .1); first.x = 102;
  room.tick(.1);
  assert.equal(ally.combat.guardProtection, .35);
  room.combat.release(second, .2); second.x = 102;
  room.tick(.2);
  assert.equal(ally.combat.guardProtection, 0);
});

test("재생은 전투 중 아군을 치유하지 않고 공격 차례를 진행한다", () => {
  const healer = unit("a", "a", ["regeneration"]);
  const ally = unit("wounded", "a", []), enemy = unit("enemy", "b", []);
  ally.health = 40;
  const room = battle([healer, ally, enemy]);
  assert.ok(room.combat.engage(healer, enemy, 0));
  room.tick(0);
  assert.equal(healer.support, null);
  assert.ok(healer.attack);
  room.tick(.45);
  assert.equal(ally.health, 40);
});

test("재생은 전투 밖에서 가장 다친 아군만 한 번 치유한다", () => {
  const healer = unit("a", "a", ["regeneration"]);
  const ally = unit("wounded", "a", []), other = unit("other", "a", []);
  ally.health = 40; other.health = 60;
  const room = battle([healer, ally, other]);
  const recovered = ally.health + healer.stats.healing;
  room.tick(0);
  assert.equal(healer.support.kind, "heal");
  assert.equal(healer.support.targetId, ally.id);
  room.tick(.45);
  assert.equal(ally.health, recovered);
  assert.equal(other.health, 60);
  room.tick(.45);
  assert.equal(ally.health, recovered);
});

test("시전자나 대상이 전투에 들어가면 진행 중인 치유를 중단한다", () => {
  for (const engaged of ["healer", "target"]) {
    const healer = unit("a", "a", ["regeneration"]);
    const ally = unit("wounded", "a", []), enemy = unit("enemy", "b", []);
    ally.health = 40; enemy.x = 102;
    const room = battle([healer, ally, enemy]);
    room.tick(0);
    assert.ok(healer.support);
    if (engaged === "healer") {
      enemy.x = 100;
      room.combat.engage(healer, enemy, .2);
    } else ally.combat = { id: "other", teams: ["colony:a", "colony:b"], side: 0 };
    if (engaged === "target") healer.combatDisposition = "peaceful";
    room.combat.update(healer, .45);
    assert.equal(healer.support, null);
    assert.equal(ally.health, 40);
  }
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
    const withLab = JSON.parse(game.save());
    withLab.state.buildings.push({ id: 1, key: "evolution-lab", x: 47, y: 47, health: 100 });
    game.restore(JSON.stringify(withLab));
    const blade = game.snapshot().templates.find(template => template.slots.includes("blade"));
    assert.throws(() => game.command({ type: "upgrade-attribute", templateId: blade.id, attributeKey: "blade" }), /최대/);
    const child = game.command({ type: "birth", templateId: blade.id });
    assert.equal(game.agents.find(agent => agent.id === child.agentId).stats.attackBonus, 12);
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

test("이전 저장의 분비 속성과 전투 강화는 제거하고 나머지 속성은 보존한다", () => {
  const colony = { id: 1, ownerId: "legacy", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony); environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save()), agent = saved.state.agents[0], slots = [...agent.slots];
  saved.state.nestLevel = 4;
  saved.state.templates.push({ id: 71, name: "기존 설계", slots: ["guard", "secretion"],
    attributeLevels: { guard: 1, secretion: 4 }, unlockedAttributeLevels: { guard: 1, secretion: 4 } });
  agent.slots.push("secretion"); agent.attributeLevels.secretion = 4;
  agent.combat = { id: "legacy", x: agent.x, y: agent.y, teams: ["colony:legacy", "colony:enemy"], side: 0,
    secretionBonus: 12, secretionActive: true };
  agent.support = { kind: "secretion", combatId: "legacy", startedAt: 0, hitAt: .45, endsAt: 1.2 };
  game.restore(JSON.stringify(saved));
  const restored = game.agents.find(entry => entry.id === agent.id), template = game.snapshot().templates.find(entry => entry.id === 71);
  assert.deepEqual(restored.slots, slots);
  assert.equal(Object.hasOwn(restored.attributes, "secretion"), false);
  assert.equal(Object.hasOwn(restored.stats, "secretionBonus"), false);
  assert.equal(Object.hasOwn(restored.combat, "secretionBonus"), false);
  assert.equal(Object.hasOwn(restored.combat, "secretionActive"), false);
  assert.equal(restored.support, null);
  assert.deepEqual(template.slots, ["guard"]);
  assert.equal(Object.hasOwn(template.attributeLevels, "secretion"), false);
  assert.equal(Object.hasOwn(template.unlockedAttributeLevels, "secretion"), false);
});
