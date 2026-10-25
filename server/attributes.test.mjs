import test from "node:test";
import assert from "node:assert/strict";
import { attributeCounts, unitStats, unitMovementSpeed } from "./attributes.mjs";
import { createGame } from "./game.mjs";

function fixture(tribe) {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id: 1, ownerId: "attribute-test", x: 40, y: 40, tribe, occupiedCells };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 100;
  game.restore(JSON.stringify(saved));
  return game;
}

test("기본 채집량은 1개이며 채집량·감지·수명·이속 보너스를 적용한다", () => {
  assert.equal(unitStats(attributeCounts([])).capacity, 1);
  assert.equal(unitStats(attributeCounts(["strength"])).capacity, 2);
  assert.equal(unitStats(attributeCounts(["strength", "strength"])).capacity, 3);
  assert.equal(unitStats(attributeCounts(["antenna"])).vision, 5);
  assert.equal(unitStats(attributeCounts([])).lifespan, 180);
  assert.equal(unitStats(attributeCounts(["lifespan"])).lifespan, 300);
  assert.equal(unitMovementSpeed(unitStats(attributeCounts(["feet"]))), .8);
});

test("네 부족의 초반 두 유닛에 감지와 채집량 증가를 각각 실제 장착한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const game = fixture(tribe);
    assert.deepEqual(game.agents.map(agent => agent.slots), [["antenna"], ["strength"]]);
    assert.deepEqual(game.agents.map(agent => agent.stats.capacity), [1, 2]);
    assert.deepEqual(game.agents.map(agent => agent.stats.vision), [5, 3]);
    assert.ok(game.agents.every(agent => agent.attributes.feet === 0));
    for (const agent of game.agents) assert.deepEqual(agent.appearanceAttributes, agent.attributes);
  }
});

test("1레벨에서 속성 없이 또는 하나만 넣어 생성하고 두 개는 거부한다", () => {
  const game = fixture("bean");
  for (const slots of [[], ["lifespan"]]) {
    const result = game.command({ type: "design", templateId: null, name: "속성 " + slots.length, slots, birth: true });
    assert.ok(result.agentId);
    assert.deepEqual(game.agents.find(agent => agent.id === result.agentId).slots, slots);
    assert.ok(game.command({ type: "birth", templateId: result.templateId }).agentId);
  }
  assert.throws(() => game.command({ type: "design", templateId: null, name: "초과", slots: ["antenna", "strength"], birth: true }), /설계 속성/);
});

test("수명 속성은 출생부터 5분을 적용하고 3분에 죽지 않는다", () => {
  const game = fixture("bean");
  const result = game.command({ type: "design", templateId: null, name: "장수", slots: ["lifespan"], birth: true });
  assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 300);
  game.prepare(299.999);
  game.tick(0);
  assert.ok(game.agents.some(agent => agent.id === result.agentId));
  game.prepare(300);
  game.tick(0);
  assert.equal(game.agents.some(agent => agent.id === result.agentId), false);
});

test("성장으로 발현한 수명 보너스는 저장·복원과 재성장 때 중복되지 않는다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "성장 수명", slots: ["strength", "lifespan"], birth: true });
  assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 180);
  for (const time of [35, 60]) {
    game.prepare(time);
    game.tick(0);
    assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 300);
    game.restore(game.save());
    assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 300);
  }
});

test("이전 저장의 초반 유닛도 행동 역할에 맞는 실제 속성을 복원한다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  for (const agent of saved.state.agents) {
    agent.slots = [];
    agent.activeSlots = [];
    agent.attributes = attributeCounts([]);
    agent.stats = unitStats(agent.attributes);
  }
  game.restore(JSON.stringify(saved));
  assert.deepEqual(game.agents.map(agent => agent.slots), [["antenna"], ["strength"]]);
  assert.deepEqual(game.agents.map(agent => agent.stats.capacity), [1, 2]);
});
