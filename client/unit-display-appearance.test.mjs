import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_APPEARANCE_BITS, UNIT_APPEARANCE_TRIBES, unitAppearanceMaskFromAttributes } from "../server/unit-appearance.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { dnaAppearance, dnaUnitStats } from "../server/dna-unit.mjs";
import { dnaAttackMode } from "../server/dna-actions.mjs";
import { unitDisplayAttributes, unitDisplayAttributesFrom, unitDominantAppearanceMask, UNIT_DISPLAY_MASKS, UNIT_DISPLAY_FORM_COUNT, unitDisplayAbilityMask } from "./unit-display-appearance.mjs";
import { unitAppearanceInventory, unitAppearanceForAgent, unitAppearanceDefinition, unitAppearanceRequiredWorldActions } from "./unit-appearance.mjs";
import { unitAnimationPose } from "./unit-animation.mjs";
import { unitAppearanceStatePose } from "./unit-appearance-state.mjs";
import { unitRangedAppearance, unitRangedPose, unitRangedDisplaySize, UNIT_RANGED_FORMS } from "./unit-ranged.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

const attributesFor = mask => Object.fromEntries(Object.entries(UNIT_APPEARANCE_BITS).filter(([, bit]) => mask & bit).map(([key]) => [key, 3]));
const plain = value => JSON.parse(JSON.stringify(value));
function design(ids) {
  let pieces = [];
  for (const id of ids) {
    const gene = ATTRIBUTE_DNA.lookup.get(id);
    pieces = Array.from({ length: 6 }, (_, rotation) => pieces.concat({ gene: id, grade: gene.grade, rotation, shape: gene.steps }))
      .find(next => ATTRIBUTE_DNA.trace(next, 4).valid && !ATTRIBUTE_DNA.trace(next, 4).closed);
    assert.ok(pieces, id);
  }
  const dna = { version: 3, pieces, level: 4, budget: 10000 };
  assert.ok(ATTRIBUTE_DNA.validate(dna));
  return dna;
}

test("all 128 current trait combinations deterministically collapse to exactly 24 display forms", () => {
  const forms = new Set();
  for (const tribe of UNIT_APPEARANCE_TRIBES) {
    const groups = new Map();
    for (let actual = 0; actual < 32; actual++) {
      const attributes = Object.freeze(attributesFor(actual)), unit = Object.freeze({ tribe, attributes });
      const visual = unitDisplayAttributes(unit), mask = unitAppearanceMaskFromAttributes(visual);
      assert.equal(mask, unitDominantAppearanceMask(actual));
      assert.ok(Object.values(visual).every(value => value === 1));
      assert.deepEqual(attributes, attributesFor(actual));
      forms.add(tribe + "/" + mask); groups.set(mask, (groups.get(mask) || 0) + 1);
    }
    assert.deepEqual(UNIT_DISPLAY_MASKS.map(mask => groups.get(mask)), [1, 16, 8, 4, 2, 1]);
  }
  assert.equal(forms.size, 24); assert.equal(UNIT_DISPLAY_FORM_COUNT, 24);
  for (const invalid of [null, undefined, NaN, -1, 32, .5]) assert.equal(unitDominantAppearanceMask(invalid), null);
});

test("projection does not mutate actual DNA, mechanical attributes, hidden abilities or serialized state", () => {
  const dna = design(["blade", "secretion", "carapace", "antenna", "legs"]);
  const unit = { tribe: "bean", dna, attributes: dnaAppearance(dna), stats: dnaUnitStats(dna) };
  const saved = JSON.stringify(unit), stats = dnaUnitStats(dna);
  assert.deepEqual(unitDisplayAttributes(unit), { blade: 1 });
  assert.equal(dnaAttackMode(stats, 1), "melee"); assert.equal(dnaAttackMode(stats, 2), "ranged");
  assert.ok(stats.roaming); assert.ok(stats.armor > 0); assert.ok(stats.evasion > 0);
  assert.deepEqual(dnaUnitStats(dna), stats); assert.equal(JSON.stringify(unit), saved);
  assert.deepEqual(unitDisplayAttributes(JSON.parse(saved)), { blade: 1 });
  assert.deepEqual(unitDisplayAttributes({ dna }), { blade: 1 });
});

test("snapshotted appearance and historical retired-organ rigs keep their compatibility contracts", () => {
  const attributes = { blade: 1, secretion: 1, carapace: 1, feet: 1 };
  const unit = { attributes, appearanceAttributes: { antenna: 2, feet: 3 } };
  assert.deepEqual(unitDisplayAttributes(unit), { antenna: 1 });
  assert.deepEqual(unitDisplayAttributes({ ...unit, appearanceAttributes: {} }), {});
  const legacy = { blade: 1, antenna: 1, strength: 1, feet: 1 };
  assert.equal(unitDisplayAttributesFrom(legacy), legacy, "historical compound rigs keep their existing attribute data");
  assert.equal(unitDisplayAttributes({ species: "bubble-toad", attributes }), attributes);
  assert.deepEqual(unitDisplayAttributesFrom(null), {});
  assert.deepEqual(combatAttributeKeys(null), []);
  assert.deepEqual(unitDisplayAttributesFrom({ legs: 3, dnaGather: true, healing: 2 }), { feet: 1, dnaGather: true, healing: 2 });
});

test("production inventory has 24 targets, keeps archival 128 sources and never upgrades readiness", () => {
  const inventory = unitAppearanceInventory();
  assert.equal(inventory.length, 24); assert.equal(unitAppearanceInventory({ includeLegacyCombinations: true }).length, 128);
  assert.equal(inventory.filter(row => row.worldReady).length, 0);
  assert.ok(inventory.find(row => row.key === "bean/01").missingActions.includes("ranged"));
  assert.equal(unitDisplayAbilityMask(1), 31); assert.equal(unitDisplayAbilityMask(16), 30);
  assert.equal(unitDisplayAbilityMask(3), null);
});

test("a shared blade body requires hidden ranged actions and retains true melee/ranged clocks", () => {
  const dna = design(["blade", "secretion"]), definition = unitAppearanceDefinition("bean", 1), original = definition.actions;
  const clip = { sourceId: definition.source.sourceId, image: "synthetic-test-only", frameSize: 512, columns: 1,
    frameCount: 1, durationsMs: [600], loop: false, pivotX: 256, pivotY: 448, launchAtMs: 200, hitTimeMs: 300 };
  const agent = { id: "dual", tribe: "bean", health: 10, dna, attributes: dnaAppearance(dna), mode: "fight", combat: { version: 2 },
    attack: { startedAt: 0, launchedAt: .2, hitAt: .3, endsAt: .6, mode: "ranged", dnaRanged: true } };
  try {
    definition.actions = Object.fromEntries(unitAppearanceRequiredWorldActions(1).map(action => [action, { ...clip }]));
    assert.equal(unitAppearanceForAgent(agent), null, "a complete blade-only set cannot hide a missing ranged action");
    definition.actions.ranged = { ...clip };
    assert.equal(unitAppearanceForAgent(agent).mask, 1); assert.equal(unitAppearanceForAgent(agent).actualMask, 17);
    const ranged = unitAppearanceStatePose(agent, .2); assert.equal(ranged.action, "ranged"); assert.equal(ranged.state.elapsedMs, 200);
    const melee = { ...agent, attack: { ...agent.attack, mode: "melee", dnaRanged: false } };
    assert.equal(unitAppearanceStatePose(melee, .3).action, "attack");
    assert.equal(unitAppearanceStatePose(melee, .3).state.elapsedMs, 300);
  } finally { definition.actions = original; }
});

test("secretion dominance reuses approved shooting art while hidden blade never changes to a ranged body", () => {
  for (const tribe of UNIT_APPEARANCE_TRIBES) {
    const unit = { tribe, attributes: { secretion: 3, carapace: 2, antenna: 1, feet: 2 }, stats: { ranged: true }, health: 10,
      attack: { startedAt: 0, launchedAt: .2, hitAt: .4, endsAt: .6, mode: "ranged", dnaRanged: true } };
    assert.equal(unitRangedAppearance(unit), UNIT_RANGED_FORMS[tribe]);
    assert.equal(unitRangedPose(unit, .2).action, "shoot");
    assert.equal(unitRangedAppearance({ ...unit, attributes: { ...unit.attributes, blade: 1 } }), null);
    assert.deepEqual(combatAttributeKeys(unitDisplayAttributes(unit)), []);
  }
});

test("render-only observation preserves deterministic mixed-build combat, true events and hidden abilities", () => {
  const settings = { left: { key: "bean", organs: { attack: 1, ranged: 1 }, counts: {} },
    right: { key: "pebble", organs: { attack: 1, ranged: 1 }, counts: {} }, distance: 2, random: false, rules: { maxSeconds: 4 } };
  const observed = createSimulationTrial(settings), control = createSimulationTrial(settings);
  for (let step = 0; step < 40; step++) {
    observed.advance(.1); control.advance(.1);
    for (const unit of observed.agents) { unitDisplayAttributes(unit); unitRangedPose(unit, observed.time); }
  }
  assert.deepEqual(observed.agents, control.agents); assert.deepEqual(observed.history, control.history);
  assert.deepEqual(JSON.parse(JSON.stringify(observed.vfx).replaceAll(observed.vfx.streamId, "stream")),
    JSON.parse(JSON.stringify(control.vfx).replaceAll(control.vfx.streamId, "stream"))); assert.deepEqual(observed.result(), control.result());
  assert.ok(observed.vfx.events.some(event => event.kind === "shoot"));
});

test("actual world/detail renderer selects only the dominant combat layer and keeps actual attributes", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const code = source.match(/^    function drawAgentAppearanceLayer\([^]*?^    }/m)[0];
  const forwarded = [], fallbacks = [], scope = createContext({
    Spawner: { unitDisplayAttributes, combatAttributeKeys, hasCombatEvolution, unitAnimationPose: () => ({ action: "attack" }) },
    state: { simSeconds: .3 }, idleMotion: { matches: false }, AGENT_HEIGHT: .7,
    unitAnimationSheets: new Map(), drawAgentAppearanceBody: (...args) => fallbacks.push(args), drawCombatAgentAttributes() {},
    combatAttributeArt: { ready: () => true, frame: agent => { forwarded.push(agent); return { width: 512, height: 512 }; } }
  });
  runInContext(code, scope);
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage() {} };
  const unit = { tribe: "bean", attributes: attributesFor(31), health: 10 };
  scope.drawAgentAppearanceLayer(ctx, 0, unit, 100, { x: 0, y: 0 }, null, null, null);
  assert.equal(forwarded.length, 1); assert.equal(forwarded[0].attributes, unit.attributes);
  assert.deepEqual(unitDisplayAttributes(forwarded[0]), { blade: 1 });
  scope.drawAgentAppearanceLayer(ctx, 0, { ...unit, attributes: attributesFor(30) }, 100, { x: 0, y: 0 }, null, null, null);
  assert.equal(fallbacks.length, 1, "secretion dominance does not retain the hidden carapace layer");
});

test("world secretion draw preserves facing, one growth scale, load fallback and unfinished resource actions", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const code = source.match(/^    function drawAgentRanged\([^]*?^    }/m)[0];
  const draws = [], scales = [], state = { simSeconds: .2 };
  let ready = true;
  const scope = createContext({ Spawner: { unitRangedPose, unitRangedDisplaySize, unitAnimationPose }, state, AGENT_HEIGHT: .7,
    idleMotion: { matches: false }, unitDisplayScale: () => 1.5,
    agentRangedImage: () => ready ? { complete: true, naturalWidth: 512 } : null });
  runInContext(code, scope);
  const ctx = { save() {}, restore() {}, translate() {}, scale: (...values) => scales.push(values), drawImage: (...values) => draws.push(values) };
  for (const facing of [-1, 1]) {
    const unit = { tribe: "bean", attributes: { secretion: 1, carapace: 1 }, health: 10, facing, stats: { pieceCount: 6 },
      attack: { startedAt: 0, launchedAt: .2, hitAt: .4, endsAt: .6, mode: "ranged" } };
    assert.equal(scope.drawAgentRanged(ctx, unit, 50, 80, 70, null), true);
    assert.deepEqual(scales.at(-1), [facing, 1]);
    unit.attack.directionX = -facing;
    assert.equal(scope.drawAgentRanged(ctx, unit, 50, 80, 70, null), true);
    assert.deepEqual(scales.at(-1), [-facing, 1], "active shots face their target without changing stored facing");
    assert.equal(unitRangedPose(unit, .2).mirrorX, -facing < 0);
    assert.ok(Math.abs(draws.at(-1).at(-1) * 1.5 - unitRangedDisplaySize(unit)) < 1e-10);
    assert.equal(scope.drawAgentRanged(ctx, { ...unit, mode: "harvest" }, 50, 80, 70, null), false);
    assert.equal(scope.drawAgentRanged(ctx, { ...unit, attack: null, moveStartedAt: 0, moveDuration: 1 }, 50, 80, 70, null), false, "unfinished ranged walk keeps its existing action");
    state.simSeconds = .1;
    assert.equal(scope.drawAgentRanged(ctx, { ...unit, attack: null, hurtStartedAt: 0 }, 50, 80, 70, null), false, "unfinished secretion hurt retains its existing action fallback");
    state.simSeconds = .2;
    ready = false; assert.equal(scope.drawAgentRanged(ctx, unit, 50, 80, 70, null), false); ready = true;
  }
});


test("design and template portrait sources accept loaded secretion Images and existing canvases", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const code = source.match(/^    function agentImageSource\([^]*?^    }/m)[0];
  let sprite = { currentSrc: "approved-secretion.png", src: "fallback.png" }, encodes = 0;
  const scope = createContext({ Spawner: { unitRangedAppearance }, assetSource: path => "assets/" + path,
    agentSprite: () => sprite, agentImageSources: new WeakMap() });
  runInContext(code, scope);
  assert.equal(scope.agentImageSource({}), "approved-secretion.png");
  sprite = { src: "approved-secretion.png" };
  assert.equal(scope.agentImageSource({}), "approved-secretion.png");
  sprite = { toDataURL: () => { encodes++; return "data:image/png;base64,canvas"; } };
  assert.equal(scope.agentImageSource({}), "data:image/png;base64,canvas");
  assert.equal(scope.agentImageSource({}), "data:image/png;base64,canvas");
  assert.equal(encodes, 1);
  scope.agentSprite = () => { throw new Error("DOM image must not use a cold-load canvas fallback"); };
  assert.equal(scope.agentImageSource({ tribe: "bean", attributes: { secretion: 1, carapace: 1 } }),
    "assets/" + UNIT_RANGED_FORMS.bean.idle.image);
});
