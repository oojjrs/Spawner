import { drawUnitAttackRing } from "./unit-attack-ring.mjs";
import { combatViewLayout, unitDisplaySize } from "./unit-size.mjs";
import { createCombatStage } from "./combat-stage.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombatVfxCursor } from "./combat-vfx-events.mjs";
import { createDetailCombatVfx, DETAIL_COMBAT_VFX_ASSETS, DETAIL_DEFENSE_VFX, drawDetailVfxCell, drawDetailVitalEffect,
  layoutDetailVitalLabels, layoutDetailCombatLabels, detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels } from "./combat-detail-vfx.mjs";
import { createCombat } from "../server/combat.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { snapshotCombatVfx } from "../server/combat-vfx-journal.mjs";

const event = (kind = "hit", extra = {}) => ({ id: kind, kind, at: 1, sourceId: "source", targetId: "target", amount: 2, ...extra });
const amounts = result => Array.from(result.texts.filter(row => /^(반사 피해 )?[+−]/.test(row.text)));
const agents = ["source", "target", "other"].map(id => ({ id, tribe: "bean", health: 100 }));
const positions = new Map(agents.map((agent, index) => [agent.id, { x: 100 + index * 180, y: 260, width: 60, height: 100 }]));
const viewport = { scope: "fight", width: 600, height: 350, includeDirectDamage: true };
test("damage stays just above its own head with compact text throughout the floating tail", () => {
  const labels = [], context = new Proxy({ save() {}, restore() {}, measureText: text => ({ width: text.length * 8 }),
    fillText(text, x, y) { labels.push({ text, x, y, font: this.font }); } }, { get: (target, key) => target[key] ?? (() => {}) });
  const point = positions.get("target");
  for (const age of [0, .4, .8]) {
    const command = { kind: "hit", channel: "impact", directDamage: true, targetId: "target", amount: 5,
      age, x: point.x, y: point.y - point.height * .5, bodyHeight: point.height, lane: 0 };
    const [placed] = layoutDetailVitalLabels(context, [command], { width: 600, height: 350, positions });
    assert.equal(placed.labelHidden, undefined);
    assert.equal(placed.labelX, point.x);
    assert.ok(placed.labelBottom < point.y - point.height);
    assert.ok(placed.labelY > point.y - point.height - 45);
    drawDetailVitalEffect(context, placed, { width: 600, height: 350, reducedMotion: false });
    assert.ok(Number(labels.at(-1).font.match(/([\d.]+)px/)[1]) <= 18);
  }
});
function controller() {
  const detail = createDetailCombatVfx(), cursor = createCombatVfxCursor();
  const draw = (time, events = [], units = agents, points = positions, view = viewport, streamId = "fight") => {
    detail.consume(cursor.consume({ streamId, events }, time), time);
    return detail.vitalCommands(units, points, time, view);
  };
  draw(0); return { draw, detail };
}




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

const dna = genes => ATTRIBUTE_DNA.stats(genes.map(id => { const gene = ATTRIBUTE_DNA.lookup.get(id); return { gene: id, grade: gene.grade }; }));
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
  const combat = createCombat(environment); combat.update(source, 0);
  for (let time = .05; !source.attack && time < 10; time += .05) combat.update(source, time);
  assert.ok(source.attack, mode + ":" + tribe + " begins an attack after approaching");
  const attack = source.attack;
  return { units, source, target, at: attack.hitAt, environment, rolls: () => rolls,
    resolve() { if (mode === "ranged") combat.update(source, attack.launchedAt); combat.update(mode === "ranged" ? target : source, attack.hitAt); } };
}

test("real lethal melee/ranged critical labels use actual HP loss rather than nominal attack damage and preserve RNG", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const mode of ["melee", "ranged"]) {
    const live = actualScene(mode, tribe), control = actualScene(mode, tribe), scene = controller();
    scene.draw(live.at - .01, [], live.units, positions); live.resolve(); control.resolve();
    const snapshot = snapshotCombatVfx(live.environment, live.at), before = structuredClone(snapshot);
    const rows = scene.draw(live.at + .05, snapshot.events, live.units.filter(agent => agent.health > 0), new Map([["source", positions.get("source")]]));
    const damage = rows.find(row => row.directDamage && row.targetId === "target");
    assert.ok(damage, mode + tribe); assert.equal(damage.amount, .75); assert.equal(damage.critical, true);
    assert.equal(live.target.health, 0); assert.deepEqual(live.units, control.units); assert.equal(live.rolls(), control.rolls());
    assert.deepEqual(snapshot, before);
  }
});


test("critical melee and every approved ranged impact use gold artwork at enlarged size without tinting ordinary hits", () => {
  for (const mode of ["melee", "ranged"]) for (const kind of ["bean", "spore", "pebble", "spring", "bubble-toad", "lantern-keeper", "vine-turtle", "spiny-back-beetle", "spiny-back-leader"]) {
    const units = [{ id: "source", ...( ["bean", "spore", "pebble", "spring"].includes(kind) ? { tribe: kind } : { species: kind }), health: 100 }, { id: "target", tribe: "bean", health: 100 }];
    const results = [];
    for (const critical of [false, true]) {
      const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
      detail.consume(cursor.consume({ streamId: "critical-art", events: [] }, 0), 0);
      const impact = event("hit", { critical, mode, amount: 3 });
      detail.consume(cursor.consume({ streamId: "critical-art", events: [impact] }, 1.08), 1.08);
      const commands = detail.commands(units, positions, 1.08, 100, { scope: "critical-art", width: 600, height: 350 });
      assert.equal(commands.length, 1, kind + mode); assert.equal(commands[0].critical, critical);
      const draws = [], filters = [], context = new Proxy({ filter: "none",
        save() { filters.push(this.filter); }, restore() { this.filter = filters.pop(); },
        drawImage(image, ...args) { draws.push({ filter: this.filter, args }); }
      }, { get: (target, key) => target[key] ?? (() => {}) });
      assert.ok(drawDetailVfxCell(context, { complete: true, naturalWidth: 4096, naturalHeight: 4096 }, commands[0]));
      assert.equal(draws[0].filter, critical ? "sepia(1) saturate(3) brightness(1.2)" : "none");
      assert.equal(context.filter, "none"); results.push(commands[0]);
      detail.consume(cursor.consume({ streamId: "critical-art", events: [impact, impact] }, 1.08), 1.08);
      assert.equal(detail.commands(units, positions, 1.08, 100, { scope: "critical-art", width: 600, height: 350 }).length, 1);
      detail.consume(cursor.consume({ streamId: "critical-art", events: [impact] }, 1.51), 1.51);
      assert.equal(detail.commands(units, positions, 1.51, 100, { scope: "critical-art", width: 600, height: 350 }).length, 0);
    }
    assert.ok(Math.abs(results[1].size / results[0].size - 1.3) < 1e-10, kind + mode + " critical emphasis");
  }
  const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
  detail.consume(cursor.consume({ streamId: "no-damage", events: [] }, 0), 0);
  detail.consume(cursor.consume({ streamId: "no-damage", events: [event("hit", { critical: true, amount: 0 })] }, 1.08), 1.08);
  assert.equal(detail.commands(agents, positions, 1.08, 100, viewport).length, 0);
  assert.equal(detail.vitalCommands(agents, positions, 1.08, viewport).length, 0);
});

test("laboratory direct critical captions retain the dark outline at their existing size and position", () => {
  const source = readFileSync(new URL("./combat-stage.mjs", import.meta.url), "utf8"), calls = [];
  const context = new Proxy({
    strokeText(text, x, y) { calls.push({ kind: "outline", text, x, y, color: this.strokeStyle, font: this.font }); },
    fillText(text, x, y) { calls.push({ kind: "fill", text, x, y, color: this.fillStyle, font: this.font }); }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const scope = { context, clock: .08, reducedMotion: { matches: false }, clamp: value => Math.max(0, Math.min(1, value)) };
  createContext(scope); runInContext(source.slice(source.indexOf("  function effectArt("), source.indexOf("  function projectileArt(")), scope);
  scope.effectArt({ event: { kind: "hit", damage: 3, critical: true, targetId: "target", index: 0 }, born: 0, lane: 0 },
    { target: { x: 400, y: 300, height: 100 } }, 1040, 480, true);
  const [outline, fill] = calls.filter(row => row.text === "치명");
  assert.equal(outline.kind, "outline"); assert.equal(outline.color, "#203125");
  assert.equal(fill.kind, "fill"); assert.equal(fill.color, "#ffda8a");
  assert.equal(outline.x, fill.x); assert.equal(outline.y, fill.y); assert.match(outline.font, /10px/);
});
