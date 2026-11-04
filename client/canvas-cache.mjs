export function createCanvasCacheBudget(pixelBudget) {
  if (!Number.isSafeInteger(pixelBudget) || pixelBudget <= 0) throw new RangeError('INVALID CANVAS CACHE BUDGET');
  const lru = new Map();
  let pixels = 0, peakPixels = 0, evictions = 0;
  function remove(token) {
    const entry = lru.get(token);
    if (!entry) return false;
    pixels -= entry.pixels; lru.delete(token); entry.owner.delete(entry.key); return true;
  }
  function createCache(measure = value => value.width * value.height) {
    const entries = new Map();
    const cache = {
      get size() { return entries.size; },
      has: key => entries.has(key),
      get(key) {
        const entry = entries.get(key);
        if (!entry) return undefined;
        lru.delete(entry); lru.set(entry, entry); return entry.value;
      },
      set(key, value) {
        const old = entries.get(key); if (old) remove(old);
        const cost = measure(value);
        if (!Number.isSafeInteger(cost) || cost < 0) throw new RangeError('INVALID CANVAS CACHE PIXEL COUNT');
        // Oversized transient results can still be drawn, but are not retained.
        if (cost > pixelBudget) return cache;
        while (pixels + cost > pixelBudget && lru.size) { remove(lru.keys().next().value); evictions++; }
        const entry = { key, value, pixels: cost, owner: entries };
        entries.set(key, entry); lru.set(entry, entry); pixels += cost; peakPixels = Math.max(peakPixels, pixels);
        return cache;
      },
      delete(key) { const entry=entries.get(key); return entry ? remove(entry) : false; },
      keys: () => entries.keys(),
      clear() { for (const entry of [...entries.values()]) remove(entry); }
    };
    return cache;
  }
  return { createCache, stats: () => ({ pixelBudget, pixels, peakPixels, entries: lru.size, evictions }) };
}

const mobile = globalThis.matchMedia?.('(max-width: 660px), (pointer: coarse)').matches === true;
export const TRIBE_CANVAS_CACHE_BUDGET = createCanvasCacheBudget((mobile ? 8 : 32) * 1024 * 1024);
