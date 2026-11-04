(() => {
  const sources = Object.create(null);
  Object.assign(sources, globalThis.SpawnerLocalAssetSources);
  globalThis.SpawnerLocalAssetSources = sources;
  const presentation = globalThis.SpawnerWelcomeLoading;
  const priorityPaths = presentation ? [
    ...Object.values(globalThis.Spawner.UNIT_ANIMATIONS).flatMap(animations => Object.entries(animations)
      .filter(([action]) => action === "idle" || action === "walk" || action === "jump")
      .map(([, animation]) => animation.image)),
    "DesignAssets/Welcome/spore-jump.webp", "DesignAssets/Welcome/pebble-jump.webp",
    ...["body", "sprout-left", "sprout-right", "sprout-stem", "green-foot"].map(name => "DesignAssets/Units/BaseParts/" + name + ".png"),
    ...["bean-root-rig", "antenna-1", "strength-1"].map(name => "DesignAssets/Units/Parts/" + name + ".png"),
    "DesignAssets/Audio/bean-footstep.mp3", "DesignAssets/Audio/bean-landing.mp3",
    "DesignAssets/Audio/ui-click.wav", "DesignAssets/Audio/new-discovery.mp3",
    ...["move-spore", "move-pebble", "move-spring"].map(name => globalThis.SpawnerMovementAudio.sources[name])
  ] : [];
  const priorityFiles = new Set(priorityPaths.map(path => "./client/local-assets/" + path.slice("DesignAssets/".length) + ".js"));
  const files = location.protocol === "file:" ? globalThis.SpawnerLocalAssetFiles : [];
  const welcomeReady = presentation && location.protocol === "file:" ?
    loadLocalAssets(files.filter(file => priorityFiles.has(file))) : Promise.resolve();
  const ready = (async () => {
    await welcomeReady;
    await presentation;
    if (location.protocol === "file:") await loadLocalAssets(files.filter(file => !priorityFiles.has(file)));
  })();
  ready.catch(() => {});
  async function loadLocalAssets(files) {
    for (let index = 0; index < files.length; index += 2) {
      if (index) await new Promise(resolve => {
        let frame = null, task = null;
        let settled = false;
        function finish() {
          if (settled) return;
          settled = true;
          clearTimeout(fallback);
          if (task !== null) clearTimeout(task);
          if (frame !== null) cancelAnimationFrame(frame);
          resolve();
        }
        const fallback = setTimeout(finish, 50);
        if (document.hidden || typeof requestAnimationFrame !== "function") task = setTimeout(finish, 0);
        else frame = requestAnimationFrame(() => { frame = null; task = setTimeout(finish, 0); });
      });
      await Promise.all(files.slice(index, index + 2).map(loadLocalAsset));
    }
    await prepareLocalImages();
  }
  async function prepareLocalImages() {
    if (typeof Worker !== "function" || typeof Blob !== "function" || !globalThis.URL?.createObjectURL) return;
    const entries = Object.entries(sources).filter(([, source]) => typeof source === "string" && /^data:image\//i.test(source));
    if (!entries.length) return;
    const urls = new Set();
    let worker = null, workerUrl = null, pending = null, failed = false, nextId = 0;
    function settle(message) {
      if (!pending || message && message.id !== pending.id) return;
      const job = pending;
      pending = null;
      clearTimeout(job.timer);
      job.resolve(message?.blob || null);
    }
    function convertImage() {
      self.onmessage = event => {
        const { id, source } = event.data;
        try {
          const comma = source.indexOf(","), header = source.slice(5, comma);
          const type = header.split(";")[0];
          const payload = source.slice(comma + 1);
          let bytes;
          if (/;base64$/i.test(header)) {
            const decoded = atob(payload);
            bytes = new Uint8Array(decoded.length);
            for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
          } else bytes = new TextEncoder().encode(decodeURIComponent(payload));
          self.postMessage({ id, blob: new Blob([bytes], { type }) });
        } catch { self.postMessage({ id, error: true }); }
      };
    }
    try {
      workerUrl = URL.createObjectURL(new Blob(["(" + convertImage.toString() + ")();"], { type: "text/javascript" }));
      worker = new Worker(workerUrl);
      worker.onmessage = event => settle(event.data);
      worker.onerror = () => { failed = true; settle(null); };
      for (const [path, source] of entries) {
        if (failed) break;
        const blob = await new Promise(resolve => {
          const id = ++nextId;
          const timer = setTimeout(() => { failed = true; settle(null); }, 5000);
          pending = { id, timer, resolve };
          try { worker.postMessage({ id, source }); }
          catch { failed = true; settle(null); }
        });
        if (blob && sources[path] === source) {
          try {
            const url = URL.createObjectURL(blob);
            urls.add(url);
            sources[path] = url;
          } catch {}
        }
      }
    } catch {} finally {
      settle(null);
      worker?.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    }
    if (urls.size) window.addEventListener("pagehide", event => {
      if (event.persisted) return;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    });
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
    return sprite;
  }
  globalThis.SpawnerAssets = Object.freeze({ ready, welcomeReady, image, source: path => sources[path] || path });
})();
