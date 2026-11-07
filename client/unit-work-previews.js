(() => {
  const sources = {
    bean: ['DesignAssets/Resources/wood-carry.png', 26, 29, 38, 33],
    spore: ['DesignAssets/Resources/clay-carry.png', 9, 22, 42, 22],
    pebble: ['DesignAssets/Resources/pebbles-carry.png', 44, 51, 39, 40],
    spring: ['DesignAssets/Resources/dew-carry.png', 63, 60, 36, 44]
  };
  const images = new Map(), panels = [], visible = new Set();
  const lightbox = document.getElementById('image-lightbox');
  const enlarged = document.createElement('canvas');
  enlarged.className = 'unit-work-overlay unit-work-lightbox';
  enlarged.hidden = true;
  lightbox.append(enlarged);
  let active = null, scheduled = null;
  function paint(canvas, tribe, action, now, duration) {
    const spec = sources[tribe];
    if (!images.has(tribe)) { const image = new Image(); image.src = spec[0]; images.set(tribe, image); }
    const image = images.get(tribe), extent = canvas.getBoundingClientRect().width;
    if (!extent || !image.complete || !image.naturalWidth) return;
    const backing = Math.max(1, Math.round(extent * (devicePixelRatio || 1)));
    if (canvas.width !== backing || canvas.height !== backing) canvas.width = canvas.height = backing;
    const context = canvas.getContext('2d');
    context.setTransform(backing / 96, 0, 0, backing / 96, 0, 0); context.clearRect(0, 0, 96, 96);
    const phase = now % duration / duration;
    let x = 62, y = 66 + Math.sin(phase * Math.PI * 4) * 1.5;
    if (action === 'throw') {
      if (phase > .68) return;
      const flight = Math.max(0, (phase - .22) / .46);
      x += flight * 22; y -= Math.sin(flight * Math.PI) * 25;
      context.globalAlpha = flight > .85 ? (1 - flight) / .15 : 1;
    }
    const scale = 18 / Math.max(spec[3], spec[4]);
    context.drawImage(image, spec[1], spec[2], spec[3], spec[4], x - spec[3] * scale / 2, y - spec[4] * scale / 2, spec[3] * scale, spec[4] * scale);
    context.globalAlpha = 1;
  }
  function tick(now) {
    scheduled = null;
    for (const panel of visible) paint(panel.canvas, panel.tribe, panel.action, now, panel.duration);
    enlarged.hidden = !active || !lightbox.classList.contains('is-open');
    if (!enlarged.hidden) {
      const target = lightbox.classList.contains('is-unit-animation') ? document.getElementById('unit-lightbox-canvas') : lightbox.querySelector('.lightbox-image');
      const rect = target.getBoundingClientRect();
      Object.assign(enlarged.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
      paint(enlarged, active.tribe, active.action, now, active.duration);
    }
    if (!document.hidden && (visible.size || !enlarged.hidden)) scheduled = requestAnimationFrame(tick);
  }
  function schedule() { if (scheduled === null && !document.hidden) scheduled = requestAnimationFrame(tick); }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const panel = panels.find(item => item.canvas === entry.target);
      if (entry.isIntersecting) visible.add(panel); else visible.delete(panel);
    }
    schedule();
  });
  for (const figure of document.querySelectorAll('figure[data-work-action="carry"],figure[data-work-action="throw"]')) {
    const canvas = document.createElement('canvas'); canvas.className = 'unit-work-overlay';
    figure.querySelector('.attribute-unit-images').append(canvas);
    const preview = figure.querySelector('[data-durations]');
    const duration = preview ? preview.dataset.durations.split(',').reduce((sum, value) => sum + Number(value), 0) + (preview.dataset.loop === 'false' ? 900 : 0) : 1600;
    const panel = { figure, canvas, tribe: figure.dataset.workTribe, action: figure.dataset.workAction, duration };
    panels.push(panel); observer.observe(canvas);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('figure a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    active = panels.find(panel => panel.figure.contains(link)) || null;
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
})();
