import test from "node:test";
import assert from "node:assert/strict";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX } from "./combat-detail-vfx.mjs";
import { unitRangedProjectile } from "./unit-ranged.mjs";

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${label}: ${actual} != ${expected}`);
function head(command) {
  return { x: command.x + Math.cos(command.angle) * command.size * .25,
    y: command.y + Math.sin(command.angle) * command.size * .25 };
}
function scene(tribe = "bean", reverse = false, initialize = true) {
  const agents = [{ id: "source", tribe, stats: { ranged: true, melee: false } },
    { id: "target", tribe: "bean" }];
  const positions = new Map([["source", { x: reverse ? 820 : 180, y: 350, width: 100, height: 140 }],
    ["target", { x: reverse ? 180 : 820, y: 310, width: 100, height: 140 }]]);
  const view = { scope: "battle", width: 1000, height: 500 };
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const launch = { id: "launch", kind: "shoot", sourceId: "source", targetId: "target",
    mode: "ranged", projectileId: "shot", at: 1, arrivesAt: 2 };
  const draw = (time, events = [launch], visible = agents, cell = 250) => {
    detail.consume(cursor.consume({ streamId: "stream", events }, time), time);
    return detail.commands(visible, positions, time, cell, view);
  };
  if (initialize) draw(0, []);
  return { agents, positions, view, detail, launch, draw };
}

test("each species keeps its first observed flight origin through shooter recoil and recovery", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true]) {
    const { positions, draw } = scene(tribe, reverse);
    const initial = head(draw(1)[0]);
    const progress = .35, target = positions.get("target");
    Object.assign(positions.get("source"), { x: 500, y: 440 });
    const command = draw(1 + progress)[0], actual = head(command);
    close(actual.x, initial.x + (target.x - initial.x) * progress, tribe + " x");
    close(actual.y, initial.y + (target.y - target.height * .5 - initial.y) * progress, tribe + " y");
    assert.equal(command.image, DETAIL_COMBAT_VFX[tribe].image);
    assert.deepEqual(draw(1 + progress)[0], command, "replayed snapshots do not move the anchor");
  }
});

test("late first observation uses only the visible outlet and continues tracking the moving target", () => {
  const { agents, positions, draw } = scene("spring", false, false);
  const source = positions.get("source"), sprite = unitRangedProjectile(agents[0]);
  const origin = { x: source.x + (sprite.outletX - 256) * sprite.sourceScale * 2.5,
    y: source.y + (sprite.outletY - 448) * sprite.sourceScale * 2.5 };
  draw(1.4); // No position at the actual launch was observed.
  Object.assign(source, { x: 320, y: 400 });
  Object.assign(positions.get("target"), { x: 700, y: 380 });
  const command = draw(1.6)[0], actual = head(command), target = positions.get("target");
  close(actual.x, origin.x + (target.x - origin.x) * .6, "late x");
  close(actual.y, origin.y + (target.y - target.height * .5 - origin.y) * .6, "late y");
});

test("overlapping shots keep independent outlets and resize without returning to the moving shooter", () => {
  const { positions, view, launch, draw } = scene("spore");
  const first = head(draw(1)[0]);
  positions.get("source").x += 70;
  const second = { ...launch, id: "launch-2", projectileId: "shot-2", at: 1.2, arrivesAt: 2.2 };
  const together = draw(1.2, [launch, second]);
  const secondOrigin = head(together[1]);
  close(head(together[0]).x, first.x * .8 + positions.get("target").x * .2,
    "the new launch does not move the older flight");
  close(secondOrigin.x - first.x, 70, "second shot uses its own observed outlet");
  positions.get("source").x += 100;
  const before = draw(1.4, [launch, second]);
  close(head(before[0]).x, first.x * .6 + positions.get("target").x * .4, "older shot recovery");
  close(head(before[1]).x, secondOrigin.x * .8 + positions.get("target").x * .2, "newer shot recovery");
  view.width /= 2; view.height /= 2;
  for (const point of positions.values()) for (const key of ["x", "y", "width", "height"]) point[key] /= 2;
  const after = draw(1.4, [launch, second], undefined, 125);
  for (let index = 0; index < 2; index++) for (const key of ["x", "y", "size"])
    close(after[index][key], before[index][key] / 2, "resize " + index + " " + key);
});

test("view clear, battle switch and backseek discard flight anchors; absent units are never invented", () => {
  for (const reset of ["close", "scope", "backseek"]) {
    const { agents, positions, view, detail, draw } = scene();
    const original = head(draw(1)[0]);
    positions.get("source").x += 100;
    positions.delete("target");
    assert.equal(draw(1.1).length, 0, "missing target has no invented endpoint");
    positions.set("target", { x: 820, y: 310, width: 100, height: 140 });
    assert.equal(draw(1.1, undefined, agents.slice(1)).length, 0, "off-roster source has no flight");
    if (reset === "close") detail.clearView();
    if (reset === "scope") view.scope = "another-battle";
    if (reset === "backseek") draw(.9, []);
    const restarted = head(draw(1.2)[0]);
    close(restarted.x, (original.x + 100) * .8 + 820 * .2, reset + " obtains a fresh observed outlet");
  }
});

test("an initially hidden shot obtains an anchor only when both actors have visible positions", () => {
  const { positions, draw } = scene("bean");
  const target = positions.get("target");
  positions.delete("target");
  assert.equal(draw(1).length, 0);
  positions.get("source").x += 80;
  positions.set("target", target);
  const firstSeen = head(draw(1.4)[0]);
  positions.get("source").x += 120;
  assert.deepEqual(head(draw(1.4)[0]), firstSeen, "no unseen launch position was cached or reconstructed");
});

test("authoritative cancellation removes a frozen flight without creating an impact", () => {
  const { launch, draw } = scene("pebble");
  assert.equal(draw(1).length, 1);
  assert.equal(draw(1.2, [launch, { ...launch, id: "cancel", kind: "projectile-cancel", at: 1.2 }]).length, 0);
  assert.equal(draw(2.1).length, 0);
});

test("an arena launch follows camera projection changes while ignoring shooter recoil", () => {
  const { agents, positions, view, launch, draw } = scene("spore");
  launch.arenaFrom = { x: -3, y: .8 };
  view.project = point => ({ x: 700 + point.x * 100, y: 180 + point.y * 50 });
  const sprite = unitRangedProjectile(agents[0]);
  const first = head(draw(1)[0]);
  close(first.x, 400 + (sprite.outletX - 256) * sprite.sourceScale * 2.5, "initial arena outlet x");
  close(first.y, 220 + (sprite.outletY - 448) * sprite.sourceScale * 2.5, "initial arena outlet y");
  Object.assign(positions.get("source"), { x: 900, y: 450 });
  Object.assign(positions.get("target"), { x: 900, y: 330 });
  view.project = point => ({ x: 600 + point.x * 60, y: 200 + point.y * 30 });
  const command = draw(1.5, undefined, undefined, 300)[0], actual = head(command);
  const originX = 420 + (sprite.outletX - 256) * sprite.sourceScale * 3;
  const originY = 224 + (sprite.outletY - 448) * sprite.sourceScale * 3;
  close(actual.x, (originX + 900) / 2, "current camera reprojects the original arena x");
  close(actual.y, (originY + 260) / 2, "current camera reprojects the original arena y");
  assert.deepEqual(draw(1.5, undefined, undefined, 300)[0], command);
});
