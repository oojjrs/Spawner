import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_DISPLAY_SIZES, unitDisplaySize, combatViewCell, combatViewLayout } from "./unit-size.mjs";

test("실제 DNA와 동일 조각 수 스탯은 모든 체급에서 같은 성장을 적용한다", () => {
  for (const [species, size] of Object.entries(UNIT_DISPLAY_SIZES)) for (const count of [0, 5, 20]) {
    assert.equal(unitDisplaySize({ species, dna: { pieces: Array(count).fill({}) } }), size * (1 + .01 * count));
    assert.equal(unitDisplaySize({ species, stats: { pieceCount: count } }), size * (1 + .01 * count));
  }
  assert.equal(unitDisplaySize({ tribe: "bean", dna: { pieces: [] }, stats: { pieceCount: 20 } }), .4);
  for (const pieceCount of [-5, NaN, Infinity, undefined]) assert.equal(unitDisplaySize({ tribe: "bean", stats: { pieceCount } }), .4);
});

test("필드와 전투는 속성 보정 캐시에 DNA 성장을 중복하거나 고정하지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const scope = createContext({ Spawner: { unitDisplayAttributes, UNIT_DISPLAY_SIZES, unitDisplaySize },
    unitDisplayScales: new Map([["bean", 2]]), unitAttributeScales: new Map(),
    ATTRIBUTES: [{ key: "feet" }], combatAttributeArt: { ready: () => true },
    measureUnitDisplayScale: () => 3 });
  for (const name of ["unitDisplayScale", "combatUnitScale"])
    runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
  for (const count of [0, 20, 5, 0]) {
    const unit = { tribe: "bean", attributes: { feet: 1 }, dna: { pieces: Array(count).fill({}) } };
    assert.equal(scope.unitDisplayScale(unit), 3 * (1 + .01 * count));
    assert.equal(scope.combatUnitScale(unit), scope.unitDisplayScale(unit));
  }
  assert.equal(scope.unitAttributeScales.size, 1);
});

test("가장 큰 표시 유닛이 들어오면 줌아웃하고 나가면 기존 줌으로 복원한다", () => {
  const small = [{ tribe: "bean", stats: { pieceCount: 14 } }, { species: "flower-tail-bird" }];
  const large = { species: "white-paw", stats: { pieceCount: 100 } };
  const close = combatViewCell(1200, 560, small), far = combatViewCell(1200, 560, [...small, large]);
  assert.ok(close > far);
  assert.equal(combatViewCell(1200, 560, small), close);
  assert.equal(combatViewCell(1200, 560, [...small, ...small]), close);
  assert.ok(Math.abs(far * unitDisplaySize(large) - 280) < 1e-9);
  const ratios = small.map(unit => far * unitDisplaySize(unit) / (close * unitDisplaySize(unit)));
  assert.ok(Math.abs(ratios[0] - ratios[1]) < 1e-9);
  for (const mode of ["idle", "fight", "hurt", "death"]) assert.equal(
    combatViewCell(1200, 560, [...small, { ...large, mode, health: mode === "death" ? 0 : 100, attack: { startedAt: 1 } }]), far);
  assert.ok(combatViewCell(1200, 560, [large]) < combatViewCell(1200, 560, [{ ...large, dna: { pieces: [] } }]));
  assert.ok(Number.isFinite(combatViewCell(1200, 560, [])));
});

test("실험실과 인게임은 실제 표시 편성과 높이를 공용 카메라에 전달한다", () => {
  const stage = readFileSync(new URL("./combat-stage.mjs", import.meta.url), "utf8");
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const calls = [], camera = (...args) => { calls.push(args); return { cell: 137, positions: new Map() }; };
  const visible = { id: "visible", tribe: "bean", combat: { side: 0 } }, support = { id: "support", species: "white-paw" }, corpse = { id: "corpse", species: "walking-forest" };
  const scope = createContext({ combatViewLayout: camera, Spawner: { combatViewLayout: camera }, width: 1200, height: 560,
    cameraUnits: [visible, support], arenaUnits: [visible], formationMembers: new Map([[corpse.id, { side: 1 }]]), deathCommands: [{ agentId: corpse.id, corpse }] });
  runInContext(stage.match(/^    viewLayout = [^\r\n]+/m)[0], scope);
  runInContext(stage.match(/function formationScale\([^]*?\n  }/)[0], scope);
  assert.equal(scope.formationScale(1200, 560) * 100, 137);
  const panel = game.slice(game.indexOf("    function drawCombatPanel("));
  runInContext(game.match(/^    function combatArenaUnits\([^]*?^    }/m)[0], scope);
  runInContext(panel.match(/^      const formation = [^]*?\]\)\);/m)[0], scope);
  runInContext(panel.match(/^      const cell = [^\r\n]+/m)[0] + "\nglobalThis.observedCell = cell;", scope);
  assert.equal(scope.observedCell, 137);
  assert.deepEqual(calls.map(([width, height, units]) => [width, height, Array.from(units, unit => unit.id)]),
    [[1200, 560, ["visible", "support"]], [1200, 560, ["visible", "corpse"]]]);
  assert.match(stage, /cameraUnits = \[\.\.\.trial\.agents, \.\.\.\(trial\.supportAgents \|\| \[\]\)\]\.map\(stageAgent\)/);
});

test("공개 전투 번들과 인게임 모델의 동적 카메라가 원본과 같다", () => {
  const parties = [[], [{ tribe: "bean" }], [{ tribe: "bean" }, { species: "white-paw", stats: { pieceCount: 100 } }]];
  for (const file of ["../Combat.html", "../Spawner.html", "./runtime.js"]) {
    let text = readFileSync(new URL(file, import.meta.url), "utf8").replaceAll("\r\n", "\n");
    if (!text.includes('modules["client/unit-size.mjs"]')) {
      assert.ok(text.includes('data-src="./client/runtime.js"'));
      text = readFileSync(new URL("./runtime.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
    }
    const start = text.indexOf('modules["client/unit-size.mjs"] = (() => {');
    const end = text.indexOf("\n})();", text.indexOf("\nreturn { ", start)) + "\n})();".length;
    const scope = createContext({ modules: {} });
    runInContext(text.slice(start, end), scope);
    for (const width of [320, 1200, 1920]) for (const units of parties) {
      const height = width * 560 / 1200;
      assert.equal(scope.modules["client/unit-size.mjs"].combatViewCell(width, height, units), combatViewCell(width, height, units));
      assert.equal(scope.modules["client/unit-size.mjs"].combatViewLayout(width, height, units).cell, combatViewLayout(width, height, units).cell);
    }
  }
});

test("혼합 체급과 대규모 양쪽 편성은 화면 안에서 예약 영역이 겹치지 않는다", () => {
  for (const count of [1, 2, 3, 5, 10, 20]) for (const [width, height] of [[1200, 560], [360, 168]]) {
    const units = [0, 1].flatMap(side => Array.from({ length: count }, (_, slot) => ({ id: side + ":" + slot, side,
      species: ["flower-tail-bird", "white-paw", "soil-mole", "walking-forest", "dew-rabbit"][slot % 5], stats: { pieceCount: slot % 3 * 50 } })));
    const layout = combatViewLayout(width, height, units), boxes = [...layout.positions.values()].map(point => point.bounds);
    assert.ok(layout.cell > 0); assert.equal(boxes.length, units.length);
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]; assert.ok(a.left >= 0 && a.right <= width && a.top >= 0 && a.bottom <= height);
      for (const b of boxes.slice(i + 1)) assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
    for (let i = 0; i < count; i++) {
      const left = layout.positions.get("0:" + i), right = layout.positions.get("1:" + i);
      assert.ok(Math.abs(left.x + right.x - width) < 1e-9); assert.equal(left.y, right.y);
    }
  }
});

test("같은 편성은 큰 유닛이 빠지면 다시 확대하며 포즈로 자리를 바꾸지 않는다", () => {
  const small = [0, 1].flatMap(side => Array.from({ length: 5 }, (_, slot) => ({ id: side + ":" + slot, side, tribe: "bean" })));
  const large = small.map(unit => unit.id === "1:0" ? { ...unit, species: "white-paw", stats: { pieceCount: 100 } } : unit);
  const close = combatViewLayout(1200, 560, small), far = combatViewLayout(1200, 560, large);
  assert.ok(close.cell > far.cell); assert.deepEqual(combatViewLayout(1200, 560, small), close);
  assert.deepEqual(combatViewLayout(1200, 560, large.map(unit => ({ ...unit, mode: "fight", attack: { startedAt: 1 }, hurtStartedAt: 2 }))), far);
});

test("다섯 명 편성은 체급과 진영에 관계없이 같은 지면의 뒤 세 자리와 앞 두 자리를 쓴다", () => {
  const units = [0, 1].flatMap(side => Array.from({ length: 5 }, (_, slot) => ({ id: side + ":" + slot, side,
    species: side ? "white-paw" : "flower-tail-bird" })));
  const layout = combatViewLayout(1200, 560, units);
  for (const side of [0, 1]) {
    const points = units.filter(unit => unit.side === side).map(unit => layout.positions.get(unit.id));
    assert.equal(points[0].y, points[1].y); assert.equal(points[1].y, points[2].y);
    assert.equal(points[3].y, points[4].y); assert.ok(points[3].y > points[0].y);
    assert.equal(new Set(points.map(point => point.x)).size, 3);
    for (const point of points) assert.ok(point.y >= 560 * .5 && point.y <= 560 * .86);
    for (let slot = 0; slot < 5; slot++) {
      const opposite = layout.positions.get((1 - side) + ":" + slot);
      assert.equal(points[slot].y, opposite.y);
      assert.ok(Math.abs(points[slot].x + opposite.x - 1200) < 1e-9);
    }
  }
  const dying = units.map(unit => unit.id === "0:1" ? { ...unit, kind: "corpse", health: 0 } : unit);
  assert.deepEqual(combatViewLayout(1200, 560, dying), layout);
});

test("다른 인원수도 공통 슬롯과 지면 범위를 유지하며 큰 본체의 상대 비례를 보존한다", () => {
  for (const counts of [[1, 5], [5, 2], [3, 10], [20, 1]]) {
    const units = counts.flatMap((count, side) => Array.from({ length: count }, (_, slot) => ({ id: side + ":" + slot, side,
      species: slot % 2 ? "flower-tail-bird" : "white-paw", stats: { pieceCount: slot * 30 } })));
    const layout = combatViewLayout(360, 168, units), points = [...layout.positions.values()];
    for (const point of points) {
      assert.ok(point.y >= 168 * .5 && point.y <= 168 * .86 + 1e-9);
      assert.ok(point.bounds.left >= 0 && point.bounds.right <= 360 && point.bounds.top >= 0 && point.bounds.bottom <= 168);
    }
    for (let i = 0; i < points.length; i++) for (const other of points.slice(i + 1)) {
      const a = points[i].bounds, b = other.bounds;
      assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    }
    for (const unit of units) {
      const box = layout.positions.get(unit.id).bounds;
      assert.ok(Math.abs((box.right - box.left) / (unitDisplaySize(unit) * 1.3) - layout.cell) < 1e-9);
    }
  }
});

test("인게임 전투는 선택과 대상 변경에도 전원을 원래 편성 순서로 표시한다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8"), scope = createContext({});
  runInContext(source.match(/^    function combatArenaUnits\([^]*?^    }/m)[0], scope);
  const units = [0, 1].flatMap(side => [10, 2, 8, 1, 3].map(id => ({ id: side + ":" + id,
    combat: { side, joinedAt: 1 } })));
  const before = units.map(unit => unit.id);
  const expected = ["0:1", "0:2", "0:3", "0:8", "0:10", "1:1", "1:2", "1:3", "1:8", "1:10"];
  for (const selected of units) assert.deepEqual(Array.from(scope.combatArenaUnits(units, selected), unit => unit.id), expected);
  assert.deepEqual(units.map(unit => unit.id), before);
  const slotted = units.map((unit, index) => ({ ...unit, combat: { ...unit.combat, slot: 10 - index } }));
  assert.deepEqual(Array.from(scope.combatArenaUnits(slotted), unit => unit.id),
    ["0:3", "0:1", "0:8", "0:2", "0:10", "1:3", "1:1", "1:8", "1:2", "1:10"]);
  const live = scope.combatArenaUnits(units), deceased = live[1];
  const corpse = { id: "corpse-999", agentId: deceased.id, kind: "corpse", combat: { ...deceased.combat } };
  assert.deepEqual(Array.from(scope.combatArenaUnits([...live.filter(unit => unit !== deceased), corpse]), unit => unit.agentId ?? unit.id), expected);
});
