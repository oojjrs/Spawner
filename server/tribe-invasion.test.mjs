import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createGame } from "./game.mjs";
import { createUtilityAI } from "./utility.mjs";
import { tribeProductionTemplate } from "./tribe-production.mjs";
import { TRIBE_INVASION, tribeDesign } from "./tribe-designs.mjs";
import { tribeCombatTemplates } from "./tribe-combat-templates.mjs";
import { tribeDefenseDesign } from "./tribe-defense-designs.mjs";
import { nestDefenderDesign } from "./nest-defender.mjs";
import { ATTRIBUTE_DNA } from "./dna.mjs";
import { dnaUnitStats, validateDna } from "./dna-unit.mjs";
import { birthCost } from "./attributes.mjs";
import { createSimulationTrial } from "../client/combat-simulation.mjs";

const runtime = readFileSync(new URL("../client/runtime.js", import.meta.url), "utf8");
const worker = JSON.parse(runtime.match(/const workerSource = ("[^\r\n]+");/)[1]);
const decision = JSON.parse(worker.match(/^globalThis.SpawnerDecisionWorkerSource = ("[^\n]+");/)[1]);
const surfaces = [["소스", { createGame, createUtilityAI, tribeProductionTemplate }]];
for (const [name, source, entry] of [["게임 워커", worker, "client/worker.mjs"], ["판단 워커", decision, "client/decision-worker.mjs"]]) {
  const context = { Map, Set, Uint8Array, setTimeout, clearTimeout, performance };
  runInNewContext(source.slice(0, source.indexOf('modules["' + entry + '"]')) +
    'globalThis.api = { ...modules["server/game.mjs"], ...modules["server/utility.mjs"], ...modules["server/tribe-production.mjs"] }; })();', context);
  surfaces.push([name, context.api]);
}

function stateFor(tribe, time) {
  const dna = tribeDesign(tribe, 4, -1), stats = dnaUnitStats(dna, tribe);
  return { simSeconds: time, nestLevel: 4, evolutionPoints: 2000, foodIncomeStartedAt: 0, templates: [],
    agents: Array.from({ length: 10 }, (_, index) => ({ id: "worker:" + index, tribe, dna, stats, health: stats.health,
      slots: [], productionRole: "worker", bornAt: time, lifespan: stats.lifespan })) };
}

function fixture(api, tribe) {
  const size = 48, colony = { id: 1, ownerId: "ai", tribe, name: tribe, x: 5, y: 20,
    occupiedCells: new Set(Array.from({ length: 25 }, (_, i) => i % 5 + "," + Math.floor(i / 5))) };
  const player = { ...colony, id: 2, ownerId: "human", x: 36 };
  const environment = { hostId: "human", simSeconds: 1200, world: { size, seed: 13,
    terrain: new Uint8Array(size * size).fill(4), hazards: new Uint8Array(size * size), treeCells: new Uint8Array(size * size) },
    colonies: [colony, player], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = api.createGame(environment, colony);
  environment.games.set("ai", game);
  const nest = { id: "nest:2", colonyId: 2, kind: "nest", x: 36, y: 20, width: 5, height: 5, health: 800 };
  environment.games.set("human", { agents: [], nest, isVisible() { return false; },
    receiveNestDamage(amount) { nest.health = Math.max(0, nest.health - amount); } });
  return { game, environment, colony, nest };
}

function change(game, update) {
  const saved = JSON.parse(game.save());
  update(saved.state);
  game.restore(JSON.stringify(saved));
}

function addWorkers(state, tribe, count) {
  const source = state.agents[0], ready = stateFor(tribe, state.simSeconds);
  state.agents.push(...ready.agents.slice(0, count).map((agent, i) => ({ ...source, ...agent,
    id: "ready-worker:" + i, x: 2 + i % 5, y: 16 + Math.floor(i / 5),
    lifespanStartedAt: state.simSeconds, birth: null, utility: null })));
}

function addGarrison(state, tribe) {
  state.agents.push(...Array.from({ length: 3 }, (_, i) => ({ id: "defender:" + i,
    dna: tribeDefenseDesign(tribe, 3, i), productionRole: "military", health: 100,
    bornAt: state.simSeconds, lifespan: 300 })));
}

for (const [surface, api] of surfaces) {
  test(surface + " · 저레벨에는 최소 방어만 만들고 경제가 준비된 4레벨은 시간 대기 없이 종족 편성을 따른다", () => {
    for (const tribe of Object.keys(TRIBE_INVASION)) {
      const designs = tribeCombatTemplates(tribe), state = stateFor(tribe, 3600);
      for (const level of [1, 2, 3]) {
        Object.assign(state, stateFor(tribe, 3600));
        state.nestLevel = level;
        for (const agent of state.agents) {
          agent.dna = tribeDesign(tribe, level, -1);
          agent.stats = dnaUnitStats(agent.dna, tribe);
          agent.health = agent.stats.health;
        }
        for (let i = 0; i < [0, 1, 1][level - 1]; i++) {
          const defender = api.tribeProductionTemplate(state, tribe);
          assert.equal(defender.productionRole, "military");
          assert.equal(JSON.stringify(defender.dna.pieces), JSON.stringify((level === 2 ? nestDefenderDesign(tribe).design : tribeDefenseDesign(tribe, level, i)).pieces));
          state.agents.push({ ...defender, health: 100, bornAt: 3600, lifespan: 300 });
        }
        assert.equal(api.tribeProductionTemplate(state, tribe), null);
      }
      Object.assign(state, stateFor(tribe, 60));
      addGarrison(state, tribe);
      const variants = designs.map(design => JSON.stringify(design.dna.pieces));
      const counts = designs.map(() => 0);
      for (let i = 0; i < designs.reduce((sum, design) => sum + design.weight, 0); i++) {
        const template = api.tribeProductionTemplate(state, tribe);
        assert.equal(template.productionRole, "military");
        const variant = variants.indexOf(JSON.stringify(template.dna.pieces));
        assert.ok(variant >= 0);
        counts[variant]++;
        state.agents.push({ ...template, id: "military:" + i, health: 100, bornAt: state.simSeconds, lifespan: 540 });
      }
      assert.deepEqual(counts, designs.map(design => design.weight));
      state.agents[0].bornAt = state.simSeconds - state.agents[0].lifespan + 30;
      const replacement = api.tribeProductionTemplate(state, tribe);
      assert.equal(replacement.productionRole, "worker");
      const stats = dnaUnitStats(replacement.dna, tribe);
      assert.equal(replacement.dna.level, 4);
      assert.ok(stats.capacity >= 10 && stats.dna.harvestReduction >= 80 && stats.speed >= .7);
      assert.equal(stats.dna.melee || stats.dna.ranged || stats.dna.hunting, false);
      state.evolutionPoints = birthCost(replacement, tribe) - 1;
      assert.equal(api.tribeProductionTemplate(state, tribe), null);
    }
  });

  test(surface + " · AI 군사 DNA는 비용·탄생·저장을 유지하고 플레이어에게 자동 적용되지 않는다", () => {
    for (const tribe of Object.keys(TRIBE_INVASION)) {
      const f = fixture(api, tribe);
      change(f.game, state => {
        const source = state.agents[0], ready = stateFor(tribe, 1200);
        Object.assign(state, ready);
        state.agents = ready.agents.map((agent, i) => ({ ...source, ...agent, id: "1:" + (i + 1), birth: null }));
        state.nextAgentId = 11;
      });
      const id = f.game.produce(), soldier = f.game.agents.find(agent => agent.id === id);
      assert.ok(soldier?.dna && soldier.birth);
      assert.equal(soldier.productionRole, "military");
      assert.equal(f.game.snapshot().evolutionPoints, 2000 - birthCost(soldier, tribe));
      const restored = api.createGame(f.environment, f.colony, f.game.save());
      assert.equal(JSON.stringify(restored.agents.find(agent => agent.id === id).dna), JSON.stringify(soldier.dna));
      f.environment.hostId = "ai";
      f.game.prepare(1210);
      const before = f.game.agents.length;
      assert.equal(f.game.produce(), null);
      assert.equal(f.game.agents.length, before);
    }
  });

  test(surface + " · 최소 방어를 갖추면 추가 군비보다 둥지 성장에 포인트를 쓴다", () => {
    const f = fixture(api, "bean");
    change(f.game, state => {
      state.nestLevel = 2;
      state.simSeconds = 60;
      state.evolutionPoints = 500;
      const source = state.agents[0];
      state.agents = Array.from({ length: 6 }, (_, i) => ({ ...source, id: "1:" + (i + 1),
        dna: tribeDesign("bean", 2, -1), birth: null }));
      state.nextAgentId = 7;
    });
    assert.ok(f.game.produce());
    assert.equal(f.game.nestLevel, 2);
    f.game.prepare(63);
    assert.equal(f.game.produce(), null);
    assert.equal(f.game.nestLevel, 3);
    assert.equal(f.game.agents.filter(agent => agent.productionRole === "military").length, 1);
    assert.equal(f.game.snapshot().evolutionPoints, 312);
  });

  test(surface + " · 약한 일꾼 열 기는 원정 준비로 세지 않고 강화 일꾼을 보충한다", () => {
    const state = stateFor("bean", 1200);
    for (const agent of state.agents) {
      agent.dna = tribeDesign("bean", 1, -1);
      agent.stats = dnaUnitStats(agent.dna, "bean");
      agent.health = agent.stats.health;
    }
    addGarrison(state, "bean");
    for (let i = 0; i < 2; i++) {
      const template = api.tribeProductionTemplate(state, "bean");
      assert.equal(template.productionRole, "worker");
      assert.equal(template.dna.level, 4);
      state.agents.push({ ...template, health: 70, bornAt: 1200, lifespan: 540 });
    }
    assert.equal(api.tribeProductionTemplate(state, "bean"), null);
  });

  test(surface + " · 저레벨 방어병은 둥지 근처 위협에 대응하고 멀리 있는 적을 사냥하지 않는다", () => {
    const f = fixture(api, "bean");
    change(f.game, state => {
      state.nestLevel = 2;
      state.simSeconds = 1200;
      state.agents = [{ ...state.agents[0], dna: tribeDefenseDesign("bean", 2, 0), productionRole: "military",
        x: 11, y: 22, bornAt: 1200, lifespanStartedAt: 1200, birth: null, utility: null }];
    });
    const enemy = { ...f.game.agents[0], id: "human:1", ownerId: "human", x: 13, y: 22, attack: null };
    f.environment.games.get("human").agents.push(enemy);
    f.game.agents[0].moveBudget = 1;
    f.game.prepare(1200.1);
    f.game.tick(.1);
    assert.equal(f.game.agents[0].utility?.action, "fight");
    assert.equal(f.game.agents[0].utility?.defending, true);
    change(f.game, state => { Object.assign(state.agents[0], { x: 24, y: 22, utility: null }); });
    enemy.x = 26;
    f.game.prepare(1201);
    f.game.tick(.1);
    assert.notEqual(f.game.agents[0].utility?.action, "fight");
    assert.notEqual(f.game.agents[0].utility?.action, "explore");
  });

  test(surface + " · 공격대는 안개를 밝히며 플레이어 둥지 쪽으로 실제 이동한다", () => {
    for (const tribe of Object.keys(TRIBE_INVASION)) {
      const f = fixture(api, tribe);
      change(f.game, state => {
        state.nestLevel = 4;
        state.simSeconds = 1200;
        state.agents = [{ ...state.agents[0], dna: tribeDesign(tribe, 4, 0), productionRole: "military",
          x: 11, y: 22, renderFromX: 11, renderFromY: 22, bornAt: 1200, birth: null, utility: null }];
        addWorkers(state, tribe, 8);
      });
      const soldier = f.game.agents[0];
      soldier.moveBudget = 1;
      f.game.prepare(1200.1);
      f.game.tick(.1);
      assert.equal(soldier.utility.action, "explore");
      assert.ok(soldier.utility.target.x > 11);
      assert.ok(soldier.x > 11);
      assert.ok(!f.game.snapshot().visible.includes(22 * 48 + 36));
      f.environment.hostId = "ai";
      const plans = f.game.planDecisions([{ id: soldier.id, reason: "periodic" }])[0];
      assert.ok(plans.every(plan => !plan.invading));
    }
  });

  test(surface + " · 4레벨 성장만으로 출정하지 않고 강한 일꾼을 갖춘 뒤에도 이전 저레벨 군사는 방어한다", () => {
    const f = fixture(api, "bean");
    change(f.game, state => {
      state.nestLevel = 3;
      state.simSeconds = 3600;
      state.evolutionPoints = 1000;
      state.agents = [{ ...state.agents[0], dna: tribeDesign("bean", 3, 0), productionRole: "military",
        x: 11, y: 22, bornAt: 3600, lifespanStartedAt: 3600, birth: null, utility: null }];
    });
    const soldier = f.game.agents[0];
    soldier.moveBudget = 1;
    f.game.prepare(3600.1);
    f.game.tick(.1);
    assert.equal(soldier.x, 11);
    assert.ok(f.game.planDecisions([{ id: soldier.id, reason: "periodic" }])[0].every(plan =>
      plan.action !== "explore" && (plan.action !== "fight" || plan.defending)));
    f.game.command({ type: "upgrade" });
    assert.equal(f.game.nestLevel, 4);
    assert.ok(f.game.planDecisions([{ id: soldier.id, reason: "periodic" }])[0].every(plan => !plan.invading));
    change(f.game, state => {
      addWorkers(state, "bean", 8);
      state.agents.push({ ...state.agents[0], id: "new-soldier", dna: tribeCombatTemplates("bean")[0].dna,
        birth: null, utility: null });
    });
    const plans = f.game.planDecisions([{ id: soldier.id, reason: "periodic" }, { id: "new-soldier", reason: "periodic" }]);
    assert.ok(plans[0].every(plan => !plan.invading));
    assert.equal(plans[1][0].invading, true);
    change(f.game, state => { state.agents.find(agent => agent.id === "ready-worker:0").health = 1; });
    assert.ok(f.game.planDecisions([{ id: "new-soldier", reason: "periodic" }])[0].every(plan => !plan.invading));
  });

  test(surface + " · 복구 중에는 저가 채집 DNA를 만들고 군사 비용과 일꾼 예비금을 지킨다", () => {
    const state = stateFor("bean", 1200);
    state.evolutionPoints = 11;
    state.agents = [];
    const recovery = api.tribeProductionTemplate(state, "bean");
    assert.ok(recovery.dna.pieces.some(piece => piece.gene === "gather"));
    assert.equal(birthCost(recovery, "bean"), 11);
    state.evolutionPoints = 10;
    assert.equal(api.tribeProductionTemplate(state, "bean"), null);
    state.agents = stateFor("bean", 1200).agents;
    addGarrison(state, "bean");
    state.evolutionPoints = 2000;
    const soldier = api.tribeProductionTemplate(state, "bean");
    state.evolutionPoints = birthCost(soldier, "bean") + birthCost({ dna: tribeDesign("bean", 4, -1) }, "bean") - 1;
    assert.equal(api.tribeProductionTemplate(state, "bean"), null);
  });

  test(surface + " · 안테나 정찰만 남은 AI는 둥지 성장보다 일꾼 복구를 먼저 한다", () => {
    const f = fixture(api, "bean");
    change(f.game, state => {
      state.nestLevel = 2;
      state.evolutionPoints = 100;
      state.agents = [{ ...state.agents[0], birth: null, dna: { version: 6, level: 2, budget: 100,
        pieces: [{ gene: "antenna", grade: 2, rotation: 0, q: 0, r: 0 }] } }];
    });
    const id = f.game.produce();
    assert.ok(f.game.agents.find(agent => agent.id === id)?.stats.dna.harvest > 0);
    assert.equal(f.game.nestLevel, 2);
  });
}

test("정상 가격의 2레벨 두 기와 3레벨 세 기 방어 편성이 해당 단계 중립 습격을 막는다", () => {
  for (const tribe of Object.keys(TRIBE_INVASION)) for (const level of [2, 3]) {
    const army = Array.from({ length: level }, (_, i) => ({ key: tribe, dna: tribeDefenseDesign(tribe, level, i) }));
    for (const unit of army) {
      assert.ok(validateDna(unit.dna, level, 1000));
      assert.ok(birthCost(unit, tribe) <= (level === 2 ? 68 : 91));
    }
    const trial = createSimulationTrial({ left: army,
      right: { key: level === 2 ? "soil-mole" : "spiny-back-beetle" }, random: false });
    while (!trial.reason && trial.time < 120) trial.advance(.1);
    assert.equal(trial.result().winner, "left", tribe + ":" + level);
  }
});

for (const [surface, api] of surfaces) test(surface + " · 네 종족의 원거리 공격대가 미탐색 경로를 지나 플레이어 둥지에 실제 피해를 준다", () => {
  for (const tribe of Object.keys(TRIBE_INVASION)) {
    const f = fixture(api, tribe);
    change(f.game, state => {
      state.nestLevel = 4;
      state.simSeconds = 1200;
      state.evolutionPoints = 1000;
      state.agents = [{ ...state.agents[0], dna: tribeCombatTemplates(tribe).find(design => design.template === "marksman").dna, productionRole: "military",
        x: 11, y: 22, renderFromX: 11, renderFromY: 22, bornAt: 1200, birth: null, utility: null }];
      addWorkers(state, tribe, 8);
    });
    for (let elapsed = .5; elapsed <= 180 && f.nest.health === 800; elapsed += .5) {
      f.environment.simSeconds = 1200 + elapsed;
      f.game.prepare(f.environment.simSeconds);
      f.game.tick(.5);
    }
    const soldier = f.game.agents[0];
    assert.ok(f.nest.health < 800, tribe + ": " + JSON.stringify({ time: f.game.snapshot().simSeconds,
      ending: f.game.snapshot().ending, x: soldier?.x, y: soldier?.y, budget: soldier?.moveBudget,
      started: soldier?.moveStartedAt, duration: soldier?.moveDuration, health: soldier?.health, plan: soldier?.utility }));
  }
});

test("정상 DNA의 집중 투자 전사는 더 비싼 저가 전사 4기를 이긴다", () => {
  const make = genes => ({ version: 6, level: 4, budget: 1000, pieces: ATTRIBUTE_DNA.pack(genes.map(gene =>
    ({ gene, grade: ATTRIBUTE_DNA.lookup.get(gene).grade, rotation: 0 })), 4) });
  const cheap = make(["blade", "power", "health"]);
  const elite = make(["blade", "power", "power", "power", "health", "health", "health", "health", "health",
    "carapace", "speed", "speed", "combo", "area"]);
  assert.ok(birthCost({ dna: elite }, "bean") <= birthCost({ dna: cheap }, "bean") * 4);
  for (const tribe of Object.keys(TRIBE_INVASION)) {
    const trial = createSimulationTrial({ left: { key: tribe, dna: elite },
      right: Array.from({ length: 4 }, () => ({ key: tribe, dna: cheap })), random: false });
    while (!trial.reason && trial.time < 120) trial.advance(.1);
    assert.equal(trial.result().winner, "left", tribe);
  }
});
