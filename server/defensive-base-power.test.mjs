import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { dnaUnitStats } from "./dna-unit.mjs";
import { dnaAttackMode } from "./dna-actions.mjs";
import { combatDamage, combatProfile } from "./combat-stats.mjs";
import { combatDisposition, canPursueCombat, createCombat } from "./combat.mjs";
import { combatPositionRadius } from "./combat-position.mjs";
import { startingWorkerDna } from "./tribe-start.mjs";
import { militaryAgent } from "./conquest-pacing.mjs";
import { createGame } from "./game.mjs";
import { createSimulationTrial, deriveSimulationStats } from "../client/combat-simulation.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const forms = [[], ["gather"], ["carapace"], ["antenna"], ["carapace", "antenna"]];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function design(genes) {
  const pieces = ATTRIBUTE_DNA.pack(genes.map(id => ({ gene: id, grade: ATTRIBUTE_DNA.lookup.get(id).grade, rotation: 0 })), 4);
  assert.ok(pieces);
  return { version: 4, level: 4, budget: 9999, pieces };
}

function unit(id, ownerId, tribe, dna) {
  const stats = dnaUnitStats(dna);
  return { id, ownerId, tribe, dna, stats, health: stats.health, attributes: {}, x: 100, y: 100,
    moveStartedAt: 0, moveDuration: 0, attackReady: 0 };
}

function engine(units, options = {}) {
  const events = [], environment = { games: new Map(), colonies: [], simSeconds: 0,
    world: { size: 320, terrain: new Uint8Array(320 * 320) },
    combatRandom: () => .99, damageRandom: () => .5, onCombatEvent(event) { events.push(event); }, ...options };
  for (const ownerId of new Set(units.map(agent => agent.ownerId))) environment.games.set(ownerId, {
    agents: units.filter(agent => agent.ownerId === ownerId),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); }
  });
  const combat = createCombat(environment);
  const tick = time => { environment.simSeconds = time; for (const agent of units) combat.update(agent, time); };
  return { units, events, environment, combat, tick };
}

function fixture(tribe = "bean", genes = [], offense = ["blade"], options) {
  const attacker = unit("attacker", "right", "bean", design(offense));
  const defender = unit("defender", "left", tribe, design(genes));
  const f = engine([defender, attacker], options);
  assert.equal(f.combat.engage(attacker, defender, 0), true);
  const gap = combatPositionRadius(attacker) + combatPositionRadius(defender) + .5;
  for (const [index, agent] of [attacker, defender].entries()) Object.assign(agent.combat.position,
    { x: index ? gap : 0, y: 0, fromX: index ? gap : 0, fromY: 0 });
  return { ...f, attacker, defender };
}

for (const tribe of tribes) test(`${tribe}: all basic bodies and starting workers have power 1 without offensive eligibility`, () => {
  for (const dna of [...forms.map(design), startingWorkerDna(tribe)]) {
    const agent = unit("basic", "left", tribe, dna), stats = agent.stats.dna;
    assert.equal(stats.power, 1); assert.equal(stats.meleePower, 1); assert.equal(stats.meleeSpeed, .5);
    assert.equal(stats.hits, 1); assert.equal(stats.focus, .3);
    assert.equal(stats.melee, false); assert.equal(stats.ranged, false); assert.equal(stats.rangedPower, 0);
    assert.equal(stats.counter, 0); assert.equal(stats.defensiveMelee, true);
    assert.equal(agent.stats.attackPower, 1); assert.equal(combatProfile(agent).attackPower, 1);
    assert.equal(combatDisposition(agent), "passive"); assert.equal(militaryAgent(agent), false);
    assert.equal(dnaAttackMode(stats, .5), null); assert.equal(dnaAttackMode(stats, .5, true), "melee");
    assert.equal(dnaAttackMode(stats, 2, true), null);
    const derived = deriveSimulationStats({ key: tribe, dna });
    assert.equal(derived.canAttack, true); assert.equal(derived.canInitiate, false);
  }
});

test("all four real colonies start, birth, and restore basic and defensive DNA at power 1", () => {
  for (const tribe of tribes) {
    const colony = { id: 1, ownerId: "basic-" + tribe, tribe, x: 20, y: 20, occupiedCells: new Set([
      "1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2",
      "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]) };
    const room = { simSeconds: 0, world: { size: 80, seed: 13, generationVersion: 38,
      terrain: new Uint8Array(6400).fill(4), hazards: new Uint8Array(6400) }, colonies: [colony],
      games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = createGame(room, colony); room.games.set(colony.ownerId, game);
    assert.ok(game.agents.length > 0);
    assert.ok(game.agents.every(agent => agent.stats.attackPower === 1 && combatDisposition(agent) === "passive"));
    const saved = JSON.parse(game.save()); saved.state.evolutionPoints = 9999; saved.state.nestLevel = 4;
    for (const agent of saved.state.agents) agent.stats.dna.power = agent.stats.dna.meleePower = 0;
    game.restore(JSON.stringify(saved));
    for (const genes of forms) {
      const { templateId } = game.command({ type: "design", templateId: null, name: "basic " + (genes.join("+") || "empty"), dna: design(genes), birth: false });
      const { agentId } = game.command({ type: "birth", templateId });
      assert.equal(game.agents.find(agent => agent.id === agentId).stats.attackPower, 1);
    }
    game.restore(game.save());
    assert.ok(game.agents.every(agent => agent.stats.attackPower === 1 && agent.stats.dna.defensiveMelee));
    assert.ok(game.agents.every(agent => combatDisposition(agent) === "passive"));
  }
});

test("all twelve defensive appearance trials take the first hit and deal power-1 responses", () => {
  for (const tribe of tribes) for (const genes of forms.slice(2)) {
    const trial = createSimulationTrial({ left: { key: tribe, dna: design(genes) },
      right: { key: "bean", counts: {} }, first: "left", random: false });
    trial.finish();
    assert.equal(trial.reason, "death"); assert.equal(trial.result().winner, "right");
    assert.equal(trial.history.find(event => event.kind === "attack").attackerId, "right");
    const incoming = trial.history.find(event => event.kind === "hit" && event.targetId === "left");
    const outgoing = trial.history.filter(event => event.kind === "hit" && event.attackerId === "left");
    assert.ok(outgoing.length > 0); assert.ok(outgoing[0].time > incoming.time);
    for (const event of outgoing) close(event.damage, 1);
    close(trial.result().rightHealth, 10 - outgoing.length);
    assert.equal(trial.history.some(event => event.kind === "counter"), false);
  }
});

for (const tribe of tribes) for (const genes of forms) test(`${tribe} ${genes.join("+") || "empty"}: survives the first hit and responds for exactly 1`, () => {
  const f = fixture(tribe, genes), { attacker, defender } = f;
  assert.equal(canPursueCombat({ ...defender, combat: null }, { ...attacker, combat: null }, 0), false);
  f.tick(0); f.tick(.299);
  assert.equal(defender.attack, null); assert.equal(defender.combat.defending, undefined);
  assert.equal(f.events.some(event => event.kind === "attack" && event.sourceId === defender.id), false);
  f.tick(.3);
  assert.ok(defender.health > 0 && defender.health < defender.stats.health);
  assert.equal(defender.combat.defending, true); assert.equal(defender.attack.attackMode, "melee");
  assert.equal(defender.attack.counter, false); close(defender.attack.startedAt, .3);
  close(defender.attack.hitAt, .6); assert.equal(attacker.health, 10);
  f.tick(.6); close(attacker.health, 9);
  const hits = f.events.filter(event => event.kind === "hit" && event.sourceId === defender.id);
  assert.equal(hits.length, 1); close(hits[0].amount, 1);
  assert.equal(f.events.some(event => event.kind === "counter"), false);
  const before = f.events.length; f.tick(.6); assert.equal(f.events.length, before);
});

test("defensive base damage keeps existing armor and damage-variation calculations", () => {
  const f = fixture();
  f.attacker.stats.dna.armor = 100;
  close(combatDamage(f.defender, f.attacker, .5), .5);
  close(combatDamage(f.defender, f.attacker, 0), .4);
  close(combatDamage(f.defender, f.attacker, 1), .6);
  f.tick(0); f.tick(.3); f.tick(.6); close(f.attacker.health, 9.5);
});

test("no-offense teams never initiate even when simulation initiative chooses their side", () => {
  for (const tribe of tribes) for (const first of ["left", "right", "simultaneous"]) {
    const input = { key: tribe, dna: design(["carapace", "antenna"]) };
    const trial = createSimulationTrial({ left: input, right: input, first, random: false });
    assert.equal(trial.finish().reason, "no-offense"); assert.equal(trial.history.length, 0);
    const a = unit("a", "left", tribe, input.dna), b = unit("b", "right", tribe, input.dna), f = engine([a, b]);
    assert.equal(f.combat.engage(a, b, 0), false);
    f.tick(0); f.tick(30); assert.equal(a.combat, undefined); assert.equal(b.combat, undefined);
    assert.equal(f.events.length, 0);
  }
});

test("joining a teammate's fight does not authorize an unhurt basic unit to attack", () => {
  const attacker = unit("a", "right", "bean", design(["blade"]));
  const defender = unit("b", "left", "bean", design([]));
  const bystander = unit("c", "left", "bean", design([]));
  const f = engine([attacker, defender, bystander]);
  f.combat.engage(attacker, defender, 0);
  for (const [agent, x, y] of [[attacker, 0, 0], [defender, .9, 0], [bystander, 4, 4]])
    Object.assign(agent.combat.position, { x, y, fromX: x, fromY: y });
  f.tick(0); f.tick(.3); f.tick(.6);
  assert.equal(defender.combat.defending, true); assert.equal(bystander.combat.defending, undefined);
  assert.equal(bystander.attack, null); assert.equal(bystander.health, bystander.stats.health);
});

test("ranged impact unlocks melee response without granting ranged range or projectiles", () => {
  const f = fixture("spring", ["antenna"], ["secretion"]);
  const { attacker, defender } = f;
  const gap = combatPositionRadius(attacker) + combatPositionRadius(defender) + 2;
  Object.assign(defender.combat.position, { x: gap, fromX: gap });
  f.tick(0); f.tick(.3);
  assert.equal(attacker.attack.attackMode, "ranged"); assert.equal(defender.combat.defending, undefined);
  const arrival = attacker.dnaProjectiles[0].hitAt;
  f.tick(arrival - .001); assert.equal(defender.combat.defending, undefined);
  f.tick(arrival);
  assert.equal(defender.combat.defending, true); assert.equal(defender.attack, null);
  assert.equal(dnaAttackMode(defender.stats.dna, 2, true), null);
  const position = defender.combat.position.x; f.tick(arrival + .15); assert.ok(defender.combat.position.x < position);
  Object.assign(defender.combat.position, { x: attacker.combat.position.x + combatPositionRadius(attacker) + combatPositionRadius(defender) + .5 });
  for (let time = arrival + .2; time <= arrival + .8; time += .05) f.tick(time);
  assert.ok(f.events.some(event => event.sourceId === defender.id && event.kind === "hit" && event.amount === 1));
  assert.equal(f.events.some(event => event.sourceId === defender.id && event.kind === "shoot"), false);
});

test("lethal first hits never start a defensive attack, and later lethal hits cancel it", () => {
  const lethal = fixture(); lethal.defender.health = 2;
  lethal.tick(0); lethal.tick(.3); lethal.tick(10);
  assert.equal(lethal.defender.health, 0); assert.equal(lethal.defender.attack, null);
  assert.equal(lethal.events.some(event => event.sourceId === lethal.defender.id && event.kind === "attack"), false);
  const combo = fixture(); combo.attacker.stats.dna.hits = 3; combo.attacker.stats.dna.comboPower = 100;
  combo.defender.health = 4; combo.tick(0); combo.tick(.3);
  assert.ok(combo.defender.attack); combo.tick(.42); combo.tick(2);
  assert.equal(combo.defender.health, 0); assert.equal(combo.defender.attack, null);
  assert.equal(combo.events.some(event => event.sourceId === combo.defender.id && event.amount > 0), false);
});

test("stun delays a surviving basic response, and blocked or evaded attacks still allow defense", () => {
  const stunned = fixture(); Object.assign(stunned.attacker.stats.dna, { stun: 100, stunTime: .5 });
  stunned.tick(0); stunned.tick(.3); assert.equal(stunned.defender.attack, null);
  stunned.tick(.799); assert.equal(stunned.defender.attack, null);
  stunned.tick(.8); close(stunned.defender.attack.startedAt, .8);
  for (const defense of ["block", "parry", "evasion"]) {
    const f = fixture(); f.defender.stats.dna[defense] = 100;
    f.tick(0); f.tick(.3); assert.equal(f.defender.combat.defending, true, defense);
    assert.ok(f.defender.attack, defense); f.tick(.6); close(f.attacker.health, 9);
    assert.equal(f.events.some(event => event.kind === "counter"), false);
  }
});

test("retaliation uses bounded normal cycles and releases permission when combat ends", () => {
  const f = fixture();
  for (const agent of f.units) agent.health = agent.stats.health = 100;
  f.tick(0); f.tick(12);
  const hits = f.events.filter(event => event.kind === "hit" && event.sourceId === f.defender.id);
  assert.equal(hits.length, 4); close(f.attacker.health, 96);
  for (let i = 1; i < hits.length; i++) close(hits[i].at - hits[i - 1].at, 3);
  assert.equal(f.events.some(event => event.kind === "counter"), false);
  f.combat.release(f.defender, 12); f.combat.release(f.attacker, 12);
  f.defender.attackReady = f.attacker.attackReady = 12;
  assert.ok(f.combat.engage(f.attacker, f.defender, 12));
  assert.equal(f.defender.combat.defending, undefined); f.tick(12.01); assert.equal(f.defender.attack, null);
});

test("saved defensive windups resume once, while a dormant saved body remains non-offensive", () => {
  for (const at of [0, .3]) {
    const f = fixture(); f.tick(0); if (at) f.tick(at);
    const saved = JSON.parse(JSON.stringify(f.units)), restored = engine(saved);
    const defender = saved.find(agent => agent.id === "defender"), attacker = saved.find(agent => agent.id === "attacker");
    if (!at) {
      restored.tick(.1); assert.equal(defender.attack, null); assert.equal(defender.combat.defending, undefined);
    } else {
      assert.equal(defender.combat.defending, true); restored.tick(.6); close(attacker.health, 9);
      const events = restored.events.length; restored.tick(.6); assert.equal(restored.events.length, events);
    }
  }
});

test("military organs retain their original attack formulas and base bodies do not activate upgrade genes", () => {
  const stats = genes => ATTRIBUTE_DNA.stats(genes.map(gene => ({ gene, grade: 1 })));
  const blade = stats(["blade", "power", "speed"]), ranged = stats(["secretion", "rangedPower", "rangedSpeed"]);
  close(blade.meleePower, 4); close(blade.meleeSpeed, .55); assert.equal(blade.defensiveMelee, false);
  close(ranged.rangedPower, 2.8); close(ranged.rangedSpeed, .55); assert.equal(ranged.meleePower, 0);
  assert.equal(dnaAttackMode(ranged, .5, true), "ranged"); assert.equal(ranged.defensiveMelee, false);
  const upgraded = stats(["power", "speed", "combo", "critical", "counter", "stun"]);
  assert.equal(upgraded.power, 1); assert.equal(upgraded.speed, .5); assert.equal(upgraded.hits, 1);
  for (const key of ["critical", "counter", "stun"]) assert.equal(upgraded[key], 0);
});
