import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, drawDetailVitalEffect, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell } from "./combat-detail-vfx.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const agents = ["source", "target", "ally"].map(id => ({ id, tribe: "bean", health: 50 }));
const points = new Map(agents.map((agent, index) => [agent.id, { x: 100 + index * 180, y: 260, width: 60, height: 100 }]));
const view = { scope: "fight", width: 600, height: 350 };
const event = (kind, extra = {}) => ({ id: kind, kind, at: 1, amount: 2, sourceId: "source", targetId: "target", ...extra });
function scene() {
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  function draw(time, events, visible = agents, positions = points, viewport = view, streamId = "fight") {
    detail.consume(cursor.consume({ streamId, events }, time), time);
    return detail.vitalCommands(visible, positions, time, viewport);
  }
  draw(0, []);
  return { draw, detail };
}
function canvas() {
  const calls = [], stack = [];
  const context = new Proxy({ globalAlpha: 1,
    save() { stack.push({ globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle }); },
    restore() { Object.assign(this, stack.pop()); },
    stroke() { calls.push({ kind: "stroke", color: this.strokeStyle }); },
    arc(...args) { calls.push({ kind: "arc", args }); },
    fillText(...args) { calls.push({ kind: "label", color: this.fillStyle, args }); },
    drawImage(...args) { calls.push({ kind: "image", args }); },
    lineTo(...args) { calls.push({ kind: "line", args }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  return { context, calls };
}

test("actual HP changes route to the recipient, not the damage source or original target", () => {
  for (const kind of ["heal", "drain", "regeneration", "bleed"]) {
    const { draw, detail } = scene();
    const commands = draw(1.05, [event(kind, { toId: "ally", mode: "ranged", projectileId: "parent-shot" })]);
    assert.equal(commands.length, 1, kind);
    assert.equal(commands[0].targetId, "ally"); assert.equal(commands[0].x, points.get("ally").x);
    assert.equal(commands[0].amount, 2); assert.equal(commands[0].kind, kind);
    assert.equal(detail.commands(agents, points, 1.05, 130, view).length, 0, "no collision or projectile artwork");
  }
});

test("zero, negative, cancelled, status-only, future, replayed and reconnect events do not invent HP feedback", () => {
  for (const kind of ["heal", "drain", "regeneration", "bleed"]) for (const amount of [0, -1])
    assert.equal(scene().draw(1.05, [event(kind, { amount })]).length, 0, kind + amount);
  for (const kind of ["bleed-apply", "stun", "projectile-cancel", "dodge", "parry"])
    assert.equal(scene().draw(1.05, [event(kind)]).length, 0, kind);
  const { draw } = scene(), healing = event("heal");
  assert.equal(draw(.9, [healing]).length, 0);
  assert.equal(draw(1.05, [healing, healing]).length, 1);
  assert.equal(draw(1.2, [healing]).length, 1);
  assert.equal(draw(1.86, [healing]).length, 0);
  assert.equal(draw(2, [healing]).length, 0);
  assert.equal(draw(1.1, [healing]).length, 0, "backseek never replays an old heal");
  assert.equal(draw(1.2, [healing], agents, points, view, "reconnect").length, 0);
});

test("different simultaneous recipients remain separate and same-recipient labels have stable lanes", () => {
  const { draw } = scene();
  const events = [event("heal"), event("heal", { id: "heal-2", targetId: "ally", amount: .25 }),
    event("drain", { targetId: "source", amount: .5 }), event("bleed", { amount: 1 })];
  const commands = draw(1.05, events);
  assert.equal(commands.length, 4);
  assert.deepEqual(commands.filter(c => c.targetId === "target").map(c => c.lane), [0, 1]);
  assert.deepEqual(draw(1.05, [...events].reverse()), commands);
});

test("bleed can finish at observed death positions but restoration never appears on corpses or omitted units", () => {
  const events = [event("bleed"), event("heal"), event("death", { amount: 0 })], { draw, detail } = scene();
  draw(.9, []);
  const survivors = agents.filter(agent => agent.id !== "target"), remaining = new Map([...points].filter(([id]) => id !== "target"));
  assert.equal(draw(1.05, events.slice(0, 2), survivors, remaining).length, 0, "living omitted recipient has no inferred anchor");
  const lethal = draw(1.1, events, survivors, remaining);
  assert.equal(lethal.length, 1); assert.equal(lethal[0].kind, "bleed"); assert.equal(lethal[0].x, points.get("target").x);
  const resized = draw(1.1, events, survivors, remaining, { ...view, width: 300, height: 175 });
  assert.equal(resized[0].x, lethal[0].x / 2); assert.equal(resized[0].y, lethal[0].y / 2);
  detail.clearView(); assert.equal(draw(1.15, events, survivors, remaining).length, 0);
  assert.equal(scene().draw(1.05, [event("heal")], agents.map(a => ({ ...a, health: a.id === "target" ? 0 : 50 }))).length, 0);
  assert.equal(scene().draw(1.05, [event("bleed"), event("death", { amount: 0 })], [], new Map()).length, 0,
    "never-observed death has no invented position");
});

test("tick regeneration coalesces to one ring while discrete heals retain real fractional values", () => {
  const { draw } = scene();
  const events = Array.from({ length: 6 }, (_, i) => event("regeneration", { id: "regen-" + i, at: 1 + i * .02, amount: .001 }));
  const commands = draw(1.1, events);
  assert.equal(commands.length, 1); assert.equal(commands[0].eventId, "regen-5");
  const { context, calls } = canvas();
  drawDetailVitalEffect(context, commands[0], view);
  assert.equal(calls.filter(call => call.kind === "arc").length, 1);
  assert.equal(calls.filter(call => call.kind === "label").length, 0, "no stream of misleading rounded zero values");
  calls.length = 0;
  drawDetailVitalEffect(context, { ...commands[0], kind: "heal", amount: .001 }, view);
  assert.equal(calls.find(call => call.kind === "label").args[0], "+0.001");
});

test("existing healing visuals and signed damage labels remain legible without false collision or motion", () => {
  for (const width of [360, 1040]) for (const reducedMotion of [false, true]) for (const kind of ["heal", "drain", "bleed"]) {
    const { draw } = scene(), [command] = draw(1.05, [event(kind)]), { context, calls } = canvas();
    drawDetailVitalEffect(context, command, { width, height: 480, reducedMotion });
    assert.equal(calls.filter(call => call.kind === "arc").length, kind === "bleed" ? 0 : 1);
    assert.equal(calls.filter(call => call.kind === "line").length, kind === "bleed" ? 0 : 2);
    const label = calls.find(call => call.kind === "label");
    assert.equal(label.args[0], kind === "bleed" ? "−2.0" : "+2.0");
    assert.ok(label.args[2] >= 20 && label.args[2] <= 460); assert.equal(context.globalAlpha, 1);
  }
});

function modal(reduced = false) {
  const { context, calls } = canvas(), detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const units = [0, 1].map(side => ({ id: side ? "target" : "source", tribe: "bean", health: 50,
    stats: { health: 100, melee: true }, combat: { id: "fight", side, stunnedUntil: 0 }, attributes: {} }));
  const sandbox = { state: { agents: units, rivals: [], simSeconds: 0, combatVfx: { version: 1 } },
    Spawner: { combatProfile: () => ({ attackInterval: 1 }), combatPrimary: () => "blade", CREATURE_ATTACK_ANIMATIONS: {},
      drawDetailVfxCell, drawDetailVitalEffect }, detailCombatVfx: detail,
    detailVfxImages: new Map(DETAIL_COMBAT_VFX_ASSETS.map(path => [path, { complete: true, naturalWidth: 1776 }])),
    selectedCombatUnits: () => units, combatOpen: {}, evolutionPanel: { hidden: true }, welcome: { hidden: true },
    combatPanel: { open: true }, combatWatch: { id: "fight" }, combatSelected: "source", combatSummary: {},
    combatRoster: { dataset: { key: "source,target" }, children: [] }, combatHeading: {}, combatDetail: {}, combatGauge: {},
    combatCanvas: { clientWidth: 1040, clientHeight: 480, dataset: {}, style: {}, getContext: () => context },
    combatArenaUnits: a => a, combatStatsText: () => "", combatBackgroundAt: () => "grassland", combatBackgrounds: { grassland: "ground.png" },
    combatUnitScale: () => 1, unitDisplayBounds: new Map([["bean", { width: .5, height: .8 }]]), unitDisplayScales: new Map([["bean", 1]]),
    appearanceWorld: { prepare: () => new Map(), draw: () => false }, drawAgentAppearanceLayer() {},
    window: { devicePixelRatio: 2 }, idleMotion: { matches: reduced }, AGENT_HEIGHT: .8,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)), combatVfxFrame: {} };
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const extract = (a, b) => source.slice(source.indexOf("    function " + a + "("), source.indexOf("    function " + b + "("));
  createContext(sandbox); runInContext(extract("combatVisualEvent", "combatBackgroundAt") + extract("drawCombatPanel", "templateDescription"), sandbox);
  function draw(time, events = []) {
    calls.length = 0; sandbox.state.simSeconds = time;
    sandbox.combatVfxFrame = cursor.consume({ streamId: "fight", events }, time); detail.consume(sandbox.combatVfxFrame, time);
    sandbox.drawCombatPanel(time * 1000);
    return calls.filter(call => call.kind === "label");
  }
  draw(0); return { draw, calls, sandbox };
}

test("the real detail modal renders incoming bleed and recovery once without adding hit recoil", () => {
  const { draw, calls, sandbox } = modal();
  const events = [event("heal"), event("drain", { targetId: "source", fromId: "target", toId: "source" }), event("bleed")];
  const labels = draw(1.05, events);
  assert.equal(labels.length, 3); assert.equal(labels.filter(label => label.args[0] === "+2.0").length, 2);
  assert.equal(labels.find(label => label.args[0] === "−2.0").args[1], 1040 * .61);
  assert.equal(calls.filter(call => call.kind === "image").length, 0);
  assert.equal(sandbox.combatVisualEvent(sandbox.state.agents[1]), null, "bleed is not a new collision pose");
  assert.equal(draw(1.15, [...events, ...events]).length, 3);
  assert.equal(draw(1.9, events).length, 0);
});

test("the real detail modal respects reduced motion for recovery rings and HP labels", () => {
  const { draw, calls } = modal(true), events = [event("heal")];
  const first = draw(1.05, events)[0], initialArcs = calls.filter(call => call.kind === "arc").map(call => call.args);
  const later = draw(1.25, events)[0], laterArcs = calls.filter(call => call.kind === "arc").map(call => call.args);
  assert.deepEqual(later.args, first.args, "HP labels stay in place");
  assert.deepEqual(laterArcs, initialArcs, "healing ring does not expand");
});

function serverScene() {
  const dna = ids => ATTRIBUTE_DNA.stats(ids.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id);
    return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 }; }));
  const unit = (id, ownerId, stats) => ({ id, ownerId, tribe: "bean", x: 100, y: 100, health: id === "target" ? 100 : 50,
    attributes: {}, combatDisposition: ownerId === "left" ? "aggressive" : "passive",
    stats: { health: 100, speed: 1, vision: 3, dna: stats }, moveStartedAt: 0, moveDuration: 0 });
  const source = unit("source", "left", { ...dna(["blade", "healer"]), bleed: 100, bleedPower: 2, lifesteal: 100 });
  const target = unit("target", "right", dna([])), ally = unit("ally", "left", dna([])), units = [source, target, ally];
  let rolls = 0;
  const environment = { games: new Map(), colonies: [], world: { terrain: new Uint8Array(320 * 320) },
    combatRandom: () => { rolls++; return .01; }, damageRandom: () => { rolls++; return .5; } };
  for (const ownerId of ["left", "right"]) environment.games.set(ownerId, { agents: units.filter(a => a.ownerId === ownerId),
    receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } });
  const combat = createCombat(environment);
  function tick(time) { environment.simSeconds = time; for (const unit of units) if (unit.health > 0) combat.update(unit, time); }
  return { source, target, ally, units, environment, tick, rolls: () => rolls };
}

test("real bleed, allied healing and lifesteal render exact evidence without altering combat or random calls", () => {
  const live = serverScene(), control = serverScene(), { draw } = scene(), observed = new Set();
  for (let index = 0; index <= 40; index++) {
    const time = index * .05; live.tick(time); control.tick(time);
    const snapshot = snapshotCombatVfx(live.environment, time), commands = draw(time, snapshot.events, live.units);
    for (const command of commands) {
      const actual = snapshot.events.find(event => event.id === command.eventId);
      assert.ok(actual); assert.equal(command.amount, actual.amount); assert.equal(command.targetId, actual.toId ?? actual.targetId);
      observed.add(command.kind);
    }
    assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
    const outcomes = s => s.events.map(({ kind, at, amount, sourceId, targetId }) => ({ kind, at, amount, sourceId, targetId }));
    assert.deepEqual(outcomes(snapshot), outcomes(snapshotCombatVfx(control.environment, time)));
  }
  assert.deepEqual([...observed].sort(), ["bleed", "drain", "heal"]);
});
