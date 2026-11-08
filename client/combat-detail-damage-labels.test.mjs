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

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const helper = readFileSync(new URL("./combat-detail-dodge.test.mjs", import.meta.url), "utf8").split("const event = ")[0];
const box = { combatViewLayout, unitDisplaySize, drawUnitAttackRing, assert, source, createContext, runInContext, createCombatVfxCursor, createDetailCombatVfx,
  DETAIL_COMBAT_VFX_ASSETS, drawDetailVfxCell, drawDetailVitalEffect };
createContext(box); runInContext(helper.slice(helper.indexOf("function extract(")), box);
function modal(options = {}) {
  const view = box.modal(options); let labels = [];
  Object.assign(view.sandbox.Spawner, { detailDefenseImageReady, drawDetailDefenseEffect, drawDetailDefenseFallback, drawDetailDefenseLabels,
    layoutDetailCombatLabels(...args) { const result = layoutDetailCombatLabels(...args); labels = result.vitals; return result; } });
  return { ...view, draw(time, events = []) { labels = []; const result = view.draw(time, events); return { ...result, placed: labels }; } };
}
const event = (kind = "hit", extra = {}) => ({ id: kind, kind, at: 1, sourceId: "source", targetId: "target", amount: 2, ...extra });
const amounts = result => Array.from(result.texts.filter(row => /^(반사 )?[+−]/.test(row.text)));
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

test("actual modal displays direct damage independently of artwork and a real critical gets its existing gold tag", () => {
  for (const unavailable of [[], DETAIL_COMBAT_VFX_ASSETS]) for (const width of [320, 1040])
    for (const [kind, extra] of [["hit", {}], ["critical", {}], ["hit", { hitIndex: 1 }], ["area", {}], ["reflect", {}]]) {
      const view = modal({ unavailable, width }), outlines = [], context = view.canvas.getContext("2d"), stroke = context.strokeText;
      context.strokeText = function(text, x, y) { outlines.push({ text, x, y, color: this.strokeStyle }); stroke.call(this, text, x, y); };
      const result = view.draw(1.08, [event(kind, extra)]);
      assert.deepEqual(amounts(result).map(row => row.text), [kind === "reflect" ? "반사 −2.0" : "−2.0"]);
      assert.equal(result.texts.filter(row => row.text === "치명").length, kind === "critical" ? 1 : 0);
      assert.equal(outlines.filter(row => row.text === "치명" && row.color === "#203125").length, kind === "critical" ? 1 : 0);
      assert.equal(amounts(result)[0].color, kind === "critical" ? "#ffda8a" : kind === "reflect" ? "#d6b5ff" : "#fff9df");
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

test("combined actual damage, recovery, bleed and critical labels reserve distinct whole rectangles", () => {
  for (const width of [320, 1040]) for (const reduced of [false, true]) {
    const view = modal({ width }); view.sandbox.idleMotion.matches = reduced;
    const events = [event("critical", { amount: 7 }), event("hit", { id: "extra", amount: .25 }),
      event("drain", { amount: 3 }), event("bleed", { amount: .1 })];
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

test("real blocked criticals retain defense, one gold damage caption and emphasized approved effects in both views", async () => {
  for (const mode of ["melee", "ranged"]) {
    const live = actualScene(mode, "bean");
    live.source.stats.dna.meleePower = 4; live.source.stats.dna.rangedPower = 4;
    live.target.health = 100; Object.assign(live.target.stats.dna, { block: 100, blockPower: 50 });
    live.resolve();
    const critical = snapshotCombatVfx(live.environment, live.at).events.find(row => row.sourceId === "source" && row.kind === "block");
    assert.ok(critical?.critical && critical.amount > 0, mode + " resolves a real blocked critical");
    for (const width of [320, 1040]) for (const unavailable of [[], [DETAIL_DEFENSE_VFX.block]]) for (const reduced of [false, true]) {
      const view = modal({ width, unavailable }); view.sandbox.idleMotion.matches = reduced;
      const result = view.draw(live.at + .08, [critical]);
      assert.equal(result.texts.filter(row => row.text === "방어").length, 1);
      const [damage] = amounts(result), tags = result.texts.filter(row => row.text === "치명");
      assert.equal(amounts(result).length, 1); assert.equal(tags.length, 1);
      assert.equal(damage.color, "#ffda8a"); assert.equal(tags[0].color, "#ffda8a");
      assert.equal(tags[0].x, damage.x); assert.equal(tags[0].y, damage.y - 15);
      assert.ok(tags[0].y >= 0 && damage.y < 480);
      assert.equal(result.art.filter(row => row.image === DETAIL_DEFENSE_VFX.block).length, unavailable.length ? 0 : 1);
      const repeat = view.draw(live.at + .08, [critical, critical]);
      assert.equal(amounts(repeat).length, 1); assert.equal(repeat.texts.filter(row => row.text === "치명").length, 1);
      assert.equal(view.draw(live.at + .46, [critical]).texts.filter(row => row.text === "치명").length, 0);
    }
    const cursor = createCombatVfxCursor(), detail = createDetailCombatVfx();
    detail.consume(cursor.consume({ streamId: "critical", events: [] }, 0), 0);
    detail.consume(cursor.consume({ streamId: "critical", events: [critical] }, live.at + .08), live.at + .08);
    const command = detail.defenseCommands(positions, live.at + .08)[0];
    assert.equal(command.critical, true);
    const draws = [], ellipses = [], filters = [], ctx = new Proxy({ filter: "none",
      save() { filters.push(this.filter); }, restore() { this.filter = filters.pop(); },
      drawImage(...args) { draws.push({ args, filter: this.filter }); }, ellipse: (...args) => ellipses.push(args)
    }, { get: (target, key) => target[key] ?? (() => {}) });
    for (const flag of [false, true]) {
      drawDetailDefenseEffect(ctx, { ...command, critical: flag }, { complete: true, naturalWidth: 1254 }, { reducedMotion: false });
      drawDetailDefenseFallback(ctx, { ...command, critical: flag });
    }
    assert.ok(Math.abs(draws[1].args[3] / draws[0].args[3] - 1.3) < 1e-10);
    assert.ok(Math.abs(ellipses[1][2] / ellipses[0][2] - 1.3) < 1e-10);
    assert.equal(draws[0].filter, "none"); assert.equal(draws[1].filter, "sepia(1) saturate(3) brightness(1.2)");
    assert.equal(ctx.filter, "none");
    const previous = { window: globalThis.window, Image: globalThis.Image, assets: globalThis.SpawnerAssets, document: globalThis.document };
    try {
      for (const unavailable of [false, true]) for (const reduced of [false, true]) {
        globalThis.window = { matchMedia: () => ({ matches: reduced }), devicePixelRatio: 1 };
        globalThis.document = { createElement: () => ({ width: 0, height: 0,
          getContext: () => ({ drawImage() {}, getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) }) }) };
        delete globalThis.SpawnerAssets;
        const loaded = [];
        let failBlock = false;
        globalThis.Image = class {
          constructor() { loaded.push(this); }
          async decode() {
            if (failBlock && this.path === DETAIL_DEFENSE_VFX.block) { this.naturalWidth = 0; throw new Error("offline"); }
          }
          complete = true; naturalWidth = 4096; naturalHeight = 4096;
          set src(value) {
            this.path = value;

          }
          get src() { return this.path; }
        };
        const labels = [], outlines = [], art = [], stack = [], context = new Proxy({
          save() { stack.push({ fillStyle: this.fillStyle, font: this.font, filter: this.filter }); }, restore() { Object.assign(this, stack.pop()); },
          drawImage(image, ...args) { art.push({ image: image.src, args, filter: this.filter }); },
          fillText(text, x, y) { labels.push({ text, x, y, color: this.fillStyle }); },
          strokeText(text, x, y) { outlines.push({ text, x, y, color: this.strokeStyle }); }
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const trial = { agents: live.units.map((unit, side) => ({ ...unit, combat: { ...unit.combat, side } })), history: [], projectiles: [], time: 0, result: () => null,
          vfx: { version: 1, streamId: "blocked-critical", events: [] } };
        const stage = createCombatStage({ clientWidth: 1040, clientHeight: 480, getContext: () => context });
        await stage.prepare(trial);
        failBlock = unavailable;
        for (const image of loaded) if (unavailable && image.src === DETAIL_DEFENSE_VFX.block) image.naturalWidth = 0;
        stage.render(trial, 100, false);
        labels.length = 0; outlines.length = 0; art.length = 0;
        trial.time = live.at + .08; trial.vfx.events = [critical];
        trial.history = [{ index: 0, kind: "block", attackerId: "source", targetId: "target", time: live.at, damage: critical.amount, critical: true }];
        stage.render(trial, 200, true);
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        labels.length = 0; outlines.length = 0; art.length = 0; stage.render(trial, 200, true);
        assert.equal(labels.filter(row => row.text === "방어").length, 1);
        assert.equal(labels.filter(row => row.text === "치명" && row.color === "#ffda8a").length, 1);
        assert.equal(outlines.filter(row => row.text === "치명" && row.color === "#203125").length, 1);
        assert.equal(labels.filter(row => row.text.startsWith("−") && row.color === "#ffda8a").length, 1);
        assert.equal(art.filter(row => row.image === DETAIL_DEFENSE_VFX.block).length, unavailable ? 0 : 1);
        if (!unavailable) assert.equal(art.find(row => row.image === DETAIL_DEFENSE_VFX.block).filter, "sepia(1) saturate(3) brightness(1.2)");
      }
    } finally { globalThis.window = previous.window; globalThis.Image = previous.Image; globalThis.SpawnerAssets = previous.assets; globalThis.document = previous.document; }
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
