import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";
import { CREATURE_WALK_ANIMATIONS, creatureWalkPose } from "./unit-animation.mjs";
import { imageDimensions } from "./image-audit.mjs";

test("생물 이동은 18종 원본과 유닛 페이지의 실제 시트·시간을 연결한다", () => {
  const design = readFileSync(new URL("../Design.html", import.meta.url), "utf8");
  assert.equal(ENCOUNTER_TYPES.length, 18);
  for (const type of ENCOUNTER_TYPES) {
    const animation = CREATURE_WALK_ANIMATIONS[type.key];
    assert.ok(animation, type.key);
    const manifest = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CreatureWalkV2/" + type.key + "/walk.json", import.meta.url), "utf8"));
    const row = design.match(new RegExp('<tr id="unit-' + type.key + '"[^>]*>([^]*?)</tr>'))[1];
    const cell = row.match(/<td data-action="walk"[^>]*>([^]*?)<\/td>/)[1];
    assert.equal(animation.image, manifest.image);
    assert.deepEqual(animation.durationsMs, manifest.durationsMs);
    assert.equal(animation.loop, true);
    assert.equal(cell.match(/data-preview="([^"]+)"/)[1], animation.image);
    assert.deepEqual(cell.match(/data-durations="([^"]+)"/)[1].split(",").map(Number), animation.durationsMs);
    assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)),
      [animation.columns * animation.frameSize, Math.ceil(animation.frameCount / animation.columns) * animation.frameSize]);
    for (const source of [...cell.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1])) {
      assert.ok(existsSync(new URL("../" + source, import.meta.url)), source);
    }
  }
});

test("생물 이동은 실제 이동 구간에만 재생하고 정지·전투·사망에는 나오지 않는다", () => {
  for (const type of ENCOUNTER_TYPES) {
    const agent = { species: type.key, health: 10, mode: "walk", moveStartedAt: 5, moveDuration: 2, stepCount: 1 };
    assert.equal(creatureWalkPose(agent, 4.9), null);
    assert.equal(creatureWalkPose(agent, 7), null);
    assert.equal(creatureWalkPose(agent, 5).frame, 0);
    const movingFrames = [.137, .365, .659, .917].map(progress => creatureWalkPose(agent, 5 + progress * 2).frame);
    assert.ok(new Set(movingFrames).size > 1);
    agent.stepCount++;
    agent.moveStartedAt = 7;
    assert.ok(creatureWalkPose(agent, 7));
    agent.mode = "idle";
    assert.equal(creatureWalkPose(agent, 7.5), null);
    agent.mode = "fight";
    assert.equal(creatureWalkPose(agent, 7.5), null);
    agent.mode = "walk";
    agent.health = 0;
    assert.equal(creatureWalkPose(agent, 7.5), null);
    agent.health = 10;
    agent.moveDuration = 0;
    assert.equal(creatureWalkPose(agent, 7), null);
  }
  assert.equal(creatureWalkPose({ species: "spiny-back-beetle" }, 0), null);
});
