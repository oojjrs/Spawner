import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "./game.mjs";

function fixture(tribe, points, nestLevel) {
  const occupiedCells = new Set(["1,0", "2,0", "3,0", "0,1", "1,1", "2,1", "3,1", "4,1", "0,2", "1,2", "2,2", "3,2", "4,2", "0,3", "1,3", "2,3", "3,3", "4,3", "1,4", "2,4", "3,4"]);
  const colony = { id:1, ownerId:"production-test", tribe, x:40, y:40, occupiedCells };
  const environment = { simSeconds:0, world:{ seed:13, terrain:new Uint8Array(320 * 320).fill(4), hazards:new Uint8Array(320 * 320) },
    colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const saved = JSON.parse(game.save());
  saved.state.agents = [];
  saved.state.evolutionPoints = points;
  saved.state.nestLevel = nestLevel;
  game.restore(JSON.stringify(saved));
  return game;
}

test("같은 30포인트로 종족별로 승인된 수의 한 속성 개체를 실제 생산한다", () => {
  for (const [tribe, expected] of [["bean",8], ["spring",8], ["pebble",6], ["spore",12]]) {
    const game = fixture(tribe, 30, 1);
    const { templateId } = game.command({type:"design", templateId:null, name:"생산", slots:["strength"], birth:false});
    for (let index = 0; index < expected; index++) {
      const { agentId } = game.command({type:"birth", templateId});
      const agent = game.agents.find(entry => entry.id === agentId);
      agent.x = 65 + index * 2; agent.y = 65;
    }
    assert.throws(() => game.command({type:"birth", templateId}), /진화 포인트/, tribe);
    assert.equal(game.agents.length, expected, tribe);
    assert.equal(Math.round((30-game.snapshot().evolutionPoints)*10)/10, Math.round(game.agents.reduce((sum,agent)=>sum+agent.cost,0)*10)/10, tribe);
  }
});

test("속성 네 개의 생산비 차감과 저장된 과거 지불액을 구분한다", () => {
  for (const [tribe, remaining] of [["spore",25.2], ["pebble",20.4]]) {
    const game = fixture(tribe, 30, 4);
    const { agentId } = game.command({type:"design", templateId:null, name:"복합", slots:["antenna","strength","feet","lifespan"], birth:true});
    assert.equal(game.snapshot().evolutionPoints, remaining, tribe);
    const saved = JSON.parse(game.save());
    saved.state.agents[0].cost = 17;
    game.restore(JSON.stringify(saved));
    const agent = game.agents.find(entry=>entry.id===agentId);
    assert.equal(agent.cost, 17, tribe);
    assert.equal(agent.lifespan, tribe === "pebble" ? 480 : 300, tribe);
    assert.deepEqual(agent.slots, ["antenna","strength","feet","lifespan"]);
  }
});

test("개체가 없어도 실제 종족의 기본 개체 생산비가 남아 있으면 계속할 수 있다", () => {
  for (const [tribe, points, ended] of [["spore",2,false], ["pebble",3,true], ["bean",3,false], ["spring",3,false]]) {
    const game = fixture(tribe, points, 1);
    game.checkEnding();
    assert.equal(!!game.snapshot().ending, ended, tribe);
  }
});
