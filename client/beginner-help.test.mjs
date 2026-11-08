import test from "node:test";
import assert from "node:assert/strict";
import { beginnerHelpOffer } from "./beginner-help.mjs";
import { DNA_STARTER_DESIGNS } from "./dna-starter-designs.mjs";

function fixture() {
  const dna = structuredClone(DNA_STARTER_DESIGNS[0].design);
  return { tribe: "bean", nestLevel: 1, nestHealth: 100, evolutionPoints: 30, simSeconds: 10,
    templates: [{ id: 1, name: "채집", dna, slots: [] }],
    agents: Array.from({ length: 4 }, (_, id) => ({ id, dna, health: 10 })) };
}
function offer(state, dismissed) {
  return beginnerHelpOffer(state, { enabled: true, completed: [], dismissed: dismissed || [] }, {});
}

test("80P에서는 재촉하지 않고 81P부터 성장을 안내한다", () => {
  const state = fixture();
  state.simSeconds = 90;
  state.evolutionPoints = 80;
  assert.equal(offer(state), null);
  state.evolutionPoints = 81;
  assert.equal(offer(state).key, "upgrade");
  assert.equal(offer(state).action.command.type, "upgrade");
  state.tribe = "pebble";
  assert.equal(offer(state).action.label, "성장 · 30P");
  assert.equal(offer(state, ["upgrade"]), null);
});

test("성장 뒤 전사 생산을 안내하고 생산된 전사가 있으면 사라진다", () => {
  const state = fixture();
  state.nestLevel = 2;
  state.simSeconds = 90;
  assert.equal(offer(state).key, "military");
  assert.equal(offer(state).action.command.type, "design");
  assert.equal(offer(state).action.command.birth, true);
  state.agents.push({ id: 9, health: 10, dna: structuredClone(DNA_STARTER_DESIGNS[1].design) });
  assert.equal(offer(state), null);
});

test("현재 시작 종족의 전용 자원만 안내한다", () => {
  const state = fixture();
  for (const [tribe, resource, others] of [["bean", "비옥토", ["이슬방울", "목재", "자갈"]], ["spring", "이슬방울", ["비옥토", "목재", "자갈"]], ["spore", "목재", ["이슬방울", "비옥토", "자갈"]], ["pebble", "자갈", ["이슬방울", "목재", "비옥토"]]]) {
    state.tribe = tribe;
    const intro = offer(state);
    assert.equal(intro.key, "intro");
    assert.ok(intro.detail.includes(resource));
    for (const name of others) assert.equal(intro.detail.includes(name), false);
  }
});

test("도움말을 끄거나 게임이 끝나면 생산 명령을 제안하지 않는다", () => {
  const state = fixture();
  state.agents = [];
  const guide = offer(state);
  assert.equal(guide.key, "gatherer");
  assert.equal(guide.action.command.templateId, 1);
  state.evolutionPoints = 0;
  assert.equal(offer(state).action.disabled, true);
  assert.match(offer(state).action.issue, /P 부족합니다/);
  assert.equal(beginnerHelpOffer(state, { enabled: false, completed: [], dismissed: [] }, {}), null);
  state.ending = "extinction";
  assert.equal(offer(state), null);
});
