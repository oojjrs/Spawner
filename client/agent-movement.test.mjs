import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext } from "node:vm";
import { createGameTestContext as createContext } from "./game-runtime-test-fixture.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { presentationRenderer } from "./unit-presentation-test-harness.mjs";
import { ATTRIBUTES, COMBAT_ATTRIBUTE_KEYS } from "../server/attributes.mjs";
import { UNIT_ANIMATIONS, unitAnimationPose, unitMovementPosition } from "./unit-animation.mjs";
import { SPORE_BIRTH_ANIMATION } from "./birth.mjs";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { createNestGrowthPlayback, nestGrowthSounds } from "./nest-growth.mjs";

const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));

function declaration(name) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

test("몽돌·포자버섯·샘방울은 이동 좌표와 완성 보행 애셋을 함께 진행한다", async t => {
  const render = presentationRenderer(t);
  for (const [tribe, file] of [["pebble", "walk-in-place-v1/walk"], ["spore", "walk-v2/walk-v2"], ["spring", "flow-v4/flow-v4"]]) {
    const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/" + tribe + "/AnimationStudies/" + file + ".json", import.meta.url), "utf8"));
    assert.equal(metadata.runtimeAtlas, UNIT_ANIMATIONS[tribe].walk.image);
    assert.equal(metadata.rootMotion, false);
    const agent = { id: tribe, tribe, health: 10, attributes: {}, x: 1, y: 2, renderFromX: 0, renderFromY: 0,
      moveStartedAt: 0, moveDuration: 1, stepCount: 1, facing: 1, carrying: 0 };
    const frames = new Set();
    for (const time of [.1, .4, .7, .9]) {
      render.state.simSeconds = time;
      const position = unitMovementPosition(agent, time);
      assert.equal(position.x, time);
      assert.equal(position.y, time * 2);
      const pose = unitActionArtPose(agent, time);
      assert.equal(pose.action, "walk");
      assert.equal(pose.missing, false);
      await render.presentation.prepareAnimation(agent, time);
      render.draws.length = 0;
      render.presentation.drawAgentAppearanceBody(render.context, 0, agent, 100, { x: 0, y: 0 }, position, null, null);
      assert.equal(render.draws.length, 1);
      assert.equal(render.draws[0][0].src, pose.animation.image);
      assert.deepEqual(render.translations.at(-1), [50, 100 * (.5 + .7 * .44)]);
      frames.add(render.draws[0][1] + "," + render.draws[0][2]);
    }
    assert.ok(frames.size > 1);
    assert.equal(unitActionArtPose(agent, 1).action, "idle");
  }
});

test("퇴역한 발 속성이 남은 새싹콩도 같은 점프 이동 시점을 사용한다", () => {
  const agent = { tribe: "bean", attributes: {}, x: 1, y: 0, renderFromX: 0, renderFromY: 0,
    moveStartedAt: 0, moveDuration: 1 };
  assert.equal(unitMovementPosition(agent, .1).x, 0);
  agent.attributes.feet = 1;
  assert.equal(unitMovementPosition(agent, .1).x, 0);
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
  for (let frame = 0; frame <= 64; frame++) {
    const time = frame / 60;
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

test("네 종족의 모든 0~4속성 조합은 기본 이동 궤적을 바꾸지 않는다", t => {
  const render = presentationRenderer(t);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const attributes of attributeCombinations()) {
      const agent = { tribe, attributes, x: 1, y: 2, renderFromX: 0, renderFromY: 0,
        moveStartedAt: 0, moveDuration: 1, stepCount: 1, health: 10 };
      const baseline = { ...agent, attributes: unitDisplayAttributes(agent).feet ? { feet: 1 } : {} };
      for (const time of [0, .1, .3, .6, .9, 1]) {
        render.state.simSeconds = time;
        const position = unitMovementPosition(agent, time), expected = unitMovementPosition(baseline, time);
        assert.deepEqual(position, expected, tribe + JSON.stringify(attributes));
        const jump = render.presentation.agentJumpOffset(agent, position);
        assert.equal(jump, tribe === "bean" && !unitDisplayAttributes(agent).feet ? Math.sin(expected.progress * Math.PI) * .7 * .18 : 0);
      }
    }
  }
});

test("전투 외형의 이동은 단일 완성 프레임을 좌우 반전만 하여 재생한다", async t => {
  const render = presentationRenderer(t);
  for (const key of COMBAT_ATTRIBUTE_KEYS) for (const feet of [0, 1]) {
    const agent = { id: "combat", tribe: "bean", attributes: { [key]: 1, feet }, x: 1, y: 0, renderFromX: 0, renderFromY: 0,
      moveStartedAt: 0, moveDuration: 1, stepCount: 1, health: 10, carrying: 0 };
    for (const facing of [-1, 1]) for (const time of [.1, .3, .6, .9]) {
      agent.facing = facing;
      render.state.simSeconds = time;
      await render.presentation.prepareAnimation(agent, time);
      render.draws.length = 0; render.translations.length = 0; render.scales.length = 0;
      render.presentation.drawAgentAppearanceBody(render.context, 0, agent, 100, { x: 0, y: 0 }, unitMovementPosition(agent, time), null, null);
      assert.equal(render.draws.length, 1);
      assert.deepEqual(render.translations, [[50, 100 * (.5 + .7 * .44)]]);
      assert.equal(render.scales.length, 1);
      assert.equal(Math.abs(render.scales[0][0]), render.scales[0][1]);
      assert.equal(render.draws[0][0].src, unitActionArtPose(agent, time).animation.image);
    }
  }
});

test("표시 외형은 원래 스탯과 독립적으로 완성 애셋을 고르고 이동을 바꾸지 않는다", async t => {
  const render = presentationRenderer(t);
  render.state.simSeconds = .1;
  for (const key of COMBAT_ATTRIBUTE_KEYS) {
    const agent = { tribe: "bean", attributes: { [key]: 1 }, appearanceAttributes: { antenna: 1 }, health: 10,
      x: 1, y: 0, renderFromX: 0, renderFromY: 0, moveStartedAt: 0, moveDuration: 1, stepCount: 1 };
    assert.equal(unitMovementPosition(agent, .1).x, 0);
    assert.equal(render.presentation.agentJumpOffset(agent, { progress: .5 }), .7 * .18);
    await render.presentation.prepareAnimation(agent, .1);
    render.draws.length = 0;
    render.presentation.drawAgentAnimation(render.context, agent, 50, 80.8, 70, null);
    assert.equal(render.draws.length, 1);
    assert.equal(render.draws[0][0].src, unitActionArtPose({ ...agent, attributes: { antenna: 1 }, appearanceAttributes: null }, .1).animation.image);
    agent.appearanceAttributes = { [key]: 1 };
    agent.attributes = { feet: 1 };
    assert.equal(unitMovementPosition(agent, .1).x, 0);
  }
});
