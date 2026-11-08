import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { unitStats } from "./attributes.mjs";
import { createCombat } from "./combat.mjs";

function fixture() {
  const mask = ["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"];
  const colony = { id: 1, ownerId: "primary", tribe: "bean", x: 38, y: 38, occupiedCells: new Set(mask) };
  const environment = { simSeconds: 0, hostId: colony.ownerId, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(),
    creatureSystem: { agents: [], burrows: [] }, damageRandom: () => .5, combatRandom: () => .99,
    world: { size: 160, seed: 13, generationVersion: 15, terrain: new Uint8Array(25600).fill(4),
      hazards: new Uint8Array(25600), treeCells: new Uint8Array(25600), burrows: [] } };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.evolutionPoints = 5000;
  saved.state.nestLevel = 4;
  game.restore(JSON.stringify(saved));
  return { game, environment };
}

function design(game, name, primary) {
  return game.command({ type: "design", templateId: null, name, slots: ["blade", "piercing"], combatPrimary: primary, birth: true });
}

test("동일 슬롯의 다른 주력 설계는 저장과 탄생 및 개체 복제에서 구분된다", () => {
  const { game } = fixture();
  const blade = design(game, "칼날 주력", "blade"), piercing = design(game, "관통 주력", "piercing");
  const saved = JSON.parse(game.save()).state;
  assert.deepEqual(saved.templates.filter(template => [blade.templateId, piercing.templateId].includes(template.id)).map(template => template.combatPrimary), ["blade", "piercing"]);
  assert.equal(game.agents.find(agent => agent.id === blade.agentId).combatPrimary, "blade");
  assert.equal(game.agents.find(agent => agent.id === piercing.agentId).combatPrimary, "piercing");
  assert.equal(game.command({ type: "birth", agentId: piercing.agentId }).templateId, piercing.templateId);
  assert.equal(game.command({ type: "birth", agentId: blade.agentId }).templateId, blade.templateId);
});

test("주력 설계 편집은 기존 개체를 바꾸지 않고 다음 탄생에 적용된다", () => {
  const { game } = fixture(), original = design(game, "설계", "blade");
  game.command({ type: "design", templateId: original.templateId, name: "설계", slots: ["blade", "piercing"], combatPrimary: "piercing", birth: false });
  const next = game.command({ type: "birth", templateId: original.templateId });
  assert.equal(game.agents.find(agent => agent.id === original.agentId).combatPrimary, "blade");
  assert.equal(game.agents.find(agent => agent.id === next.agentId).combatPrimary, "piercing");
});

test("직렬화 복원은 설계와 출생 개체의 독립적인 주력을 보존한다", () => {
  const { game } = fixture(), original = design(game, "저장 설계", "piercing");
  game.command({ type: "design", templateId: original.templateId, name: "저장 설계", slots: ["blade", "piercing"], combatPrimary: "blade", birth: false });
  const saved = game.save();
  game.restore(saved);
  assert.equal(game.snapshot().templates.find(template => template.id === original.templateId).combatPrimary, "blade");
  assert.equal(game.agents.find(agent => agent.id === original.agentId).combatPrimary, "piercing");
});

test("옛 저장과 제거된 주력은 장착 속성으로 이행하고 옛 교환 예약은 취소한다", () => {
  const { game } = fixture(), original = design(game, "이행 설계", "piercing");
  const saved = JSON.parse(game.save()), template = saved.state.templates.find(value => value.id === original.templateId);
  const agent = saved.state.agents.find(value => value.id === original.agentId);
  delete template.combatPrimary;
  agent.slots = ["carapace"];
  agent.attributeLevels = { carapace: 1 };
  agent.attributes = { piercing: 1, carapace: 1 };
  agent.combat = { version: 1, pendingCounter: { exchange: { counterApplied: false } } };
  agent.attack = { exchange: { counterApplied: false }, targetId: "old-target" };
  game.restore(JSON.stringify(saved));
  const restored = game.agents.find(value => value.id === original.agentId);
  assert.equal(game.snapshot().templates.find(value => value.id === original.templateId).combatPrimary, "blade");
  assert.equal(restored.combatPrimary, "carapace");
  assert.equal(restored.combat, null);
  assert.equal(restored.attack, null);
});

test("새 전투 예약은 저장 복원 뒤 한 번 명중하고 같은 시각 재처리에도 중복되지 않는다", () => {
  const { game, environment } = fixture();
  const colony = { id: 2, ownerId: "enemy", tribe: "bean", x: 80, y: 80, occupiedCells: new Set(["2,2"]) };
  environment.colonies.push(colony);
  const enemy = createGame(environment, colony);
  environment.games.set(colony.ownerId, enemy);
  const source = game.agents[0], target = enemy.agents[0];
  // Use explicit legacy combatants; new starting workers have no attack gene.
  for (const agent of [source,target]) Object.assign(agent,{dna:null,attributes:{},stats:unitStats({},agent.tribe),health:100});
  for (const agent of [...game.agents, ...enemy.agents]) { agent.x = 10; agent.y = 10; }
  source.x = target.x = 60; source.y = target.y = 60;
  source.combatPrimary = target.combatPrimary = null;
  source.combatDisposition = target.combatDisposition = "aggressive";
  const combat = createCombat(environment);
  assert.equal(combat.engage(source, target, 0), true);
  for (let step = 0; step <= 400 && !source.attack; step++) combat.update(source, step / 20);
  const reserved = structuredClone(source.attack), nextAttackAt = source.combat.nextAttackAt;
  assert.ok(reserved && !reserved.resolved);
  const saved = game.save();
  game.restore(saved);
  const restored = game.agents.find(agent => agent.id === source.id);
  assert.deepEqual(restored.attack, reserved);
  assert.equal(restored.combat.nextAttackAt, nextAttackAt);
  const resumed = createCombat(environment), before = target.health;
  resumed.update(restored, reserved.hitAt);
  assert.ok(target.health < before);
  const after = target.health;
  resumed.update(restored, reserved.hitAt);
  assert.equal(target.health, after);
  game.restore(game.save());
  const completed = game.agents.find(agent => agent.id === source.id);
  createCombat(environment).update(completed, reserved.hitAt);
  assert.equal(target.health, after);
});
