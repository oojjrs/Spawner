import test from "node:test";
import assert from "node:assert/strict";
import { createCombatStage } from "./combat-stage.mjs";
import { combatViewLayout } from "./unit-size.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

function withStage(run, { reduced = false, width = 1040, height = 480, unavailable = false } = {}) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets }, calls = [];
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 2 };
  globalThis.Image = class {
    set src(value) { this.source = value; this.complete = !unavailable; }
    get src() { return this.source; }
    get naturalWidth() { return 4096; } get naturalHeight() { return 4096; }
  };
  globalThis.SpawnerAssets = undefined;
  const context = new Proxy({
    stroke() { calls.push({ kind: "stroke", color: this.strokeStyle }); },
    fillText(...args) { calls.push({ kind: "label", args }); },
    arc(...args) { calls.push({ kind: "arc", color: this.strokeStyle, args }); },
    lineTo(...args) { calls.push({ kind: "line", color: this.strokeStyle, args }); },
    translate(...args) { calls.push({ kind: "translate", args }); },
    drawImage(...args) { calls.push({ kind: "image", args }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const stage = createCombatStage({ clientWidth: width, clientHeight: height, getContext: () => context });
  let now = 100;
  const draw = (trial, playing = false) => {
    calls.length = 0; stage.render(trial, now, playing); now += 100;
    return calls.filter(call => call.kind === "label" && /^[+−]/.test(call.args[0]));
  };
  try { run({ stage, draw, calls }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}
function fixture() {
  const agents = [0, 1].map(side => ({ id: side ? "right" : "left", tribe: "bean", health: 50,
    mode: "fight", facing: side ? -1 : 1, attributes: {}, animationStartedAt: 0,
    combat: { side, stunnedUntil: 0 }, stats: { health: 100, melee: true } }));
  return { agents, history: [], projectiles: [], time: 0, result: () => null,
    vfx: { version: 1, streamId: "trial", events: [] } };
}
const event = (kind, extra = {}) => ({ id: kind, kind, at: 1, amount: 2, sourceId: "left", targetId: "right", ...extra });
function arrive(trial, events, history = true) {
  trial.time = 1.05; trial.vfx.events.push(...events);
  if (history) for (const entry of events) trial.history.push({ index: trial.history.length, kind: entry.kind, time: entry.at,
    damage: entry.kind === "bleed" ? entry.amount : -entry.amount, attackerId: entry.sourceId, targetId: entry.targetId });
}

test("stage shows actual journal-only drain to distinct recipients once with existing visuals", () => {
  for (const reduced of [false, true]) for (const unavailable of [false, true]) withStage(({ draw, calls }) => {
    const trial = fixture(); draw(trial);
    const restores = [event("drain", { id: "right-drain", targetId: "right" }), event("drain", { targetId: "left", toId: "left", fromId: "right" })];
    arrive(trial, restores, false);
    trial.history.push({ index: 0, kind: "drain", time: 1, damage: -2, attackerId: "left", targetId: "right" });
    const labels = draw(trial);
    assert.equal(labels.length, 2); assert.ok(labels.every(label => label.args[0] === "+2.0"));
    assert.equal(new Set(labels.map(label => label.args[1])).size, 2);
    assert.ok(labels.every(label => label.args[1] > 0 && label.args[1] < 1040));
    assert.equal(calls.filter(call => call.kind === "arc" && call.color === "#c1ffc4").length, 2);
    assert.equal(draw(trial).length, 2, "journal and history replay does not duplicate either restore");
  }, { reduced, unavailable });
});

test("stage bleed has one damage label and no impact, collision recoil, or camera shake", () => {
  withStage(({ draw, calls }) => {
    const trial = fixture(); draw(trial); arrive(trial, [event("bleed")]);
    const first = draw(trial, true);
    assert.deepEqual(first.map(label => label.args[0]), ["−2.0"]);
    assert.equal(calls.filter(call => call.kind === "image" && call.args[0]?.src.includes("CombatVfxV4/")).length, 0);
    assert.equal(calls.filter(call => call.kind === "line").length, 0);
    draw(trial, true);
    const translations = calls.filter(call => call.kind === "translate").map(call => call.args);
    const formation = combatViewLayout(1040, 480, trial.agents);
    for (const point of formation.positions.values()) assert.ok(translations.some(([x, y]) => x === point.x && y === point.y));
    assert.ok(!translations.some(([x, y]) => y === 0 && x !== 0), "bleed does not shake the scene");
  });
});

test("standalone drain tails expire while paused and do not replay after reset or backseek", () => {
  withStage(({ draw, stage }) => {
    const trial = fixture(); draw(trial);
    arrive(trial, [event("drain", { targetId: "left" })], false);
    assert.equal(draw(trial).length, 1);
    for (let index = 0; index < 10; index++) draw(trial);
    assert.equal(draw(trial).length, 0, "paused simulation does not freeze a journal-only ring");
    assert.equal(draw(trial).length, 0);
    stage.clear(); assert.equal(draw(trial).length, 0);
    trial.time = 0; trial.vfx.events = []; draw(trial);
    arrive(trial, [event("drain", { id: "second", targetId: "left" })], false);
    assert.equal(draw(trial).length, 1);
    trial.time = .5; assert.equal(draw(trial).length, 0);
  });
});

test("canonical false recovery amounts, missing recipients and dead recipients have no recovery cue; unsupported legacy events are ignored", () => {
  for (const kind of ["drain", "regeneration", "bleed"]) for (const amount of [0, -1]) withStage(({ draw }) => {
    const trial = fixture(); draw(trial); arrive(trial, [event(kind, { amount })]);
    assert.equal(draw(trial).length, 0, kind + amount);
  });
  for (const targetId of ["hidden", "right"]) withStage(({ draw }) => {
    const trial = fixture(); draw(trial); arrive(trial, [event("regeneration", { targetId })]);
    if (targetId === "right") trial.agents[1].health = 0;
    assert.equal(draw(trial).length, 0);
  });
  withStage(({ draw, calls }) => {
    const trial = fixture(); trial.vfx = undefined; draw(trial);
    trial.time = 1.05; trial.history.push({ index: 0, kind: "regeneration", time: 1, damage: -2, attackerId: "left", targetId: "right" });
    assert.equal(draw(trial).length, 0);
    assert.equal(calls.filter(call => call.kind === "arc" && call.color === "#c1ffc4").length, 0);
  });
});

test("small-screen recovery labels stay inside the canvas and reduced motion keeps fixed ring size", () => {
  withStage(({ draw, calls }) => {
    const trial = fixture(); draw(trial); arrive(trial, [event("drain", { targetId: "right", amount: .02 })]);
    const label = draw(trial)[0]; assert.equal(label.args[0], "+0.02"); assert.ok(label.args[2] >= 20 && label.args[2] <= 340);
    const radius = calls.find(call => call.kind === "arc" && call.color === "#c1ffc4").args[2];
    draw(trial);
    assert.equal(calls.find(call => call.kind === "arc" && call.color === "#c1ffc4").args[2], radius);
  }, { reduced: true, width: 360, height: 360 });
});

test("real laboratory drain evidence render without changing deterministic simulation", () => {
  withStage(({ draw }) => {
    const settings = { left: { key: "bean", organs: { attack: 1 }, counts: { drain: 5, vitality: 5 } },
      right: { key: "pebble", organs: { attack: 1 }, counts: { vitality: 5 } }, distance: 1, random: false,
      rules: { maxSeconds: 6 } };
    const trial = createSimulationTrial(settings), control = createSimulationTrial(settings);
    trial.agents[0].health = control.agents[0].health = 45;
    for (const current of [trial, control]) for (const unit of current.agents) Object.assign(unit.combat.position, { x: unit.combat.side ? .4 : -.4, y: 0, fromX: unit.combat.side ? .4 : -.4, fromY: 0 });
    draw(trial);
    const observed = new Set();
    for (let index = 0; index < 30 && !trial.result()?.reason; index++) {
      trial.advance(.1); control.advance(.1);
      const labels = draw(trial, true);
      for (const event of trial.vfx.events) if (["drain", "regeneration"].includes(event.kind) && trial.time - event.at < .35 &&
        labels.some(label => label.args[0] === "+" + event.amount.toFixed(1))) observed.add(event.kind);
      assert.deepEqual(trial.history, control.history); assert.deepEqual(trial.agents, control.agents);
      assert.deepEqual(trial.result(), control.result());
    }
    assert.deepEqual([...observed].sort(), ["drain"]);
  });
});
