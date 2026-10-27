import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { SPROUT_DECOMPOSITION_ANIMATIONS, unitAnimationPose, unitAnimationFrame } from "./unit-animation.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function rendering(action) {
  const draws = [];
  const sprite = name => ({ name, complete: true, naturalWidth: 512, naturalHeight: 512 });
  const sheet = sprite("embedded-sprout");
  const context = createContext({
    state: { simSeconds: .1 }, AGENT_HEIGHT: .7, idleMotion: { matches: false },
    displayedAgent: value => value, foodDeliveryPose: () => ({}),
    agentBodyPose: () => ({ pivot: 460 / 512, scaleX: 1, scaleY: 1 }), agentWalkPose: () => null,
    agentBirthPose: () => null,
    agentHeadPose: () => ({ leftRotation: 0, rightRotation: 0, leftScaleY: 1, rightScaleY: 1 }),
    agentSprite: (agent, layer) => sprite(layer), drawAgentMovement: () => false,
    sproutCombatFrame: () => sheet, agentAttackFrame: () => -1,
    Spawner: { combatHurtFrame: () => -1, unitAnimationPose: () => ({ action, frame: 0, animation: { frameSize: 512, columns: 4, pivotX: 256, pivotY: 448 } }), unitAnimationFrame },
    sproutDecompositionSheets: new Map(Object.entries(SPROUT_DECOMPOSITION_ANIMATIONS).map(([name, animation]) =>
      [name, { animation, sprite: sprite("decomposition-" + name), scale: 1 }])),
    unitAnimationSheets: new Map([["bean", new Map([[action, { sprite: sheet, scale: 1 }]])]]),
    drawSelectionOutline() {},
    drawing: { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, ellipse() {}, fill() {},
      translate() {}, scale() {}, rotate() {}, drawImage(image) { draws.push(image.name); } }
  });
  for (const name of ["agentBodyLift", "drawAgentTail", "drawAgentHead", "drawAgentFeet", "drawAgentAnimation", "drawAgentAttack", "drawAgentAppearance"])
    runInContext(declaration(name), context);
  return { context, draws };
}

test("감지 유닛은 대기 외형을 유지하고 공격·피격은 속성 합성 애니메이션을 재생한다", () => {
  for (const action of ["idle", "attack", "hurt"]) for (const antenna of [1, 2]) {
    const render = rendering(action);
    const agent = { id: "bean:1", tribe: "bean", health: 12, attributes: { antenna }, stats: { capacity: 1 }, carrying: 0 };
    render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
      { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.deepEqual(render.draws, action === "idle" ? ["antenna", "body"] : ["embedded-sprout"]);
  }
});

test("발 속성은 분리한 양발을 그리고 무속성 유닛은 원본 애니메이션을 유지한다", () => {
  const render = rendering("idle");
  const agent = { id: "bean:1", tribe: "bean", health: 12, attributes: { feet: 1 }, stats: { capacity: 1 }, carrying: 0 };
  render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
    { x: 0, y: 0 }, { progress: 1 }, null, null);
  assert.deepEqual(render.draws, ["feet-left", "feet-right", "sprout-left", "sprout-right", "sprout-stem", "body"]);
  render.draws.length = 0;
  agent.attributes = {};
  render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
    { x: 0, y: 0 }, { progress: 1 }, null, null);
  assert.deepEqual(render.draws, ["embedded-sprout"]);
});

test("삭제됐거나 알 수 없는 자원을 시야에서 발견해도 진행을 중단하지 않는다", () => {
  const colony = { id: 1, ownerId: "resource-discovery", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  for (const resourceType of ["seed-pods", "unknown-resource"]) {
    const agent = game.agents[0];
    environment.food.set(agent.x + "," + agent.y, { x: agent.x, y: agent.y, resourceType, amount: 10 });
    assert.doesNotThrow(() => { game.prepare(.1); game.tick(.1); });
    assert.ok(game.snapshot().discoveries.every(entry => !entry.key.includes(resourceType)));
  }
});

test("분해 대기는 기본잎과 감지 외형에 맞는 6.4초 꼬리 idle을 선택한다", () => {
  for (const antenna of [0, 1]) {
    const render = rendering("idle");
    render.context.Spawner.unitAnimationPose = unitAnimationPose;
    const agent = { id: "bean:1", tribe: "bean", health: 12, mode: "idle", bornAt: 0, facing: 1,
      attributes: { butchery: 1, antenna }, stats: { capacity: 1 }, carrying: 0 };
    const pose = unitAnimationPose(agent, 1.25);
    assert.equal(pose.decomposition, antenna ? "antenna" : "basic");
    assert.equal(pose.frame, 25);
    assert.equal(pose.animation.durationMs, 6400);
    assert.equal(unitAnimationPose(agent, 6.4).frame, 0);
    render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
      { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.deepEqual(render.draws, ["decomposition-" + pose.decomposition]);
  }
});

test("분해 꼬리는 이동·채집·공격·피격과 다른 속성 조합에서도 몸 뒤에 남는다", () => {
  for (const antenna of [0, 1, 2]) for (const action of ["idle", "walk", "harvest", "attack", "hurt"]) {
    const render = rendering(action);
    render.context.Spawner.unitAnimationPose = unitAnimationPose;
    const agent = { id: "bean:1", tribe: "bean", health: 12, mode: action === "harvest" ? "harvest" : "idle", bornAt: 0,
      attributes: { butchery: 1, antenna, strength: action === "idle" ? 1 : 0 }, stats: { capacity: 1 }, carrying: 0,
      moveStartedAt: 0, moveDuration: action === "walk" ? 1 : 0,
      attack: action === "attack" ? { startedAt: 0, speed: 1 } : null,
      hurtStartedAt: action === "hurt" ? 0 : -10 };
    render.context.drawAgentAppearance(render.context.drawing, 100, agent, 200,
      { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.deepEqual(render.draws, ["attack", "hurt"].includes(action) ? ["embedded-sprout"] :
      antenna ? ["decomposition-tail", "antenna", "body"] : ["decomposition-tail", "sprout-left", "sprout-right", "sprout-stem", "body"]);
  }
});

test("분해 장착 여부를 외형 캐시에서 구분하고 다른 종족에 새싹콩 꼬리를 붙이지 않는다", () => {
  const render = rendering("idle");
  runInContext(declaration("agentAppearanceKey"), render.context);
  assert.notEqual(render.context.agentAppearanceKey({}), render.context.agentAppearanceKey({ butchery: 1 }));
  for (const tribe of ["spore", "pebble", "spring"]) {
    render.context.drawAgentTail(render.context.drawing, { tribe, attributes: { butchery: 1 } }, 0, 0, 512, 512, null);
  }
  assert.deepEqual(render.draws, []);
});
