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

function corpseRenderer() {
  const source = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  const sprite = { width: 512, height: 512 }, calls = [];
  const scope = createContext({
    Spawner: { unitDisplayAttributes, hasCombatEvolution, COMBAT_ATTRIBUTE_KEYS: ["blade", "piercing", "carapace"] },
    combatAttributeArt: { ready: () => true, frame: () => sprite },
    corpsePlaybackTime: () => 10, AGENT_HEIGHT: .8,
    agentDeathFrame: () => -1,
    drawCreatureCorpse: () => "creature", drawSelectionOutline: (...args) => calls.push(["outline", ...args])
  });
  runInContext(source.match(/^    function drawAgentCorpse\([^]*?^    }/m)[0], scope);
  let alpha = .8;
  const stack = [];
  const context = {
    get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
    save() { stack.push(alpha); }, restore() { alpha = stack.pop(); },
    translate: (...args) => calls.push(["translate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]),
    drawImage: (...args) => calls.push(["image", alpha, ...args])
  };
  return { scope, context, sprite, calls };
}

test("전투 부속지가 달린 사체만 살아 있을 때와 같은 좌우 방향으로 그린다", () => {
  const { scope, context, sprite, calls } = corpseRenderer();
  for (const tribe of ["bean", "spore", "pebble", "spring"]) {
    for (const attributes of [{ blade: 1 }, { carapace: 1, feet: 1, antenna: 1 },
      { blade: 1, piercing: 1, carapace: 1, feet: 2, strength: 1 }]) {
      for (const facing of [-1, 1, undefined]) {
        calls.length = 0;
        const corpse = { tribe, facing, attributes, diedAt: 10 };
        assert.equal(scope.drawAgentCorpse(context, corpse, 40, 80, 100, "outline", .5), true);
        assert.deepEqual(calls.find(call => call[0] === "translate"), ["translate", 40, 80]);
        assert.deepEqual(calls.find(call => call[0] === "scale"), ["scale", facing < 0 ? -1 : 1, 1]);
        assert.deepEqual(calls.find(call => call[0] === "image"), ["image", .4, sprite, -80, -140, 160, 160]);
        assert.equal(calls.filter(call => call[0] === "outline").length, 1);
        assert.equal(context.globalAlpha, .8);
      }
    }
  }
});

test("기본형·일반 부속지와 중립 생물의 사체 경로는 바꾸지 않는다", () => {
  const { scope, context, calls } = corpseRenderer();
  for (const attributes of [{}, { feet: 1, antenna: 1 }]) {
    calls.length = 0;
    assert.equal(scope.drawAgentCorpse(context, { tribe: "bean", facing: -1, attributes }, 0, 0, 100, null, 1), false);
    assert.deepEqual(calls, []);
  }
  assert.equal(scope.drawAgentCorpse(context, { species: "soil-boar", facing: -1, attributes: {} }, 0, 0, 100, null, 1), "creature");
});
