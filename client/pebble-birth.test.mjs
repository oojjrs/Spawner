import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { PEBBLE_BIRTH_ANIMATION, pebbleBirthPlacement } from "./birth.mjs";

test("몽돌은 돌굴의 48프레임을 재생하고 구르기 전 출구와 착지 후 빈 칸에 고정된다", () => {
  const metadata = JSON.parse(readFileSync(new URL("../DesignAssets/Planning/Tribes/pebble/AnimationStudies/birth-den-v1/birth.json", import.meta.url), "utf8"));
  assert.deepEqual([...PEBBLE_BIRTH_ANIMATION.durationsMs], metadata.durationsMs);
  const outlet = { x: 42.5, y: 43 }, target = { x: 42.5, y: 45.78 }, height = .7 * 229 / 512;
  for (const elapsed of [0, .08, .119]) {
    const pose = pebbleBirthPlacement(elapsed, outlet, target, height);
    assert.ok(Math.abs(pose.x + PEBBLE_BIRTH_ANIMATION.outletX * pose.scale - outlet.x) < 1e-9);
    assert.ok(Math.abs(pose.y + PEBBLE_BIRTH_ANIMATION.outletY * pose.scale - outlet.y) < 1e-9);
  }
  for (const elapsed of [1.48, 1.87, 2.619]) {
    const pose = pebbleBirthPlacement(elapsed, outlet, target, height);
    assert.ok(Math.abs(pose.rootX - target.x) < 1e-9);
    assert.ok(Math.abs(pose.rootY - target.y) < 1e-9);
  }
  assert.equal(pebbleBirthPlacement(2.62, outlet, target, height), null);
});

test("몽돌 탄생음은 0.25초에 한 번만 재생하고 새싹콩 효과음은 호출하지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = source.match(/^    function updateAudio\([^]*?^    }/m)[0];
  const calls = [];
  const agent = { id: "pebble:1", tribe: "pebble", health: 1, birth: { startedAt: 1, colonyId: 1 } };
  const state = { simSeconds: 1.1, camera: { layer: 0 }, agents: [agent], rivals: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: 1,
    PEBBLE_BIRTH_ANIMATION, audio: { available: () => true, play: name => calls.push(name), setHarvest() {} },
    SpawnerCombatAudio: { update: () => [] }, combatAudio: {},
    displayedAgent: value => value, interpolatedAgentPosition: () => ({ x: 42, y: 45 }), audioVolume: () => 1,
    agentBirthPose: value => ({ kind: "pebble", elapsed: state.simSeconds - value.birth.startedAt }),
    agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(), colonyEntries: [{ id: 1 }],
    colonyBirthOutlet: () => ({ x: 42.5, y: 43 }), resetAudio() { throw new Error("Unexpected audio reset"); } });
  runInContext(declaration, context);
  for (const time of [1.1, 1.24, 1.25, 1.35, 1.6, 2, 2.4, 2.6, 3]) {
    state.simSeconds = time;
    context.updateAudio();
  }
  assert.deepEqual(calls, ["pebble-birth"]);
  calls.length = 0;
  context.agentAudio.clear();
  state.simSeconds = 3.1;
  context.updateAudio();
  assert.deepEqual(calls, []);
});
