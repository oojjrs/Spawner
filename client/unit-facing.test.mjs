import test from "node:test";
import assert from "node:assert/strict";
import { unitFacing, unitFrameMirror } from "./unit-size.mjs";
import { UNIT_COMBINATION_FORMS } from "./unit-combination-forms.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { createUnitActionArt, unitActionArtPose } from "./unit-action-art.mjs";
import { drawBeanHeldHurt } from "./bean-held-hurt.mjs";
import { drawSpeciesHeldHurt } from "./species-held-hurt.mjs";
import { CREATURE_RANGED_ANIMATIONS, creatureRangedOutlet } from "./creature-ranged.mjs";

function surface(width, height) {
  const calls = [], transforms = [], stack = [];
  let scale = 1, x = 0, y = 0;
  const context = { save() { stack.push([scale, x, y]); }, restore() { [scale, x, y] = stack.pop(); },
    translate(dx, dy) { x += scale * dx; y += dy; }, scale(dx) { scale *= dx; transforms.push(dx); },
    drawImage(...args) { calls.push({ args, scale, x, y }); }, getImageData() { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } };
  return { width, height, calls, transforms, getContext: () => context };
}

test("방향 미지정 시 논리 기본값을 유지하고 명시된 타깃 방향을 우선한다", () => {
  assert.equal(unitFacing({}), 1);
  for (const side of [0, 1]) for (const facing of [-1, 1]) assert.equal(unitFacing({ facing, combat: { side } }), facing);
  assert.equal(unitFacing({ facing: -1, attack: { directionX: 1 } }), 1);
  assert.equal(unitFrameMirror("right", 1), false); assert.equal(unitFrameMirror("right", -1), true);
  assert.equal(unitFrameMirror("left", 1), true); assert.equal(unitFrameMirror("left", -1), false);
});

test("모든 실제 플레이어 클립의 원본 방향을 명시한다", () => {
  const images = new Map();
  for (const definition of Object.values(UNIT_ACTION_ART)) for (const clip of [definition.reference, ...Object.values(definition.actions)]) {
    assert.ok(["left", "right"].includes(clip.sourceFacing));
    if (images.has(clip.image)) assert.equal(clip.sourceFacing, images.get(clip.image));
    images.set(clip.image, clip.sourceFacing);
  }
  assert.ok([...images.values()].includes("left")); assert.ok([...images.values()].includes("right"));
});

test("원본 방향 보정과 전장 반전은 프레임 순서와 발 접점을 보존한다", async () => {
  const art = createUnitActionArt(value => value, surface, async image => ({ image }));
  for (const key of Object.keys(UNIT_ACTION_ART)) {
    const [tribe, form] = key.split("/");
    const attributes = UNIT_COMBINATION_FORMS.find(candidate => candidate.key === form)?.attributes ||
      (form === "base" ? {} : { [form === "gather" ? "strength" : form]: 1 });
    const agent = { tribe, attributes, health: 10, mode: "idle" };
    await art.prepare(agent);
    const pose = unitActionArtPose(agent, .2), right = surface(600, 600), left = surface(600, 600);
    assert.ok(art.draw(right.getContext(), agent, .2, 231, 450, 100, false, null));
    assert.ok(art.draw(left.getContext(), agent, .2, 231, 450, 100, true, null));
    const a = right.calls.at(-1), b = left.calls.at(-1);
    assert.equal(pose.reference, UNIT_ACTION_ART[key].reference, key + " selects its own registered form");
    assert.ok(a && b, key); assert.deepEqual(a.args, b.args); assert.equal(a.scale, -b.scale);
    assert.equal(a.x, 231); assert.equal(a.y, 450); assert.equal(b.x, 231); assert.equal(b.y, 450);
    assert.equal(a.scale, pose.animation.sourceFacing === "left" ? -1 : 1);
  }
});

test("기본 피격은 논리적 정면에서 명시적으로 맞는 경우와 같은 좌우 그룹을 고른다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const form of ["base", "blade", "carapace"]) for (const mirror of [false, true]) {
    const draw = tribe === "bean" ? drawBeanHeldHurt : drawSpeciesHeldHurt;
    const agent = { tribe, attributes: form === "base" ? {} : { [form]: 1 }, health: 10, hurtStartedAt: 0 };
    const image = { complete: true, naturalWidth: 4096, naturalHeight: 4096 }, a = surface(600, 600), b = surface(600, 600);
    assert.equal(draw(a.getContext(), agent, .1, () => image, { cell: 100, mirror }), true);
    assert.equal(draw(b.getContext(), agent, .1, () => image, { cell: 100, mirror, hitSide: mirror ? -1 : 1 }), true);
    assert.deepEqual(a.calls, b.calls, tribe + "/" + form);
  }
});

test("중립 발사구는 오른쪽과 왼쪽의 같은 전방 거리를 사용한다", () => {
  for (const species of Object.keys(CREATURE_RANGED_ANIMATIONS)) {
    const agent = { species }, right = creatureRangedOutlet(agent, 1), left = creatureRangedOutlet(agent, -1);
    assert.deepEqual(creatureRangedOutlet(agent), right);
    assert.ok(right.x > 0, species); assert.ok(left.x < 0, species); assert.equal(right.x, -left.x); assert.equal(right.y, left.y);
  }
});