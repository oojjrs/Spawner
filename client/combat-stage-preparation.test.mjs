import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { DETAIL_COMBAT_VFX_ASSETS } from "./combat-detail-vfx.mjs";
import { unitActionArtDefinition } from "./unit-action-art.mjs";

async function withStage(action) {
  const previous = { window: globalThis.window, assets: globalThis.SpawnerAssets, document: globalThis.document };
  const requests = [], assets = new Map(), draws = [];
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({ save() {}, restore() {}, translate() {}, scale() {}, drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255) }) });
    return canvas;
  } };
  globalThis.SpawnerAssets = {
    load: async path => { requests.push(path); return path; },
    image: () => {
      const decoded = Promise.withResolvers();
      return { complete: false, naturalWidth: 0, naturalHeight: 0,
        set src(path) { this.path = path; assets.set(path, { image: this, decoded }); },
        decode() { return decoded.promise; } };
    }
  };
  const context = new Proxy({ drawImage: (...args) => draws.push(args) }, { get: (target, key) => target[key] ?? (() => {}) });
  const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
  const ready = path => { const asset = assets.get(path); asset.image.complete = true; asset.image.naturalWidth = asset.image.naturalHeight = 4096; asset.decoded.resolve(); };
  try { await action(stage, requests, assets, ready, draws); }
  finally { globalThis.window = previous.window; globalThis.SpawnerAssets = previous.assets; globalThis.document = previous.document; }
}

test("combat preparation waits for every effect decode and shares simultaneous requests", async () => {
  await withStage(async (stage, requests, assets, ready) => {
    let completed = false;
    const pending = stage.prepare();
    assert.equal(stage.prepare(), pending);
    pending.then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, new Set(["DesignAssets/Combat/grassland.webp", ...DETAIL_COMBAT_VFX_ASSETS]).size);
    const paths = [...assets.keys()], last = paths.pop();
    for (const path of paths) ready(path);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false);
    ready(last);
    await pending;
    assert.equal(completed, true);
    assert.equal(stage.prepare(), pending);
  });
});

const trialFor = tribe => ({ agents: [0, 1].map(side => ({ id: String(side), tribe, health: 100,
  mode: "idle", attributes: {}, stats: { health: 100 }, combat: { side, stunnedUntil: 0 } })),
  history: [], time: 0, result: () => null });

test("trial preparation waits for its body decode and shares identical actor images before the first paint", async () => {
  await withStage(async (stage, requests, assets, ready, draws) => {
    const trial = trialFor("bean"), common = stage.prepare(), pending = stage.prepare(trial);
    assert.equal(stage.prepare(trial), pending);
    let completed = false;
    pending.then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, new Set(requests).size);
    const commonPaths = new Set(["DesignAssets/Combat/grassland.webp", ...DETAIL_COMBAT_VFX_ASSETS]);
    const bodies = [...assets.keys()].filter(path => !commonPaths.has(path));
    assert.ok(bodies.length > 0);
    for (const path of commonPaths) ready(path);
    await common;
    assert.equal(completed, false);
    for (const path of bodies) ready(path);
    await pending;
    stage.render(trial, 0, false);
    assert.equal(draws.filter(args => bodies.includes(args[0].path)).length, 2);
    assert.equal(requests.filter(path => bodies.includes(path)).length, bodies.length);
  });
});

test("a failed body preparation retries explicitly while successful shared effects stay decoded", async () => {
  await withStage(async (stage, requests, assets, ready) => {
    const trial = trialFor("bean"), pending = stage.prepare(trial);
    await new Promise(resolve => setImmediate(resolve));
    const commonPaths = new Set(["DesignAssets/Combat/grassland.webp", ...DETAIL_COMBAT_VFX_ASSETS]);
    const failed = [...assets.keys()].find(path => !commonPaths.has(path));
    for (const path of assets.keys()) if (path !== failed) ready(path);
    assets.get(failed).decoded.reject(new Error("missing body"));
    await assert.rejects(pending, /Unit action assets are not ready/);
    const count = requests.length, retry = stage.prepare(trial);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, count + 1);
    assert.equal(requests.at(-1), failed);
    ready(failed);
    await retry;
  });
});

test("only the current roster form prepares its combat actions and the first attack and hurt need no new image request", async () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) await withStage(async (stage, requests, assets, ready, draws) => {
    const trial = trialFor(tribe);
    for (const agent of trial.agents) agent.attributes = { blade: 1, secretion: 1 };
    const definition = unitActionArtDefinition(trial.agents[0]);
    const clips = [definition.reference, ...["idle", "walk", "attack", "ranged", "hurt", "death"].map(action => definition.actions[action]).filter(Boolean)];
    const expected = new Set(["DesignAssets/Combat/grassland.webp", ...DETAIL_COMBAT_VFX_ASSETS, ...clips.map(clip => clip.image)]);
    const attack = definition.actions.attack.image, hurt = definition.actions.hurt.image;
    assert.notEqual(attack, hurt);
    let completed = false;
    const pending = stage.prepare(trial).then(() => { completed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(new Set(requests), expected);
    assert.equal(requests.length, expected.size);
    for (const path of assets.keys()) if (path !== attack && path !== hurt) ready(path);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false);
    ready(attack);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(completed, false);
    ready(hurt);
    await pending;
    stage.render(trial, 0, false);
    const count = requests.length;
    trial.time = 1.1;
    trial.agents[0].attack = { combatId: "fixture", startedAt: 1, hitAt: 1.3, endsAt: 1.6, directionX: 1 };
    draws.length = 0;
    stage.render(trial, 1100, false);
    assert.ok(draws.some(args => args[0].path === attack));
    trial.agents[0].attack = null;
    trial.agents[0].hurtStartedAt = 1.2;
    trial.time = 1.25;
    draws.length = 0;
    stage.render(trial, 1250, false);
    assert.ok(draws.some(args => args[0].path === hurt));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, count);
  });
});

test("a failed combat effect can be retried without reloading successfully decoded art", async () => {
  await withStage(async (stage, requests, assets, ready) => {
    const pending = stage.prepare();
    await new Promise(resolve => setImmediate(resolve));
    const paths = [...assets.keys()], failed = paths.pop();
    for (const path of paths) ready(path);
    assets.get(failed).decoded.reject(new Error("decode failed"));
    await assert.rejects(pending, /decode failed/);
    const count = requests.length;
    const retry = stage.prepare();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, count + 1);
    assert.equal(requests.at(-1), failed);
    ready(failed);
    await retry;
  });
});
