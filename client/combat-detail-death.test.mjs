import { presentationRenderer } from "./unit-presentation-test-harness.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createDetailCombatDeath, detailDeathForm } from "./combat-detail-death.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from "./combat-detail-vfx.mjs";
import { agentDeathAnimation, agentDeathFrame } from "./agent-death.mjs";
import { unitRangedLifecycleAnimation } from "./unit-ranged.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";
import { imageDimensions } from "./image-audit.mjs";
import { createGame } from "../server/game.mjs";

const unit = extra => ({ id: "target", tribe: "bean", health: 10, x: 100, y: 100, attributes: {}, combat: { id: "fight", side: 1 }, ...extra });
const corpse = extra => ({ id: "corpse:target", agentId: "target", kind: "corpse", tribe: "bean", x: 100, y: 100,
  attributes: {}, diedAt: 1, decaysAt: 4, facing: 1, ...extra });
const point = { x: 600, y: 360, width: 80, height: 120 };
const view = { scope: "fight", roomId: "room", streamId: "stream", width: 1040, height: 480 };
const camera = { width: 1040, height: 480, cell: 160 };
function watched(agent = unit(), options = {}) {
  const tracker = createDetailCombatDeath();
  tracker.begin(.95, { ...view, visibleIds: [agent.id], livingAgents: [agent], ...options });
  tracker.observe(agent, point, { scale: 1.4, facing: -1 });
  tracker.begin(1.05, { ...view, visibleIds: [], livingAgents: [], ...options });
  return tracker;
}

test("only eight approved base/secretion routes are eligible, preserving current dominance and legacy exclusions", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    assert.equal(detailDeathForm(unit({ tribe })), tribe + "/base");
    assert.equal(detailDeathForm(unit({ tribe, attributes: { feet: 1 } })), tribe + "/base");
    assert.equal(detailDeathForm(unit({ tribe, attributes: { secretion: 1, carapace: 1, antenna: 1 } })), null);
    assert.equal(detailDeathForm(unit({ tribe, attributes: { secretion: 1 } })), tribe + "/secretion");
    for (const key of ["blade", "carapace", "antenna", "strength", "arms", "piercing", "guard"])
      assert.equal(detailDeathForm(unit({ tribe, attributes: { [key]: 1 } })), null);
  }
  assert.equal(detailDeathForm(unit({ species: "spiny-back-beetle" })), null);
  assert.equal(detailDeathForm(unit({ tribe: "unknown" })), null);
});

test("authoritative corpse plus observed fighter preserves final modal anchor, scale and facing without mutation", () => {
  const record = corpse(), before = structuredClone(record), tracker = watched();
  const first = tracker.commands([record, record], 1.05, camera);
  assert.equal(first.length, 1); assert.deepEqual(first[0].point, point); assert.equal(first[0].scale, 1.4);
  assert.equal(first[0].corpse.facing, -1, "last modal facing overrides the different world-corpse facing only in the copy");
  assert.equal(first[0].corpse.health, 0); assert.equal(first[0].corpse.diedAt, 1); assert.equal(first[0].cell, 160);
  assert.deepEqual(record, before);
  tracker.begin(3.9, { ...view, visibleIds: [], livingAgents: [] });
  const resized = tracker.commands([record], 3.9, { width: 520, height: 240, cell: 80 });
  assert.equal(resized.length, 1); assert.equal(resized[0].point.x, point.x / 2); assert.equal(resized[0].point.y, point.y / 2);
  assert.equal(resized[0].scale, 1.4); assert.equal(resized[0].cell, 80); assert.equal(resized[0].age, 2.9);
  assert.equal(tracker.commands([record], 4, camera).length, 0);
});

test("unseen, unconfirmed, stale, moved or different-form deaths never create a body", () => {
  for (const patch of [{ agentId: "other" }, { kind: "resource" }, { x: 101 }, { y: 101 }, { diedAt: .8 },
    { diedAt: 2 }, { diedAt: NaN }, { decaysAt: 1 }, { attributes: { blade: 1 } }, { tribe: "spore" }])
    assert.equal(watched().commands([corpse(patch)], 1.05, camera).length, 0);
  const never = createDetailCombatDeath(); never.begin(1.05, view);
  assert.equal(never.commands([corpse()], 1.05, camera).length, 0);
  assert.equal(watched().commands([], 1.05, camera).length, 0);
  assert.equal(watched().commands([corpse()], 1.9, camera).length, 0, "late first discovery does not start an old death");
  const stale = watched(); stale.begin(2, view);
  assert.equal(stale.commands([corpse()], 2, camera).length, 0);
});

test("living departure, omitted arena slots, view/room/stream changes, close and time reversal clear anchors", () => {
  for (const change of [{ scope: "other" }, { roomId: "new-room" }, { streamId: "replacement" }]) {
    const tracker = watched(); tracker.begin(1.05, { ...view, ...change });
    assert.equal(tracker.commands([corpse()], 1.05, camera).length, 0);
  }
  for (const combat of [{ id: "other", side: 0 }, null, { id: "fight", side: 1 }]) {
    const tracker = watched(); tracker.begin(1.06, { ...view, visibleIds: [], livingAgents: [unit({ combat })] });
    tracker.begin(1.07, { ...view, visibleIds: [], livingAgents: [] });
    assert.equal(tracker.commands([corpse({ diedAt: 1.07, decaysAt: 4.07 })], 1.07, camera).length, 0);
  }
  const current = watched(); current.begin(1.05, { ...view, visibleIds: ["target"], livingAgents: [unit()] });
  assert.equal(current.commands([corpse()], 1.05, camera).length, 0, "no corpse on top of a still-living actor");
  const reversed = watched(); reversed.begin(.9, view); assert.equal(reversed.commands([corpse()], 1.1, camera).length, 0);
  const closed = watched(); closed.clear(); closed.begin(1.1, view); assert.equal(closed.commands([corpse()], 1.1, camera).length, 0);
});

test("corpse snapshot absence hides a confirmed body; return continues original time rather than replaying it", () => {
  const tracker = watched(); assert.equal(tracker.commands([corpse()], 1.05, camera).length, 1);
  assert.equal(tracker.commands([], 1.2, camera).length, 0);
  const continued = tracker.commands([corpse()], 1.6, camera);
  assert.equal(continued.length, 1); assert.ok(Math.abs(continued[0].age - .6) < 1e-9); assert.equal(continued[0].corpse.diedAt, 1);
  assert.equal(tracker.commands([corpse({ diedAt: 1.2, decaysAt: 4.2 })], 1.6, camera).length, 0);
});

test("delayed snapshots compare death with authoritative living time, not the extrapolated paint clock", () => {
  const tracker = createDetailCombatDeath();
  tracker.begin(1.14, { ...view, snapshotTime: .95, visibleIds: ["target"], livingAgents: [unit()] });
  tracker.observe(unit(), point, { scale: 1.4, facing: -1 });
  tracker.begin(1.16, { ...view, snapshotTime: 1.15, visibleIds: [], livingAgents: [] });
  const rows = tracker.commands([corpse()], 1.16, camera);
  assert.equal(rows.length, 1); assert.ok(Math.abs(rows[0].age - .16) < 1e-9);
  const impossible = createDetailCombatDeath();
  impossible.begin(1.14, { ...view, snapshotTime: 1.1, visibleIds: ["target"], livingAgents: [unit()] });
  impossible.observe(unit(), point, { scale: 1.4, facing: -1 });
  impossible.begin(1.16, { ...view, snapshotTime: 1.15, visibleIds: [], livingAgents: [] });
  assert.equal(impossible.commands([corpse()], 1.16, camera).length, 0, "a corpse cannot predate an authoritative living observation");
  const ending = createDetailCombatDeath();
  ending.begin(1.14, { ...view, snapshotTime: .95, visibleIds: ["target"], livingAgents: [unit()] });
  ending.observe(unit(), point, { scale: 1.4, facing: -1 });
  ending.begin(1, { ...view, snapshotTime: 1, visibleIds: [], livingAgents: [] });
  assert.equal(ending.commands([corpse()], 1, camera).length, 1, "terminal clock correction does not erase a witnessed death");
  ending.begin(1.1, { ...view, snapshotTime: .9, visibleIds: [], livingAgents: [] });
  assert.equal(ending.commands([corpse()], 1.1, camera).length, 0, "authoritative rewind still invalidates every anchor");
});

test("real authoritative base/secretion corpses are accepted without modifying server state", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const secretion of [false, true]) {
    const colony = { id: 1, ownerId: "death", tribe, x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
    const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
      colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
    const game = createGame(environment, colony); environment.games.set(colony.ownerId, game);
    const agent = game.agents[0];
    Object.assign(agent, { tribe, birth: null, x: 100, y: 100, combat: { id: "fight", side: 1 },
      dna: null, stats: { ...agent.stats, dna: null },
      attributes: secretion ? { secretion: 1 } : {}, appearanceAttributes: secretion ? { secretion: 1 } : {} });
    const tracker = watched(agent); game.prepare(1); game.receiveDamage(agent, 100000);
    const records = game.snapshot().corpses, record = records.find(row => row.agentId === agent.id);
    assert.ok(record); const before = JSON.stringify(game.save());
    const rows = tracker.commands(records, 1.05, camera); assert.equal(rows.length, 1); assert.equal(rows[0].corpse.agentId, agent.id);
    assert.equal(rows[0].form, tribe + (secretion ? "/secretion" : "/base")); assert.equal(JSON.stringify(game.save()), before);
  }
});
