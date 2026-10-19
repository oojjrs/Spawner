export async function openStorage() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open("spawner-local", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("rooms", { keyPath: "id" });
      request.result.createObjectStore("settings");
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
      try { request = action(task.objectStore(storeName)); }
      catch (error) { task.abort(); reject(error); return; }
      task.oncomplete = () => resolve(request?.result);
      task.onabort = () => reject(task.error || new Error("브라우저 저장을 완료하지 못했습니다."));
      task.onerror = () => {};
    });
  }

  return {
    list() { return transaction("rooms", "readonly", store => store.getAll()); },
    get(id) { return transaction("rooms", "readonly", store => store.get(id)); },
    put(room) { return transaction("rooms", "readwrite", store => store.put(room)); },
    putAll(rooms) { return transaction("rooms", "readwrite", store => { for (const room of rooms) store.put(room); }); },
    remove(id) { return transaction("rooms", "readwrite", store => store.delete(id)); },
    setting(key) { return transaction("settings", "readonly", store => store.get(key)); },
    setSetting(key, value) { return transaction("settings", "readwrite", store => store.put(value, key)); }
  };
}
