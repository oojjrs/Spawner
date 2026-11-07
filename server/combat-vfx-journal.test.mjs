import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { createCombat } from "./combat.mjs";
import { recordCombatVfx, snapshotCombatVfx, COMBAT_VFX_JOURNAL_LIMIT } from "./combat-vfx-journal.mjs";
import { snapshotRoom } from "../client/room.mjs";
import { createStateEncoder, createStateDecoder } from "../client/state-delta.mjs";

const stats = ids => ATTRIBUTE_DNA.stats(ids.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id);
  return { gene: id, grade: gene.grade, q: 0, r: 0, rotation: 0 };
}));
function fixture(ids, distance = 0) {
  const unit = (id, ownerId, dna, x = 100) => ({ id, ownerId, tribe: "bean", x, y: 100,
    health: 100, attributes: {}, combatDisposition: ownerId === "a" ? "aggressive" : "passive",
    moveStartedAt: 0, moveDuration: 0, stats: { health: 100, speed: 1, vision: 4, dna } });
  const source = unit("source", "a", stats(ids));
  const target = unit("target", "b", stats([]), 100 + distance);
  const ally = unit("ally", "a", stats([]));
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const events = [], environment = { world: { terrain: new Uint8Array(320 * 320) },
    games: new Map([["a", game([source, ally])], ["b", game([target])]]),
    combatRandom: () => .01, damageRandom: () => .5, onCombatEvent: event => events.push(event) };
  const combat = createCombat(environment);
  return { source, target, ally, events, environment, combat };
}

test("journal is bounded, immutable, ephemeral, and reports the unfiltered retained sequence", () => {
  const environment = {};
  for (let index = 0; index < 300; index++) recordCombatVfx(environment,
    { kind: "hit", at: 1, amount: 1, sourceId: "a", targetId: "b", from: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
  const snapshot = snapshotCombatVfx(environment, 1, { agentIds: new Set(["b"]) });
  assert.equal(snapshot.events.length, COMBAT_VFX_JOURNAL_LIMIT);
  assert.equal(snapshot.oldestSequence, 45); assert.equal(snapshot.latestSequence, 300);
  assert.equal(snapshot.droppedThroughSequence, 44);
  assert.equal(snapshot.events[0].sourceId, null); assert.equal(snapshot.events[0].from, undefined);
  snapshot.events[0].to.x = 99;
  assert.equal(snapshotCombatVfx(environment, 1).events[0].to.x, 2);
  assert.equal(snapshotCombatVfx(environment, 6).events.length, 0);
  assert.equal(JSON.stringify(environment), "{}", "presentation journal never enters serialized state");
  assert.notEqual(snapshotCombatVfx({}, 1).streamId, snapshot.streamId);
  const actual = recordCombatVfx(environment, { kind: "stun", at: 10, endsAt: 20, amount: 0 });
  assert.equal(Object.isFrozen(actual), true);
  assert.ok(snapshotCombatVfx(environment, 15).events.some(event => event.kind === "stun"));
  const isolated = recordCombatVfx({ onCombatEvent(event) { event.amount = 999; } }, { kind: "regeneration", at: 1, amount: 1 });
  assert.equal(isolated.amount, 1, "a failing or mutating presentation observer cannot affect the evidence or combat");
});

test("server captures actual critical/combo/area/drain/reflect/death recipients and causal links", () => {
  const f = fixture(["blade", "combo", "critical", "area", "lifesteal"]);
  f.source.health = 50;
  Object.assign(f.source.stats.dna, { meleePower: 10, critical: 100, lifesteal: 100, areaPower: 100 });
  f.target.stats.dna.reflection = 50;
  const collateral = { ...f.target, id: "collateral", health: 4, stats: { ...f.target.stats, dna: stats([]) } };
  f.environment.games.get("b").agents.push(collateral);
  f.combat.engage(f.source, f.target, 0); f.source.combat.targetId = f.target.id;
  for (const unit of [f.source, f.target]) Object.assign(unit.combat.position, { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
  f.combat.update(f.source, 0); f.combat.update(f.source, .3); f.combat.update(f.source, .42);
  const first = f.events.find(event => event.kind === "hit" && event.hitIndex === 0);
  assert.equal(first.critical, true); assert.equal(first.amount, 15); assert.equal(first.at, .3);
  assert.ok(f.events.some(event => event.kind === "hit" && event.hitIndex === 1));
  const drain = f.events.find(event => event.kind === "drain");
  assert.equal(drain.amount, 15); assert.equal(drain.targetId, f.source.id);
  assert.equal(drain.fromId, f.target.id); assert.equal(drain.toId, f.source.id); assert.equal(drain.causeId, first.id);
  const reflected = f.events.find(event => event.kind === "reflect");
  assert.equal(reflected.targetId, f.source.id); assert.equal(reflected.amount, 7.5); assert.equal(reflected.causeId, first.id);
  const area = f.events.find(event => event.kind === "area");
  assert.equal(area.targetId, "collateral"); assert.equal(area.amount, 4, "overkill is capped to actual lost HP");
  assert.equal(f.events.find(event => event.kind === "death").causeId, area.id);
});

test("server bleed catch-up uses each real tick time and regeneration reports only actual recovery", () => {
  const f = fixture(["blade", "bleed", "stun"]);
  Object.assign(f.source.stats.dna, { bleed: 100, stun: 100 });
  f.combat.engage(f.source, f.target, 0);
  for (const unit of [f.source, f.target]) Object.assign(unit.combat.position, { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
  f.combat.update(f.source, 0); f.combat.update(f.source, .3);
  f.source.combat.nextAttackAt = Infinity;
  f.combat.update(f.target, 3.31);
  assert.deepEqual(f.events.filter(event => event.kind === "bleed").map(event => event.at), [1.3, 2.3, 3.3]);
  const stun = f.events.find(event => event.kind === "stun");
  assert.equal(stun.amount, 0); assert.equal(stun.endsAt, .55);
  const applied = f.events.find(event => event.kind === "bleed-apply");
  assert.ok(f.events.filter(event => event.kind === "bleed").every(event => event.causeId === applied.id));
  const recovery = fixture(["regeneration"]);
  recovery.source.health = 99.8; recovery.source.dnaRecoveryAt = 5;
  recovery.combat.update(recovery.source, 6);
  const regenerated = recovery.events.find(event => event.kind === "regeneration");
  assert.ok(Math.abs(regenerated.amount - .2) < 1e-9); assert.equal(regenerated.at, 6);
  recovery.combat.update(recovery.source, 7);
  assert.equal(recovery.events.filter(event => event.kind === "regeneration").length, 1, "full health produces no recovery VFX");
});

test("server launch/arrival/cancel evidence follows real projectiles and retains zero-damage defense", () => {
  const f = fixture(["secretion"], 2);
  f.target.stats.dna.evasion = 100;
  f.combat.update(f.source, 0);
  const { startedAt, launchedAt, hitAt, endsAt } = f.source.attack;
  assert.ok(startedAt < launchedAt && launchedAt < hitAt && launchedAt < endsAt);
  assert.equal(f.events.some(event => event.kind === "shoot"), false);
  f.combat.update(f.source, launchedAt);
  const launch = f.events.find(event => event.kind === "shoot");
  assert.equal(launch.at, launchedAt); assert.equal(launch.arrivesAt, hitAt);
  assert.ok(Math.abs(hitAt - launchedAt - 2 / 6) < 1e-9);
  assert.equal(f.events.some(event => event.kind === "miss"), false);
  f.combat.update(f.source, hitAt);
  const impact = f.events.find(event => event.kind === "miss");
  assert.equal(impact.at, launch.arrivesAt); assert.equal(impact.amount, 0);
  assert.equal(impact.projectileId, launch.projectileId); assert.equal(f.target.health, 100);
  const count = f.events.length; f.combat.update(f.source, hitAt); assert.equal(f.events.length, count);
  f.combat.update(f.source, endsAt); assert.equal(f.events.length, count);
  const cancelled = fixture(["secretion"], 2);
  cancelled.combat.update(cancelled.source, 0); cancelled.source.hidden = true;
  const attack = cancelled.source.attack;
  cancelled.combat.update(cancelled.source, (attack.startedAt + attack.launchedAt) / 2);
  assert.ok(cancelled.events.some(event => event.kind === "projectile-cancel"));
  assert.equal(cancelled.events.some(event => ["shoot", "hit"].includes(event.kind)), false);
});

test("room snapshots floor visibility coordinates and state deltas carry the ephemeral journal", () => {
  const checked = [], state = { agents: [], rivals: [], simSeconds: 1 };
  const game = { prepare() {}, snapshot: () => state, colonyKnown: () => true, nestLevel: 1,
    nest: { health: 100, maxHealth: 100 }, isVisible(x, y) { checked.push([x, y]); return x === 2 && y === 3; } };
  const room = { id: "room", title: "review", hostId: "host", revision: 1, simSeconds: 1,
    games: new Map([["host", game]]), colonies: [{ id: "colony", ownerId: "host", occupiedCells: new Set() }] };
  recordCombatVfx(room, { kind: "hit", at: 1, amount: 3, sourceId: "hidden", targetId: "visible",
    from: { x: 8.8, y: 8.2 }, to: { x: 2.8, y: 3.2 } });
  const snapshot = snapshotRoom(room, false);
  assert.ok(checked.every(pair => pair.every(Number.isInteger)));
  assert.equal(snapshot.state.combatVfx.events.length, 1);
  assert.equal(snapshot.state.combatVfx.events[0].sourceId, null);
  const encoder = createStateEncoder(), decoder = createStateDecoder();
  decoder.decode(encoder.encode(snapshot, true));
  recordCombatVfx(room, { kind: "regeneration", at: 1, amount: 1, sourceId: "visible", targetId: "visible", to: { x: 2, y: 3 } });
  room.revision++;
  const next = snapshotRoom(room, false), decoded = decoder.decode(encoder.encode(next));
  assert.deepEqual(decoded.state.combatVfx, next.state.combatVfx);
  assert.equal(Object.hasOwn(state, "combatVfx"), false);
});
