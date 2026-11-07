import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_DISPLAY_SIZES, unitDisplaySize, combatViewCell, combatViewLayout } from "./unit-size.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";

test("실제 DNA와 동일 조각 수 스탯은 모든 체급에서 같은 성장을 적용한다", () => {
  for (const [species, size] of Object.entries(UNIT_DISPLAY_SIZES)) for (const count of [0, 5, 20]) {
    assert.equal(unitDisplaySize({ species, dna: { pieces: Array(count).fill({}) } }), (.4 + (size * (1 + .01 * count) - .4) * .5));
    assert.equal(unitDisplaySize({ species, stats: { pieceCount: count } }), (.4 + (size * (1 + .01 * count) - .4) * .5));
  }
  assert.equal(unitDisplaySize({ tribe: "bean", dna: { pieces: [] }, stats: { pieceCount: 20 } }), .4);
  for (const pieceCount of [-5, NaN, Infinity, undefined]) assert.equal(unitDisplaySize({ tribe: "bean", stats: { pieceCount } }), .4);
});

test("필드와 전투는 속성 보정 캐시에 DNA 성장을 중복하거나 고정하지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const scope = createContext({ Spawner: { unitDisplayAttributes, UNIT_DISPLAY_SIZES, unitDisplaySize },
    unitDisplayScales: new Map([["bean", 2]]), unitAttributeScales: new Map(),
    unitDisplayBounds: new Map([["bean", {}]]), agentBaseParts: new Map(), agentParts: new Map(),
    ATTRIBUTES: [{ key: "feet" }], combatAttributeArt: { ready: () => true },
    measureUnitDisplayScale: () => 3 });
  for (const name of ["unitDisplayScale", "combatUnitScale"])
    runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
  for (const count of [0, 20, 5, 0]) {
    const unit = { tribe: "bean", attributes: { feet: 1 }, dna: { pieces: Array(count).fill({}) } };
    assert.ok(Math.abs(scope.unitDisplayScale(unit) - 3 * unitDisplaySize(unit) / .4) < 1e-12);
    assert.equal(scope.combatUnitScale(unit), scope.unitDisplayScale(unit));
  }
  assert.equal(scope.unitAttributeScales.size, 1);
});

test("기본 배율은 외형 체급과 관계없이 유지하여 큰 유닛을 더 크게 표시한다", () => {
  const small = [{ species: "flower-tail-bird" }], large = [{ species: "white-paw" }];
  const cell = combatViewCell(1200, 560, small);
  assert.equal(combatViewCell(1200, 560, large), cell);
  assert.equal(combatViewCell(1200, 560, [...small, ...large]), cell);
  assert.equal(combatViewCell(1200, 560, []), cell);
  assert.ok(cell * unitDisplaySize(large[0]) > cell * unitDisplaySize(small[0]) * 2);
});


test("실험실과 인게임은 실제 표시 편성과 높이를 공용 카메라에 전달한다", () => {
  const stage = readFileSync(new URL("./combat-stage.mjs", import.meta.url), "utf8");
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const calls = [], camera = (...args) => { calls.push(args); return { cell: 137, positions: new Map() }; };
  const visible = { id: "visible", tribe: "bean", combat: { side: 0 } }, support = { id: "support", species: "white-paw" }, corpse = { id: "corpse", species: "walking-forest" };
  const scope = createContext({ combatViewLayout: camera, Spawner: { combatViewLayout: camera }, width: 1200, height: 560,
    camera: {}, combatWatch: {}, cameraUnits: [visible], arenaUnits: [visible], formationMembers: new Map([[corpse.id, { side: 1 }]]), deathCommands: [{ agentId: corpse.id, corpse }] });
  runInContext(stage.match(/^    viewLayout = [^\r\n]+/m)[0], scope);
  runInContext(stage.match(/function formationScale\([^]*?\n  }/)[0], scope);
  assert.equal(scope.formationScale(1200, 560) * 100, 137);
  const panel = game.slice(game.indexOf("    function drawCombatPanel("));
  runInContext(game.match(/^    function combatArenaUnits\([^]*?^    }/m)[0], scope);
  runInContext(panel.match(/^      const formation = [^]*?;\r?$/m)[0], scope);
  runInContext(panel.match(/^      const cell = [^\r\n]+/m)[0] + "\nglobalThis.observedCell = cell;", scope);
  assert.equal(scope.observedCell, 137);
  assert.deepEqual(calls.map(([width, height, units]) => [width, height, Array.from(units, unit => unit.id)]),
    [[1200, 560, ["visible"]], [1200, 560, ["visible", "corpse"]]]);
  assert.equal(calls[0][3], scope.camera); assert.equal(calls[1][3], scope.combatWatch.camera);
  assert.match(stage, /cameraUnits = trial\.agents\.map\(stageAgent\)/);
});

test("전투창 카메라는 이동·사망·큰 유닛 합류 뒤에도 처음 배율과 좌표계를 유지한다", () => {
  const pair = [0, 1].map(side => ({ id: String(side), tribe: "bean",
    combat: { side, position: { x: side ? 1.15 : -1.15, y: 0, homeX: side ? 1.15 : -1.15, homeY: 0 } } }));
  const camera = {}, before = combatViewLayout(1200, 560, pair, camera);
  const anchor = { x: -.5, y: 1 }, screen = before.project(anchor);
  pair[0].combat.position.x = -.5; pair[0].combat.position.y = 1;
  const large = { id: "large", species: "white-paw", stats: { pieceCount: 100 }, combat: { side: 1, position: { x: 5, y: 3 } } };
  for (const units of [pair, [...pair, large], [pair[0], large], [pair[0]]]) {
    const after = combatViewLayout(1200, 560, units, camera);
    assert.equal(after.cell, before.cell);
    assert.deepEqual(after.project(anchor), screen);
    assert.deepEqual(after.project({ x: 0, y: 0 }), before.project({ x: 0, y: 0 }));
    assert.deepEqual(after.positions.get("0"), { ...after.positions.get("0"), ...screen });
    const restored = after.unproject(screen);
    assert.ok(Math.abs(restored.x - anchor.x) < 1e-9 && Math.abs(restored.y - anchor.y) < 1e-9);
  }
  const reopened = combatViewLayout(1200, 560, [...pair, large], {});
  assert.ok(reopened.cell < before.cell);
  const resized = combatViewLayout(600, 280, [...pair, large], camera);
  assert.equal(resized.cell, before.cell / 2);
  assert.deepEqual(resized.project(anchor), { x: screen.x / 2, y: screen.y / 2 });
});


test("실험실 양쪽 외형 선택은 큰 종의 본체를 키우고 초기화할 때만 구도를 새로 맞춘다", () => {
  for (const [width, height] of [[1130, 527], [494, 230]]) for (const side of [0, 1]) {
    const trial = key => createSimulationTrial({ left: { key: side ? "flower-tail-bird" : key },
      right: { key: side ? key : "flower-tail-bird" }, random: false });
    const small = trial("flower-tail-bird"), large = trial("white-paw");
    const before = combatViewLayout(width, height, small.agents, {}), after = combatViewLayout(width, height, large.agents, {});
    const smallUnit = small.agents.find(unit => unit.side === side), largeUnit = large.agents.find(unit => unit.side === side);
    assert.ok(after.cell * unitDisplaySize(largeUnit) > before.cell * unitDisplaySize(smallUnit) * 2);
    for (const { bounds } of after.positions.values()) {
      assert.ok(bounds.left >= width * .06 - 1e-9 && bounds.right <= width * .94 + 1e-9);
      assert.ok(bounds.top >= height * .19 - 1e-9 && bounds.bottom <= height * .91 + 1e-9);
    }
  }
});


test("공격 자세와 수직 평행 이동은 편성 카메라 배율을 바꾸지 않는다", () => {
  const units = [0, 1].map(side => ({ id: String(side), species: "cotton-sheep",
    combat: { side, position: { x: side ? 1 : -1, y: side ? .5 : -.5 } } }));
  const before = combatViewLayout(1200, 560, units);
  const after = combatViewLayout(1200, 560, units.map(unit => ({ ...unit, mode: "attack", hurtStartedAt: 2,
    attack: { startedAt: 1 }, combat: { ...unit.combat, position: { ...unit.combat.position } } })));
  assert.equal(after.cell, before.cell); assert.deepEqual(after.positions, before.positions);
  const translated = combatViewLayout(1200, 560, units.map(unit => ({ ...unit, combat: { ...unit.combat,
    position: { x: unit.combat.position.x, y: unit.combat.position.y - 14 } } })));
  assert.ok(Math.abs(translated.cell - before.cell) < 1e-9);
  for (const unit of units) {
    const first = before.positions.get(unit.id), second = translated.positions.get(unit.id);
    assert.ok(Math.abs(first.x - second.x) < 1e-9); assert.ok(Math.abs(first.y - second.y) < 1e-9);
    assert.deepEqual(before.project(unit.combat.position), { x: first.x, y: first.y });
  }
});

test("현재 위치가 넓게 퍼진 혼합 체급도 큰 화면과 좁은 화면의 여백 안에 들어간다", () => {
  for (const [width, height] of [[1200, 560], [360, 168]]) for (const count of [1, 5, 20]) {
    const units = [0, 1].flatMap(side => Array.from({ length: count }, (_, slot) => ({ id: side + ":" + slot,
      species: ["flower-tail-bird", "white-paw", "walking-forest"][slot % 3], stats: { pieceCount: slot * 5 },
      combat: { side, position: { x: (side ? 1 : -1) * (1 + slot % 3), y: slot - count / 2 } } })));
    const layout = combatViewLayout(width, height, units);
    assert.equal(layout.positions.size, units.length);
    for (const { bounds } of layout.positions.values()) {
      assert.ok(bounds.left >= width * .06 - 1e-9 && bounds.right <= width * .94 + 1e-9);
      assert.ok(bounds.top >= height * .19 - 1e-9 && bounds.bottom <= height * .91 + 1e-9);
    }
  }
});

test("공개 전투 번들과 인게임 모델의 카메라가 원본과 같다", () => {
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

test("기본 새싹콩 크기를 유지하고 최소·최대와 DNA 성장 편차를 절반으로 압축한다", () => {
  assert.equal(unitDisplaySize({ tribe: "bean" }), .4);
  assert.ok(Math.abs(unitDisplaySize({ species: "flower-tail-bird" }) - .33) < 1e-12);
  assert.ok(Math.abs(unitDisplaySize({ species: "white-paw" }) - .92) < 1e-12);
  const ordered = Object.entries(UNIT_DISPLAY_SIZES).sort((a, b) => a[1] - b[1]);
  for (let index = 1; index < ordered.length; index++) {
    const [low, high] = [ordered[index - 1], ordered[index]];
    const difference = unitDisplaySize({ species: high[0] }) - unitDisplaySize({ species: low[0] });
    assert.ok(Math.abs(difference - (high[1] - low[1]) * .5) < 1e-12);
  }
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const plain = unitDisplaySize({ tribe }), grown = unitDisplaySize({ tribe, stats: { pieceCount: 100 } });
    assert.ok(Math.abs(grown - plain - UNIT_DISPLAY_SIZES[tribe] * .5) < 1e-12);
  }
});

test("상대 체급 교체는 기본 배율을 보존하고 상대 후열 이동은 내 전열을 끌고 가지 않는다", () => {
  for (const [width, height] of [[1130, 527], [494, 230]]) for (const side of [0, 1]) {
    const layout = (own, opponent) => {
      const trial = createSimulationTrial({ left: { key: side ? opponent : own }, right: { key: side ? own : opponent }, random: false });
      const view = combatViewLayout(width, height, trial.agents);
      return { view, own: trial.agents.find(unit => unit.side === side), opponent: trial.agents.find(unit => unit.side !== side) };
    };
    const small = layout("white-paw", "flower-tail-bird"), medium = layout("white-paw", "lantern-keeper"), large = layout("white-paw", "white-paw");
    assert.equal(small.view.cell, medium.view.cell); assert.equal(medium.view.cell, large.view.cell);
    const restored = layout("white-paw", "flower-tail-bird");
    assert.equal(restored.view.cell, small.view.cell); assert.deepEqual(restored.view.positions, small.view.positions);
    const melee = layout("rolling-acorn", "rolling-acorn"), ranged = layout("rolling-acorn", "flower-tail-bird");
    assert.equal(melee.own.combat.position.role, "front"); assert.equal(ranged.own.combat.position.role, "front");
    assert.equal(melee.own.combat.position.x, ranged.own.combat.position.x);
    assert.ok(Math.abs(ranged.view.positions.get(String(ranged.own.id)).x - width / 2) <
      Math.abs(ranged.view.positions.get(String(ranged.opponent.id)).x - width / 2));
    for (const { view } of [small, medium, large, melee, ranged]) {
      assert.equal(view.project({ x: 0, y: 0 }).x, width / 2);
      for (const { bounds } of view.positions.values()) {
        assert.ok(bounds.left >= width * .06 - 1e-9 && bounds.right <= width * .94 + 1e-9);
        assert.ok(bounds.top >= height * .19 - 1e-9 && bounds.bottom <= height * .91 + 1e-9);
      }
    }
  }
});

test("같은 종 대결도 흰발은 꽃꼬리새보다 실제 본체를 크게 표시한다", () => {
  for (const [width, height] of [[1130, 527], [494, 230]]) {
    const pixels = [];
    for (const key of ["flower-tail-bird", "white-paw"]) {
      const trial = createSimulationTrial({ left: { key }, right: { key }, random: false });
      const view = combatViewLayout(width, height, trial.agents);
      pixels.push(view.cell * unitDisplaySize(trial.agents[0]));
      for (const unit of trial.agents) {
        const point = unit.combat.position, screen = view.project(point);
        assert.ok(screen.x > 0 && screen.x < width);
        const restored = view.unproject(screen);
        assert.ok(Math.abs(restored.x - point.x) < 1e-9 && Math.abs(restored.y - point.y) < 1e-9);
      }
    }
    assert.ok(pixels[1] > pixels[0] * 2);
    assert.ok(Math.abs(pixels[0] - height * .2 * .33 / .4) < 1e-9);
  }
});

test("빈 공간 축약은 접근 이동을 상쇄하지 않고 현재 투영의 역변환을 보존한다", () => {
  const trial = createSimulationTrial({ left: { key: "flower-tail-bird" }, right: { key: "flower-tail-bird" }, random: false });
  const before = combatViewLayout(1130, 527, trial.agents);
  const initial = trial.agents.map(unit => ({ ...unit.combat.position }));
  trial.advance(.2);
  const after = combatViewLayout(1130, 527, trial.agents);
  assert.equal(after.cell, before.cell);
  for (const [index, unit] of trial.agents.entries()) {
    assert.ok(Math.abs(unit.combat.position.x) < Math.abs(initial[index].x));
    const first = before.positions.get(String(unit.id)), second = after.positions.get(String(unit.id));
    assert.ok(Math.abs(second.x - 565) < Math.abs(first.x - 565));
    assert.ok(Math.abs(second.x - first.x) > 1);
    for (const offset of [-54, -20, 0, 20, 54]) {
      const screen = { x: second.x + offset, y: second.y + offset / 2 };
      const restored = after.project(after.unproject(screen));
      assert.ok(Math.abs(restored.x - screen.x) < 1e-8 && Math.abs(restored.y - screen.y) < 1e-8);
    }
  }
});
