function hash(x, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function createIslandCoast(size, seed, waterBudget) {
  const profiles = Array.from({ length: 4 }, () => new Float32Array(size));
  const cornerRadius = size * (.075 + hash(0, seed + 2459) * .025);
  let total = 0;
  for (let side = 0; side < profiles.length; side++) {
    const phase = hash(side, seed + 2401) * Math.PI * 2;
    const center = size * (.24 + hash(side, seed + 2411) * .5);
    const width = size * (.035 + hash(side, seed + 2417) * .02);
    const depth = 28 + hash(side, seed + 2423) * 20;
    const companion = center > size * .5 ? center - size * .27 : center + size * .27;
    for (let position = 0; position < size; position++) {
      const t = position / (size - 1), along = Math.sin(t * Math.PI * 3 + phase) * .65 + Math.sin(t * Math.PI * 9 + phase * 1.7) * .35;
      const inlet = depth * Math.exp(-(((position - center) / width) ** 2));
      const cove = depth * .4 * Math.exp(-(((position - companion) / (width * .65)) ** 2));
      const taper = Math.sin(t * Math.PI) ** .4;
      const value = Math.max(.05, (.6 + Math.max(0, along) ** 2 * 6 + inlet + cove) * taper);
      profiles[side][position] = value; total += value;
    }
  }
  const cornerArea = cornerRadius * cornerRadius * (4 - Math.PI);
  const scale = Math.max(0, waterBudget * .48 - (size * 4 - 4) - cornerArea) / total;
  for (const profile of profiles) for (let index = 0; index < size; index++) profile[index] = 1 + profile[index] * scale;
  const distance = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const qx = Math.abs(x - (size - 1) / 2) - ((size - 3) / 2 - cornerRadius);
    const qy = Math.abs(y - (size - 1) / 2) - ((size - 3) / 2 - cornerRadius);
    const rounded = cornerRadius - Math.hypot(Math.max(0, qx), Math.max(0, qy)) - Math.min(Math.max(qx, qy), 0);
    distance[y * size + x] = Math.min(rounded, y - profiles[0][x], size - 1 - y - profiles[1][x], x - profiles[2][y], size - 1 - x - profiles[3][y]);
  }
  return { distance, profiles };
}
