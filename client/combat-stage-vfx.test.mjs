import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const root = "DesignAssets/Animations/CombatVfxV4/";
function withStage(run, { unavailable = false, reduced = false } = {}) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  const calls = [];
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 2 };
  globalThis.Image = class {
    set src(value) { this.source = value; this.complete = !unavailable || !value.includes(root); }
    get src() { return this.source; }
    get naturalWidth() { return this.src.includes(root) ? 1776 : 4096; }
    get naturalHeight() { return this.src.includes(root) ? 888 : 4096; }
  };
  globalThis.SpawnerAssets = { source: path => "https://assets.example/" + path };
  const context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ name: key, args })) });
  const canvas = { clientWidth: 1040, clientHeight: 480, getContext: () => context };
  const stage = createCombatStage(canvas);
  let now = 100;
  const draw = (trial, playing = false) => {
    calls.length = 0; stage.render(trial, now, playing); now += 100;
    return calls.filter(call => call.name === "drawImage" && call.args[0]?.src.includes(root));
  };
  try { run({ draw, stage, calls, canvas }); }
  finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets;
  }
}
function setup(tribe = "bean", reverse = false) {
  const agents = [0, 1].map(side => ({ id: side ? "right" : "left", tribe: side === Number(reverse) ? tribe : "bean",
    health: 100, mode: "fight", facing: side ? -1 : 1, attributes: {}, animationStartedAt: 0,
    combat: { side, stunnedUntil: 0 }, stats: { health: 100, ranged: side === Number(reverse), melee: side !== Number(reverse) } }));
  const source = agents[Number(reverse)], target = agents[1 - Number(reverse)];
  const trial = { agents, history: [], projectiles: [], time: 0, result: () => null,
    vfx: { version: 1, streamId: "trial", events: [] } };
  const launch = { id: "launch", kind: "shoot", sourceId: source.id, targetId: target.id,
    mode: "ranged", at: 1, arrivesAt: 1.5, projectileId: "shot" };
  const shoot = () => {
    trial.time = 1.1; trial.vfx.events = [launch];
    trial.projectiles = [{ source, target, launchedAt: 1, at: 1.5 }];
  };
  const resolve = (kind = "hit", amount = 3) => {
    trial.time = 1.5; trial.projectiles = [];
    trial.vfx.events.push({ ...launch, id: "result", at: 1.5, kind, amount });
    trial.history.push({ index: 0, time: 1.5, kind, damage: amount, attackerId: source.id, targetId: target.id });
  };
  return { trial, shoot, resolve, source, target };
}

test("approved V4 flights and impacts follow four species, both directions and authoritative outcomes", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true])
    for (const [kind, amount] of [["hit", 3], ["critical", 3], ["block", 2], ["block", 0], ["dodge", 0], ["parry", 0], ["projectile-cancel", 0]]) {
      withStage(({ draw, calls, canvas }) => {
        const { trial, shoot, resolve } = setup(tribe, reverse);
        draw(trial); shoot();
        const flights = draw(trial);
        assert.equal(flights.length, 1, tribe + kind);
        assert.ok(flights[0].args[0].src.endsWith(root + tribe + ".png"));
        assert.deepEqual(flights[0].args.slice(1, 5), [0, 0, 444, 444]);
        assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 0, "no duplicate legacy flight");
        assert.equal(canvas.width, 2080); assert.equal(canvas.height, 960);
        resolve(kind, amount);
        const hits = draw(trial);
        assert.equal(hits.length, amount > 0 ? 1 : 0, tribe + kind + amount);
        if (amount > 0) {
          assert.ok(hits[0].args[0].src.endsWith(root + tribe + ".png"));
          assert.ok(hits[0].args[1] > 0, "impact cell rather than flight cell");
          assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === "−" + amount.toFixed(1)), "damage label preserved");
          const lines = calls.filter(call => call.name === "lineTo");
          assert.equal(lines.length, kind === "block" ? 7 : 0, "partial block keeps defense sparks, not duplicate hit slash");
        }
      });
    }
});

test("paused and lethal impacts finish naturally without restarting; clear and replacement remove old effects", () => {
  withStage(({ draw, stage }) => {
    const { trial, shoot, resolve, target } = setup("spore");
    draw(trial); shoot(); draw(trial); resolve(); target.health = 0;
    trial.result = () => ({ reason: "death" });
    assert.equal(draw(trial).length, 1);
    for (let index = 0; index < 6; index++) draw(trial);
    assert.equal(draw(trial).length, 0, "frozen simulation does not freeze final impact");
    assert.equal(draw(trial).length, 0, "repeated journal never restarts it");
    stage.clear(); assert.equal(draw(trial).length, 0, "cleared stage does not replay old impacts");
    const next = setup("bean"); draw(next.trial); next.shoot(); draw(next.trial); next.resolve();
    assert.equal(draw(next.trial).length, 1);
    const replacement = setup("pebble").trial;
    assert.equal(draw(replacement).length, 0);
  });
  withStage(({ draw }) => {
    const { trial, shoot, resolve } = setup(); draw(trial); shoot(); draw(trial); resolve();
    assert.equal(draw(trial).length, 1);
    trial.time = 0; trial.history = []; trial.vfx.events = [];
    assert.equal(draw(trial).length, 0, "backseek clears the old V4 burst");
  });
});

test("missing V4 images, absent journals and reduced motion retain existing fallback and labels", () => {
  for (const options of [{ unavailable: true }, { reduced: true }, { legacy: true }]) withStage(({ draw, calls }) => {
    const { trial, shoot, resolve } = setup("pebble");
    const snapshot = trial.vfx;
    if (options.legacy) trial.vfx = undefined;
    draw(trial);
    trial.vfx = snapshot; shoot(); if (options.legacy) trial.vfx = undefined;
    assert.equal(draw(trial).length, 0);
    assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 1);
    trial.vfx = snapshot; resolve(); if (options.legacy) trial.vfx = undefined;
    assert.equal(draw(trial).length, 0);
    assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === "−3.0"));
    assert.equal(calls.filter(call => call.name === "lineTo").length, options.reduced ? 0 : 8);
  }, options);
});


test("general melee impact uses approved hit cells and real simulation journals do not alter combat", () => {
  withStage(({ draw }) => {
    const { trial, resolve, source } = setup();
    source.stats.ranged = false; source.stats.melee = true;
    draw(trial); resolve(); trial.vfx.events[0].mode = "melee";
    const impacts = draw(trial);
    assert.equal(impacts.length, 1);
    assert.ok(impacts[0].args[0].src.endsWith(root + "hit.png"));
    assert.deepEqual(impacts[0].args.slice(1, 5), [0, 0, 444, 444]);
  });
  withStage(({ draw, calls }) => {
    const settings = { left: { key: "spring", organs: { ranged: 1, attack: 0 }, counts: {} },
      right: { key: "pebble", organs: { attack: 1 }, counts: {} }, distance: 2, random: false,
      rules: { maxSeconds: .7 } };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    draw(trial); trial.advance(.31); control.advance(.31);
    assert.equal(draw(trial).length, 1);
    assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 0);
    trial.advance(.39); control.advance(.39);
    const impacts = draw(trial);
    assert.equal(impacts.length, 1);
    assert.ok(impacts[0].args[0].src.endsWith(root + "spring.png"));
    assert.deepEqual(trial.history, control.history);
    assert.deepEqual(trial.result(), control.result());
    assert.deepEqual(trial.agents, control.agents);
  });
});

test("secondary damage uses general V4 art once in the stage and preserves missing-art feedback", () => {
  for (const kind of ["area", "reflect"]) for (const unavailable of [false, true]) {
    withStage(({ draw, calls }) => {
      const { trial, resolve } = setup("spring");
      draw(trial); resolve(kind, 2);
      const art = draw(trial);
      assert.equal(art.length, unavailable ? 0 : 1);
      if (art.length) assert.ok(art[0].args[0].src.endsWith(root + "hit.png"));
      assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === "−2.0"));
      assert.equal(calls.filter(call => call.name === "lineTo").length, unavailable ? 8 : 0,
        "only successful generic art replaces the secondary hit fallback");
    }, { unavailable });
  }
});
