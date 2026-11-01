import test from "node:test";
import assert from "node:assert/strict";
import { PLAYER_TRIBES } from "../server/player-tribes.mjs";
import { agentLifespanWarning } from "./agent-lifespan.mjs";

const agent = { id: "lifespan:1", faction: "colony", health: 12, bornAt: 0, lifespan: 180 };

test("수명 경고는 마지막 30초에만 적용하고 사망·탄생·중립 생물에는 적용하지 않는다", () => {
  assert.equal(agentLifespanWarning(agent, 149.999), false);
  assert.equal(agentLifespanWarning(agent, 150), true);
  assert.equal(agentLifespanWarning(agent, 179.999), true);
  assert.equal(agentLifespanWarning(agent, 180), false);
  assert.equal(agentLifespanWarning({ ...agent, health: 0 }, 160), false);
  assert.equal(agentLifespanWarning({ ...agent, faction: "neutral" }, 160), false);
  assert.equal(agentLifespanWarning({ ...agent, species: "dew-rabbit" }, 160), false);
  assert.equal(agentLifespanWarning({ ...agent, bornAt: undefined }, 160), false);
  assert.equal(agentLifespanWarning({ ...agent, birth: { readyAt: 170 } }, 160), false);
  assert.equal(agentLifespanWarning({ ...agent, lifespan: 300 }, 269.999), false);
  assert.equal(agentLifespanWarning({ ...agent, lifespan: 300 }, 270), true);
});

test("네 종족과 다른 군락도 같은 남은 수명 기준을 사용한다", () => {
  for (const tribe of PLAYER_TRIBES) for (const faction of ["colony", "rival"]) {
    assert.equal(agentLifespanWarning({ ...agent, tribe: tribe.key, faction }, 149), false);
    assert.equal(agentLifespanWarning({ ...agent, tribe: tribe.key, faction }, 150), true);
  }
});
