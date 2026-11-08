import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import { COMBAT_EFFECT_ANIMATIONS } from "./combat-effect-assets.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatStunPose, drawCombatStun } from "./combat-stun-vfx.mjs";
import { createCombatStage } from "./combat-stage.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from "./combat-detail-vfx.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const agent = () => ({ id: "target", health: 100, combat: { stunnedUntil: 2 } });
const point = { x: 300, y: 300, width: 80, height: 108 };
const screen = { width: 1040, height: 480 };
function recorder() {
  const calls = [], stack = [];
  const context = new Proxy({ globalAlpha: 1, lineWidth: 7, strokeStyle: "before", fillStyle: "before",
    save() { stack.push({ globalAlpha: this.globalAlpha, lineWidth: this.lineWidth, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); },
    ellipse(...args) { calls.push({ kind: "ellipse", args, color: this.strokeStyle, alpha: this.globalAlpha }); },
    fillRect(...args) { calls.push({ kind: "rect", args, color: this.fillStyle, alpha: this.globalAlpha }); },
    drawImage(image, ...args) { calls.push({ kind: "image", path: image.path, args }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  return { context, calls, stack };
}
const halos = calls => calls.filter(call => call.kind === "ellipse" && call.color === "#f6d983");
const dots = calls => calls.filter(call => call.kind === "rect" && call.color === "#ffe9a7");

test("stun is current authoritative state, with exact expiry and no corpse or birth halo", () => {
  assert.ok(combatStunPose(agent(), point, 0, screen));
  assert.ok(combatStunPose(agent(), point, 1.999, screen));
  assert.equal(combatStunPose(agent(), point, 2, screen), null);
  for (const change of [{ health: 0 }, { health: -1 }, { birth: {} }, { kind: "corpse" },
    { combat: null }, { combat: { stunnedUntil: 0 } }, { combat: { stunnedUntil: Infinity } },
    { combat: { stunImmuneUntil: 99 } }, { combat: { lastEvent: { kind: "stun", at: 0 } } }])
    assert.equal(combatStunPose({ ...agent(), ...change }, point, 1, screen), null);
  for (const bad of [null, { ...point, height: 0 }, { ...point, width: NaN }, { ...point, x: Infinity }])
    assert.equal(combatStunPose(agent(), bad, 1, screen), null);
  assert.equal(combatStunPose(agent(), point, NaN, screen), null);
});

test("body-bound orbit stays on canvas, freezes on pause and under reduced motion, and mutates nothing", () => {
  const unit = agent(), before = structuredClone(unit);
  for (const width of [32, 320, 1040]) for (const height of [32, 180, 480])
    for (const body of [{ width: 20, height: 18 }, { width: 80, height: 108 }, { width: 280, height: 400 }])
      for (const x of [-20, width / 2, width + 20]) for (const y of [-20, height]) {
        const pose = combatStunPose(unit, { x, y, ...body }, 1, { width, height });
        for (const dot of pose.dots) {
          assert.ok(dot.x - pose.dotSize / 2 >= 0 && dot.x + pose.dotSize / 2 <= width);
          assert.ok(dot.y - pose.dotSize / 2 >= 0 && dot.y + pose.dotSize / 2 <= height);
        }
      }
  assert.deepEqual(combatStunPose(unit, point, 1, screen), combatStunPose(unit, point, 1, screen));
  assert.notDeepEqual(combatStunPose(unit, point, 1, screen).dots, combatStunPose(unit, point, 1.2, screen).dots);
  assert.deepEqual(combatStunPose(unit, point, 1, { ...screen, reducedMotion: true }).dots,
    combatStunPose(unit, point, 1.2, { ...screen, reducedMotion: true }).dots);
  assert.deepEqual(unit, before);
});

test("shared renderer preserves the approved palette and three-square motif, restoring canvas state", () => {
  const { context, calls, stack } = recorder();
  assert.equal(drawCombatStun(context, agent(), point, 1, screen), true);
  assert.equal(halos(calls).length, 1); assert.equal(dots(calls).length, 3);
  assert.equal(context.strokeStyle, "before"); assert.equal(context.fillStyle, "before");
  assert.equal(context.lineWidth, 7); assert.equal(context.globalAlpha, 1); assert.equal(stack.length, 0);
  calls.length = 0;
  assert.equal(drawCombatStun(context, agent(), point, 2, screen), false); assert.equal(calls.length, 0);
});

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const helperFile = readFileSync(new URL("./combat-detail-dodge.test.mjs", import.meta.url), "utf8").split("const event = ")[0];
const box = { combatViewLayout, unitDisplaySize, drawUnitAttackRing, assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helperFile.slice(helperFile.indexOf("function extract(")), box);
function detail(options) {
  const view = box.modal(options), rendered = [];
  view.sandbox.Spawner.drawCombatStun = (...args) => {
    const pose = combatStunPose(...args.slice(1));
    if (drawCombatStun(...args)) rendered.push(pose);
  };
  return { ...view, draw(time, events = []) {
    rendered.length = 0;
    view.sandbox.combatRoster.dataset.key = view.agents.filter(unit => unit.health > 0 && unit.combat?.id === "fight").map(unit => unit.id).join(",");
    const result = view.draw(time, events); return { ...result, rendered: structuredClone(rendered) };
  } };
}
const units = tribe => [0, 1].map(side => ({ id: side ? "target" : "source", tribe, health: 100,
  attributes: {}, stats: { health: 100 }, combat: { side, stunnedUntil: 0 } }));

test("real detail drawing shows only the stunned actor in both directions and sizes, without replay dependency", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const side of [0, 1])
    for (const width of [320, 1040]) for (const reduced of [false, true]) {
      const view = detail({ units: units(tribe), width });
      view.sandbox.idleMotion.matches = reduced; view.agents[side].combat.stunnedUntil = 2;
      const state = structuredClone(view.agents), first = view.draw(1);
      assert.equal(first.rendered.length, 1); assert.equal(first.rendered[0].targetId, view.agents[side].id);
      assert.deepEqual(view.draw(1).rendered, first.rendered, "paused paints are stable");
      assert.ok(first.art.every(draw => draw.image === COMBAT_EFFECT_ANIMATIONS.stun.image), "a status without a journal does not invent damage art");
      const next = view.draw(1.2).rendered;
      if (reduced) assert.deepEqual(next[0].dots, first.rendered[0].dots);
      else assert.notDeepEqual(next[0].dots, first.rendered[0].dots);
      assert.equal(view.draw(2, [{ id: "stale", kind: "stun", at: 2, sourceId: "source", targetId: "target", amount: 0 }]).rendered.length, 0);
      assert.deepEqual(structuredClone(view.agents), state);
      view.agents[side].health = 0; assert.equal(view.draw(1.5).rendered.length, 0);
    }
});

async function withLab(run, reduced) {
  const saved = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets };
  const rec = recorder();
  globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 2 };
  delete globalThis.SpawnerAssets;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 4096; this.naturalHeight = 4096; } set src(value) { this.path = value; } async decode() {} };
  const canvas = { clientWidth: 1040, clientHeight: 480, getContext: () => rec.context };
  const stage = createCombatStage(canvas); let now = 100;
  const draw = trial => { rec.calls.length = 0; stage.render(trial, now += 100, false); return { halos: structuredClone(halos(rec.calls)), dots: structuredClone(dots(rec.calls)), art: structuredClone(rec.calls.filter(call => call.path === COMBAT_EFFECT_ANIMATIONS.stun.image)) }; };
  try { await stage.prepare(); await run({ draw, stage }); }
  finally { globalThis.window = saved.window; globalThis.Image = saved.Image; globalThis.SpawnerAssets = saved.assets; }
}

test("laboratory shares the status renderer, including zero-time pause, reset, expiry and reduced motion", async () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const side of [0, 1]) for (const reduced of [false, true])
    await withLab(({ draw, stage }) => {
      const trial = { agents: units(tribe), history: [], projectiles: [], time: 0, result: () => null };
      trial.agents[side].combat.stunnedUntil = 2;
      const before = structuredClone(trial.agents), first = draw(trial);
      assert.equal(first.art.length, 1); assert.equal(first.halos.length, 0); assert.equal(first.dots.length, 0);
      assert.deepEqual(draw(trial), first, "wall-clock paints cannot animate a paused zero-time status");
      trial.time = 1;
      if (reduced) assert.deepEqual(draw(trial), first); else assert.notDeepEqual(draw(trial).art, first.art);
      stage.clear(); assert.equal(draw(trial).art.length, 1, "reopening reconstructs current stun without events");
      trial.time = 2; assert.equal(draw(trial).art.length, 0);
      trial.time = 1; trial.agents[side].health = 0; assert.equal(draw(trial).art.length, 0);
      trial.agents[side].health = 100; assert.deepEqual(trial.agents, before);
    }, reduced);
});

const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade, q: 0, r: 0, rotation: 0 }; }));
function actualScene(mode, tribe) {
  const make = (id, ownerId, genes, x) => ({ id, ownerId, tribe, x, y: 100, health: 100, attributes: { blade: 1 },
    combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = make("source", "left", mode === "ranged" ? ["blade", "secretion"] : ["blade"], 100);
  const target = make("target", "right", ["blade"], mode === "ranged" ? 102 : 100);
  source.stats.dna = { ...source.stats.dna, stun: 100, stunTime: .5 };
  const units = [source, target];
  // Ranged fire alone does not create a detail encounter. Shoot into an
  // existing contact fight so projectileHit sets its real combat status.
  const ally = mode === "ranged" ? make("ally", "left", ["blade"], target.x) : null;
  if (ally) units.push(ally);
  let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(["left", "right"].map(owner => [owner, { agents: units.filter(unit => unit.ownerId === owner),
      receiveDamage(unit, amount) { unit.health = Math.max(0, unit.health - amount); } }])),
    combatRandom: () => { rolls++; return 0; }, damageRandom: () => .5 };
  const combat = createCombat(environment);
  if (ally) assert.equal(combat.engage(ally, target, 0), true);
  combat.update(source, 0);
  for (let time = .05; !source.attack && time < 10; time += .05) combat.update(source, time);
  assert.ok(source.attack, mode + ":" + tribe + " begins an attack after approaching");
  const action = source.attack;
  return { units, target, environment, at: action.hitAt, rolls: () => rolls,
    resolve() { if (mode === "ranged") combat.update(source, action.launchedAt); combat.update(mode === "ranged" ? target : source, action.hitAt); } };
}

test("actual melee and ranged stuns drive detail status without changing damage, journal or RNG", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const mode of ["melee", "ranged"]) {
    const live = actualScene(mode, tribe), control = actualScene(mode, tribe); live.resolve(); control.resolve();
    assert.ok(live.target.combat, mode + ":" + tribe + ":" + live.target.health);
    const snapshot = snapshotCombatVfx(live.environment, live.at), before = structuredClone(snapshot), until = live.target.combat.stunnedUntil;
    assert.ok(until > live.at); assert.ok(snapshot.events.some(event => event.kind === "stun" && event.amount === 0));
    const view = detail({ units: live.units.slice(0, 2), initialSnapshot: snapshot });
    view.agents[1].combat.stunnedUntil = until;
    const result = view.draw(live.at + .01, snapshot);
    assert.equal(result.rendered.length, 1); assert.equal(result.rendered[0].targetId, "target");
    assert.equal(result.rendered[0].until, until); assert.equal(view.draw(until, snapshot).rendered.length, 0);
    assert.deepEqual(live.units, control.units); assert.deepEqual(snapshot, before); assert.equal(live.rolls(), control.rolls());
  }
});
