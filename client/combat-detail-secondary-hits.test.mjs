import test from "node:test";
import assert from "node:assert/strict";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const agents = [{ id: "source", tribe: "spring" }, { id: "target", tribe: "bean" }, { id: "other", tribe: "spore" }];
const positions = new Map(agents.map((agent, index) => [agent.id, { x: 100 + index * 180, y: 260, width: 60, height: 100 }]));
const view = { scope: "fight", width: 600, height: 350 };
function scene() {
  const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  function draw(time, events, visible = agents, points = positions, viewport = view) {
    detail.consume(cursor.consume({ streamId: "fight", events }, time), time);
    return detail.commands(visible, points, time, 130, viewport);
  }
  draw(0, []);
  return { draw, detail };
}
const damage = (kind, targetId, extra = {}) => ({ id: kind + ":" + targetId, kind, at: 1,
  sourceId: "source", targetId, amount: 2, ...extra });

test("area and reflection reuse the approved general hit only at the actual damaged recipient", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const mode of ["melee", "ranged"])
    for (const kind of ["area", "reflect"]) {
      const { draw } = scene(), source = { ...agents[0], tribe };
      const event = damage(kind, "other", { mode, projectileId: "parent-shot", critical: true });
      const commands = draw(1.05, [event], [source, ...agents.slice(1)]);
      assert.equal(commands.length, 1, tribe + ":" + mode + ":" + kind);
      assert.equal(commands[0].image, DETAIL_COMBAT_VFX.hit.image, "secondary damage is not another species projectile");
      assert.equal(commands[0].kind, "impact");
      assert.equal(commands[0].targetId, "other");
      assert.equal(commands[0].x, positions.get("other").x);
      assert.equal(commands[0].y, positions.get("other").y - 50);
      assert.equal(commands[0].eventId, event.id);
    }
});

test("simultaneous direct, splash and reflected hits remain distinct and never restart", () => {
  const { draw } = scene();
  const events = [damage("hit", "target", { mode: "ranged" }),
    damage("area", "other", { mode: "ranged" }),
    damage("reflect", "source", { sourceId: "target", fromId: "target", toId: "source" })];
  const commands = draw(1.05, events);
  assert.deepEqual(commands.map(command => [command.targetId, command.image]).sort(), [
    ["other", DETAIL_COMBAT_VFX.hit.image], ["source", DETAIL_COMBAT_VFX.hit.image], ["target", DETAIL_COMBAT_VFX.spring.image]
  ]);
  assert.equal(draw(1.1, [...events.toReversed(), ...events]).length, 3);
  assert.equal(draw(1.42, events).length, 3, "every approved clip keeps its authored tail");
  assert.equal(draw(1.5, events).length, 0);
  assert.equal(draw(1.55, events).length, 0);
});

test("zero damage, defense, cancellation and non-hit channels do not invent secondary bursts", () => {
  for (const kind of ["area", "reflect"]) assert.equal(scene().draw(1.05, [damage(kind, "target", { amount: 0 })]).length, 0);
  for (const kind of ["dodge", "parry", "projectile-cancel", "bleed", "heal", "drain", "regeneration"])
    assert.equal(scene().draw(1.05, [damage(kind, "target")]).length, 0, kind);
  assert.equal(scene().draw(1.05, [damage("block", "target", { amount: 0 })]).length, 0);
});

test("secondary lethal hits use only observed death anchors and clear on view changes", () => {
  for (const kind of ["area", "reflect"]) {
    const { draw, detail } = scene(), event = damage(kind, "other");
    draw(.9, []);
    assert.equal(draw(1.05, [event], agents.slice(0, 2), new Map([...positions].slice(0, 2))).length, 0,
      "a living omitted target has no inferred location");
    const death = { id: "death", kind: "death", targetId: "other", at: 1, amount: 0 };
    const commands = draw(1.1, [event, death], [], new Map());
    assert.equal(commands.length, 1);
    assert.equal(commands[0].x, positions.get("other").x);
    const resized = draw(1.1, [event, death], [], new Map(), { ...view, width: 300, height: 175 });
    assert.equal(resized[0].x, commands[0].x / 2);
    assert.equal(resized[0].y, commands[0].y / 2);
    detail.clearView();
    assert.equal(draw(1.15, [event, death], [], new Map()).length, 0);
  }
});

function serverScene() {
  const dna = ids => ATTRIBUTE_DNA.stats(ids.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 }; }));
  const unit = (id, ownerId, stats) => ({ id, ownerId, tribe: "bean", x: 100, y: 100, health: 100,
    combatDisposition: "aggressive", attributes: {}, stats: { health: 100, speed: 1, vision: 3, dna: stats },
    moveStartedAt: 0, moveDuration: 0 });
  const source = unit("source", "left", { ...dna(["blade"]), area: 1, areaPower: 50 });
  const target = unit("target", "right", { ...dna([]), reflection: 50 });
  const other = unit("other", "right", { ...dna([]), reflection: 50 }), units = [source, target, other];
  let rolls = 0;
  const environment = { games: new Map(), colonies: [], world: { terrain: new Uint8Array(320 * 320).fill(4) },
    combatRandom: () => { rolls++; return .99; }, damageRandom: () => { rolls++; return .5; } };
  for (const ownerId of ["left", "right"]) environment.games.set(ownerId, {
    agents: units.filter(agent => agent.ownerId === ownerId),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); }
  });
  const combat = createCombat(environment);
  const tick = time => { environment.simSeconds = time; for (const agent of units) if (agent.health > 0) combat.update(agent, time); };
  return { units, source, environment, tick, rolls: () => rolls };
}

test("real area-plus-reflection combat renders all actual damage without altering state or random calls", () => {
  const live = serverScene(), control = serverScene(), { draw } = scene();
  live.tick(0); control.tick(0);
  draw(0, snapshotCombatVfx(live.environment, 0).events, live.units);
  const time = live.source.attack.hitAt;
  live.tick(time); control.tick(time);
  const snapshot = snapshotCombatVfx(live.environment, time), damageEvents = snapshot.events.filter(event => event.amount > 0);
  assert.deepEqual(damageEvents.map(event => event.kind), ["hit", "area", "reflect"]);
  const commands = draw(time, snapshot.events, live.units);
  assert.equal(commands.length, 3);
  for (const event of damageEvents) {
    const command = commands.find(command => command.eventId === event.id);
    assert.ok(command, event.kind + " has an actual effect");
    assert.equal(command.targetId, event.targetId);
    assert.equal(command.amount, event.amount);
  }
  assert.deepEqual(live.units, control.units);
  assert.equal(live.rolls(), control.rolls());
  const outcomes = snapshot => snapshot.events.map(({ kind, at, amount, sourceId, targetId, sequence }) =>
    ({ kind, at, amount, sourceId, targetId, sequence }));
  assert.deepEqual(outcomes(snapshot), outcomes(snapshotCombatVfx(control.environment, time)));
});
