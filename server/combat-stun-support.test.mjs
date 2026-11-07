import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "./combat.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";

const dna = (...ids) => ATTRIBUTE_DNA.stats(ids.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id);
  return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 };
}));

function fixture() {
  const unit = (id, ownerId, stats, x = 100) => ({ id, ownerId, tribe: "bean", x, y: 100,
    health: 100, attributes: {}, combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: stats } });
  const attacker = unit("attacker", "a", { ...dna("blade"), stun: 100, stunTime: .5 });
  const healer = unit("healer", "b", dna("healer"));
  const ally = unit("ally", "b", dna("blade"), 101); ally.health = 50;
  healer.dnaHealReady = .2;
  const events = [];
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const env = { world: { terrain: new Uint8Array(320 * 320) },
    games: new Map([["a", game([attacker])], ["b", game([healer, ally])]]),
    combatRandom: () => .5, damageRandom: () => .5, onCombatEvent: event => events.push(event) };
  const combat = createCombat(env);
  combat.update(attacker, 0);
  attacker.attack.hitAt = .1;
  combat.update(attacker, .1);
  assert.equal(healer.combat.stunnedUntil, .6, "actual melee hit applies stun");
  return { attacker, healer, ally, combat, events };
}

test("retired support stays inactive after melee stun ends", () => {
  const f = fixture();
  f.combat.update(f.healer, .2);
  assert.equal(f.ally.health, 50, "no healing during melee stun");
  assert.equal(f.healer.dnaHealReady, .2, "blocked heal does not spend the next cycle");
  f.combat.update(f.healer, .6);
  assert.equal(f.ally.health, 50, "retired healing does not resume");
  assert.equal(f.healer.dnaHealReady, .2);
  assert.equal(f.events.filter(event => event.kind === "heal").length, 0);
});

test("retired support remains inactive after both stun deadlines", () => {
  for (const rangedEnd of [.3, .8]) {
    const f = fixture();
    f.healer.dnaStunnedUntil = rangedEnd;
    const end = Math.max(.6, rangedEnd);
    f.combat.update(f.healer, end - .01);
    assert.equal(f.ally.health, 50, `no healing before both stuns end (${rangedEnd})`);
    assert.equal(f.healer.dnaHealReady, .2);
    f.combat.update(f.healer, end);
    assert.equal(f.ally.health, 50);
    assert.equal(f.healer.dnaHealReady, .2);
  }
});
