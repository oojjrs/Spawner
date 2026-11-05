import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { createGame } from "./game.mjs";

const gene = ATTRIBUTE_DNA.lookup.get("secretion");
const dna = ATTRIBUTE_DNA.stats([{ gene: "secretion", grade: gene.grade, shape: [...gene.steps], rotation: 0 }]);
function fixture({ tribe = "bean", start = .1, hits = 4, focus = .3, gap = .12, rate = 4 } = {}) {
  const source = { id: "source", ownerId: "a", tribe, x: 100, y: 100, health: 100,
    attributes: { secretion: 1 }, combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: { ...dna, rangedSpeed: rate, hits, focus, comboSpeed: gap } } };
  const target = { id: "target", ownerId: "b", tribe: "bean", x: 102, y: 100, health: 100,
    attributes: {}, combatDisposition: "passive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, combatStrength: 10 } };
  const events = [], random = [];
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const env = { world: { terrain: new Uint8Array(320 * 320) }, games: new Map([["a", game([source])], ["b", game([target])]]),
    combatRandom: () => { random.push("combat"); return .99; }, damageRandom: () => { random.push("damage"); return .5; },
    onCombatEvent: event => events.push(event) };
  const combat = createCombat(env); combat.update(source, start);
  const first = source.attack, causeId = events.find(event => event.kind === "attack").causeId;
  // Updating the target advances existing projectiles without starting another
  // shooter action. It has no ranged capability of its own.
  const advance = time => combat.update(target, time);
  return { source, target, env, combat, events, random, first, causeId, advance };
}
const firstEvents = (f, kind) => f.events.filter(event => event.causeId === f.causeId && event.kind === kind);

test("world ranged action cannot retire one roundoff step before its intended final launch", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const f = fixture({ tribe }), launches = [...f.first.shotLaunches];
    const originalReadyAt = .1 + Math.max(1 / 4, .3 + 3 * .12);
    assert.ok(originalReadyAt < launches.at(-1), "fixture exercises the original rounding defect");
    assert.equal(f.source.attackReady, originalReadyAt, "cooldown is unchanged");
    assert.equal(f.first.endsAt, launches.at(-1));
    assert.equal(f.first.launchedAt, .4);
    for (const at of launches.slice(0, -1)) f.combat.update(f.source, at);
    f.combat.update(f.source, originalReadyAt);
    assert.equal(f.source.attack, f.first, "the still-unlaunched final shot retains its action");
    assert.deepEqual(firstEvents(f, "shoot").map(event => event.at), launches.slice(0, -1), "no early shot");
    f.combat.update(f.source, launches.at(-1));
    assert.deepEqual(firstEvents(f, "shoot").map(event => event.at), launches);
    assert.equal(firstEvents(f, "shoot").at(-1).hitIndex, 3);
    assert.notEqual(f.source.attack, f.first, "normal retirement/replacement still occurs after the final launch");
    f.source.attack = null; f.source.attackReady = 100;
    for (const time of [launches.at(-1), launches.at(-1) + .001, launches.at(-1) + .5, 2]) f.advance(time);
    assert.equal(firstEvents(f, "shoot").length, 4, "no duplicate or delayed extra shot");
    assert.equal(firstEvents(f, "projectile-cancel").length, 0);
    assert.equal(firstEvents(f, "hit").length, 4, "all four launched projectiles resolve once");
  }
});

test("ranged schedules keep their cooldown, launch, flight, and ordinary recovery formulas", () => {
  for (const start of [0, .1, 1, 10.01, 100.07, 3600.04]) for (const hits of [1, 4, 13])
    for (const focus of [.08, .3]) for (const gap of [.06, .12]) for (const rate of [.5, 4]) {
      const f = fixture({ start, hits, focus, gap, rate }), first = f.first;
      const launch = start + focus, last = launch + (hits - 1) * gap;
      const ready = start + Math.max(1 / rate, focus + (hits - 1) * gap);
      const previousEnd = Math.min(ready, last + .15);
      assert.equal(f.source.attackReady, ready);
      assert.equal(first.launchedAt, launch);
      assert.deepEqual(first.shotLaunches, Array.from({ length: hits }, (_, i) => launch + i * gap));
      assert.deepEqual(f.source.dnaProjectiles.map(shot => shot.launchedAt), first.shotLaunches);
      assert.deepEqual(f.source.dnaProjectiles.map((shot, i) => shot.hitAt), Array.from({ length: hits }, (_, i) => first.hitAt + i * gap));
      if (previousEnd >= last) assert.equal(first.endsAt, previousEnd);
      else {
        assert.equal(first.endsAt, last);
        assert.ok(last - previousEnd <= Number.EPSILON * Math.max(1, start) * 4);
      }
      assert.deepEqual(f.random, [], "scheduling consumes no new randomness");
    }
});

test("canceling windup or the final pending shot does not manufacture a projectile", () => {
  for (const emitted of [0, 1, 3]) {
    const f = fixture(), launches = [...f.first.shotLaunches];
    for (const at of launches.slice(0, emitted)) f.advance(at);
    f.source.attack = null; f.source.attackReady = 100;
    f.advance(launches.at(-1) + 1);
    assert.equal(firstEvents(f, "shoot").length, emitted);
    assert.equal(firstEvents(f, "hit").length, emitted);
    assert.equal(firstEvents(f, "projectile-cancel").length, 4 - emitted);
  }
});

test("replacing an in-flight source with its restored instance cancels old projectiles and retains cooldown", () => {
  const f = fixture(); f.advance(f.first.launchedAt);
  const ready = f.source.attackReady;
  const restored = { ...f.source, attack: null, dnaProjectiles: [] };
  f.env.games.get("a").agents = [restored];
  f.advance(f.first.endsAt + 1);
  assert.equal(restored.attackReady, ready);
  assert.equal(restored.attack, null); assert.deepEqual(restored.dnaProjectiles, []);
  assert.equal(firstEvents(f, "shoot").length, 1);
  assert.equal(firstEvents(f, "hit").length, 0);
  assert.equal(firstEvents(f, "projectile-cancel").length, 4);
  assert.equal(f.target.health, 100);
});

test("actual game snapshot and save preserve the clamped schedule, while restore clears in-flight actions", () => {
  const f = fixture();
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
