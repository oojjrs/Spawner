import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_APPEARANCE_FORMS, unitAppearanceForm } from "../server/unit-appearance.mjs";
import { UNIT_ACTION_ART } from "./unit-action-art-assets.mjs";
import { UNIT_BIRTH_ART } from "./unit-birth-art-assets.mjs";
import { unitActionArtSelection, unitActionArtDefinition, unitActionArtPose, createUnitActionArt } from "./unit-action-art.mjs";

const forms = [
  ["base", []], ["gather", ["gather"]],
  ["blade", ["blade"]], ["secretion", ["secretion"]], ["carapace", ["carapace"]], ["antenna", ["antenna"]],
  ["blade-secretion", ["blade", "secretion"]], ["blade-carapace", ["blade", "carapace"]],
  ["blade-antenna", ["blade", "antenna"]], ["secretion-carapace", ["secretion", "carapace"]],
  ["secretion-antenna", ["secretion", "antenna"]], ["carapace-antenna", ["carapace", "antenna"]],
  ["blade-secretion-carapace", ["blade", "secretion", "carapace"]],
  ["blade-secretion-antenna", ["blade", "secretion", "antenna"]],
  ["blade-carapace-antenna", ["blade", "carapace", "antenna"]],
  ["secretion-carapace-antenna", ["secretion", "carapace", "antenna"]],
  ["blade-secretion-carapace-antenna", ["blade", "secretion", "carapace", "antenna"]]
];
const tribes = ["bean", "spore", "pebble", "spring"];

test("17개 외형은 네 종족에서 기관 순서·개수와 관계없이 정확한 세트를 선택한다", () => {
  assert.deepEqual([...UNIT_APPEARANCE_FORMS].sort(), forms.map(([form]) => form).sort());
  const catalog = Object.fromEntries(tribes.flatMap(tribe => forms.map(([form]) => [tribe + "/" + form, { form, tribe }])));
  for (const tribe of tribes) for (const [form, genes] of forms) {
    const pieces = [...genes].reverse().flatMap(gene => [{ gene, grade: 1 }, { gene, grade: 3 }]);
    const dna = { version: 4, pieces }, attributes = Object.fromEntries(genes.map(gene => [gene, 2]));
    for (const agent of [{ tribe, dna }, { tribe, attributes }, { tribe, dna, attributes }]) {
      const before = JSON.stringify(agent), key = tribe + "/" + form;
      const selection = unitActionArtSelection(agent, catalog);
      assert.equal(unitAppearanceForm(agent), form);
      assert.equal(selection.requestedKey, key);
      assert.equal(selection.key, key);
      assert.equal(selection.definition, catalog[key]);
      assert.equal(JSON.stringify(agent), before);
    }
  }
});

test("채집은 독립형이며 기존 혼합 DNA·시체 외형 스냅샷·중립과 퇴역기관을 구분한다", () => {
  const dna = { version: 4, pieces: [{ gene: "gather" }, { gene: "blade" }, { gene: "carapace" }] };
  assert.equal(unitAppearanceForm({ dna }), "blade-carapace");
  assert.equal(unitAppearanceForm({ dna, attributes: { blade: 1, carapace: 1 } }), "blade-carapace");
  assert.equal(unitAppearanceForm({ dna, attributes: {}, appearanceAttributes: { antenna: 1 } }), "antenna");
  assert.equal(unitAppearanceForm({ attributes: { blade: 1 }, appearanceAttributes: {} }), "base");
  assert.equal(unitAppearanceForm({ dna: { pieces: [{ gene: "gather" }] }, attributes: {} }), "gather");
  assert.equal(unitAppearanceForm({ attributes: { strength: 1 } }), "gather");
  assert.equal(unitAppearanceForm({ attributes: { feet: 1 } }), "base");
  assert.equal(unitAppearanceForm({ attributes: { piercing: 1 } }), "secretion");
  assert.equal(unitActionArtDefinition({ species: "soil-boar", attributes: { blade: 1 } }), null);
  assert.equal(unitActionArtDefinition(null), null);
});

test("미등록 조합은 요청 키를 보존하고 등록 즉시 정확한 세트로 전환한다", () => {
  for (const tribe of tribes) {
    const agent = { tribe, attributes: { blade: 1, carapace: 1, antenna: 1 } };
    const catalog = { ...UNIT_ACTION_ART };
    delete catalog[tribe + "/blade-carapace-antenna"];
    const before = unitActionArtSelection(agent, catalog);
    assert.equal(before.requestedKey, tribe + "/blade-carapace-antenna");
    assert.equal(before.key, tribe + "/blade");
    assert.equal(before.definition, UNIT_ACTION_ART[tribe + "/blade"]);
    const exact = { reference: { image: "new-combination.png" }, actions: {} };
    catalog[before.requestedKey] = exact;
    const after = unitActionArtSelection(agent, catalog);
    assert.equal(after.key, before.requestedKey);
    assert.equal(after.definition, exact);
  }
});

test("승인 칼날 갑각은 모든 동작에서 같은 세트를 유지하고 미제작 동작만 원화를 쓴다", () => {
  for (const tribe of tribes) {
    const agent = { tribe, attributes: { blade: 1, carapace: 1 }, health: 10, bornAt: 0 };
    const definition = UNIT_ACTION_ART[tribe + "/blade-carapace"];
    assert.equal(unitActionArtDefinition(agent), definition);
    const states = [
      ["idle", {}], ["walk", { moveStartedAt: 0, moveDuration: 1 }],
      ["attack", { attack: { startedAt: 0, endsAt: 1, mode: "melee" } }],
      ["hurt", { hurtStartedAt: 0 }], ["birth", { birth: { startedAt: 0, readyAt: 2 } }],
      ["death", { health: 0, diedAt: 0 }], ["ranged", { attack: { startedAt: 0, endsAt: 1, mode: "ranged" } }]
    ];
    for (const [action, state] of states) {
      const pose = unitActionArtPose({ ...agent, ...state }, .05);
      assert.equal(pose.action, action);
      assert.equal(pose.reference, definition.reference);
      assert.equal(pose.animation, definition.actions[action] || definition.reference);
      assert.equal(pose.missing, !definition.actions[action]);
    }
    const fallback = { ...agent, attributes: { blade: 1, carapace: 1, antenna: 1 }, birth: { startedAt: 0, readyAt: 2 } };
    const selected = unitActionArtSelection(fallback, UNIT_ACTION_ART);
    assert.equal(unitActionArtPose(fallback, .05).animation, UNIT_BIRTH_ART[selected.key] || selected.definition.actions.birth);
  }
});

test("실제 그리기는 칼날 갑각 완성 프레임 하나를 사용한다", async () => {
  function surface(width, height) {
    const calls = [], context = { calls, drawImage: (...args) => calls.push(args), save() {}, restore() {}, translate() {}, scale() {},
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) };
    return { getContext: () => context };
  }
  const art = createUnitActionArt(path => path, surface, async image => ({ image }));
  for (const tribe of tribes) {
    const agent = { tribe, attributes: { blade: 1, carapace: 1 }, health: 10, bornAt: 0 };
    await art.prepare(agent, .05);
    const context = surface(512, 512).getContext("2d");
    assert.equal(art.draw(context, agent, .05, 256, 448, 100, false, null), true);
    assert.equal(context.calls.length, 1);
    assert.match(context.calls[0][0].image, new RegExp("BladeCarapaceV1/" + tribe + "/idle"));
  }
});

test("인게임 실행본도 동일한 조합 선택과 채집 분리를 사용한다", () => {
  const scope = createContext({ console, setTimeout, clearTimeout, URL, performance });
  runInContext(readFileSync(new URL("./runtime.js", import.meta.url), "utf8"), scope);
  for (const tribe of tribes) {
    const pair = { tribe, dna: { version: 4, pieces: [{ gene: "carapace" }, { gene: "blade" }] }, health: 10 };
    const expected = unitActionArtDefinition(pair), actual = scope.Spawner.unitActionArtDefinition(pair);
    assert.equal(actual.reference.image, expected.reference.image);
    assert.match(actual.reference.image, /BladeCarapaceV1/);
    for (const [form, genes] of forms) {
      const key = tribe + "/" + form, definition = { key };
      const selection = scope.Spawner.unitActionArtSelection({ tribe, dna: { version: 4, pieces: genes.map(gene => ({ gene })) } }, { [key]: definition });
      assert.equal(selection.requestedKey, key);
      assert.equal(selection.key, key);
      assert.equal(selection.definition, definition);
    }
  }
});
