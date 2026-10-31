function hash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +
    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;
}

export function createContinentLandscape(size, seed) {
  const length = size * size, height = new Float64Array(length), basement = new Float32Array(length);
  const uplift = new Float32Array(length), offsetX = new Float32Array(length), offsetY = new Float32Array(length);
  const direction = hash(0, 0, seed + 2503) * Math.PI * 2, ranges = [];
  for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {
    const order = row * 5 + column;
    ranges.push({ x: (column + .25 + hash(order, 0, seed + 2521) * .5) * size / 5,
      y: (row + .25 + hash(order, 0, seed + 2531) * .5) * size / 5,
      angle: direction + hash(order, 0, seed + 2539) * 2.6 - 1.3,
      along: 9 + hash(order, 0, seed + 2543) * 22, across: 3.5 + hash(order, 0, seed + 2549) * 5.5,
      bend: 1 + hash(order, 0, seed + 2553) * 5, height: .36 + hash(order, 0, seed + 2551) * .12 });
  }
  const basins = Array.from({ length: 3 }, (_, order) => ({ x: size * (.15 + hash(order, 0, seed + 2557) * .7),
    y: size * (.15 + hash(order, 0, seed + 2579) * .7), radius: 13 + hash(order, 0, seed + 2591) * 10 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    let relief = 0, depression = 0;
    const warp = noise(x, y, 19, seed + 2593) * 4;
    for (const range of ranges) {
      const dx = x - range.x, dy = y - range.y, along = dx * Math.cos(range.angle) + dy * Math.sin(range.angle);
      const across = -dx * Math.sin(range.angle) + dy * Math.cos(range.angle) + warp + Math.sin(along / 11) * range.bend;
      const ridge = Math.exp(-(along * along / (range.along * range.along) + across * across / (range.across * range.across)));
      const spur = .6 * Math.exp(-((along + range.along * .25) ** 2 / ((range.along * .55) ** 2) +
        (across - along * .45) ** 2 / ((range.across * .7) ** 2)));
      relief = Math.max(relief, range.height * Math.max(ridge, spur));
    }
    for (const basin of basins) depression += .09 * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));
    basement[index] = .18 + ((x / size - .5) * Math.cos(direction) + (y / size - .5) * Math.sin(direction)) * .3 +
      noise(x, y, 93, seed + 2609) * .065 + noise(x, y, 31, seed + 2617) * .018 - depression;
    uplift[index] = relief;
    height[index] = basement[index] + relief + noise(x, y, 7, seed + 2621) * .006;
    offsetX[index] = hash(x, y, seed + 2633) * .4 - .2;
    offsetY[index] = hash(x, y, seed + 2647) * .4 - .2;
  }
  return { height, basement, uplift, offsetX, offsetY, ranges, direction, erosionPasses: 18 };
}
