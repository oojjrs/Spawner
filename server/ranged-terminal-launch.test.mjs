import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { createGame } from "./game.mjs";

const gene = ATTRIBUTE_DNA.lookup.get("secretion");
const dna = ATTRIBUTE_DNA.stats([{ gene: "secretion", grade: gene.grade, q: 0, r: 0, rotation: 0 }]);
function fixture(options) {
  const { tribe, start, hits, focus, gap, rate } = { tribe: "bean", start: .1, hits: 4, focus: .3, gap: .12, rate: 4, ...options };
  const source = { id: "source", ownerId: "a", tribe, x: 100, y: 100, health: 100,
    attributes: { secretion: 1 }, combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: { ...dna, rangedSpeed: rate, hits, focus, comboSpeed: gap } } };
  const target = { id: "target", ownerId: "b", tribe: "bean", x: 100, y: 100, health: 100,
    attributes: {}, combatDisposition: "passive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, combatStrength: 10, dna: ATTRIBUTE_DNA.stats([]) } };
  const events = [], random = [];
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const env = { world: { terrain: new Uint8Array(320 * 320) }, games: new Map([["a", game([source])], ["b", game([target])]]),
    combatRandom: () => { random.push("combat"); return .99; }, damageRandom: () => { random.push("damage"); return .5; },
    onCombatEvent: event => events.push(event) };
  const combat = createCombat(env); combat.engage(source, target, start);
  for (const [unit, x] of [[source, -1.2], [target, 1.2]]) Object.assign(unit.combat.position, { x, y: 0, fromX: x, fromY: 0 });
  combat.update(source, start);
  const first = source.attack, causeId = events.find(event => event.kind === "attack").causeId;
  const advance = time => combat.update(target, time);
  return { source, target, env, combat, events, random, first, causeId, advance };
}
const firstEvents = (f, kind) => f.events.filter(event => event.causeId === f.causeId && event.kind === kind);

test("cell ranged combo launches every shot once before recovery and rest", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const f = fixture({ tribe }), launches = Array.from({ length: 4 }, (_, i) => .4 + i * .12);
    assert.equal(f.first.combatId, f.source.combat.id);
    for (const [index, at] of launches.entries()) {
      f.advance(at - .0001);
      assert.equal(firstEvents(f, "shoot").length, index);
      f.advance(at);
      assert.equal(firstEvents(f, "shoot").length, index + 1);
      f.advance(at);
      assert.equal(firstEvents(f, "shoot").length, index + 1);
    }
    assert.equal(firstEvents(f, "shoot").at(-1).hitIndex, 3);
    assert.equal(f.source.attack, f.first);
    assert.ok(Math.abs(f.source.attackReady - f.first.endsAt - .25) < 1e-9);
    assert.ok(Math.abs(f.first.endsAt - launches.at(-1) - .7) < 1e-9);
    f.advance(f.first.endsAt);
    assert.equal(f.source.attack, null);
    f.advance(f.source.attackReady - .001);
    assert.equal(f.source.attack, null);
    assert.equal(firstEvents(f, "projectile-cancel").length, 0);
    assert.equal(firstEvents(f, "hit").length, 4);
  }
});

test("cell ranged schedules preserve launch and flight before the next action", () => {
  for (const start of [0, .1, 1, 10.01, 100.07, 3600.04]) for (const hits of [1, 4, 13])
    for (const focus of [.08, .3]) for (const gap of [.06, .12]) for (const rate of [.5, 4]) {
      const f = fixture({ start, hits, focus, gap, rate }), first = f.first;
      const launch = start + focus, last = launch + (hits - 1) * gap;
      assert.equal(first.launchedAt, launch);
      assert.equal(f.source.dnaProjectiles?.length || 0, 0);
      assert.deepEqual(f.random, []);
      for (let index = 0; index < hits; index++) f.advance(launch + index * gap);
      const shots = firstEvents(f, "shoot");
      assert.equal(shots.length, hits);
      for (const [index, shot] of shots.entries()) {
        assert.ok(Math.abs(shot.at - launch - index * gap) < 1e-8);
        assert.ok(shot.arrivesAt > shot.at);
        assert.equal(shot.hitIndex, index);
      }
      assert.ok(Math.abs(f.source.attackReady - first.endsAt - 1 / rate) < 1e-8);
      assert.ok(Math.abs(first.endsAt - last - .7) < 1e-8);
      f.source.combat.nextAttackAt = Infinity;
      f.advance(first.endsAt);
      assert.equal(firstEvents(f, "hit").length, hits);
    }
});

test("canceling cell windup or the final pending shot does not manufacture a projectile", () => {
  for (const emitted of [0, 1, 3]) {
    const f = fixture({}), launches = Array.from({ length: 4 }, (_, i) => .4 + i * .12);
    for (const at of launches.slice(0, emitted)) f.advance(at);
    f.source.attack = null; f.source.combat.nextAttackAt = Infinity;
    f.advance(launches.at(-1) + 1);
    assert.equal(firstEvents(f, "shoot").length, emitted);
    assert.equal(firstEvents(f, "hit").length, emitted);
    assert.equal(f.source.dnaProjectiles?.length || 0, 0);
  }
});

test("replacing an in-flight source cancels its launched projectile and retains cooldown", () => {
  const f = fixture({}); f.advance(f.first.launchedAt);
  const ready = f.source.attackReady;
  const restored = { ...f.source, attack: null, dnaProjectiles: [], combat: { ...f.source.combat, nextAttackAt: Infinity } };
  f.env.games.get("a").agents = [restored];
  f.advance(f.first.endsAt + 1);
  assert.equal(restored.attackReady, ready);
  assert.equal(restored.attack, null); assert.deepEqual(restored.dnaProjectiles, []);
  assert.equal(firstEvents(f, "shoot").length, 1);
  assert.equal(firstEvents(f, "hit").length, 0);
  assert.equal(firstEvents(f, "projectile-cancel").length, 1);
  assert.equal(f.target.health, 100);
});

test("actual game snapshot and save preserve the full interval schedule, while restore clears in-flight actions", () => {
  const f = fixture({}); f.advance(f.first.launchedAt);
  const colony = { id: 1, ownerId: "terminal-save", tribe: "bean", x: 20, y: 20, occupiedCells: new Set(["2,2"]) };
  const room = { simSeconds: 0, world: { size: 80, seed: 13, generationVersion: 38,
    terrain: new Uint8Array(6400).fill(4), hazards: new Uint8Array(6400) }, colonies: [colony],
    games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(room, colony); room.games.set(colony.ownerId, game);
  const live = game.agents[0];
  live.attack = structuredClone(f.first); live.dnaProjectiles = structuredClone(f.source.dnaProjectiles);
  live.attackReady = f.source.attackReady;
  const snapshot = JSON.parse(JSON.stringify(game.snapshot())).agents.find(agent => agent.id === live.id);
  assert.deepEqual(snapshot.attack.shotLaunches, f.first.shotLaunches); assert.equal(snapshot.attack.endsAt, f.first.endsAt);
  const saved = game.save(), stored = JSON.parse(saved).state.agents.find(agent => agent.id === live.id);
  assert.deepEqual(stored.attack, f.first); assert.equal(stored.attackReady, f.source.attackReady);
  game.restore(saved);
  const restored = game.agents.find(agent => agent.id === live.id);
  assert.equal(restored.attack, null); assert.deepEqual(restored.dnaProjectiles, []);
  assert.equal(restored.attackReady, f.source.attackReady);
});
