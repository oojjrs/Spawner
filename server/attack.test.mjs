import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { unitStats } from "./attributes.mjs";
import { combatDamage } from "./combat-stats.mjs";
import { AGENT_ATTACK_DURATION, AGENT_ATTACK_HIT_TIME, agentAttackFrame } from "./attack.mjs";

function fixture(speed) {
  const colony = { id: 1, ownerId: "attack-test", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map(), damageRandom: () => .5 };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  const agent = game.agents[0];
  Object.assign(agent, { dna: null, attributes: {}, stats: unitStats({}, agent.tribe), health: 100 });
  const target = { id: "rival:1", x: 48, y: 42, health: 100, cost: 3, carrying: 0, attributes: {},
    stats: { health: 100, attack: 1, speed: 1, vision: 3 }, moveStartedAt: 0, moveDuration: 0 };
  const hits = [];
  environment.games.set("rival", { agents: [target], receiveDamage(victim, damage) { hits.push(damage); victim.health -= damage; } });
  Object.assign(agent, { x: 48, y: 42, moveStartedAt: 0, moveDuration: 0, moveBudget: 0,
    mode: "fight", decisionPending: null, nextDecisionAt: 100, knownEnemyIds: new Set([target.id]),
    utility: { action: "fight", target: { id: target.id, key: target.id, x: target.x, y: target.y }, route: [] } });
  agent.combatDisposition = "aggressive";
  agent.stats.speed = speed;
  game.prepare(10);
  game.tick(.01);
  for (let step = 1; step <= 400 && !agent.attack; step++) { game.prepare(10 + step / 20); game.tick(.05); }
  assert.ok(agent.attack, "attack starts within 20 seconds of approach");
  return { game, environment, agent, target, hits, hitAt: agent.attack.hitAt, damage: combatDamage(agent, target, .5) };
}

test("6번째 프레임에 명중하고 충돌 자세 여섯 프레임을 유지한다", () => {
  assert.ok(Math.abs(AGENT_ATTACK_DURATION - 1) < 1e-8);
  assert.ok(Math.abs(AGENT_ATTACK_HIT_TIME - .3) < 1e-8);
  const attack = { startedAt: 10, speed: 1 };
  assert.equal(agentAttackFrame(attack, 10.299), 4);
  assert.equal(agentAttackFrame(attack, 10.3), 5);
  assert.equal(agentAttackFrame(attack, 10.599), 10);
  assert.equal(agentAttackFrame(attack, 10.6), 11);
  assert.equal(agentAttackFrame(attack, 11), -1);
});

test("같은 셀에 고정한 대상에게 6번째 프레임에 한 번 피해를 준다", () => {
  const { game, agent, target, hits, hitAt, damage } = fixture(1);
  assert.ok(agent.attack);
  assert.equal(target.health, 100);
  game.prepare(hitAt - .001);
  game.tick(.299);
  assert.equal(target.health, 100);
  game.prepare(hitAt);
  game.tick(.001);
  assert.equal(target.health, 100 - damage);
  assert.equal(agent.attack.hit, true);
  assert.equal(agent.attack.targetX, 48);
  assert.equal(agent.attack.targetY, 42);
  assert.deepEqual({ x: agent.x, y: agent.y }, { x: 48, y: 42 });
  game.prepare(hitAt + .1);
  game.tick(.299);
  assert.equal(target.health, 100 - damage);
  assert.deepEqual(hits, [damage]);
});

test("빠른 유닛도 공격 모션의 명중 시점을 유지하고 복원 후 중복 명중하지 않는다", () => {
  const { game, target, hits, hitAt, damage } = fixture(2);
  const pending = JSON.parse(game.save()).state.agents[0].attack;
  assert.ok(pending.hitAt > pending.startedAt);
  assert.equal(pending.hitAt, hitAt);
  assert.equal(agentAttackFrame(pending, hitAt), 5);
  game.prepare(pending.startedAt + .1);
  game.tick(.1);
  game.restore(game.save());
  game.prepare(hitAt);
  game.tick(.05);
  assert.equal(target.health, 100 - damage);
  game.restore(game.save());
  game.prepare(hitAt + .1);
  game.tick(.05);
  assert.deepEqual(hits, [damage]);
});

test("정해 둔 대상이 사라져도 다른 대상에게 피해를 넘기지 않는다", () => {
  const { game, environment, target, hits, hitAt } = fixture(1);
  const other = { ...target, id: "rival:2" };
  environment.games.get("rival").agents = [other];
  game.prepare(hitAt);
  game.tick(.3);
  assert.equal(other.health, 100);
  assert.ok(!game.agents[0].attack || game.agents[0].attack.resolved);
  assert.ok(!game.agents[0].attack?.hit);
  assert.deepEqual(hits, []);
});
