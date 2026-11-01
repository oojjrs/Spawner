import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { combatAttributeKeys, hasCombatEvolution } from "./combat-attributes.mjs";
import { agentBirthDuration, agentBirthMotion } from "../server/birth.mjs";
import { SPORE_BIRTH_ANIMATION, sporeBirthPlacement, SPRING_BIRTH_ANIMATION, springBirthPlacement,
  PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement } from "./birth.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
const tribes = ["bean", "spore", "pebble", "spring"];
const combatKeys = ["blade", "piercing", "carapace", "guard", "regeneration"];
const ordinaryKeys = ["strength", "feet", "antenna", "lifespan", "butchery"];

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
    Spawner: { combatAttributeKeys, hasCombatEvolution },
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
    Spawner: { SPORE_BIRTH_ANIMATION, sporeBirthPlacement }, SPRING_BIRTH_ANIMATION, springBirthPlacement,
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

test("세 종족의 마지막 탄생 프레임은 전투 탄생을 다시 재생하지 않는다", () => {
  for (const [name, animation] of [["drawSporeBirth", SPORE_BIRTH_ANIMATION], ["drawPebbleBirth", PEBBLE_BIRTH_ANIMATION],
    ["drawSpringBirth", SPRING_BIRTH_ANIMATION]]) {
    let calls = 0;
    const context = createContext({ Spawner: { SPORE_BIRTH_ANIMATION }, PEBBLE_BIRTH_ANIMATION, SPRING_BIRTH_ANIMATION,
      idleMotion: { matches: false }, drawAgentAppearanceLayer(ctx, now, agent, cell, topLeft, position, birth) {
        assert.equal(agent.birth, null); assert.equal(birth, null); calls++;
      } });
    runInContext(declaration(name), context);
    for (let mask = 0; mask < 32; mask++) {
      const agent = { birth: { startedAt: 0 }, attributes: attributes(combatKeys, mask) };
      context[name](null, 0, agent, { unitVisible: true, frame: animation.frameCount - 1, x: 0, y: 0 }, {}, 100, null);
      assert.ok(agent.birth);
    }
    assert.equal(calls, 32);
  }
});

test("전사 새싹콩은 공통 탄생 동작에 완성 외형을 한 번만 그리고 크기와 발 위치를 유지한다", () => {
  const draws = [], transforms = [];
  const sprite = { width: 512, height: 512 };
  const context = createContext({ AGENT_HEIGHT: .7, Spawner: { hasCombatEvolution },
    combatAttributeArt: { ready: () => true },
    agentSprite(agent, layer) { assert.equal(layer, "full"); return sprite; },
    drawBirthSeed() {}, drawBirthFragments() {}, drawBirthImpact() {},
    drawAgentFeet() { assert.fail("중복 발"); }, drawAgentTail() { assert.fail("중복 꼬리"); },
    drawAgentHead() { assert.fail("중복 머리"); }, drawSelectionOutline() {} });
  runInContext(declaration("drawAgentBirth"), context);
  const drawing = { save() {}, restore() {}, translate(...values) { transforms.push(["translate", ...values]); },
    rotate(...values) { transforms.push(["rotate", ...values]); }, scale(...values) { transforms.push(["scale", ...values]); },
    drawImage(...values) { draws.push(values); } };
  for (let mask = 1; mask < 16; mask++) {
    const agent = { tribe: "bean", attributes: { ...attributes(combatKeys, mask), feet: 1, antenna: 1, butchery: 1 } };
    for (const elapsed of [2.59, 2.8, 3.21, 3.849]) {
      const birth = { ...agentBirthMotion(elapsed, 2, 3), x: 2, y: 3, fromX: 0, fromY: 0, targetX: 2, targetY: 3 };
      draws.length = 0; transforms.length = 0;
      context.drawAgentBirth(drawing, 0, agent, birth, { x: 0, y: 0 }, 100, null);
      assert.deepEqual(draws, [[sprite, -70, -122.5, 140, 140]]);
      assert.deepEqual(transforms, [["translate", 50, 80.8 - birth.lift * 100], ["rotate", birth.rotation],
        ["scale", birth.scaleX, birth.scaleY]]);
    }
  }
});
