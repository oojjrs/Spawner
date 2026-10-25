export function createTribeArt(definitions, assetSource) {
  const previews = new Map(), units = new Map(), sprites = new Map();

  async function image(path) {
    const sprite = new Image();
    sprite.src = assetSource(path);
    await sprite.decode();
    return sprite;
  }

  function bounds(sprite, frame) {
    const surface = document.createElement("canvas");
    surface.width = frame ? 512 : sprite.naturalWidth;
    surface.height = frame ? 512 : sprite.naturalHeight;
    const context = surface.getContext("2d", { willReadFrequently: true });
    context.drawImage(sprite, 0, 0);
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    let left = surface.width, top = surface.height, right = 0, bottom = 0;
    for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) {
      if (pixels[(y * surface.width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
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
        }), Promise.all(tribe.parts.map(image))]);
      const starterBounds = bounds(starter, false);
      const scale = Math.min(310 / starterBounds.width, 350 / starterBounds.height);
      const box = { x: 256 - starterBounds.width * scale / 2, y: 460 - starterBounds.height * scale,
        width: starterBounds.width * scale, height: starterBounds.height * scale };
      const entries = manifest.staticSources || manifest.assets;
      const mounted = new Map(tribe.parts.map((path, index) => {
        const entry = entries.find(asset => asset.path === path), mount = entry.mount;
        const crop = bounds(parts[index], false);
        const width = mount.widthRatio ? box.width * mount.widthRatio :
          mount.center ? box.width * mount.width : mount.width * scale;
        const height = width * crop.height / crop.width;
        const x = mount.center ? box.x + box.width * mount.center[0] - width / 2 : box.x + (mount.x - starterBounds.x) * scale;
        const y = mount.center ? box.y + box.height * mount.center[1] - height / 2 : box.y + (mount.y - starterBounds.y) * scale;
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
    const key = [tribe, layer, ...["strength", "feet", "antenna", "lifespan"].map(name => attributes[name] || 0)].join(":");
    if (sprites.has(key)) return sprites.get(key);
    const unit = units.get(tribe);
    if (!unit || unit instanceof Promise) throw new Error("부족 유닛을 불러오는 중입니다.");
    const surface = document.createElement("canvas");
    surface.width = surface.height = 512;
    const context = surface.getContext("2d");
    const draw = part => {
      if (!part) return;
      const crop = part.crop;
      context.drawImage(part.sprite, crop.x, crop.y, crop.width, crop.height, part.x, part.y, part.width, part.height);
    };
    const part = name => unit.mounted.get(name + "-" + Math.min(name === "lifespan" ? 1 : 2, attributes[name] || 1));
    if (!layer || layer === "full" || layer === "body") {
      const crop = unit.starterBounds, box = unit.box;
      if (attributes.feet && part("feet")) {
        const body = unit.bodyBounds;
        const scale = Math.min(box.width / body.width, box.height / body.height);
        context.drawImage(unit.body, body.x, body.y, body.width, body.height,
          256 - body.width * scale / 2, box.y, body.width * scale, body.height * scale);
      } else context.drawImage(unit.starter, crop.x, crop.y, crop.width, crop.height, box.x, box.y, box.width, box.height);
      if (attributes.strength) draw(part("strength"));
      if (attributes.lifespan) draw(part("lifespan"));
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

  function drawPreview(context, art, tribe, time, width, height, reducedMotion) {
    context.clearRect(0, 0, width, height);
    const crop = art.nestBounds;
    const scale = Math.min(width * .72 / crop.width, height * .73 / crop.height);
    const nestWidth = crop.width * scale, nestHeight = crop.height * scale;
    context.drawImage(art.nest, crop.x, crop.y, crop.width, crop.height,
      (width - nestWidth) / 2, height * .76 - nestHeight, nestWidth, nestHeight);
    const frame = reducedMotion ? 0 : Math.floor(time / tribe.frameMs) % tribe.frames;
    const size = Math.min(height * .85, width * .50);
    context.drawImage(art.idle, frame % 4 * 512, Math.floor(frame / 4) * 512, 512, 512,
      width * .62 - size / 2, height * .97 - size * .875, size, size);
  }

  return { preparePreview, prepareUnit, sprite, bounds, drawPreview };
}
