import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { AGENT_DEATH_ANIMATION, AGENT_DEATH_ANIMATIONS, agentDeathAnimation, agentDeathFrame } from "./agent-death.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";

const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/sprout/AnimationStudies/death-v1/sequence.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

function fixture() {
  const colony = { id: 1, ownerId: "death-animation-test", tribe: "bean", x: 40, y: 40, occupiedCells: new Set(["2,2"]) };
  const environment = { simSeconds: 0, world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) }, colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  game.agents.splice(1);
  return { game, agent: game.agents[0] };
}

test("승인한 16프레임과 피벗·재생 시간을 런타임에서도 그대로 사용한다", () => {
  assert.deepEqual(AGENT_DEATH_ANIMATION.durationsMs, metadata.durationsMs);
  assert.equal(AGENT_DEATH_ANIMATION.frameCount, metadata.frameCount);
  assert.equal(AGENT_DEATH_ANIMATION.image, metadata.runtimeAtlas);
  assert.equal(AGENT_DEATH_ANIMATION.frameSize, metadata.runtimeFrameSize[0]);
  assert.equal(AGENT_DEATH_ANIMATION.pivotX / AGENT_DEATH_ANIMATION.frameSize, metadata.pivot[0] / metadata.frameSize[0]);
  assert.equal(AGENT_DEATH_ANIMATION.pivotY / AGENT_DEATH_ANIMATION.frameSize, metadata.pivot[1] / metadata.frameSize[1]);
  const corpse = { kind: "corpse", tribe: "bean", diedAt: 20 };
  let elapsed = 0;
  for (const [index, duration] of metadata.durationsMs.entries()) {
    assert.equal(agentDeathFrame(corpse, 20 + elapsed / 1000), index);
    assert.equal(agentDeathFrame(corpse, 20 + (elapsed + duration - 1) / 1000), index);
    elapsed += duration;
  }
  assert.equal(agentDeathFrame(corpse, 20 + elapsed / 1000), 15);
  assert.equal(agentDeathFrame(corpse, 79.999), 15);
});

test("자연사와 전투 사망 모두 사체 생성부터 재생하고 부패까지 마지막 자세를 유지한다", () => {
  for (const cause of ["age", "combat"]) {
    const { game, agent } = fixture();
    if (cause === "age") { game.prepare(180); game.tick(0); }
    else { game.prepare(10); game.receiveDamage(agent, 10000); }
    const corpse = game.snapshot().corpses.find(entry => entry.agentId === agent.id);
    assert.ok(corpse);
    assert.equal(game.agents.length, 0);
    assert.equal(agentDeathFrame(corpse, corpse.diedAt), 0);
    assert.equal(agentDeathFrame(corpse, corpse.diedAt + 0.5), 5);
    assert.equal(agentDeathFrame(corpse, corpse.decaysAt - 0.001), 15);
    game.prepare(corpse.decaysAt); game.tick(0);
    assert.equal(game.snapshot().corpses.length, 0);
  }
});

test("각 부족의 사망 그림을 고르고 오래된 사체는 마지막 자세를 유지한다", () => {
  for (const tribe of ["spore", "pebble", "spring"]) {
    assert.equal(agentDeathAnimation({ kind: "corpse", tribe }), AGENT_DEATH_ANIMATIONS[tribe]);
    assert.equal(agentDeathFrame({ kind: "corpse", tribe, diedAt: 0 }, 0), 0);
    assert.equal(agentDeathFrame({ kind: "corpse", tribe, diedAt: 0 }, 60), 7);
  }
  assert.equal(agentDeathFrame({ kind: "corpse", species: "spiny-back-beetle", diedAt: 0 }, 0), -1);
  assert.equal(agentDeathFrame({ kind: "food", diedAt: 0 }, 0), -1);
  assert.equal(agentDeathFrame({ kind: "corpse", tribe: "bean", diedAt: 1 }, 40), 15);
  assert.equal(agentDeathFrame({ kind: "corpse", tribe: "bean" }, 40), 15);
});

test("월드 사체 렌더러와 목록 아이콘이 같은 애셋을 사용하고 감소된 동작에서는 마지막 자세를 표시한다", () => {
  const draws = [], fallback = [];
  const context = { globalAlpha: 1, save() {}, restore() {}, translate() {}, drawImage(...args) { draws.push(args); }, setTransform() {}, clearRect() {} };
  const corpse = { id: "corpse:1", agentId: "1", kind: "corpse", tribe: "bean", x: 5, y: 5, diedAt: 10, decaysAt: 70, amount: 4 };
  const sheet = { complete: true, naturalWidth: 1024 };
  const scope = createContext({ AGENT_DEATH_ANIMATION, agentDeathFrame, AGENT_HEIGHT: 0.7, agentDeathSheet: sheet,
    Spawner: { agentDeathAnimation }, unitAnimationSheets: new Map(["bean", "spore", "pebble", "spring"].map(tribe =>
      [tribe, new Map([["death", { sprite: sheet, scale: .8 }]])])),
    corpsePlaybackTime: () => scope.state.simSeconds,
    state: { simSeconds: 10, camera: { zoom: 100 }, lastFrame: 0 }, idleMotion: { matches: false },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)), ctx: context,
    resourceNodeCells: () => [corpse], resourceNodePose: () => ({ visible: true, opacity: 1 }),
    worldToScreen: (x, y) => ({ x: x * 100, y: y * 100 }), objectOutlineColor: () => null,
    drawResourceNode: (...args) => fallback.push(args), objectPanel: { hidden: false, getBoundingClientRect: () => ({ top: 0, bottom: 200 }) },
    document: { hidden: false }, window: { devicePixelRatio: 1 }, unitListEntries: () => [corpse], agentAvatarIndex: 0,
    agentAvatars: new Map([[corpse.id, { context, canvas: { width: 80, height: 80, getBoundingClientRect: () => ({ width: 80, height: 80, top: 20, bottom: 100 }) } }]]),
    agentSprite() { throw new Error("사체에 서 있는 유닛 그림을 사용했습니다."); } });
  for (const name of ["drawAgentCorpse", "drawCorpses", "drawAgentAvatars"]) runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
  scope.drawCorpses(); assert.equal(draws[0][0], sheet); assert.deepEqual(draws[0].slice(1, 5), [0, 0, AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize]); assert.equal(fallback.length, 0);
  scope.state.simSeconds = 12.26; scope.drawCorpses(); assert.deepEqual(draws.at(-1).slice(1, 5), [3 * AGENT_DEATH_ANIMATION.frameSize, 3 * AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize]);
  scope.drawAgentAvatars(0); assert.equal(draws.at(-1)[0], sheet); assert.deepEqual(draws.at(-1).slice(1, 5), [3 * AGENT_DEATH_ANIMATION.frameSize, 3 * AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize]);
  assert.equal(draws.at(-1)[7], 80 * 1.65 * .7 * .8);
  scope.state.simSeconds = 10; scope.idleMotion.matches = true; scope.drawCorpses(); assert.deepEqual(draws.at(-1).slice(1, 5), [3 * AGENT_DEATH_ANIMATION.frameSize, 3 * AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize, AGENT_DEATH_ANIMATION.frameSize]);
  corpse.tribe = "spore"; scope.drawCorpses(); assert.equal(fallback.length, 0);
  assert.deepEqual(draws.at(-1).slice(1, 5), [3 * AGENT_DEATH_ANIMATIONS.spore.frameSize, AGENT_DEATH_ANIMATIONS.spore.frameSize, AGENT_DEATH_ANIMATIONS.spore.frameSize, AGENT_DEATH_ANIMATIONS.spore.frameSize]);
});

test("로컬 실행 목록과 생성된 번들에도 같은 사망 애셋과 프레임 계산이 포함된다", () => {
  const scope = createContext({});
  runInContext(readFileSync(new URL("./runtime.js", import.meta.url), "utf8"), scope);
  assert.equal(scope.Spawner.AGENT_DEATH_ANIMATION.image, AGENT_DEATH_ANIMATION.image);
  assert.equal(scope.Spawner.assets[AGENT_DEATH_ANIMATION.image], AGENT_DEATH_ANIMATION.image);
  assert.equal(scope.Spawner.agentDeathFrame({ kind: "corpse", tribe: "bean", diedAt: 0 }, 10), 15);
  const files = createContext({});runInContext(readFileSync(new URL("./local-assets.js", import.meta.url), "utf8"), files);
  const file = "./client/local-assets/" + AGENT_DEATH_ANIMATION.image.slice("DesignAssets/".length) + ".js";
  assert.ok(files.SpawnerLocalAssetFiles.includes(file));
  const data = createContext({ SpawnerLocalAssetSources: {} });runInContext(readFileSync(new URL("../" + file.slice(2), import.meta.url), "utf8"), data);
  const encoded = data.SpawnerLocalAssetSources[AGENT_DEATH_ANIMATION.image].split(",")[1];
  assert.ok(Buffer.from(encoded, "base64").equals(readFileSync(new URL("../" + AGENT_DEATH_ANIMATION.image, import.meta.url))));
});

test("모든 부족의 사망 첫 자세는 256·512 프레임 해상도와 무관하게 일반 유닛 크기에 맞춘다", async () => {
  const starter = { naturalWidth: 512, naturalHeight: 512 };
  const sheets = new Map(Object.values(UNIT_ANIMATIONS).flatMap(animations => Object.values(animations))
    .concat(Object.values(AGENT_DEATH_ANIMATIONS)).map(animation => [animation.image, animation]));
  const scope = createContext({
    Spawner: { UNIT_ANIMATIONS, AGENT_DEATH_ANIMATIONS, agentDeathAnimation },
    Image: class { complete = true; naturalWidth = 2048; async decode() {} },
    assetSource: path => path, combatSheets: new Map(),
    agentMovementSheets: new Map(["spore", "pebble", "spring"].map(tribe => [tribe, {}])),
    unitAnimationReady: new Map(), starterObjectSprite: starter, prepareSproutCombatFrames() {},
    tribeArt: {
      prepareUnit: async () => ({ box: { width: 240, height: 350 } }),
      bounds(sprite, frame) {
        if (sprite === starter) return { width: 512, height: 512 };
        const size = sheets.get(sprite.src).frameSize;
        assert.equal(frame === true ? 512 : frame, size);
        return { width: 240 * size / 512, height: 350 * size / 512 };
      }
    }
  });
  const start = source.indexOf("    const unitAnimationSheets =");
  runInContext(source.slice(start, source.indexOf("    const unitAnimationReady", start)) + "\nglobalThis.sheets = unitAnimationSheets;", scope);
  runInContext(source.match(/^    async function prepareUnitAnimationSheets\([^]*?^    }/m)[0], scope);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    await scope.prepareUnitAnimationSheets({ key: tribe });
    const entry = scope.sheets.get(tribe).get("death");
    assert.ok(entry, tribe);
    assert.equal(entry.animation, AGENT_DEATH_ANIMATIONS[tribe]);
    assert.equal(entry.scale, 1, tribe);
    assert.equal(entry.referenceHeight, 350, tribe);
  }
});

test("갈퀴부엉이 사체는 일반 자세와 같은 프레임·피벗·배율을 사용한다", () => {
  const draws = [];
  const sprite = { width: 512, height: 512 };
  const context = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage(...args) { draws.push(args); } };
  const scope = createContext({ talonOwlFrames: new Map([[0, sprite]]), encounterSprites: new Map(),
    Spawner: { TALON_OWL_IDLE: { scale: 2, frameSize: 512, pivotX: 234, pivotY: 400 } }, state: { simSeconds: 0 } });
  runInContext(source.match(/^    function drawCreatureCorpse\([^]*?^    }/m)[0], scope);
  assert.equal(scope.drawCreatureCorpse(context, { species: "talon-owl", diedAt: 0 }, 0, 0, 100, null, 1), true);
  assert.deepEqual(draws, [[sprite, -200 * 234 / 512, -200 * 400 / 512, 200, 200]]);
});
