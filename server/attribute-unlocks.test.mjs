import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attributeUnlockLevel, isAttributeUnlocked } from "./attributes.mjs";
import { createGame } from "./game.mjs";

function fixture(tribe, level) {
  const occupiedCells = new Set(["1,0","2,0","3,0","0,1","1,1","2,1","3,1","4,1","0,2","1,2","2,2","3,2","4,2","0,3","1,3","2,3","3,3","4,3","1,4","2,4","3,4"]);
  const colony = { id:1, ownerId:tribe, tribe, x:40, y:40, occupiedCells };
  const environment = { simSeconds:0, world:{ seed:13, size:160, terrain:new Uint8Array(160*160).fill(4), hazards:new Uint8Array(160*160) }, colonies:[colony], games:new Map(), food:new Map(), foodSpots:new Map() };
  const game = createGame(environment, colony);
  environment.games.set(tribe, game);
  const saved = JSON.parse(game.save());
  saved.state.nestLevel = level;
  saved.state.evolutionPoints = 12500;
  game.restore(JSON.stringify(saved));
  return game;
}

test("승인한 4종족·4단계 개방표를 설계 명령에서도 강제한다", () => {
  const common = { antenna:1, strength:1, feet:1, carapace:3 };
  const harvest = { bean:null, spore:"blade", pebble:"piercing", spring:null };
  for (const [tribe, native] of Object.entries(harvest)) {
    const expected = { ...common, ...Object.fromEntries(Object.values(harvest).filter(Boolean).map(key => [key, key === native ? 1 : 2])) };
    for (const [key, level] of Object.entries(expected)) assert.equal(attributeUnlockLevel(key, tribe), level);
    for (const level of [1,2,3,4]) {
      const game = fixture(tribe, level);
      for (const [key, required] of Object.entries(expected)) {
        const action = { type:"design", templateId:null, name:key, slots:[key], birth:false };
        if (level >= required) assert.ok(game.command(action).templateId, tribe + key + level);
        else assert.throws(() => game.command(action), /설계 속성/, tribe + key + level);
      }
    }
    const initial = fixture(tribe,1);
    assert.ok(initial.agents.every(agent => agent.slots.every(key => expected[key] === 1)));
  }
  assert.equal(attributeUnlockLevel("retired", "bean"), null);
  assert.equal(attributeUnlockLevel("carapace", undefined), 3);
  assert.equal(isAttributeUnlocked("retired",4,"bean"), false);
});

test("이전 개체는 보존하고 잠긴 설계·복제·강화는 거부하며 둥지 성장 직후 탄생을 허용한다", () => {
  const game = fixture("bean",2);
  const saved = JSON.parse(game.save());
  const agentId = saved.state.agents[0].id;
  saved.state.templates = [{id:700, name:"이전 갑피", slots:["carapace"], attributeLevels:{carapace:1}, revision:1}];
  Object.assign(saved.state.agents[0], {slots:["carapace"], attributeLevels:{carapace:1}, activeSlots:["carapace"]});
  game.restore(JSON.stringify(saved));
  assert.deepEqual(game.agents[0].slots,["carapace"]);
  assert.equal(game.agents[0].attributes.carapace,1);
  assert.throws(() => game.command({type:"birth",templateId:700}), /설계를 수정/);
  assert.throws(() => game.command({type:"birth",agentId}), /설계를 수정/);
  assert.throws(() => game.command({type:"upgrade-attribute",templateId:700,attributeKey:"carapace"}), /둥지/);
  game.command({type:"upgrade"});
  assert.equal(game.nestLevel,3);
  assert.ok(game.command({type:"birth",templateId:700}).agentId);
  game.restore(game.save());
  assert.deepEqual(game.agents.find(agent => agent.id === agentId).slots,["carapace"]);
});

test("기획서 속성 페이지에 확정된 개방표와 기본 채집 속성을 표시한다", () => {
  const html = readFileSync(new URL("../Design.html",import.meta.url),"utf8");
  const table = html.split('<table id="attribute-unlocks">')[1].split('</table>')[0];
  assert.equal((table.match(/data-nest-level=/g) || []).length,4);
  for (const text of ["감지, 채집량 증가, 이속 증가 + 종족 기본 채집 속성", "나머지 채집 속성", "갑피"]) assert.ok(table.includes(text));
});
