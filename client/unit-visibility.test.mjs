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
  const state = { simSeconds: 1, agents: units, rivals: [], camera: { x: 30, y: 30, zoom: 64 } };
  const context = createContext({ state, viewport: { width: 1280, height: 720 }, agentView: { units: [] },
    agentPositions: new WeakMap(), agentMovements: new Map(),
    agentDisplayLayout: { positions: new Map(), cells: new Map(), offsets: new Map() }, agentCombatLayout: {},
    Spawner: { combatLayout, corpseHarvestOffset: () => ({ x: 0, y: 0 }) },
    displayedAgent: agent => agent, agentBirthPose: () => null, agentDeliveryOffset: () => ({ x: 0, y: 0 }),
    foodCellMap: new Map(), worldMap: { seed: 13 }, AGENT_HEIGHT: .7, AGENT_JUMP_PREPARATION: .2,
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
  context.drawAgent(0, { ...units[0], species: "dew-rabbit", faction: "neutral" });
  assert.equal(draws, 1);
});
