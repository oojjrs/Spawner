export const AGENT_LIFESPAN_WARNING = 30;

export const AGENT_LIFESPAN_COLORS = Object.freeze({
  bean: Object.freeze({ color: Object.freeze([196, 165, 68]), region: .6 }),
  spore: Object.freeze({ filter: "grayscale(.9) sepia(.12) hue-rotate(235deg) saturate(.65) brightness(1.12) contrast(.9)" }),
  pebble: Object.freeze({ filter: "grayscale(1) brightness(1.18) contrast(.85)" }),
  spring: Object.freeze({ filter: "grayscale(.9) sepia(.16) hue-rotate(145deg) saturate(.65) brightness(1.12) contrast(.9)" })
});

export function agentLifespanWarning(agent, time) {
  const remaining = agent.bornAt + agent.lifespan - time;
  return !agent.species && ["colony", "rival"].includes(agent.faction) && agent.health > 0 &&
    remaining > 0 && remaining <= AGENT_LIFESPAN_WARNING && !(agent.birth && time < agent.birth.readyAt);
}

export function createAgentLifespanArt(createSurface) {
  const sources = new WeakMap(), frames = new Map();
  let nextSource = 0;

  function draw(context, agent, time, image, ...area) {
    const appearance = AGENT_LIFESPAN_COLORS[agent.tribe || "bean"];
    if (!appearance || !agentLifespanWarning(agent, time)) {
      context.drawImage(image, ...area);
      return;
    }
    if (appearance.filter) {
      context.save(); context.filter = appearance.filter;
      context.drawImage(image, ...area); context.restore();
      return;
    }
    const crop = area.length === 8 ? area.slice(0, 4) : [0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height];
    if (!sources.has(image)) sources.set(image, nextSource++);
    const key = sources.get(image) + ":" + crop.join(":");
    let sprite = frames.get(key);
    if (!sprite) {
      sprite = createSurface(crop[2], crop[3]);
      const target = sprite.getContext("2d", { willReadFrequently: true });
      target.drawImage(image, ...crop, 0, 0, sprite.width, sprite.height);
      const pixels = target.getImageData(0, 0, sprite.width, sprite.height), data = pixels.data;
      const mask = new Uint8Array(sprite.width * sprite.height), queue = new Int32Array(mask.length);
      for (let pixel = 0; pixel < mask.length; pixel++) {
        const offset = pixel * 4;
        mask[pixel] = data[offset + 3] > 100 && data[offset] > 130 &&
          data[offset + 2] > data[offset] * .78 && data[offset + 1] - data[offset] < 35 ? 1 : 0;
      }
      let bodyTop = sprite.height, largest = mask.length * .02;
      for (let pixel = 0; pixel < mask.length; pixel++) {
        if (!mask[pixel]) continue;
        let count = 1, top = sprite.height;
        queue[0] = pixel; mask[pixel] = 0;
        for (let cursor = 0; cursor < count; cursor++) {
          const current = queue[cursor], x = current % sprite.width, y = Math.floor(current / sprite.width);
          top = Math.min(top, y);
          for (const next of [x > 0 ? current - 1 : -1, x + 1 < sprite.width ? current + 1 : -1, current - sprite.width, current + sprite.width]) {
            if (next < 0 || next >= mask.length || !mask[next]) continue;
            mask[next] = 0; queue[count++] = next;
          }
        }
        if (count > largest) { largest = count; bodyTop = top; }
      }
      const end = Math.floor(Math.min(sprite.height * appearance.region, bodyTop - 3)) * sprite.width * 4;
      for (let offset = 0; offset < end; offset += 4) {
        const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
        if (!data[offset + 3] || green < red * 1.04 || green < blue * 1.15 || green - Math.min(red, blue) < 18) continue;
        const shade = (.2126 * red + .7152 * green + .0722 * blue) / 180;
        for (let channel = 0; channel < 3; channel++) data[offset + channel] = appearance.color[channel] * shade;
      }
      target.putImageData(pixels, 0, 0);
      frames.set(key, sprite);
      if (frames.size > 32) frames.delete(frames.keys().next().value);
    }
    context.drawImage(sprite, ...(area.length === 8 ? area.slice(4) : area));
  }

  return { draw };
}
