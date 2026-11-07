import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationTrial } from "../client/combat-simulation.mjs";
import { combatPositionRadius, combatPositionRole } from "./combat-position.mjs";
import { createGame } from "./game.mjs";

const passive = { key: "bean", organs: { attack: 0, ranged: 0 }, counts: { vitality: 500 } };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

function advanceUntil(trial, predicate, seconds) {
  while (!predicate() && !trial.reason && trial.time < seconds) trial.advance(1 / 60);
  assert.ok(predicate(), "the expected combat event occurs");
}

test("each team keeps its own role and initial spacing regardless of the opposing roster", () => {
  const own = ["dew-rabbit", "dew-rabbit"].map(key => ({ key }));
  for (const side of [0, 1]) {
    let initial;
    for (const opponent of [["flower-tail-bird"], ["lantern-keeper"], ["white-paw", "walking-forest"]]) {
      const other = opponent.map(key => ({ key }));
      const trial = createSimulationTrial({ left: side ? other : own, right: side ? own : other, random: false });
      const units = trial.agents.filter(unit => unit.side === side);
      const positions = units.map(unit => ({ x: unit.combat.position.x, y: unit.combat.position.y, role: unit.combat.position.role }));
      assert.ok(units.every(unit => combatPositionRole(unit) === "middle"));
      if (initial) assert.deepEqual(positions, initial);
      else initial = positions;
    }
  }
  for (const keys of [["dew-rabbit", "white-paw"], ["white-paw", "dew-rabbit"]]) {
    const trial = createSimulationTrial({ left: keys.map(key => ({ key })), right: { key: "flower-tail-bird" }, random: false });
    const units = trial.agents.filter(unit => unit.side === 0), radius = Math.max(...units.map(combatPositionRadius), .35);
    near(units[0].combat.position.x, units[1].combat.position.x);
    near(Math.abs(units[0].combat.position.y - units[1].combat.position.y), radius * 2 + .2);
    assert.ok(Math.hypot(units[0].combat.position.x - units[1].combat.position.x,
      units[0].combat.position.y - units[1].combat.position.y) > units.reduce((sum, unit) => sum + combatPositionRadius(unit), 0));
  }
});

test("both teams start by role and move in the shared battlefield without changing map cells", () => {
  const builds = ["vine-turtle", "spiny-back-leader", "shadow-weasel", "dew-rabbit", "lantern-keeper"].map(key => ({ key }));
  const trial = createSimulationTrial({ left: builds, right: builds, random: false });
  const initial = trial.agents.map(unit => ({ id: unit.id, ...unit.combat.position }));
  for (const side of [0, 1]) {
    const units = trial.agents.filter(unit => unit.side === side);
    const depth = role => units.filter(unit => unit.combat.position.role === role).map(unit => Math.abs(unit.combat.position.x));
    assert.ok(Math.max(...depth("front")) < Math.min(...depth("middle")));
    assert.ok(Math.max(...depth("middle")) < Math.min(...depth("back")));
  }
  trial.advance(.5);
  assert.ok(trial.agents.some(unit => Math.hypot(unit.combat.position.x - initial.find(item => item.id === unit.id).x,
    unit.combat.position.y - initial.find(item => item.id === unit.id).y) > .05));
  assert.ok(trial.agents.every(unit => unit.x === 100 && unit.y === 100));
  for (let i = 0; i < trial.agents.length; i++) for (let j = i + 1; j < trial.agents.length; j++) {
    const a = trial.agents[i], b = trial.agents[j];
    assert.ok(Math.hypot(a.combat.position.x - b.combat.position.x, a.combat.position.y - b.combat.position.y) >=
      combatPositionRadius(a) + combatPositionRadius(b) + .075, a.id + " / " + b.id);
  }
});

test("a native ranged shot has visible flight time and applies damage only at arrival", () => {
  const trial = createSimulationTrial({ left: { key: "lantern-keeper" }, right: passive, random: false });
  advanceUntil(trial, () => trial.vfx.events.some(event => event.kind === "shoot"), 10);
  const shot = trial.vfx.events.find(event => event.kind === "shoot"), target = trial.agents.find(unit => unit.id === shot.targetId);
  assert.ok(shot.arrivesAt > shot.at + .1);
  assert.ok(shot.arenaFrom && shot.arenaTo);
  assert.notEqual(shot.arenaFrom.x, shot.arenaTo.x);
  const health = target.health;
  trial.advance(Math.max(0, shot.arrivesAt - trial.time - .001));
  near(target.health, health);
  trial.advance(.05);
  assert.ok(target.health < health);
  const hits = trial.vfx.events.filter(event => event.projectileId === shot.projectileId && event.kind === "hit");
  assert.equal(hits.length, 1); near(hits[0].at, shot.arrivesAt);
});

test("a front hybrid approaches and switches from ranged to melee at actual range", () => {
  const trial = createSimulationTrial({ left: { key: "spiny-back-beetle" }, right: passive, random: false });
  const modes = new Set();
  for (let index = 0; index < 900 && modes.size < 2; index++) {
    trial.advance(1 / 60);
    for (const event of trial.vfx.events) if (event.kind === "attack" && event.sourceId === "left") modes.add(event.mode);
  }
  assert.deepEqual([...modes].sort(), ["melee", "ranged"]);
});

test("a melee windup cannot damage a target that leaves its reach", () => {
  const trial = createSimulationTrial({ left: { key: "bean", counts: { vitality: 80, power: 5 } }, right: passive, random: false });
  const source = trial.agents[0], target = trial.agents[1];
  advanceUntil(trial, () => !!source.attack, 10);
  const attack = source.attack, health = target.health;
  target.combat.position.x += 5;
  trial.advance(attack.hitAt - trial.time + .02);
  near(target.health, health);
  assert.ok(trial.vfx.events.some(event => event.kind === "miss" && event.sourceId === source.id));
});

test("the real game snapshot and save restore retain authoritative battlefield positions", () => {
  const trial = createSimulationTrial({ left: { key: "shadow-weasel" }, right: passive, random: false });
  trial.advance(.5);
  const colony = { id: 1, ownerId: "position-save", tribe: "bean", x: 20, y: 20, occupiedCells: new Set(["2,2"]) };
  const room = { simSeconds: 0, world: { size: 80, seed: 13, generationVersion: 38,
    terrain: new Uint8Array(6400).fill(4), hazards: new Uint8Array(6400) }, colonies: [colony],
    games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(room, colony); room.games.set(colony.ownerId, game);
  const live = game.agents[0]; live.combat = structuredClone(trial.agents[0].combat);
  const position = structuredClone(live.combat.position);
  const snapshot = game.snapshot().agents.find(unit => unit.id === live.id);
  assert.deepEqual(snapshot.combat.position, position);
  const saved = game.save(); game.restore(saved);
  assert.deepEqual(game.agents.find(unit => unit.id === live.id).combat.position, position);
});
