import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const root = "DesignAssets/Animations/CombatVfxV4/";
async function withStage(run, { unavailable = false, reduced = false } = {}) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets, document: globalThis.document };
  const calls = [];
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 2 };
  globalThis.Image = class {
    set src(value) { this.source = value; this.complete = !unavailable || !value.includes(root) && !value.includes("CombatDefenseV1/"); }
    get src() { return this.source; }
    get naturalWidth() { return this.src.includes(root) ? 1776 : 4096; }
    get naturalHeight() { return this.src.includes(root) ? 888 : 4096; }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {},
    getImageData(x, y, width, height) { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; } }) }) };
  globalThis.SpawnerAssets = { source: path => "https://assets.example/" + path };
  const context = new Proxy({}, { get: (target, key) => target[key] || ((...args) => calls.push({ name: key, args })) });
  const canvas = { clientWidth: 1040, clientHeight: 480, getContext: () => context };
  const stage = createCombatStage(canvas);
  let now = 100;
  const draw = async (trial, playing = false) => {
    stage.render(trial, now, playing);
    await new Promise(resolve => setImmediate(resolve));
    calls.length = 0; stage.render(trial, now, playing); now += 100;
    return calls.filter(call => call.name === "drawImage" && call.args[0]?.src.includes(root));
  };
  try { await run({ draw, stage, calls, canvas }); }
  finally {
    globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; globalThis.document = saved.document;
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

test("approved V4 flights and impacts follow four species, both directions and authoritative outcomes", async () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const reverse of [false, true])
    for (const [kind, amount] of [["hit", 3], ["critical", 3], ["block", 2], ["block", 0], ["dodge", 0], ["parry", 0], ["projectile-cancel", 0]]) {
      await withStage(async ({ draw, calls, canvas }) => {
        const { trial, shoot, resolve } = setup(tribe, reverse);
        await draw(trial); shoot();
        const flights = await draw(trial);
        assert.equal(flights.length, 1, tribe + kind);
        assert.ok(flights[0].args[0].src.endsWith(root + tribe + ".png"));
        assert.deepEqual(flights[0].args.slice(1, 5), [0, 0, 444, 444]);
        assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 0, "no duplicate legacy flight");
        assert.equal(canvas.width, 2080); assert.equal(canvas.height, 960);
        resolve(kind, amount);
        const hits = await draw(trial);
        const defense = kind === "block" || kind === "parry";
        assert.equal(hits.length, amount > 0 && !defense ? 1 : 0, tribe + kind + amount);
        if (defense) {
          assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("CombatDefenseV1/" + kind + ".png")).length, 1, "approved defense replaces its impact");
          assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === (kind === "block" ? "방어" : "패링")), "defense label is explicit");
        }
        if (amount > 0) {
          if (!defense) {
            assert.ok(hits[0].args[0].src.endsWith(root + tribe + ".png"));
            assert.ok(hits[0].args[1] > 0, "impact cell rather than flight cell");
          }
          assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === "−" + amount.toFixed(1)), "damage label preserved");
          assert.equal(calls.filter(call => call.name === "lineTo").length, 0, "no duplicate legacy hit or defense strokes at contact");
        }
      });
    }
});

test("paused and lethal impacts finish naturally without restarting; clear and replacement remove old effects", async () => {
  await withStage(async ({ draw, stage }) => {
    const { trial, shoot, resolve, target } = setup("spore");
    await draw(trial); shoot(); await draw(trial); resolve(); target.health = 0;
    trial.result = () => ({ reason: "death" });
    assert.equal((await draw(trial)).length, 1);
    for (let index = 0; index < 6; index++) await draw(trial);
    assert.equal((await draw(trial)).length, 0, "frozen simulation does not freeze final impact");
    assert.equal((await draw(trial)).length, 0, "repeated journal never restarts it");
    stage.clear(); assert.equal((await draw(trial)).length, 0, "cleared stage does not replay old impacts");
    const next = setup("bean"); await draw(next.trial); next.shoot(); await draw(next.trial); next.resolve();
    assert.equal((await draw(next.trial)).length, 1);
    const replacement = setup("pebble").trial;
    assert.equal((await draw(replacement)).length, 0);
  });
  await withStage(async ({ draw }) => {
    const { trial, shoot, resolve } = setup(); await draw(trial); shoot(); await draw(trial); resolve();
    assert.equal((await draw(trial)).length, 1);
    trial.time = 0; trial.history = []; trial.vfx.events = [];
    assert.equal((await draw(trial)).length, 0, "backseek clears the old V4 burst");
  });
});

test("missing V4 images, absent journals and reduced motion retain existing fallback and labels", async () => {
  for (const options of [{ unavailable: true }, { reduced: true }, { legacy: true }]) await withStage(async ({ draw, calls }) => {
    const { trial, shoot, resolve } = setup("pebble");
    const snapshot = trial.vfx;
    if (options.legacy) trial.vfx = undefined;
    await draw(trial);
    trial.vfx = snapshot; shoot(); if (options.legacy) trial.vfx = undefined;
    assert.equal((await draw(trial)).length, 0);
    assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 1);
    trial.vfx = snapshot; resolve(); if (options.legacy) trial.vfx = undefined;
    assert.equal((await draw(trial)).length, 0);
    assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === "−3.0"));
    assert.equal(calls.filter(call => call.name === "lineTo").length, options.reduced ? 0 : 8);
  }, options);
});


test("general melee impact uses approved hit cells and real simulation journals do not alter combat", async () => {
  await withStage(async ({ draw }) => {
    const { trial, resolve, source } = setup();
    source.stats.ranged = false; source.stats.melee = true;
    await draw(trial); resolve(); trial.vfx.events[0].mode = "melee";
    const impacts = await draw(trial);
    assert.equal(impacts.length, 1);
    assert.ok(impacts[0].args[0].src.endsWith(root + "hit.png"));
    assert.deepEqual(impacts[0].args.slice(1, 5), [0, 0, 444, 444]);
  });
  await withStage(async ({ draw, calls }) => {
    const settings = { left: { key: "spring", organs: { ranged: 1, attack: 0 }, counts: {} },
      right: { key: "pebble", organs: { attack: 1 }, counts: {} }, distance: 2, random: false,
      rules: { maxSeconds: 5 } };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    await draw(trial);
    while (!trial.projectiles.length && trial.time < 3) { trial.advance(1 / 60); control.advance(1 / 60); }
    trial.advance(1 / 60); control.advance(1 / 60);
    assert.equal((await draw(trial)).length, 1);
    assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("/projectile.png")).length, 0);
    const arrival = trial.projectiles[0].at + 1 / 60;
    trial.advance(arrival - trial.time); control.advance(arrival - control.time);
    const impacts = await draw(trial);
    assert.equal(impacts.length, 1);
    assert.ok(impacts[0].args[0].src.endsWith(root + "spring.png"));
    assert.deepEqual(trial.history, control.history);
    assert.deepEqual(trial.result(), control.result());
    assert.deepEqual(trial.agents, control.agents);
  });
});

test("secondary damage distinguishes reflection and preserves its caption without artwork", async () => {
  for (const kind of ["area", "reflect"]) for (const unavailable of [false, true]) {
    await withStage(async ({ draw, calls }) => {
      const { trial, resolve } = setup("spring");
      await draw(trial); resolve(kind, 2);
      const art = await draw(trial);
      assert.equal(art.length, unavailable || kind === "reflect" ? 0 : 1);
      if (art.length) assert.ok(art[0].args[0].src.endsWith(root + "hit.png"));
      if (kind === "reflect") assert.equal(calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("CombatDefenseV1/block.png")).length, unavailable ? 0 : 1);
      assert.ok(calls.some(call => call.name === "fillText" && call.args[0] === (kind === "reflect" ? "반사 −2.0" : "−2.0")));
      assert.equal(calls.filter(call => call.name === "lineTo").length, unavailable && kind !== "reflect" ? 8 : 0);
    }, { unavailable });
  }
});

test("healing cannot recoil a fighter or shake the screen while direct damage still does", async () => {
  const capture = async kind => {
    let transforms;
    await withStage(async ({ draw, calls }) => {
      const { trial, source } = setup();
      await draw(trial, true);
      trial.time = 1; source.health = 95; await draw(trial, true);
      trial.time = 1.1; source.health = 100;
      if (kind) {
        trial.vfx.events.push({ id: kind, kind, at: 1.1, sourceId: source.id, targetId: source.id, amount: 5 });
        trial.history.push({ index: 0, time: 1.1, kind, damage: 5, attackerId: source.id, targetId: source.id });
      }
      await draw(trial, true); trial.time = 1.15; await draw(trial, true);
      transforms = calls.filter(call => call.name === "translate").map(call => call.args);
    });
    return transforms;
  };
  const idle = await capture(null);
  assert.deepEqual(await capture("drain"), idle);
  assert.deepEqual(await capture("regeneration"), idle);
  assert.notDeepEqual(await capture("hit"), idle);
});

test("lantern charge uses the body clock after waiting, pausing with impact tails and stepping", async () => {
  await withStage(async ({ draw, calls }) => {
    const { trial, source, target } = setup();
    source.species = "lantern-keeper";
    for (let index = 0; index < 45; index++) await draw(trial);
    source.attack = { mode: "ranged", startedAt: 2, hitAt: 2.6, launchedAt: 2.6,
      shotLaunches: [2.6], endsAt: 3.2, directionX: 1 };
    trial.time = 2.3;
    await draw(trial);
    const charge = () => calls.filter(call => call.name === "drawImage" && call.args[0]?.src.endsWith("lantern-keeper/charge-atlas.webp"));
    assert.equal(charge().length, 1);
    const frame = charge()[0].args.slice(1, 5);
    trial.vfx.events.push({ id: "paused-hit", kind: "hit", at: 2.3, sourceId: target.id, targetId: source.id, amount: 1 });
    trial.history.push({ index: 0, time: 2.3, kind: "hit", damage: 1, attackerId: target.id, targetId: source.id });
    for (let index = 0; index < 6; index++) {
      await draw(trial);
      assert.equal(charge().length, 1);
      assert.deepEqual(charge()[0].args.slice(1, 5), frame);
    }
    trial.time = 2.6; await draw(trial);
    assert.equal(charge().length, 0);
  });
});
