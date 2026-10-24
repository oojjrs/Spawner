import { createRoom, saveRoom, restoreRoom, tickRoom, snapshotRoom, commandRoom, importRooms } from "./room.mjs";
import { openStorage } from "./storage.mjs";

let storage;
let room = null;
let running = false;
let visible = true;
let dirty = false;
let storageError = false;
let resumeAfterStorageError = false;
let lastTick = Date.now();
let lastSave = 0;
let queue = Promise.resolve();

const ready = new Promise((resolve, reject) => {
  if (!navigator.locks) { reject(new Error("이 브라우저에서는 안전한 로컬 저장을 사용할 수 없습니다. 최신 브라우저에서 열어 주세요.")); return; }
  navigator.locks.request("spawner-local", { ifAvailable: true }, async lock => {
    if (!lock) { reject(new Error("다른 탭에서 Spawner가 열려 있습니다. 그 탭을 닫은 뒤 이 페이지를 새로고침해 주세요.")); return; }
    try { storage = await openStorage(); resolve(); }
    catch (error) { reject(error); return; }
    await new Promise(() => {});
  }).catch(reject);
});
ready.catch(() => {});

function savedNotice() {
  postMessage({ type: "saved", roomId: room?.id, savedAt: lastSave });
}

async function persist() {
  if (!room || !dirty) return;
  try {
    const saved = saveRoom(room);
    await storage.put(saved);
    room.updatedAt = saved.updatedAt;
    dirty = false;
    if (storageError && resumeAfterStorageError) {
      running = true;
      lastTick = Date.now();
    }
    storageError = false;
    resumeAfterStorageError = false;
    lastSave = Date.now();
    savedNotice();
  } catch (error) {
    storageError = true;
    resumeAfterStorageError ||= running;
    running = false;
    const failure = new Error("브라우저에 저장하지 못해 진행을 멈췄습니다. 공간을 확보한 뒤 다시 시도하거나 백업을 내보내 주세요.", { cause: error });
    postMessage({ type: "error", error: failure.message, storageError: true });
    throw failure;
  }
}

function publish(includeWorld) {
  if (room && visible) postMessage({ type: "state", packet: { ...snapshotRoom(room, includeWorld),
    sampledAt: performance.timeOrigin + performance.now() - Math.max(0, Date.now() - lastTick) } });
}

async function advance() {
  if (!running || !room) return;
  const now = Date.now();
  if (now < lastTick) lastTick = now;
  const catchingUp = now - lastTick > 250;
  if (visible && catchingUp) postMessage({ type: "state", packet: { roomId: room.id, catchingUp: true } });
  let startedAt = performance.now();
  try {
    while (lastTick < now) {
      const milliseconds = Math.min(100, now - lastTick);
      tickRoom(room, milliseconds / 1000);
      lastTick += milliseconds;
      dirty = true;
      if (performance.now() - startedAt >= 8 && lastTick < now) {
        if (Date.now() - lastSave >= 5000) await persist();
        await new Promise(resolve => setTimeout(resolve, 0));
        startedAt = performance.now();
      }
    }
    if (catchingUp) await persist();
  } catch (error) {
    running = false;
    throw error;
  }
}

async function handle(type, data) {
  if (type === "session") return { roomId: await storage.setting("roomId") };
  if (type === "list") {
    return (await storage.list()).map(saved => ({ id: saved.id, title: saved.title,
      updatedAt: saved.updatedAt, simSeconds: saved.simSeconds })).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  if (type === "create") {
    await persist();
    const next = createRoom(data.title, crypto.getRandomValues(new Uint32Array(1))[0]);
    await storage.put(saveRoom(next));
    room = next;
    dirty = false;
    running = false;
    storageError = false;
    return { roomId: room.id };
  }
  if (type === "enter") {
    await persist();
    if (room?.id !== data.roomId) {
      const saved = await storage.get(data.roomId);
      if (!saved) throw new Error("저장된 월드를 찾을 수 없습니다.");
      room = restoreRoom(saved);
    }
    await storage.setSetting("roomId", room.id);
    storageError = false;
    lastTick = Date.now();
    lastSave = lastTick;
    running = data.visible;
    return { ...snapshotRoom(room, true), sampledAt: performance.timeOrigin + performance.now() };
  }
  if (type === "pause") {
    running = false;
    resumeAfterStorageError = false;
    await persist();
    return null;
  }
  if (type === "resume") {
    await persist();
    storageError = false;
    if (!running) {
      lastTick = Date.now();
      lastSave = lastTick;
    }
    running = !!room;
    publish(false);
    return null;
  }
  if (type === "visibility") {
    await persist();
    if (visible) publish(false);
    return null;
  }
  if (type === "command") {
    if (!room || room.id !== data.roomId || storageError) throw new Error("월드를 다시 열어 주세요.");
    const result = commandRoom(room, data.action);
    dirty = true;
    await persist();
    publish(false);
    return result;
  }
  if (type === "delete") {
    const saved = await storage.get(data.roomId);
    if (!saved || saved.title !== data.title) throw new Error("월드 이름이 일치하지 않습니다.");
    await storage.remove(data.roomId);
    if (room?.id === data.roomId) { running = false; room = null; dirty = false; }
    if (await storage.setting("roomId") === data.roomId) await storage.setSetting("roomId", null);
    return null;
  }
  if (type === "export") {
    const saved = room?.id === data.roomId ? saveRoom(room) : await storage.get(data.roomId);
    if (!saved) throw new Error("내보낼 월드를 찾을 수 없습니다.");
    return { title: saved.title, text: JSON.stringify({ format: "spawner-local", version: 1, rooms: [saved] }) };
  }
  if (type === "import") {
    const imported = importRooms(JSON.parse(data.text));
    await storage.putAll(imported);
    return { count: imported.length };
  }
  throw new Error("요청을 처리하지 못했습니다.");
}

function enqueue(action) {
  queue = queue.catch(() => {}).then(action);
  return queue;
}

self.onmessage = event => {
  const { id, type, data } = event.data;
  if (type === "visibility" || type === "resume") visible = data.visible;
  enqueue(async () => {
    try {
      await ready;
      await advance();
      postMessage({ id, result: await handle(type, data) });
    }
    catch (error) { postMessage({ id, error: error.message }); }
  });
};

let stepping = false;
setInterval(() => {
  if (!running || !room || stepping) return;
  stepping = true;
  enqueue(async () => {
    try {
      if (!running || !room) return;
      await advance();
      publish(false);
      if (Date.now() - lastSave >= 5000) await persist();
    } catch (error) {
      running = false;
      postMessage({ type: "error", error: error.message, storageError });
    } finally { stepping = false; }
  });
}, 100);
