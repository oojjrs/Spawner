import { landscapeHash } from "./landscape-processes.mjs";

export function normalProbability(value) {
  const x = Math.abs(value), t = 1 / (1 + .2316419 * x);
  const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t *
    (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return value < 0 ? tail : 1 - tail;
}

function transform(real, imaginary, size, inverse) {
  for (let row = 0; row < size; row++) {
    const offset = row * size;
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[offset+i], real[offset+j]] = [real[offset+j], real[offset+i]];
        [imaginary[offset+i], imaginary[offset+j]] = [imaginary[offset+j], imaginary[offset+i]];
      }
    }
    for (let span = 2; span <= size; span *= 2) {
      const angle = (inverse ? 2 : -2) * Math.PI / span, cosine = Math.cos(angle), sine = Math.sin(angle);
      for (let start = 0; start < size; start += span) {
        let wr = 1, wi = 0;
        for (let k = 0; k < span / 2; k++) {
          const a = offset+start+k, b = a+span/2, br = real[b]*wr-imaginary[b]*wi, bi = real[b]*wi+imaginary[b]*wr;
          real[b] = real[a]-br; imaginary[b] = imaginary[a]-bi;
          real[a] += br; imaginary[a] += bi;
          const next = wr*cosine-wi*sine; wi = wr*sine+wi*cosine; wr = next;
        }
      }
    }
    if (inverse) for (let i = offset; i < offset+size; i++) { real[i] /= size; imaginary[i] /= size; }
  }
}

function transpose(values, size) {
  for (let y = 0; y < size; y++) for (let x = 0; x < y; x++) {
    const a = y*size+x, b = x*size+y, value = values[a]; values[a] = values[b]; values[b] = value;
  }
}

function transform2D(real, imaginary, size, inverse) {
  transform(real, imaginary, size, inverse); transpose(real, size); transpose(imaginary, size);
  transform(real, imaginary, size, inverse); transpose(real, size); transpose(imaginary, size);
}

export function createLandscapeField(size, seed, correlation, smoothness) {
  let width = 1; while (width < size + 128) width *= 2;
  const real = new Float64Array(width*width), imaginary = new Float64Array(real.length);
  for (let index = 0; index < real.length; index += 2) {
    const radius = Math.sqrt(-2*Math.log(Math.max(1e-12,landscapeHash(index,1,seed))));
    const angle = landscapeHash(index,2,seed)*Math.PI*2;
    real[index] = radius*Math.cos(angle); real[index+1] = radius*Math.sin(angle);
  }
  transform2D(real, imaginary, width, false);
  const kappa = Math.sqrt(2*smoothness)/correlation;
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const kx = Math.min(x,width-x)*2*Math.PI/width, ky = Math.min(y,width-y)*2*Math.PI/width;
    const factor = Math.pow(kappa*kappa/(kappa*kappa+kx*kx+ky*ky),(smoothness+1)/2), index = y*width+x;
    real[index] *= factor; imaginary[index] *= factor;
  }
  transform2D(real, imaginary, width, true);
  const values = new Float32Array(size*size), offset = Math.floor((width-size)/2);
  let sum = 0, square = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = real[(y+offset)*width+x+offset]; values[y*size+x] = value; sum += value; square += value*value;
  }
  const mean = sum/values.length, deviation = Math.sqrt(Math.max(1e-20,square/values.length-mean*mean));
  for (let index = 0; index < values.length; index++) values[index] = Math.round((values[index]-mean)/deviation*1e6)/1e6;
  return values;
}

export function routeLandscape(height, sea, size) {
  const length = height.length, level = new Float64Array(height), parent = new Int32Array(length).fill(-1);
  const order = new Int32Array(length), seen = new Uint8Array(length), heap = new Int32Array(length);
  let count = 0, used = 0;
  function less(a,b) { return level[a] < level[b] || level[a] === level[b] && a < b; }
  function push(index) {
    let position = used++;
    while (position) { const next = (position-1)>>1; if (!less(index,heap[next])) break; heap[position] = heap[next]; position = next; }
    heap[position] = index;
  }
  function pop() {
    const first = heap[0], last = heap[--used]; let position = 0;
    while (position*2+1 < used) {
      let child = position*2+1; if (child+1 < used && less(heap[child+1],heap[child])) child++;
      if (!less(heap[child],last)) break; heap[position] = heap[child]; position = child;
    }
    heap[position] = last; return first;
  }
  for (let index = 0; index < length; index++) if (sea[index]) { seen[index] = 1; push(index); }
  while (used) {
    const index = pop(), x = index%size, y = Math.floor(index/size); order[count++] = index;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x+dx, ny = y+dy;
      if ((!dx&&!dy)||nx<0||ny<0||nx>=size||ny>=size) continue;
      const next = ny*size+nx; if (seen[next]) continue;
      seen[next] = 1; parent[next] = index; level[next] = Math.max(height[next],level[index]+1e-5); push(next);
    }
  }
  const area = new Float64Array(length), slope = new Float32Array(length);
  for (const index of order) {
    if (sea[index]) continue;
    const x = index%size, y = Math.floor(index/size); let best = 0, receiver = parent[index];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x+dx, ny = y+dy;
      if ((!dx&&!dy)||nx<0||ny<0||nx>=size||ny>=size) continue;
      const next = ny*size+nx, descent = (level[index]-level[next])/Math.hypot(dx,dy);
      if (descent > best) { best = descent; receiver = next; }
    }
    parent[index] = receiver; slope[index] = best/80; area[index] = 6400;
  }
  for (let cursor = count-1; cursor >= 0; cursor--) {
    const index = order[cursor], next = parent[index]; if (next >= 0) area[next] += area[index];
  }
  return { level, parent, order, area, slope };
}

export function selectContinentalSea(values, size) {
  const sorted = Array.from(values).sort((a,b)=>a-b), sea = new Uint8Array(values.length), queue = new Int32Array(values.length);
  let lower = sorted[0]-1, upper = sorted.at(-1)+1, threshold = lower, best = Infinity, bestSea = sea.slice();
  for (let pass = 0; pass < 26; pass++) {
    const candidate = (lower+upper)/2; sea.fill(0); let end = 0;
    for (let index = 0; index < values.length; index++) {
      const x = index%size, y = Math.floor(index/size);
      if (!x||!y||x===size-1||y===size-1) { sea[index] = 1; queue[end++] = index; }
    }
    for (let cursor = 0; cursor < end; cursor++) {
      const index = queue[cursor], x = index%size, y = Math.floor(index/size);
      for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx<0||ny<0||nx>=size||ny>=size) continue;
        const next = ny*size+nx; if (sea[next]||values[next]>candidate) continue;
        sea[next] = 1; queue[end++] = next;
      }
    }
    const difference = Math.abs(end/values.length-.2);
    if (difference < best) { best = difference; threshold = candidate; bestSea.set(sea); }
    if (end/values.length < .2) lower = candidate; else upper = candidate;
  }
  return { sea:bestSea, threshold, landFraction:1-bestSea.reduce((sum,value)=>sum+value,0)/values.length };
}
