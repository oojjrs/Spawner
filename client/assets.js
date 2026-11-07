(() => {
  const sources = Object.create(null);
  Object.assign(sources, globalThis.SpawnerLocalAssetSources);
  globalThis.SpawnerLocalAssetSources = sources;
  const files = new Set(globalThis.SpawnerLocalAssetFiles || []);
  const pending = new Map();
  const queue = [];
  let active = 0;
  const ready = Promise.resolve();
  const welcomeReady = ready;
  function drain() {
    while (active < 4 && queue.length) {
      const job = queue.shift();
      active++;
      loadLocalAsset(job.file).then(() => job.resolve(sources[job.path] || job.path), job.reject).finally(() => { active--; drain(); });
    }
  }
  function load(path) {
    if (sources[path] || location.protocol !== "file:" || !path.startsWith("DesignAssets/")) return Promise.resolve(sources[path] || path);
    if (pending.has(path)) {
      const index = queue.findIndex(job => job.path === path);
      if (index > 0) queue.unshift(queue.splice(index, 1)[0]);
      return pending.get(path);
    }
    const file = "./client/local-assets/" + path.slice("DesignAssets/".length) + ".js";
    if (!files.has(file)) return Promise.resolve(path);
    const task = new Promise((resolve, reject) => { queue.push({ path, file, resolve, reject }); });
    pending.set(path, task);
    task.catch(() => { pending.delete(path); });
    drain();
    return task;
  }
  function loadLocalAsset(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = file;
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error("로컬 자산을 불러오지 못했습니다: " + file)); };
      document.head.append(script);
    });
  }
  function image() {
    const sprite = new Image();
    sprite.crossOrigin = "anonymous";
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const decode = sprite.decode.bind(sprite);
    let requested = null;
    let pendingSource = false;
    Object.defineProperty(sprite, "complete", { get() { return !pendingSource && complete.get.call(sprite); } });
    let loading = Promise.resolve();
    Object.defineProperty(sprite, "src", {
      get() { return descriptor.get.call(sprite) || requested || ""; },
      set(path) {
        requested = path;
        pendingSource = false;
        if (location.protocol !== "file:" || !path.startsWith("DesignAssets/")) {
          descriptor.set.call(sprite, path);
          loading = Promise.resolve();
          return;
        }
        pendingSource = true;
        loading = load(path).then(source => {
          if (requested === path) {
            pendingSource = false;
            descriptor.set.call(sprite, source);
          }
        });
        loading.catch(() => {
          if (requested === path) {
            pendingSource = false;
            sprite.dispatchEvent(new Event("error"));
          }
        });
      }
    });
    sprite.decode = () => loading.then(decode);
    return sprite;
  }
  globalThis.SpawnerAssets = Object.freeze({ ready, welcomeReady, load, image, source: path => sources[path] || path });
})();
