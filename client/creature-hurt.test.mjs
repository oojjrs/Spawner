import { readDesignSection } from "./design-test-fixture.mjs";
import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREATURE_HURT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, UNIT_ANIMATION_ASSETS, creatureHurtPose } from "./unit-animation.mjs";
import { TALON_OWL_IDLE } from "./talon-owl-idle.mjs";
import { UNIT_COMBAT_STATS } from "../server/combat-stats.mjs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { AGENT_HURT_DURATION } from "../server/attack.mjs";
import { imageDimensions } from "./image-audit.mjs";
import { createContext, runInContext } from "node:vm";

test("모든 일반·유니크 생물의 피격이 원화 등록과 전투 시간을 유지한다", () => {
  const creatures = Object.keys(UNIT_COMBAT_STATS).filter(key => key !== "spiny-back-beetle" && !PLAYER_TRIBES.some(tribe => tribe.key === key));
  assert.deepEqual(Object.keys(CREATURE_HURT_ANIMATIONS).sort(), creatures.sort());
  const design = readDesignSection("unit-appearance");
  const reference = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/UnitHurt/V3/hurt.json", import.meta.url), "utf8"));
  for (const [species, animation] of Object.entries(CREATURE_HURT_ANIMATIONS)) {
    const idle = CREATURE_IDLE_ANIMATIONS[species] || TALON_OWL_IDLE;
    const metadata = JSON.parse(readFileSync(new URL("../" + animation.image.replace(/\.webp$/, ".json"), import.meta.url), "utf8"));
    assert.equal(animation.frameSize, idle.frameSize, species);
    assert.ok(Math.abs(animation.pivotX - idle.pivotX) < .000001, species);
    assert.ok(Math.abs(animation.pivotY - idle.pivotY) < .000001, species);
    assert.equal(animation.durationMs, AGENT_HURT_DURATION * 1000, species);
    assert.equal(animation.loop, false, species);
    assert.deepEqual(animation.durationsMs, metadata.durationsMs, species);
    assert.deepEqual(animation.durationsMs, reference.durationsMs, species);
    assert.equal(metadata.closedEyeHold.durationMs, reference.closedEyeHold.durationMs, species);
    assert.ok(UNIT_ANIMATION_ASSETS.includes(animation.image), species);
    assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)),
      [animation.frameSize * animation.columns, animation.frameSize * Math.ceil(animation.frameCount / animation.columns)], species);
    const row = design.match(new RegExp('<tr id="unit-' + species + '"[^>]*>[^]*?</tr>'))[0];
    const cell = row.match(/<td data-action="hurt"[^>]*>[^]*?<\/td>/)[0];
    assert.ok(!cell.includes('data-missing="true"'), species);
    assert.ok(cell.includes('href="' + animation.image + '"'), species);
    assert.ok(cell.includes('data-durations="' + animation.durationsMs.join(',') + '"'), species);
    assert.deepEqual(imageDimensions(new URL("../DesignAssets/Planning/UnitPreviews/" + species + "/hurt.webp", import.meta.url)), [64, 64], species);
  }
});

test("피격 시작·프레임 경계·종료와 재피격은 시뮬레이션 시간을 따른다", () => {
  for (const [species, animation] of Object.entries(CREATURE_HURT_ANIMATIONS)) {
    const agent = { species, health: 100, hurtStartedAt: 10, mode: "walk", moveDuration: 1, moveStartedAt: 10 };
    assert.equal(creatureHurtPose({ ...agent, hurtStartedAt: undefined }, 10), null);
    assert.equal(creatureHurtPose(agent, 9.99), null);
    let elapsed = 0;
    for (const [frame, duration] of animation.durationsMs.entries()) {
      assert.equal(creatureHurtPose(agent, 10 + elapsed / 1000).frame, frame, species);
      elapsed += duration;
    }
    assert.equal(creatureHurtPose(agent, 10 + AGENT_HURT_DURATION), null, species);
    assert.equal(creatureHurtPose({ ...agent, hurtStartedAt: 10.5 }, 10.5).frame, 0, species);
    assert.equal(creatureHurtPose({ ...agent, health: 0 }, 10.2), null, species);
  }
});

test("게임은 이동·대기보다 피격을 먼저 그린다", () => {
  const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));
  const declaration = source.match(/^    function drawAgentUnscaledBody\([^]*?^    }/m)[0];
  const calls = [];
  const context = createContext({ displayedAgent: agent => agent, state: { camera: { zoom: 64 } }, viewport: { width: 500, height: 500 },
    interpolatedAgentPosition: () => ({ x: 1, y: 1 }), worldToScreen: () => ({ x: 64, y: 64 }), agentBirthPose: () => null,
    drawAgentConstruction: () => false, drawCreatureSpawn: () => false,
    creatureIdleSheets: new Map([["dew-rabbit", { sprite: { complete: true, naturalWidth: 512 } }]]),
    unitDisplayBounds: new Map([["dew-rabbit", {}]]),
    drawCreatureHurt: () => { calls.push("hurt"); return true; }, drawCreatureWalk: () => { calls.push("walk"); return true; } });
  runInContext(declaration, context);
  context.drawAgentUnscaledBody(0, { species: "dew-rabbit" });
  assert.deepEqual(calls, ["hurt"]);
});
