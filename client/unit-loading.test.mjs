import test from "node:test";
import assert from "node:assert/strict";
import { createUnitActionArt, unitActionArtPose } from "./unit-action-art.mjs";

function surface(width, height) {
  const calls = [], context = new Proxy({ drawImage(image) { calls.push(image); }, getImageData() {
    return { data: new Uint8ClampedArray(width * height * 4).fill(255) };
  } }, { get: (target, key) => target[key] || (() => {}) });
  return { width, height, calls, getContext: () => context };
}

test("one unit prepares independently while another reference remains pending", async () => {
  const pending = new Map();
  const art = createUnitActionArt(path => path, surface, path => new Promise(resolve => pending.set(path, resolve)));
  const first = { tribe: "bean", attributes: { blade: 1 }, health: 10, mode: "idle" };
  const second = { ...first, tribe: "spore" };
  let secondReady = false;
  const firstPrepared = art.prepare(first, 0), secondPrepared = art.prepare(second, 0).then(() => { secondReady = true; });
  await Promise.resolve();
  const pose = unitActionArtPose(first, 0);
  for (const path of new Set([pose.reference.image, pose.animation.image])) pending.get(path)({ path });
  await firstPrepared;
  assert.equal(art.readyAction(first, 0), true);
  assert.equal(secondReady, false);
  assert.equal(art.frame(second, 0), null);
  const secondPose = unitActionArtPose(second, 0);
  for (const path of new Set([secondPose.reference.image, secondPose.animation.image])) pending.get(path)({ path });
  await secondPrepared;
  const attack = { ...first, mode: "fight", attack: { startedAt: 0 } };
  const canvas = surface(512, 512);
  assert.equal(art.draw(canvas.getContext("2d"), attack, .3, 0, 0, 100, false, null), true);
  assert.equal(canvas.calls.length, 1);
  assert.equal(canvas.calls[0].path, pose.reference.image);
  assert.equal(art.readyAction(attack, .3), false);
  assert.equal(art.frame(attack, .3), null);
  const attackPrepared = art.prepare(attack, .3);
  await Promise.resolve();
  const attackPose = unitActionArtPose(attack, .3);
  pending.get(attackPose.animation.image)({ path: attackPose.animation.image });
  await attackPrepared;
  assert.equal(art.readyAction(attack, .3), true);
  assert.equal(art.frame(attack, .3).calls[0].path, attackPose.animation.image);
});
