import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditImages, imageDimensions } from "./image-audit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = path => readFileSync(new URL("../" + path, import.meta.url));
const json = path => JSON.parse(read(path));
const policy = json("DesignAssets/image-sizes.json");
const evidence = json("Research/CombatVfx/2026-11-04/events/published-preview-registration.json");

test("all 44 registered originals pass, keeping the 36/3/5 evidence groups distinct", () => {
  const original = json("tools/image-audit-registration-20261104/evidence.json").rows;
  const ranged = json("Research/CombatVfx/2026-11-04/events/ranged-source-registration.json").rows;
  assert.deepEqual([original.length, ranged.length, evidence.rows.length], [36, 3, 5]);
  const names = [...original, ...ranged, ...evidence.rows].map(row => row.image);
  assert.equal(new Set(names).size, 44); assert.equal(auditImages(root, names), 44);
  for (const row of evidence.rows) {
    assert.deepEqual(policy.images[row.image], row.registration);
    assert.deepEqual(imageDimensions(new URL("../" + row.image, import.meta.url)), row.dimensions);
    assert.equal(createHash("sha256").update(read(row.image)).digest("hex"), row.sha256);
  }
  assert.equal(policy.preferredScale, 1); assert.equal(policy.maximumScale, 1.5);
});

test("three existing bean 1f atlases retain the source's 512px fixed camera and precise grids", () => {
  const base = "DesignAssets/Animations/UnitAppearanceV1/bean/1f/";
  const source = json(base + "source.json"), motions = json(base + "motions.json");
  const sourceHash = createHash("sha256").update(read(source.image)).digest("hex");
  assert.equal(source.camera.pixelsPerWorld, 512); assert.equal(source.sourceHash, sourceHash);
  for (const [action, count, rows] of [["idle", 64, 16], ["walk", 28, 7], ["hurt", 16, 4]]) {
    const clip = motions.actions[action], size = policy.images[clip.image];
    assert.equal(clip.sourceId, source.sourceId); assert.equal(clip.sourceHash, sourceHash);
    assert.equal(clip.frameSize, 512); assert.equal(clip.frameCount, count); assert.equal(clip.columns, 4);
    assert.deepEqual(size.grid, [4, rows]); assert.deepEqual(size.display, [256, 256]);
    assert.deepEqual(size.nativeSource.frame, [512, 512]);
    assert.deepEqual(size.nativeSource.dimensions, [2048, rows * 512]);
  }
});

test("welcome background fits the existing viewport budget without a native allowance", () => {
  const size = policy.images["DesignAssets/Welcome/forest-clearing.webp"];
  assert.deepEqual(size.display, policy.viewport); assert.deepEqual(size.grid, [1, 1]);
  assert.equal(size.nativeSource, undefined); assert.equal(size.sourceMaximum, undefined);
  assert.deepEqual(imageDimensions(new URL("../DesignAssets/Welcome/forest-clearing.webp", import.meta.url)), [1200, 400]);
});

test("registering the exact 256px draft export does not approve or connect its artwork", () => {
  const meta = json("DesignAssets/Animations/CombatVfxV3Draft/general-hit/sequence.json");
  const size = policy.images[meta.image];
  assert.equal(meta.status, "draft-pending-user-review"); assert.equal(meta.frameSize, 256);
  assert.equal(meta.frameCount, 8); assert.equal(meta.columns, 4);
  assert.deepEqual(size.grid, [4, 2]); assert.deepEqual(size.display, [256, 256]);
  assert.deepEqual(size.nativeSource.frame, [256, 256]);
  assert.equal(size.nativeSource.sha256, meta.imageSha256);
  assert.equal(read("client/game.js").includes(meta.image), false);
});
