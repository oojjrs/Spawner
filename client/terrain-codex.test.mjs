import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { TERRAIN_CODEX, HAZARD_CODEX, terrainCodexResources, terrainCodexCell } from "./terrain-codex.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

test("미탐색 칸과 맵 밖에는 지형 정보를 노출하지 않고 물과 위험 요소를 구별한다", () => {
  const world = { size: 4, terrain: new Uint8Array(16).fill(4), hazards: new Uint8Array(16) };
  const explored = new Set([0, 1, 2, 3]);
  world.terrain[0] = 0; world.terrain[1] = 9; world.terrain[2] = 5; world.terrain[3] = 6;
  world.hazards[1] = 1; world.hazards[2] = 2;
  for (const [x, y] of [[-1, 0], [4, 0], [0, 4], [0, 1], [0.5, 0]]) assert.equal(terrainCodexCell(world, explored, x, y), null);
  assert.equal(terrainCodexCell(world, explored, 0, 0).speed, 0);
  assert.equal(terrainCodexCell(world, explored, 1, 0).hazard.name, "독 포자");
  assert.equal(terrainCodexCell(world, explored, 2, 0).speed, 0.5);
  assert.equal(terrainCodexCell(world, explored, 3, 0).speed, 0.6);
  world.hazards[1] = 0;
  assert.equal(terrainCodexCell(world, explored, 1, 0).speed, 1);
});

test("현재 자연 자원 분포를 안내하고 삭제된 먹이와 사체 자원을 섞지 않는다", () => {
  const expected = [[], [], ["pebbles", "sand"], ["clay", "pebbles"],
    ["clay", "dew", "grass-fiber", "pebbles"], ["clay", "grass-fiber", "tree"],
    ["copper-ore", "iron-ore", "pebbles", "quartz"], [], [], ["clay"]];
  for (let type = 0; type < expected.length; type++) {
    assert.deepEqual(terrainCodexResources(type, 12).map(resource => resource.key).sort(), expected[type], TERRAIN_CODEX[type].name);
  }
});

test("실제 지도 클릭 처리에서 빈 땅·위험 요소를 열고 개체 선택·드래그·오른쪽 클릭을 보존한다", () => {
  let click;
  const opened = [], selected = [];
  const worldMap = { terrain: new Uint8Array(16).fill(4), hazards: new Uint8Array(16), burrows: [] };
  const state = { agents: [], explored: new Set([0, 1, 2]), camera: { zoom: 1 }, flashes: [], dragging: false, didDrag: false };
  const food = { x: 2, y: 0, amount: 4, kind: "resource" };
  const context = createContext({ WORLD_SIZE: 4, worldMap, state, terrainCodexCell,
    connection: { active: true, roomId: "test" }, colonyAt: () => null,
    foodCellAt: (x, y) => x === 2 && y === 0 ? food : null,
    forest: { cells: new Map() }, hazardCells: [], screenToWorld: (x, y) => ({ x, y }),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: (name, handler) => { click = handler; } },
    audio: { playClick() {} }, performance: { now: () => 0 }, trackHoverPointer() {}, updateHover() {}, closeColonyMenu() {},
    selectObject: (kind, target) => selected.push([kind, target]), openColonyPanel() {},
    openCodex: (entry, cell) => opened.push([entry, cell]) });
  for (const name of ["selectableObjectAt", "openTerrainCodex"]) runInContext(declaration(name), context);
  runInContext(source.match(/^    canvas.addEventListener\("pointerup"[^]*?^    \}\);/m)[0], context);
  const event = { clientX: 0.2, clientY: 0.2, button: 0 };
  click(event);
  assert.equal(selected.at(-1)[0], "terrain");
  assert.equal(selected.at(-1)[1].terrain.key, "grassland");
  assert.equal(selected.at(-1)[1].x, 0);
  assert.equal(opened.length, 0);
  worldMap.terrain[1] = 9; worldMap.hazards[1] = 1;
  click({ ...event, clientX: 1.2 });
  assert.equal(selected.at(-1)[1].hazard.key, "poison-spore");
  assert.equal(opened.length, 0);
  click({ ...event, clientX: 2.2 });
  assert.equal(selected.at(-1)[0], "food");
  assert.equal(opened.length, 0);
  for (const input of [{ ...event, clientX: 3.2 }, { ...event, clientX: -1 }, { ...event, button: 2 }]) click(input);
  state.didDrag = true; click(event);
  state.didDrag = false; context.connection.active = false; click(event);
  assert.equal(opened.length, 0);
});

test("코덱스 뒤로·앞으로 이동은 선택 좌표를 복원하고 일반 탐색에는 좌표를 남기지 않는다", () => {
  const codexState = { history: [], index: -1, category: "terrain", cell: null };
  const context = createContext({ codexState, TERRAIN_CODEX, HAZARD_CODEX, ATTRIBUTES: [], ATTRIBUTE_COMBINATIONS: [], NEST_CODEX: [],
    document: { querySelectorAll: () => [], getElementById: () => ({ focus() {} }) },
    hideHelpTooltip() {}, renderCodexArticle() {}, renderCodexList() {}, updateCodex() {}, updateUnitDesign() {} });
  for (const name of ["codexEntry", "navigateCodex", "moveCodexHistory"]) runInContext(declaration(name), context);
  context.navigateCodex("terrain:grassland", true, { x: 1, y: 2, roomId: "a" });
  context.navigateCodex("terrain:grassland", true, { x: 3, y: 2, roomId: "a" });
  context.navigateCodex("terrain:forest", true);
  assert.equal(codexState.cell, null);
  context.moveCodexHistory(-1);
  assert.equal(codexState.cell.x, 3);
  context.moveCodexHistory(-1);
  assert.equal(codexState.cell.x, 1);
  context.moveCodexHistory(1);
  assert.equal(codexState.cell.x, 3);
});

test("기획서 지형 표와 위험 설명이 게임 코덱스 데이터와 일치한다", () => {
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  const table = design.match(/<table[^>]*aria-label="지형 바닥"[^>]*>[\s\S]*?<\/table>/)[0];
  for (const terrain of TERRAIN_CODEX) {
    const row = table.match(new RegExp('<tr><th scope="row">' + terrain.name + '[\\s\\S]*?<\\/tr>'))[0];
    assert.ok(row.includes(terrain.effect));
    const resources = terrainCodexResources(terrain.type, 12).map(resource => resource.name).join(" · ") || "없음";
    assert.ok(row.includes("<td>" + resources + "</td>"));
  }
  for (const hazard of HAZARD_CODEX) assert.ok(design.includes(hazard.description));
  assert.ok(!design.includes("영양 이끼·비옥토"));
  assert.ok(!design.includes("뿌리 구근·풀섬유"));
});

test("지형 코덱스의 좌표 탐색이 지도 선택을 추가하거나 바꾸지 않는다", () => {
  const target = { id: 1, x: 2, y: 2 };
  const state = { selection: { kind: "colony", target }, explored: new Set([0]) };
  const worldMap = { terrain: new Uint8Array(16).fill(4), hazards: new Uint8Array(16) };
  const opened = [];
  const context = createContext({ state, worldMap, WORLD_SIZE: 4, terrainCodexCell,
    connection: { active: true, roomId: "test" }, openCodex: (...args) => opened.push(args) });
  runInContext(declaration("openTerrainCodex"), context);
  context.openTerrainCodex(0, 0);
  assert.equal(opened[0][0], "terrain:grassland");
  assert.equal(state.selection.kind, "colony");
  assert.equal(state.selection.target, target);
  assert.equal("terrainSelection" in state, false);
  let outlines = 0;
  Object.assign(context, { ctx: { save() {}, restore() {}, strokeRect() { outlines++; } },
    worldToScreen: (x, y) => ({ x, y }), selectionColor: "#fff" });
  state.camera = { zoom: 10 };
  state.flashes = [];
  runInContext(declaration("drawFlashes"), context);
  context.drawFlashes(0);
  assert.equal(outlines, 0);
  state.selection = { kind: "terrain", target: { x: 0, y: 0 } };
  context.drawFlashes(0);
  assert.equal(outlines, 1);
});

test("Esc는 유닛·지형·둥지 선택과 정보 패널을 함께 닫는다", () => {
  let keydown;
  let focused = 0;
  const unitPanel = { hidden: false };
  const state = { selection: null };
  const context = createContext({ state, unitPanel,
    canvas: { focus() { focused++; } }, helpTooltip: { hidden: true }, codex: { open: false },
    evolutionPanel: { hidden: true }, colonyMenu: { hidden: true },
    closeColonyMenu() { context.colonyMenu.hidden = true; },
    selectObject(kind, target) { state.selection = target ? { kind, target } : null; unitPanel.hidden = !target; },
    document: { addEventListener(name, handler) { keydown = handler; } } });
  runInContext(declaration("closeUnitPanel"), context);
  const handler = [...source.matchAll(/^    document.addEventListener\("keydown"[^]*?^    \}\);/gm)]
    .find(match => match[0].includes('event.key !== "Escape"'));
  assert.ok(handler);
  runInContext(handler[0], context);
  for (const kind of ["agent", "terrain", "colony", "food", "hazard"]) {
    state.selection = { kind, target: { id: 1 } };
    unitPanel.hidden = kind === "colony" || kind === "food";
    let prevented = false;
    keydown({ key: "Escape", preventDefault() { prevented = true; } });
    assert.equal(state.selection, null);
    assert.equal(unitPanel.hidden, true);
    assert.equal(prevented, true);
  }
  assert.equal(focused, 5);
});
