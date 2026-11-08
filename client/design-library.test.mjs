import test from "node:test";
import assert from "node:assert/strict";
import { savedRoomDesigns, restoreRoomDesigns } from "./design-library.mjs";

function fixture() {
  const dna = { version: 6, level: 4, budget: 999999, pieces: [{ gene: "health", grade: 1, q: 0, r: 0, rotation: 0 }] };
  const state = { templates: [{ id: 1, name: "기초 채집", dna: null, slots: [], revision: 1 }], nextTemplateId: 2,
    agents: [{ id: 1 }], evolutionPoints: 30, nestLevel: 1 };
  const game = { save: () => JSON.stringify({ state }), restore: value => Object.assign(state, JSON.parse(value).state) };
  const room = { id: "new", hostId: "host", colonies: [{ ownerId: "host", tribe: "bean" }], games: new Map([["host", game]]) };
  return { room, state, dna, saved: () => ({ ...room, games: [["host", game.save()]] }) };
}

test("판과 다른 안정된 식별자로 사용자 설계를 보관하고 AI 설계는 제외한다", () => {
  const value = fixture();
  value.state.templates.push({ id: 2, name: "자동", automatic: true, dna: value.dna });
  value.room.designIds = { '["host",1]': "original-design" };
  const designs = savedRoomDesigns(value.saved());
  assert.equal(designs.length, 1);
  assert.equal(designs[0].id, "original-design");
  assert.equal(designs[0].tribe, "bean");
  assert.equal(Object.hasOwn(designs[0].template, "id"), false);
  assert.deepEqual(savedRoomDesigns(undefined), []);
  value.room.colonies[0].tribe = null;
  assert.deepEqual(savedRoomDesigns(value.saved()), []);
});

test("새 판에 같은 종족의 상위 설계를 온전히 가져오고 진행과 원본은 보존한다", () => {
  const value = fixture();
  const designs = [{ id: "saved", tribe: "bean", template: { name: "내 설계", dna: value.dna, slots: [], revision: 3 } },
    { id: "other", tribe: "spore", template: { name: "다른 종족", dna: value.dna, slots: [] } }];
  const before = structuredClone(designs);
  restoreRoomDesigns(value.room, designs);
  assert.equal(value.state.templates.length, 2);
  assert.deepEqual(value.state.templates[1].dna, before[0].template.dna);
  assert.equal(value.state.templates[1].id, 2);
  assert.equal(value.state.nextTemplateId, 3);
  assert.equal(value.state.evolutionPoints, 30);
  assert.equal(value.state.nestLevel, 1);
  assert.deepEqual(value.state.agents, [{ id: 1 }]);
  assert.equal(savedRoomDesigns(value.saved())[1].id, "saved");
  value.state.templates[1].dna.pieces[0].q = 2;
  assert.deepEqual(designs, before);
  restoreRoomDesigns(value.room, designs);
  assert.equal(value.state.templates.length, 2);
});

test("기본 설계는 재사용하고 동명이 설계는 지우지 않고 구분한다", () => {
  const value = fixture();
  restoreRoomDesigns(value.room, [
    { id: "starter", tribe: "bean", template: { name: "기초 채집", dna: null, slots: [] } },
    { id: "custom", tribe: "bean", template: { name: "기초 채집", dna: value.dna, slots: [] } }
  ]);
  assert.equal(value.state.templates.length, 2);
  assert.equal(value.state.templates[0].id, 1);
  assert.equal(value.state.templates[1].name, "기초 채집 2");
  assert.deepEqual(savedRoomDesigns(value.saved()).map(design => design.id), ["starter", "custom"]);
});

test("설계 목록 한도에 닿아도 보관 원본과 다른 설계를 변경하지 않는다", () => {
  const value = fixture();
  value.state.templates = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: String(index), slots: [] }));
  const designs = [{ id: "overflow", tribe: "bean", template: { name: "보관", dna: value.dna, slots: [] } }];
  const before = structuredClone(designs);
  restoreRoomDesigns(value.room, designs);
  assert.equal(value.state.templates.length, 100);
  assert.equal(value.state.nextTemplateId, 101);
  assert.deepEqual(designs, before);
  assert.equal(Object.values(value.room.designIds).includes("overflow"), false);
});

test("수동 순서는 새 판의 기본 설계 재사용 후에도 그대로 복원한다", async () => {
  const { savedRoomDesignOrder, orderLibraryDesigns } = await import('./design-library.mjs');
  const value = fixture();
  assert.equal(savedRoomDesignOrder(value.saved()), null);
  const designs = orderLibraryDesigns([
    { id: 'starter', tribe: 'bean', updatedAt: 20, template: { name: '기초 채집', dna: null, slots: [] } },
    { id: 'custom', tribe: 'bean', updatedAt: 10, template: { name: '내 설계', dna: value.dna, slots: [] } }
  ], ['custom', 'starter']);
  restoreRoomDesigns(value.room, designs);
  assert.deepEqual(value.state.templates.map(template => template.name), ['내 설계', '기초 채집']);
  assert.deepEqual(savedRoomDesignOrder(value.saved()), ['custom', 'starter']);
  const legacy = orderLibraryDesigns([{ id: 'a', updatedAt: 10 }, { id: 'b', updatedAt: 20 }]);
  assert.deepEqual(legacy.map(design => design.id), ['b', 'a']);
  assert.equal(Object.hasOwn(legacy[0], 'order'), false);
  assert.deepEqual(orderLibraryDesigns([{ id: 'a', updatedAt: 10 }, { id: 'b', updatedAt: 20 }, { id: 'new', updatedAt: 30 }], ['missing', 'a', 'b']).map(design => design.id), ['a', 'b', 'new']);
});
