import test from "node:test";
import assert from "node:assert/strict";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { recordCombatVfx, snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const agents = [{ id: "source", tribe: "bean", stats: { ranged: true, melee: false } },
  { id: "target", tribe: "spore", health: 50 }];
const points = new Map([["source", { x: 180, y: 350, width: 100, height: 140 }],
  ["target", { x: 820, y: 310, width: 100, height: 140 }]]);
const view = { scope: "fight", width: 1000, height: 500 };
function scene(tribe = "bean", initialize = true) {
  const environment = {}, cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  const units = [{ ...agents[0], tribe }, agents[1]], launch = recordCombatVfx(environment, {
    kind: "shoot", sourceId: "source", targetId: "target", amount: 0, mode: "ranged",
    at: 1, arrivesAt: 2, projectileId: "shot", from: { x: 10, y: 10 }, to: { x: 12, y: 10 } });
  function draw(time, visible = ["source", "target"]) {
    const snapshot = snapshotCombatVfx(environment, time, { agentIds: new Set(visible), isVisible: () => false });
    const before = structuredClone(snapshot), frame = cursor.consume(snapshot, time);
    detail.consume(frame, time);
    const commands = detail.commands(units.filter(agent => visible.includes(agent.id)),
      new Map([...points].filter(([id]) => visible.includes(id))), time, 250, view);
    assert.deepEqual(snapshot, before, "rendering must not rewrite the server snapshot");
    return { snapshot, frame, commands };
  }
  if (initialize) draw(0);
  return { environment, cursor, detail, draw, launch, units };
}

test("an ongoing flight becomes drawable when the server reveals either initially hidden endpoint", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const hidden of ["source", "target"])
    for (const initialize of [false, true]) {
      const { draw, launch, environment } = scene(tribe, initialize), other = hidden === "source" ? "target" : "source";
      const partial = draw(1.1, [other]);
      assert.equal(partial.snapshot.events[0][hidden + "Id"], null);
      assert.equal(partial.commands.length, 0, "an unseen endpoint has no invented position");
      // Revealing an old launch is ongoing state reconstruction, not a late burst.
      const revealed = draw(1.6);
      assert.equal(revealed.frame.started.length, 0, "visibility does not restart the launch cue");
      assert.equal(revealed.commands.length, 1, tribe + ":" + hidden + ":" + initialize);
      assert.ok(Math.abs(revealed.frame.projectiles[0].progress - .6) < 1e-9);
      assert.equal(revealed.frame.projectiles[0].sourceId, "source");
      assert.equal(revealed.frame.projectiles[0].targetId, "target");
      assert.equal(revealed.commands[0].image, DETAIL_COMBAT_VFX[tribe].image);
      assert.equal(revealed.commands[0].launchedAt, launch.at);
      assert.equal(revealed.commands[0].arrivesAt, launch.arrivesAt);
      assert.deepEqual(draw(1.6).commands, revealed.commands, "repeating a snapshot never restarts the flight");
      assert.equal(draw(2).commands.length, 1, "revealed flight remains pending until its actual result");
      recordCombatVfx(environment, { ...launch, kind: "projectile-cancel", at: 2.1 });
      assert.equal(draw(2.1).commands.length, 0, "observed cancellation ends the revealed flight");
    }
});

test("later redactions replace known endpoint fields rather than retaining off-screen information", () => {
  for (const hidden of ["source", "target"]) {
    const { draw } = scene(), initial = draw(1.1), other = hidden === "source" ? "target" : "source";
    assert.equal(initial.commands.length, 1);
    const redacted = draw(1.2, [other]), flight = redacted.frame.projectiles[0];
    assert.equal(flight[hidden + "Id"], null);
    assert.equal(Object.hasOwn(flight, hidden === "source" ? "from" : "to"), false);
    assert.equal(redacted.commands.length, 0);
    const returning = draw(1.3);
    assert.equal(returning.commands.length, 1);
    assert.equal(returning.frame.started.length, 0);
    assert.equal(returning.frame.projectiles[0].launchedAt, 1);
  }
});

test("ongoing statuses follow refreshed recipients without restarting or extending their lifetime", () => {
  const { environment, draw } = scene();
  const status = recordCombatVfx(environment, { kind: "stun", sourceId: "source", targetId: "target",
    amount: 0, at: 1, endsAt: 3, from: { x: 10, y: 10 }, to: { x: 12, y: 10 } });
  assert.equal(draw(1.1, ["source"]).frame.active.find(cue => cue.eventId === status.id).anchorId, null);
  const revealed = draw(1.6);
  const cue = revealed.frame.active.find(cue => cue.eventId === status.id);
  assert.equal(cue.anchorId, "target"); assert.equal(cue.endsAt, 3); assert.equal(cue.at, 1);
  assert.equal(revealed.frame.started.length, 0);
  assert.equal(draw(3).frame.active.some(cue => cue.eventId === status.id), false);
});

test("visibility changes never replay impacts or restorations that were consumed off-screen", () => {
  for (const kind of ["hit", "block", "area", "reflect", "bleed", "drain", "regeneration", "death"]) {
    const { environment, draw, detail, units } = scene();
    recordCombatVfx(environment, { kind, sourceId: "source", targetId: "target", at: 1,
      amount: kind === "death" ? 0 : 2, from: { x: 10, y: 10 }, to: { x: 12, y: 10 } });
    draw(1.05, ["source"]);
    const revealed = draw(1.1);
    assert.equal(revealed.frame.started.length, 0, kind + " does not replay");
    assert.equal(revealed.commands.filter(command => command.kind === "impact").length, 0);
    assert.equal(detail.vitalCommands(units, points, 1.1, view).length, 0);
  }
});

test("cancellation closes a partially observed shot and revealing it does not invent arrival art", () => {
  const { environment, draw } = scene();
  draw(1.05, ["target"]);
  recordCombatVfx(environment, { kind: "projectile-cancel", sourceId: "source", targetId: "target",
    at: 1.2, amount: 0, projectileId: "shot", from: { x: 10, y: 10 }, to: { x: 12, y: 10 } });
  assert.equal(draw(1.25, ["target"]).commands.length, 0);
  const revealed = draw(1.3);
  assert.equal(revealed.frame.projectiles.length, 0); assert.equal(revealed.commands.length, 0);
  assert.equal(revealed.frame.started.length, 0);
});

test("future events acquire their current visible recipient before firing once at the original time", () => {
  const cursor = createCombatVfxCursor();
  cursor.consume({ streamId: "future", events: [] }, 0);
  const event = { id: "future-hit", kind: "hit", sourceId: "source", targetId: null, at: 1, amount: 2 };
  assert.equal(cursor.consume({ streamId: "future", events: [event] }, .8).started.length, 0);
  const visible = { ...event, targetId: "target", to: { x: 12, y: 10 } };
  assert.equal(cursor.consume({ streamId: "future", events: [visible] }, .9).started.length, 0);
  const due = cursor.consume({ streamId: "future", events: [visible] }, 1.05);
  assert.equal(due.started.length, 1); assert.equal(due.started[0].anchorId, "target");
  assert.equal(due.started[0].at, 1);
  assert.equal(cursor.consume({ streamId: "future", events: [visible] }, 1.1).started.length, 0);
});
