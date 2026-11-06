import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { unitAnimationPose, unitAnimationFrame } from "./unit-animation.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";

const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function rendering(action) {
  const draws = [];
  const sprite = name => ({ name, complete: true, naturalWidth: 512, naturalHeight: 512 });
  const sheet = sprite("embedded-sprout");
  const context = createContext({     state: { simSeconds: .1 }, AGENT_HEIGHT: .7, idleMotion: { matches: false },
    displayedAgent: value => value, foodDeliveryPose: () => ({}),
    agentAppearanceBodyPose: () => ({ pivot: 460 / 512, scaleX: 1, scaleY: 1 }), agentWalkPose: () => null,
    agentBirthPose: () => null,
    agentHeadPose: () => ({ leftRotation: 0, rightRotation: 0, leftScaleY: 1, rightScaleY: 1 }),
    agentSprite: (agent, layer) => sprite(layer), drawAgentMovement: () => false,
    agentParts: new Map(), interpolatedAgentPosition: () => ({}),
    sproutRoots: { pose: () => null, drawRig() { draws.push("feet-left", "feet-right"); } },
    sproutCombatFrame: () => sheet, agentAttackFrame: () => -1,
    Spawner: { unitDisplayAttributes, imageFrameGeometry, sproutRootGeometry: () => ({ height: 76 }), combatHurtFrame: () => -1, unitAnimationPose: () => ({ action, frame: 0, animation: { frameSize: 512, columns: 4, pivotX: 256, pivotY: 448 } }), unitAnimationFrame },
    unitAnimationSheets: new Map([["bean", new Map([[action, { sprite: sheet, scale: 1 }]])]]),
    drawAgentRanged: () => false, drawAgentBaseResource: () => false, drawSelectionOutline() {},
    drawing: { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, ellipse() {}, fill() {},
      translate() {}, scale() {}, rotate() {}, drawImage(image) { draws.push(image.name); } }
  });
  for (const name of ["agentBodyLift", "drawAgentHead", "drawAgentFeet", "drawAgentAnimation", "drawAgentAttack", "drawAgentAppearanceBody"])
    runInContext(declaration(name), context);
  return { context, draws };
}

test("감지 유닛은 대기 외형을 유지하고 공격·피격은 속성 합성 애니메이션을 재생한다", () => {
  for (const action of ["idle", "attack", "hurt"]) for (const antenna of [1, 2]) {
    const render = rendering(action);
    const agent = { id: "bean:1", tribe: "bean", health: 12, attributes: { antenna }, stats: { capacity: 1 }, carrying: 0 };
    render.context.drawAgentAppearanceBody(render.context.drawing, 100, agent, 200,
      { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.deepEqual(render.draws, action === "idle" ? ["antenna", "body"] : ["embedded-sprout"]);
  }
});

test("발 속성은 분리한 양발을 그리고 무속성 유닛은 원본 애니메이션을 유지한다", () => {
  const render = rendering("idle");
  const agent = { id: "bean:1", tribe: "bean", health: 12, attributes: { feet: 1 }, stats: { capacity: 1 }, carrying: 0 };
  render.context.drawAgentAppearanceBody(render.context.drawing, 100, agent, 200,
    { x: 0, y: 0 }, { progress: 1 }, null, null);
  assert.deepEqual(render.draws, ["feet-left", "feet-right", "sprout-left", "sprout-right", "sprout-stem", "body"]);
  render.draws.length = 0;
  agent.attributes = {};
  render.context.drawAgentAppearanceBody(render.context.drawing, 100, agent, 200,
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
