import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { unitRangedProjectile } from "./unit-ranged.mjs";

const root = "DesignAssets/Animations/CombatVfxV4/";
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function withStage(run, { width = 1040, height = 480, dpr = 2 } = {}) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  const unavailable = new Set(), calls = [], stack = [];
  let matrix = [1,0,0,1,0,0];
  globalThis.window = { matchMedia: () => ({ matches: false }), devicePixelRatio: dpr };
  globalThis.Image = class {
    set src(value) { this.source = value; }
    get src() { return this.source; }
    get complete() { return !unavailable.has(this.src); }
    get naturalWidth() { return this.src.includes(root) ? 1776 : 4096; }
    get naturalHeight() { return this.src.includes(root) ? 888 : 4096; }
  };
  globalThis.SpawnerAssets = { source: path => path };
  const context = new Proxy({
    save() { stack.push({ matrix: [...matrix], fillStyle: this.fillStyle }); },
    restore() { const state = stack.pop(); matrix = state.matrix; this.fillStyle = state.fillStyle; },
    setTransform(...values) { matrix = values; },
    translate(x, y) { matrix = multiply(matrix, [1,0,0,1,x,y]); },
    rotate(angle) { matrix = multiply(matrix, [Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]); },
    scale(x, y) { matrix = multiply(matrix, [x,0,0,y,0,0]); },
    drawImage(image, ...args) { calls.push({ image: image.src, args, matrix: [...matrix] }); },
    arc(x, y, radius) { calls.push({ kind: "arc", color: this.fillStyle, args: [x,y,radius], matrix: [...matrix] }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = { clientWidth: width, clientHeight: height, getContext: () => context };
  const stage = createCombatStage(canvas);
  const draw = (trial, now = 1000) => { calls.length = 0; stage.render(trial, now, false); return [...calls]; };
  try { run({ draw, stage, unavailable, canvas }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}
function setup(tribe = "bean", reverse = false, mixed = false) {
  const agents = [0,1].map(side => ({ id: side ? "right" : "left", tribe: side === Number(reverse) ? tribe : "bean",
    health: 100, mode: "fight", facing: side ? -1 : 1, attributes: {}, animationStartedAt: 0,
    combat: { side, stunnedUntil: 0 }, stats: { health: 100, ranged: side === Number(reverse), melee: mixed || side !== Number(reverse) } }));
  const source = agents[Number(reverse)], target = agents[1 - Number(reverse)];
  const trial = { agents, history: [], projectiles: [], time: 0, result: () => null,
    vfx: { version: 1, streamId: "flight-fallback", events: [] } };
  const shoot = (at = 1, id = "shot") => {
    trial.time = at;
    trial.vfx.events.push({ id: "launch-" + id, kind: "shoot", sourceId: source.id, targetId: target.id,
      mode: "ranged", at, arrivesAt: at + 1, projectileId: id });
    trial.projectiles.push({ source, target, launchedAt: at, at: at + 1 });
  };
  return { trial, source, target, shoot };
}
function point(call) {
  const [a,b,c,d,x,y] = call.matrix;
  const local = call.image?.includes(root) ? [call.args[6] * .25, 0] : call.kind === "arc" ? call.args : [0,0];
  return [x + a * local[0] + c * local[1], y + b * local[0] + d * local[1]];
}
const flights = calls => calls.filter(call => call.image?.includes(root) && call.args[0] === 0 && call.args[1] === 0 ||
  call.image?.endsWith("/projectile.png") || call.kind === "arc" && call.color === "#e5e9a4");
function sameHead(actual, expected, label) {
  assert.equal(actual.length, expected.length, label + " count");
  actual.forEach((call, index) => point(call).forEach((value, axis) => near(value, point(expected[index])[axis], label + " " + axis)));
}

test("lab fallback and recovered V4 use the same flight path for every species and direction", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false,true])
    for (const mixed of [false,true]) for (const dimensions of [{}, { width: 360, height: 360, dpr: 1 }]) withStage(({ draw, unavailable }) => {
      const { trial, shoot } = setup(tribe, reverse, mixed);
      draw(trial); shoot(); draw(trial);
      trial.time = 1.4; unavailable.add(root + tribe + ".png");
      const missing = flights(draw(trial, 1100));
      unavailable.clear(); const loaded = flights(draw(trial, 1100));
      assert.equal(missing.length, 1); assert.equal(loaded.length, 1);
      sameHead(missing, loaded, tribe + " fallback recovery");
    }, dimensions);
});

test("a fallback preserves its frozen launch point through shooter recoil, resize and repeated draws", () => {
  for (const reverse of [false,true]) withStage(({ draw, unavailable, canvas }) => {
    const { trial, source, target, shoot } = setup("spore", reverse);
    draw(trial); shoot(); const launch = flights(draw(trial));
    unavailable.add(root + "spore.png");
    trial.time = 1.2;
    trial.history.push({ kind: "hit", attackerId: target.id, targetId: source.id, time: 1.2, damage: 3 });
    draw(trial, 1100);
    const recoiling = flights(draw(trial, 1200));
    unavailable.clear(); const loaded = flights(draw(trial, 1200));
    sameHead(recoiling, loaded, "recoiling source");
    assert.notDeepEqual(point(recoiling[0]), point(launch[0]), "actual flight advances");
    unavailable.add(root + "spore.png");
    sameHead(flights(draw(trial, 1200)), loaded, "repeated draw");
    canvas.clientWidth /= 2; canvas.clientHeight /= 2;
    const resized = flights(draw(trial, 1200));
    unavailable.clear(); sameHead(resized, flights(draw(trial, 1200)), "resized recovery");
    near(point(resized[0])[0], point(loaded[0])[0] / 2, "resize x");
    assert.ok(Math.abs(point(resized[0])[1] - point(loaded[0])[1] / 2) < 1,
      "resize y differs only by the existing whole-pixel target footing");
  });
});

test("overlapping missing flights and their separate recovery keep independent observed origins", () => {
  withStage(({ draw, unavailable }) => {
    const { trial, source, target, shoot } = setup("spring");
    draw(trial); shoot(); draw(trial);
    trial.time = 1.1;
    trial.history.push({ kind: "hit", attackerId: target.id, targetId: source.id, time: 1.1, damage: 3 });
    draw(trial, 1100); shoot(1.2, "second"); draw(trial, 1200);
    trial.time = 1.4; unavailable.add(root + "spring.png");
    const missing = flights(draw(trial, 1300));
    unavailable.clear(); const loaded = flights(draw(trial, 1300));
    assert.equal(missing.length, 2); sameHead(missing, loaded, "overlapping flights");
  });
});

test("missing legacy art also keeps the fallback on the approved path without inventing impacts", () => {
  withStage(({ draw, unavailable }) => {
    const { trial, shoot, source } = setup("bean");
    draw(trial); shoot(); draw(trial);
    trial.time = 1.3; const loaded = flights(draw(trial, 1100));
    unavailable.add(root + "bean.png"); unavailable.add(unitRangedProjectile(source).image);
    const missing = flights(draw(trial, 1100));
    sameHead(missing, loaded, "all flight art unavailable");
    assert.equal(missing[0].kind, "arc");
    trial.time = 2; trial.projectiles = [];
    assert.equal(flights(draw(trial, 1200)).length, 0, "arrival creates no flight or impact");
  });
});
