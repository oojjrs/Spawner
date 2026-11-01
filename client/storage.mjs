import { generateWorld } from "../server/world.mjs";

export async function openStorage() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open("spawner-local", 3);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("rooms")) database.createObjectStore("rooms", { keyPath: "id" });
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings");
      if (!database.objectStoreNames.contains("room-list")) database.createObjectStore("room-list", { keyPath: "id" });
      const rooms = request.transaction.objectStore("rooms").openCursor();
      rooms.onsuccess = () => {
        const cursor = rooms.result;
        if (!cursor) return;
        request.transaction.objectStore("room-list").put(roomListing(cursor.value));
        cursor.continue();
      };
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("다른 Spawner 탭을 닫고 다시 열어 주세요."));
  });
  database.onversionchange = () => database.close();

  function transaction(storeName, mode, action) {
    return new Promise((resolve, reject) => {
      const task = database.transaction(storeName, mode);
      let request;
      try { request = action(task); }
      catch (error) { task.abort(); reject(error); return; }
      task.oncomplete = () => resolve(request?.result);
      task.onabort = () => reject(task.error || new Error("브라우저 저장을 완료하지 못했습니다."));
      task.onerror = () => {};
    });
  }

  function roomWorldPreview(room) {
    const world = room.world || (room.version === 1 ? generateWorld(room.seed, room.worldGenerationVersion ?? 1) : null);
    if (!world?.terrain) return null;
    const size = 96, worldSize = world.size || 320;
    let tiles = "";
    for (let y = 0; y < size; y++) {
      const row = Math.min(worldSize - 1, Math.floor((y + .5) * worldSize / size)) * worldSize;
      for (let x = 0; x < size; x++) {
        const column = Math.min(worldSize - 1, Math.floor((x + .5) * worldSize / size));
        tiles += (world.terrain[row + column] ?? 0).toString(16);
      }
    }
    const colony = room.colonies.find(colony => colony.ownerId === room.hostId);
    return { size, tiles, colony: colony?.tribe ? { x: (colony.x + 2.5) / worldSize, y: (colony.y + 2.5) / worldSize, tribe: colony.tribe } : null };
  }

  function roomListing(room) {
    return { id: room.id, title: room.title, seed: room.seed, updatedAt: room.updatedAt, simSeconds: room.simSeconds, ending: room.ending || null,
      hostId: room.hostId, colonies: room.colonies.map(colony => ({ ownerId: colony.ownerId, tribe: colony.tribe })), worldPreview: roomWorldPreview(room) };
  }

  return {
    list() { return transaction("room-list", "readonly", task => task.objectStore("room-list").getAll()); },
    get(id) { return transaction("rooms", "readonly", task => task.objectStore("rooms").get(id)); },
    put(room) {
      return transaction(["rooms", "room-list"], "readwrite", task => {
        task.objectStore("room-list").put(roomListing(room));
        return task.objectStore("rooms").put(room);
      });
    },
    remove(id) {
      return transaction(["rooms", "room-list"], "readwrite", task => {
        task.objectStore("room-list").delete(id);
        return task.objectStore("rooms").delete(id);
      });
    },
    removeEnded(ids) {
      return transaction(["rooms", "room-list", "settings"], "readwrite", task => {
        const removed = [];
        const rooms = task.objectStore("rooms");
        const listings = task.objectStore("room-list");
        const settings = task.objectStore("settings");
        const current = settings.get("roomId");
        current.onsuccess = () => {
          for (const id of ids) {
            const request = rooms.get(id);
            request.onsuccess = () => {
              if (!request.result?.ending) return;
              rooms.delete(id);
              listings.delete(id);
              removed.push(id);
              if (current.result === id) settings.put(null, "roomId");
            };
          }
        };
        return { result: removed };
      });
    },
    removeAll() {
      return transaction(["rooms", "room-list", "settings"], "readwrite", task => {
        task.objectStore("rooms").clear();
        task.objectStore("room-list").clear();
        return task.objectStore("settings").put(null, "roomId");
      });
    },
    setting(key) { return transaction("settings", "readonly", task => task.objectStore("settings").get(key)); },
    setSetting(key, value) { return transaction("settings", "readwrite", task => task.objectStore("settings").put(value, key)); }
  };
}
