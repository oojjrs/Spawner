import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

function fixture(tribe) {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id:1, ownerId:"recovery-test", tribe, x:40, y:40, occupiedCells };
  const environment = { simSeconds:0, world:{ seed:13, generationVersion:15,
    terrain:new Uint8Array(320 * 320).fill(0), hazards:new Uint8Array(320 * 320) },
    colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  for (let y=35;y<55;y++) for (let x=35;x<55;x++) environment.world.terrain[y*320+x]=4;
  const game = createGame(environment,colony);
  environment.games.set(colony.ownerId,game);
  const saved = JSON.parse(game.save());
  saved.state.agents=[]; saved.state.nestLevel=2; saved.state.evolutionPoints=30;
  game.restore(JSON.stringify(saved));
  const {agentId} = game.command({type:"design",templateId:null,name:"회수",slots:[],birth:true});
  const harvester=game.agents.find(agent=>agent.id===agentId);
  Object.assign(harvester,{x:46,y:42,renderFromX:46,renderFromY:42,birth:null,
    moveStartedAt:0,moveDuration:0,personality:Object.freeze({boldness:0,aggression:0,curiosity:0})});
  const born = game.command({type:"design",templateId:null,name:"개체",slots:[],birth:true});
  const victim=game.agents.find(agent=>agent.id===born.agentId);
  Object.assign(victim,{x:47,y:42,renderFromX:47,renderFromY:42,birth:null,moveStartedAt:0,moveDuration:0});
  const explored=JSON.parse(game.save());
  explored.state.explored={collection:"Set",entries:[]};
  for (let y=25;y<65;y++) for (let x=25;x<65;x++) explored.state.explored.entries.push(y*320+x);
  game.restore(JSON.stringify(explored));
  return {game,environment,harvesterId:agentId,victimId:born.agentId};
}

test("구버전 양분과 고기 재고·운반·채집·예약·발견은 복원에서 제거한다", () => {
  for (const type of ["nutrients", "meat"]) {
    const f = fixture("bean"), saved = JSON.parse(f.game.save());
    saved.state.resourceInventory = { [type]: 8, clay: 4 };
    saved.state.resourceStores = [{ id: "nest:1", kind: "nest", inventory: { [type]: 8, clay: 4 } }];
    Object.assign(saved.state.agents[0], { carrying: 2, carryingType: type, foodDelivery: { resourceType: type, amount: 2 },
      harvestResult: { kind: "corpse", resourceType: type }, transport: { type, amount: 2 }, transportCargo: { siteId: "old" },
      utility: { action: "collect", target: { key: "47,42", x: 47, y: 42 }, scores: [{ key: "47,42" }] },
      suspendedWork: { action: "collect", target: { key: "47,42", x: 47, y: 42 } }, rememberedFoodKey: "47,42", rememberedRoute: [{ x: 47, y: 42 }],
      preciseHarvestTimes: { collection: "Map", entries: [["47,42", 0]] }, appearanceAttributes: { butchery: 1, blade: 1 } });
    const old = { kind: "corpse", agentId: "old", colonyId: 1, x: 47, y: 42, resourceType: type, amount: 0, initialAmount: 4, diedAt: 0, decaysAt: 300 };
    f.environment.food.set("47,42", old);
    f.environment.food.set("drop:" + type, { resourceType: type, amount: 2, dropped: true, x: 48, y: 42 });
    f.environment.foodSpots.set("old", { cells: [old] });
    saved.state.knownFood.entries.push(["47,42", { ...old }]);
    saved.state.discoveries.push({ key: "food:" + type, kind: "food" }, { key: "attribute:butchery", kind: "attribute" });
    const before = saved.state.evolutionPoints;
    f.game.restore(JSON.stringify(saved));
    const restored = f.game.agents[0];
    assert.equal(restored.carrying, 0); assert.equal(restored.carryingType, null);
    for (const key of ["foodDelivery", "harvestResult", "utility", "suspendedWork", "rememberedFoodKey", "rememberedRoute"]) assert.equal(restored[key], null, key);
    assert.equal("transport" in restored, false); assert.equal("transportCargo" in restored, false);
    assert.equal(restored.preciseHarvestTimes.size, 0); assert.equal("butchery" in restored.appearanceAttributes, false);
    const snapshot = f.game.snapshot();
    assert.deepEqual(snapshot.resourceInventory, { clay: 4 });
    assert.ok(snapshot.resourceStores.every(store => !(type in store.inventory)));
    assert.ok(snapshot.discoveries.every(entry => !["food:" + type, "attribute:butchery"].includes(entry.key)));
    assert.ok(snapshot.food.every(cell => cell.kind !== "corpse" && cell.resourceType !== type));
    assert.equal(f.environment.foodSpots.get("old").cells.length, 0); assert.equal(f.environment.food.has("drop:" + type), false);
    assert.equal(snapshot.corpses.length, 1);
    f.game.prepare(3); f.game.tick(0);
    assert.equal(f.game.snapshot().corpses.length, 0); assert.equal(f.game.snapshot().evolutionPoints, before);
    assert.equal(JSON.parse(f.game.save()).state.knownFood.entries.some(([, cell]) => cell.kind === "corpse"), false);
  }
});
