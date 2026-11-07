import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { combatProfile, unitCombatStats } from "./combat-stats.mjs";
import { combatPositionRadius } from "./combat-position.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";

function fixture(options) {
  const dna = { ...ATTRIBUTE_DNA.stats([]), melee: options.mode === "melee", ranged: options.mode === "ranged",
    meleePower: 10, rangedPower: 10, power: 10, meleeSpeed: .5, rangedSpeed: .5,
    focus: .3, hits: 1, comboSpeed: .12, comboPower: 100, counter: 0, critical: 0 };
  const source = { id: "a", ownerId: "left", tribe: "bean", x: 100, y: 100, health: 10000,
    stats: { health: 10000, speed: 1, vision: 3, dna: { ...dna, ...options.source } },
    attributes: {}, combatDisposition: "aggressive", moveDuration: 0, attackReady: 0 };
  const target = { id: "b", ownerId: "right", tribe: "bean", x: options.world ? 102 : 100, y: 100, health: 10000,
    stats: { health: 10000, speed: 1, vision: 3 }, attributes: {}, combatDisposition: "aggressive", moveDuration: 0,
    attackReady: options.active ? 0 : 10 };
  const reaction = options.reaction;
  if (options.type === "dna") target.stats.dna = { ...dna, evasion: reaction === "miss" ? 100 : 0,
    parry: reaction === "parry" ? 100 : 0, block: reaction === "block" ? 100 : 0, blockPower: 100, ...options.target };
  else if (options.type === "native") {
    target.species = options.mode === "ranged" ? "lantern-keeper" : "vine-turtle";
    target.stats = { ...unitCombatStats(target.species), ...target.stats, evasion: reaction === "miss" ? 1 : 0,
      parry: reaction === "parry" ? 1 : 0, block: reaction === "block" ? 1 : 0, blockReduction: 1, criticalChance: 0 };
  } else target.attributes[reaction === "parry" ? "blade" : "carapace"] = 1;
  const events = [], environment = { games: new Map(), colonies: [], simSeconds: 0, combatSimulation: true,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, damageRandom: () => .5, combatRandom: () => .01,
    onCombatEvent(event) { events.push(event); } };
  for (const agent of [source, target]) environment.games.set(agent.ownerId, { agents: [agent],
    receiveDamage(unit, amount) { unit.health = Math.max(0, unit.health - amount); } });
  const combat = createCombat(environment);
  if (!options.world) {
    assert.ok(combat.engage(source, target, 0));
    const separation = combatPositionRadius(source) + combatPositionRadius(target) + (options.mode === "ranged" ? 2.3 : .5);
    for (const [index, agent] of [source, target].entries()) Object.assign(agent.combat.position,
      { x: index ? separation : 0, y: 0, fromX: index ? separation : 0, fromY: 0 });
  }
  if (options.type === "legacy" && reaction === "parry") (target.combat || target).parryUntil = 10;
  const tick = time => { environment.simSeconds = time; combat.update(source, time); combat.update(target, time); };
  return { source, target, events, tick };
}

for (const type of ["dna", "native", "legacy"]) for (const reaction of ["parry", "block"])
  test(type + " " + reaction + " immediately clears idle attack wait and then restores the full interval", () => {
    const f = fixture({ type, reaction, mode: "melee" }); f.tick(0); f.tick(.3);
    const defense = f.events.find(event => event.sourceId === "a" && event.kind === reaction);
    assert.ok(defense); assert.equal(f.target.attack.startedAt, defense.at);
    assert.equal(defense.amount === 0, reaction === "parry");
    const attack = f.target.attack, interval = combatProfile(f.target).attackInterval;
    assert.ok(Math.abs(f.target.attackReady - attack.endsAt - interval) < 1e-9);
    f.source.combat.nextAttackAt = 100;
    f.tick(attack.endsAt); assert.equal(f.target.attack, null);
    f.tick(f.target.attackReady - .001); assert.equal(f.target.attack, null);
    const ready = f.target.attackReady; f.tick(ready); assert.equal(f.target.attack.startedAt, ready);
  });

for (const type of ["dna", "native", "legacy"]) test(type + " ranged defense blocks half damage and never parries", () => {
  const normal = fixture({ type, reaction: "parry", mode: "ranged", world: true });
  normal.tick(0); const at = normal.source.attack.hitAt; normal.tick(at);
  const hit = normal.events.find(event => event.sourceId === "a" && event.kind === "hit");
  assert.ok(hit); assert.equal(normal.events.some(event => event.kind === "parry"), false);
  assert.equal(normal.target.attackReady, 10);
  const blocked = fixture({ type, reaction: "block", mode: "ranged", world: true }); blocked.tick(0); blocked.tick(at);
  const block = blocked.events.find(event => event.sourceId === "a" && event.kind === "block");
  assert.ok(block);
  if (type !== "legacy") assert.ok(Math.abs(block.amount - hit.amount * .5) < 1e-9);
  assert.equal(blocked.target.attackReady === 10, false);
  if (type !== "legacy") assert.equal(blocked.target.attack.startedAt, at);
});

test("evasion leaves the pending attack wait unchanged", () => {
  const f = fixture({ type: "dna", reaction: "miss", mode: "melee" }); f.tick(0); f.tick(.3);
  assert.ok(f.events.some(event => event.kind === "miss" && event.sourceId === "a"));
  assert.equal(f.target.attackReady, 10); assert.equal(f.target.combat.nextAttackAt, 10); assert.equal(f.target.attack, null);
});

test("defending during a melee combo preserves every contact and skips just the next interval", () => {
  const f = fixture({ type: "dna", reaction: "block", mode: "melee", active: true,
    source: { focus: .35 }, target: { hits: 3, counter: 100 } });
  f.tick(0); const attack = f.target.attack; f.tick(.35);
  assert.equal(f.target.attack, attack); assert.equal(attack.defenseResetAt, .35);
  f.source.combat.nextAttackAt = 100;
  f.tick(.54); assert.equal(f.target.attack, attack);
  assert.deepEqual(attack.meleeContacts, [.3, .42, .54]);
  assert.equal(f.events.filter(event => event.sourceId === "b" && event.kind === "hit").length, 3);
  const endsAt = attack.endsAt; f.tick(endsAt);
  assert.notEqual(f.target.attack, attack); assert.equal(f.target.attack.startedAt, endsAt);
  assert.equal(f.target.combat.attackCount, 2);
  assert.equal(f.events.filter(event => event.sourceId === "b" && event.kind === "counter").length, 0);
  assert.ok(Math.abs(f.target.attackReady - f.target.attack.endsAt - 2) < 1e-9);
});

test("defending during a world ranged volley preserves launched shots and resumes once at the native tail", () => {
  const f = fixture({ type: "dna", reaction: "block", mode: "ranged", world: true, active: true,
    source: { focus: .4 }, target: { focus: .2, hits: 3 } });
  f.tick(0); const attack = f.target.attack, at = f.source.attack.hitAt;
  f.tick(at); assert.equal(f.target.attack, attack); assert.equal(attack.defenseResetAt, at);
  f.source.attackReady = 100;
  f.tick(.78);
  assert.equal(f.events.filter(event => event.sourceId === "b" && event.kind === "shoot").length, 3);
  assert.equal(f.events.filter(event => event.sourceId === "b" && event.kind === "hit").length, 3);
  assert.equal(f.events.filter(event => event.kind === "projectile-cancel").length, 0);
  f.tick(attack.endsAt); assert.notEqual(f.target.attack, attack); assert.equal(f.target.attack.startedAt, attack.endsAt);
  assert.ok(Math.abs(f.target.attackReady - f.target.attack.endsAt - 2) < 1e-9);
});
