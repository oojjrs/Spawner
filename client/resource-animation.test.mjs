import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { unitAnimationPose } from "./unit-animation.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { presentationRenderer } from "./unit-presentation-test-harness.mjs";
import { startingWorkerDna } from "../server/tribe-start.mjs";
import { RESOURCE_ECONOMY } from "../server/economy.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const carrying = source.match(/^    function drawAgentCarrying\([^]*?^    }/m)[0];

test("네 종족의 작업은 승인된 완성 애셋을 재생하고 운반 소품을 중복 합성하지 않는다", async t => {
  const render = presentationRenderer(t);
  render.state.simSeconds = .1;
  const scope = createContext({ unitPresentation: render.presentation, state: render.state });
  runInContext(carrying, scope);
  for (const policy of RESOURCE_ECONOMY) for (const [mode, action] of [["harvest", "harvest"], ["return", "carry"], ["unload", "throw"]]) {
    const agent = { tribe: policy.tribe, dna: startingWorkerDna(policy.tribe), health: 10, mode,
      harvestStarted: 0, carrying: 1, carryingType: policy.key, moveStartedAt: 0, moveDuration: 1,
      foodDelivery: mode === "unload" ? { startedAt: 0, arrivesAt: 1, resourceType: policy.key, amount: 1 } : null };
    const pose = unitActionArtPose(agent, .1);
    assert.equal(pose.action, action);
    assert.equal(pose.missing, false);
    assert.equal(pose.animation.embeddedCargo, true);
    assert.equal(pose.animation.image, "DesignAssets/Animations/GatherWorkV1/" + policy.tribe + "/" + action + ".webp");
    await render.presentation.prepareAnimation(agent, .1);
    render.draws.length = 0;
    render.presentation.drawAgentAppearanceBody(render.context, 0, agent, 200, { x: 0, y: 0 }, { progress: .1 }, null, null);
    assert.equal(render.draws.length, 1);
    assert.equal(render.draws[0][0].src, pose.animation.image);
    scope.drawAgentCarrying(render.context, agent, 200, { x: 0, y: 0 }, { progress: .1 });
    assert.equal(render.draws.length, 1);
  }
});

test("빈손과 이미 전량 투척한 개체는 운반 이미지와 자세를 준비하지 않는다", () => {
  const reject = () => { throw new Error("불필요한 운반 이미지 또는 자세 준비"); };
  const scope = createContext({ state: { simSeconds: 1 }, unitPresentation: { hasEmbeddedCargo: reject },
    agentAppearanceBodyPose: reject, agentWalkPose: reject, Spawner: { unitDisplayAttributes: reject } });
  runInContext(carrying, scope);
  for (const agent of [{ carrying: 0 }, { carrying: 1,
    foodDelivery: { startedAt: 0, arrivesAt: 1, receivedAt: null, amount: 1 } }]) {
    scope.drawAgentCarrying(new Proxy({}, { get: reject }), agent, 100, { x: 0, y: 0 }, { progress: 1 });
  }
});

test("대상이 없거나 소품 종류를 모르면 버섯 모션으로 추정하지 않는다", () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    const agent = { tribe, health: 10, mode: "harvest", harvestStarted: 0 };
    for (const type of [null, undefined, "unknown"]) assert.equal(unitAnimationPose(agent, .1, type), null);
    agent.mode = "unload"; agent.foodDelivery = { startedAt: 0, resourceType: "dew" };
    agent.carryingType = "honey-mushrooms";
    assert.equal(unitAnimationPose(agent, .1, null), null);
    agent.foodDelivery.resourceType = "honey-mushrooms"; agent.carryingType = null;
    assert.equal(unitAnimationPose(agent, .1), null);
  }
});

test("자원 작업 중에도 피격·공격은 우선 재생한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const agent = { tribe, health: 10, mode: "harvest", harvestStarted: 0,
      hurtStartedAt: 0, attack: { startedAt: 0, speed: 1 } };
    assert.equal(unitAnimationPose(agent, .1, "dew").action, "hurt");
    agent.hurtStartedAt = -10;
    assert.equal(unitAnimationPose(agent, .1, "dew").action, "attack");
  }
});

test("현행 작업 카탈로그는 합성 메타데이터 대신 존재하는 완성 시트와 유효한 재생 시간을 사용한다", () => {
  for (const policy of RESOURCE_ECONOMY) for (const mode of ["harvest", "return", "unload"]) {
    const agent = { tribe: policy.tribe, dna: startingWorkerDna(policy.tribe), health: 10, mode,
      harvestStarted: 0, carrying: 1, carryingType: policy.key, moveStartedAt: 0, moveDuration: 1,
      foodDelivery: { startedAt: 0, arrivesAt: 1, resourceType: policy.key } };
    const { animation, missing } = unitActionArtPose(agent, .1);
    assert.equal(missing, false);
    assert.ok(existsSync(new URL("../" + animation.image, import.meta.url)));
    assert.equal(animation.frameCount, animation.durationsMs.length);
    assert.ok(animation.durationsMs.every(duration => duration > 0));
    assert.equal(animation.embeddedCargo, true);
    assert.equal(animation.sceneLayers, undefined);
  }
});
