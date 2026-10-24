import test from "node:test";
import assert from "node:assert/strict";
import { createCreatures } from "./creatures.mjs";
import { createGame } from "./game.mjs";
import { createRoom, saveRoom, restoreRoom } from "../client/room.mjs";

function fixture(type) {
  const burrow = { id:"burrow:" + type + ":45140", type, x:140, y:140, width:type === "small" ? 1 : 3, height:1,
    entrance:{ x:type === "small" ? 140 : 141, y:141 } };
  const colony = { id:1, ownerId:"burrow-attack", x:98, y:98, occupiedCells:new Set(["2,2"]) };
  const room = { seed:7, simSeconds:0, world:{ seed:7, sites:[[100,100]], terrain:new Uint8Array(320 * 320).fill(4),
    hazards:new Uint8Array(320 * 320), burrows:[burrow] }, colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  const game = createGame(room, colony); room.games.set(colony.ownerId, game); game.agents.splice(1);
  room.creatureSystem = createCreatures(room, null);
  for (const [index, beetle] of room.creatureSystem.agents.entries()) Object.assign(beetle,
    { x:260 + index, y:260, homeX:260 + index, homeY:260, renderFromX:260 + index, renderFromY:260 });
  const agent = game.agents[0];
  Object.assign(agent, { x:burrow.x + burrow.width, y:burrow.y, renderFromX:burrow.x + burrow.width, renderFromY:burrow.y,
    moveStartedAt:0, moveDuration:0, moveBudget:0, mode:"fight", decisionPending:null, nextDecisionAt:100,
    knownEnemyIds:new Set([burrow.id]), actionPriorities:["fight"],
    utility:{ action:"fight", target:{ id:burrow.id, key:burrow.id, kind:"burrow", x:burrow.x, y:burrow.y }, route:[] } });
  agent.stats.attack = 5; agent.stats.speed = 1;
  return { room, game, burrow, agent, system:room.creatureSystem };
}

test("작은 굴 20·큰 굴 60의 체력을 적용하고 파괴 시 통행만 열며 기존 딱정벌레를 보존한다", () => {
  for (const [type, health] of [["small",20],["large",60]]) {
    const { system, burrow } = fixture(type), ids = system.agents.map(agent => agent.id);
    assert.equal(system.burrows[0].health, health); assert.equal(system.burrows[0].maxHealth, health);
    assert.ok(system.burrowAt(burrow.x + burrow.width - 1, burrow.y));
    system.receiveBurrowDamage(burrow.id, Infinity); system.receiveBurrowDamage(burrow.id, -1);
    assert.equal(system.burrows[0].health, health);
    assert.equal(system.receiveBurrowDamage(burrow.id, health - 1), 1);
    assert.equal(system.receiveBurrowDamage(burrow.id, 5), 0);
    assert.equal(system.burrowAt(burrow.x, burrow.y), null);
    assert.deepEqual(system.agents.map(agent => agent.id), ids);
    assert.ok(system.agents.every(agent => agent.health === 20));
  }
});

test("큰 굴의 오른쪽 칸에 붙어 명중 프레임에 한 번만 피해를 준다", () => {
  const { room, game, system, burrow, agent } = fixture("large");
  room.simSeconds = 10; game.prepare(10); game.tick(.01);
  assert.equal(agent.attack.targetKind, "burrow"); assert.equal(agent.attack.targetId, burrow.id);
  room.simSeconds = 10.299; game.prepare(room.simSeconds); game.tick(.299);
  assert.equal(system.burrows[0].health, 60);
  room.simSeconds = 10.3; game.prepare(room.simSeconds); game.tick(.001);
  assert.equal(system.burrows[0].health, 55); assert.equal(agent.attack.hit, true);
  game.restore(game.save()); game.prepare(10.31); game.tick(.01);
  assert.equal(system.burrows[0].health, 55);
});

test("발견한 굴을 자율 전투 후보로 고르며 보이지 않는 굴을 추적하지 않는다", () => {
  const { room, game, burrow, agent } = fixture("small");
  Object.assign(agent, { x:burrow.x + 5, renderFromX:burrow.x + 5, utility:null, decisionPending:"restore" });
  game.prepare(0); game.tick(.01);
  assert.notEqual(agent.utility?.target.kind, "burrow");
  Object.assign(agent, { x:burrow.x + 1, renderFromX:burrow.x + 1, utility:null, moveStartedAt:0, moveDuration:0, decisionPending:"restore" });
  room.simSeconds = 1; game.prepare(1); game.tick(.01);
  assert.equal(agent.utility.action, "fight"); assert.equal(agent.utility.target.id, burrow.id);
});

test("유닛의 실제 연속 공격으로 굴이 부서지면 증식과 공격 대상이 사라지고 나온 개체는 남는다", () => {
  for (const type of ["small","large"]) {
    const { room, game, system, burrow } = fixture(type), ids = system.agents.map(agent => agent.id);
    for (let index = 0; index < 150 && system.burrows[0].health > 0; index++) {
      room.simSeconds = index / 10; game.prepare(room.simSeconds); game.tick(.1);
    }
    assert.equal(system.burrows[0].health, 0, type);
    const snapshot = game.snapshot(); assert.equal(snapshot.burrows[0].health, 0);
    room.simSeconds = 1200; system.tick();
    assert.deepEqual(system.agents.map(agent => agent.id), ids);
    assert.ok(system.agents.every(agent => agent.health > 0 && agent.burrowId === burrow.id));
    assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse").length, 0);
  }
});

test("공격 중 굴이 먼저 파괴되면 다른 굴로 피해를 넘기지 않는다", () => {
  const { room, game, system, burrow, agent } = fixture("small");
  room.simSeconds = 10; game.prepare(10); game.tick(.01);
  system.receiveBurrowDamage(burrow.id, 20);
  room.simSeconds = 10.3; game.prepare(10.3); game.tick(.3);
  assert.equal(agent.attack.resolved, true); assert.equal(agent.attack.hit, false);
  assert.equal(system.burrows[0].health, 0);
});

test("실제 저장 월드에서 부분 피해와 파괴 상태를 복원하고 파괴된 굴의 재증식을 막는다", () => {
  const room = createRoom("굴 파괴 저장 확인", 731047), system = room.creatureSystem;
  const small = system.burrows.find(burrow => burrow.type === "small"), large = system.burrows.find(burrow => burrow.type === "large");
  system.receiveBurrowDamage(small.id, 20); system.receiveBurrowDamage(large.id, 23);
  const survivors = system.agents.filter(agent => agent.burrowId === small.id).map(agent => agent.id);
  const saved = JSON.parse(JSON.stringify(saveRoom(room))), restored = restoreRoom(saved);
  assert.equal(restored.creatureSystem.burrows.find(burrow => burrow.id === small.id).health, 0);
  assert.equal(restored.creatureSystem.burrows.find(burrow => burrow.id === large.id).health, 37);
  restored.simSeconds = 600; restored.creatureSystem.tick();
  assert.deepEqual(restored.creatureSystem.agents.filter(agent => agent.burrowId === small.id).map(agent => agent.id), survivors);
  assert.equal(restored.creatureSystem.agents.filter(agent => agent.burrowId === large.id).length, 6);
});
