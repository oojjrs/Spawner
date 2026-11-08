import test from "node:test";
import assert from "node:assert/strict";
import { createBeetleRaids } from "./raids.mjs";
import { colonyRaidReadiness } from "./raid-pressure.mjs";
import { tribeDefenseDesign } from "./tribe-defense-designs.mjs";
import { createSimulationTrial } from "../client/combat-simulation.mjs";

function fixture(level, workers, defenders) {
  const colony = { id:1, ownerId:"owner", tribe:"bean", x:8, y:8, occupiedCells:new Set(["2,2"]) };
  const game = { nestLevel:level, colonyFood:100, nest:{ health:400, maxHealth:400 }, agents:[
    ...Array.from({ length:workers }, (_, index) => ({ id:"worker:" + index, health:100, x:12, y:10,
      stats:{ health:100, capacity:4 }, slots:["strength"], productionRole:"worker", cost:100 })),
    ...Array.from({ length:defenders }, (_, index) => ({ id:"defender:" + index, health:100, x:12, y:10,
      stats:{ health:100, capacity:0 }, slots:["blade"], productionRole:"military", cost:100 }))
  ] };
  const environment = { simSeconds:0, hostId:"owner", colonies:[colony], games:new Map([["owner", game]]),
    world:{ size:40, sites:[[10,10]], burrows:[{ id:"home", type:"large", x:30, y:10, entrance:{ x:31, y:11 } }] } };
  const state = { burrows:[{ id:"home", health:60 }], agents:Array.from({ length:8 }, (_, index) =>
    ({ id:"raider:" + index, burrowId:"home", health:100, x:31, y:11, moveStartedAt:0, moveDuration:0, mode:"idle" })) };
  const actions = { stepSeconds:1, noise:() => 0, reinforce:() => {}, occupied:() => false, idle:() => {}, move:() => {},
    walkable:(x, y) => x >= 0 && y >= 0 && x < 40 && y < 40 };
  const raids = createBeetleRaids(environment, state, actions, false);
  const dispatch = (time, income) => { environment.simSeconds = time; game.colonyFood += income; raids.dispatch(); };
  return { colony, game, environment, state, actions, raids, dispatch };
}

test("자연 습격은 시간만으로 강해지지 않고 현재 둥지·일꾼·근처 방어 기반을 요구한다", () => {
  for (const [level, workers, defenders, time, species] of [[2,10,8,3600,"soil-mole"], [3,6,3,900,"spiny-back-beetle"],
    [4,8,5,1799,"spiny-back-beetle"], [4,8,5,1800,"soil-boar"], [4,8,3,3600,"spiny-back-beetle"]]) {
    const f = fixture(level, workers, defenders);
    f.dispatch(time, 1);
    const raider = f.state.agents.find(agent => agent.raid);
    assert.equal(raider.species, species);
    assert.equal(raider.raid.departedAt, time);
    assert.equal(raider.raidCombatScale, undefined);
  }
  const f = fixture(4, 8, 5);
  for (const agent of f.game.agents.filter(agent => agent.productionRole === "military")) agent.x = 35;
  assert.equal(colonyRaidReadiness(f.game, f.colony, 1800, 1800).stage, 0);
  const growing = fixture(3, 6, 3);
  for (const agent of growing.game.agents.filter(agent => agent.productionRole === "military")) agent.cost = 76;
  assert.equal(colonyRaidReadiness(growing.game, growing.colony, 900, 900).stage, 0);
});

test("피해 군락은 이동 중 습격까지 1기로 제한하며 격퇴 뒤 회복 시간을 다시 확보한다", () => {
  const f = fixture(3, 6, 3);
  f.dispatch(900, 1);
  const raider = f.state.agents.find(agent => agent.raid);
  f.state.raidCooldowns[0].nextRaidAt = 0;
  f.dispatch(905, 1);
  assert.equal(f.state.agents.filter(agent => agent.health > 0 && agent.raid).length, 1);
  f.game.nest.health = 100;
  f.dispatch(910, 1);
  assert.ok(f.state.raidCooldowns[0].nextRaidAt >= 1090);
  raider.health = 0;
  f.dispatch(1000, 1);
  assert.equal(f.state.raidCooldowns[0].nextRaidAt, 1180);
  f.dispatch(1179, 1);
  assert.equal(f.state.agents.filter(agent => agent.health > 0 && agent.raid).length, 0);
  f.dispatch(1180, 1);
  const next = f.state.agents.find(agent => agent.health > 0 && agent.raid);
  assert.equal(next.species, "soil-mole");
  assert.equal(next.raid.departedAt, 1180);
});

test("수입이 끊기거나 일꾼이 줄면 플레이어와 AI 모두 회복 유예를 받되 습격 면역은 없다", () => {
  for (const owner of ["owner", "player"]) for (const interruption of ["income", "workers"]) {
    const f = fixture(4, 8, 5);
    f.environment.hostId = owner;
    f.dispatch(0, 0);
    f.state.raidCooldowns[0].nextRaidAt = 900;
    if (interruption === "workers") f.game.agents = f.game.agents.filter(agent => agent.productionRole === "military");
    f.dispatch(900, interruption === "income" ? 0 : 1);
    assert.equal(f.state.agents.filter(agent => agent.raid).length, 0, interruption + ":" + JSON.stringify(f.state.raidCooldowns[0]));
    assert.equal(f.state.raidCooldowns[0].nextRaidAt, 1080);
    f.dispatch(1080, 0);
    assert.equal(f.state.agents.filter(agent => agent.raid).length, 1);
    assert.equal(f.state.agents.find(agent => agent.raid).species, "soil-mole");
    f.dispatch(1800, 0);
    assert.equal(f.state.agents.filter(agent => agent.raid).length, 1);
  }
});

test("회복 대기·수입 관측은 저장 복원 후 유지하며 기존 습격을 지우지 않는다", () => {
  const f = fixture(3, 6, 3);
  f.dispatch(900, 1);
  f.game.nest.health = 100;
  f.dispatch(910, 1);
  const saved = structuredClone(f.state), cooldown = structuredClone(saved.raidCooldowns[0]);
  const restored = createBeetleRaids(f.environment, saved, f.actions, true);
  f.environment.simSeconds = 1000;
  restored.dispatch();
  assert.equal(saved.raidCooldowns[0].nextRaidAt, cooldown.nextRaidAt);
  assert.equal(saved.raidCooldowns[0].lastFoodAt, cooldown.lastFoodAt);
  assert.equal(saved.agents.filter(agent => agent.raid).length, 1);
  for (const [key, value] of [["lastFoodAt", -1], ["lastFood", NaN], ["hadRaid", 1], ["recovering", "yes"]]) {
    const invalid = structuredClone(saved);
    invalid.raidCooldowns[0][key] = value;
    assert.throws(() => createBeetleRaids(f.environment, invalid, f.actions, true));
  }
});

test("최소 방어 편성은 첫 두더지와 성장 후 가시등벌레를 종족별 정규 능력치로 막는다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const [level, count, species] of [[2,2,"soil-mole"], [3,3,"spiny-back-beetle"]]) {
    const trial = createSimulationTrial({ left:Array.from({ length:count }, (_, index) =>
      ({ key:tribe, dna:tribeDefenseDesign(tribe, level, index) })), right:{ key:species }, random:false });
    while (!trial.reason && trial.time < 120) trial.advance(.1);
    assert.equal(trial.result().winner, "left", tribe + ":" + level);
  }
});
