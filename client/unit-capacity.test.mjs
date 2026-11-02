import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { NEST_LEVELS } from "../server/nests.mjs";

const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("탄생 버튼은 둥지 10·20·30·40 제한에 도달하면 잠기고 사망·성장 뒤 다시 열린다", () => {
  const state = { nestLevel: 1, agents: [], evolutionPoints: 1000 };
  const scope = createContext({ state, NEST_LEVELS, agentBirth: {},
    template: { slots: [] }, cost: 1, connection: { busy: false, online: true },
    hasBirthplace: () => true, slotCapacity: () => 4, isAttributeUnlocked: () => true });
  runInContext(source.match(/^    function unitCapacity\([^]*?^    }/m)[0], scope);
  const assignment = source.match(/      agentBirth.disabled =[^]*?;/)[0];
  for (const [level, cap] of [[1, 10], [2, 20], [3, 30], [4, 40]]) {
    state.nestLevel = level;
    assert.equal(scope.unitCapacity(), cap);
    for (const [count, blocked] of [[cap - 1, false], [cap, true], [cap + 1, true], [cap - 1, false]]) {
      state.agents = Array(count).fill({ health: 1 });
      runInContext(assignment, scope);
      assert.equal(scope.agentBirth.disabled, blocked, level + ":" + count);
    }
  }
  state.agents = Array(10).fill({ health: 1 });
  state.nestLevel = 1;
  runInContext(assignment, scope);
  assert.equal(scope.agentBirth.disabled, true);
  state.agents[0] = { health: 0 };
  runInContext(assignment, scope);
  assert.equal(scope.agentBirth.disabled, false);
  state.agents[0] = { health: 1 };
  state.nestLevel = 2;
  runInContext(assignment, scope);
  assert.equal(scope.agentBirth.disabled, false);
});
