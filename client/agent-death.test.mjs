import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { imageFrameGeometry } from "./image-geometry.mjs";
import { imageDimensions } from "./image-audit.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { AGENT_DEATH_ANIMATION, AGENT_DEATH_ANIMATIONS, agentDeathAnimation, agentDeathFrame } from "./agent-death.mjs";
import { UNIT_ANIMATIONS } from "./unit-animation.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { presentationRenderer } from "./unit-presentation-test-harness.mjs";
import { unitTribeReference, unitAnimationSheetScale } from "./unit-presentation-assets.mjs";
import { hasCombatEvolution } from "./combat-attributes.mjs";
import { UNIT_DISPLAY_SIZES, unitDisplaySize, unitFrameMirror } from "./unit-size.mjs";

const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Tribes/sprout/AnimationStudies/death-v1/sequence.json", import.meta.url), "utf8"));
const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));

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
  const dimensions = imageDimensions(new URL("../" + AGENT_DEATH_ANIMATION.image, import.meta.url));
  assert.equal(dimensions[0], AGENT_DEATH_ANIMATION.frameSize * AGENT_DEATH_ANIMATION.columns);
  assert.equal(dimensions[1], AGENT_DEATH_ANIMATION.frameSize * AGENT_DEATH_ANIMATION.columns);
  assert.equal(AGENT_DEATH_ANIMATION.pivotX / AGENT_DEATH_ANIMATION.frameSize, metadata.runtimePivot[0] / metadata.runtimeFrameSize[0]);
  assert.equal(AGENT_DEATH_ANIMATION.pivotY / AGENT_DEATH_ANIMATION.frameSize, metadata.runtimePivot[1] / metadata.runtimeFrameSize[1]);
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

test("전투 사망은 사체 생성부터 재생하고 3초까지 마지막 자세를 유지한다", () => {
  {
    const { game, agent } = fixture();
    game.prepare(10); game.receiveDamage(agent, 10000);
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

test("실제 자연사와 타격 사체는 체력 필드 없이도 공용 사망 동작을 재생한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const cause of ["lifespan", "damage"]) {
    const { game, agent } = fixture();
    agent.tribe = tribe;
    if (cause === "lifespan") { game.prepare(300); game.tick(0); }
    else { game.prepare(10); game.receiveDamage(agent, 10000); }
    const corpse = game.snapshot().corpses.find(entry => entry.agentId === agent.id);
    assert.ok(corpse);
    assert.equal(corpse.health, undefined);
    const first = unitActionArtPose(corpse, corpse.diedAt);
    const later = unitActionArtPose(corpse, corpse.diedAt + .5);
    assert.equal(first.action, "death");
    assert.equal(first.missing, false);
    assert.equal(later.action, "death");
    assert.notEqual(later.frame, first.frame);
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

test("월드 사체와 목록 아이콘은 같은 완성 사망 애셋과 재생 프레임을 사용한다", async t => {
  const render = presentationRenderer(t), context = render.context;
  const corpse = { id: "corpse:1", agentId: "1", kind: "corpse", tribe: "bean", x: 5, y: 5, diedAt: 10, decaysAt: 13 };
  const scope = createContext({ AGENT_HEIGHT: .7, Spawner: {}, unitPresentation: render.presentation,
    corpsePlaybackTime: () => render.state.simSeconds,
    state: { corpses: [corpse], agents: [], rivals: [], camera: { zoom: 100 } }, ctx: context,
    worldToScreen: (x, y) => ({ x: x * 100, y: y * 100 }), objectOutlineColor: () => null,
    drawCorpseGroundShadow() {}, unitDisplayScale: () => 1,
    objectPanel: { hidden: false, getBoundingClientRect: () => ({ top: 0, bottom: 200 }) },
    document: { hidden: false }, window: { devicePixelRatio: 1 }, unitListEntries: () => [corpse],
    agentAvatars: new Map([[corpse.id, { context, canvas: { width: 80, height: 80, getBoundingClientRect: () => ({ width: 80, height: 80, top: 20, bottom: 100 }) } }]]),
    agentSprite() { throw new Error("사체에 서 있는 유닛 그림을 사용했습니다."); } });
  for (const name of ["drawAgentCorpse", "drawCorpses", "drawAgentAvatars"])
    runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const time of [10, 10.5, 12.26]) {
    corpse.tribe = tribe;
    render.state.simSeconds = time;
    const pose = unitActionArtPose(corpse, time);
    assert.equal(pose.action, "death");
    assert.equal(pose.missing, false);
    await render.presentation.prepareAnimation(corpse, time);
    render.draws.length = 0;
    scope.drawCorpses();
    assert.equal(render.draws.length, 1);
    const world = render.draws[0];
    assert.equal(world[0].src, pose.animation.image);
    assert.deepEqual(world.slice(1, 5), [pose.frame % pose.animation.columns * pose.animation.frameSize,
      Math.floor(pose.frame / pose.animation.columns) * (pose.animation.frameHeight || pose.animation.frameSize),
      pose.animation.frameSize, pose.animation.frameHeight || pose.animation.frameSize]);
    scope.agentAvatars.get(corpse.id).frame = null;
    scope.drawAgentAvatars(time * 1000);
    assert.equal(render.draws.length, 2);
    const avatar = render.draws[1];
    assert.deepEqual(avatar.slice(0, 5), world.slice(0, 5));
    assert.ok(Math.abs(avatar[7] / world[7] - .6) < 1e-9);
  }
  render.draws.length = 0;
  render.state.simSeconds = 13;
  scope.drawCorpses();
  assert.equal(render.draws.length, 0);
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
  const starter = { naturalWidth: 512, naturalHeight: 512, async decode() {} };
  const sheets = new Map(Object.values(UNIT_ANIMATIONS).flatMap(animations => Object.values(animations))
    .concat(Object.values(AGENT_DEATH_ANIMATIONS)).map(animation => [animation.image, animation]));
  const scope = createContext({
    Spawner: { unitDisplayAttributes, UNIT_ANIMATIONS, AGENT_DEATH_ANIMATIONS, agentDeathAnimation, unitTribeReference, unitAnimationSheetScale },
    SpawnerAssets: { image: () => ({ complete: true, naturalWidth: 2048, async decode() {} }) },
    assetSource: path => path, combatSheets: new Map(), sharedPresentation: null,
    agentMovementSheets: new Map(["bean", "spore", "pebble", "spring"].map(tribe => [tribe, {}])),
    unitAnimationReady: new Map(), starterObjectSprite: starter, prepareSproutCombatFrames() {},
    tribeArt: {
      prepareUnit: async () => ({ box: { width: 240, height: 350 } }),
      async prepareBounds(sprite, frame) { return this.bounds(sprite, frame); },
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
    Spawner: { unitDisplayAttributes, TALON_OWL_IDLE: { scale: 2, frameSize: 512, pivotX: 234, pivotY: 400 } }, state: { simSeconds: 0 } });
  runInContext(source.match(/^    function drawCreatureCorpse\([^]*?^    }/m)[0], scope);
  assert.equal(scope.drawCreatureCorpse(context, { species: "talon-owl", diedAt: 0 }, 0, 0, 100, null, 1), true);
  assert.deepEqual(draws, [[sprite, -200 * 234 / 512, -200 * 400 / 512, 200, 200]]);
});

test("중립·유니크의 사망 첫 자세는 원본 프레임 크기와 무관하게 승인된 체급을 유지한다", () => {
  for (const [species, target, frameSize, viewSize, displayScale] of [
    ["talon-owl", .78, 256, 256, .63],
    ["spring-keeper", .88, 288, 288, .67],
    ["walking-forest", 1.12, 256, 256, .85]
  ]) {
    const bounds = { width: frameSize * .7, height: frameSize * .8 };
    const animation = { frameSize, viewSize, pivotX: frameSize / 2, pivotY: frameSize * .875, columns: 1, frameCount: 1 };
    const entry = { sprite: { complete: true, naturalWidth: frameSize }, animation, scale: 1 };
    let renderedLength = 0;
    const context = { globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {},
      drawImage(sprite, x, y, width, height, left, top, outputWidth) {
        renderedLength = outputWidth * Math.max(bounds.width, bounds.height) / frameSize * displayScale;
      } };
    const scope = createContext({ Spawner: { unitDisplayAttributes, imageFrameGeometry, UNIT_DISPLAY_SIZES, unitDisplaySize, unitFrameMirror, unitAnimationFrame: () => 0 },
      tribeArt: { bounds: () => bounds }, unitDisplayScales: new Map([[species, displayScale]]),
      creatureDeathSheets: new Map([[species, entry]]), idleMotion: { matches: false }, state: { simSeconds: 0 }, corpsePlaybackTime: () => 0 });
    for (const name of ["prepareCreatureDeathSize", "drawCreatureDeath"])
      runInContext(source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"))[0], scope);
    scope.prepareCreatureDeathSize(species, entry);
    assert.equal(scope.drawCreatureDeath(context, { species, diedAt: 0 }, 0, 0, 100, null, 1), true);
    assert.ok(Math.abs(renderedLength - unitDisplaySize({ species }) * 100) < 1e-9, species);
  }
});
