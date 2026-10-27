import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createCombat } from "../server/combat.mjs";
import { combatLayout, combatHurtFrame, PLAYER_COMBAT_ASSETS } from "./combat.mjs";

test("셀 내부 좌우 진영과 여러 줄의 유닛이 겹치지 않고 인원에 맞춰 축소된다", () => {
  const agents = [0, 1].flatMap(side => Array.from({ length: side ? 2 : 6 }, (_, index) => ({ id: side + ":" + index,
    health: 12, combat: { id: "battle", side, joinedAt: index } })));
  const layout = combatLayout(agents);
  assert.equal(layout.size, 8);
  for (const agent of agents) {
    const placement = layout.get(agent.id);
    assert.equal(Math.sign(placement.x), agent.combat.side ? -1 : 1);
    assert.equal(placement.facing, agent.combat.side ? 1 : -1);
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

for (const playerInitiates of [true, false]) {
  test((playerInitiates ? "내 유닛" : "상대 유닛") + "이 먼저 공격하면 오른편에 고정되고 반격 때도 자리를 유지한다", () => {
    const player = { id: "player:1", ownerId: "player", health: 100, x: 100, y: 100, stats: { speed: 1, attack: 1 }, moveDuration: 0 };
    const rival = { ...player, id: "rival:1", ownerId: "rival" };
    const [initiator, defender] = playerInitiates ? [player, rival] : [rival, player];
    initiator.combatDisposition = "aggressive";
    defender.combatDisposition = "passive";
    const environment = { colonies: [], games: new Map([["player", { agents: [player] }], ["rival", { agents: [rival] }]]) };
    const combat = createCombat(environment);
    assert.equal(combat.engage(initiator, defender, 0), true);
    const original = [...combatLayout([player, rival])];
    assert.equal(initiator.facing, -1);
    assert.equal(defender.facing, 1);
    for (const attacker of [initiator, defender, initiator, initiator, defender]) {
      player.attack = null; rival.attack = null;
      attacker.attack = { combatId: initiator.combat.id, startedAt: 0, endsAt: 1 };
      const layout = combatLayout([player, rival]);
      assert.deepEqual([...layout], original);
      assert.ok(layout.get(initiator.id).x > 0);
      assert.ok(layout.get(defender.id).x < 0);
      assert.equal(layout.get(initiator.id).facing, -1);
      assert.equal(layout.get(defender.id).facing, 1);
    }
  });
}
