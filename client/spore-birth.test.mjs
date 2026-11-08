import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext } from "node:vm";
import { createGameTestContext as createContext } from "./game-runtime-test-fixture.mjs";
import { createNestGrowthPlayback, nestGrowthSounds } from "./nest-growth.mjs";
import { SPORE_BIRTH_ANIMATION, sporeBirthPlacement } from "./birth.mjs";
import { agentBirthDuration } from "../server/birth.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("포자버섯은 목표보다 높은 곳까지 떠오르고 1초 넘는 비행 후 착지한다", () => {
  const animation = SPORE_BIRTH_ANIMATION;
  assert.ok(animation.contactAt - animation.detachAt > 1);
  for (const [fromY, toY] of [[3,6],[6,3]]) {
    const outlet = { x: 2, y: fromY }, target = { x: 5, y: toY };
    const start = sporeBirthPlacement(animation.detachAt, outlet, target, .3);
    assert.equal(start.rootX, outlet.x);
    assert.equal(start.rootY, outlet.y);
    const peak = sporeBirthPlacement(1.14, outlet, target, .3);
    assert.ok(peak.rootY < Math.min(fromY, toY) - .8);
    let previous = peak.rootY;
    for (const time of [1.3, 1.6, 1.9, animation.contactAt]) {
      const pose = sporeBirthPlacement(time, outlet, target, .3);
      assert.ok(pose.rootY > previous);
      assert.equal(pose.scale, start.scale);
      previous = pose.rootY;
    }
    const landed = sporeBirthPlacement(animation.contactAt, outlet, target, .3);
    assert.equal(landed.rootX, target.x);
    assert.equal(landed.rootY, target.y);
  }
});

test("포자버섯의 연속 탄생은 좌우와 출발 높이가 바뀌며 재생마다 같은 경로를 쓴다", () => {
  const entry = { id: 1, x: 40, y: 40 };
  const context = createContext({ state: { simSeconds: .6 }, colonyEntries: [entry],
    Spawner: { SPORE_BIRTH_ANIMATION, sporeBirthPlacement }, agentBirthDuration,
    AGENT_HEIGHT: .7, COLONY_SIZE: 5, idleMotion: { matches: false },
    unitAnimationSheets: new Map([["spore", new Map([["idle", { referenceHeight: 222 }]])]]),
    agentDisplayOffset: () => ({ x: 0, y: 0 }), colonyAppearance: () => ({ scale: 1 }),
    colonyBirthOutlet: () => ({ x: 43.6, y: 43.2 }) });
  runInContext(source.match(/^    function agentBirthPose\([^]*?^    }/m)[0], context);
  const poses = [];
  for (const index of [4,5,6,7]) {
    const agent = { id: "1:" + index, tribe: "spore", x: 42, y: 45,
      birth: { colonyId: 1, startedAt: 0, fromX: 42, fromY: 42 } };
    const pose = context.agentBirthPose(agent, true);
    assert.deepEqual(context.agentBirthPose(agent, true), pose);
    poses.push(pose);
  }
  assert.deepEqual([...new Set(poses.map(pose => pose.facing))].sort(), [-1,1]);
  assert.equal(new Set(poses.map(pose => pose.x + "," + pose.y)).size, 4);
  assert.ok(poses.some(pose => pose.x + .5 < 42.5));
  assert.ok(poses.some(pose => pose.x + .5 > 42.5));
});

test("포자버섯 탄생음은 착지 강세에 맞춰 한 번만 나고 씨앗 방출·파열·등장음은 섞이지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = source.match(/^    function updateAudio\([^]*?^    }/m)[0];
  const calls = [];
  const agent = { id: "spore:1", tribe: "spore", health: 1, birth: { startedAt: 1, colonyId: 1 } };
  const state = { simSeconds: 1, camera: { layer: 0 }, agents: [agent], rivals: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: .9,
    audio: { available: () => true, play: name => calls.push(name), setHarvest() {} },
    Spawner: { SPORE_BIRTH_ANIMATION, nestGrowthSounds }, nestGrowthPlayback: createNestGrowthPlayback(),
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {},
    displayedAgent: value => value, interpolatedAgentPosition: () => ({ x: 44, y: 45 }), audioVolume: () => 1,
    agentBirthPose: value => ({ kind: "spore", elapsed: state.simSeconds - value.birth.startedAt }),
    agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    colonyEntries: [{ id: 1 }], colonyBirthOutlet: () => ({ x: 43.84, y: 43.05 }),
    resetAudio() { throw new Error("Unexpected audio reset"); }
  });
  runInContext(declaration, context);
  for (const time of [1, 1.1, 1.3, 1.449]) {
    state.simSeconds = time;
    context.updateAudio();
  }
  assert.deepEqual(calls, []);
  for (const time of [1.451, 1.7, 2.1, 2.5]) {
    state.simSeconds = time;
    context.updateAudio();
  }
  assert.deepEqual(calls, ["spore-birth"]);
});
