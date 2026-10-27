import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { UNIT_ANIMATIONS, unitAnimationPose } from "./unit-animation.mjs";
import { RESOURCE_TYPES, resourceTypeForCell } from "../server/resources.mjs";
import { RESOURCE_ECONOMY } from "../server/economy.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function rendering() {
  const draws = [];
  const sprite = name => ({ name, complete: true, naturalWidth: 512, naturalHeight: 512 });
  const context = createContext({
    state: { simSeconds: .1 }, AGENT_HEIGHT: .7, idleMotion: { matches: false },
    displayedAgent: value => value, foodDeliveryPose: () => ({}),
    agentBodyPose: () => ({ pivot: .94, scaleX: 1, scaleY: 1 }), agentWalkPose: () => null,
    agentSprite: () => sprite("body"), drawAgentHead() {}, drawAgentFeet() {}, drawAgentTail() {},
    drawAgentAttack: () => false, drawAgentMovement: () => false, drawSelectionOutline() {},
    foodCellMap: new Map(), foodCellAt: () => ({ x: 1, y: 2, resourceType: "honey-mushrooms", amount: 5 }),
    worldMap: {}, Spawner: { unitAnimationPose, resourceTypeForCell },
    unitAnimationSheets: new Map(Object.entries(UNIT_ANIMATIONS).map(([tribe, animations]) => [tribe,
      new Map(Object.entries(animations).map(([action, animation]) => [action, {
        animation, sprite: sprite(tribe + ":" + action), scale: 1
      }]))])),
    resourceCarrySprites: new Map(RESOURCE_TYPES.map(type => [type.key, sprite(type.carryImage)])),
    foodCarryPlacement: () => ({ x: 0, y: 0, width: .2, height: .2, pivotY: 1,
      crop: { x: 0, y: 0, width: 512, height: 512 } }),
    drawing: { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, ellipse() {}, fill() {},
      translate() {}, scale() {}, rotate() {}, drawImage(image) { draws.push(image.name); } }
  });
  for (const name of ["drawAgentAnimation", "drawAgentAppearance"]) {
    const declaration = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
    assert.ok(declaration, name);
    runInContext(declaration[0], context);
  }
  return { context, draws };
}

test("4종족·12자원의 채집·운반·투척은 실제 자원과 다른 소품을 그리지 않는다", () => {
  const render = rendering();
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const type of RESOURCE_TYPES) {
    for (const mode of ["harvest", "return", "unload"]) {
      render.draws.length = 0;
      const agent = { tribe, health: 10, attributes: {}, x: 1, y: 2, rememberedFoodKey: "target",
        mode, harvestStarted: 0, carrying: 1, carryingType: type.key, moveStartedAt: 0,
        moveDuration: mode === "return" ? 1 : 0, stepCount: 1,
        foodDelivery: mode === "unload" ? { startedAt: 0, arrivesAt: 1, receivedAt: null,
          resourceType: type.key, amount: 1 } : null };
      render.context.foodCellMap.set("target", { x: 1, y: 2, amount: 5, resourceType: type.key });
      render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
        { x: 0, y: 0 }, { progress: .1 }, null, null);
      const label = tribe + " " + type.key + " " + mode;
      assert.ok(!render.draws.some(name => /:(harvest|carry|throw)$/.test(name)), label);
      assert.equal(render.draws.filter(name => name === type.carryImage).length, 1, label);
    }
  }
});

test("빈손 채집과 겹친 자원도 기억한 실제 대상에 따라 선택한다", () => {
  const render = rendering();
  for (const tribe of ["spore", "pebble", "spring"]) {
    const agent = { tribe, health: 10, attributes: {}, x: 1, y: 2, mode: "harvest",
      rememberedFoodKey: "target", harvestStarted: 0, carrying: 0, carryingType: null };
    for (const type of RESOURCE_TYPES) {
      render.draws.length = 0;
      render.context.foodCellMap.set("target", { x: 1, y: 2, amount: 5, resourceType: type.key });
      render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
        { x: 0, y: 0 }, { progress: 1 }, null, null);
      assert.equal(render.draws[0], "body", tribe + " " + type.key);
    }
    render.context.foodCellMap.set("target", { x: 3, y: 4, resourceType: "dew", amount: 1 });
    render.draws.length = 0;
    render.context.drawAgentAnimation(render.context.drawing, agent, 0, 0, 70, null);
    assert.deepEqual(render.draws, []);
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

test("기획서의 네 종족 작업 미리보기는 현재 기본 자원과 게임 렌더링을 사용한다", () => {
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  const local = readFileSync(new URL("./local-assets.js", import.meta.url), "utf8");
  const units = { bean: "sprout-bean", spore: "spore-tribe", pebble: "pebble-tribe", spring: "spring-tribe" };
  for (const policy of RESOURCE_ECONOMY) {
    const row = design.match(new RegExp('<tr id="unit-' + units[policy.tribe] + '"[^>]*>([^]*?)</tr>'))[1];
    const type = RESOURCE_TYPES.find(type => type.key === policy.key);
    for (const action of ["harvest", "carry", "throw"]) {
      assert.equal(UNIT_ANIMATIONS[policy.tribe][action], undefined);
      const cell = row.match(new RegExp('<td data-action="' + action + '"[^>]*>([^]*?)</td>'))[1];
      const label = policy.tribe + " " + action;
      assert.ok(cell.includes('data-runtime-preview="true"'), label);
      assert.ok(cell.includes('data-resource-type="' + policy.key + '"'), label);
      assert.ok(!cell.includes("/Animations/Units/"), label);
      const preview = cell.match(/href="([^"]+)"/)[1];
      const metadata = JSON.parse(readFileSync(new URL("../" + preview.replace(/\.webp$/, ".json"), import.meta.url), "utf8"));
      assert.equal(metadata.resourceType, policy.key, label);
      assert.equal(metadata.resourceImage, type.carryImage, label);
      assert.equal(metadata.rendering, "runtime-composite", label);
      assert.equal(metadata.sheet, cell.match(/data-preview="([^"]+)"/)[1], label);
      assert.equal(metadata.thumbnail, cell.match(/<img src="([^"]+)"/)[1], label);
      assert.deepEqual(metadata.durationsMs, cell.match(/data-durations="([^"]+)"/)[1].split(",").map(Number), label);
      assert.equal(metadata.loop, cell.includes('data-loop="true"'), label);
      for (const file of [metadata.sheet, metadata.preview, metadata.thumbnail]) readFileSync(new URL("../" + file, import.meta.url));
      if (action === "harvest") {
        const resource = policy.key === "tree" ? "wood" : policy.key;
        const food = design.match(new RegExp('<tr data-resource="' + resource + '"[^>]*>[^]*?</tr>'))[0];
        assert.ok(cell.includes(food.match(/<audio[^>]+src="([^"]+)"/)[1]), label);
      }
      if (policy.tribe !== "bean") assert.ok(!local.includes("/Tribes/" + policy.tribe + "/Animations/Units/" + action + "/"), label);
    }
  }
});
