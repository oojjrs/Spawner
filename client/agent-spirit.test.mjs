import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { AGENT_SPIRIT, agentSpiritPose, drawAgentSpirit } from "./agent-spirit.mjs";

const agent = { id: "spirit:1", faction: "colony", health: 12, bornAt: 0, lifespan: 180 };

test("혼불은 수명 1분 전부터 생존한 아군에게 표시한다", () => {
  assert.equal(agentSpiritPose(agent, 119.999), null);
  assert.ok(agentSpiritPose(agent, 120));
  assert.ok(agentSpiritPose(agent, 179.999));
  assert.equal(agentSpiritPose(agent, 180), null);
  assert.equal(agentSpiritPose({ ...agent, health: 0 }, 150), null);
  assert.equal(agentSpiritPose({ ...agent, faction: "rival" }, 150), null);
  assert.equal(agentSpiritPose({ ...agent, bornAt: undefined }, 150), null);
  assert.equal(agentSpiritPose({ ...agent, birth: { readyAt: 160 } }, 150), null);
  assert.equal(agentSpiritPose({ ...agent, lifespan: 300 }, 239.999), null);
  assert.ok(agentSpiritPose({ ...agent, lifespan: 300 }, 240));
});

test("모든 부족에 같은 정지 혼불을 표시한다", () => {
  assert.ok(existsSync(new URL("../" + AGENT_SPIRIT.image, import.meta.url)));
  const pose = agentSpiritPose(agent, 120);
  for (const tribe of PLAYER_TRIBES) {
    assert.deepEqual(agentSpiritPose({ ...agent, tribe: tribe.key }, 130), pose);
    assert.deepEqual(agentSpiritPose({ ...agent, tribe: tribe.key }, 179), pose);
  }
});

test("혼불은 필터나 조각 변형 없이 원화 한 장을 선명하게 그린다", () => {
  const calls = [];
  const context = { globalAlpha: .8, save() {}, restore() {}, drawImage(...args) { calls.push(args); } };
  const sprite = { complete: true, naturalWidth: 128, naturalHeight: 192 };
  drawAgentSpirit(context, sprite, agentSpiritPose(agent, 150), { x: 20, y: 30 }, 100);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], sprite);
  assert.equal(calls[0].length, 5);
  assert.ok(context.globalAlpha > .7);
  assert.ok(calls[0][3] > 0 && calls[0][4] > 0);
  assert.equal(calls[0][2] + calls[0][4], 30);
});
