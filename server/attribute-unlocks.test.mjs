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
  const common = { antenna:1, strength:1, feet:1, construction:1, lifespan:2, carapace:3, regeneration:3, guard:4 };
  const harvest = { bean:"excavation", spore:"blade", pebble:"piercing", spring:"butchery" };
  for (const [tribe, native] of Object.entries(harvest)) {
    const expected = { ...common, ...Object.fromEntries(Object.values(harvest).map(key => [key, key === native ? 1 : 2])) };
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
  const game = fixture("bean",3);
  const saved = JSON.parse(game.save());
  const agentId = saved.state.agents[0].id;
  saved.state.templates = [{id:700, name:"이전 엄호", slots:["guard"], attributeLevels:{guard:1}, revision:1}];
  saved.state.buildings = [{id:1, key:"evolution-lab", x:50, y:50, health:100}];
  Object.assign(saved.state.agents[0], {slots:["guard"], attributeLevels:{guard:1}, activeSlots:["guard"]});
  game.restore(JSON.stringify(saved));
  assert.deepEqual(game.agents[0].slots,["guard"]);
  assert.equal(game.agents[0].attributes.guard,1);
  assert.throws(() => game.command({type:"birth",templateId:700}), /설계를 수정/);
  assert.throws(() => game.command({type:"birth",agentId}), /설계를 수정/);
  assert.throws(() => game.command({type:"upgrade-attribute",templateId:700,attributeKey:"guard"}), /둥지/);
  game.command({type:"upgrade"});
  assert.equal(game.nestLevel,4);
  assert.ok(game.command({type:"birth",templateId:700}).agentId);
  game.restore(game.save());
  assert.deepEqual(game.agents.find(agent => agent.id === agentId).slots,["guard"]);
});

test("기획서 속성 페이지에 확정된 개방표와 기본 채집 속성을 표시한다", () => {
  const html = readFileSync(new URL("../Design.html",import.meta.url),"utf8");
  const table = html.split('<table id="attribute-unlocks">')[1].split('</table>')[0];
  assert.equal((table.match(/data-nest-level=/g) || []).length,4);
  for (const text of ["감지, 채집량 증가, 이속 증가, 변태 + 종족 기본 채집 속성", "수명 + 나머지 채집 속성", "갑피, 재생", "엄호"]) assert.ok(table.includes(text));
  assert.ok(html.includes("새싹콩=굴착, 포자버섯=칼날, 몽돌=관통, 샘방울=흡수"));
});
