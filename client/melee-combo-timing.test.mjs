import test from "node:test";
import assert from "node:assert/strict";
import { attackAnimationElapsed, AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION } from "../server/attack.mjs";
import { combatEvolutionPose } from "./combat-evolution.mjs";
import { COMBAT_EVOLUTION_CATALOG } from "./combat-evolution-assets.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";
import { unitAnimationPose, unitAnimationFrame } from "./unit-animation.mjs";

const attack = (contacts = [10.3, 10.42, 10.54, 10.66]) => ({ combatId: "combo", startedAt: 10,
  hitAt: contacts.at(-1), endsAt: contacts.at(-1) + .35, meleeContacts: contacts });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("melee follow-ups keep every authoritative contact at the existing impact pose", () => {
  for (const interval of [.06, .12, .3, 1.4]) for (const count of [2, 4, 13]) {
    const contacts = Array.from({ length: count }, (_, index) => 10.3 + index * interval), value = attack(contacts);
    for (const at of contacts) near(attackAnimationElapsed(value, at, .3, 1), .3);
    near(attackAnimationElapsed(value, 10, .3, 1), 0);
    near(attackAnimationElapsed(value, value.endsAt, .3, 1), 1);
  }
});

test("each landed swing recovers before the next preparation instead of rewinding immediately", () => {
  const value = attack();
  for (let index = 0; index < value.meleeContacts.length - 1; index++) {
    const at = value.meleeContacts[index], next = value.meleeContacts[index + 1], restart = at + (next - at) * .7;
    assert.ok(attackAnimationElapsed(value, at + .001, .3, 1) > .3);
    near(attackAnimationElapsed(value, restart - .000001, .3, 1), 1 - .000001 / (restart - at) * .7);
    near(attackAnimationElapsed(value, restart, .3, 1), 0);
    assert.ok(attackAnimationElapsed(value, next - .001, .3, 1) < .3);
  }
});

test("scheduling a follow-up does not move the current contact or any earlier swing", () => {
  const contacts = attack().meleeContacts;
  for (let index = 1; index < contacts.length; index++) {
    const before = attack(contacts.slice(0, index)), after = attack(contacts.slice(0, index + 1));
    const current = contacts[index - 1];
    near(attackAnimationElapsed(before, current, .3, 1), attackAnimationElapsed(after, current, .3, 1));
    for (const at of [10, 10.15, current - .00001])
      near(attackAnimationElapsed(before, at, .3, 1), attackAnimationElapsed(after, at, .3, 1));
  }
});

test("selected authored bodies and ordinary bodies hit on every melee contact", () => {
  for (const [key, definition] of Object.entries(COMBAT_EVOLUTION_CATALOG)) {
    const tribe = key.startsWith("sprout/") ? "bean" : key.split("/")[0];
    const agent = { id: key, tribe, attributes: { blade: 1, carapace: 1, antenna: 1, feet: 1 },
      combat: { version: 2 }, health: 10, bornAt: 0, hurtStartedAt: -Infinity, attack: { ...attack(), recovery: .35 } };
    for (const at of agent.attack.meleeContacts) {
      const pose = combatEvolutionPose(agent, at, definition.animations);
      const animation = unitActionArtDefinition(agent).actions.attack;
      assert.equal(pose.action, "attack");
      assert.equal(pose.animation, animation);
      assert.equal(pose.frame, unitAnimationFrame(animation, animation.hitTimeMs));
      const ordinary = unitAnimationPose(agent, at); assert.equal(ordinary.action, "attack"); assert.equal(ordinary.frame, 5);
    }
    assert.equal(combatEvolutionPose({ ...agent, attack: null }, 10.5, definition.animations).action, "idle");
    assert.equal(combatEvolutionPose({ ...agent, health: 0, diedAt: 10.4 }, 10.5, definition.animations).action, "death");
  }
});

test("legacy, single-hit, malformed and exchange clocks retain their existing behavior", () => {
  const base = { combatId: "old", startedAt: 10, hitAt: 10.3, endsAt: 10.8, speed: 2 };
  const fallback = (value, at) => {
    if (!value.combatId || value.exchange) return (at - value.startedAt) * value.speed;
    if (at >= value.endsAt) return 1;
    return at <= value.hitAt ? (at - value.startedAt) / (value.hitAt - value.startedAt) * .3 :
      .3 + Math.min(1, (at - value.hitAt) / (value.endsAt - value.hitAt)) * .7;
  };
  for (const contacts of [undefined, [], [10.3], [10.3, 10.3], [10.4, 10.3], [9, 10.3], [10.2, NaN], [10.2, 10.31]]) {
    const value = { ...base, meleeContacts: contacts };
    for (const at of [9.99, 10, 10.1, 10.3, 10.7, 10.8, 11]) near(attackAnimationElapsed(value, at, .3, 1), fallback(value, at));
  }
  for (const value of [{ ...attack(), exchange: true, speed: 2 }, { ...attack(), combatId: null, speed: 2 }])
    near(attackAnimationElapsed(value, 10.5, .3, 1), 1);
});

test("contact clock respects clip-specific hit timing and survives JSON transport", () => {
  const value = attack(), wire = JSON.parse(JSON.stringify(value));
  for (const [contact, duration] of [[.3, 1], [AGENT_ATTACK_HIT_TIME, AGENT_ATTACK_DURATION], [.45, 1.3]]) {
    for (const at of value.meleeContacts) near(attackAnimationElapsed(wire, at, contact, duration), contact);
    for (let index = 0; index < 101; index++) {
      const time = 10 + index / 100;
      near(attackAnimationElapsed(wire, time, contact, duration), attackAnimationElapsed(value, time, contact, duration));
    }
  }
});


test("fast melee combos with zero final recovery still reach each contact", () => {
  for (const contacts of [[10.08], [10.08, 10.2], [10.08, 10.2, 10.32, 10.44]]) {
    const value = { ...attack(contacts), endsAt: contacts.at(-1), speed: 12.5 };
    for (const at of contacts) near(attackAnimationElapsed(value, at, .3, 1), .3);
    near(attackAnimationElapsed(value, value.endsAt + .0001, .3, 1), 1);
    assert.ok(attackAnimationElapsed(value, contacts[0] * .5 + 5, .3, 1) < .3);
  }
});
