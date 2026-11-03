import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createContext, runInContext } from "node:vm";
import { ENCOUNTER_TYPES } from "../server/encounter-types.mjs";
import { ENCOUNTER_PLANS } from "../server/map.mjs";
import { BURROW_TYPES } from "../server/burrows.mjs";
import { generateWildlife } from "../server/ecology.mjs";
import { WORLD_GENERATION_VERSION } from "../server/world.mjs";
import { CREATURE_DEATH_ANIMATIONS, UNIT_ANIMATION_ASSETS, unitAnimationFrame } from "./unit-animation.mjs";
import { nestIdleAnimation, nestIdleFrame, createNestGrowthPlayback, syncNestGrowthPlayback } from "./nest-growth.mjs";
import { imageDimensions } from "./image-audit.mjs";

const root = new URL("../", import.meta.url);
const design = readFileSync(new URL("Design.html", root), "utf8");

test("일반 생물과 굴의 보충 주기가 기획서의 분·초 수치와 일치한다", () => {
  for (const type of ENCOUNTER_TYPES.filter(type => !type.unique)) {
    const plan = ENCOUNTER_PLANS.find(plan => plan.key === type.key);
    const minutes = Number(plan.respawn.match(/(\d+)분/)[1]);
    assert.equal(type.respawnSeconds, minutes * 60, type.key);
  }
  const rule = ENCOUNTER_PLANS.find(plan => plan.key === "spiny-back-beetle").respawn;
  assert.equal(BURROW_TYPES.small.spawnInterval, Number(rule.match(/작은 굴 (\d+)초/)[1]));
  assert.equal(BURROW_TYPES.large.spawnInterval, Number(rule.match(/큰 굴 (\d+)초/)[1]));
});

test("새 월드는 유니크마다 한 거점만 만들고 이전 세대의 거점 생성 규칙은 보존한다", () => {
  const count = 320 * 320;
  const world = { seed: 13, terrain: new Uint8Array(count).fill(5), hazards: new Uint8Array(count),
    blocked: new Uint8Array(count), reachable: new Int16Array(count), nestDistance: new Float32Array(count).fill(100),
    waterDistance: new Uint8Array(count), resourceCells: new Set(), generationVersion: WORLD_GENERATION_VERSION };
  const plans = ENCOUNTER_PLANS.filter(plan => plan.unique);
  assert.equal(WORLD_GENERATION_VERSION, 34);
  for (const plan of generateWildlife(world, plans)) {
    assert.equal(plan.populationLimit, 1, plan.key);
    assert.equal(plan.spawnPoints.length, 1, plan.key);
  }
  world.generationVersion = 23;
  assert.ok(generateWildlife(world, [plans[0]])[0].populationLimit > 1);
});

test("기획서에 사망 애니메이션이 있는 생물 18종을 모두 게임에 연결한다", () => {
  const species = ENCOUNTER_TYPES.map(type => type.key).sort();
  assert.deepEqual(Object.keys(CREATURE_DEATH_ANIMATIONS).sort(), species);
  for (const key of species) {
    const animation = CREATURE_DEATH_ANIMATIONS[key];
    assert.ok(UNIT_ANIMATION_ASSETS.includes(animation.image), key);
    assert.deepEqual(imageDimensions(new URL(animation.image, root)),
      [animation.columns * animation.frameSize, Math.ceil(animation.frameCount / animation.columns) * animation.frameSize], key);
    assert.equal(unitAnimationFrame(animation, animation.durationMs + 1000), animation.frameCount - 1, key);
    assert.equal(animation.loop, false, key);
  }
});

test("사망 시트 9종은 원본 프레임 순서·시간과 등록된 런타임 피벗을 사용한다", () => {
  for (const key of ["flower-tail-bird", "rolling-acorn", "snare-vine", "dew-rabbit", "cotton-sheep", "soil-boar", "talon-owl", "spring-keeper", "white-paw"]) {
    const animation = CREATURE_DEATH_ANIMATIONS[key];
    const metadata = JSON.parse(readFileSync(new URL(animation.image.replace("runtime.webp", "runtime.json"), root), "utf8"));
    const original = JSON.parse(readFileSync(new URL(metadata.sourceAtlas.replace("death.webp", "death.json"), root), "utf8"));
    const row = design.match(new RegExp('<tr id="unit-' + key + '"[^>]*>([^]*?)</tr>'))[1];
    assert.ok(row.match(/<td data-action="death"[^]*?<\/td>/)[0].includes(animation.image), key);
    assert.equal(createHash("sha256").update(readFileSync(new URL(metadata.sourceAtlas, root))).digest("hex"), metadata.sourceAtlasSha256, key);
    assert.deepEqual(animation.durationsMs, original.durationsMs, key);
    assert.equal(animation.frameSize, metadata.frameSize, key);
    assert.equal(animation.pivotX, metadata.pivotX, key);
    assert.equal(animation.pivotY, metadata.pivotY, key);
  }
});

test("사망 렌더러가 연결된 시트의 마지막 프레임을 유효한 크기로 표시한다", () => {
  const source = readFileSync(new URL("client/game.js", root), "utf8");
  for (const animation of Object.values(CREATURE_DEATH_ANIMATIONS)) {
    const draws = [], sprite = { complete: true, naturalWidth: animation.columns * animation.frameSize };
    const context = { globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { draws.push(args); } };
    const scope = createContext({ creatureDeathSheets: new Map([["test", { sprite, animation, scale: 1 }]]),
      idleMotion: { matches: false }, Spawner: { unitAnimationFrame }, corpsePlaybackTime: () => 100,
      state: { simSeconds: 100 }, clamp: (value, low, high) => Math.max(low, Math.min(high, value)) });
    runInContext(source.match(/^    function drawCreatureDeath\([^]*?^    }/m)[0], scope);
    assert.equal(scope.drawCreatureDeath(context, { species: "test", diedAt: 0 }, 0, 0, 100, null, 1), true);
    const frame = animation.frameCount - 1;
    assert.deepEqual(draws[0].slice(1, 5), [frame % animation.columns * animation.frameSize,
      Math.floor(frame / animation.columns) * animation.frameSize, animation.frameSize, animation.frameSize]);
    assert.ok(draws[0].slice(1).every(Number.isFinite));
  }
});

test("몽돌 3레벨 대기는 기획서의 6초 루프와 처음 2050ms 정지를 유지한다", () => {
  const animation = nestIdleAnimation("pebble", 3);
  const source = new URL("DesignAssets/Animations/Nests/Idle03-v1/pebble/idle.webp", root);
  const bytes = readFileSync(source), durations = [];
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    if (bytes.toString("ascii", offset, offset + 4) === "ANMF") durations.push(bytes.readUIntLE(offset + 20, 3));
    offset += 8 + length + length % 2;
  }
  assert.equal(animation.frameCount, durations.length);
  assert.deepEqual(animation.durationsMs, durations);
  assert.equal(animation.periodMs, durations.reduce((sum, value) => sum + value, 0));
  const colony = { id: "pebble", tribe: "pebble", nestLevel: 3, nestHealth: 100 };
  const playback = createNestGrowthPlayback();
  syncNestGrowthPlayback(playback, [colony], 0, true);
  let elapsed = 0;
  for (const [frame, duration] of durations.entries()) {
    assert.equal(nestIdleFrame(playback, colony, elapsed / 1000, false), frame);
    assert.equal(nestIdleFrame(playback, colony, (elapsed + duration - .001) / 1000, false), frame);
    elapsed += duration;
  }
  assert.equal(nestIdleFrame(playback, colony, 6, false), 0);
  assert.equal(nestIdleFrame(playback, colony, 3, true), 0);
});
