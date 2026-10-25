import { createRoom, chooseRoomTribe, saveRoom, restoreRoom, tickRoom, snapshotRoom, commandRoom } from "./room.mjs";
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
      running = visible;
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
    const failure = new Error("브라우저에 저장하지 못해 진행을 멈췄습니다. 공간을 확보한 뒤 다시 시도해 주세요.", { cause: error });
    postMessage({ type: "error", error: failure.message, storageError: true });
    throw failure;
  }
}

function publish(includeWorld) {
  if (room && visible) postMessage({ type: "state", packet: { ...snapshotRoom(room, includeWorld),
    sampledAt: performance.timeOrigin + performance.now() - Math.max(0, Date.now() - lastTick) } });
}

async function handle(type, data) {
  if (type === "session") return { roomId: await storage.setting("roomId") };
  if (type === "list") {
    return (await storage.list()).map(saved => ({ id: saved.id, title: saved.title, seed: saved.seed,
      updatedAt: saved.updatedAt, simSeconds: saved.simSeconds,
      tribe: saved.colonies.find(colony => colony.ownerId === saved.hostId)?.tribe })).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  if (type === "create") {
    await persist();
    if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 4294967295) throw new Error("시드는 0~4294967295 사이의 정수로 입력해 주세요.");
    const next = createRoom(data.title, data.seed, null);
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
    running = data.visible && room.colonies.find(colony => colony.ownerId === room.hostId).tribe !== null;
    return { ...snapshotRoom(room, true), sampledAt: performance.timeOrigin + performance.now() };
  }
  if (type === "pause") {
    running = false;
    resumeAfterStorageError = false;
    await persist();
    return null;
  }
  if (type === "choose-tribe") {
    if (!room || room.id !== data.roomId) throw new Error("방을 다시 열어 주세요.");
    chooseRoomTribe(room, data.tribe);
    dirty = true;
    await persist();
    return { roomId: room.id };
  }
  if (type === "resume") {
    await persist();
    storageError = false;
    lastTick = Date.now();
    lastSave = lastTick;
    running = !!room && visible && room.colonies.find(colony => colony.ownerId === room.hostId).tribe !== null;
    publish(false);
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
  throw new Error("요청을 처리하지 못했습니다.");
}

function enqueue(action) {
  queue = queue.catch(() => {}).then(action);
  return queue;
}

self.onmessage = event => {
  const { id, type, data } = event.data;
  if (type === "enter" || type === "resume") visible = data.visible;
  if (type === "pause") visible = false;
  enqueue(async () => {
    try {
      await ready;
      postMessage({ id, result: await handle(type, data) });
    }
    catch (error) { postMessage({ id, error: error.message }); }
  });
};

let stepping = false;
setInterval(() => {
  if (!running || !room || !visible || stepping) return;
  stepping = true;
  enqueue(async () => {
    try {
      if (!running || !room || !visible) return;
      const now = Date.now();
      const elapsed = Math.min(0.25, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;
      tickRoom(room, elapsed);
      dirty = true;
      publish(false);
      if (Date.now() - lastSave >= 5000) await persist();
    } catch (error) {
      running = false;
      postMessage({ type: "error", error: error.message, storageError });
    } finally { stepping = false; }
  });
}, 100);
