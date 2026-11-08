import test from "node:test";
import assert from "node:assert/strict";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { unitRangedPose, unitRangedAttack, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { bladeRangedPose } from "./blade-ranged.mjs";
import { unitFrameMirror } from "./unit-size.mjs";
import { unitAnimationFrame } from "./unit-animation.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const fixture = (tribe, launches, reverse = false) => ({ tribe, health: 10, facing: reverse ? -1 : 1,
  attributes: { secretion: 1 }, stats: { ranged: true },
  attack: { dnaRanged: true, startedAt: 10, launchedAt: launches[0], hitAt: launches[0] + .333,
    shotLaunches: launches, endsAt: launches.at(-1), directionX: reverse ? -1 : 1 } });
const launchFrame = tribe => unitAnimationFrame(UNIT_RANGED_FORMS[tribe].animation, UNIT_RANGED_FORMS[tribe].animation.launchAtMs);

test("secretion-only terminal launches preserve all cues for every tribe, direction and combo cadence", () => {
  for (const tribe of tribes) for (const reverse of [false, true]) for (const count of [1, 2, 4, 13]) for (const gap of [.03, .12, .6]) {
    const launches = Array.from({ length: count }, (_, index) => 10.3 + index * gap);
    const agent = fixture(tribe, launches, reverse), before = structuredClone(agent);
    assert.ok(unitRangedAttack(agent));
    for (const [index, at] of launches.entries()) {
      const pose = unitRangedPose(agent, at);
      assert.equal(pose.action, "shoot"); assert.equal(pose.frame, launchFrame(tribe));
      assert.equal(pose.mirrorX, unitFrameMirror(UNIT_RANGED_FORMS[tribe].animation.sourceFacing, reverse ? -1 : 1));
      assert.deepEqual(unitRangedPose(JSON.parse(JSON.stringify(agent)), at), pose);
      if (index + 1 < count) assert.ok(unitRangedPose(agent, at + gap / 3).frame > launchFrame(tribe), "every nonterminal shot still recovers");
    }
    assert.equal(unitRangedPose(agent, launches.at(-1) + 1e-6).action, "idle", "no delayed final cue");
    assert.deepEqual(agent, before, "poses never modify the schedule");
  }
});

test("mathematically equal end and launch times tolerate arithmetic roundoff only", () => {
  for (const tribe of tribes) for (const start of [.1, 1, 10.01, 100.07, 3600.04]) {
    const launches = Array.from({ length: 4 }, (_, i) => start + .3 + i * .12);
    const unit = fixture(tribe, launches);
    unit.attack.startedAt = start; unit.attack.endsAt = start + (.3 + 3 * .12);
    for (const at of [...launches, unit.attack.endsAt]) {
      assert.equal(unitRangedPose(unit, at).frame, launchFrame(tribe));
      const blade = bladeRangedPose({ ...unit, attributes: { blade: 1, secretion: 1 } }, at);
      assert.equal(blade.frame, 10); assert.equal(blade.elapsed, 200);
    }
    for (const delta of [1e-9, .001, .15]) {
      assert.equal(unitRangedPose(unit, launches.at(-1) + delta).action, "idle");
      assert.equal(bladeRangedPose({ ...unit, attributes: { blade: 1, secretion: 1 } }, launches.at(-1) + delta), null);
    }
  }
});

test("finished, canceled, malformed and legacy snapshots do not invent terminal shots", () => {
  for (const tribe of tribes) {
    const agent = fixture(tribe, [10.3, 10.42, 10.54, 10.66]);
    for (const at of [10.3, 10.66, 10.8])
      assert.equal(unitRangedPose({ ...agent, attack: null }, at).action, "idle");
    assert.equal(unitRangedPose({ ...agent, health: 0 }, 10.66), null);
    for (const recorded of [[10.3, 10.42, 10.8], [10.3, 10.66, 10.66], [10.3, NaN], [10.42, 10.66]]) {
      const invalid = { ...agent, attack: { ...agent.attack, shotLaunches: recorded } };
      assert.equal(unitRangedPose(invalid, 10.3).frame, launchFrame(tribe));
      assert.equal(unitRangedPose(invalid, 10.66).action, "idle", "invalid metadata cannot invent a terminal cue");
    }
    const recovered = { ...agent, attack: { ...agent.attack, endsAt: 10.8 } };
    assert.equal(unitRangedPose(recovered, 10.8).action, "idle", "ordinary recovery-end boundary stays idle");
    const zeroLength = { ...agent, attack: { ...agent.attack, startedAt: 10.3, launchedAt: 10.3, endsAt: 10.3 } };
    assert.equal(unitRangedAttack(zeroLength), null);
    const legacy = { ...agent, attack: { mode: "ranged", startedAt: 10, hitAt: 10.3, endsAt: 10.6 } };
    assert.equal(unitRangedPose(legacy, 10.3).frame, launchFrame(tribe));
    assert.equal(unitRangedPose(legacy, 10.6).action, "idle");
    assert.equal(unitRangedPose(agent, NaN).action, "idle");
  }
});

function worldFixture(tribe, hits = 4, start = 0) {
  const gene = ATTRIBUTE_DNA.lookup.get("secretion");
  const dna = ATTRIBUTE_DNA.stats([{ gene: "secretion", grade: gene.grade, q: 0, r: 0, rotation: 0 }]);
  const source = { id: "source", ownerId: "a", tribe, x: 100, y: 100, health: 100,
    attributes: { secretion: 1 }, combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: { ...dna, rangedSpeed: 4, hits, focus: .3, comboSpeed: .12 } } };
  const target = { id: "target", ownerId: "b", tribe: "bean", x: 102, y: 100, health: 100,
    attributes: {}, attackReady: 1000, combatDisposition: "passive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, combatStrength: 10 } };
  const events = [];
  const game = agents => ({ agents, receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const env = { world: { terrain: new Uint8Array(320 * 320) },
    games: new Map([["a", game([source])], ["b", game([target])]]),
    combatRandom: () => .99, damageRandom: () => .5, onCombatEvent: event => events.push(event) };
  const combat = createCombat(env); combat.update(source, start);
  return { source, target, env, combat, events };
}
const normalize = value => JSON.parse(JSON.stringify(value, (key, value) => key === "streamId" ? undefined :
  typeof value === "string" ? value.replace(/combat-vfx:[a-f0-9-]+:/g, "combat-vfx:STREAM:") : value));

test("real world schedules retain native recovery without delaying shots or retaining a replaced action", () => {
  for (const tribe of tribes) for (const hits of [1, 4]) for (const start of [0, .1, 10.01]) {
    const f = worldFixture(tribe, hits, start), control = worldFixture(tribe, hits, start);
    const snapshot = structuredClone(f.source), first = f.source.attack;
    const launches = [...first.shotLaunches];
    assert.ok(first.endsAt > launches.at(-1), "actual world schedule retains native final recovery");
    assert.equal(first.hitAt > first.launchedAt, true, "world hitAt is arrival, not release");
    for (const at of launches) {
      const oldPose = unitRangedPose(snapshot, at);
      assert.equal(oldPose.action, "shoot"); assert.equal(oldPose.frame, launchFrame(tribe));
      f.combat.update(f.source, at); control.combat.update(control.source, at);
      unitRangedPose(f.source, at);
      assert.deepEqual(normalize(f.source), normalize(control.source));
      assert.deepEqual(normalize(f.target), normalize(control.target));
      assert.deepEqual(normalize(f.events), normalize(control.events));
    }
    const shots = f.events.filter(event => event.kind === "shoot" && event.sourceId === f.source.id);
    assert.deepEqual(shots.map(event => event.at), launches, "all actual launches, including the final boundary, fire once");
    f.combat.update(f.source, first.endsAt);
    assert.notEqual(f.source.attack, first, "server retires the action at its recovery boundary");
    if (f.source.attack) assert.ok(f.source.attack.startedAt >= first.endsAt, "the next action uses a new epoch");
    else assert.equal(unitRangedPose(f.source, first.endsAt).action, "idle");
    assert.equal(unitRangedPose(snapshot, first.endsAt + .001).action, "idle");
    f.source.attack = null;
    assert.equal(unitRangedPose(f.source, launches.at(-1)).action, "idle", "clearing the action cancels its body pose immediately");
  }
});
