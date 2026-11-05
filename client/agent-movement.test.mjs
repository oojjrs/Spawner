import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { sproutRootGeometry } from "./sprout-roots.mjs";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS } from "../server/attributes.mjs";
import { UNIT_ANIMATIONS, unitAnimationPose, unitMovementPosition } from "./unit-animation.mjs";
import { SPORE_BIRTH_ANIMATION } from "./birth.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { createNestGrowthPlayback, nestGrowthSounds } from "./nest-growth.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function movement() {
  const draws = [], translations = [], scales = [];
  class Image {
    constructor() { this.complete = true; this.naturalWidth = 2048; }
    async decode() {}
  }
  const context = createContext({ canvas: {}, Image, performance, Spawner: { unitDisplayAttributes, UNIT_ANIMATIONS, combatAttributeKeys, hasCombatEvolution, unitAnimationPose, unitMovementPosition, sproutRootGeometry }, assetSource: path => path,
    unitAnimationSheets: new Map(), combatAttributeArt: { ready: () => true, frame: () => ({ width: 512, height: 512 }) },
    drawAgentFeet() {}, drawAgentTail() {}, drawAgentHead() {},
    state: { simSeconds: .5 }, idleMotion: { matches: false }, AGENT_JUMP_PREPARATION: .2, AGENT_HEIGHT: .7,
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    displayedAgent: agent => agent, agentBirthPose: () => null,
    tribeArt: { prepareUnit: async () => ({ box: { width: 310, height: 350 } }) },
    agentWalkPose: () => null, agentBobOffset: () => 0, foodDeliveryPose: () => ({ scaleX: 1, scaleY: 1 }),
    prepareUnitAnimationSheets: async () => {}, drawAgentAnimation: () => false,
    drawAgentAttack: () => false, agentSprite: () => ({ width: 512, height: 512 }),
    drawSelectionOutline() {}, foodSelectionShape: {},
    ctx: { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, ellipse() {}, fill() {},
      translate: (...args) => translations.push(args), scale: (...args) => scales.push(args), rotate() {},
      drawImage: (...args) => draws.push(args) }
  });
  const start = source.indexOf("    const agentMovementSheets = new Map(");
  const end = source.indexOf("    const unitAnimationSheets = new Map(", start);
  runInContext(source.slice(start, end), context);
  for (const name of ["agentBodyLift", "agentBasePosition", "agentJumpOffset", "agentAppearanceBodyPose", "agentBodyPose", "prepareAgentMovement", "drawAgentMovement",
    "drawAgentAppearance", "drawAgentAppearanceSurface", "drawAgentAppearanceLayer", "drawAgentAppearanceBody", "drawAgentCarrying"])
    runInContext(declaration(name), context);
  return { context, draws, translations, scales };
}

test("몽돌·포자버섯·샘방울은 현재 이동 원본으로 지면을 따라 이동한다", async () => {
  const render = movement();
  for (const [tribe, file] of [["pebble", "walk-in-place-v1/walk"], ["spore", "walk-v2/walk-v2"], ["spring", "flow-v4/flow-v4"]]) {
    const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/" + tribe + "/AnimationStudies/" + file + ".json", import.meta.url), "utf8"));
    assert.equal(metadata.runtimeAtlas, UNIT_ANIMATIONS[tribe].walk.image);
    assert.equal(metadata.rootMotion, false);
    await render.context.prepareAgentMovement({ key: tribe });
    const agent = { id: tribe, tribe, attributes: {}, x: 1, y: 2, renderFromX: 0, renderFromY: 0,
      moveStartedAt: 0, moveDuration: 1, stepCount: 1, facing: 1, carrying: 0 };
    const frames = new Set();
    for (const time of [.1, .4, .7, .9]) {
      render.context.state.simSeconds = time;
      const position = render.context.agentBasePosition(agent);
      assert.equal(position.x, time);
      assert.equal(position.y, time * 2);
      assert.equal(render.context.agentBodyPose(agent, 0, { scaleX: 1, scaleY: 1 }).scaleY, 1);
      render.context.drawAgentAppearance(render.context.ctx, 0, agent, 100, { x: 0, y: 0 }, position, null, null);
      const draw = render.draws.at(-1);
      assert.equal(draw[0].src, metadata.runtimeAtlas);
      assert.equal(render.translations.at(-1)[1], 50 - 70 / 2 + 70 * .94);
      frames.add(draw[1] + "," + draw[2]);
    }
    assert.ok(frames.size > 1);
    render.context.state.simSeconds = 1;
    assert.equal(render.context.drawAgentMovement(render.context.ctx, agent, 0, 0, 70, null), false);
  }
});

test("새싹콩은 발 속성에 따라 기존 보행과 점프 구분을 유지한다", () => {
  const render = movement();
  const agent = { tribe: "bean", attributes: {}, x: 1, y: 0, renderFromX: 0, renderFromY: 0,
    moveStartedAt: 0, moveDuration: 1 };
  render.context.state.simSeconds = .1;
  assert.equal(render.context.agentBasePosition(agent).x, 0);
  agent.attributes.feet = 1;
  assert.equal(render.context.agentBasePosition(agent).x, .1);
});


function gameAudio() {
  const played = [], movementPlayed = [], harvests = [];
  const state = { simSeconds: .2, camera: { layer: 0 }, agents: [], rivals: [], corpses: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: 0,
    audio: { available: () => true, play: name => (name.startsWith("move-") ? movementPlayed : played).push(name), setHarvest: volumes => harvests.push(new Map(volumes)) },
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {}, nestGrowthPlayback: createNestGrowthPlayback(),
    Spawner: { unitDisplayAttributes, UNIT_ANIMATIONS, unitAnimationPose, SPORE_BIRTH_ANIMATION, nestGrowthSounds, resourceTypeForCell: food => food.resourceType || "honey-mushrooms" },
    worldMap: {}, foodCellMap: new Map(), foodCellAt: () => null,
    displayedAgent: unit => unit, interpolatedAgentPosition: unit => unit, audioVolume: () => 1,
    agentBirthPose: () => null, agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    AGENT_FOOTSTEPS_PER_CELL: 4, clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    resetAudio() {} });
  runInContext(readFileSync(new URL("./movement-audio.js", import.meta.url), "utf8"), context);
  context.movementAudio = context.SpawnerMovementAudio.create();
  runInContext(declaration("updateAudio"), context);
  return { context, state, played, movementPlayed, harvests };
}

test("지면 이동 부족에는 콩 착지음이 붙지 않고 새싹콩 점프는 착지음을 유지한다", () => {
  const sound = gameAudio();
  sound.state.agents = ["bean", "spore", "pebble", "spring"].map(tribe => ({ id: tribe, tribe,
    health: 1, attributes: {}, x: 1, y: 1, mode: "search", moveStartedAt: 0, moveDuration: 1, stepCount: 1 }));
  for (const time of [.2, .6, 1.05]) {
    sound.state.simSeconds = time;
    sound.context.updateAudio();
  }
  assert.deepEqual(sound.played, ["landing"]);
  assert.deepEqual([...new Set(sound.movementPlayed)].sort(), ["move-pebble", "move-spore", "move-spring"]);
});

test("포자버섯 등장에는 포자버섯 탄생음을 한 번 재생한다", () => {
  const sound = gameAudio();
  sound.state.agents = [{ id: "spore", tribe: "spore", health: 1, x: 1, y: 1, birth: { startedAt: 0 } }];
  sound.context.agentBirthPose = () => ({ kind: "spore", elapsed: sound.state.simSeconds });
  for (const time of [.1, .2, .4, .5]) {
    sound.state.simSeconds = time;
    sound.context.updateAudio();
  }
  assert.deepEqual(sound.played, ["spore-birth"]);
});

test("목재와 이슬도 실제 채집 대상을 따라 재생하며 중첩된 다른 자원을 고르지 않는다", () => {
  const sound = gameAudio();
  const agent = { id: "worker", tribe: "pebble", health: 1, attributes: {}, x: 1, y: 1,
    mode: "harvest", rememberedFoodKey: "target", carrying: 0 };
  sound.state.agents = [agent];
  sound.context.foodCellAt = () => ({ x: 1, y: 1, amount: 4, resourceType: "pebbles" });
  for (const cell of [{ resourceType: "tree" }, { resourceType: "dew" }]) {
    sound.context.foodCellMap.set("target", { x: 1, y: 1, amount: 4, ...cell });
    sound.context.updateAudio();
    assert.deepEqual([...sound.harvests.at(-1)], [[cell.resourceType, 1]]);
  }
  sound.context.foodCellMap.get("target").amount = 0;
  sound.context.updateAudio();
  assert.equal(sound.harvests.at(-1).size, 0);
});

function attributeCombinations() {
  const combinations = [{}];
  for (const { key } of ATTRIBUTES) for (const attributes of [...combinations]) {
    if (Object.keys(attributes).length < 4) combinations.push({ ...attributes, [key]: 1 });
  }
  return combinations;
}

test("네 종족의 모든 0~4속성 조합은 다리 유무 외에 기본 이동 궤적을 바꾸지 않는다", () => {
  const render = movement();
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const attributes of attributeCombinations()) {
      const agent = { tribe, attributes, x: 1, y: 2, renderFromX: 0, renderFromY: 0,
        moveStartedAt: 0, moveDuration: 1, stepCount: 1, health: 10 };
      const baseline = { ...agent, attributes: unitDisplayAttributes(agent).feet ? { feet: 1 } : {} };
      for (const time of [0, .1, .3, .6, .9, 1]) {
        render.context.state.simSeconds = time;
        const position = render.context.agentBasePosition(agent), expected = render.context.agentBasePosition(baseline);
        assert.deepEqual(position, expected, tribe + JSON.stringify(attributes));
        const jump = render.context.agentJumpOffset(agent, position);
        assert.equal(jump, tribe === "bean" && !unitDisplayAttributes(agent).feet ? Math.sin(expected.progress * Math.PI) * .7 * .18 : 0);
      }
    }
  }
});

test("전투 외형의 모든 새싹콩 조합도 기본 콩과 같은 점프 높이와 몸체 신축을 사용한다", () => {
  const render = movement(), cell = 100, origin = { x: 0, y: 0 }, floor = 50 + 70 * .44;
  for (const attributes of attributeCombinations().filter(hasCombatEvolution)) {
    const agent = { id: "combat", tribe: "bean", attributes, x: 1, y: 0, renderFromX: 0, renderFromY: 0,
      moveStartedAt: 0, moveDuration: 1, stepCount: 1, health: 10, carrying: 0 };
    for (const facing of [-1, 1]) for (const time of [.1, .3, .6, .9, 1]) {
      agent.facing = facing;
      render.context.state.simSeconds = time;
      const position = render.context.agentBasePosition(agent), expected = render.context.agentJumpOffset(agent, position) * cell;
      render.translations.length = 0; render.scales.length = 0;
      render.context.drawAgentAppearance(render.context.ctx, 0, agent, cell, origin, position, null, null);
      assert.equal(render.translations[0][0], 50);
      assert.ok(Math.abs(render.translations[0][1] - floor + expected) < 1e-9, JSON.stringify(attributes));
      assert.deepEqual(render.scales.at(-1), [facing, 1]);
      if (!unitDisplayAttributes(agent).feet) {
        const pose = render.context.agentBodyPose(agent, 0, { scaleX: 1, scaleY: 1 });
        assert.deepEqual(render.scales[0], [pose.scaleX, pose.scaleY]);
      } else assert.equal(render.scales.length, 1);
    }
  }
});

test("전투 속성 합성은 기본 몸체 점프를 한 번만 적용하고 표시 속성의 다리 유무를 따른다", () => {
  const render = movement(), painted = [];
  render.context.combatAttributeArt.frame = (agent, time, scale, drawBody) => {
    drawBody({ ...render.context.ctx, translate: (...args) => painted.push(args) });
    return { width: 512, height: 512 };
  };
  for (const key of COMBAT_ATTRIBUTE_KEYS) {
    const attributes = { [key]: 1 };
    const agent = { tribe: "bean", attributes, health: 10, x: 1, y: 0, renderFromX: 0, renderFromY: 0,
      moveStartedAt: 0, moveDuration: 1, stepCount: 1, carrying: 0 };
    render.context.state.simSeconds = .6;
    const position = render.context.agentBasePosition(agent), jump = render.context.agentJumpOffset(agent, position);
    painted.length = 0; render.translations.length = 0;
    render.context.drawAgentAppearance(render.context.ctx, 0, agent, 100, { x: 0, y: 0 }, position, null, null);
    assert.ok(painted.some(([x, y]) => x === 256 && Math.abs(y - 448) < 1e-9));
    assert.equal(render.translations[0][0], 50);
    assert.ok(Math.abs(render.translations[0][1] - 50 - 70 * .44 + jump * 100) < 1e-9);
    assert.equal(render.context.agentJumpOffset({ ...agent, appearanceAttributes: { feet: 1 } }, position), 0);
    assert.equal(render.context.agentJumpOffset({ ...agent, attributes: { feet: 1 }, appearanceAttributes: attributes }, position), jump);
  }
});
