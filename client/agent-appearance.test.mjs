import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../server/game.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { presentationRenderer } from "./unit-presentation-test-harness.mjs";

test("감지 유닛의 대기·공격·피격은 해당 외형의 완성 프레임 하나를 재생한다", async t => {
  const render = presentationRenderer(t);
  render.state.simSeconds = .1;
  for (const action of ["idle", "attack", "hurt"]) for (const antenna of [1, 2]) {
    const agent = { id: "bean:1", tribe: "bean", health: 12, attributes: { antenna },
      ...(action === "attack" ? { attack: { startedAt: 0 } } : {}),
      ...(action === "hurt" ? { hurtStartedAt: 0 } : {}) };
    const pose = unitActionArtPose(agent, .1);
    assert.equal(pose.action, action);
    assert.equal(pose.missing, false);
    await render.presentation.prepareAnimation(agent, .1);
    render.draws.length = 0;
    render.presentation.drawAgentAppearanceBody(render.context, 100, agent, 200, { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.equal(render.draws.length, 1);
    assert.equal(render.draws[0][0].src, pose.animation.image);
    assert.deepEqual(render.draws[0].slice(1, 5), [pose.frame % pose.animation.columns * pose.animation.frameSize,
      Math.floor(pose.frame / pose.animation.columns) * (pose.animation.frameHeight || pose.animation.frameSize), pose.animation.frameSize, pose.animation.frameHeight || pose.animation.frameSize]);
  }
});

test("퇴역한 발 속성은 기본 완성 애셋을 유지하고 부속지를 합성하지 않는다", async t => {
  const render = presentationRenderer(t), images = [];
  for (const attributes of [{ feet: 1 }, {}]) {
    const agent = { id: "bean:1", tribe: "bean", health: 12, attributes };
    const pose = unitActionArtPose(agent, 0);
    await render.presentation.prepareAnimation(agent, 0);
    render.draws.length = 0;
    render.presentation.drawAgentAppearanceBody(render.context, 0, agent, 200, { x: 0, y: 0 }, { progress: 1 }, null, null);
    assert.equal(render.draws.length, 1);
    assert.equal(render.draws[0][0].src, pose.animation.image);
    images.push(pose.animation.image);
  }
  assert.equal(images[0], images[1]);
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
