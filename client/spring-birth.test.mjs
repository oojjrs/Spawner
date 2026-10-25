import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { SPRING_BIRTH_ANIMATION, springBirthPlacement } from "./birth.mjs";

test("샘방울 물목은 분리 전 흘림턱에 붙어 있고 착지 후에는 선택한 빈 칸에 고정된다", () => {
  const outlet = { x: 43.84, y: 43.05 }, target = { x: 44.5, y: 45.808 };
  const height = .7 * 350 / 512;
  for (const elapsed of [0, .13, .35, .529]) {
    const pose = springBirthPlacement(elapsed, outlet, target, height);
    assert.ok(Math.abs(pose.x + SPRING_BIRTH_ANIMATION.outletX * pose.scale - outlet.x) < 1e-9);
    assert.ok(Math.abs(pose.y + SPRING_BIRTH_ANIMATION.outletY * pose.scale - outlet.y) < 1e-9);
  }
  for (const elapsed of [.79, 1.1, 1.78]) {
    const pose = springBirthPlacement(elapsed, outlet, target, height);
    assert.ok(Math.abs(pose.rootX - target.x) < 1e-9);
    assert.ok(Math.abs(pose.rootY - target.y) < 1e-9);
  }
  const start = springBirthPlacement(.53, outlet, target, height);
  const middle = springBirthPlacement(.66, outlet, target, height);
  const end = springBirthPlacement(.79, outlet, target, height);
  assert.ok(start.rootY < middle.rootY && middle.rootY < end.rootY);
  assert.equal(springBirthPlacement(1.79, outlet, target, height), null);
});

test("샘방울 탄생음은 시작에 한 번만 나고 씨앗 방출·파열·등장음은 섞이지 않는다", () => {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const declaration = source.match(/^    function updateAudio\([^]*?^    }/m)[0];
  const calls = [];
  const agent = { id: "spring:1", tribe: "spring", health: 1, birth: { startedAt: 1, colonyId: 1 } };
  const state = { simSeconds: 1, camera: { layer: 0 }, agents: [agent], rivals: [] };
  const context = createContext({ state, connection: { active: true, online: true }, audioTime: .9,
    audio: { available: () => true, play: name => calls.push(name), setHarvest() {} },
    displayedAgent: value => value, interpolatedAgentPosition: () => ({ x: 44, y: 45 }), audioVolume: () => 1,
    agentBirthPose: value => ({ kind: "spring", elapsed: state.simSeconds - value.birth.startedAt }),
    agentAudio: new Map(), deliveryAudio: new Map(), foodDeliveries: new Map(),
    colonyEntries: [{ id: 1 }], colonyBirthOutlet: () => ({ x: 43.84, y: 43.05 }),
    resetAudio() { throw new Error("Unexpected audio reset"); }
  });
  runInContext(declaration, context);
  for (const time of [1, 1.1, 1.4, 1.53, 1.79, 2.1, 2.5]) {
    state.simSeconds = time;
    context.updateAudio();
  }
  assert.deepEqual(calls, ["spring-birth"]);
});
