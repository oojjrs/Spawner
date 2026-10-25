import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function movement() {
  const draws = [], translations = [];
  class Image {
    constructor() { this.complete = true; this.naturalWidth = 2048; }
    async decode() {}
  }
  const context = createContext({ Image, assetSource: path => path,
    state: { simSeconds: .5 }, idleMotion: { matches: false }, AGENT_JUMP_PREPARATION: .2, AGENT_HEIGHT: .7,
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    displayedAgent: agent => agent, agentBirthPose: () => null,
    tribeArt: { prepareUnit: async () => ({ box: { width: 310, height: 350 } }) },
    agentWalkPose: () => null, agentBobOffset: () => 0, foodDeliveryPose: () => ({ scaleX: 1, scaleY: 1 }),
    drawAgentAttack: () => false, agentSprite: () => ({ width: 512, height: 512 }),
    drawSelectionOutline() {}, foodSelectionShape: {},
    ctx: { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, ellipse() {}, fill() {},
      translate: (...args) => translations.push(args), scale() {}, rotate() {},
      drawImage: (...args) => draws.push(args) }
  });
  const start = source.indexOf("    const agentMovementSheets = new Map(");
  const end = source.indexOf("    const attackSheet = new Image();", start);
  runInContext(source.slice(start, end), context);
  for (const name of ["agentBasePosition", "agentBodyPose", "prepareAgentMovement", "drawAgentMovement", "drawAgentAppearance"])
    runInContext(declaration(name), context);
  return { context, draws, translations };
}

test("몽돌·포자버섯·샘방울은 승인된 이동 원본으로 지면을 따라 이동한다", async () => {
  const render = movement();
  for (const [tribe, file] of [["pebble", "roll-v2/roll-v2"], ["spore", "walk-v2/walk-v2"], ["spring", "flow-v4/flow-v4"]]) {
    const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/" + tribe + "/AnimationStudies/" + file + ".json", import.meta.url), "utf8"));
    assert.equal(metadata.status, "approved");
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
  const played = [], harvests = [];
  const state = { simSeconds: .2, camera: { layer: 0 }, agents: [], rivals: [], corpses: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: 0,
    audio: { available: () => true, play: name => played.push(name), setHarvest: volumes => harvests.push(new Map(volumes)) },
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {},
    Spawner: { resourceTypeForCell: food => food.resourceType || (food.kind === "corpse" ? "meat" : "honey-mushrooms") },
    worldMap: {}, foodCellMap: new Map(), foodCellAt: () => null,
    displayedAgent: unit => unit, interpolatedAgentPosition: unit => unit, audioVolume: () => 1,
    agentBirthPose: () => null, agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    AGENT_FOOTSTEPS_PER_CELL: 4, clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    resetAudio() {} });
  runInContext(declaration("updateAudio"), context);
  return { context, state, played, harvests };
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
});

test("포자버섯 등장에는 포자버섯 탄생음을 한 번 재생한다", () => {
  const sound = gameAudio();
  sound.state.agents = [{ id: "spore", tribe: "spore", health: 1, x: 1, y: 1, birth: { startedAt: 0 } }];
  sound.context.agentBirthPose = () => ({ seedVisible: false, fractureAge: -1, unitVisible: sound.state.simSeconds >= .4 });
  for (const time of [.2, .4, .5]) {
    sound.state.simSeconds = time;
    sound.context.updateAudio();
  }
  assert.deepEqual(sound.played, ["spore-birth"]);
});

test("목재와 사체도 실제 채집 대상을 따라 재생하며 중첩된 다른 자원을 고르지 않는다", () => {
  const sound = gameAudio();
  const agent = { id: "worker", tribe: "pebble", health: 1, attributes: {}, x: 1, y: 1,
    mode: "harvest", rememberedFoodKey: "target", carrying: 0 };
  sound.state.agents = [agent];
  sound.context.foodCellAt = () => ({ x: 1, y: 1, amount: 4, resourceType: "pebbles" });
  for (const cell of [{ resourceType: "tree" }, { kind: "corpse" }, { resourceType: "carapace" }]) {
    sound.context.foodCellMap.set("target", { x: 1, y: 1, amount: 4, ...cell });
    sound.context.updateAudio();
    assert.deepEqual([...sound.harvests.at(-1)], [[cell.resourceType || "meat", 1]]);
  }
  sound.context.foodCellMap.get("target").amount = 0;
  sound.context.updateAudio();
  assert.equal(sound.harvests.at(-1).size, 0);
});
