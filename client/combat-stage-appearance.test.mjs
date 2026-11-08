import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { unitActionArtDefinition, unitActionArtPose } from "./unit-action-art.mjs";
import { unitFrameMirror } from "./unit-size.mjs";
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
async function harness(run, { unavailable = false, authoredCombination = false } = {}) {
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
    set src(value) {
      this.path = value; requested.push(value);
      if (authoredCombination && value.includes('/AntennaCombosV1/')) {
        const png = readFileSync(new URL('../' + value, import.meta.url));
        this.naturalWidth = missing ? 0 : png.readUInt32BE(16);
        this.naturalHeight = png.readUInt32BE(20);
      } else this.naturalWidth = missing && /CombatAttributesV7|Attributes\/v[12]|AntennaCombosV1/.test(value) ? 0 : 4096;
    }
    get src() { return this.path; }
    async decode() { if (!this.naturalWidth) throw new Error("missing fixture art"); }
  };
  const canvas = surface(1040, 480); canvas.clientWidth = 1040; canvas.clientHeight = 480;
  const stage = createCombatStage(canvas);
  const draw = (trial, now = trial.time * 1000) => { canvas.calls.length = 0; stage.render(trial, now, false); return canvas.calls; };
  try { await run({ stage, draw, requested, recover: () => { missing = false; }, settle: async () => { for (let turn = 0; turn < 20; turn++) await new Promise(resolve => setImmediate(resolve)); } }); }
  finally { for (const [key, value] of Object.entries(saved)) globalThis[key] = value; }
}
function fixture(tribe, visual, side = 0) {
  const agents = [0, 1].map(index => ({ id: String(index), tribe: index === side ? tribe : "bean", health: 10, mode: "fight",
    attributes: index === side ? visual : {}, stats: { health: 10 }, facing: index ? -1 : 1, hurtStartedAt: -Infinity,
    combat: { version: 2, side: index, stunnedUntil: 0 }, animationStartedAt: 0 }));
  return { agents, history: [], projectiles: [], time: .3, result: () => null };
}
function paths(image) { return image.src ? [image.src] : (image.calls || []).flatMap(call => paths(call.image)); }

test("laboratory authored blade/carapace combinations cover four tribes and both facing directions", async () => {
  await harness(async ({ draw, settle }) => {
    for (const tribe of tribes) for (const dominant of ["blade", "carapace"]) for (const side of [0, 1]) {
      const trial = fixture(tribe, { [dominant]: 1, antenna: 1, feet: 1, ...(dominant === "blade" ? { secretion: 1 } : {}) }, side);
      const agent = trial.agents[side], before = JSON.stringify(agent);
      draw(trial); await settle(); const draws = draw(trial);
      const pose = unitActionArtPose(agent, trial.time), animation = pose.animation;
      const sprite = draws.find(call => call.image.src === animation.image);
      assert.ok(sprite, `${tribe}/${dominant} has representative art`);
      assert.equal(sprite.args[0], pose.frame % animation.columns * animation.frameSize);
      assert.equal(sprite.args[1], Math.floor(pose.frame / animation.columns) * (animation.frameHeight || animation.frameSize));
      assert.equal(sprite.matrix[0], unitFrameMirror(animation.sourceFacing, side ? -1 : 1) ? -1 : 1);
      assert.ok(Math.abs(sprite.args[5] / sprite.args[7] + animation.pivotY / (animation.frameHeight || animation.frameSize)) < 1e-12, "the authored ground pivot stays fixed");
      assert.equal(JSON.stringify(agent), before);
    }
  });
});

test("antenna/feet use their registered complete tribe clip and preserve lower-priority suppression", async () => {
  await harness(async ({ draw, settle }) => {
    for (const tribe of tribes.slice(1)) for (const dominant of ["antenna", "feet"]) {
      const trial = fixture(tribe, dominant === "antenna" ? { antenna: 2, feet: 3 } : { feet: 3 });
      draw(trial); await settle(); const draws = draw(trial), animation = unitActionArtPose(trial.agents[0], trial.time).animation;
      const sprite = draws.find(call => call.image.src === animation.image);
      assert.ok(sprite, tribe + dominant);
      assert.equal(sprite.image.calls, undefined);
      assert.ok(sprite.args.every(Number.isFinite));
    }
  });
});

test("missing authored combinations keep preparation closed and never promote incomplete inventory", async () => {
  await harness(async ({ draw, settle, stage }) => {
    const trial = fixture("spore", { blade: 1, secretion: 1, antenna: 1 });
    draw(trial); await settle(); const draws = draw(trial);
    await assert.rejects(stage.prepare(trial), /Unit action assets are not ready/);
    assert.equal(draws.some(call => call.image.src === unitActionArtPose(trial.agents[0], trial.time).animation.image), false);
    assert.equal(draws.some(call => call.image.calls?.length), false);
    assert.equal(unitAppearanceInventory().filter(row => row.worldReady).length, 0);
  }, { unavailable: true });
});

test("mixed stat-only laboratory builds display their blade-secretion body while retaining real ranged shots and unchanged simulation", async () => {
  await harness(async ({ draw, settle }) => {
    const settings = { left: { key: "bean", organs: { attack: 1, ranged: 1 }, counts: { vitality: 4 } },
      right: { key: "spring", organs: { attack: 1, ranged: 1 }, counts: { vitality: 4 } }, distance: 3, random: false };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    draw(trial); await settle();
    let sawBlade = false, sawFlight = false;
    for (let index = 0; index < 100 && !sawFlight; index++) {
      trial.advance(.1); control.advance(.1);
      const draws = draw(trial);
      await new Promise(resolve => setImmediate(resolve));
      sawBlade ||= draws.some(call => paths(call.image).some(path => path.includes("/SecretionCombosV1/bean/blade-secretion/")));
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
      const trial = fixture("pebble", { blade: 1, secretion: 1, antenna: 1 });
      draw(trial); await settle();
      assert.equal(draw(trial).some(call => call.image.src === unitActionArtPose(trial.agents[0], trial.time).animation.image), false);
      const before = requested.length; recover();
      draw(trial); await settle(); assert.equal(requested.length, before, "no retry loop each frame");
      now += 2001; draw(trial); await settle();
      assert.ok(draw(trial).some(call => paths(call.image).some(path => path.includes("/AntennaCombosV1/pebble/blade-secretion-antenna/"))));
      assert.ok(requested.length > before);
    }, { unavailable: true, authoredCombination: true });
  } finally { Date.now = original; }
});


test("authored deaths advance after frozen lethal simulation without changing corpse state", async () => {
  await harness(async ({ draw, settle, stage }) => {
    for (const tribe of tribes) {
      const trial = fixture(tribe, { blade: 1 }, 1);
      draw(trial, 1000); await settle(); draw(trial, 1100);
      trial.agents[1].health = 0; trial.result = () => ({ reason: "death" });
      await stage.prepare(trial);
      const before = JSON.stringify(trial.agents[1]);
      const frames = [], animation = unitActionArtDefinition(trial.agents[1]).actions.death;
      for (let index = 0; index < 5; index++) {
        const sprite = draw(trial, 1200 + index * 100).find(call => call.image.src === animation.image);
        assert.ok(sprite); assert.equal(sprite.matrix[0], unitFrameMirror(animation.sourceFacing, -1) ? -1 : 1);
        frames.push(sprite.args.slice(0, 2).join(","));
      }
      assert.ok(new Set(frames).size > 1, "death frame advances on stage clock");
      assert.equal(JSON.stringify(trial.agents[1]), before);
    }
  });
});


test("bean idle uses its complete root or antenna clip with metadata preserved", async () => {
  await harness(async ({ draw, settle }) => {
    for (const key of ["antenna", "feet"]) for (const side of [0, 1]) {
      const trial = fixture("bean", { [key]: 1, dnaGather: true }, side); trial.time = 0;
      const before = JSON.stringify(trial.agents[side]);
      draw(trial); await settle();
      const animation = unitActionArtPose(trial.agents[side], trial.time).animation;
      const sprite = draw(trial).find(call => call.image.src === animation.image && (call.matrix[4] > 520) === !!side);
      assert.ok(sprite, key + " authored idle is played");
      assert.equal(sprite.image.calls, undefined);
      assert.equal(sprite.matrix[0], unitFrameMirror(animation.sourceFacing, side ? -1 : 1) ? -1 : 1);
      assert.equal(JSON.stringify(trial.agents[side]), before);
    }
  });
});
