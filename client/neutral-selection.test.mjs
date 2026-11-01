import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/game.mjs", import.meta.url), "utf8");
function declaration(name) {
  return source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0];
}

function fixture(faction) {
  const creature = { id: "creature:1", species: "cotton-sheep", faction, health: 12, x: 2, y: 3 };
  const own = { id: "own:1", health: 10, x: 5, y: 3 };
  const strokes = [];
  const state = { agents: [own], rivals: [creature], selection: { kind: "agent", target: creature },
    simSeconds: 1, camera: { zoom: 64, followAgentId: creature.id }, visible: new Set([32, 35]) };
  const scope = createContext({ state, WORLD_SIZE: 10, AGENT_HEIGHT: .7, strokes,
    visibleAgents: () => state.agents.concat(state.rivals.filter(agent => state.visible.has(agent.y * 10 + agent.x))),
    screenToWorld: (x, y) => ({ x, y }), worldToScreen: (x, y) => ({ x: x * 64, y: y * 64 }),
    interpolatedAgentPosition: agent => agent, agentBasePosition: agent => agent, displayedAgent: agent => agent,
    agentBirthPose: () => null, agentCombatPlacement: () => null, unitDisplayFloor: () => .5,
    unitDisplayBounds: new Map(["cotton-sheep", "bean"].map(key => [key, { x: -.4, y: -.4, width: .8, height: .8 }])),
    cameraTransition: null,
    colonyAt: () => null, foodCellAt: () => null, clampCamera() {},
    selectObject: () => { state.selection = null; }, closeColonyMenu() {},
    ctx: { save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo(x, y) { strokes.push([x, y]); },
      ellipse() {}, stroke() {}, fill() {} }, clamp: (n, low, high) => Math.max(low, Math.min(high, n)) });
  for (const name of ["agentById", "isAgentSelectable", "selectableObjectAt", "updateSelection", "updateCameraFollow",
    "selectedMovementAgents", "drawSelectedAgentTarget", "drawSelectedAgentMovement"])
    runInContext(declaration(name), scope);
  return { scope, state, creature, own, strokes };
}

for (const faction of ["hostile", "neutral"]) {
  test(faction + " 중립몹을 클릭·선택 유지·카메라 추적한다", () => {
    const { scope, state, creature } = fixture(faction);
    assert.equal(scope.selectableObjectAt(2.5, 3.5).target, creature);
    scope.updateSelection();
    assert.equal(state.selection.target, creature);
    scope.updateCameraFollow();
    assert.equal(state.camera.x, 2.5);
    assert.equal(state.camera.y, 3.5);
    assert.deepEqual(Array.from(scope.selectedMovementAgents()), [creature]);
  });
}

test("새 snapshot에서도 중립몹 ID로 선택을 재연결하고 안개 진입 시 해제한다", () => {
  const { scope, state, creature } = fixture("neutral");
  const start = source.indexOf("      if (selection) {", source.indexOf("    function applySnapshot("));
  const end = source.indexOf("      if (colonyMenuEntry)", start);
  scope.selection = state.selection;
  scope.foodCellMap = new Map();
  scope.worldMap = {};
  scope.colonyEntries = [];
  state.corpses = [];
  state.rivals = [{ ...creature }];
  runInContext(source.slice(start, end), scope);
  assert.equal(state.selection.target, state.rivals[0]);
  assert.notEqual(state.selection.target, creature);
  state.visible.clear();
  scope.updateSelection();
  assert.equal(state.selection, null);
  assert.equal(scope.isAgentSelectable(state.rivals[0]), false);
});

test("실제 공격 대상에 연결선을 그리고 죽거나 보이지 않는 유닛에는 그리지 않는다", () => {
  const { scope, creature, own, strokes, state } = fixture("hostile");
  creature.combatTarget = { id: own.id, kind: "agent", x: own.x, y: own.y, width: 1, height: 1 };
  scope.drawSelectedAgentMovement(creature);
  assert.deepEqual(strokes[0], [5.5 * 64, (3.5 + .7 * .44) * 64]);
  strokes.length = 0;
  own.health = 0;
  scope.drawSelectedAgentMovement(creature);
  assert.equal(strokes.length, 0);
  own.health = 10;
  state.agents = [];
  state.rivals.push(own);
  state.visible.delete(35);
  scope.drawSelectedAgentMovement(creature);
  assert.equal(strokes.length, 0);
});

test("비선공 이동 중 다음 칸의 경로를 표시하고 정지 후 깃발을 남기지 않는다", () => {
  const { scope, creature, strokes, state } = fixture("neutral");
  creature.mode = "walk";
  creature.moveStartedAt = 0;
  creature.moveDuration = 2;
  scope.interpolatedAgentPosition = () => ({ x: 1.5, y: 3 });
  scope.drawSelectedAgentMovement(creature);
  assert.ok(strokes.length > 0);
  strokes.length = 0;
  state.simSeconds = 2;
  scope.drawSelectedAgentMovement(creature);
  assert.equal(strokes.length, 0);
});

test("snapshot은 실제 추적·공격 ID를 전달하고 안개·사망·교전 전 대상은 숨긴다", () => {
  const own = { id: "own", x: 2, y: 3, health: 10 };
  const nest = { id: "nest:1", kind: "nest", x: 4, y: 3, width: 2, height: 2, health: 100 };
  const creature = { id: "creature", x: 1, y: 3, health: 10, pursuitTargetId: own.id };
  const scope = createContext({ state: { agents: [own], rivals: [creature] }, WORLD_SIZE: 10,
    environment: { games: new Map([[1, { nest, buildings: [] }]]) },
    visibleCells: new Set([31, 32, 34]), combatDisposition: () => "aggressive" });
  const start = server.indexOf("      const targetAgents = new Map(");
  const end = server.indexOf("      return {\n        simSeconds:", start);
  const body = server.slice(start, end < 0 ? server.indexOf("      return {\r\n        simSeconds:", start) : end);
  const payload = () => runInContext("(() => {" + body + "return visibleAgent(state.rivals[0]); })()", scope);
  assert.equal(payload().combatTarget.id, own.id);
  creature.attack = { targetId: nest.id };
  creature.combat = { id: "battle" };
  assert.equal(payload().combatTarget.id, nest.id);
  creature.attack = null;
  assert.equal(payload().combatTarget, null);
  creature.combat = null;
  scope.visibleCells.delete(32);
  assert.equal(payload().combatTarget, null);
  scope.visibleCells.add(32);
  own.health = 0;
  assert.equal(payload().combatTarget, null);
});
