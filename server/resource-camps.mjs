import { recordPlacementMap } from "./placement-maps.mjs";

import { tribeSafeTerrain, tribeTerrainSpeedMultiplier } from "./tribe-environment.mjs";

const PRIMARY = ["clay", "tree", "pebbles", "dew"];
const LIMITS = [36, 72, 120, 180, 240];
const MINIMUM = [6, 48, 6, 10];

function integral(values, size) {
  const stride = size + 1, result = new Float64Array(stride * stride);
  for (let y = 0; y < size; y++) {
    let row = 0;
    for (let x = 0; x < size; x++) {
      row += values[y * size + x];
      result[(y + 1) * stride + x + 1] = result[y * stride + x + 1] + row;
    }
  }
  return result;
}

function area(table, x, y, radius, size) {
  const stride = size + 1, left = Math.max(0, x - radius), right = Math.min(size, x + radius + 1);
  const top = Math.max(0, y - radius), bottom = Math.min(size, y + radius + 1);
  return table[bottom * stride + right] - table[top * stride + right] - table[bottom * stride + left] + table[top * stride + left];
}

export function campResourceTravel(world, camp, limit) {
  const { size, terrain, hazards } = world, costs = new Int16Array(terrain.length).fill(-1);
  const blocked = new Set();
  for (const nest of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) blocked.add((nest.y + dy) * size + nest.x + dx);
  }
  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * size + burrow.x + dx);
  const buckets = Array.from({ length: limit + 1 }, () => []);
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const index = (camp.y + dy) * size + camp.x + dx;
    if (world.hydrology?.generationVersion >= 30 && !tribeSafeTerrain(camp.tribe, terrain[index], hazards[index])) continue;
    costs[index] = 0; buckets[0].push(index);
  }
  for (let cost = 0; cost <= limit; cost++) for (const index of buckets[cost]) {
    if (costs[index] !== cost) continue;
    const x = index % size, y = Math.floor(index / size);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || Math.abs(nx - camp.x) <= 2 && Math.abs(ny - camp.y) <= 2 &&
          !(Math.abs(nx - camp.x) === 2 && Math.abs(ny - camp.y) === 2)) continue;
      const next = ny * size + nx, type = terrain[next];
      const current = world.hydrology?.generationVersion >= 30;
      if ((current ? !tribeSafeTerrain(camp.tribe, type, hazards[next]) : type < 2 || hazards[next]) || blocked.has(next)) continue;
      const distance = cost + (current ? Math.ceil(3 / tribeTerrainSpeedMultiplier(camp.tribe, type)) : type === 10 ? 6 : type >= 6 && type <= 8 ? 5 : 3);
      if (distance > limit || costs[next] >= 0 && costs[next] <= distance) continue;
      costs[next] = distance; buckets[distance].push(next);
    }
  }
  return costs;
}

export function measureCampExpansion(world, camp, key) {
  const travel = campResourceTravel(world, camp, LIMITS.at(-1)), bands = LIMITS.map(() => ({ nodes: 0, amount: 0 }));
  const directions = new Set();
  let weightedAmount = 0;
  for (const [x, y, amount, type] of world.resources) {
    if (type !== key) continue;
    if (world.hydrology?.generationVersion >= 32 && Math.abs(x - camp.x) <= 2 && Math.abs(y - camp.y) <= 2) continue;
    const distance = travel[y * world.size + x];
    if (distance < 0) continue;
    const band = LIMITS.findIndex(limit => distance <= limit);
    bands[band].nodes++; bands[band].amount += amount;
    if (distance <= 72) weightedAmount += amount * Math.exp(-distance / 18);
    if (distance > 36) directions.add((x >= camp.x ? 1 : 0) + (y >= camp.y ? 2 : 0));
  }
  return { key, limits: LIMITS, bands, directions: directions.size, weightedAmount };
}

function starterResourceIndex(world) {
  const index = new Map();
  for (const cell of world.resources) {
    const position = cell[1] * world.size + cell[0];
    if (!index.has(position)) index.set(position, []);
    index.get(position).push(cell);
  }
  return index;
}

// Level-one DNA workers cannot leave the three-cell nest boundary range.
// Count only natural food that survives footprint/tree clearing and has a
// safe path inside that range. Do not manufacture resources or move old maps.
export function starterFoodAccess(world, camp, key, resourceIndex = starterResourceIndex(world)) {
  const {size, terrain, hazards} = world, boundary = [];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {
    if(Math.abs(dx)===2 && Math.abs(dy)===2)continue;
    if(Math.abs(dx)===2 || Math.abs(dy)===2)boundary.push([camp.x+dx,camp.y+dy]);
  }
  const inside=(x,y)=>boundary.some(([bx,by])=>(x-bx)**2+(y-by)**2<=9);
  const plot=(x,y)=>Math.abs(x-camp.x)<=2&&Math.abs(y-camp.y)<=2;
  const seen=new Set(), queue=[];
  for(const [dx,dy] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
    const x=camp.x+dx,y=camp.y+dy,i=y*size+x;
    if(tribeSafeTerrain(camp.tribe,terrain[i],hazards[i])){seen.add(i);queue.push([x,y]);}
  }
  for(let j=0;j<queue.length;j++)for(const [x,y] of [[queue[j][0]-1,queue[j][1]],[queue[j][0]+1,queue[j][1]],[queue[j][0],queue[j][1]-1],[queue[j][0],queue[j][1]+1]]) {
    const i=y*size+x;
    if(x<0||y<0||x>=size||y>=size||plot(x,y)||!inside(x,y)||seen.has(i)||!tribeSafeTerrain(camp.tribe,terrain[i],hazards[i]))continue;
    seen.add(i);queue.push([x,y]);
  }
  const cells=[...seen].flatMap(i=>resourceIndex.get(i)||[]).filter(([x,y,amount,type])=>type===key&&amount>0&&!plot(x,y)&&
    !(key==='tree'&&camp.tribe==='spore'&&(x-camp.x)**2+(y-camp.y)**2<=16));
  return {nodes:cells.length,amount:cells.reduce((sum,cell)=>sum+cell[2],0)};
}

export function placeResourceCamps(world, tribes, version = world.hydrology?.generationVersion) {
  const { size, terrain, hazards } = world, occupied = new Uint8Array(terrain.length), labels = new Int32Array(terrain.length);
  const queue = new Int32Array(terrain.length), populations = [0];
  for (const [x, y] of [...world.food, ...world.resources]) occupied[y * size + x] = 1;
  for (let first = 0; first < terrain.length; first++) {
    if (labels[first] || terrain[first] < 2 || hazards[first]) continue;
    const label = populations.length;
    let end = 1; queue[0] = first; labels[first] = label;
    for (let cursor = 0; cursor < end; cursor++) {
      const index = queue[cursor], x = index % size, y = Math.floor(index / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const next = ny * size + nx;
        if (labels[next] || terrain[next] < 2 || hazards[next]) continue;
        labels[next] = label; queue[end++] = next;
      }
    }
    populations.push(end);
  }
  const main = populations.indexOf(Math.max(...populations)), available = [];
  const frontierFields = new Map();
  for (const tribe of tribes) frontierFields.set(tribe.key, (world.frontierSites || []).map(site => ({ site,
    costs: campResourceTravel(world, { ...site, tribe: tribe.key }, 420) })));
  const spacing = world.hydrology?.generationVersion >= 32 ? 1 : 3;
  for (let y = 16; y < size - 16; y += spacing) for (let x = 16; x < size - 16; x += spacing) {
    if (labels[y * size + x] !== main) continue;
    let valid = true;
    for (let dy = -3; dy <= 3 && valid; dy++) for (let dx = -3; dx <= 3; dx++) {
      const index = (y + dy) * size + x + dx;
      if (terrain[index] < 2 || terrain[index] >= 6 || hazards[index] || Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && !(world.hydrology?.generationVersion >= 32) && occupied[index]) { valid = false; break; }
    }
    if (valid) available.push({ x, y });
  }
  if (world.hydrology?.placementMaps) {
    const values = new Uint8Array(terrain.length);
    for (const site of available) values[site.y * size + site.x] = 1;
    recordPlacementMap(world.hydrology, "camp:available", ["camps"], values, { minimum: 0, maximum: 1 });
  }
  const starterResources = version >= 40 ? starterResourceIndex(world) : null;
  const choices = PRIMARY.map((key, order) => {
    const values = new Float64Array(terrain.length);
    for (const [x, y, amount, type] of world.resources) if (type === key) values[y * size + x] = amount;
    const table = integral(values, size);
    const nodeCounts = world.hydrology?.generationVersion >= 32 ? integral(Uint8Array.from(values, value => value > 0 ? 1 : 0), size) : null;
    const ranked = available.map(site => {
      const frontiers = frontierFields.get(tribes[order].key).map(({site: frontier, costs}) => ({ id: frontier.id, cost: costs[site.y * size + site.x] }))
        .filter(entry => entry.cost >= 0 && entry.cost <= (world.hydrology?.generationVersion >= 31 ? 390 : 420));
      const plotAmount = world.hydrology?.generationVersion >= 32 ? area(table, site.x, site.y, 2, size) : 0;
      return { ...site, frontiers, score: (area(table, site.x, site.y, 12, size) * 2 +
        area(table, site.x, site.y, 28, size) * .5 + area(table, site.x, site.y, 56, size) * .08 - plotAmount * 2.58) * (1 + Math.min(3, frontiers.length) * .12) };
    });
    if (world.hydrology?.placementMaps) {
      const scores = new Float32Array(terrain.length).fill(NaN);
      for (const site of ranked) scores[site.y * size + site.x] = site.score;
      recordPlacementMap(world.hydrology, "camp-score:" + (order + 1), ["camps"], scores, { camp: order + 1, minimum: 0 });
    }
    ranked.sort((left, right) => right.score - left.score || left.y - right.y || left.x - right.x);
    const result = [], sampled = [];
    for (const site of ranked) {
      if (sampled.some(other => Math.hypot(site.x - other.x, site.y - other.y) < 14)) continue;
      if (nodeCounts && area(nodeCounts, site.x, site.y, 14, size) < MINIMUM[order]) continue;
      if (version >= 40 && starterFoodAccess(world, { ...site, tribe: tribes[order].key }, key, starterResources).nodes < 2) continue;
      if (!nodeCounts) sampled.push(site);
      const expansion = measureCampExpansion(world, { ...site, tribe: tribes[order].key }, key);
      if (expansion.bands.some(band => band.nodes < MINIMUM[order]) || expansion.directions < 2) continue;
      if (nodeCounts) sampled.push(site);
      result.push({ ...site, expansion });
      if (result.length >= 20) break;
    }
    return result;
  });
  const order = [0, 1, 2, 3].sort((left, right) => choices[left].length - choices[right].length), selected = [];
  let best = null, bestScore = -Infinity;
  function assign(depth) {
    if (depth === order.length) {
      if (!world.frontierSites?.length) { best = selected.slice(); return true; }
      const shared = new Map(), covered = new Set();
      for (const [tribe, candidate] of selected.entries()) for (const frontier of candidate.frontiers) {
        if (!shared.has(frontier.id)) shared.set(frontier.id, []);
        shared.get(frontier.id).push({ tribe, cost: frontier.cost });
      }
      let score = 0, contested = 0;
      for (const entries of shared.values()) if (entries.length >= 2) {
        contested++; score += 150 - Math.max(...entries.map(entry => entry.cost)) * .1;
        for (const entry of entries) covered.add(entry.tribe);
      }
      score += covered.size * 1000;
      if (score > bestScore) { best = selected.slice(); bestScore = score; }
      return covered.size === 4 && contested >= 2;
    }
    const tribe = order[depth];
    for (const candidate of choices[tribe]) {
      if (selected.some(other => other && Math.hypot(candidate.x - other.x, candidate.y - other.y) < Math.min(80, size / 4))) continue;
      selected[tribe] = candidate;
      if (assign(depth + 1)) return true;
      selected[tribe] = null;
    }
    return false;
  }
  assign(0);
  if (!best) throw new Error("자연 자원과 안전한 확장 경로를 갖춘 네 종족의 시작 위치가 부족합니다.");
  if (world.frontierSites) for (const site of world.frontierSites) site.contenders = best.flatMap((candidate, order) => {
    const reach = candidate.frontiers.find(frontier => frontier.id === site.id);
    return reach ? [{ tribe: tribes[order].key === "sprout" ? "bean" : tribes[order].key, cost: reach.cost }] : [];
  });
  return tribes.map((tribe, order) => ({ id: order + 1, tribe: tribe.key, name: tribe.name, x: best[order].x,
    y: best[order].y, playable: true, controller: order === 0 ? "player" : "ai", expansion: best[order].expansion }));
}
