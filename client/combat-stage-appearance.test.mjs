import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";
import { unitAppearanceInventory } from "./unit-appearance.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
function surface(width = 512, height = 512) {
  const canvas = { width, height, calls: [] }, stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const context = new Proxy({ canvas, globalAlpha: 1,
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); },
    scale(x, y) { matrix[0] *= x; matrix[3] *= y; }, translate(x, y) { matrix[4] += x; matrix[5] += y; },
    setTransform(...values) { matrix = values.length === 1 ? ["a", "b", "c", "d", "e", "f"].map(key => values[0][key]) : values; },
    getTransform() { return Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((key, i) => [key, matrix[i]])); },
    drawImage(image, ...args) { canvas.calls.push({ image, args, matrix: [...matrix] }); },
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }; }
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  canvas.getContext = () => context; return canvas;
}
async function harness(run, { unavailable = false } = {}) {
  const saved = Object.fromEntries(["window", "document", "Image", "SpawnerAssets", "Path2D"].map(key => [key, globalThis[key]]));
  const requested = [];
  let missing = unavailable;
  globalThis.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  globalThis.document = { createElement: () => surface() };
  globalThis.SpawnerAssets = { source: path => path.endsWith(".json") ? "data:application/json;base64," +
    readFileSync(new URL("../" + path, import.meta.url)).toString("base64") : path };
  globalThis.Image = class {
    complete = true; naturalWidth = 4096; naturalHeight = 4096;
    set src(value) { this.path = value; requested.push(value); this.naturalWidth = missing && /CombatAttributesV7|Attributes\/v[12]/.test(value) ? 0 : 4096; }
    get src() { return this.path; }
    async decode() { if (!this.naturalWidth) throw new Error("missing fixture art"); }
  };
  const canvas = surface(1040, 480); canvas.clientWidth = 1040; canvas.clientHeight = 480;
  const stage = createCombatStage(canvas);
  const draw = (trial, now = trial.time * 1000) => { canvas.calls.length = 0; stage.render(trial, now, false); return canvas.calls; };
  try { await run({ stage, draw, requested, recover: () => { missing = false; }, settle: () => new Promise(resolve => setImmediate(resolve)) }); }
  finally { for (const [key, value] of Object.entries(saved)) globalThis[key] = value; }
}
function fixture(tribe, visual, side = 0) {
  const agents = [0, 1].map(index => ({ id: String(index), tribe: index === side ? tribe : "bean", health: 10, mode: "fight",
    attributes: index === side ? visual : {}, stats: { health: 10 }, facing: index ? -1 : 1, hurtStartedAt: -Infinity,
    combat: { version: 2, side: index, stunnedUntil: 0 }, animationStartedAt: 0 }));
  return { agents, history: [], projectiles: [], time: .3, result: () => null };
}
function paths(image) { return image.src ? [image.src] : (image.calls || []).flatMap(call => paths(call.image)); }

test("laboratory representative blade/carapace compositors cover four tribes and both facing directions", async () => {
  await harness(async ({ draw, settle }) => {
    for (const tribe of tribes) for (const dominant of ["blade", "carapace"]) for (const side of [0, 1]) {
      const trial = fixture(tribe, { [dominant]: 1, antenna: 1, feet: 1, ...(dominant === "blade" ? { secretion: 1 } : {}) }, side);
      const agent = trial.agents[side], before = JSON.stringify(agent);
      draw(trial); await settle(); const draws = draw(trial);
      const sprite = draws.find(call => call.image.calls?.length);
      assert.ok(sprite, `${tribe}/${dominant} has representative art`);
      assert.ok(paths(sprite.image).some(path => path.includes(`/Sheets/${dominant}/idle.webp`)));
      assert.equal(sprite.matrix[0], side ? -1 : 1);
      assert.ok(Math.abs(sprite.args[1] / sprite.args[3] + 448 / 512) < 1e-12, "ground pivot is fixed, not fit to padded canvas");
      assert.equal(JSON.stringify(agent), before);
    }
  });
});

test("antenna/feet reuse tribe morphology and preserve lower-priority suppression", async () => {
  await harness(async ({ draw, settle }) => {
    for (const tribe of tribes.slice(1)) for (const dominant of ["antenna", "feet"]) {
      const trial = fixture(tribe, dominant === "antenna" ? { antenna: 2, feet: 3 } : { feet: 3 });
      draw(trial); await settle(); const draws = draw(trial), sprite = draws.find(call => call.image.calls?.length);
      assert.ok(sprite, tribe + dominant);
      assert.ok(paths(sprite.image).some(path => path.includes("Attributes/v2/Parts/")));
      assert.ok(sprite.args.every(Number.isFinite));
    }
  });
});

test("missing representative art keeps base fallback and never promotes incomplete inventory", async () => {
  await harness(async ({ draw, settle }) => {
    const trial = fixture("spore", { blade: 1, secretion: 1, antenna: 1 });
    draw(trial); await settle(); const draws = draw(trial);
    assert.ok(draws.some(call => call.image.src === UNIT_ANIMATIONS.spore.idle.image));
    assert.equal(draws.some(call => call.image.calls?.length), false);
    assert.equal(unitAppearanceInventory().filter(row => row.worldReady).length, 0);
  }, { unavailable: true });
});

test("mixed stat-only laboratory builds display blade while retaining real ranged shots and unchanged simulation", async () => {
  await harness(async ({ draw, settle }) => {
    const settings = { left: { key: "bean", organs: { attack: 1, ranged: 1 }, counts: { vitality: 4 } },
      right: { key: "spring", organs: { attack: 1, ranged: 1 }, counts: { vitality: 4 } }, distance: 3, random: false };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    draw(trial); await settle();
    let sawBlade = false, sawFlight = false;
    for (let index = 0; index < 20; index++) {
      trial.advance(.1); control.advance(.1);
      const draws = draw(trial);
      sawBlade ||= draws.some(call => paths(call.image).some(path => path.includes("/Sheets/blade/")));
      sawFlight ||= draws.some(call => call.image.src?.includes("CombatVfxV4/bean.png"));
      assert.deepEqual(trial.agents, control.agents); assert.deepEqual(trial.history, control.history);
    }
    assert.ok(sawBlade); assert.ok(sawFlight); assert.ok(trial.vfx.events.some(event => event.kind === "shoot"));
    assert.deepEqual(trial.result(), control.result());
  });
});


test("failed art retries after the bounded wall-clock delay and recovers without restarting the trial", async () => {
  const original = Date.now; let now = 10000; Date.now = () => now;
  try {
    await harness(async ({ draw, settle, recover, requested }) => {
      const trial = fixture("pebble", { blade: 1, secretion: 1 });
      draw(trial); await settle();
      assert.equal(draw(trial).some(call => call.image.calls?.length), false);
      const before = requested.length; recover();
      draw(trial); await settle(); assert.equal(requested.length, before, "no retry loop each frame");
      now += 2001; draw(trial); await settle();
      assert.ok(draw(trial).some(call => paths(call.image).some(path => path.includes("/Sheets/blade/"))));
      assert.ok(requested.length > before);
    }, { unavailable: true });
  } finally { Date.now = original; }
});


test("representative deaths advance after frozen lethal simulation without changing corpse state", async () => {
  await harness(async ({ draw, settle }) => {
    for (const tribe of tribes) {
      const trial = fixture(tribe, { blade: 1 }, 1);
      draw(trial, 1000); await settle(); draw(trial, 1100);
      trial.agents[1].health = 0; trial.result = () => ({ reason: "death" });
      const before = JSON.stringify(trial.agents[1]);
      const frames = [];
      for (let index = 0; index < 5; index++) {
        const sprite = draw(trial, 1200 + index * 100).find(call => paths(call.image).some(path => path.includes("CombatDeathV1/")));
        assert.ok(sprite); assert.equal(sprite.matrix[0], -1);
        const sheet = sprite.image.calls.find(call => call.image.src?.includes("CombatDeathV1/"));
        frames.push(sheet.args.slice(0, 2).join(","));
      }
      assert.ok(new Set(frames).size > 1, "death frame advances on stage clock");
      assert.equal(JSON.stringify(trial.agents[1]), before);
    }
  });
});


test("bean idle uses intact canonical root or antenna art with metadata preserved", async () => {
  await harness(async ({ draw, settle }) => {
    for (const key of ["antenna", "feet"]) for (const side of [0, 1]) {
      const trial = fixture("bean", { [key]: 1, dnaGather: true, healing: 2 }, side); trial.time = 0;
      const before = JSON.stringify(trial.agents[side]);
      draw(trial); await settle();
      const sprite = draw(trial).find(call => call.image.calls?.length);
      assert.ok(sprite, key + " idle is composed");
      const sources = paths(sprite.image);
      assert.ok(sources.includes("DesignAssets/Units/BaseParts/body.png"));
      assert.ok(sources.includes(key === "feet" ? "DesignAssets/Units/Parts/bean-root-rig.png" : "DesignAssets/Units/Parts/antenna-1.png"));
      assert.equal(sprite.matrix[0], side ? -1 : 1);
      assert.equal(JSON.stringify(trial.agents[side]), before);
    }
  });
});
