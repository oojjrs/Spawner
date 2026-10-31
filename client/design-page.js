(() => {
  const afterPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  let painted = false, starting = false;
  const previews = globalThis.SpawnerDesignPreviews;
  const activePage = () => document.querySelector('.section-group-body>details.is-page-active');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting && activePage()?.contains(entry.target)) {
      const image = entry.target;
      if (image.dataset.src) image.src = image.dataset.src;
      if (image.dataset.backgroundSrc) image.style.backgroundImage = 'url("' + image.dataset.backgroundSrc + '")';
      observer.unobserve(image);
    }
  }, { rootMargin: '120px' });

  function setSource(image, source) {
    const next = previews[source] || source;
    image.dataset.originalSrc = source;
    image.dataset.src = next;
    image.decoding = 'async';
    if (image.getAttribute('src') !== next) image.removeAttribute('src');
    if (painted && activePage()?.contains(image)) observer.observe(image);
  }

  function observeMedia(page) {
    if (!page) return;
    for (const image of page.querySelectorAll('img[data-src],[data-background-src]')) observer.observe(image);
  }

  function workerMain() {
    const worlds = new Map();
    function cloneable(value, seen) {
      if (value === null || typeof value !== 'object') return value;
      if (seen.has(value)) return seen.get(value);
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Set || value instanceof Map) return value;
      const result = Array.isArray(value) ? [] : {};
      seen.set(value, result);
      for (const [key, child] of Object.entries(value)) if (typeof child !== 'function') result[key] = cloneable(child, seen);
      return result;
    }
    self.onmessage = event => {
      const { id, type, seed, fieldId } = event.data;
      try {
        if (type === 'generate') {
          const world = worlds.get(seed) || globalThis.SpawnerDesignWorld.generateWorld(seed, value => self.postMessage({ id, type: 'progress', value }));
          worlds.delete(seed);
          worlds.set(seed, world);
          while (worlds.size > 3) worlds.delete(worlds.keys().next().value);
          const fields = world.hydrology?.placementMaps || [];
          const result = cloneable({ ...world, hydrology: { ...world.hydrology, placementMaps: fields } }, new WeakMap());
          self.postMessage({ id, result });
        } else if (type === 'values') {
          const world = worlds.get(seed), field = world?.hydrology?.placementMaps.find(item => item.id === fieldId);
          if (!field) throw new Error(fieldId);
          if (!field.values) {
            if (field.createValues) field.values = field.createValues();
            else {
              field.values = new Float64Array(world.size * world.size);
              for (let index = 0; index < field.values.length; index++) field.values[index] = field.sample(index % world.size, Math.floor(index / world.size));
            }
          }
          self.postMessage({ id, result: field.values });
        }
      } catch (error) {
        self.postMessage({ id, error: error.message });
      }
    };
    const { SIZE, NEST_SAFE_RADIUS, ENCOUNTER_PLANS } = globalThis.SpawnerDesignWorld;
    self.postMessage({ type: 'ready', SIZE, NEST_SAFE_RADIUS, ENCOUNTER_PLANS });
  }

  async function startMap() {
    if (starting || globalThis.SpawnerDesignWorld || activePage()?.id !== 'world') return;
    starting = true;
    const root = document.getElementById('world-map-preview'), progress = document.getElementById('map-progress');
    progress.hidden = false;
    progress.removeAttribute('value');
    root.setAttribute('aria-busy', 'true');
    for (const control of root.querySelectorAll('input,button,select')) control.disabled = true;
    await afterPaint();
    if (activePage()?.id !== 'world') {
      starting = false;
      progress.hidden = true;
      root.removeAttribute('aria-busy');
      return;
    }
    let worker, objectUrl;
    try {
      const source = document.getElementById('design-world-model').textContent + '\n(' + workerMain.toString() + ')();';
      objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      worker = new Worker(objectUrl);
      let sequence = 0;
      const pending = new Map();
      const ready = new Promise((resolve, reject) => {
        worker.onmessage = event => {
          const data = event.data;
          if (data.type === 'ready') { resolve(data); return; }
          const request = pending.get(data.id);
          if (!request) return;
          if (data.type === 'progress') { request.onProgress?.(data.value); return; }
          pending.delete(data.id);
          if (data.error) request.reject(new Error(data.error));
          else request.resolve(data.result);
        };
        worker.onerror = event => {
          const error = new Error(event.message);
          for (const request of pending.values()) request.reject(error);
          pending.clear();
          reject(error);
        };
      });
      function request(type, seed, fieldId, onProgress) {
        return new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject, onProgress });
          worker.postMessage({ id, type, seed, fieldId });
        });
      }
      const metadata = await ready;
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      globalThis.SpawnerDesignWorld = {
        SIZE: metadata.SIZE,
        NEST_SAFE_RADIUS: metadata.NEST_SAFE_RADIUS,
        ENCOUNTER_PLANS: metadata.ENCOUNTER_PLANS,
        generateWorld: (seed, onProgress) => request('generate', seed, null, onProgress),
        loadValues: (seed, fieldId) => request('values', seed, fieldId, null)
      };
      const script = document.createElement('script');
      script.textContent = document.getElementById('design-world-view').textContent;
      document.body.appendChild(script);
    } catch (error) {
      worker?.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      delete globalThis.SpawnerDesignWorld;
      starting = false;
      progress.hidden = true;
      root.removeAttribute('aria-busy');
      root.dataset.rendered = 'false';
      for (const control of root.querySelectorAll('input,button,select')) control.disabled = false;
      const input = root.querySelector('#map-seed');
      input.setCustomValidity(error.message);
      if (activePage()?.id === 'world') input.reportValidity();
    }
  }

  async function activate() {
    observer.disconnect();
    await afterPaint();
    painted = true;
    observeMedia(activePage());
    startMap();
  }

  globalThis.SpawnerDesignImages = { setSource };
  document.addEventListener('spawner-page', activate);
  document.addEventListener('toggle', event => {
    if (painted && event.target.open && activePage()?.contains(event.target)) observeMedia(event.target);
  }, true);
  new MutationObserver(records => {
    if (!painted) return;
    const page = activePage();
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType !== 1 || !page?.contains(node)) continue;
      if (node.matches('img[data-src],[data-background-src]')) observer.observe(node);
      observeMedia(node);
    }
  }).observe(document.querySelector('main'), { childList: true, subtree: true });
  activate();
})();
