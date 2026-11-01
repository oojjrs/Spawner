import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatLayout } from "./combat.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
function declaration(name) { return source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0]; }
function fixture() {
  const units = Array.from({ length: 800 }, (_, index) => ({ id: "1:" + index, x: index % 100 * 3, y: Math.floor(index / 100) * 30,
    health: 12, attributes: {}, moveDuration: 0, mode: "search", tribe: "bean" }));
  const state = { simSeconds: 1, agents: units, rivals: [], camera: { x: 30, y: 30, zoom: 64 }, visible: new Set(), explored: new Set() };
  const context = createContext({ state, viewport: { width: 1280, height: 720 }, agentView: { units: [] },
    agentPositions: new WeakMap(), agentMovements: new Map(),
    agentDisplayLayout: { positions: new Map(), cells: new Map(), offsets: new Map() }, agentCombatLayout: {},
    Spawner: { combatLayout, corpseHarvestOffset: () => ({ x: 0, y: 0 }) },
    displayedAgent: agent => agent, agentBirthPose: () => null, agentDeliveryOffset: () => ({ x: 0, y: 0 }),
    WORLD_SIZE: 160, foodCellMap: new Map(), worldMap: { seed: 13 }, AGENT_HEIGHT: .7, AGENT_JUMP_PREPARATION: .2,
    idleMotion: { matches: false }, hashNoise: () => .5, clamp: (value, low, high) => Math.max(low, Math.min(high, value)) });
  for (const name of ["visibleAgents", "agentRenderCandidates", "agentBasePosition", "agentCombatPlacement", "agentDisplayOffset", "interpolatedAgentPosition"])
    runInContext(declaration(name), context);
  return { context, state, units };
}

test("화면 밖 800개 유닛은 표시 후보에서 제외하고 이동·탄생 경계는 보존한다", () => {
  const { context, state, units } = fixture();
  const visible = context.visibleAgents();
  assert.ok(visible.length < 20);
  assert.equal(context.visibleAgents(), visible);
  const crossing = units.at(-1);
  Object.assign(crossing, { x: 300, y: 300, renderFromX: 30, renderFromY: 30, birth: { fromX: 30, fromY: 30 } });
  state.simSeconds += .1;
  assert.ok(context.visibleAgents().includes(crossing));
  state.camera.x = 300; state.camera.y = 210;
  assert.notEqual(context.visibleAgents(), visible);
});

test("표시 위치는 한 프레임에서 공유하고 카메라 이동 뒤 다시 계산한다", () => {
  const { context, state } = fixture(), unit = context.visibleAgents()[0];
  const position = context.interpolatedAgentPosition(unit);
  assert.equal(context.interpolatedAgentPosition(unit), position);
  assert.equal(context.agentDisplayLayout.positions.size, context.visibleAgents().length);
  state.camera.x += 2;
  assert.notEqual(context.interpolatedAgentPosition(unit), position);
});

test("밀집한 같은 칸의 같은 종류는 대표만 그리고 선택한 유닛을 우선한다", () => {
  const { context, state, units } = fixture();
  state.camera.zoom = 24;
  for (const unit of units) { unit.x = 30; unit.y = 30; }
  state.selection = { kind: "agent", target: units.at(-1) };
  assert.equal(context.visibleAgents().length, 800);
  const representatives = context.agentRenderCandidates();
  assert.equal(representatives.length, 1);
  assert.equal(representatives[0], state.selection.target);
  assert.equal(state.agents.length, 800);
  units[0].species = "dew-rabbit"; units[1].species = "dew-rabbit";
  units[2].combat = { id: "fight" };
  const mixed = context.agentRenderCandidates();
  assert.equal(mixed.length, 4);
  assert.ok(mixed.includes(units[0]) && mixed.includes(units[1]) && mixed.includes(units[2]));
});

test("대륙 줌에서는 중립 유닛도 자세·애니메이션 계산 없이 점으로 표시한다", () => {
  const { context, state, units } = fixture();
  state.camera.zoom = 2;
  let draws = 0;
  Object.assign(context, { ctx: { fillRect() { draws++; } }, worldToScreen: () => ({ x: 50, y: 50 }), objectOutlineColor: () => null,
    agentCombatPlacement() { throw new Error("줌아웃 전투 배치 계산 금지"); },
    agentBirthPose() { throw new Error("줌아웃 탄생 자세 계산 금지"); },
    drawAgentBody() { throw new Error("줌아웃 자세 계산 금지"); } });
  runInContext(declaration("drawAgent"), context);
  state.visible.add(units[0].y * 160 + units[0].x);
  context.drawAgent(0, { ...units[0], species: "dew-rabbit", faction: "neutral" });
  assert.equal(draws, 1);
});

for (const faction of ["hostile", "neutral", "rival"]) {
  for (const health of [12, 5]) {
    test(faction + " 유닛은 체력·교전·발견 기억이 있어도 안개 속에서 표시하지 않는다 (HP " + health + ")", () => {
      const { context, state, units } = fixture();
      const enemy = { ...units[0], id: "enemy", x: 30, y: 30, faction, health,
        species: faction === "rival" ? undefined : "spiny-back-beetle", combat: { id: "battle", side: 1 } };
      Object.assign(units[0], { x: 30, y: 30 });
      state.agents = [units[0]];
      state.rivals = [enemy];
      state.explored.add(30 * 160 + 30);
      assert.deepEqual(Array.from(context.visibleAgents()), [units[0]]);
      assert.ok(!context.agentRenderCandidates().includes(enemy));
    });
  }
}

test("도착 칸이 보여도 이동 중 실제 표시 위치가 안개 안이면 숨긴다", () => {
  const { context, state, units } = fixture();
  const enemy = { ...units[0], id: "moving-enemy", x: 31, y: 30, renderFromX: 30, renderFromY: 30,
    species: "spiny-back-beetle", faction: "hostile", moveStartedAt: 1, moveDuration: 2 };
  state.agents = [];
  state.rivals = [enemy];
  state.visible = new Set([30 * 160 + 31]);
  assert.equal(context.agentBasePosition(enemy).x, 30);
  assert.equal(context.visibleAgents().length, 0);
  state.simSeconds = 3;
  assert.ok(context.visibleAgents().includes(enemy));
});

test("같은 프레임에서 시야만 바뀌어도 표시 후보를 다시 계산한다", () => {
  const { context, state, units } = fixture();
  const enemy = { ...units[0], id: "enemy", x: 30, y: 30, faction: "hostile", species: "spiny-back-beetle" };
  state.agents = [];
  state.rivals = [enemy];
  state.visible = new Set([30 * 160 + 30]);
  assert.ok(context.visibleAgents().includes(enemy));
  state.visible = new Set();
  assert.equal(context.visibleAgents().length, 0);
});

test("아군 사체의 1칸 시야 안 유닛만 보이고 주변 안개 속 유닛은 숨긴다", () => {
  const { context, state, units } = fixture();
  state.agents = [];
  state.camera = { x: 30, y: 30, zoom: 24 };
  state.corpses = [{ x: 30, y: 30, colonyId: 1, amount: 2 }];
  state.visible = new Set([[30,30], [29,30], [31,30], [30,29], [30,31]].map(([x, y]) => y * 160 + x));
  state.rivals = [[31,30], [32,30], [31,31]].map(([x, y], index) => ({ ...units[0], id: "enemy:" + index,
    x, y, health: 5, faction: "hostile", species: "spiny-back-beetle" }));
  assert.deepEqual(Array.from(context.visibleAgents(), agent => agent.id), ["enemy:0"]);
});

test("최종 표시 위치가 안개 안이면 본체와 체력 표시 그리기를 함께 생략한다", () => {
  for (const zoom of [2, 24]) for (const health of [12, 5]) {
    const { context, state, units } = fixture();
    state.camera.zoom = zoom;
    let draws = 0;
    Object.assign(context, {
      interpolatedAgentPosition: () => ({ x: 32, y: 30 }),
      ctx: { fillRect() { draws++; } }, worldToScreen: () => ({ x: 50, y: 50 }), objectOutlineColor: () => null,
      agentCombatPlacement: () => null, drawAgentGroundShadow() { draws++; }, drawAgentBody() { draws++; }
    });
    state.visible = new Set([30 * 160 + 31]);
    runInContext(declaration("drawAgent"), context);
    context.drawAgent(0, { ...units[0], x: 31, y: 30, health, faction: "hostile", species: "spiny-back-beetle" });
    assert.equal(draws, 0);
    context.interpolatedAgentPosition = () => ({ x: 31, y: 30 });
    context.drawAgent(0, { ...units[0], x: 31, y: 30, health, faction: "hostile", species: "spiny-back-beetle" });
    assert.ok(draws > 0);
  }
});
