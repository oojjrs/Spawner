(() => {
  const { RESOURCE_TYPES, RESOURCE_HARVEST_ANIMATIONS, resourceImageBounds, resourceNodePlacement, resourceCarryScale } = globalThis.SpawnerDesignResources;
  const animations = new Map(RESOURCE_HARVEST_ANIMATIONS.map(animation => [animation.resourceType, animation]));
  const panels = [];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = null;

  function draw(panel, now) {
    const { context, sprite, animation, bounds, type, mode, canvas } = panel;
    const durations = animation?.loopDurationsMs;
    const count = animation?.frameCount || 1;
    let index = 0;
    if (mode === "harvest" && animation && !reducedMotion.matches) {
      if (durations) {
        let elapsed = now % durations.reduce((sum, duration) => sum + duration, 0);
        while (index < count - 1 && elapsed >= durations[index]) elapsed -= durations[index++];
      } else index = Math.floor(now / 60) % count;
    }
    const width = animation?.frameSize || sprite.naturalWidth;
    const height = animation?.frameSize || sprite.naturalHeight;
    const placement = resourceNodePlacement(type, bounds, width, height, 128);
    if (mode === "carry") {
      const scale = 128 * resourceCarryScale(bounds, .7, 0);
      placement.x = 64 - (bounds.x + bounds.width / 2) * scale;
      placement.y = 64 - (bounds.y + bounds.height / 2) * scale;
      placement.width = width * scale;
      placement.height = height * scale;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sprite, index % (animation?.columns || 1) * width,
      Math.floor(index / (animation?.columns || 1)) * height, width, height,
      placement.x, placement.y, placement.width, placement.height);
  }

  function tick(now) {
    frame = null;
    let active = false;
    for (const panel of panels) {
      if (!panel.canvas.getClientRects().length || document.hidden) continue;
      const bounds = panel.canvas.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) continue;
      draw(panel, now);
      if (panel.mode === "harvest" && panel.animation && !reducedMotion.matches) active = true;
    }
    if (active) frame = requestAnimationFrame(tick);
  }

  function update() {
    if (frame === null) frame = requestAnimationFrame(tick);
  }

  for (const row of document.querySelectorAll("#art-food tr[data-resource]")) {
    const type = row.dataset.resource === "wood" ? "tree" : row.dataset.resource;
    const definition = RESOURCE_TYPES.find(definition => definition.key === type);
    if (!definition) continue;
    for (const [index, mode] of [[1, "idle"], [2, "carry"], [3, "harvest"]]) {
      const link = row.children[index]?.querySelector("figure>a"), original = link?.querySelector("img");
      if (!original) continue;
      const animation = mode === "carry" ? null : animations.get(type);
      const sprite = new Image();
      const corpse = type === "nutrients";
      const source = mode === "carry" ? definition.carryImage : animation?.image || (corpse ? original.dataset.originalSrc : definition.image);
      sprite.src = source;
      sprite.decode().then(() => {
        const shape = type === "tree" && mode !== "carry" && !animation ? { frameSize: sprite.naturalHeight, columns: 3, frameCount: 1 } : animation;
        const bounds = resourceImageBounds(source);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        canvas.setAttribute("aria-hidden", "true");
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        const panel = { canvas, context, sprite, animation: shape, bounds, type: corpse && mode !== "carry" ? "tree" : type, mode };
        draw(panel, 0);
        original.style.visibility = "hidden";
        link.querySelector(".food-world-sprite")?.remove();
        link.append(canvas);
        panels.push(panel);
        update();
      }).catch(() => {});
    }
  }
  new MutationObserver(update).observe(document.getElementById("codex-food"), { attributes: true });
  document.addEventListener("visibilitychange", update);
  document.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  reducedMotion.addEventListener("change", update);
})();
