(() => {
  const { units, attributes, bounds } = globalThis.SpawnerUnitMatrixData;
  const panels = [], failures = [], stageSize = 256, floor = 208;
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
  const previewSources = globalThis.SpawnerUnitMatrixPreviews || {};
  const canvasPanels = new WeakMap(), initialized = new Set(), appearanceFits = new Map();
  const activePage = () => document.querySelector('.section-group-body>details.is-page-active');
  function draw(panel, now) {
    if (!panel.ready || !panel.visible || !panel.sprite) return;
    const { animation, context, canvas, sprite } = panel;
    const durations = animation.durationsMs || [1000], duration = durations.reduce((sum, value) => sum + value, 0);
    const phase = now % (duration + (animation.loop === false ? 900 : 0));
    let elapsed = phase, index = 0;
    while (index < durations.length - 1 && elapsed >= durations[index]) elapsed -= durations[index++];
    const frame = animation.frames?.[index] ?? index;
    if (panel.frame === frame && !panel.dirty && !animation.native && !animation.projectile) return;
    const preview = previewSources[animation.image], shape = geometry(animation, frame);
    const size = preview?.frameSize || shape.frameSize || sprite.naturalWidth;
    const height = preview ? size : animation.frameHeight || (animation.native ? sprite.naturalHeight : size);
    prepareCanvas(canvas, context, stageSize);
    const scale = preview ? stageSize / size : panel.scale;
    const x = preview ? 0 : stageSize / 2 - (shape.pivotX ?? size / 2) * scale;
    const y = preview ? 0 : floor - (shape.pivotY ?? height * .875) * scale;
    if (panel.mirror) { context.translate(stageSize, 0); context.scale(-1, 1); }
    const columns = preview?.columns || animation.columns;
    context.drawImage(sprite, animation.native ? 0 : frame % columns * size, animation.native ? 0 : Math.floor(frame / columns) * size,
      size, height, x, y, size * scale, height * scale);
    drawProjectile(context, animation, scale, phase);
    canvas.dataset.frame = String(index); panel.frame = frame; panel.dirty = false;
  }
  function tick(now) {
    scheduled = null;
    for (const panel of panels) if (panel.visible && !document.hidden) draw(panel, now);
    if (!document.hidden && panels.some(panel => panel.visible && panel.ready)) scheduled = requestAnimationFrame(tick);
  }
  function schedule() {
    if (scheduled === null && !document.hidden && panels.some(panel => panel.visible && panel.ready)) scheduled = requestAnimationFrame(tick);
  }
  function configureLightbox(panel) {
    const { animation, element, link, action } = panel;
    if (!panel.updateLightbox) return;
    link.href = animation.image; link.dataset.preview = animation.image;
    element.dataset.columns = String(animation.columns); element.dataset.durations = (animation.durationsMs || [1000]).join(',');
    element.dataset.loop = String(animation.loop !== false);
    if (action === 'birth' && animation.native) element.dataset.nativeAnimation = 'true'; else delete element.dataset.nativeAnimation;
    if (animation.audioCues) element.dataset.audioCues = JSON.stringify(animation.audioCues);
    if (animation.frames) element.dataset.frames = animation.frames.join(','); else delete element.dataset.frames;
    element.dataset.runtimeGeometry = JSON.stringify(animation); element.dataset.runtimeScale = String(panel.scale);
    delete element.dataset.previewScale; delete element.dataset.previewPivotY; delete element.dataset.previewFloor;
  }
  function release(panel) {
    panel.visible = false; panel.ready = false; panel.frame = -1;
    if (panel.sprite) panel.sprite.removeAttribute('src');
    panel.sprite = null; panel.canvas.width = panel.canvas.height = 1;
  }
  function load(panel) {
    if (panel.sprite) return;
    const sprite = new Image(); panel.sprite = sprite;
    sprite.addEventListener('error', () => {
      if (panel.sprite === sprite) failures.push(panel.animation.image);
    });
    sprite.addEventListener('load', () => {
      if (panel.sprite !== sprite || !panel.visible) return;
      panel.animation.initialize?.(sprite);
      panel.scale = sourceScale(panel.unit, panel.animation, panel.action);
      configureLightbox(panel); panel.ready = true; panel.frame = -1;
      draw(panel, performance.now()); schedule();
    });
    sprite.src = previewSources[panel.animation.image]?.image || panel.animation.image;
  }
  const observer = new IntersectionObserver(entries => {
    const page = activePage();
    for (const entry of entries) {
      const panel = canvasPanels.get(entry.target);
      if (entry.isIntersecting && !document.hidden && page?.contains(panel.canvas)) { panel.visible = true; load(panel); }
      else release(panel);
    }
    schedule();
  });
  function install(element, unit, animation, action, updateLightbox) {
    const thumbnail = element.querySelector('img'), link = element.closest('a') || element.querySelector('a');
    if (!thumbnail || !link || !animation) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; canvas.className = 'unit-matrix-canvas';
    thumbnail.after(canvas); thumbnail.style.display = 'none';
    const panel = { element, link, unit, action, updateLightbox, canvas, sprite: null, animation, scale: null, frame: -1, dirty: false,
      ready: false, visible: false, mirror: element.dataset.mirror === 'true', context: canvas.getContext('2d') };
    if (!animation.initialize) { panel.scale = sourceScale(unit, animation, action); configureLightbox(panel); }
    panels.push(panel); canvasPanels.set(canvas, panel); observer.observe(canvas);
  }
  function initializeUnits() {
    for (const row of document.querySelectorAll('.unit-matrix tr[id^="unit-"]')) {
      const raw = row.id.slice(5), key = aliases[raw] || raw, unit = units[key];
      if (!unit) continue;
      for (const cell of row.querySelectorAll('td[data-action]')) {
        const action = cell.dataset.action;
        let animation = unit.animations[action], element = cell.querySelector('.unit-matrix-preview');
        if (!element && animation && action === 'ranged-attack') {
          const figure = document.createElement('figure'), link = document.createElement('a'), thumbnail = document.createElement('img');
          figure.className = 'unit-matrix-image'; link.href = animation.image; thumbnail.alt = '';
          element = document.createElement('span'); element.className = 'unit-matrix-preview'; element.append(thumbnail); link.append(element); figure.append(link);
          cell.querySelector('.unit-matrix-empty')?.replaceWith(figure); delete cell.dataset.missing;
        }
        if (!element) continue;
        if (action === 'base') animation = unit.base;
        if (action === 'birth' && unit.birthScene) animation = unit.birthScene;
        if (animation) install(element, unit, animation, action, action !== 'base');
        else {
          const link = element.closest('a'), source = link.dataset.preview || link.getAttribute('href');
          const columns = Number(element.dataset.columns || 1), durationsMs = element.dataset.durations?.split(',').map(Number) || [1000];
          const fallback = { image: source, columns, durationsMs, loop: element.dataset.loop !== 'false', native: element.dataset.nativeAnimation === 'true' };
          fallback.initialize = sprite => {
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
          };
          install(element, unit, fallback, action, action !== 'base' && action !== 'birth');
        }
      }
    }
  }
  function initializeAppearance() {
    for (const link of document.querySelectorAll('#codex-unit-appearance [data-combat-clip]')) {
      const tribe = link.dataset.tribe, key = tribe === 'sprout' ? 'bean' : tribe;
      const variant = tribe + '/' + link.dataset.variant, animations = attributes[variant], animation = animations?.[link.dataset.action];
      if (!animation) continue;
      if (!appearanceFits.has(variant)) appearanceFits.set(variant, Math.min(...Object.values(animations).flatMap(clip =>
        [clip, ...Object.values(clip.frameGeometry || {}).map(shape => ({ ...clip, ...shape }))].map(shape => {
          const size = shape.frameSize, pivotX = shape.pivotX ?? size / 2, pivotY = shape.pivotY ?? size * .875;
          return Math.min(stageSize / (2 * Math.max(pivotX, size - pivotX)),
            floor / pivotY, (stageSize - floor) / (size - pivotY)) / sourceScale(units[key], clip, clip.action);
        }))));
      install(link, units[key], { ...animation, sourceScale: sourceScale(units[key], animation, link.dataset.action) * appearanceFits.get(variant) }, link.dataset.action, true);
    }
  }
  function activate() {
    const page = activePage();
    if (page && !initialized.has(page.id)) {
      if (page.id === 'codex-units') initializeUnits();
      if (page.id === 'codex-unit-appearance') initializeAppearance();
      initialized.add(page.id);
    }
    for (const panel of panels) {
      observer.unobserve(panel.canvas);
      if (!document.hidden && page?.contains(panel.canvas)) observer.observe(panel.canvas);
      else release(panel);
    }
    schedule();
  }
  document.addEventListener('spawner-page', activate);
  document.addEventListener('visibilitychange', activate);
  addEventListener('resize', () => { for (const panel of panels) panel.dirty = true; schedule(); });
  globalThis.SpawnerUnitMatrixPanels = panels;
  globalThis.SpawnerUnitMatrixFailures = failures;
  globalThis.SpawnerUnitMatrixReady = Promise.resolve();
  activate();
})();
