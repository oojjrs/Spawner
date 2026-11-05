import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect,
  layoutDetailVitalLabels, layoutDetailCombatLabels, detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels } from "./combat-detail-vfx.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const helper = readFileSync(new URL("./combat-detail-dodge.test.mjs", import.meta.url), "utf8").split("const event = ")[0];
const box = { assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper.slice(helper.indexOf("function extract(")), box);
function modal(options = {}) {
  const view = box.modal(options); let labels = [];
  Object.assign(view.sandbox.Spawner, { detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels,
    layoutDetailCombatLabels(...args) { const result = layoutDetailCombatLabels(...args); labels = result.vitals; return result; } });
  return { ...view, draw(time, events = []) { labels = []; const result = view.draw(time, events); return { ...result, placed: labels }; } };
}
const event = (kind = "hit", extra = {}) => ({ id: kind, kind, at: 1, sourceId: "source", targetId: "target", amount: 2, ...extra });
const amounts = result => Array.from(result.texts.filter(row => /^[+−]/.test(row.text)));
const agents = ["source", "target", "other"].map(id => ({ id, tribe: "bean", health: 100 }));
const positions = new Map(agents.map((agent, index) => [agent.id, { x: 100 + index * 180, y: 260, width: 60, height: 100 }]));
const viewport = { scope: "fight", width: 600, height: 350, includeDirectDamage: true };
function controller() {
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const draw = (time, events = [], units = agents, points = positions, view = viewport, streamId = "fight") => {
    detail.consume(cursor.consume({ streamId, events }, time), time);
    return detail.vitalCommands(units, points, time, view);
  };
  draw(0); return { draw, detail };
}

test("actual modal displays direct damage independently of artwork and a real critical gets its existing gold tag", () => {
  for (const unavailable of [[], DETAIL_COMBAT_VFX_ASSETS]) for (const width of [320, 1040])
    for (const [kind, extra] of [["hit", {}], ["critical", {}], ["hit", { hitIndex: 1 }], ["area", {}], ["reflect", {}]]) {
      const view = modal({ unavailable, width }), result = view.draw(1.08, [event(kind, extra)]);
      assert.deepEqual(amounts(result).map(row => row.text), ["−2.0"]);
      assert.equal(result.texts.filter(row => row.text === "치명").length, kind === "critical" ? 1 : 0);
      assert.equal(amounts(result)[0].color, kind === "critical" ? "#ffda8a" : "#fff9df");
      assert.equal(result.placed.filter(row => row.directDamage).length, 1);
      assert.equal(view.draw(1.6, [event(kind, extra)]).art.length, 0, "number tail never extends impact art");
      assert.equal(amounts(view.draw(1.6, [event(kind, extra)])).length, 1);
      assert.equal(amounts(view.draw(1.851, [event(kind, extra)])).length, 0);
    }
});

test("block residual owns its number once and does not become a delayed ordinary label", () => {
  for (const unavailable of [[], DETAIL_COMBAT_VFX_ASSETS]) {
    const view = modal({ unavailable }), events = [event("block", { amount: .7 }), event("hit", { id: "other-hit", amount: 5 })];
    assert.deepEqual(amounts(view.draw(1.08, events)).map(row => row.text).sort(), ["−0.7", "−5.0"]);
    assert.deepEqual(amounts(view.draw(1.6, events)).map(row => row.text), ["−5.0"]);
    assert.equal(amounts(view.draw(1.86, events)).length, 0);
  }
  for (const kind of ["stun", "bleed-apply", "dodge", "parry", "counter", "attack", "shoot", "projectile-cancel"])
    assert.equal(amounts(modal().draw(1.08, [event(kind)])).length, 0, kind);
  for (const amount of [0, -1]) assert.equal(amounts(modal().draw(1.08, [event("hit", { amount })])).length, 0);
});

test("independent recipient, fractional HP, duplicate ordering, expiry, reset and opt-in semantics remain exact", () => {
  const scene = controller(), events = [event("hit", { amount: .004 }), event("area", { targetId: "other", amount: .25 }),
    event("reflect", { targetId: "target", toId: "source", amount: 1.5 })];
  const first = scene.draw(1.05, [...events].reverse());
  assert.deepEqual(first.map(row => [row.targetId, row.amount]), [["other", .25], ["target", .004], ["source", 1.5]]);
  assert.deepEqual(scene.draw(1.05, [...events, ...events]), first);
  assert.equal(scene.draw(1.6, events).length, 3); assert.equal(scene.draw(1.851, events).length, 0);
  assert.equal(scene.draw(1.2, events).length, 0, "backseek cannot replay transient numbers");
  assert.equal(scene.draw(1.3, events, agents, positions, viewport, "reconnect").length, 0);
  assert.equal(controller().draw(1.1, events, agents, positions, { ...viewport, includeDirectDamage: false }).length, 0, "lab stays opt-out");
  assert.deepEqual(amounts(modal().draw(1.08, [event("hit", { amount: .004 })])).map(row => row.text), ["−0.004"]);
});

test("direct labels retain only observed death positions and never invent an omitted living recipient", () => {
  const scene = controller(), hit = event("critical"), death = event("death", { id: "death", amount: 0 });
  scene.draw(.9);
  const survivors = agents.filter(unit => unit.id !== "target"), points = new Map([...positions].filter(([id]) => id !== "target"));
  assert.equal(scene.draw(1.05, [hit], survivors, points).length, 0);
  const retained = scene.draw(1.1, [hit, death], survivors, points);
  assert.equal(retained.length, 1); assert.equal(retained[0].x, positions.get("target").x);
  const resized = scene.draw(1.2, [hit, death], survivors, points, { ...viewport, width: 300, height: 175 });
  assert.equal(resized[0].x, retained[0].x / 2); assert.equal(resized[0].y, retained[0].y / 2);
  scene.detail.clearView(); assert.equal(scene.draw(1.3, [hit, death], survivors, points).length, 0);
  const unseen = controller(); unseen.detail.clearView();
  assert.equal(unseen.draw(1.05, [hit, death], [], new Map()).length, 0);
  const redacted = controller(); assert.equal(redacted.draw(1.05, [hit]).length, 1);
  assert.equal(redacted.draw(1.1, [{ ...hit, sourceId: null, targetId: null }]).length, 0);
});

test("combined actual damage, healing, bleed and critical labels reserve distinct whole rectangles", () => {
  for (const width of [320, 1040]) for (const reduced of [false, true]) {
    const view = modal({ width }); view.sandbox.idleMotion.matches = reduced;
    const events = [event("critical", { amount: 7 }), event("hit", { id: "extra", amount: .25 }),
      event("heal", { amount: 3 }), event("bleed", { amount: .1 })];
    const result = view.draw(1.08, events), labels = result.placed.filter(row => !row.labelHidden);
    assert.equal(amounts(result).length, 4); assert.equal(labels.length, 4);
    for (const [i, a] of labels.entries()) {
      assert.ok(a.labelTop >= 0 && a.labelBottom <= 480 && a.labelLeft >= 0 && a.labelRight <= width);
      for (const b of labels.slice(i + 1)) assert.ok(a.labelRight <= b.labelLeft || a.labelLeft >= b.labelRight ||
        a.labelBottom <= b.labelTop || a.labelTop >= b.labelBottom, "whole text and critical tag do not overlap");
    }
    const repeat = view.draw(1.08, events);
    assert.deepEqual(repeat.placed, result.placed, "paused layouts are stable");
    if (reduced) assert.deepEqual(view.draw(1.2, events).placed.map(row => row.labelY), labels.map(row => row.labelY), "no decorative vertical lift; horizontal placement still follows the real recoiling body");
  }
});

test("dense compact placement omits excess text rather than piling it at the top or drawing outside the viewport", () => {
  const context = { save() {}, restore() {}, measureText: text => ({ width: text.length * 12 }) };
  const commands = Array.from({ length: 30 }, (_, index) => ({ kind: "critical", channel: "impact", directDamage: true, critical: true,
    targetId: "target", amount: index + 1, age: .1, x: 160, y: 90, bodyHeight: 80, lane: index }));
  const before = structuredClone(commands), result = layoutDetailVitalLabels(context, commands, { width: 320, height: 180 });
  assert.ok(result.some(row => row.labelHidden)); assert.deepEqual(commands, before);
  const visible = result.filter(row => !row.labelHidden);
  for (const [i, a] of visible.entries()) {
    assert.ok(a.labelTop >= 0 && a.labelBottom <= 180 && a.labelLeft >= 0 && a.labelRight <= 320);
    for (const b of visible.slice(i + 1)) assert.ok(a.labelRight <= b.labelLeft || a.labelLeft >= b.labelRight || a.labelBottom <= b.labelTop || a.labelTop >= b.labelBottom);
  }
});

const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade, shape: [...gene.steps], rotation: 0 }; }));
function actualScene(mode, tribe) {
  const unit = (id, ownerId, genes, x) => ({ id, ownerId, tribe, x, y: 100, health: id === "target" ? .75 : 100,
    attributes: {}, combatDisposition: "aggressive", moveStartedAt: 0, moveDuration: 0,
    stats: { health: 100, speed: 1, vision: 4, dna: dna(genes) } });
  const source = unit("source", "left", mode === "ranged" ? ["blade", "secretion"] : ["blade"], 100);
  const target = unit("target", "right", ["blade"], mode === "ranged" ? 102 : 100), units = [source, target];
  source.stats.dna = { ...source.stats.dna, critical: 100, criticalPower: 200, meleePower: 1000, rangedPower: 1000 };
  let rolls = 0;
  const environment = { world: { terrain: new Uint8Array(320 * 320).fill(4) },
    games: new Map(["left", "right"].map(owner => [owner, { agents: units.filter(agent => agent.ownerId === owner),
      receiveDamage(agent, amount) { agent.health = Math.max(0, agent.health - amount); } }])),
    combatRandom: () => { rolls++; return 0; }, damageRandom: () => .5 };
  const combat = createCombat(environment); combat.update(source, 0); const attack = source.attack;
  return { units, source, target, at: attack.hitAt, environment, rolls: () => rolls,
    resolve() { if (mode === "ranged") combat.update(source, attack.launchedAt); combat.update(mode === "ranged" ? target : source, attack.hitAt); } };
}

test("real lethal melee/ranged critical labels use actual HP loss rather than nominal attack damage and preserve RNG", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const mode of ["melee", "ranged"]) {
    const live = actualScene(mode, tribe), control = actualScene(mode, tribe), scene = controller();
    scene.draw(0, [], live.units, positions); live.resolve(); control.resolve();
    const snapshot = snapshotCombatVfx(live.environment, live.at), before = structuredClone(snapshot);
    const rows = scene.draw(live.at + .05, snapshot.events, live.units.filter(agent => agent.health > 0), new Map([["source", positions.get("source")]]));
    const damage = rows.find(row => row.directDamage && row.targetId === "target");
    assert.ok(damage, mode + tribe); assert.equal(damage.amount, .75); assert.equal(damage.critical, true);
    assert.equal(live.target.health, 0); assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
    assert.deepEqual(snapshot, before);
  }
});
