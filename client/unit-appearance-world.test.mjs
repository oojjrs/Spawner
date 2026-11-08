import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_APPEARANCE_ASSETS } from "./unit-appearance-assets.mjs";
import { unitAppearanceRequiredWorldActions, unitAppearanceForAgent, unitAppearanceBirthSceneForAgent } from "./unit-appearance.mjs";
import { createUnitAppearanceWorld } from "./unit-appearance-world.mjs";

const agent = { id: "world", tribe: "bean", mode: "idle", health: 10, bornAt: 0,
  attributes: {}, dna: { version: 3, level: 1, budget: 100, pieces: [] } };
const context = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1 }), save() {}, restore() {}, translate() {}, scale() {}, drawImage() {} };
const flush = () => new Promise(resolve => setImmediate(resolve));

test("current partial action sets stay on the legacy renderer and load no new bitmap", () => {
  let fetches = 0;
  const world = createUnitAppearanceWorld({ sourceOptions: { fetch() { fetches++; throw new Error("unexpected"); } } });
  assert.equal(unitAppearanceForAgent(agent), null);
  assert.equal(world.prepare(context, [agent], 0, 100, 1).size, 0);
  assert.equal(fetches, 0); assert.equal(world.stats().decoded.residentPixels, 0);
});


test("a complete synthetic fixture switches only after decode and keeps birth and legacy DNA out", async () => {
  const definition = UNIT_APPEARANCE_ASSETS["bean/00"], originalActions = definition.actions;
  // Synthetic action fixtures exercise integration only. No product metadata or
  // motion readiness is written, and no idle substitute is shipped.
  const clip = { sourceId: definition.source.sourceId, image: "fixture-atlas", frameSize: 512, columns: 1,
    frameCount: 1, durationsMs: [1000], loop: true, pivotX: 256, pivotY: 448 };
  definition.actions = Object.fromEntries(unitAppearanceRequiredWorldActions(0).map(action => [action, { ...clip }]));
  let loads = 0, draws = 0;
  const blob = new Blob(["fixture"], { type: "image/png" });
  const world = createUnitAppearanceWorld({ sourceOptions: { files: { "fixture-atlas": { bytes: blob.size, mime: blob.type } },
    fetch: async () => { loads++; return { ok: true, blob: async () => blob }; } },
    makeBitmap: async (source, settings) => ({ width: settings.resizeWidth, height: settings.resizeHeight, close() {} }) });
  try {
    assert.ok(unitAppearanceForAgent(agent));
    assert.equal(world.prepare(context, [agent], .1, 100, 1).size, 0);
    await flush();
    const poses = world.prepare(context, [agent], .2, 100, 1);
    assert.equal(poses.size, 1); assert.equal(loads, 1);
    assert.ok(world.draw({ ...context, drawImage() { draws++; } }, agent, poses.get(agent.id), { x: 0, y: 0 }, 100, false, 1));
    assert.equal(draws, 1);
    assert.equal(world.prepare(context, [{ ...agent, birth: { startedAt: 0, readyAt: 1 } }], .2, 100, 1).size, 0);
    assert.equal(world.prepare(context, [{ ...agent, attributes: { strength: 1 } }], .2, 100, 1).size, 0);
    assert.equal(world.prepare(context, [{ ...agent, dna: { ...agent.dna, version: 2 } }], .2, 100, 1).size, 0);
  } finally { world.clear(); definition.actions = originalActions; }
});
