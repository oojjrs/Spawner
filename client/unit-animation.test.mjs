import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { imageDimensions } from "./image-audit.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, unitAnimationFrame, unitAnimationPose } from "./unit-animation.mjs";
import { SPORE_BIRTH_ANIMATION, sporeBirthPlacement, sporeBirthPixels } from "./birth.mjs";
import { agentBirthDuration } from "../server/birth.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { createGame } from "../server/game.mjs";

test("속성이 있어도 피격·공격을 재생하고 채집·운반·투척·대기를 실제 상태로 선택한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const agent = { id: tribe, tribe, health: 10, attributes: { strength: 1, feet: 1, antenna: 1 },
      mode: "idle", hurtStartedAt: -10, bornAt: 0, moveDuration: 0, carrying: 0 };
    assert.equal(unitAnimationPose(agent, .1).action, "idle");
    agent.attack = { startedAt: 0, speed: 1 };
    assert.equal(unitAnimationPose(agent, .1).action, "attack");
    agent.hurtStartedAt = 0;
    assert.equal(unitAnimationPose(agent, .1).action, "hurt");
    agent.hurtStartedAt = -10;agent.attack = null;
    if (tribe === "bean") continue;
    agent.mode = "harvest";agent.harvestStarted = 0;agent.carryingType = "honey-mushrooms";
    assert.equal(unitAnimationPose(agent, .1).action, "harvest");
    agent.mode = "unload";agent.foodDelivery = { startedAt: 0, arrivesAt: 1, resourceType: "honey-mushrooms" };
    assert.equal(unitAnimationPose(agent, .1).action, "throw");
    agent.mode = "return";agent.moveStartedAt = 0;agent.moveDuration = 1;agent.carrying = 1;
    assert.equal(unitAnimationPose(agent, .1).action, "walk");
    agent.carrying = 0;
    assert.equal(unitAnimationPose(agent, .1).action, "walk");
    agent.mode = "jump";
    assert.equal(unitAnimationPose(agent, .1).action, "jump");
  }
});

test("포자버섯 탄생은 기획서 22프레임과 3.12초를 사용하고 분리 후 목표에 착지한다", () => {
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth.json", import.meta.url), "utf8"));
  assert.deepEqual(SPORE_BIRTH_ANIMATION.durationsMs, metadata.durationsMs);
  assert.equal(SPORE_BIRTH_ANIMATION.frameCount, metadata.frameCount);
  assert.equal(agentBirthDuration("spore"), 3.12);
  assert.equal(sporeBirthPlacement(0, { x: 2, y: 3 }, { x: 5, y: 6 }, 1).unitVisible, false);
  assert.equal(sporeBirthPlacement(.82, { x: 2, y: 3 }, { x: 5, y: 6 }, 1).unitVisible, true);
  const landed = sporeBirthPlacement(3.119, { x: 2, y: 3 }, { x: 5, y: 6 }, 1);
  assert.equal(landed.frame, 21);assert.equal(landed.rootX, 5);assert.equal(landed.rootY, 6);
  assert.equal(sporeBirthPlacement(3.12, { x: 2, y: 3 }, { x: 5, y: 6 }, 1), null);
  assert.deepEqual([...sporeBirthPixels(new Uint8ClampedArray([10,20,30,255,120,130,140,255]),
    new Uint8ClampedArray([10,20,30,255,0,0,0,0]))], [0,0,0,0,120,130,140,255]);
});

test("이전 저장의 포자버섯 탄생 시간도 3.12초로 복구하며 탄생 중에는 행동하지 않는다", () => {
  const colony = { id: 1, ownerId: "spore-animation", tribe: "spore", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());saved.state.agents.splice(1);saved.state.evolutionPoints = 500;game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "포자버섯", slots: [], birth: true });
  assert.ok(result.agentId);
  const agent = game.agents.find(value => value.id === result.agentId);
  assert.equal(agent.birth.readyAt, 3.12);
  const previous = JSON.parse(game.save());previous.state.agents.find(value => value.id === agent.id).birth.readyAt = 3.85;
  game.restore(JSON.stringify(previous));
  const restored = game.agents.find(value => value.id === agent.id);
  assert.equal(restored.birth.readyAt, 3.12);
  game.prepare(3.119);game.tick(.001);assert.equal(restored.mode, "birth");assert.equal(restored.stepCount, 0);
  game.prepare(3.121);game.tick(.002);assert.equal(restored.birth, null);
});

test("몽돌의 40ms 원본 프레임은 이동 속도와 관계없이 연속 재생한다", () => {
  const agent = { tribe: "pebble", health: 10, mode: "search", bornAt: 0, hurtStartedAt: -10,
    moveStartedAt: 0, moveAnimationStartedAt: 0, moveDuration: 2, stepCount: 1, attributes: {} };
  for (const duration of [1.25, 2, 10 / 3]) {
    agent.moveDuration = duration;
    for (const [time, frame] of [[.2, 5], [.4, 10], [.8, 0]]) assert.equal(unitAnimationPose(agent, time).frame, frame);
  }
  agent.moveDuration = 2;
  assert.equal(unitAnimationPose(agent, 2 - .000001).frame, 9);
  agent.moveStartedAt = 2; agent.stepCount = 2;
  assert.equal(unitAnimationPose(agent, 2).frame, 10);
});
