import { unitDisplayAttributes, unitDisplayAttributesFrom } from "./unit-display-appearance.mjs";
import { springThrustAppearance } from "./spring-attachment-thrust.mjs";
import { imageFrameSize, imageScale } from "./image-geometry.mjs";
import { createTribeAttributeAnimation, hasTribeAttributes } from "./attribute-animation.mjs";

let boundsWorker = null, boundsWorkerFailed = false, boundsWorkerReady = Promise.resolve(), boundsWorkerId = 0, boundsWorkerCancel = null;
const boundsWorkerResults = new Map();
function boundsWorkerSource() {
  self.onmessage = async event => {
    const { id, source, width, height, blob } = event.data;
    let bitmap;
    try {
      const response = blob ? null : await fetch(source);
      if (response && !response.ok) throw new Error(String(response.status));
      bitmap = await createImageBitmap(blob || await response.blob());
      const surface = new OffscreenCanvas(width, height);
      const context = surface.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width, top = height, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      self.postMessage({ id, result: { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) } });
    } catch { self.postMessage({ id, error: true }); }
    finally { bitmap?.close(); }
  };
}
function prepareImageBounds(source, width, height) {
  const key = source + "|" + width + "|" + height;
  if (boundsWorkerResults.has(key)) return Promise.resolve(boundsWorkerResults.get(key));
  const pending = boundsWorkerReady.then(async () => {
    const blob = source.startsWith("blob:") ? await fetch(source).then(response => {
      if (!response.ok) throw new Error(String(response.status));
      return response.blob();
    }) : null;
    return new Promise((resolve, reject) => {
    if (boundsWorkerResults.has(key)) { resolve(boundsWorkerResults.get(key)); return; }
    if (boundsWorkerFailed || !globalThis.Worker || !globalThis.OffscreenCanvas) { reject(); return; }
    if (!boundsWorker) {
      const url = URL.createObjectURL(new Blob(["(" + boundsWorkerSource.toString() + ")()"], { type: "text/javascript" }));
      try { boundsWorker = new Worker(url); }
      catch { boundsWorkerFailed = true; reject(); return; }
      finally { URL.revokeObjectURL(url); }
    }
    const worker = boundsWorker, id = ++boundsWorkerId;
    let timer, settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      boundsWorkerCancel = null;
      worker.onmessage = worker.onerror = null;
      if (result) { boundsWorkerResults.set(key, result); resolve(result); }
      else { worker.terminate(); boundsWorker = null; boundsWorkerFailed = true; reject(); }
    }
    boundsWorkerCancel = () => finish(null);
    worker.onmessage = event => { if (event.data.id === id) finish(event.data.result); };
    worker.onerror = () => finish(null);
    timer = setTimeout(() => finish(null), 15000);
    try { worker.postMessage({ id, source: blob ? null : source, width, height, blob }); }
    catch { finish(null); }
    });
  });
  boundsWorkerReady = pending.catch(() => {});
  return pending;
}
globalThis.addEventListener?.("pagehide", () => { boundsWorkerCancel?.(); boundsWorker?.terminate(); boundsWorker = null; boundsWorkerFailed = true; });

export function createTribeArt(definitions, assetSource) {
  const previews = new Map(), units = new Map(), sprites = new Map(), imageBounds = new WeakMap();
  const attributes = createTribeAttributeAnimation(assetSource, (width, height) => {
    const surface = document.createElement("canvas");
    surface.width = width; surface.height = height;
    return surface;
  }, image);

  async function image(path) {
    const sprite = new Image();
    sprite.crossOrigin = "anonymous";
    sprite.src = assetSource(path);
    await sprite.decode();
    return sprite;
  }

  async function prepareBounds(sprite, frame) {
    const source = sprite.currentSrc || sprite.src;
    const naturalWidth = sprite.naturalWidth, naturalHeight = sprite.naturalHeight;
    const cached = imageBounds.get(sprite);
    if (cached && cached.source === source && cached.width === sprite.naturalWidth && cached.height === sprite.naturalHeight && cached.frames.has(frame)) return cached.frames.get(frame);
    const size = typeof frame === "number" ? frame : 512;
    const width = frame ? size : sprite.naturalWidth || sprite.width;
    const height = frame ? size : sprite.naturalHeight || sprite.height;
    try {
      if (!source || !(sprite.naturalWidth > 0)) throw new Error();
      const result = await prepareImageBounds(source, width, height);
      if ((sprite.currentSrc || sprite.src) !== source || sprite.naturalWidth !== naturalWidth || sprite.naturalHeight !== naturalHeight) return bounds(sprite, frame);
      let entry = imageBounds.get(sprite);
      if (!entry || entry.source !== source || entry.width !== sprite.naturalWidth || entry.height !== sprite.naturalHeight) {
        entry = { source, width: sprite.naturalWidth, height: sprite.naturalHeight, frames: new Map() };
        imageBounds.set(sprite, entry);
      }
      entry.frames.set(frame, result);
      return result;
    } catch {
      await new Promise(resolve => {
        let frame = null, timer = null, settled = false;
        function finish() {
          if (settled) return;
          settled = true;
          if (frame !== null) globalThis.cancelAnimationFrame?.(frame);
          clearTimeout(timer);
          resolve();
        }
        if (document.hidden || typeof requestAnimationFrame !== "function") { timer = setTimeout(finish, 0); return; }
        timer = setTimeout(finish, 50);
        frame = requestAnimationFrame(() => { frame = null; setTimeout(finish, 0); });
      });
      return bounds(sprite, frame);
    }
  }

  function bounds(sprite, frame) {
    let cached = null;
    if (sprite.naturalWidth > 0) {
      const source = sprite.currentSrc || sprite.src;
      cached = imageBounds.get(sprite);
      if (!cached || cached.source !== source || cached.width !== sprite.naturalWidth || cached.height !== sprite.naturalHeight) {
        cached = { source, width: sprite.naturalWidth, height: sprite.naturalHeight, frames: new Map() };
        imageBounds.set(sprite, cached);
      }
      if (cached.frames.has(frame)) return cached.frames.get(frame);
    }
    const surface = document.createElement("canvas");
    const size = typeof frame === "number" ? frame : 512;
    surface.width = frame ? size : sprite.naturalWidth || sprite.width;
    surface.height = frame ? size : sprite.naturalHeight || sprite.height;
    const context = surface.getContext("2d", { willReadFrequently: true });
    context.drawImage(sprite, 0, 0);
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    let left = surface.width, top = surface.height, right = 0, bottom = 0;
    for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) {
      if (pixels[(y * surface.width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    const result = { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    if (cached) cached.frames.set(frame, result);
    return result;
  }

  function preparePreview(tribe) {
    if (!previews.has(tribe.key)) previews.set(tribe.key, Promise.all([image(tribe.nest), image(tribe.idle)]).then(([nest, idle]) =>
      ({ nest, idle, nestBounds: bounds(nest, false) })).catch(error => { previews.delete(tribe.key); throw error; }));
    return previews.get(tribe.key);
  }

  async function prepareUnit(tribe) {
    if (tribe.key === "bean") return;
    if (!units.has(tribe.key)) units.set(tribe.key, (async () => {
      const [starter, body, manifest, parts] = await Promise.all([image(tribe.starter), image(tribe.body),
        fetch(assetSource(tribe.manifest)).then(response => {
          if (!response.ok) throw new Error("부족 정보를 불러오지 못했습니다.");
          return response.json();
        }), Promise.all(tribe.parts.map(image)), attributes.prepare(tribe.key)]);
      await Promise.all([starter, body, ...parts].map(part => prepareBounds(part, false)));
      const starterBounds = bounds(starter, false);
      const scale = Math.min(310 / starterBounds.width, 350 / starterBounds.height);
      const box = { x: 256 - starterBounds.width * scale / 2, y: 460 - starterBounds.height * scale,
        width: starterBounds.width * scale, height: starterBounds.height * scale };
      const entries = manifest.staticSources || manifest.assets;
      const mounted = new Map(tribe.parts.map((path, index) => {
        const entry = entries.find(asset => asset.path === path), mount = entry.mount;
        const crop = bounds(parts[index], false);
        const sourceScale = imageScale(tribe.starter);
        const width = mount.widthRatio ? box.width * mount.widthRatio :
          mount.center ? box.width * mount.width : mount.width * sourceScale * scale;
        const height = width * crop.height / crop.width;
        const x = mount.center ? box.x + box.width * mount.center[0] - width / 2 : box.x + (mount.x * sourceScale - starterBounds.x) * scale;
        const y = mount.center ? box.y + box.height * mount.center[1] - height / 2 : box.y + (mount.y * sourceScale - starterBounds.y) * scale;
        return [path.split("/").at(-1).replace(".png", ""), { sprite: parts[index], crop, x, y, width, height }];
      }));
      const result = { starter, starterBounds, body, bodyBounds: bounds(body, false), box, mounted };
      units.set(tribe.key, result);
      return result;
    })());
    try { return await units.get(tribe.key); }
    catch (error) { units.delete(tribe.key); throw error; }
  }

  function sprite(tribe, attributes, layer) {
    attributes = unitDisplayAttributesFrom(attributes);
    const key = [tribe, layer, attributes.strength ?? attributes.arms ?? 0,
      ...["feet", "antenna"].map(name => attributes[name] || 0)].join(":");
    if (sprites.has(key)) return sprites.get(key);
    const unit = units.get(tribe);
    if (!unit || unit instanceof Promise) throw new Error("부족 유닛을 불러오는 중입니다.");
    if (hasTribeAttributes(attributes)) {
      const portrait = attributePortrait(tribe, attributes, unit.box, layer);
      if (portrait) { sprites.set(key, portrait); return portrait; }
    }
    const surface = document.createElement("canvas");
    surface.width = surface.height = 512;
    const context = surface.getContext("2d");
    const draw = part => {
      if (!part) return;
      const crop = part.crop;
      context.drawImage(part.sprite, crop.x, crop.y, crop.width, crop.height, part.x, part.y, part.width, part.height);
    };
    const part = name => unit.mounted.get(name + "-" + Math.min(2, attributes[name] || 1));
    if (!layer || layer === "full" || layer === "body") {
      const crop = unit.starterBounds, box = unit.box;
      if (attributes.feet && part("feet")) {
        const body = unit.bodyBounds;
        const scale = Math.min(box.width / body.width, box.height / body.height);
        context.drawImage(unit.body, body.x, body.y, body.width, body.height,
          256 - body.width * scale / 2, box.y, body.width * scale, body.height * scale);
      } else context.drawImage(unit.starter, crop.x, crop.y, crop.width, crop.height, box.x, box.y, box.width, box.height);
      if (attributes.strength) draw(part("strength"));
    }
    if (attributes.antenna && (!layer || layer === "full" || layer === "antenna")) draw(part("antenna"));
    if (attributes.feet && (!layer || layer === "full" || layer.startsWith("feet-"))) {
      context.save();
      if (layer?.startsWith("feet-")) {
        context.beginPath();
        context.rect(layer === "feet-left" ? 0 : 256, 0, 256, 512);
        context.clip();
      }
      draw(part("feet"));
      context.restore();
    }
    sprites.set(key, surface);
    return surface;
  }

  function drawPreview(context, art, tribe, time, width, height, reducedMotion, scale) {
    context.clearRect(0, 0, width, height);
    const crop = art.nestBounds;
    const nestWidth = art.nestWidth * scale, nestHeight = art.nestHeight * scale;
    context.drawImage(art.nest, crop.x, crop.y, crop.width, crop.height,
      (width - nestWidth) / 2, height * .76 - nestHeight, nestWidth, nestHeight);
    const frame = reducedMotion ? 0 : Math.floor(time / tribe.frameMs) % tribe.frames;
    const size = art.unitSize * scale;
    const frameSize = imageFrameSize(tribe.idle, 512);
    context.drawImage(art.idle, frame % 4 * frameSize, Math.floor(frame / 4) * frameSize, frameSize, frameSize,
      width * .62 - size / 2, height * .97 - size * .875, size, size);
  }

  function attributePortrait(tribe, appearance, box, layer) {
    return attributes.portrait(tribe, appearance, 512, 512, box, layer);
  }

  function animationFrame(agent, source, animation, index, action, time, pose) {
    return attributes.frame(agent.tribe, unitDisplayAttributes(agent), source, animation, index, action, time, pose, undefined, undefined, agent);
  }

  function combatAttackSprite(tribe, appearance, source, elapsed) {
    const unit = units.get(tribe);
    return springThrustAppearance(tribe, appearance) && unit?.box ?
      attributes.attackPortrait(tribe, appearance, source, elapsed, unit.box) : null;
  }

  function animationPose(agent, pose, time) {
    return attributes.pose(agent, pose, time);
  }

  function bodySize(tribe, appearance, portrait) {
    appearance = unitDisplayAttributesFrom(appearance);
    return attributes.bodySize(tribe, appearance, portrait ? units.get(tribe)?.box : null);
  }

  return { preparePreview, prepareUnit, sprite, bounds, prepareBounds, drawPreview, animationFrame, animationPose, combatAttackSprite, bodySize, animationCacheStats: attributes.cacheStats };
}
