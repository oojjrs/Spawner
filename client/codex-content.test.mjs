import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { CODEX_GROUPS, CODEX_GENES, CODEX_UNITS, codexResolveEntry, codexRelatedEntries, codexGeneDetails, codexGeneTribeEffects, codexAttributeDescription, codexAttributeEffect, codexResourceDetails } from "./codex-content.mjs";
import { ATTRIBUTE_DNA } from "../server/dna.mjs";
import { TERRAIN_CODEX } from "./terrain-codex.mjs";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

test("현행 DNA 카탈로그·유닛·자원·건물·지형을 모두 열고 모든 관련 링크가 유효하다", () => {
  assert.equal(CODEX_UNITS.length, 23);
  assert.deepEqual(CODEX_GENES.map(gene => gene.id), ATTRIBUTE_DNA.catalog.map(gene => gene.id));
  const ids = new Set();
  for (const [kind, , values] of CODEX_GROUPS) for (const value of values) {
    const id = kind + ":" + value.key;
    assert.ok(!ids.has(id), id);
    ids.add(id);
    const entry = codexResolveEntry(id);
    assert.equal(entry.value, value);
    for (const target of codexRelatedEntries(entry, 31)) assert.ok(codexResolveEntry(target), id + " → " + target);
    for (const path of [value.image, value.carryImage].filter(Boolean)) assert.ok(existsSync(new URL(path, root)), path);
  }
  assert.equal(ids.size, 81);
  assert.equal(codexResolveEntry("attribute:feet").key, "movement");
  assert.equal(codexResolveEntry("attribute:strength").key, "capacity");
  assert.equal(codexResolveEntry("attribute:piercing").key, "penetration");
  assert.equal(codexResolveEntry("unit:spiny-back-beetle").value.hostile, true);
  assert.deepEqual(codexRelatedEntries(codexResolveEntry("resource:clay"), 0).filter(id => id.startsWith("terrain:")),
    ["terrain:land", "terrain:grassland", "terrain:forest", "terrain:swamp"]);
  for (const id of ["synergy:0", "attribute:harvest", "attribute:loadSpeed", "attribute:missing", "resource:meat", null]) assert.equal(codexResolveEntry(id), null);
});

test("DNA 설명은 기관·레벨·가격·종족별 실제 효과와 퇴역 조각을 구분한다", () => {
  const details = (key, tribe) => codexGeneDetails(codexResolveEntry("attribute:" + key).value, tribe);
  assert.deepEqual(details("gather", "bean").effects, [["채집량", "1개"], ["운반량", "1개"], ["채집 시간", "3초"]]);
  assert.deepEqual(details("blade", "bean").effects, [["근접 공격력", 2], ["근접 공속", "0.5회/초"]]);
  assert.deepEqual(details("secretion", "bean").effects, [["원거리 공격력", 1.4], ["원거리 공속", "0.5회/초"]]);
  assert.ok(details("health", "pebble").effect.includes("+24"));
  assert.ok(details("rangedPower", "spore").effect.includes("+3.5"));
  assert.deepEqual(details("secretion", "spore").effects, [["원거리 공격력", 1.61], ["원거리 공속", "0.525회/초"]]);
  assert.ok(details("power", "spring").effect.includes("+9.6"));
  assert.deepEqual(details("blockPower", "bean").effects, [["방어 위력", "+15%p"]]);
  for (const gene of CODEX_GENES) for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const value = details(gene.key, tribe);
    assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(value)), gene.key);
    assert.ok(value.rows.some(([label, cost]) => label === "조각 비용" && cost === gene.price + "P"));
  }
});

test("DNA 공통 효과는 반복하지 않고 실제 종족 차이가 있는 효과만 나눈다", () => {
  for (const key of ["antenna", "capacity", "harvestSpeed", "movement", "vision", "lifespan", "blockPower", "combo", "area"]) {
    assert.deepEqual(codexGeneTribeEffects(codexResolveEntry("attribute:" + key).value), [], key);
  }
  for (const key of ["gather", "blade", "secretion", "health", "power", "carapace", "regeneration", "focus"]) {
    const effects = codexGeneTribeEffects(codexResolveEntry("attribute:" + key).value);
    assert.equal(effects.length, 4, key);
    assert.ok(new Set(effects.map(([, value]) => value)).size > 1, key);
  }
  for (const gene of CODEX_GENES) {
    assert.ok(gene.description && !gene.description.includes("조각의 레벨·개수"), gene.id);
    assert.equal(codexAttributeDescription({ key: gene.id }, "bean"), gene.description);
    assert.equal(codexAttributeEffect({ key: gene.id }, 1, "bean"), codexGeneDetails(gene, "bean").effect);
  }
  const antenna = codexResolveEntry("attribute:antenna").value;
  assert.match(antenna.description, /시야 밖/);
  assert.match(antenna.description, /없어도 자기 시야 안/);
  assert.match(antenna.description, /일꾼에게는 효과가 없/);
  assert.equal(codexGeneDetails(antenna, "bean").effects[0][0], "적 탐색");
  assert.deepEqual(codexGeneDetails(codexResolveEntry("attribute:carapace").value, "bean").effects, [["방어력", "+20"]]);
  assert.deepEqual(codexGeneDetails(codexResolveEntry("attribute:carapace").value, "pebble").effects, [["방어력", "+32"]]);
});

test("실제 DNA 도감 렌더 함수는 공통 효과에 종족별 표를 추가하지 않는다", () => {
  for (const [key, expected] of [["antenna", 1], ["blockPower", 1], ["carapace", 3]]) {
    const children = [], title = {};
    const context = createContext({ Spawner: { CODEX_GENES, PLAYER_TRIBES: [{ key: "bean", name: "새싹콩" }], codexGeneDetails, codexGeneTribeEffects },
      unitDraft: null, state: { tribe: "bean" }, document: { getElementById: () => title, createElement: () => ({}) },
      createCodexStats: rows => ({ rows }) });
    runInContext(declaration("renderAttributeCodex"), context);
    context.renderAttributeCodex(codexResolveEntry("attribute:" + key).value, { append: (...values) => children.push(...values) });
    assert.equal(children.length, expected, key);
    assert.equal(title.textContent, expected === 1 ? "조각 1개" : "새싹콩 · 조각 1개");
  }
});

test("네 종족의 전용 자원·채집기관·비재생 규칙과 지형 자원 링크가 일치한다", () => {
  for (const [resource, tribe] of [["clay", "bean"], ["tree", "spore"], ["pebbles", "pebble"], ["dew", "spring"]]) {
    const entry = codexResolveEntry("resource:" + resource), details = codexResourceDetails(entry.value);
    assert.equal(details.tribe.key, tribe);
    assert.ok(details.rows.some(([name, value]) => name === "필요 DNA" && value === "채집기관"));
    assert.ok(details.rows.some(([name, value]) => name === "재생" && value === "없음"));
    for (const target of codexRelatedEntries(entry, 31).filter(target => target.startsWith("terrain:"))) {
      assert.ok(codexRelatedEntries(codexResolveEntry(target), 31).includes("resource:" + resource));
    }
  }
});

test("중립 19종의 이름·배정 의도·7개 티어가 최신 기획 표와 같다", () => {
  let html = "";
  runInContext(readFileSync(new URL("DesignAssets/sections/neutral-unit-tiers.js", root), "utf8"), createContext({ document: { write: value => { html += value; } } }));
  const rows = [...html.matchAll(/<tr data-unit-key="([^"]+)">([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, 19);
  for (const [, key, row] of rows) {
    const entry = codexResolveEntry("unit:" + key).value;
    assert.ok(row.includes(entry.name));
    assert.ok(row.includes(entry.description));
    assert.deepEqual(entry.tiers, [...row.matchAll(/<td class="text-end">(\d+)<\/td>/g)].map(match => Number(match[1])));
  }
});

test("실제 탐색 함수는 구형 링크를 정규화하고 뒤로·앞으로 좌표와 검색을 보존한다", () => {
  const codexState = { history: [], index: -1, category: "terrain", cell: null };
  const codexSearch = { value: "초원" };
  const context = createContext({ codexState, codexSearch, Spawner: { codexResolveEntry },
    document: { querySelectorAll: () => [], getElementById: () => ({ focus() {} }) },
    hideHelpTooltip() {}, renderCodexArticle() {}, renderCodexList() {}, updateCodex() {}, updateUnitDesign() {} });
  for (const name of ["codexEntry", "navigateCodex", "moveCodexHistory"]) runInContext(declaration(name), context);
  context.navigateCodex("terrain:grassland", true, { x: 1, y: 2, roomId: "test" });
  context.navigateCodex("attribute:feet", true);
  assert.equal(codexState.entry, "attribute:movement");
  assert.equal(codexSearch.value, "");
  context.moveCodexHistory(-1);
  assert.equal(codexState.entry, "terrain:grassland");
  assert.equal(codexState.cell.x, 1);
  context.moveCodexHistory(1);
  assert.equal(codexState.entry, "attribute:movement");
  assert.equal(codexState.cell, null);
  const count = codexState.history.length;
  context.navigateCodex("attribute:missing", true);
  assert.equal(codexState.history.length, count);
  assert.equal(TERRAIN_CODEX.length, 11);
});

test("선택 개체의 도감 버튼은 자원·종족·중립·건물에 직접 연결된다", () => {
  let click;
  const opened = [], state = { selection: null, tribe: "bean" };
  const context = createContext({ state, worldMap: {},
    Spawner: { resourceTypeForCell: value => value.resourceType },
    document: { getElementById: () => ({ addEventListener: (name, handler) => { click = handler; } }) },
    openCodex: id => opened.push(id) });
  const handler = source.match(/^    document.getElementById\("unit-codex"\).addEventListener[^]*?^    \}\);/m)[0];
  runInContext(handler, context);
  for (const [kind, target, expected] of [["food", { resourceType: "clay" }, "resource:clay"], ["tree", {}, "resource:tree"],
    ["agent", { tribe: "pebble" }, "unit:pebble"], ["agent", { species: "spiny-back-beetle" }, "unit:spiny-back-beetle"],
    ["burrow", { type: "small" }, "burrow:small"], ["colony", {}, "nest:colony"]]) {
    state.selection = { kind, target };
    click();
    assert.equal(opened.at(-1), expected);
    assert.ok(codexResolveEntry(expected));
  }
});
