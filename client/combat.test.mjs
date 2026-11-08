import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { unitDisplaySize } from "./unit-size.mjs";
import { createCombat } from "../server/combat.mjs";
import { combatLayout, combatHurtFrame, PLAYER_COMBAT_ASSETS } from "./combat.mjs";

test("셀 내부 전투 배치는 진영 방향과 입력 순서 독립성을 유지하고 인원에 맞춰 축소된다", () => {
  const agents = [0, 1].flatMap(side => Array.from({ length: side ? 2 : 36 }, (_, index) => ({ id: side + ":" + index,
    health: 12, combat: { id: "battle", side, joinedAt: index } })));
  const layout = combatLayout(agents);
  assert.equal(layout.size, 38);
  for (const agent of agents) {
    const placement = layout.get(agent.id), size = unitDisplaySize(agent);
    assert.equal(placement.facing, agent.combat.side ? 1 : -1);
    assert.ok(.5 + placement.x - size * placement.scale / 2 >= 0);
    assert.ok(.5 + placement.x + size * placement.scale / 2 <= 1);
    assert.ok(.5 + placement.y - size * placement.scale / 2 >= 0);
    assert.ok(.5 + placement.y + size * placement.scale / 2 <= 1);
  }
  assert.equal(layout.get("0:0").scale, layout.get("1:0").scale);
  const pair = combatLayout([agents[0], agents.at(-1)]);
  assert.ok(layout.get("0:0").scale < pair.get("0:0").scale);
  for (const [id, placement] of combatLayout([...agents].reverse())) assert.deepEqual(placement, layout.get(id));
});

test("피격 프레임은 한 번 재생하고 끝나며 네 종족의 실제 애니메이션 경로가 존재한다", () => {
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 4.9), -1);
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 5), 0);
  assert.equal(combatHurtFrame({ hurtStartedAt: 5 }, 6), -1);
  for (const path of PLAYER_COMBAT_ASSETS) assert.ok(existsSync(new URL("../" + path, import.meta.url)), path);
});

for (const playerInitiates of [true, false]) {
  test((playerInitiates ? "내 유닛" : "상대 유닛") + "이 먼저 공격해도 셀 배치와 진영 방향은 반격 때 유지한다", () => {
    const player = { id: "player:1", ownerId: "player", health: 100, x: 100, y: 100, stats: { speed: 1, attack: 1 }, moveDuration: 0 };
    const rival = { ...player, id: "rival:1", ownerId: "rival" };
    const [initiator, defender] = playerInitiates ? [player, rival] : [rival, player];
    initiator.combatDisposition = "aggressive";
    defender.combatDisposition = "passive";
    const environment = { colonies: [], games: new Map([["player", { agents: [player] }], ["rival", { agents: [rival] }]]) };
    const combat = createCombat(environment);
    assert.equal(combat.engage(initiator, defender, 0), true);
    const original = [...combatLayout([player, rival])];
    assert.equal(initiator.facing, -defender.facing);
    for (const attacker of [initiator, defender, initiator, initiator, defender]) {
      player.attack = null; rival.attack = null;
      attacker.attack = { combatId: initiator.combat.id, startedAt: 0, endsAt: 1 };
      const layout = combatLayout([player, rival]);
      assert.deepEqual([...layout], original);
      assert.equal(layout.get(initiator.id).facing, -1);
      assert.equal(layout.get(defender.id).facing, 1);
    }
  });
}

test("전투에서도 솜양·새싹콩·유니크의 새싹콩 기준으로 압축된 체급 비율을 유지한다", () => {
  const agents = [
    { id: "sheep", species: "cotton-sheep", health: 100, combat: { id: "mixed", side: 0, joinedAt: 0 } },
    { id: "bean", tribe: "bean", health: 100, combat: { id: "mixed", side: 0, joinedAt: 1 } },
    { id: "paw", species: "white-paw", health: 100, combat: { id: "mixed", side: 1, joinedAt: 0 } }
  ];
  const layout = combatLayout(agents);
  assert.equal(layout.get("sheep").scale, layout.get("paw").scale);
  assert.equal(layout.get("bean").scale, layout.get("paw").scale);
  const size = agent => unitDisplaySize(agent) * layout.get(agent.id).scale;
  assert.ok(Math.abs(size(agents[0]) / size(agents[1]) - .36 / .40) < 1e-12);
  assert.ok(Math.abs(size(agents[2]) / size(agents[1]) - .92 / .40) < 1e-12);
  assert.ok(size(agents[2]) <= .44);
});
