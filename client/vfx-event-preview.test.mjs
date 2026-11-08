import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { rangedReviewState } from "./vfx-event-preview.mjs";
import { UNIT_RANGED_FORMS, unitRangedProjectile } from "./unit-ranged.mjs";
import { imageDimensions, auditImages } from "./image-audit.mjs";

const scope = {};
for (const name of ["vfx-event-preview-data.js", "vfx-event-preview.js"])
  runInNewContext(readFileSync(new URL(name, import.meta.url), "utf8"), scope);
const data = JSON.parse(JSON.stringify(scope.SpawnerVfxEventPreviewData));

test("ranged review uses existing approved body, exact projectile pixels and registered outlet", () => {
  assert.deepEqual(data.sourceForm, JSON.parse(JSON.stringify(UNIT_RANGED_FORMS.bean)));
  assert.deepEqual(data.targetForm, JSON.parse(JSON.stringify(UNIT_RANGED_FORMS.spore)));
  const sprite = unitRangedProjectile(data.source);
  assert.equal(sprite.image, data.sourceForm.projectile.image);
  assert.deepEqual(imageDimensions(new URL("../" + sprite.image, import.meta.url)), [sprite.width, sprite.height]);
  assert.ok(sprite.sourceScale > 0); assert.ok(sprite.outletX > 256);
  assert.equal(auditImages(fileURLToPath(new URL("..", import.meta.url)),
    [data.sourceForm.idle.image, data.sourceForm.animation.image, sprite.image]), 3);
  assert.equal(readFileSync(new URL("vfx-event-preview.js", import.meta.url), "utf8").includes("CombatVfxV3Draft"), false);
});

test("review fixture distinguishes real launch, in-flight recovery, and actual arrival damage", () => {
  const before = rangedReviewState(data, .299);
  assert.equal(before.phase, "발사 준비"); assert.equal(before.projectiles.length, 0); assert.equal(before.health, 100);
  const launch = rangedReviewState(data, .3);
  assert.equal(launch.phase, "비행 중"); assert.equal(launch.projectiles[0].progress, 0); assert.equal(launch.health, 100);
  const flight = rangedReviewState(data, .5);
  assert.equal(flight.sourcePose.action, "idle", "body recovery ends while the real projectile is still flying");
  assert.equal(flight.projectiles.length, 1); assert.equal(flight.health, 100);
  const arrival = rangedReviewState(data, data.source.attack.hitAt);
  assert.equal(arrival.projectiles.length, 0); assert.equal(arrival.phase, "명중 판정");
  assert.ok(Math.abs(arrival.health - 98.6) < 1e-9);
  assert.equal(arrival.impact.at, arrival.launch.arrivesAt);
  assert.equal(arrival.impact.projectileId, arrival.launch.projectileId);
});

test("the published classic review bundle uses the same semantic mapper as its source module", () => {
  for (const time of [0, .299, .3, .5, .6333333333333333, 1.2]) {
    const source = rangedReviewState(data, time);
    const built = scope.SpawnerVfxEventPreview.rangedReviewState(data, time);
    assert.deepEqual(JSON.parse(JSON.stringify(built)), JSON.parse(JSON.stringify(source)));
  }
});
