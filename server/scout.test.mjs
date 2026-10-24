import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";

function frontierFixture() {
  const size = 19;
  const explored = new Set(), passable = new Set();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x < 13 && !(x === 8 && y === 4)) explored.add(y * size + x);
  }
  for (let x = 8; x <= 12; x++) passable.add(8 * size + x);
  for (let y = 5; y <= 8; y++) passable.add(y * size + 8);
  const agent = { id: "scout", templateId: null, slots: [], actionPriorities: ["explore", "collect"],
    x: 8, y: 8, health: 12, cost: 3, carrying: 0, stepCount: 0,
    stats: { health: 12, speed: 1, capacity: 2, vision: 2, attack: 1, resistance: 1 },
    personality: { boldness: 0.5, aggression: 0.5, curiosity: 0.5 }, visited: new Set(["8,8"]) };
  const state = { simSeconds: 0, nestLevel: 1, evolutionPoints: 0, explored, knownFood: new Map(), agents: [agent] };
  Object.defineProperty(state, "markers", { get() { throw new Error("정찰은 안개 속 감지 표식을 참조할 수 없습니다."); } });
  const ai = createUtilityAI({ state, size, homeCells: () => [{ x: agent.x, y: agent.y }],
    deliveryCells: () => [{ x: agent.x, y: agent.y }],
    walkable(x, y) {
      assert.ok(state.explored.has(y * size + x), "통행 판단은 탐색한 칸에만 요청해야 합니다.");
      return passable.has(y * size + x);
    },
    hazardAt(x, y) {
      assert.ok(state.explored.has(y * size + x), "위험 판단은 탐색한 칸에만 요청해야 합니다.");
      return 0;
    },
    enemies: () => [], synergy: () => false, canHarvest: () => true });
  return { ai, agent, state, passable, size };
}

function gameFixture(terrain) {
  const colony = { id: 1, ownerId: "test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain, hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set("test", game);
  game.agents.splice(1);
  return { game, environment };
}

function advance(fixture, seconds) {
  for (let step = 0; step < Math.round(seconds * 10); step++) {
    fixture.environment.simSeconds += 0.1;
    fixture.game.prepare(fixture.environment.simSeconds);
    fixture.game.tick(0.1);
  }
}

test("정찰은 둥지에 더 가까운 작은 빈틈보다 이동 시간 대비 넓은 미탐색 경계를 선택한다", () => {
  const f = frontierFixture();
  const plans = f.ai.evaluate(f.agent, false);
  assert.equal(plans[0].action, "explore");
  assert.deepEqual({ x: plans[0].target.x, y: plans[0].target.y }, { x: 12, y: 8 });
  for (const plan of plans) for (const cell of plan.route) assert.ok(f.state.explored.has(cell.y * f.size + cell.x));
  assert.equal(f.ai.nextStep(f.agent, { x: 13, y: 8 }), null);
});

test("정찰은 고립된 경계를 건너뛰고 알려진 우회로의 실제 이동 시간을 비교한다", () => {
  const f = frontierFixture();
  f.passable.delete(8 * f.size + 10);
  f.passable.add(2 * f.size + 12);
  for (let y = 9; y <= 16; y++) {
    f.passable.add(y * f.size + 9);
    f.passable.add(y * f.size + 11);
  }
  f.passable.add(16 * f.size + 10);
  const plans = f.ai.evaluate(f.agent, false);
  assert.equal(plans[0].action, "explore");
  assert.deepEqual({ x: plans[0].target.x, y: plans[0].target.y }, { x: 8, y: 5 });
  assert.ok(!plans.some(plan => plan.target.x === 12 && plan.target.y === 2));
  for (const plan of plans) for (const cell of plan.route) assert.ok(f.passable.has(cell.y * f.size + cell.x));
  assert.ok(plans.some(plan => plan.target.x === 12 && plan.route.some(cell => cell.y === 16)));
});

test("탐색 칸 수가 같은 다른 지식을 복원해도 이전 경계를 재사용하지 않는다", () => {
  const f = frontierFixture();
  f.ai.evaluate(f.agent, false);
  const mirror = index => Math.floor(index / f.size) * f.size + f.size - 1 - index % f.size;
  f.state.explored = new Set([...f.state.explored].map(mirror));
  const passable = [...f.passable].map(mirror);
  f.passable.clear();
  for (const index of passable) f.passable.add(index);
  f.agent.x = f.size - 1 - f.agent.x;
  f.agent.visited = new Set([f.agent.x + "," + f.agent.y]);
  const plan = f.ai.evaluate(f.agent, false)[0];
  assert.deepEqual({ x: plan.target.x, y: plan.target.y }, { x: 6, y: 8 });
});

test("안개 속 지형·위험·버섯 배치가 달라도 발견 전 정찰 판단은 같다", () => {
  const first = gameFixture(new Uint8Array(320 * 320).fill(4));
  const second = gameFixture(new Uint8Array(320 * 320).fill(4));
  const saved = first.game.save();
  second.game.restore(saved);
  const explored = new Set(first.game.snapshot().explored);
  for (let index = 0; index < 320 * 320; index++) {
    if (explored.has(index)) continue;
    first.environment.world.terrain[index] = 0;
    second.environment.world.terrain[index] = 8;
    second.environment.world.hazards[index] = 1;
  }
  first.environment.food.set("60,42", { x: 60, y: 42, amount: 999, terrain: "grassland", resourceType: "honey-mushrooms" });
  second.environment.food.set("42,60", { x: 42, y: 60, amount: 999, terrain: "grassland", resourceType: "honey-mushrooms" });
  for (const fixture of [first, second]) {
    fixture.game.agents[0].decisionPending = "completed";
    advance(fixture, 0.1);
  }
  assert.deepEqual(first.game.agents[0].utility, second.game.agents[0].utility);
  assert.equal(first.game.snapshot().food.length, 0);
  assert.equal(second.game.snapshot().food.length, 0);
});

test("경계를 따라 이동하다 버섯이 실제 시야에 들어온 뒤에만 발견한다", () => {
  const terrain = new Uint8Array(320 * 320);
  for (let x = 40; x <= 70; x++) terrain[42 * 320 + x] = 4;
  const f = gameFixture(terrain);
  f.environment.food.set("51,42", { x: 51, y: 42, amount: 10, terrain: "grassland", resourceType: "honey-mushrooms" });
  assert.ok(!f.game.snapshot().food.some(food => food.x === 51 && food.y === 42));
  let discovered = false;
  for (let step = 0; step < 200; step++) {
    advance(f, 0.1);
    const snapshot = f.game.snapshot();
    if (!snapshot.food.some(food => food.x === 51 && food.y === 42)) continue;
    assert.ok(snapshot.visible.includes(42 * 320 + 51));
    assert.equal(f.game.agents[0].utility.action, "explore");
    discovered = true;
    break;
  }
  assert.ok(discovered);
});
