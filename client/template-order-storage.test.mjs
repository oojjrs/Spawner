import test from 'node:test';
import assert from 'node:assert/strict';
import { openStorage } from './storage.mjs';

// Async transaction double: callbacks may enqueue further requests, and a
// settings failure rolls back rooms/designs just like the browser transaction.
function indexedDatabase() {
  const stores = new Map(['rooms', 'room-list', 'designs', 'settings'].map(name => [name, new Map()]));
  const fake = { failSettings: false, open() {
    const request = {};
    queueMicrotask(() => { request.result = database; request.onsuccess(); });
    return request;
  } };
  const database = { close() {}, transaction(names, mode) {
    names = typeof names === 'string' ? [names] : names;
    const local = new Map(names.map(name => [name, structuredClone(stores.get(name))]));
    let pending = 0, failed = false, completed = false;
    const task = { abort() { if (failed || completed) return; failed = true; queueMicrotask(() => task.onabort?.()); }, objectStore(name) {
      const store = local.get(name);
      function request(action) {
        const request = {}; pending++;
        queueMicrotask(() => {
          if (!failed) {
            try { request.result = structuredClone(action()); request.onsuccess?.(); }
            catch (error) { task.error = error; task.abort(); }
          }
          pending--;
          queueMicrotask(() => {
            if (pending || failed || completed) return;
            completed = true;
            if (mode === 'readwrite') for (const [name, store] of local) stores.set(name, store);
            task.oncomplete?.();
          });
        });
        return request;
      }
      return { get: key => request(() => store.get(key)), getAll: () => request(() => [...store].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([,value]) => value)),
        put: (value, key = value?.id) => { const saved = structuredClone(value); return request(() => { if (name === 'settings' && fake.failSettings) throw Error('저장 공간 부족'); store.set(key, saved); return key; }); },
        delete: key => request(() => store.delete(key)) };
    } };
    return task;
  } };
  return fake;
}
function fixture() {
  const templates = [1, 2, 3].map(id => ({ id, name: `설계 ${id}`, slots: [], revision: 1 }));
  const room = { id: 'world', title: '순서', version: 2, hostId: 'host', updatedAt: 1,
    colonies: [{ ownerId: 'host', tribe: 'bean', x: 0, y: 0 }], world: { terrain: [] }, games: [['host', JSON.stringify({ state: { templates } })]] };
  const reorder = order => { room.updatedAt++; room.games = [['host', JSON.stringify({ state: { templates: order.map(id => templates[id - 1]), templateOrderEdited: true } })]]; };
  return { templates, room, reorder };
}

test('순서는 설계 수정 시각과 별개로 저장되며 재접속과 새 판에도 제공된다', async () => {
  globalThis.indexedDB = indexedDatabase();
  const storage = await openStorage(), { room, reorder } = fixture();
  await storage.put(room);
  const initial = await storage.designs('bean');
  reorder([3, 1, 2]); await storage.put(room);
  const library = await storage.designs('bean');
  assert.deepEqual(library.map(d => d.template.name), ['설계 3', '설계 1', '설계 2']);
  assert.deepEqual(library.map(d => d.updatedAt), [1, 1, 1]);
  const reopened = await openStorage();
  assert.deepEqual(await reopened.designs('bean'), library);
  assert.deepEqual(JSON.parse((await reopened.get(room.id)).games[0][1]).state.templates.map(t => t.id), [3, 1, 2]);
  assert.deepEqual(await storage.designs('spore'), []);
  assert.deepEqual(initial.map(d => d.template.name), ['설계 1', '설계 2', '설계 3']);
});

test('다른 판의 더 최근 순서를 기존 판의 자동 저장이 덮어쓰지 않는다', async () => {
  globalThis.indexedDB = indexedDatabase();
  const storage = await openStorage(), { room, templates, reorder } = fixture();
  await storage.put(room); reorder([3, 1, 2]); await storage.put(room);
  const library = await storage.designs('bean'), other = structuredClone(room);
  other.id = 'other'; other.designIds = Object.fromEntries(library.map(d => [JSON.stringify(['host', templates.find(t => t.name === d.template.name).id]), d.id]));
  other.games = [['host', JSON.stringify({ state: { templates: [templates[1], templates[2], templates[0]], templateOrderEdited: true } })]];
  await storage.put(other); await storage.put(room);
  assert.deepEqual((await storage.designs('bean')).map(d => d.template.name), ['설계 2', '설계 3', '설계 1']);
});

test('설계 순서 설정 저장 실패 시 방 순서도 함께 롤백된다', async () => {
  const fake = indexedDatabase(); globalThis.indexedDB = fake;
  const storage = await openStorage(), { room, reorder } = fixture();
  await storage.put(room); const before = await storage.get(room.id);
  fake.failSettings = true; reorder([3, 2, 1]);
  await assert.rejects(storage.put(room), /저장 공간 부족/);
  assert.deepEqual(await storage.get(room.id), before);
  assert.deepEqual((await storage.designs('bean')).map(d => d.template.name), ['설계 1', '설계 2', '설계 3']);
  fake.failSettings = false; await storage.put(room);
  assert.deepEqual((await storage.designs('bean')).map(d => d.template.name), ['설계 3', '설계 2', '설계 1']);
});
