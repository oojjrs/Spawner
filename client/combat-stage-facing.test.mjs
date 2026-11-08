import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createCombatStage } from "./combat-stage.mjs";
import { createSimulationTrial } from "./combat-simulation.mjs";
import { COMBAT_LAB_UNITS } from "./combat-lab.mjs";
import { UNIT_ANIMATIONS, CREATURE_IDLE_ANIMATIONS, CREATURE_WALK_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_HURT_ANIMATIONS, CREATURE_DEATH_ANIMATIONS } from "./unit-animation.mjs";
import { UNIT_IMAGE_BOUNDS } from "./unit-image-bounds.mjs";
import { TALON_OWL_IDLE } from "./talon-owl-idle.mjs";
import { BEETLE_SPRITE, BEETLE_ATTACK_SPRITE } from "../server/beetle-animation.mjs";

function surface(width, height) {
  const calls = [], stack = [];
  let transform = [1, 0, 0, 1, 0, 0];
  const context = new Proxy({
    save() { stack.push([...transform]); }, restore() { transform = stack.pop(); },
    setTransform(...values) { transform = values; },
    translate(x, y) { transform[4] += transform[0] * x; transform[5] += transform[3] * y; },
    scale(x, y) { transform[0] *= x; transform[3] *= y; },
    drawImage(image) { calls.push({ image: image.src, transform: [...transform] }); },
    getImageData() { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  return { width, height, clientWidth: width, clientHeight: height, calls, getContext: () => context };
}

async function harness(run) {
  const keys = ["window", "document", "Image", "SpawnerAssets"];
  const saved = new Map(keys.map(key => [key, globalThis[key]]));
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  globalThis.document = { createElement: () => surface(1, 1) };
  globalThis.SpawnerAssets = { source: value => value };
  globalThis.Image = class { complete = true; naturalWidth = 4096; naturalHeight = 4096; async decode() {} };
  const canvas = surface(1040, 480), stage = createCombatStage(canvas);
  async function draw(trial) {
    const before = JSON.stringify(trial.agents);
    stage.render(trial, 1000, false);
    await new Promise(resolve => setImmediate(resolve));
    canvas.calls.length = 0; stage.render(trial, 1000, false);
    assert.equal(JSON.stringify(trial.agents), before, "rendering preserves simulation state");
    return canvas.calls.filter(call => call.image && !call.image.endsWith("grassland.webp"));
  }
  try { await run(draw); }
  finally { for (const [key, value] of saved) globalThis[key] = value; }
}

const creatureImages = new Set([TALON_OWL_IDLE.image, BEETLE_SPRITE.image, BEETLE_ATTACK_SPRITE.image,
  "DesignAssets/Animations/BeetleDeath/dead-v2.png",
  ...[CREATURE_IDLE_ANIMATIONS, CREATURE_WALK_ANIMATIONS, CREATURE_ATTACK_ANIMATIONS, CREATURE_HURT_ANIMATIONS, CREATURE_DEATH_ANIMATIONS]
    .flatMap(animations => Object.values(animations).map(animation => animation.image))]);

for (const first of ["left", "right", "simultaneous"]) test("23종 양 진영이 선공 " + first + "과 상태 변화에서도 안쪽을 본다", async () => {
  await harness(async draw => {
    const builds = COMBAT_LAB_UNITS.map(unit => ({ key: unit.key, organs: { attack: 1 }, counts: { power: 4, vitality: 5 } }));
    const simulation = createSimulationTrial({ left: builds, right: builds, first, random: false });
    simulation.advance(.1);
    for (const state of ["idle", "attack", "hurt", "death"]) {
      const agents = structuredClone(simulation.agents).filter(agent => state !== "death" ||
        !CREATURE_DEATH_ANIMATIONS[agent.key] || UNIT_IMAGE_BOUNDS[CREATURE_DEATH_ANIMATIONS[agent.key].image]);
      for (const agent of agents) {
        if (state !== "attack") agent.attack = null;
        if (state === "hurt") agent.hurtStartedAt = .09;
        if (state === "death") agent.health = 0;
      }
      const trial = { agents, history: [], projectiles: [], time: .1, result: () => null };
      let calls;
      try { calls = await draw(trial); } catch (error) { error.message = state + ": " + error.message; throw error; }
      const draws = calls.filter(call => creatureImages.has(call.image));
      assert.equal(draws.length, agents.filter(agent => !UNIT_ANIMATIONS[agent.key]).length, state + " renders every neutral body");
      for (const call of draws) {
        const rightSide = call.transform[4] > 520;
        const nativeRight = call.image === BEETLE_ATTACK_SPRITE.image;
        assert.equal(Math.sign(call.transform[0]), (rightSide ? -1 : 1) * (nativeRight ? 1 : -1), state + " " + call.image);
      }
    }
  });
});

test("4종족의 렌더용 방향은 월드 상태와 무관하고 원본을 보존한다", () => {
  const source = readFileSync(new URL("./combat-stage.mjs", import.meta.url), "utf8");
  const scope = createContext({ UNIT_ANIMATIONS });
  runInContext(source.match(/function stageAgent\(agent\) \{[^]*?\n}/)[0], scope);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const side of [0, 1]) for (const facing of [-1, 1]) for (const health of [10, 0]) {
    const agent = { tribe, facing, health, combat: { side }, attack: { directionX: facing, startedAt: 1, hitAt: 2 } };
    const before = JSON.stringify(agent), visual = scope.stageAgent(agent);
    assert.equal(visual.facing, side ? -1 : 1);
    assert.equal(visual.attack.directionX, visual.facing);
    assert.equal(visual.combat.side, side);
    assert.equal(visual.attack.hitAt, agent.attack.hitAt);
    assert.equal(JSON.stringify(agent), before);
  }
});

test("인게임 스냅샷도 공용 전투 화면에서 잔존 월드 방향 대신 진영을 적용한다", async () => {
  await harness(async draw => {
    for (const facing of [-1, 1]) {
      const agents = [0, 1].map(side => ({ id: "world-" + side, species: "vine-turtle", facing,
        health: 100, stats: { health: 100 }, mode: "idle", animationStartedAt: 0,
        combat: { id: "world", side, stunnedUntil: 0 } }));
      const calls = await draw({ agents, history: [], projectiles: [], time: 1, live: true, result: () => null });
      const bodies = calls.filter(call => creatureImages.has(call.image));
      assert.equal(bodies.length, 2);
      for (const body of bodies) assert.equal(Math.sign(body.transform[0]), body.transform[4] > 520 ? 1 : -1);
    }
  });
});
