import test from "node:test";
import assert from "node:assert/strict";
import { createStateEncoder, createStateDecoder } from "./state-delta.mjs";

function packet(revision) {
  return { roomId: "world", colonyId: 1, revision, state: { simSeconds: revision / 10,
    agents: [{ id: "1:1", x: 10, stats: { health: 12 } }], rivals: [], food: [{ x: 4, y: 5, amount: 8 }],
    explored: Array.from({ length: 102400 }, (_, index) => index), visible: [1, 2, 3],
    sharedTrails: [], footprints: [], corpses: [], buildings: [], templates: [], discoveries: [], burrows: [] } };
}

test("첫 상태·차분·제거·순서 변경은 원본 스냅샷과 동일하게 복원된다", () => {
  const encoder = createStateEncoder(), decoder = createStateDecoder();
  const first = packet(1);
  first.state.explored.pop();
  assert.deepEqual(decoder.decode(structuredClone(encoder.encode(first, false))), first);
  const next = packet(2);
  next.state.agents[0].x++;
  next.state.agents.push({ id: "1:2", x: 9 });
  next.state.food = [];
  next.state.visible = [3, 2, 1, 4];
  assert.deepEqual(decoder.decode(structuredClone(encoder.encode(next, false))), next);
  const last = structuredClone(next);
  last.revision++;
  last.state.agents.reverse();
  last.state.explored.reverse();
  last.state.agents[1].stats.health--;
  assert.deepEqual(decoder.decode(structuredClone(encoder.encode(last, false))), last);
});

test("탐험 전체와 변경 없는 컬렉션은 매 틱 전송·재구성하지 않는다", () => {
  const encoder = createStateEncoder(), decoder = createStateDecoder(), first = packet(1);
  const base = decoder.decode(structuredClone(encoder.encode(first, false)));
  const next = packet(2), delta = encoder.encode(next, false);
  assert.ok(JSON.stringify(delta).length < JSON.stringify(next).length / 100);
  const result = decoder.decode(structuredClone(delta));
  for (const name of ["explored", "visible", "food", "agents", "footprints"]) assert.equal(result.state[name], base.state[name]);
  assert.equal(result.state.simSeconds, .2);
});

test("가변 중첩 속성 변경과 종족 전환·재접속은 이전 상태를 섞지 않는다", () => {
  const encoder = createStateEncoder(), decoder = createStateDecoder(), first = packet(1);
  decoder.decode(structuredClone(encoder.encode(first, false)));
  first.state.agents[0].stats.health = 3;
  first.revision++;
  assert.equal(decoder.decode(structuredClone(encoder.encode(first, false))).state.agents[0].stats.health, 3);
  const switched = packet(3); switched.colonyId = 2;
  assert.equal(Object.hasOwn(encoder.encode(switched, false), "baseRevision"), false);
  decoder.decode(structuredClone(switched));
  const full = encoder.encode(packet(4), true);
  assert.equal(Object.hasOwn(full, "baseRevision"), false);
  assert.deepEqual(decoder.decode(structuredClone(full)), packet(4));
  assert.throws(() => decoder.decode({ roomId: "world", colonyId: 1, revision: 9, baseRevision: 2, state: {}, patches: {} }), /동기화/);
});
