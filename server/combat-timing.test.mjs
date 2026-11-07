import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { combatProfile } from "./combat-stats.mjs";
import { unitActionState, createUnitAppearanceEventPlayback } from "../client/unit-appearance-state.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { attackAnimationElapsed, AGENT_ATTACK_DURATION } from "./attack.mjs";

function fixture(rate, hits, gap) {
  const dna = { ...ATTRIBUTE_DNA.stats([]), melee: true, meleePower: 2, meleeSpeed: rate, power: 2, armor: 0, focus: .3,
    hits, comboSpeed: gap, comboPower: 100 };
  const units = ["a", "b"].map(id => ({ id, ownerId: id, tribe: "bean", combatDisposition: "aggressive",
    attributes: {}, x: 100, y: 100, health: 10000, stats: { health: 10000, speed: 1, vision: 3, dna: { ...dna } }, moveDuration: 0 }));
  const environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, combatRandom: () => .99, damageRandom: () => .5 };
  for (const unit of units) environment.games.set(unit.id, { agents: [unit], receiveDamage(agent, amount) { agent.health -= amount; } });
  const combat = createCombat(environment);
  return { units, tick(time) { environment.simSeconds = time; for (const unit of units) combat.update(unit, time); } };
}

test("slow DNA attacks finish their native tail and idle before the next cooldown", () => {
  const f = fixture(.5, 1, .12); f.tick(0);
  const a = f.units[0]; assert.equal(combatProfile(a).recovery, 0);
  assert.ok(Math.abs(a.attack.endsAt - AGENT_ATTACK_DURATION) < 1e-9);
  assert.equal(attackAnimationElapsed(a.attack, .5, .3, 1.01), .5);
  f.tick(1.1); assert.equal(a.attack, null);
  assert.equal(unitActionState(a, 1.1).action, "idle");
  f.tick(2); assert.equal(a.attack.startedAt, 2);
});

test("fast cooldown interrupts only the visual tail without dropping attacks", () => {
  const f = fixture(2, 1, .12); f.tick(0); f.tick(.5);
  assert.equal(f.units[0].attack.startedAt, .5);
  f.tick(1); assert.equal(f.units[0].attack.startedAt, 1);
  assert.equal(f.units[0].combat.attackCount, 3);
  const health = f.units[1].health; f.tick(1); assert.equal(f.units[1].health, health);
});

test("a combo completes each contact before the next cycle even beyond its cooldown", () => {
  const f = fixture(4, 3, .12); f.tick(0); f.tick(.3);
  const attack = f.units[0].attack;
  assert.equal(attack.hitIndex, 1); assert.equal(attackAnimationElapsed(attack, .3, .3, 1.01), .3);
  f.tick(.42); assert.equal(attack.hitIndex, 2);
  f.tick(.54); assert.equal(f.units[0].combat.attackCount, 2);
  assert.equal(f.units[0].attack.startedAt, .54);
});

test("attack speed changes only cooldown in non-DNA profiles", () => {
  const slow = combatProfile({ stats: { attackSpeed: .2 } });
  const fast = combatProfile({ stats: { attackSpeed: 4 } });
  assert.equal(slow.windup, fast.windup); assert.equal(slow.recovery, fast.recovery);
  assert.equal(slow.attackInterval, 5); assert.equal(fast.attackInterval, .25);
});

test("the shared appearance clock uses clip-native tails and each recorded combo contact", () => {
  const f = fixture(.5, 2, .12); f.tick(0); f.tick(.3);
  const a = f.units[0], animations = { attack: { durationsMs: [300, 400], hitTimeMs: 300 } };
  assert.equal(unitActionState(a, .3, { animations }).elapsedMs, 300);
  f.tick(.42);
  assert.equal(unitActionState(a, .42, { animations }).elapsedMs, 300);
  assert.ok(Math.abs(unitActionState(a, .62, { animations }).elapsedMs - 500) < 1e-8);
});

test("opposing units keep distinct cooldowns in the same authoritative combat", () => {
  const f = fixture(.5, 1, .12); f.units[1].stats.dna.meleeSpeed = 2;
  f.tick(0); f.tick(.5);
  assert.equal(f.units[0].attack.startedAt, 0); assert.equal(f.units[1].attack.startedAt, .5);
  f.tick(2);
  assert.equal(f.units[0].combat.attackCount, 2); assert.equal(f.units[1].combat.attackCount, 5);
});

test("combo contact playback emits each authoritative contact once", () => {
  const f = fixture(4, 3, .12), playback = createUnitAppearanceEventPlayback();
  const clip = { sourceId: "contact", durationsMs: [300, 400], hitTimeMs: 300, events: [{ type: "contact", atMs: 300 }] };
  const animations = { attack: clip }, events = [];
  f.tick(0); playback.update(unitActionState(f.units[0], 0, { animations }), clip, 0);
  for (const time of [.3 + 1e-10, .3 + 1e-10, .42 + 1e-10, .42 + 1e-10]) {
    f.tick(time); events.push(...playback.update(unitActionState(f.units[0], time, { animations }), clip, time));
  }
  assert.deepEqual(events.map(event => event.at), [.3, .42]);
  assert.equal(new Set(events.map(event => event.dedupeId)).size, 2);
});

test("ranged native tail follows launch rather than stretching until the cooldown", () => {
  const agent = { id: "ranged", health: 10, combat: { version: 2 }, attack: { startedAt: 0, launchedAt: .2,
    hitAt: .5, endsAt: 2, recovery: .4, dnaRanged: true, shotLaunches: [.2] } };
  const animations = { ranged: { durationsMs: [200, 400], launchAtMs: 200 } };
  assert.ok(Math.abs(unitActionState(agent, .4, { animations }).elapsedMs - 400) < 1e-8);
});

test("an appearance clip returns to idle when its own native tail finishes", () => {
  const agent = { id: "short", health: 10, combat: { version: 2 }, attack: { startedAt: 0,
    hitAt: .3, endsAt: 2, recovery: .7, meleeContacts: [.3] } };
  assert.equal(unitActionState(agent, .8, { animations: { attack: { durationsMs: [300, 400], hitTimeMs: 300 } } }).action, "idle");
});

test("five versus five journals preserve exact contacts, causal IDs, targets and projectile arrivals", () => {
  const base = ATTRIBUTE_DNA.stats(["blade"].map(gene => { const entry = ATTRIBUTE_DNA.lookup.get(gene); return { gene, grade: entry.grade, q: 0, r: 0, rotation: 0 }; }));
  const units = Array.from({ length: 10 }, (_, index) => ({ id: "unit-" + index, ownerId: index < 5 ? "left" : "right", tribe: "bean",
    x: index === 4 ? 98 : 100, y: 100, health: index === 5 ? 4 : 80, attributes: {}, combatDisposition: "aggressive", moveDuration: 0,
    stats: { health: 80, speed: 1, vision: 4, dna: { ...base, meleePower: 4, meleeSpeed: index % 2 ? 2 : .5,
      ...(index === 4 ? { melee: false, ranged: true, rangedPower: 4, rangedSpeed: 2 } : {}),
      ...(index === 1 ? { stun: 100, stunTime: .2 } : {}), ...(index === 6 ? { block: 100, counter: 100, counterPower: 100 } : {}) } } }));
  const events = [], contacts = [], environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { terrain: new Uint8Array(320 * 320).fill(4) }, combatRandom: () => .5, damageRandom: () => .5,
    onCombatEvent(event) {
      events.push(event);
      if (["hit", "block", "parry"].includes(event.kind) && !event.projectileId) {
        const source = units.find(unit => unit.id === event.sourceId);
        contacts.push({ at: event.at, contact: source.attack.hitAt });
      }
    } };
  for (const owner of ["left", "right"]) environment.games.set(owner, { agents: units.filter(unit => unit.ownerId === owner),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment);
  for (let frame = 0; frame <= 240; frame++) {
    const time = frame / 60; environment.simSeconds = time;
    for (const unit of units) combat.update(unit, time);
  }
  const ids = new Set(units.map(unit => unit.id));
  assert.equal(new Set(events.map(event => event.id)).size, events.length);
  assert.ok(contacts.length > 10); assert.ok(contacts.every(item => item.at === item.contact));
  assert.ok(events.every(event => ids.has(event.sourceId) && ids.has(event.targetId)));
  for (const launch of events.filter(event => event.kind === "shoot")) {
    const impact = events.find(event => event.projectileId === launch.projectileId && ["hit", "block", "parry", "projectile-cancel"].includes(event.kind));
    if (impact && impact.kind !== "projectile-cancel") assert.equal(impact.at, launch.arrivesAt);
  }
  for (const kind of ["death", "stun", "counter", "block", "shoot", "hit"]) assert.ok(events.some(event => event.kind === kind), kind);
  const death = events.find(event => event.kind === "death" && event.targetId === "unit-5");
  assert.ok(death);
  assert.ok(events.some(event => event.kind === "attack" && event.sourceId === "unit-0" && event.targetId !== "unit-5" && event.at > death.at));
});
