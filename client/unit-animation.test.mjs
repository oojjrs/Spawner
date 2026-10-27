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

const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");

function cell(unit, action) {
  const row = design.match(new RegExp('<tr id="unit-' + unit + '"[^>]*>([^]*?)</tr>'))[1];
  return row.match(new RegExp('<td data-action="' + action + '"[^>]*>([^]*?)</td>'))[1];
}

test("기획서와 같은 종족별 원본·프레임·반복·재생 시간을 사용한다", () => {
  const keys = { bean: "sprout-bean", spore: "spore-tribe", pebble: "pebble-tribe", spring: "spring-tribe" };
  for (const [tribe, animations] of Object.entries(UNIT_ANIMATIONS)) for (const [action, animation] of Object.entries(animations)) {
    const html = cell(keys[tribe], action);
    const path = html.match(/data-preview="([^"]+)"/)?.[1] || html.match(/href="([^"]+)"/)[1];
    const durations = html.match(/data-durations="([^"]+)"/)[1].split(",").map(Number);
    assert.equal(animation.image, path, tribe + " " + action);
    assert.deepEqual(animation.durationsMs, durations, tribe + " " + action);
    assert.equal(animation.frameCount, durations.length);
    assert.equal(animation.loop, html.includes('data-loop="true"'));
    assert.ok(existsSync(new URL("../" + path, import.meta.url)));
    let elapsed = 0;
    for (const [frame, duration] of durations.entries()) {
      assert.equal(unitAnimationFrame(animation, elapsed), frame);
      assert.equal(unitAnimationFrame(animation, elapsed + duration - .001), frame);
      elapsed += duration;
    }
    assert.equal(unitAnimationFrame(animation, elapsed), animation.loop ? 0 : animation.frameCount - 1);
  }
  for (const tribe of PLAYER_TRIBES) {
    assert.equal(tribe.idle, UNIT_ANIMATIONS[tribe.key].idle.image);
    assert.equal(tribe.frames * tribe.frameMs, UNIT_ANIMATIONS[tribe.key].idle.durationMs);
  }
  for (const [species, animation] of Object.entries(CREATURE_IDLE_ANIMATIONS)) {
    const html = cell(species, "idle");
    const path = html.match(/data-preview="([^"]+)"/)?.[1] || html.match(/href="([^"]+)"/)[1];
    assert.ok(existsSync(new URL("../" + path, import.meta.url)), species + " 원본");
    if (animation.image !== path) {
      const metadataPath = animation.image.replace(/[^/]+$/, "runtime.json");
      const metadata = JSON.parse(readFileSync(new URL("../" + metadataPath, import.meta.url), "utf8"));
      const hash = createHash("sha256").update(readFileSync(new URL("../" + path, import.meta.url))).digest("hex");
      assert.equal(metadata.sourceAtlasSha256, hash, species + " 런타임 출처");
      assert.equal(metadata.image, animation.image);
      assert.equal(metadata.frameSize, animation.frameSize);
      assert.equal(metadata.columns, animation.columns);
      assert.equal(metadata.loop, animation.loop);
      assert.equal(metadata.pivotX, animation.pivotX);
      assert.equal(metadata.pivotY, animation.pivotY);
      assert.deepEqual(metadata.durationsMs, animation.durationsMs);
      const original = imageDimensions(new URL("../" + path, import.meta.url));
      const runtime = imageDimensions(new URL("../" + animation.image, import.meta.url));
      assert.ok(metadata.sourceScale > 0 && metadata.sourceScale <= 1);
      assert.deepEqual(runtime, original.map(value => value * metadata.sourceScale));
      assert.equal(runtime[0], animation.columns * animation.frameSize);
      assert.equal(runtime[1], Math.ceil(animation.frameCount / animation.columns) * animation.frameSize);
      const policy = JSON.parse(readFileSync(new URL("../DesignAssets/image-sizes.json", import.meta.url), "utf8"));
      const size = policy.images[animation.image];
      assert.ok(size, species + " 표시 크기 등록");
      assert.deepEqual(size.grid, [animation.columns, Math.ceil(animation.frameCount / animation.columns)]);
      assert.ok(size.display.every(value => value > 0));
      assert.ok(size.display.every(value => animation.frameSize <= value * policy.maximumScale));
    }
    assert.deepEqual(animation.durationsMs, cell(species, "idle").match(/data-durations="([^"]+)"/)[1].split(",").map(Number));
  }
});

test("속성이 있어도 피격·공격을 재생하고 채집·운반·투척·대기를 실제 상태로 선택한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const agent = { id: tribe, tribe, health: 10, attributes: { strength: 1, feet: 1, antenna: 1, lifespan: 1 },
      mode: "idle", hurtStartedAt: -10, bornAt: 0, moveDuration: 0, carrying: 0 };
    assert.equal(unitAnimationPose(agent, .1).action, "idle");
    agent.attack = { startedAt: 0, speed: 1 };
    assert.equal(unitAnimationPose(agent, .1).action, "attack");
    agent.hurtStartedAt = 0;
    assert.equal(unitAnimationPose(agent, .1).action, "hurt");
    agent.hurtStartedAt = -10;agent.attack = null;
    if (tribe === "bean") continue;
    agent.mode = "harvest";agent.harvestStarted = 0;agent.carryingType = "honey-mushrooms";
    assert.equal(unitAnimationPose(agent, .1), null);
    agent.mode = "unload";agent.foodDelivery = { startedAt: 0, arrivesAt: 1, resourceType: "honey-mushrooms" };
    assert.equal(unitAnimationPose(agent, .1), null);
    agent.mode = "return";agent.moveStartedAt = 0;agent.moveDuration = 1;agent.carrying = 1;
    assert.equal(unitAnimationPose(agent, .1).action, "walk");
    agent.carrying = 0;
    assert.equal(unitAnimationPose(agent, .1).action, "walk");
    agent.mode = "jump";
    assert.equal(unitAnimationPose(agent, .1).action, "jump");
  }
});

test("포자버섯 탄생은 기획서 22프레임과 2.48초를 사용하고 분리 후 목표에 착지한다", () => {
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/spore/AnimationStudies/birth-size-v3/birth.json", import.meta.url), "utf8"));
  assert.deepEqual(SPORE_BIRTH_ANIMATION.durationsMs, metadata.durationsMs);
  assert.equal(SPORE_BIRTH_ANIMATION.frameCount, metadata.frameCount);
  assert.equal(agentBirthDuration("spore"), 2.48);
  assert.equal(sporeBirthPlacement(0, { x: 2, y: 3 }, { x: 5, y: 6 }, 1).unitVisible, false);
  assert.equal(sporeBirthPlacement(.82, { x: 2, y: 3 }, { x: 5, y: 6 }, 1).unitVisible, true);
  const landed = sporeBirthPlacement(2.479, { x: 2, y: 3 }, { x: 5, y: 6 }, 1);
  assert.equal(landed.frame, 21);assert.equal(landed.rootX, 5);assert.equal(landed.rootY, 6);
  assert.equal(sporeBirthPlacement(2.48, { x: 2, y: 3 }, { x: 5, y: 6 }, 1), null);
  assert.deepEqual([...sporeBirthPixels(new Uint8ClampedArray([10,20,30,255,120,130,140,255]),
    new Uint8ClampedArray([10,20,30,255,0,0,0,0]))], [0,0,0,0,120,130,140,255]);
});

test("이전 저장의 포자버섯 탄생 시간도 2.48초로 복구하며 탄생 중에는 행동하지 않는다", () => {
  const colony = { id: 1, ownerId: "spore-animation", tribe: "spore", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());saved.state.evolutionPoints = 500;game.restore(JSON.stringify(saved));
  const result = game.command({ type: "design", templateId: null, name: "포자버섯", slots: [], birth: true });
  const agent = game.agents.find(value => value.id === result.agentId);
  assert.equal(agent.birth.readyAt, 2.48);
  const previous = JSON.parse(game.save());previous.state.agents.find(value => value.id === agent.id).birth.readyAt = 3.85;
  game.restore(JSON.stringify(previous));
  const restored = game.agents.find(value => value.id === agent.id);
  assert.equal(restored.birth.readyAt, 2.48);
  game.prepare(2.479);game.tick(.001);assert.equal(restored.mode, "birth");assert.equal(restored.stepCount, 0);
  game.prepare(2.481);game.tick(.002);assert.equal(restored.birth, null);
});
