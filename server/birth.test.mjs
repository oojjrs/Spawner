import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { AGENT_BIRTH_DURATION, agentBirthMotion } from "./birth.mjs";

function fixture() {
  const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
  const colony = { id: 1, ownerId: "birth-test", x: 40, y: 40, occupiedCells: new Set(mask) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 500;
  saved.state.nestLevel = 2;
  game.restore(JSON.stringify(saved));
  return { game, environment, colony };
}

test("시작 유닛을 복제하면 같은 속성의 설계를 저장하고 다음 복제에서 재사용한다", () => {
  const { game } = fixture();
  const source = game.agents[0];
  const before = JSON.parse(game.save()).state;
  assert.equal(source.templateId, null);
  assert.equal(before.templates.length, 0);
  const result = game.command({ type: "birth", agentId: source.id });
  const copy = game.agents.find(agent => agent.id === result.agentId);
  const after = JSON.parse(game.save()).state;
  assert.deepEqual(copy.slots, source.slots);
  assert.equal(copy.templateName, source.templateName);
  assert.equal(copy.mode, "birth");
  assert.ok(copy.birth);
  assert.equal(after.templates.length, 1);
  const template = after.templates[0];
  assert.equal(copy.templateId, template.id);
  assert.equal(result.templateId, template.id);
  assert.deepEqual(template.slots, source.slots);
  assert.deepEqual(template.attributeLevels, source.attributeLevels);
  assert.deepEqual(template.unlockedAttributeLevels, source.attributeLevels);
  const repeated = game.command({ type: "birth", agentId: source.id });
  assert.equal(repeated.templateId, template.id);
  assert.equal(game.snapshot().templates.length, 1);
  game.restore(game.save());
  assert.deepEqual(game.snapshot().templates[0].attributeLevels, template.attributeLevels);
  assert.equal(after.evolutionPoints, before.evolutionPoints - copy.cost);
  assert.throws(() => game.command({ type: "birth", agentId: "other-colony" }), /복제할 생명체/);
});

test("유닛 복제는 나중에 수정한 템플릿 대신 탄생 당시 설계를 따른다", () => {
  const { game } = fixture();
  const result = game.command({ type: "design", templateId: null, name: "원본", slots: ["antenna"], birth: true });
  const source = game.agents.find(agent => agent.id === result.agentId);
  game.command({ type: "design", templateId: result.templateId, name: "수정본", slots: ["strength", "feet"], birth: false });
  const copied = game.command({ type: "birth", agentId: source.id });
  const copy = game.agents.find(agent => agent.id === copied.agentId);
  assert.deepEqual(copy.slots, ["antenna"]);
  assert.equal(copy.templateName, "원본");
  assert.equal(copy.templateRevision, 1);
});

test("슬롯 순서와 이름이 달라도 정규화한 속성이 같으면 기존 설계를 재사용한다", () => {
  const { game } = fixture();
  const result = game.command({ type: "design", templateId: null, name: "원본", slots: ["strength", "feet"], birth: true });
  const saved = JSON.parse(game.save());
  const source = saved.state.agents.find(agent => agent.id === result.agentId);
  source.attributeLevels.strength = 2;
  saved.state.templates[0].name = "같은 속성";
  saved.state.templates[0].slots.reverse();
  saved.state.templates[0].attributeLevels.strength = 2;
  game.restore(JSON.stringify(saved));
  const before = JSON.parse(game.save()).state;
  const copied = game.command({ type: "birth", agentId: source.id });
  const copy = game.agents.find(agent => agent.id === copied.agentId);
  const after = JSON.parse(game.save()).state;
  assert.equal(copied.templateId, result.templateId);
  assert.equal(copy.templateId, result.templateId);
  assert.equal(copy.templateName, "같은 속성");
  assert.deepEqual(copy.slots, source.slots);
  assert.deepEqual(copy.attributeLevels, { strength: 1, feet: 1 });
  assert.deepEqual(after.templates, before.templates);
  assert.equal(after.nextTemplateId, before.nextTemplateId);
});

test("이전 저장의 강화 단계는 1로 정규화하고 같은 속성의 설계를 재사용한다", () => {
  const { game } = fixture();
  const result = game.command({ type: "design", templateId: null, name: "원본", slots: ["strength"], birth: true });
  const saved = JSON.parse(game.save());
  saved.state.agents.find(agent => agent.id === result.agentId).attributeLevels.strength = 2;
  game.restore(JSON.stringify(saved));
  const copied = game.command({ type: "birth", agentId: result.agentId });
  const templates = game.snapshot().templates;
  assert.equal(copied.templateId, result.templateId);
  assert.equal(templates.length, 1);
  assert.equal(templates.find(template => template.id === result.templateId).attributeLevels.strength, 1);
  const template = templates.find(template => template.id === copied.templateId);
  assert.equal(template.name, "원본");
  assert.deepEqual(template.attributeLevels, { strength: 1 });
  assert.deepEqual(template.unlockedAttributeLevels, { strength: 1 });
  assert.equal(game.agents.find(agent => agent.id === copied.agentId).attributeLevels.strength, 1);
});

test("자동 저장 이름은 중복 번호와 24자 제한을 지킨다", () => {
  const { game } = fixture();
  const name = "가".repeat(24);
  const result = game.command({ type: "design", templateId: null, name, slots: ["antenna"], birth: true });
  game.command({ type: "design", templateId: result.templateId, name, slots: ["feet"], birth: false });
  game.command({ type: "design", templateId: null, name: name.slice(0, 22) + " 2", slots: ["strength"], birth: false });
  const copied = game.command({ type: "birth", agentId: result.agentId });
  const template = game.snapshot().templates.find(template => template.id === copied.templateId);
  assert.equal(template.name, name.slice(0, 22) + " 3");
  assert.deepEqual(template.slots, ["antenna"]);
});

test("포인트나 탄생 공간이 부족하면 새 설계와 ID도 남기지 않는다", () => {
  for (const reason of ["points", "space"]) {
    const { game, environment } = fixture();
    const source = game.agents[0];
    if (reason === "points") {
      const saved = JSON.parse(game.save());
      saved.state.evolutionPoints = 0;
      game.restore(JSON.stringify(saved));
    } else environment.world.terrain.fill(0);
    const birthState = () => {
      const { templates, nextTemplateId, nextAgentId, evolutionPoints, agents } = JSON.parse(game.save()).state;
      return { templates, nextTemplateId, nextAgentId, evolutionPoints, agents };
    };
    const before = birthState();
    assert.throws(() => game.command({ type: "birth", agentId: source.id }), reason === "points" ? /포인트가 부족/ : /둥지 주변이 가득/);
    assert.deepEqual(birthState(), before);
  }
});

test("설계 100개 한도에서는 신규 설계를 거부하고 같은 속성의 기존 설계는 재사용한다", () => {
  const { game } = fixture();
  const source = game.agents[0];
  const saved = JSON.parse(game.save());
  saved.state.templates = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: "설계 " + (index + 1),
    slots: ["feet"], attributeLevels: { feet: 1 }, revision: 1 }));
  saved.state.nextTemplateId = 101;
  game.restore(JSON.stringify(saved));
  const before = game.save();
  assert.throws(() => game.command({ type: "birth", agentId: source.id }), /최대 100개/);
  assert.equal(game.save(), before);
  saved.state.templates[99].slots = [...source.slots];
  saved.state.templates[99].attributeLevels = { ...source.attributeLevels };
  game.restore(JSON.stringify(saved));
  const copied = game.command({ type: "birth", agentId: source.id });
  assert.equal(copied.templateId, 100);
  assert.equal(game.snapshot().templates.length, 100);
  assert.equal(JSON.parse(game.save()).state.nextTemplateId, 101);
});

test("씨앗은 두 번 굴러 튄 뒤 점프하고 착지해야 새싹콩이 나온다", () => {
  for (let direction = 0; direction < 8; direction++) {
    const angle = direction * Math.PI / 4;
    const motion = time => agentBirthMotion(time, Math.cos(angle) * 3, Math.sin(angle) * 3);
    assert.equal(motion(.29).seedVisible, false);
    assert.equal(motion(.30).seedVisible, true);
    assert.ok(motion(.38).seedLift > motion(.30).seedLift + 1);
    assert.ok(motion(.50).seedLift > 2.3);
    assert.ok(motion(.38).progress < .09);
    assert.equal(motion(.72).seedLift, 0);
    assert.ok(motion(1).progress > motion(.72).progress);
    assert.ok(motion(1.42).progress > motion(1.18).progress);
    assert.ok(motion(2.12).seedLift > .6);
    assert.ok(motion(2.49).seedLift < .05);
    assert.equal(motion(2.53).seedLift, 0);
    assert.equal(motion(2.53).unitVisible, false);
    assert.equal(motion(2.60).unitVisible, true);
    assert.ok(motion(2.89).lift > .3);
    assert.ok(Math.abs(motion(2.89).rotation) < .04);
    assert.equal(motion(AGENT_BIRTH_DURATION), null);
  }
});

test("템플릿 생성만 씨앗 연출을 거치고 완전히 착지하기 전에는 이동하지 않는다", () => {
  const { game } = fixture();
  assert.equal(game.agents.length, 4);
  assert.ok(game.agents.every(agent => !agent.birth));
  const result = game.command({ type: "design", templateId: null, name: "발아 시험", slots: [], birth: true });
  const agent = game.agents.find(agent => agent.id === result.agentId);
  assert.equal(agent.mode, "birth");
  const position = { x: agent.x, y: agent.y };
  assert.equal(agent.birth.readyAt, AGENT_BIRTH_DURATION);
  for (let step = 1; step <= 38; step++) {
    game.prepare(step / 10);
    game.tick(.1);
    assert.deepEqual({ x: agent.x, y: agent.y }, position);
    assert.equal(agent.stepCount, 0);
    assert.equal(agent.moveBudget, 0);
  }
  game.prepare(3.9);
  game.tick(.1);
  assert.equal(agent.birth, null);
  assert.notEqual(agent.mode, "birth");
  assert.ok(agent.decisionCount > 0);
});

test("랜덤 방향의 빈 착지 칸을 고르고 공간이 없으면 비용을 차감하지 않는다", () => {
  const { game, environment, colony } = fixture();
  game.command({ type: "design", templateId: null, name: "분산 시험", slots: [], birth: false });
  const original = Math.random;
  const cells = new Set(game.agents.map(agent => agent.x + "," + agent.y));
  const quadrants = new Set();
  try {
    for (const value of [0, .15, .3, .45, .6, .75, .9, .99]) {
      Math.random = () => value;
      const result = game.command({ type: "birth", templateId: 1 });
      const agent = game.agents.find(agent => agent.id === result.agentId);
      const key = agent.x + "," + agent.y;
      assert.equal(cells.has(key), false);
      assert.equal(colony.occupiedCells.has((agent.x - colony.x) + "," + (agent.y - colony.y)), false);
      assert.equal(environment.world.terrain[agent.y * 320 + agent.x], 4);
      cells.add(key);
      quadrants.add(Math.sign(agent.x - 42) + "," + Math.sign(agent.y - 42));
    }
  } finally { Math.random = original; }
  assert.ok(quadrants.size >= 4);
  const points = game.snapshot().evolutionPoints;
  environment.world.terrain.fill(0);
  assert.throws(() => game.command({ type: "birth", templateId: 1 }), /둥지 주변이 가득/);
  assert.equal(game.snapshot().evolutionPoints, points);
});

test("발아 중 저장한 월드는 남은 연출과 대기 상태를 복원한다", () => {
  const { game } = fixture();
  const result = game.command({ type: "design", templateId: null, name: "복원 시험", slots: ["antenna"], birth: true });
  game.prepare(1.2);
  game.tick(.1);
  const original = game.agents.find(agent => agent.id === result.agentId);
  const saved = game.save();
  const restored = fixture().game;
  restored.restore(saved);
  const agent = restored.agents.find(candidate => candidate.id === result.agentId);
  assert.deepEqual(agent.birth, original.birth);
  assert.deepEqual(agent.slots, ["antenna"]);
  restored.prepare(2);
  restored.tick(.1);
  assert.equal(agent.stepCount, 0);
  assert.equal(agent.moveBudget, 0);
  restored.prepare(3.9);
  restored.tick(.1);
  assert.equal(agent.birth, null);
});
