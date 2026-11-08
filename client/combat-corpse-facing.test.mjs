import { corpseRenderer } from "./corpse-test-fixture.mjs";
import { unitActionArtPose } from "./unit-action-art.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createGame } from "../server/game.mjs";
import { createCreatures } from "../server/creatures.mjs";
import { saveRoom, restoreRoom } from "./room.mjs";
import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import { hasCombatEvolution } from "./combat-attributes.mjs";

function fixture(tribe) {
  const colony = { id: 1, ownerId: "corpse-facing", name: "Facing", tribe, x: 40, y: 40,
    occupiedCells: new Set(["2,2"]) };
  const room = { id: "corpse-facing", title: "Facing", hostId: colony.ownerId, seed: 13,
    simSeconds: 0, revision: 0, resourceVersion: 0, colonies: [colony], games: new Map(),
    food: new Map(), foodSpots: new Map(),
    world: { size: 320, seed: 13, generationVersion: 11, sites: [[42, 42]], burrows: [],
      terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320),
      treeCells: new Uint8Array(320 * 320) } };
  const game = createGame(room, colony);
  room.games.set(colony.ownerId, game);
  room.creatureSystem = createCreatures(room);
  return { room, game };
}

test("전투 외형 사체는 사망 직전 표시 방향을 스냅샷과 저장·복원에 보존한다", () => {
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    const { room, game } = fixture(tribe);
    const victims = Array.from({ length: 4 }, (_, index) => ({ ...structuredClone(game.agents[0]), id: "facing-" + index }));
    game.agents.push(...victims);
    for (const [index, agent] of victims.entries()) {
      // Combat side is the visible direction, even if a stale movement facing differs.
      Object.assign(agent, { facing: index % 2 ? 1 : -1,
        combat: index < 2 ? null : { side: index === 2 ? 1 : 0 },
        attributes: { blade: 1, feet: 1, antenna: 1 },
        appearanceAttributes: { blade: 1, feet: 1, antenna: 1 } });
      game.receiveDamage(agent, 100000);
    }
    const expected = [-1, 1, 1, -1];
    const facing = value => victims.map(agent => value.find(corpse => corpse.agentId === agent.id)?.facing);
    assert.deepEqual(facing(game.snapshot().corpses), expected, tribe);
    assert.ok(victims.every(agent => agent.health === 0 && !game.agents.includes(agent)));
    assert.ok(game.snapshot().corpses.every(corpse => corpse.decaysAt - corpse.diedAt === 3));
    const saved = JSON.parse(JSON.stringify(saveRoom(room)));
    assert.deepEqual(facing(saved.food.map(([, cell]) => cell)), expected);
    const restored = restoreRoom(saved);
    assert.deepEqual(facing(restored.games.get(room.hostId).snapshot().corpses), expected);
    // Old saves never had this field. Their records still restore without guessing it.
    for (const [, cell] of saved.food) if (cell.kind === "corpse") delete cell.facing;
    const legacy = restoreRoom(saved);
    assert.deepEqual(facing(legacy.games.get(room.hostId).snapshot().corpses), Array(4).fill(undefined));
  }
});

test("전투 외형 사체는 완성 사망 프레임과 원본 방향을 한 번만 적용한다", async t => {
  const render = corpseRenderer(t);
  for (const tribe of ["bean", "spore", "pebble", "spring"]) for (const attributes of [{ blade: 1 }, { carapace: 1, antenna: 1 }])
    for (const facing of [-1, 1, undefined]) {
      const corpse = { tribe, facing, attributes, health: 0, kind: "corpse", diedAt: 10, decaysAt: 13 };
      const pose = unitActionArtPose(corpse, 10.1);
      await render.presentation.prepareAnimation(corpse, 10.1);
      assert.equal(render.draw(corpse, 10.1, .5).action, "death");
      assert.equal(render.draws.length, 1);
      assert.equal(render.draws[0][0].src, pose.animation.image);
      const target = facing < 0 ? "left" : "right";
      assert.deepEqual(render.scales, [[pose.animation.sourceFacing === target ? 1 : -1, 1]]);
      assert.deepEqual(render.translations, [[40, 80]]);
      assert.deepEqual(render.context.alphas, [.4]);
      assert.equal(render.outlines.length, 1);
      assert.equal(render.context.globalAlpha, .8);
    }
});

test("기본형과 일반 외형도 완성 사망 프레임을 쓰며 중립 생물은 전용 렌더러에 위임한다", async t => {
  const render = corpseRenderer(t);
  for (const attributes of [{}, { antenna: 1 }, { feet: 1 }]) {
    const corpse = { tribe: "bean", facing: -1, attributes, health: 0, diedAt: 10 };
    await render.presentation.prepareAnimation(corpse, 10.1);
    assert.equal(render.draw(corpse, 10.1, 1).action, "death");
    assert.equal(render.draws.length, 1);
  }
  assert.equal(render.draw({ species: "soil-boar", facing: -1 }, 10.1, 1), "creature");
  assert.equal(render.draws.length, 0);
});
