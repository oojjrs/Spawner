import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.mjs';

function fixture() {
  const colony = { id: 1, ownerId: 'order-test', x: 40, y: 40, occupiedCells: new Set(['1,1']) };
  const environment = { world: { seed: 13, terrain: new Uint8Array(320 * 320).fill(4), hazards: new Uint8Array(320 * 320) },
    colonies: [colony], games: new Map(), food: new Map(), foodSpots: new Map() };
  const game = createGame(environment, colony);
  environment.games.set(colony.ownerId, game);
  const ids = ['첫째', '둘째', '셋째'].map(name => game.command({ type: 'design', templateId: null, name, slots: [], birth: false }).templateId);
  return { game, ids };
}

test('설계 순서만 변경하고 저장·복원 후에도 순서와 설계 내용을 유지한다', () => {
  const { game, ids } = fixture(), before = JSON.parse(game.save()).state;
  const order = [ids[2], ids[0], ids[1]];
  game.command({ type: 'reorder-designs', templateIds: order });
  const after = JSON.parse(game.save()).state;
  assert.deepEqual(game.snapshot().templates.map(template => template.id), order);
  assert.deepEqual(after.templates, order.map(id => before.templates.find(template => template.id === id)));
  assert.deepEqual({ ...after, templates: before.templates, templateOrderEdited: undefined }, { ...before, templateOrderEdited: undefined });
  game.restore(game.save());
  assert.deepEqual(game.snapshot().templates.map(template => template.id), order);
  game.command({ type: 'design', templateId: ids[0], name: '이름 수정', slots: [], birth: false });
  assert.deepEqual(game.snapshot().templates.map(template => template.id), order);
  const added = game.command({ type: 'design', templateId: null, name: '넷째', slots: [], birth: false }).templateId;
  assert.deepEqual(game.snapshot().templates.map(template => template.id), [...order, added]);
  game.command({ type: 'delete-design', templateId: ids[0] });
  assert.deepEqual(game.snapshot().templates.map(template => template.id), [ids[2], ids[1], added]);
});

test('중복·누락·알 수 없는 ID·옛 목록 요청은 일부도 변경하지 않고 거절한다', () => {
  const { game, ids } = fixture(), before = game.save();
  for (const templateIds of [null, {}, [], [ids[0]], [ids[0], ids[0], ids[2]], [...ids, 99], [ids[0], ids[1], 99], ids.map(String)]) {
    assert.throws(() => game.command({ type: 'reorder-designs', templateIds }), /설계 목록이 변경/);
    assert.equal(game.save(), before);
  }
  game.command({ type: 'design', templateId: null, name: '새 설계', slots: [], birth: false });
  assert.throws(() => game.command({ type: 'reorder-designs', templateIds: ids }), /설계 목록이 변경/);
});

test('기존 저장은 순서를 유지하고 종료된 게임에서는 재정렬하지 않는다', () => {
  const { game, ids } = fixture(), saved = JSON.parse(game.save());
  assert.equal(saved.state.templateOrderEdited, undefined);
  game.restore(JSON.stringify(saved));
  assert.deepEqual(game.snapshot().templates.map(template => template.id), ids);
  saved.state.ending = { reason: 'extinction' };
  game.restore(JSON.stringify(saved));
  assert.throws(() => game.command({ type: 'reorder-designs', templateIds: ids.toReversed() }), /끝난 군락/);
});
