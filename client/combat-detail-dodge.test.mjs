import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect } from "./combat-detail-vfx.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
function extract(start, end) {
  const from = source.indexOf("    function " + start + "("), to = source.indexOf("    function " + end + "(", from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}

function modal({ unavailable = [], rejectDraw = false, version = 1, units, initialSnapshot, width = 1040, height = 480 } = {}) {
  const calls = [], stack = [];
  const context = new Proxy({ globalAlpha: 1, lineWidth: 1,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { this.path = []; },
    moveTo(...args) { this.path.push(["moveTo", ...args]); },
    lineTo(...args) { this.path.push(["lineTo", ...args]); },
    stroke() { calls.push({ kind: "stroke", color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha, path: this.path }); },
    drawImage(image, ...args) { calls.push({ kind: "image", image: image.path, args }); },
    fillText(text, x, y) { calls.push({ kind: "label", text, x, y, alpha: this.globalAlpha, font: this.font, color: this.fillStyle, align: this.textAlign }); },
    strokeText(text, x, y) { calls.push({ kind: "outline", text, x, y, color: this.strokeStyle, width: this.lineWidth }); },
    arc(...args) { this.path.push(["arc", ...args]); calls.push({ kind: "arc", color: this.fillStyle, args }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const agents = units ? units.map((agent, side) => ({ ...agent, combat: { ...agent.combat, id: "fight", side, stunnedUntil: 0 } })) : [0, 1].map(side => ({ id: side ? "target" : "source", tribe: "bean", health: 10,
    stats: { health: 10, ranged: !side, melee: !!side }, combat: { id: "fight", side, stunnedUntil: 0 }, attributes: {} }));
  const canvas = { clientWidth: width, clientHeight: height, dataset: {}, style: {}, getContext: () => context };
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  let drawnCommands = []; const commands = detail.commands;
  detail.commands = (...args) => drawnCommands = commands(...args);
  const sandbox = { state: { agents, rivals: [], simSeconds: 0, combatVfx: { version } },
    connection: { get simSeconds() { return sandbox.state.simSeconds; } },
    Spawner: { DETAIL_COMBAT_VFX_ASSETS, combatProfile: () => ({ attackInterval: 1 }), combatPrimary: () => "blade",
      CREATURE_ATTACK_ANIMATIONS: {}, drawDetailVitalEffect, drawDetailVfxCell: (...args) => !rejectDraw && drawDetailVfxCell(...args) },
    detailCombatVfx: detail, detailVfxImages: new Map(DETAIL_COMBAT_VFX_ASSETS.map(path => [path,
      { path, complete: !unavailable.includes(path), naturalWidth: 1776 }])),
    selectedCombatUnits: () => agents, combatOpen: {}, evolutionPanel: { hidden: true }, welcome: { hidden: true },
    combatPanel: { open: true }, combatWatch: { id: "fight" }, combatSelected: "target", combatSummary: {},
    combatRoster: { dataset: { key: "source,target" }, children: [] }, combatHeading: {}, combatDetail: {}, combatGauge: {},
    combatCanvas: canvas, combatArenaUnits: units => units, combatStatsText: () => "", combatBackgroundAt: () => "grassland",
    combatBackgrounds: { grassland: "ground.png" }, combatUnitScale: () => 1,
    unitDisplayBounds: new Map(["bean", "spore", "pebble", "spring"].map(key => [key, { width: .5, height: .8 }])), unitDisplayScales: new Map([["bean", 1]]),
    appearanceWorld: { prepare: () => new Map(), draw: () => false }, drawAgentAppearanceLayer() {},
    idleMotion: { matches: false }, window: { devicePixelRatio: 2 }, AGENT_HEIGHT: .8, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    combatVfxFrame: { active: [], projectiles: [] }
  };
  createContext(sandbox);
  runInContext(extract("combatVisualEvent", "combatBackgroundAt") + extract("drawCombatPanel", "templateDescription"), sandbox);
  function draw(time, events = []) {
    calls.length = 0;
    sandbox.state.simSeconds = time;
    sandbox.combatVfxFrame = cursor.consume(Array.isArray(events) ? { streamId: "fight", events } : events, time);
    detail.consume(sandbox.combatVfxFrame, time);
    sandbox.drawCombatPanel(time * 1000);
    return { texts: calls.filter(call => call.kind === "label"), commands: drawnCommands, labels: calls.filter(call => call.kind === "label" && call.text === "회피"),
      outlines: calls.filter(call => call.kind === "outline" && call.text === "회피"),
      art: calls.filter(call => call.kind === "image"),
      hits: calls.filter(call => call.kind === "stroke" && call.color === "#ffe1a0"),
      defense: calls.filter(call => call.kind === "stroke" && call.color === "#a6e4fa"),
      flights: calls.filter(call => call.kind === "arc" && call.color === "#b6ed84"),
      trails: calls.filter(call => call.kind === "stroke" && call.color === "#e0ffb7") };
  }
  draw(0, initialSnapshot || []);
  return { draw, detail, agents, sandbox, canvas };
}

const event = (kind = "miss", extra = {}) => ({ id: kind, kind, sourceId: "source", targetId: "target", at: 1, amount: 0, ...extra });
const dnaStats = ids => ATTRIBUTE_DNA.stats(ids.map(id => {
  const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 };
}));
function worldScene(mode, tribe) {
  const unit = (id, ownerId, genes, x) => ({ id, ownerId, tribe, x, y: 100, health: 100,
    attributes: Object.fromEntries(genes.map(key => [key === "legs" ? "feet" : key, 1])),
    combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dnaStats(genes) } });
  const source = unit("source", "left", mode === "melee" ? ["blade"] : ["blade", "secretion"], 100);
  const target = unit("target", "right", ["blade", "secretion", "carapace", "antenna", "legs"], mode === "melee" ? 100 : 102);
  const units = [source, target]; let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(["left", "right"].map(owner => [owner, { agents: units.filter(agent => agent.ownerId === owner),
      receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } }])),
    combatRandom: () => { rolls++; return 0; }, damageRandom: () => { rolls++; return .5; } };
  const combat = createCombat(environment); combat.update(source, 0);
  const action = source.attack, at = action.hitAt;
  function resolve() {
    if (mode === "ranged") combat.update(source, action.launchedAt);
    combat.update(mode === "ranged" ? target : source, at);
  }
  return { environment, units, source, target, at, resolve, rolls: () => rolls };
}

test("real melee and ranged misses label the blade-dominant defender without a false impact or state change", () => {
  for (const mode of ["melee", "ranged"]) for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const live = worldScene(mode, tribe), control = worldScene(mode, tribe);
    const view = modal({ units: live.units, initialSnapshot: snapshotCombatVfx(live.environment, 0) });
    assert.deepEqual(unitDisplayAttributes(live.target), { blade: 1 });
    assert.equal(live.target.stats.dna.evasion, 9);
    live.resolve(); control.resolve();
    const snapshot = snapshotCombatVfx(live.environment, live.at), before = structuredClone(snapshot);
    const miss = snapshot.events.find(row => row.kind === "miss" && row.targetId === "target");
    assert.ok(miss, mode + ":" + tribe); assert.equal(miss.amount, 0);
    const result = view.draw(live.at + .05, snapshot);
    assert.equal(result.labels.length, 1); assert.equal(result.outlines.length, 1);
    assert.equal(result.commands.filter(command => command.kind === "impact" && command.targetId === "target").length, 0);
    assert.equal(result.art.length, snapshot.events.filter(row => row.amount > 0).length, "only real damage gets artwork");
    assert.equal(result.hits.length, 0); assert.equal(result.defense.length, 0);
    assert.equal(view.sandbox.combatVisualEvent(view.agents[1]).kind, "dodge");
    assert.notEqual(view.sandbox.combatVisualEvent(view.agents[0])?.kind, "dodge", "the attacker did not evade its own missed attack");
    assert.match(view.sandbox.combatDetail.textContent, /회피$/);
    assert.deepEqual(snapshot, before); assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
    assert.equal(live.target.health, 100);
  }
});

test("dodge stays separate from simultaneous received hits, outgoing hits, blocks and stuns", () => {
  for (const reverse of [false, true]) for (const kind of ["hit", "block", "stun"]) {
    const { draw, sandbox, agents } = modal();
    const events = [event("miss"), event(kind, { id: "incoming", amount: kind === "stun" ? 0 : 2 }),
      event("hit", { id: "reciprocal", sourceId: "target", targetId: "source", amount: 2 })];
    const result = draw(1.05, reverse ? events.toReversed() : events);
    assert.equal(result.labels.length, 1); assert.equal(result.art.length, kind === "stun" ? 1 : 2);
    assert.equal(sandbox.combatVisualEvent(agents[1]).kind, kind);
    assert.equal(sandbox.combatVisualEvent(agents[0]).kind, "hit");
    assert.equal(sandbox.combatVisualEvent(agents[0]).targetId, "source");
  }
});

test("repeated or concurrent misses show one correctly aged label per defender and expire on schedule", () => {
  const { draw } = modal();
  const misses = [event("miss"), event("dodge", { id: "second" }), event("evasion", { id: "third" })];
  assert.equal(draw(.99, misses).labels.length, 0);
  const first = draw(1.05, misses).labels;
  assert.equal(first.length, 1); assert.ok(Math.abs(first[0].alpha - (1 - .125 ** 2)) < 1e-9);
  const repeated = draw(1.2, [...misses.toReversed(), ...misses]);
  assert.equal(repeated.labels.length, 1); assert.ok(repeated.labels[0].alpha < first[0].alpha);
  assert.equal(draw(1.4, misses).labels.length, 0); assert.equal(draw(1.5, misses).labels.length, 0);
  assert.equal(draw(1.1, misses).labels.length, 0, "backseek reconstructs state without replaying a transient dodge");
});

test("a dodge caption remains outlined, above the correct defender and readable on compact and large canvases", () => {
  for (const width of [320, 1040, 1600]) for (const height of [240, 480]) {
    const { draw } = modal({ width, height });
    const { labels: [label], outlines: [outline] } = draw(1.05, [event()]);
    assert.ok(label.x > width / 2 && label.x < width); assert.ok(label.y >= 20 && label.y < height * .76);
    assert.equal(label.align, "center"); assert.equal(label.color, "#d3f1ff"); assert.equal(outline.color, "#203125");
    assert.equal(outline.width, 4); assert.ok(parseFloat(label.font.split(" ")[1]) >= 17);
    assert.equal(label.x, outline.x); assert.equal(label.y, outline.y);
  }
});

test("a hidden recipient, reconnect, or stale snapshot cannot invent or replay a dodge", () => {
  const { draw } = modal();
  assert.equal(draw(1.05, [event("miss", { targetId: null })]).labels.length, 0);
  assert.equal(draw(1.1, [event()]).labels.length, 1, "already eligible state refreshes at its existing age");
  assert.equal(draw(1.15, [event("miss", { targetId: null })]).labels.length, 0);
  assert.equal(draw(1.2, { streamId: "new", events: [event()] }).labels.length, 0);
  const late = modal(); assert.equal(late.draw(2, [event()]).labels.length, 0);
});


test("simultaneous hidden-trait evasion and HP feedback keep separate readable lanes", () => {
  for (const width of [320, 1040]) for (const height of [240, 480]) for (const reduced of [false, true]) {
    const view = modal({ width, height }); view.sandbox.idleMotion.matches = reduced;
    const events = [event("miss"), event("heal", { id: "heal", amount: 2 }), event("bleed", { id: "bleed", amount: 1 })];
    const result = view.draw(1.05, events), dodge = result.labels[0];
    assert.equal(result.labels.length, 1); assert.equal(result.texts.length, 3);
    for (const text of result.texts.filter(text => text.text !== "회피")) {
      assert.ok(Math.abs(text.y - dodge.y) >= 32, "evade text must not obscure an actual HP change");
      assert.ok(dodge.y >= 20 && dodge.y <= height - 20);
    }
  }
});
