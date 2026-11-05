import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { hasCombatEvolution } from "./combat-attributes.mjs";
import { unitRangedLifecycleAnimation } from "./unit-ranged.mjs";
import { agentDeathAnimation, agentDeathFrame } from "./agent-death.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";

const tribes = ["bean", "spore", "pebble", "spring"];
const forms = ["base", "blade", "secretion", "carapace", "antenna", "feet"];
const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function renderer(tribe, reduced = false, missing = false) {
  const base = { name: "base", complete: true, naturalWidth: 4096 },
    ranged = { name: "ranged", complete: true, naturalWidth: 4096 },
    attribute = { name: "attribute", width: 512 }, combat = { name: "combat", width: 512 };
  const scope = createContext({
    Spawner: { unitDisplayAttributes, hasCombatEvolution, unitRangedLifecycleAnimation, agentDeathAnimation,
      imageFrameGeometry, COMBAT_ATTRIBUTE_KEYS: ["blade", "piercing", "carapace"] },
    combatAttributeArt: { ready: () => true, frame: () => combat },
    corpsePlaybackTime: () => 10.13, agentDeathFrame, idleMotion: { matches: reduced },
    unitAnimationSheets: new Map([[tribe, new Map([["death", { sprite: base, scale: 1 }]])]]),
    agentRangedImage: () => missing ? null : ranged,
    tribeArt: { animationFrame: () => attribute }, sproutCombatFrame: () => missing ? null : attribute, AGENT_HEIGHT: .7,
    state: { simSeconds: 10.13 }, clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    drawSelectionOutline: (...args) => calls.push(["outline", ...args]),
    drawCreatureCorpse: () => "creature"
  });
  runInContext(source.match(/^    function drawAgentCorpse\([^]*?^    }/m)[0], scope);
  const calls = [], stack = [];
  let state = { globalAlpha: .8, filter: "none", x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const ctx = {
    get globalAlpha() { return state.globalAlpha; }, set globalAlpha(value) { state.globalAlpha = value; },
    get filter() { return state.filter; }, set filter(value) { state.filter = value; },
    save() { stack.push({ ...state }); }, restore() { state = stack.pop(); },
    translate(x, y) { state.x += x; state.y += y; calls.push(["translate", x, y]); },
    scale(x, y) { state.scaleX *= x; state.scaleY *= y; calls.push(["scale", x, y]); },
    drawImage(...args) { calls.push(["draw", { ...state }, ...args]); }
  };
  return { draw: (...args) => scope.drawAgentCorpse(ctx, ...args), calls, base, ranged, attribute, combat, state: () => state };
}

test("all 24 world/list corpse forms preserve the final visible direction exactly once", () => {
  for (const tribe of tribes) for (const form of forms) for (const facing of [-1, 1, undefined])
    for (const reduced of [false, true]) for (const missing of [false, true]) {
      const fixture = renderer(tribe, reduced, missing);
      const corpse = { tribe, kind: "corpse", health: 0, facing, attributes: form === "base" ? {} : { [form]: 1 },
        diedAt: 10, decaysAt: 13 }, before = structuredClone(corpse);
      assert.equal(fixture.draw(corpse, 80, 160, 100, "selection", .5), true);
      const draw = fixture.calls.find(call => call[0] === "draw");
      assert.equal(draw[1].scaleX, facing < 0 ? -1 : 1, `${tribe}/${form}`);
      assert.equal(draw[1].scaleY, 1);
      assert.deepEqual(fixture.calls.filter(call => call[0] === "scale"), [["scale", facing < 0 ? -1 : 1, 1]]);
      assert.equal(draw[1].x, 80); assert.equal(draw[1].y, 160);
      const evolved = ["blade", "carapace"].includes(form);
      const expected = evolved ? fixture.combat : form === "secretion" && !missing ? fixture.ranged :
        (tribe !== "bean" && ["antenna", "feet"].includes(form) || tribe === "bean" && form === "feet" && !missing) ? fixture.attribute : fixture.base;
      assert.equal(draw[2], expected, "source selection retains the dominant organ or the same authored fallback");
      assert.equal(fixture.calls.filter(call => call[0] === "outline").length, 1);
      assert.deepEqual(fixture.state(), { globalAlpha: .8, filter: "none", x: 0, y: 0, scaleX: 1, scaleY: 1 });
      assert.deepEqual(corpse, before);
    }
});

test("mirroring preserves crop, local registration, decay and missing-art fallback", () => {
  for (const tribe of tribes) for (const form of ["base", "secretion", "antenna", "feet"]) {
    const results = [-1, 1, undefined].map(facing => {
      const fixture = renderer(tribe), corpse = { tribe, kind: "corpse", health: 0, facing,
        attributes: form === "base" ? {} : { [form]: 1 }, diedAt: 10, decaysAt: 13 };
      fixture.draw(corpse, 12, 34, 56, null, .5);
      return fixture.calls.find(call => call[0] === "draw");
    });
    for (const result of results.slice(1)) {
      assert.deepEqual(result.slice(3), results[0].slice(3));
      assert.equal(result[1].globalAlpha, results[0][1].globalAlpha);
      assert.equal(result[1].filter, results[0][1].filter);
    }
  }
});

test("creatures stay delegated and outer world/list callers do not mirror the corpse twice", () => {
  const fixture = renderer("bean");
  assert.equal(fixture.draw({ species: "soil-boar", facing: -1 }, 0, 0, 100, null, 1), "creature");
  assert.deepEqual(fixture.calls, []);
  const world = source.match(/^    function drawCorpses\([^]*?^    }/m)?.[0];
  assert.ok(world && world.includes("drawAgentCorpse(ctx, corpse"));
  assert.equal(world.includes("ctx.scale(scale, scale)"), true);
  assert.equal(/scale\([^\n]*(?:facing|side)/.test(world), false);
});
