export function unitTribeReference(tribe, starter, bounds) {
  if (tribe === "bean") return { width: bounds.width * 240 / starter.naturalWidth,
    height: bounds.height * 350 / starter.naturalHeight };
  const scale = Math.min(310 / bounds.width, 350 / bounds.height);
  return { x: 256 - bounds.width * scale / 2, y: 460 - bounds.height * scale,
    width: bounds.width * scale, height: bounds.height * scale };
}

export function unitAnimationSheetScale(reference, animation, bounds, idleAnimation, idleBounds, action) {
  const sampled = action === "walk" ? idleBounds : bounds;
  const frameSize = action === "walk" ? idleAnimation.frameSize : animation.frameSize;
  let scale = frameSize / 512 * Math.min(reference.width / sampled.width, reference.height / sampled.height);
  if (action === "walk") scale *= (animation.registrationScale || 1) / (idleAnimation.registrationScale || 1);
  return scale;
}

export function creatureIdleSheetScale(animation, bounds) {
  return animation.frameSize / 512 * 480 / Math.max(bounds.width, bounds.height);
}

export function unitDisplayMetrics(target, animation, bounds, size) {
  const length = Math.max(bounds.width, bounds.height);
  const scale = target / length;
  const result = { scale: target * animation.frameSize / (size * length),
    bounds: { x: (bounds.x - animation.pivotX) * scale, y: (bounds.y - animation.pivotY) * scale,
      width: bounds.width * scale, height: bounds.height * scale }, groundShape: null };
  if (animation.groundRadiusX) {
    const reference = scale * (animation.viewSize || animation.frameSize) / (animation.registrationScale || 1);
    result.groundShape = { radiusX: animation.groundRadiusX * reference, radiusY: animation.groundRadiusY * reference };
  }
  return result;
}

export function unitAttributeDisplayScale(base, growth, reference, size) {
  const scale = (base || 1) * growth;
  return size.width > 0 ? scale * reference.width / size.width : null;
}

export function unitPresentationBodySize(options, tribe, attributes) {
  const idle = options.sheets.get(tribe).get("idle");
  const customized = ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0);
  const height = .7;
  const scaled = (size, scale) => ({ width: size.width * scale, height: size.height * scale });
  let size;
  if (tribe === "bean") {
    if (customized) {
      const image = options.baseParts.get("body"), bounds = options.tribeArt.bounds(image, false);
      size = { width: height * 240 / 512 * bounds.width / image.naturalWidth,
        height: height * 350 / 512 * bounds.height / image.naturalHeight };
    } else size = scaled(idle.bodyBounds[0], height * idle.scale / idle.animation.frameSize);
  } else size = scaled(options.tribeArt.bodySize(tribe, attributes, false), height * idle.scale / 144);
  if (options.model.combatAttributeKeys(attributes).length) {
    const replacement = tribe !== "bean" && customized ? options.tribeArt.bodySize(tribe, attributes, true) : scaled(size, 256 / height);
    size = scaled(options.combatAttributeArt.bodySize({ tribe, attributes }, replacement), height * 2 / 512);
  }
  return size;
}

export function createUnitPresentationAssets(options) {
  const model = options.model, source = options.source;
  const tribeArt = options.tribeArt || model.createTribeArt(model.PLAYER_TRIBES, source);
  const sheets = options.sheets || new Map(model.PLAYER_TRIBES.map(tribe => [tribe.key, new Map()]));
  const images = options.images || new Map(), baseParts = options.baseParts || new Map();
  const pendingImages = new Map(), pendingReferences = new Map(), pendingActions = new Map();
  const displayScales = new Map(), displayBounds = new Map(), groundShapes = new Map(), attributeScales = new Map();
  const references = new Map();
  for (const entries of sheets.values()) for (const entry of entries.values()) images.set(entry.animation.image, entry.sprite);
  async function loadImage(path) {
    if (pendingImages.has(path)) return pendingImages.get(path);
    const sprite = images.get(path) || (options.createImage ? options.createImage() : new Image());
    if (!images.has(path)) { images.set(path, sprite); sprite.src = source(path); }
    const pending = Promise.resolve().then(() => sprite.decode()).then(() => sprite).catch(error => {
      if (images.get(path) === sprite) images.delete(path);
      throw error;
    }).finally(() => pendingImages.delete(path));
    pendingImages.set(path, pending);
    return pending;
  }
  async function prepareReference(tribe) {
    if (references.has(tribe)) return references.get(tribe);
    if (!pendingReferences.has(tribe)) pendingReferences.set(tribe, (async () => {
      const definition = model.PLAYER_TRIBES.find(value => value.key === tribe);
      const starter = await loadImage(tribe === "bean" ? "DesignAssets/Units/starter-sprout-bean.png" : definition.starter);
      const bounds = await tribeArt.prepareBounds(starter, false);
      const reference = unitTribeReference(tribe, starter, bounds);
      references.set(tribe, reference);
      return reference;
    })().finally(() => pendingReferences.delete(tribe)));
    return pendingReferences.get(tribe);
  }
  async function prepareAction(tribe, action, reference) {
    const key = tribe + ":" + action;
    if (!pendingActions.has(key)) pendingActions.set(key, (async () => {
      const animation = model.UNIT_ANIMATIONS[tribe][action];
      if (!animation) return;
      let entry = sheets.get(tribe).get(action);
      if (!entry) {
        entry = { animation, sprite: await loadImage(animation.image), scale: 1 };
        sheets.get(tribe).set(action, entry);
      } else await entry.sprite.decode();
      const idle = sheets.get(tribe).get("idle");
      const idleBounds = await tribeArt.prepareBounds(idle.sprite, idle.animation.frameSize);
      const bounds = action === "walk" ? idleBounds : await tribeArt.prepareBounds(entry.sprite, entry.animation.frameSize);
      entry.scale = unitAnimationSheetScale(reference, entry.animation, bounds, idle.animation, idleBounds, action);
      entry.referenceHeight = reference.height;
      if (tribe === "bean" && ["idle", "attack", "hurt", "death"].includes(action))
        options.prepareSproutFrames(entry, action === "idle" ? 1 : entry.animation.frameCount);
    })().catch(error => { pendingActions.delete(key); throw error; }));
    return pendingActions.get(key);
  }
  function prepareDisplaySize(key, sprite, animation, size) {
    const bounds = tribeArt.bounds(sprite, animation.frameSize);
    const metrics = unitDisplayMetrics(model.UNIT_DISPLAY_SIZES[key], animation, bounds, size);
    displayScales.set(key, metrics.scale);
    displayBounds.set(key, metrics.bounds);
    if (metrics.groundShape) groundShapes.set(key, metrics.groundShape);
    return metrics;
  }
  async function prepareTribe(tribe, actions, attributes) {
    if (tribe === "bean" && !baseParts.has("body"))
      baseParts.set("body", await loadImage("DesignAssets/Units/BaseParts/body.png"));
    const reference = await prepareReference(tribe);
    await prepareAction(tribe, "idle", reference);
    if (tribe !== "bean" && ["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0))
      await tribeArt.prepareUnit(model.PLAYER_TRIBES.find(value => value.key === tribe));
    await Promise.all(actions.filter(action => action !== "idle").map(action => prepareAction(tribe, action, reference)));
    const idle = sheets.get(tribe).get("idle");
    prepareDisplaySize(tribe, idle.sprite, idle.animation, .7 * idle.scale);
  }
  function bodySize(tribe, attributes) {
    return unitPresentationBodySize({ model, sheets, baseParts, tribeArt, combatAttributeArt: options.combatAttributeArt }, tribe, attributes);
  }
  function displayScale(unit) {
    const tribe = unit.tribe || "bean", kind = unit.species || tribe;
    const base = displayScales.get(kind) || 1;
    const growth = model.unitDisplaySize(unit) / (model.UNIT_DISPLAY_SIZES[kind] || model.UNIT_DISPLAY_SIZES.bean);
    if (unit.species) return base * growth;
    const attributes = model.unitDisplayAttributes(unit);
    const equipped = model.ATTRIBUTES.filter(attribute => attributes[attribute.key] > 0);
    if (!equipped.length || equipped.some(attribute => attribute.kind === "combat") && !options.combatAttributeArt?.ready(tribe)) return base * growth;
    const key = tribe + ":" + equipped.map(attribute => attribute.key + ":" + attributes[attribute.key]).join(",");
    if (!attributeScales.has(key)) {
      const scale = unitAttributeDisplayScale(base, 1, bodySize(tribe, {}), bodySize(tribe, attributes));
      if (scale) attributeScales.set(key, scale);
    }
    return (attributeScales.get(key) || base) * growth;
  }
  return { tribeArt, sheets, images, baseParts, references, displayScales, displayBounds, groundShapes,
    loadImage, prepareTribe, prepareDisplaySize, displayScale, bodySize };
}
