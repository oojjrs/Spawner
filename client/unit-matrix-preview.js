(() => {
  const { units, attributes, bounds } = globalThis.SpawnerUnitMatrixData;
  const panels = [], pending = [], failures = [], stageSize = 256, floor = 208;
  const aliases = { 'sprout-bean': 'bean', 'spore-tribe': 'spore', 'pebble-tribe': 'pebble', 'spring-tribe': 'spring' };
  const resourceRegistrations = {
    'DesignAssets/Planning/Tribes/pebble/Previews/Resources/pebbles/carry-walk-sheet.webp': { frameSize: 106, pivotX: 53, pivotY: 93 }
  };
  let scheduled = null;
  function canvasBackingSize(canvas, extent) {
    const width = canvas.getBoundingClientRect().width || extent;
    return Math.max(1, Math.round(width * (window.devicePixelRatio || 1)));
  }
  function canvasNeedsResize(canvas, extent) {
    const size = canvasBackingSize(canvas, extent);
    return canvas.width !== size || canvas.height !== size;
  }
  function prepareCanvas(canvas, context, extent) {
    const size = canvasBackingSize(canvas, extent);
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
    const ratio = size / extent;
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, extent, extent);
  }
  globalThis.SpawnerUnitMatrixPrepareCanvas = prepareCanvas;
  globalThis.SpawnerUnitMatrixCanvasNeedsResize = canvasNeedsResize;
  const projectiles = new Map();
  function drawProjectile(context, animation, scale, elapsed) {
    const spec = animation?.projectile;
    if (!spec || elapsed < spec.launchAtMs || elapsed >= spec.launchAtMs + spec.flightMs) return;
    if (!projectiles.has(spec.image)) { const image = new Image(); image.src = spec.image; projectiles.set(spec.image, image); }
    const sprite = projectiles.get(spec.image);
    if (!sprite.complete || !sprite.naturalWidth) return;
    const progress = (elapsed - spec.launchAtMs) / spec.flightMs;
    const x = stageSize / 2 + (spec.outletX - animation.pivotX) * scale + progress * spec.travel;
    const y = floor + (spec.outletY - animation.pivotY) * scale;
    context.drawImage(sprite, x - spec.width * scale / 2, y - spec.height * scale / 2, spec.width * scale, spec.height * scale);
  }
  globalThis.SpawnerUnitMatrixProjectile = drawProjectile;
  function geometry(animation, index) { return { ...animation, ...animation.frameGeometry?.[index] }; }
  function sourceScale(unit, animation, action) {
    if (animation.sourceScale) return animation.sourceScale;
    const idle = unit.idle;
    if (unit.tribe && bounds[animation.image]) {
      const reference = bounds[idle.image], actionBounds = bounds[animation.image];
      const fit = Math.min(reference.bodyWidth / actionBounds.width, reference.bodyHeight / actionBounds.height);
      const idleFit = Math.min(reference.bodyWidth / reference.width, reference.bodyHeight / reference.height);
      return 100 * unit.displaySize * fit / (idleFit * Math.max(reference.width, reference.height));
    }
    if (action === 'death') {
      const box = bounds[animation.image];
      if (box) return 100 * unit.displaySize / (Math.max(box.width, box.height) * animation.frameSize / box.frameSize);
    }
    return unit.idleScale * idle.frameSize / (animation.viewSize || animation.frameSize) *
      (animation.registrationScale || 1) / (idle.registrationScale || 1);
  }
  function draw(panel, now) {
    if (!panel.ready || !panel.visible) return;
    const { animation, context, canvas, sprite } = panel;
    const durations = animation.durationsMs || [1000], duration = durations.reduce((sum, value) => sum + value, 0);
    const phase = now % (duration + (animation.loop === false ? 900 : 0));
    let elapsed = phase, index = 0;
    while (index < durations.length - 1 && elapsed >= durations[index]) elapsed -= durations[index++];
    const frame = animation.frames?.[index] ?? index, shape = geometry(animation, frame);
    const size = shape.frameSize || sprite.naturalWidth, height = animation.frameHeight || (animation.native ? sprite.naturalHeight : size);
    prepareCanvas(canvas, context, stageSize);
    const scale = panel.scale, x = stageSize / 2 - (shape.pivotX ?? size / 2) * scale, y = floor - (shape.pivotY ?? height * .875) * scale;
    if (panel.mirror) { context.translate(stageSize, 0); context.scale(-1, 1); }
    context.drawImage(sprite, animation.native ? 0 : frame % animation.columns * size, animation.native ? 0 : Math.floor(frame / animation.columns) * size,
      size, height, x, y, size * scale, height * scale);
    drawProjectile(context, animation, scale, phase);
    canvas.dataset.frame = String(index);
  }
  function tick(now) {
    scheduled = null;
    for (const panel of panels) {
      if (!panel.visible || document.hidden || !panel.canvas.getClientRects().length) continue;
      draw(panel, now);
    }
    if (!document.hidden && panels.some(panel => panel.visible)) scheduled = requestAnimationFrame(tick);
  }
  function schedule() { if (scheduled === null && !document.hidden) scheduled = requestAnimationFrame(tick); }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const panel = panels.find(panel => panel.canvas === entry.target);
      panel.visible = entry.isIntersecting;
      if (!panel.visible) panel.canvas.width = panel.canvas.height = 1;
      if (panel.visible && !panel.sprite.src) panel.sprite.src = panel.animation.image;
    }
    schedule();
  }, { rootMargin: '100px' });
  function install(element, unit, animation, action, updateLightbox) {
    const thumbnail = element.querySelector('img'), link = element.closest('a') || element.querySelector('a');
    if (!thumbnail || !link || !animation) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = stageSize; canvas.className = 'unit-matrix-canvas';
    thumbnail.after(canvas); thumbnail.style.display = 'none';
    const sprite = new Image(), scale = sourceScale(unit, animation, action);
    const panel = { element, canvas, sprite, animation, scale, ready: false, visible: false, mirror: element.dataset.mirror === 'true', context: canvas.getContext('2d') };
    sprite.addEventListener('error', () => failures.push(animation.image));
    sprite.addEventListener('load', () => { panel.ready = true; draw(panel, performance.now()); schedule(); });
    if (updateLightbox) {
      link.href = animation.image; link.dataset.preview = animation.image;
      element.dataset.columns = String(animation.columns); element.dataset.durations = (animation.durationsMs || [1000]).join(',');
      element.dataset.loop = String(animation.loop !== false); delete element.dataset.nativeAnimation;
      if (animation.frames) element.dataset.frames = animation.frames.join(','); else delete element.dataset.frames;
      element.dataset.runtimeGeometry = JSON.stringify(animation); element.dataset.runtimeScale = String(scale);
      delete element.dataset.previewScale; delete element.dataset.previewPivotY; delete element.dataset.previewFloor;
    }
    panels.push(panel); observer.observe(canvas);
  }
  for (const row of document.querySelectorAll('.unit-matrix tr[id^="unit-"]')) {
    const raw = row.id.slice(5), key = aliases[raw] || raw, unit = units[key];
    if (!unit) continue;
    for (const cell of row.querySelectorAll('td[data-action]')) {
      const action = cell.dataset.action;
      let animation = unit.animations[action], element = cell.querySelector('.unit-matrix-preview');
      if (!element && animation && action === 'ranged-attack') {
        const figure = document.createElement('figure'), link = document.createElement('a'), thumbnail = document.createElement('img');
        figure.className = 'unit-matrix-image'; link.href = animation.image; thumbnail.src = animation.image; thumbnail.alt = '';
        element = document.createElement('span'); element.className = 'unit-matrix-preview'; element.append(thumbnail); link.append(element); figure.append(link);
        cell.querySelector('.unit-matrix-empty')?.replaceWith(figure); delete cell.dataset.missing;
      }
      if (!element) continue;
      if (action === 'base') animation = unit.base;
      if (action === 'birth' && unit.birthScene) {
        const scene = unit.birthScene, link = element.closest('a');
        link.href = scene.image; link.dataset.preview = scene.image;
        element.dataset.columns = String(scene.columns); element.dataset.durations = scene.durationsMs.join(',');
        element.dataset.loop = 'true'; delete element.dataset.nativeAnimation;
      }
      if (animation) install(element, unit, animation, action, action !== 'base' && action !== 'birth');
      else {
        const link = element.closest('a'), source = link.dataset.preview || link.getAttribute('href');
        const columns = Number(element.dataset.columns || 1), durationsMs = element.dataset.durations?.split(',').map(Number) || [1000];
        const fallback = { image: source, columns, durationsMs, loop: element.dataset.loop !== 'false', native: element.dataset.nativeAnimation === 'true' };
        const sprite = new Image(); sprite.src = source;
        pending.push(sprite.decode().then(() => {
          fallback.frameSize = sprite.naturalWidth / (fallback.native ? 1 : columns);
          fallback.pivotX = fallback.frameSize / 2; fallback.frameHeight = fallback.native ? sprite.naturalHeight : fallback.frameSize;
          fallback.pivotY = fallback.frameHeight * .875;
          if (unit.movementReference?.[action]) {
            const reference = unit.movementReference[action];
            fallback.pivotX = reference.pivotX; fallback.pivotY = reference.pivotY;
            fallback.sourceScale = 100 * unit.displaySize / Math.max(reference.width, reference.height);
          }
          if (['harvest', 'carry', 'throw'].includes(action)) {
            const registration = resourceRegistrations[source];
            const reference = registration ? bounds[unit.idle.image] : unit.resourceReference, ratio = fallback.frameSize / reference.frameSize;
            fallback.pivotX = reference.pivotX * ratio; fallback.pivotY = reference.pivotY * ratio;
            if (registration) {
              fallback.pivotX = registration.pivotX * fallback.frameSize / registration.frameSize;
              fallback.pivotY = registration.pivotY * fallback.frameSize / registration.frameSize;
            }
            fallback.sourceScale = 100 * unit.displaySize / (Math.max(reference.width, reference.height) * ratio);
          }
          install(element, unit, fallback, action, action !== 'base' && action !== 'birth');
        }).catch(() => failures.push(source)));
      }
    }
  }
  const namedUnits = new Map([...document.querySelectorAll('.unit-matrix tr[id^="unit-"]')].map(row => {
    const raw = row.id.slice(5);
    return [row.querySelector('th').textContent.trim(), units[aliases[raw] || raw]];
  }));
  for (const row of document.querySelectorAll('#unit-base-stats tbody tr')) {
    const header = row.querySelector('th'), unit = namedUnits.get(header?.dataset.sort);
    const link = header?.querySelector('a');
    if (unit && link) install(link, unit, unit.base, 'base', false);
  }
  for (const link of document.querySelectorAll('#codex-attributes [data-combat-clip]')) {
    const tribe = link.dataset.tribe, key = tribe === 'sprout' ? 'bean' : tribe;
    const animation = attributes[tribe + '/' + link.dataset.variant]?.[link.dataset.action];
    if (animation) install(link, units[key], animation, link.dataset.action, true);
  }
  document.addEventListener('visibilitychange', schedule);
  globalThis.SpawnerUnitMatrixPanels = panels;
  globalThis.SpawnerUnitMatrixFailures = failures;
  globalThis.SpawnerUnitMatrixReady = Promise.all(pending);
})();
