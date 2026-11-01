import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTES, ATTRIBUTE_COMBINATIONS, attributeCounts, hasSynergy, unitStats, unitMovementSpeed } from "./attributes.mjs";
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
  for (const tribe of ["bean", "spore", "pebble", "spring"]) assert.equal(unitStats(attributeCounts([]), tribe).capacity, 1, tribe);
  assert.equal(unitStats(attributeCounts(["strength"])).capacity, 2);
  assert.equal(unitStats(attributeCounts(["strength", "strength"])).capacity, 2);
  assert.equal(unitStats(attributeCounts(["strength"], { strength: 2 })).capacity, 2);
  assert.equal(unitStats(attributeCounts(["antenna"])).vision, 6);
  assert.equal(unitStats(attributeCounts([])).lifespan, 120);
  assert.equal(unitStats(attributeCounts(["lifespan"])).lifespan, 240);
  assert.equal(unitMovementSpeed(unitStats(attributeCounts(["feet"]))), .8);
});

test("부족별 시작 인원과 실제 장착 속성이 채집 방식에 따라 다르다", () => {
  const starts = { bean:[["antenna"], ["strength"], [], []], spore:[["strength"], ["blade"], [], []],
    pebble:[["strength"], ["strength"], ["antenna"]], spring:[["feet"], ["feet"], ["antenna"]] };
  for (const [tribe, slots] of Object.entries(starts)) {
    const game = fixture(tribe);
    assert.deepEqual(game.agents.map(agent => agent.slots), slots);
    assert.equal(game.nestLevel, 1);
    assert.equal(new Set(game.agents.map(agent => agent.x + "," + agent.y)).size, slots.length);
    for (const agent of game.agents) assert.deepEqual(agent.appearanceAttributes, agent.attributes);
    const saved = game.save(), ids = game.agents.map(agent => agent.id);
    game.restore(saved);
    assert.deepEqual(game.agents.map(agent => agent.id), ids);
    assert.deepEqual(game.agents.map(agent => agent.slots), slots);
  }
  assert.deepEqual(fixture("pebble").agents.map(agent => agent.stats.capacity), [2, 2, 1]);
  assert.ok(fixture("spring").agents.slice(0, 2).every(agent => unitMovementSpeed(agent.stats) === 1.2));
  assert.equal(fixture("spore").agents[1].stats.lifespan, 120);
  assert.ok(fixture("pebble").agents.every(agent => agent.lifespan === 120));
});

test("1레벨에서 속성 없이 또는 하나만 넣어 생성하고 두 개는 거부한다", () => {
  const game = fixture("bean");
  for (const slots of [[], ["excavation"]]) {
    const result = game.command({ type: "design", templateId: null, name: "속성 " + slots.length, slots, birth: true });
    assert.ok(result.agentId);
    assert.deepEqual(game.agents.find(agent => agent.id === result.agentId).slots, slots);
    assert.ok(game.command({ type: "birth", templateId: result.templateId }).agentId);
  }
  assert.throws(() => game.command({ type: "design", templateId: null, name: "초과", slots: ["antenna", "strength"], birth: true }), /설계 속성/);
});

test("네 종족의 2분 수명은 복제에 계승되고 이전 저장의 나이를 보존하며 한 번만 보정한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const game = fixture(tribe);
    const childId = game.command({type:"birth",agentId:game.agents[0].id}).agentId;
    assert.equal(game.agents.find(agent=>agent.id===childId).lifespan, 120);
    const saved = JSON.parse(game.save());
    const legacy = saved.state.agents[0];
    legacy.bornAt = 0;
    saved.state.simSeconds = 30;
    for (const lifespan of [60, 120, 180, 240, 300, 330, 360, 480]) {
      legacy.lifespan = lifespan; legacy.stats.lifespan = lifespan;
      game.restore(JSON.stringify(saved));
      assert.equal(game.agents[0].bornAt, 0);
      assert.equal(game.agents[0].lifespan, 120);
      game.restore(game.save());
      assert.equal(game.agents[0].lifespan, 120);
    }
  }
});

test("수명 속성은 출생부터 4분을 적용하고 기본 수명 경계에서도 살아 있다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "장수", slots: ["lifespan"], birth: true });
  assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 240);
  for (const time of [120, 180, 239.999]) {
    game.prepare(time);
    game.tick(0);
    assert.ok(game.agents.some(agent => agent.id === result.agentId));
  }
  game.prepare(240);
  game.tick(0);
  assert.equal(game.agents.some(agent => agent.id === result.agentId), false);
});

test("두 번째 슬롯의 수명도 즉시 적용하고 이전 저장 복원과 성장 때 중복되지 않는다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 2;
  game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "성장 수명", slots: ["strength", "lifespan"], birth: true });
  assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 240);
  const legacy = JSON.parse(game.save());
  const agent = legacy.state.agents.find(agent => agent.id === result.agentId);
  agent.activeSlots = ["strength"];
  agent.attributes = attributeCounts(agent.activeSlots);
  agent.appearanceAttributes = { ...agent.attributes };
  agent.stats = unitStats(agent.attributes);
  agent.lifespan = 180; agent.stats.lifespan = 180;
  game.restore(JSON.stringify(legacy));
  assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 240);
  for (const time of [35, 60]) {
    game.prepare(time);
    game.tick(0);
    assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 240);
    game.restore(game.save());
    assert.equal(game.agents.find(agent => agent.id === result.agentId).lifespan, 240);
  }
});

test("네 부족 모두 고유 속성의 고정 효과를 생성 즉시 적용하고 저장·복원한다", () => {
  const baseLifespans = { bean: 120, spore: 120, pebble: 120, spring: 120 };
  const designs = [
    [["antenna"], 6, 1, .5, 0],
    [["strength"], 3, 2, .5, 0],
    [["butchery"], 3, 1, .5, 0],
    [["lifespan"], 3, 1, .5, 120],
    [["feet"], 3, 1, .8, 0],
    [["antenna", "strength"], 6, 2, .5, 0],
    [["antenna", "strength", "butchery"], 6, 2, .5, 0],
    [["antenna", "strength", "butchery", "feet"], 6, 2, .8, 0],
    [["antenna", "butchery", "feet", "lifespan"], 6, 1, .8, 120],
    [["strength", "feet", "lifespan"], 3, 2, .8, 120]
  ];
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const [slots, vision, capacity, speed, lifespanBonus] of designs) {
      const game = fixture(tribe);
      const saved = JSON.parse(game.save());
      saved.state.nestLevel = 4;
      game.restore(JSON.stringify(saved));
      const result = game.command({ type: "design", templateId: null, name: "즉시 적용", slots, birth: true });
      assert.ok(result.agentId, tribe);
      for (const restore of [false, true]) {
        if (restore) game.restore(game.save());
        const agent = game.agents.find(agent => agent.id === result.agentId);
        assert.deepEqual(agent.activeSlots, slots, tribe);
        assert.deepEqual(agent.appearanceAttributes, agent.attributes, tribe);
        assert.equal(agent.stats.vision, vision, tribe);
        assert.equal(agent.stats.capacity, capacity, tribe);
        assert.ok(Math.abs(unitMovementSpeed(agent.stats) - ({bean:.5,spore:.5,pebble:.35,spring:.9}[tribe] + (speed === .8 ? .3 : 0))) < 1e-12, tribe);
        assert.equal(agent.lifespan, baseLifespans[tribe] + (tribe === "pebble" && lifespanBonus ? 180 : lifespanBonus), tribe);
        assert.equal(agent.attributes.butchery, slots.includes("butchery") ? 1 : 0, tribe);
      }
    }
  }
});

test("이전 저장의 초반 유닛도 행동 역할에 맞는 실제 속성을 복원한다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.agents = saved.state.agents.slice(0, 2);
  saved.state.agents[0].actionPriorities = ["explore"];
  saved.state.agents[1].actionPriorities = ["collect"];
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

test("기본·채집·건설·전투 속성을 제공하며 삭제한 속성의 시너지는 발동하지 않는다", () => {
  assert.deepEqual(ATTRIBUTES.map(attribute => attribute.key), ["antenna", "strength", "butchery", "lifespan", "feet", "excavation", "construction", "blade", "piercing", "carapace", "guard", "regeneration"]);
  assert.deepEqual(ATTRIBUTES.map(attribute => attribute.name), ["감지", "채집량 증가", "흡수", "수명", "이속 증가", "굴착", "변태", "칼날", "관통", "갑피", "엄호", "재생"]);
  const counts = attributeCounts(["antenna", "strength", "strength", "lifespan", "feet", "feet"]);
  for (const key of ["harvest", "digging", "absorption", "climbing", "shell", "aggression", "peaceful", "secretion"]) {
    assert.equal(Object.hasOwn(attributeCounts([key]), key), false);
    assert.equal(hasSynergy(counts, [key]), false);
    assert.equal(hasSynergy(counts, ["strength", key]), false);
    assert.ok(ATTRIBUTE_COMBINATIONS.every(combination => !combination.keys.includes(key)));
  }
  assert.equal(unitStats(counts).resistance, 1);
  assert.ok(Object.values(unitStats({})).every(Number.isFinite));
});

test("저장한 설계·개체의 폐기 속성은 제거하고 중복 장착은 고유 속성으로 복원한다", () => {
  const game = fixture("bean");
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = 4;
  saved.state.templates = [{ id: 99, name: "이전 설계", revision: 1,
    slots: ["harvest", "arms", "digging", "absorption", "climbing", "shell", "aggression", "peaceful", "antenna", "lifespan", "feet", "feet"] }];
  Object.assign(saved.state.agents[0], { templateId: 99, slots: [...saved.state.templates[0].slots],
    shield: 4, shieldUntil: 100, warningUntil: 100 });
  game.restore(JSON.stringify(saved));
  const restored = JSON.parse(game.save()).state;
  assert.deepEqual(restored.templates[0].slots, ["strength", "antenna", "lifespan", "feet"]);
  assert.deepEqual(restored.templates[0].attributeLevels, { strength: 1, antenna: 1, lifespan: 1, feet: 1 });
  assert.deepEqual(game.agents[0].slots, restored.templates[0].slots);
  assert.equal(game.agents[0].stats.resistance, 1);
  assert.equal(game.agents[0].shield, 0);
  assert.equal(game.agents[0].warningUntil, 0);
  for (const key of ["aggression", "peaceful"]) {
    assert.equal(Object.hasOwn(game.agents[0].attributes, key), false);
    assert.equal(Object.hasOwn(game.agents[0].appearanceAttributes, key), false);
    assert.ok(!game.agents[0].activeSlots.includes(key));
  }
  for (const key of ["harvest", "digging", "absorption", "climbing", "shell", "aggression", "peaceful"]) {
    assert.throws(() => game.command({ type: "design", templateId: null, name: key, slots: [key], birth: false }), /설계 속성/);
  }
});
