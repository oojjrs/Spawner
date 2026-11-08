import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";
import { createCombat } from "./combat.mjs";
import { DNA_STARTER_DESIGNS } from "../client/dna-starter-designs.mjs";

test("실제 군락 유닛의 치명타 사망이 전투 참조를 해제해도 타격과 다음 갱신을 완료한다", () => {
  const events = [], actors = [];
  const room = { simSeconds: 0, hostId: "a", combatSimulation: true,
    combatRandom: () => .99, damageRandom: () => .5, onCombatEvent: event => events.push(event),
    world: { size: 80, seed: 13, generationVersion: 38, terrain: new Uint8Array(6400).fill(4), hazards: new Uint8Array(6400) },
    colonies: [], games: new Map(), food: new Map(), foodSpots: new Map(), creatureSystem: { agents: [] } };
  for (const [index, owner] of ["a", "b"].entries()) {
    const colony = { id: index + 1, ownerId: owner, tribe: "bean", x: 20 + index * 30, y: 20, occupiedCells: new Set(["2,2"]) };
    room.colonies.push(colony);
    const game = createGame(room, colony); room.games.set(owner, game);
    const saved = JSON.parse(game.save());
    saved.state.agents = saved.state.agents.slice(0, 1);
    saved.state.nestLevel = 2; saved.state.evolutionPoints = 200;
    const agent = saved.state.agents[0];
    agent.dna = structuredClone(DNA_STARTER_DESIGNS.find(entry => entry.id === (index ? "gatherer" : "melee")).design);
    agent.x = agent.renderFromX = agent.y = agent.renderFromY = 45;
    agent.birth = null; agent.utility = null; agent.moveDuration = 0;
    game.restore(JSON.stringify(saved));
    actors.push(game.agents[0]);
  }
  const [attacker, defender] = actors;
  defender.health = .01; defender.stats.dna.regeneration = 0;
  const combat = createCombat(room);
  assert.equal(combat.engage(attacker, defender, 0), true);
  for (let step = 0; step < 160 && defender.health > 0; step++) {
    room.simSeconds = step / 10;
    for (const game of room.games.values()) game.prepare(room.simSeconds);
    combat.update(attacker, room.simSeconds);
  }
  assert.equal(defender.health, 0);
  assert.equal(defender.combat, null);
  assert.equal(room.games.get("b").agents.length, 0);
  assert.equal(events.filter(event => event.kind === "death" && event.targetId === defender.id).length, 1);
  assert.equal([...room.food.values()].filter(cell => cell.kind === "corpse" && cell.agentId === defender.id).length, 1);
  room.simSeconds += .1;
  combat.update(attacker, room.simSeconds);
  assert.equal(attacker.combat, null);
});
