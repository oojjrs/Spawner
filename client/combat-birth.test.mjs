import { createUnitPresentation } from "./unit-presentation.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import { unitFacing, unitFrameMirror, unitDisplaySize } from "./unit-size.mjs";
import { imageDimensions } from "./image-audit.mjs";
import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { agentBirthDuration, agentBirthMotion } from "../server/birth.mjs";
import { SPORE_BIRTH_ANIMATION, sporeBirthPlacement, SPRING_BIRTH_ANIMATION, springBirthPlacement,
  PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement } from "./birth.mjs";

const source = unitPresentationTestSource(readFileSync(new URL("./game.js", import.meta.url), "utf8"));
const tribes = ["bean", "spore", "pebble", "spring"];
const combatKeys = ["blade", "piercing", "carapace", "guard", "regeneration"];
const ordinaryKeys = ["strength", "feet", "antenna"];

function declaration(name) {
  const match = source.match(new RegExp("^    function " + name + "\\([^]*?^    }", "m"));
  assert.ok(match, name);
  return match[0];
}

function attributes(keys, mask) {
  return Object.fromEntries(keys.filter((key, index) => mask & 1 << index).map((key, index) => [key, 1 + (mask + index) % 4]));
}

test("네 종족의 모든 전투·일반 속성 조합이 종족 탄생 경로를 공유한다", () => {
  let rendered = 0;
  const context = createContext({
    Spawner: { unitDisplayAttributes, combatAttributeKeys, hasCombatEvolution },
    combatAttributeArt: { ready: () => true, frame() { assert.fail("전투 전용 탄생 경로"); } },
    drawAgentAppearanceBody(ctx, now, agent, cell, topLeft, renderPosition, birth) {
      assert.equal(birth, agent.birth);
      rendered++;
    }
  });
  runInContext(declaration("drawAgentAppearanceLayer"), context);
  for (const tribe of tribes) for (let combat = 0; combat < 32; combat++) for (let ordinary = 0; ordinary < 32; ordinary++) {
    const agent = { tribe, health: 100, birth: { startedAt: 0, readyAt: agentBirthDuration(tribe) },
      attributes: { ...attributes(combatKeys, combat), ...attributes(ordinaryKeys, ordinary) } };
    context.drawAgentAppearanceLayer(null, 0, agent, 100, { x: 0, y: 0 }, { progress: 1 }, agent.birth, null);
  }
  assert.equal(rendered, 4096);
});

test("전투 속성은 종족별 탄생 경로·등장 시각·프레임을 바꾸지 않는다", () => {
  const context = createContext({ state: { simSeconds: 0 }, colonyEntries: [], AGENT_HEIGHT: .7,
    Spawner: { unitDisplayAttributes, SPORE_BIRTH_ANIMATION, sporeBirthPlacement }, SPRING_BIRTH_ANIMATION, springBirthPlacement,
    PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement, agentBirthDuration, agentBirthMotion,
    idleMotion: { matches: false }, unitAnimationSheets: new Map(), agentDisplayOffset: () => ({ x: 0, y: 0 }) });
  runInContext(declaration("agentBirthPose"), context);
  for (const tribe of tribes) for (const progress of [0, .1, .3, .6, .9, .999]) {
    context.state.simSeconds = agentBirthDuration(tribe) * progress;
    const base = { id: "1:4", tribe, x: 45, y: 46, birth: { startedAt: 0, fromX: 42, fromY: 42 } };
    const expected = context.agentBirthPose({ ...base, attributes: {} }, true);
    for (let mask = 1; mask < 32; mask++) {
      assert.deepEqual(context.agentBirthPose({ ...base, attributes: attributes(combatKeys, mask) }, true), expected);
    }
  }
});

test("세 종족의 공통 원화 탄생은 종료 시 대기로 전환하고 다시 재생하지 않는다", () => {
  for (const tribe of ["spore", "pebble", "spring"]) for (let mask = 0; mask < 32; mask++) {
    const duration = agentBirthDuration(tribe);
    const agent = { tribe, health: 10, mode: "idle", birth: { startedAt: 0, readyAt: duration },
      attributes: attributes(combatKeys, mask) };
    const before = structuredClone(agent);
    assert.equal(unitActionArtPose(agent, duration - .000001).action, "birth");
    for (const time of [duration, duration + .001, duration + 1]) {
      const pose = unitActionArtPose(agent, time);
      assert.equal(pose.action, "idle");
      assert.notEqual(pose.animation, unitActionArtPose(agent, 0).animation);
    }
    assert.deepEqual(agent, before);
  }
});

test("전사 새싹콩은 완성 전신 하나를 공통 앵커에 그리고 탄생 변환을 중복 적용하지 않는다", async () => {
  const previous = globalThis.SpawnerAssets;
  globalThis.SpawnerAssets = { source: path => path, image: () => ({ async decode() {
    [this.width, this.height] = imageDimensions(this.src);
  } }) };
  try {
    let time = 0;
    const surface = (width, height) => ({ width, height, getContext: () => ({ drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) }) }) });
    const presentation = createUnitPresentation({ model: {}, height: .7, time: () => time,
      displayScale: () => 1, createSurface: surface });
    const scope = createContext({ drawAgentAppearanceBody: (...args) => presentation.drawAgentAppearanceBody(...args) });
    runInContext(declaration("drawAgentBirth"), scope);
    for (let mask = 1; mask < 16; mask++) for (const facing of [-1, 1]) {
      const agent = { tribe: "bean", health: 10, facing, birth: { startedAt: 0, readyAt: 3.85 },
        attributes: { ...attributes(combatKeys, mask), feet: 1, antenna: 1 } };
      const before = structuredClone(agent);
      await presentation.prepareAnimation(agent, 0);
      for (time of [2.60, 2.8, 3.21, 3.849]) {
        const birth = { ...agentBirthMotion(time, 2, 3), x: 2, y: 3, fromX: 0, fromY: 0, targetX: 2, targetY: 3 };
        const draws = [], transforms = [];
        const drawing = { save() {}, restore() {}, translate(...v) { transforms.push(["translate", ...v]); },
          rotate() { assert.fail("이미 구워진 탄생 회전 중복 적용"); }, scale(...v) { transforms.push(["scale", ...v]); },
          drawImage(...v) { draws.push(v); } };
        scope.drawAgentBirth(drawing, 0, agent, birth, { x: 0, y: 0 }, 100, null);
        const pose = unitActionArtPose(agent, time), clip = pose.animation;
        const layers = clip.sceneLayers.layers.filter(layer => layer.samples[pose.frame]);
        assert.deepEqual(draws.map(call => call[0].src), layers.map(layer => layer.image));
        assert.equal(layers.filter(layer => layer.wholeBody).length, 1);
        const scale = 100 * unitDisplaySize(agent) / clip.referenceLength;
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i], sample = layer.samples[pose.frame];
          assert.deepEqual(draws[i].slice(1, 5), [sample.frame % layer.columns * layer.frameSize,
            Math.floor(sample.frame / layer.columns) * layer.frameHeight, layer.frameSize, layer.frameHeight]);
          assert.deepEqual(draws[i].slice(5), [(sample.destination[0] - clip.pivotX) * scale,
            (sample.destination[1] - clip.pivotY) * scale, sample.destination[2] * scale, sample.destination[3] * scale]);
        }
        assert.deepEqual(transforms, [["translate", 50, 100 * (.5 + .7 * .44)],
          ["scale", unitFrameMirror(clip.sourceFacing, unitFacing(agent)) ? -1 : 1, 1]]);
      }
      assert.deepEqual(agent, before);
    }
  } finally {
    if (previous === undefined) delete globalThis.SpawnerAssets;
    else globalThis.SpawnerAssets = previous;
  }
});
