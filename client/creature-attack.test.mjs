import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";
import { CREATURE_ATTACK_TIMINGS } from "../server/creature-attack.mjs";
import { CREATURE_ATTACK_ANIMATIONS, UNIT_ANIMATION_ASSETS, creatureAttackPose } from "./unit-animation.mjs";
import { imageDimensions } from "./image-audit.mjs";

test("18종 공격은 승인된 V2 프레임과 서버 명중 시간을 사용한다", () => {
  assert.deepEqual(Object.keys(CREATURE_ATTACK_ANIMATIONS).sort(), ENCOUNTER_TYPES.map(type => type.key).sort());
  for (const [species, animation] of Object.entries(CREATURE_ATTACK_ANIMATIONS)) {
    const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Animations/CreatureAttackV2/" + species + "/attack.json", import.meta.url), "utf8"));
    assert.deepEqual(animation.durationsMs, metadata.durationsMs, species);
    assert.equal(animation.frameCount, metadata.frameCount, species);
    assert.equal(animation.durationMs, CREATURE_ATTACK_TIMINGS[species].durationMs, species);
    assert.equal(animation.durationsMs.slice(0, metadata.impactFrame).reduce((sum, value) => sum + value, 0),
      CREATURE_ATTACK_TIMINGS[species].hitTimeMs, species);
    assert.equal(animation.loop, false, species);
    assert.equal(animation.facing, "left", species);
    assert.ok(UNIT_ANIMATION_ASSETS.includes(animation.image), species);
    assert.deepEqual(imageDimensions(new URL("../" + animation.image, import.meta.url)),
      [animation.columns * animation.frameSize, Math.ceil(animation.frameCount / animation.columns) * animation.frameSize], species);
    assert.ok(animation.viewSize > 0 && Number.isFinite(animation.pivotX) && Number.isFinite(animation.pivotY), species);
  }
});

test("공격 자세는 종별 프레임 경계와 속도·방향을 따르고 종료 뒤 남지 않는다", () => {
  for (const [species, animation] of Object.entries(CREATURE_ATTACK_ANIMATIONS)) {
    const agent = { species, health: 100, facing: -1, attack: { startedAt: 10, speed: 2, directionX: -1 } };
    assert.equal(creatureAttackPose(agent, 9.999), null, species);
    let elapsed = 0;
    for (const [frame, duration] of animation.durationsMs.entries()) {
      const pose = creatureAttackPose(agent, 10 + elapsed / 2000);
      assert.equal(pose.frame, frame, species);
      assert.equal(pose.mirrorX, false, species);
      elapsed += duration;
    }
    assert.equal(creatureAttackPose(agent, 10 + elapsed / 2000), null, species);
    agent.attack.directionX = 1;
    assert.equal(creatureAttackPose(agent, 10).mirrorX, true, species);
    assert.equal(creatureAttackPose({ ...agent, health: 0 }, 10), null, species);
    assert.equal(creatureAttackPose({ ...agent, attack: null }, 10), null, species);
    assert.equal(creatureAttackPose({ ...agent, attack: { startedAt: NaN } }, 10), null, species);
  }
  assert.equal(creatureAttackPose({ species: "spiny-back-beetle", health: 100, attack: { startedAt: 0 } }, .1), null);
});

test("실제 게임은 피격 다음에 새 공격을 그리며 공격 원화는 상대 방향을 향한다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const calls = [];
  let hurt = true;
  const context = createContext({ displayedAgent: agent => agent, state: { camera: { zoom: 64 } }, viewport: { width: 500, height: 500 },
    interpolatedAgentPosition: () => ({ x: 1, y: 1 }), worldToScreen: () => ({ x: 64, y: 64 }), agentBirthPose: () => null,
    drawAgentConstruction: () => false,
    drawCreatureHurt: () => { calls.push("hurt"); return hurt; }, drawCreatureAttack: () => { calls.push("attack"); return true; } });
  runInContext(source.match(/^    function drawAgentBody\([^]*?^    }/m)[0], context);
  context.drawAgentBody(0, { species: "dew-rabbit", mode: "fight" });
  assert.deepEqual(calls, ["hurt"]);
  calls.length = 0;
  hurt = false;
  context.drawAgentBody(0, { species: "dew-rabbit", mode: "fight" });
  assert.deepEqual(calls, ["hurt", "attack"]);
  const animation = CREATURE_ATTACK_ANIMATIONS["dew-rabbit"], mirrors = [];
  const renderer = createContext({ Spawner: { creatureAttackPose }, state: { simSeconds: 10, camera: { zoom: 64 } },
    creatureAttackSheets: new Map([["dew-rabbit", { animation, sprite: { complete: true, naturalWidth: animation.frameSize * animation.columns }, scale: 1 }]]),
    worldToScreen: () => ({ x: 0, y: 0 }), objectOutlineColor: () => null,
    ctx: { save() {}, restore() {}, translate() {}, scale(x) { mirrors.push(x); }, drawImage() {} } });
  runInContext(source.match(/^    function drawCreatureAttack\([^]*?^    }/m)[0], renderer);
  for (const directionX of [-1, 1]) assert.equal(renderer.drawCreatureAttack({ species: "dew-rabbit", health: 100,
    attack: { startedAt: 10, directionX } }, { x: 0, y: 0 }), true);
  assert.deepEqual(mirrors, [1, -1]);
});
