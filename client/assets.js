(() => {
  const sources = Object.create(null);
  globalThis.SpawnerLocalAssetSources = sources;
  const ready = location.protocol === "file:" ? Promise.all(globalThis.SpawnerLocalAssetFiles.map(file =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = file;
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error("로컬 자산을 불러오지 못했습니다: " + file)); };
      document.head.append(script);
    }))) : Promise.resolve();
  globalThis.SpawnerAssets = Object.freeze({ ready, source: path => sources[path] || path });
})();
