import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { combatLayout, combatHurtFrame, PLAYER_COMBAT_ASSETS } from "./combat.mjs";

test("셀 내부 좌우 진영과 여러 줄의 유닛이 겹치지 않고 인원에 맞춰 축소된다", () => {
  const agents = [0, 1].flatMap(side => Array.from({ length: side ? 2 : 6 }, (_, index) => ({ id: side + ":" + index,
    health: 12, combat: { id: "battle", side, joinedAt: index } })));
  const layout = combatLayout(agents);
  assert.equal(layout.size, 8);
  for (const agent of agents) {
    const placement = layout.get(agent.id);
    assert.equal(Math.sign(placement.x), agent.combat.side ? 1 : -1);
    assert.equal(placement.facing, agent.combat.side ? -1 : 1);
    assert.ok(.5 + placement.x - .7 * placement.scale / 2 >= 0);
    assert.ok(.5 + placement.x + .7 * placement.scale / 2 <= 1);
    assert.ok(.5 + placement.y - .7 * placement.scale / 2 >= 0);
    assert.ok(.5 + placement.y + .7 * placement.scale / 2 <= 1);
  }
  assert.ok(layout.get("0:0").scale < layout.get("1:0").scale);
  const first = layout.get("0:0"), second = layout.get("0:1");
  assert.ok(second.y - first.y > .7 * first.scale);
  assert.deepEqual([...combatLayout([...agents].reverse())], [...layout]);
});

test("피격 프레임은 한 번 재생하고 끝나며 네 종족의 실제 애니메이션 경로가 존재한다", () => {
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 4.9), -1);
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 5), 0);
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 6), -1);
  for (const path of PLAYER_COMBAT_ASSETS) assert.ok(existsSync(new URL("../" + path, import.meta.url)), path);
});
