import { generateWildlife, generateResourceAreas } from "./ecology.mjs";
import { populateWorldEconomy } from "./economy.mjs";

export const SIZE = 320;
const RESOURCE_RADIUS = 22, CAMP_MIN_DISTANCE = 80;
export const NEST_SAFE_RADIUS = 10;
const TRIBE_STARTS = [{"key":"sprout","name":"새싹콩","terrainRule":null,"resourceRule":null},{"key":"spore","name":"포자버섯","terrainRule":null,"resourceRule":null},{"key":"pebble","name":"몽돌","terrainRule":null,"resourceRule":null},{"key":"spring","name":"샘방울","terrainRule":null,"resourceRule":null}];
export const FORAGING = { workers: 2, seconds: 300, capacity: 2, speed: 0.5, harvestSeconds: 1.5, prepareSeconds: 1, unloadSeconds: 1, nearDistance: 16 };
const CREATURES = [{"key":"flower-tail-bird","name":"꽃꼬리새","group":"공생","terrains":[4,5],"nearWater":false,"small":true,"large":false,"order":0},{"key":"dew-rabbit","name":"이슬토끼","group":"공생","terrains":[4,5],"nearWater":false,"small":true,"large":false,"order":1},{"key":"soil-mole","name":"흙두더지","group":"공생","terrains":[3,4],"nearWater":false,"small":true,"large":false,"order":2},{"key":"bundle-snail","name":"보따리달팽이","group":"생활 중립","terrains":[2,4,5],"nearWater":false,"small":true,"large":false,"order":3},{"key":"cotton-sheep","name":"솜양","group":"생활 중립","terrains":[3,4],"nearWater":false,"small":true,"large":false,"order":4},{"key":"rolling-acorn","name":"굴림도토리","group":"생활 중립","terrains":[3,5],"nearWater":false,"small":true,"large":false,"order":5},{"key":"soil-boar","name":"흙멧돼지","group":"영역","terrains":[3,4,5],"nearWater":false,"small":false,"large":true,"order":6},{"key":"bubble-toad","name":"방울두꺼비","group":"영역","terrains":[2,4,5],"nearWater":true,"small":false,"large":true,"order":7},{"key":"vine-turtle","name":"넝쿨거북","group":"영역","terrains":[4,5],"nearWater":false,"small":false,"large":true,"order":8},{"key":"shadow-weasel","name":"그늘족제비","group":"상위 포식자","terrains":[5],"nearWater":false,"small":false,"large":true,"order":9},{"key":"snare-vine","name":"올가미덩굴","group":"상위 포식자","terrains":[5],"nearWater":false,"small":false,"large":true,"order":10},{"key":"talon-owl","name":"갈퀴부엉이","group":"상위 포식자","terrains":[5,6],"nearWater":false,"small":false,"large":true,"order":11},{"key":"spiny-back-beetle","name":"가시등 딱정벌레","group":"영역","terrains":[3,4,5,6],"small":true,"large":true,"order":12}];
const UNIQUE_CREATURES = [{"key":"spring-keeper","name":"봄지기","group":"유니크 · 꽃꼬리새","terrains":[4,5],"unique":true},{"key":"lantern-keeper","name":"등불지기","group":"유니크 · 이슬토끼","terrains":[4,5],"unique":true},{"key":"old-garden-snail","name":"오래된 등짐","group":"유니크 · 보따리달팽이","terrains":[2,4,5],"unique":true},{"key":"walking-forest","name":"걸어가는 산","group":"유니크 · 넝쿨거북","terrains":[4,5],"unique":true},{"key":"white-paw","name":"흰발","group":"유니크 · 그늘족제비","terrains":[5],"unique":true},{"key":"spiny-back-leader","name":"가시등 우두머리","group":"유니크 · 가시등 딱정벌레","terrains":[3,4,5,6],"unique":true}];
const FOOD_HABITATS = [{"key":"honey-mushrooms","terrains":["forest"],"neighbors":[]},{"key":"tree-fruit","terrains":["forest"],"neighbors":[]},{"key":"berry-bush","terrains":["grassland"],"neighbors":["forest"]},{"key":"seed-pods","terrains":["land","grassland"],"neighbors":[]},{"key":"root-bulbs","terrains":["grassland","forest"],"neighbors":[]},{"key":"nutrient-moss","terrains":["forest","swamp"],"neighbors":[]}];
const RESOURCE_HABITATS = [{"key":"pebbles","terrains":["coast","land","lowMountain"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":36,"separation":7},{"key":"clay","terrains":["coast","grassland","swamp"],"neighbors":["deep","shallow","coast","swamp"],"rarity":"uncommon","minDistance":24,"nodes":20,"separation":8},{"key":"sand","terrains":["coast"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":28,"separation":7},{"key":"grass-fiber","terrains":["grassland","forest"],"neighbors":[],"rarity":"common","minDistance":4,"nodes":42,"separation":6},{"key":"iron-ore","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":48,"nodes":10,"separation":9},{"key":"copper-ore","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":48,"nodes":8,"separation":9},{"key":"quartz","terrains":["lowMountain"],"neighbors":[],"rarity":"rare","minDistance":56,"nodes":5,"separation":10}];
const TERRAIN = ['deep', 'shallow', 'coast', 'land', 'grassland', 'forest', 'lowMountain', 'highMountain', 'ridge', 'swamp'];
const ENCOUNTER_RULES = {
"flower-tail-bird": {
  "spawn": "시작부터 먹이터에서 활동한다.",
  "population": "서식지당 초기 3마리 · 생존 상한 3마리",
  "respawn": "3분마다 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"dew-rabbit": {
  "spawn": "시작부터 서식하며 접근하면 숨거나 도주한다.",
  "population": "서식지당 초기 3마리 · 생존 상한 3마리",
  "respawn": "4분마다 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"soil-mole": {
  "spawn": "시작부터 땅속에 잠복하고 주변 채집에 반응해 지상으로 나온다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 5분 후 땅속에서 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"bundle-snail": {
  "spawn": "시작부터 정해진 노선을 순회한다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 8분 후 노선 시작점에서 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"cotton-sheep": {
  "spawn": "시작부터 먹이터에 무리로 배치한다.",
  "population": "서식지당 초기 4마리 · 생존 상한 4마리",
  "respawn": "5분마다 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"rolling-acorn": {
  "spawn": "시작부터 정지 상태로 배치하고 접근하면 구르기 시작한다.",
  "population": "서식지당 초기 3마리 · 생존 상한 3마리",
  "respawn": "3분마다 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"soil-boar": {
  "spawn": "시작부터 영역을 지키며 침범에 반응한다.",
  "population": "서식지당 초기 2마리 · 생존 상한 2마리",
  "respawn": "6분마다 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"bubble-toad": {
  "spawn": "시작부터 물가에 잠복하고 접근하면 육지로 나온다.",
  "population": "서식지당 초기 2마리 · 생존 상한 2마리",
  "respawn": "5분마다 물가에 1마리 보충한다.",
  "guaranteedAt": "",
  "implemented": true
},
"vine-turtle": {
  "spawn": "시작부터 긴 구간을 천천히 순회한다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 10분 후 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"shadow-weasel": {
  "spawn": "게임 5분부터 사냥터에서 활동한다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 8분 후 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"snare-vine": {
  "spawn": "시작부터 고정 위치에 잠복하고 사거리 안의 대상에 반응한다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 6분 후 새 덩굴로 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"talon-owl": {
  "spawn": "시작부터 횃대에서 대기하고 대상이 들어오면 출격한다.",
  "population": "서식지당 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망 10분 후 횃대에서 재등장한다.",
  "guaranteedAt": "",
  "implemented": true
},
"spiny-back-beetle": {
  "spawn": "시작부터 굴에서 생성한다.",
  "population": "굴당 작은 굴 초기 1·상한 3마리, 큰 굴 초기 3·상한 6마리",
  "respawn": "작은 굴 120초·큰 굴 60초마다 1마리 증식하며, 굴 파괴 시 중단한다.",
  "guaranteedAt": "",
  "implemented": true
},
"spring-keeper": {
  "spawn": "꽃꼬리새 발견 후 먹이 10개를 둥지로 운반하면 등장한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망하면 재등장하지 않는다.",
  "guaranteedAt": "5분",
  "implemented": true
},
"lantern-keeper": {
  "spawn": "정찰이 등장지 주변에 접근하면 빛으로 30초간 예고한 뒤 등장한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "숨어도 같은 개체가 복귀하며, 사망하면 재등장하지 않는다.",
  "guaranteedAt": "6분",
  "implemented": true
},
"old-garden-snail": {
  "spawn": "게임 6분부터 순회 노선 방문을 시작한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "생존 중 계속 순회하며, 사망하면 재등장하지 않는다.",
  "guaranteedAt": "6분",
  "implemented": true
},
"walking-forest": {
  "spawn": "넝쿨거북을 발견했고 게임 시간이 8분 이상이면 등장한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "이동·정지를 반복하며, 사망하면 재등장하지 않는다.",
  "guaranteedAt": "10분",
  "implemented": true
},
"white-paw": {
  "spawn": "그늘족제비 1마리를 처치했고 게임 시간이 8분 이상이면 등장한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "퇴각 후에도 같은 개체이며, 사망하면 재등장하지 않는다.",
  "guaranteedAt": "12분",
  "implemented": true
},
"spiny-back-leader": {
  "spawn": "큰 굴의 습격이 한 번 발생했고 게임 시간이 10분 이상이면 등장한다.",
  "population": "맵 전체 초기 1마리 · 생존 상한 1마리",
  "respawn": "사망하면 재등장하지 않는다.",
  "guaranteedAt": "12분",
  "implemented": true
}
};
export const ENCOUNTER_PLANS = [{"key":"flower-tail-bird","kind":"먹이터","radius":10,"routeLength":0,"state":"상주","safeRadius":10,"preferredDistance":30,"behavior":"초원·숲 경계의 먹이터를 오갑니다.","badge":"1","color":"#92d7ab"},{"key":"dew-rabbit","kind":"서식지","radius":8,"routeLength":0,"state":"상주","safeRadius":10,"preferredDistance":35,"behavior":"접근하면 주변 서식 범위 안에서 숨거나 달아납니다.","badge":"2","color":"#a4d6ef"},{"key":"soil-mole","kind":"땅굴","radius":6,"routeLength":0,"state":"잠복","safeRadius":10,"preferredDistance":40,"behavior":"흙더미로 위치를 예고하고 주변 채집에 반응합니다.","badge":"3","color":"#d4ae86"},{"key":"bundle-snail","kind":"순회","radius":3,"routeLength":32,"state":"상주","safeRadius":10,"preferredDistance":50,"behavior":"해안·초원·숲을 잇는 구간을 천천히 순회합니다.","badge":"4","color":"#d9b1ea"},{"key":"cotton-sheep","kind":"무리","radius":12,"routeLength":0,"state":"상주","safeRadius":10,"preferredDistance":36,"behavior":"초원 먹이터 안에서 무리로 움직입니다.","badge":"5","color":"#f2d995"},{"key":"rolling-acorn","kind":"반응","radius":10,"routeLength":0,"state":"잠복","safeRadius":10,"preferredDistance":42,"behavior":"숲 바닥과 평지 경계에서 접근에 반응해 구릅니다.","badge":"6","color":"#dcab77"},{"key":"soil-boar","kind":"영역","radius":14,"routeLength":0,"state":"경계","safeRadius":32,"preferredDistance":60,"behavior":"영역 침범에 경고한 뒤 공격합니다.","badge":"7","color":"#ed9979"},{"key":"bubble-toad","kind":"물가","radius":10,"routeLength":0,"state":"상주","safeRadius":32,"preferredDistance":64,"behavior":"물가에 흔적을 남기고 접근하면 육지로 나옵니다.","badge":"8","color":"#85d9d4"},{"key":"vine-turtle","kind":"순회","radius":4,"routeLength":40,"state":"상주","safeRadius":32,"preferredDistance":70,"behavior":"숲과 초원을 잇는 구간을 느리게 순회합니다.","badge":"9","color":"#90c997"},{"key":"shadow-weasel","kind":"사냥터","radius":18,"routeLength":0,"state":"중반 활동","safeRadius":32,"preferredDistance":90,"behavior":"숲의 이동 통로에 흔적을 먼저 드러냅니다.","badge":"10","color":"#bcace5"},{"key":"snare-vine","kind":"잠복지","radius":4,"routeLength":0,"state":"잠복","safeRadius":32,"preferredDistance":86,"behavior":"숲속 고정 위치에서 가까운 대상에 반응합니다.","badge":"11","color":"#cf94b9"},{"key":"talon-owl","kind":"출격","radius":22,"routeLength":0,"state":"횃대 대기","safeRadius":32,"preferredDistance":100,"behavior":"횃대에서 주변 사냥 구간으로 출격합니다.","badge":"12","color":"#8dbcf0"},{"key":"spiny-back-beetle","kind":"굴","radius":9,"routeLength":0,"state":"상주","safeRadius":32,"preferredDistance":60,"behavior":"굴 주변을 지키며 큰 굴에서 습격합니다.","badge":"13","color":"#e2bf7c"},{"key":"spring-keeper","kind":"특수 먹이터","radius":12,"routeLength":0,"state":"등장 대기","safeRadius":22,"preferredDistance":72,"behavior":"꽃꼬리새의 특별한 먹이터가 활성화되면 등장합니다.","badge":"★1","color":"#c4ed8a"},{"key":"lantern-keeper","kind":"탐색","radius":10,"routeLength":0,"state":"등장 대기","safeRadius":22,"preferredDistance":80,"behavior":"숲 안쪽의 빛 흔적을 따라 발견합니다.","badge":"★2","color":"#e6d996"},{"key":"old-garden-snail","kind":"순회","radius":4,"routeLength":48,"state":"방문 대기","safeRadius":22,"preferredDistance":90,"behavior":"외곽의 긴 순회 구간을 따라 방문합니다.","badge":"★3","color":"#f2c8ac"},{"key":"walking-forest","kind":"순회","radius":5,"routeLength":56,"state":"후반 활동","safeRadius":32,"preferredDistance":100,"behavior":"넓은 숲과 초원 사이를 길게 이동합니다.","badge":"★4","color":"#74ddb1"},{"key":"white-paw","kind":"사냥터","radius":24,"routeLength":0,"state":"후반 활동","safeRadius":32,"preferredDistance":110,"behavior":"깊은 숲에서 흔적을 단계적으로 드러냅니다.","badge":"★5","color":"#efbedb"},{"key":"spiny-back-leader","kind":"우두머리 굴","radius":16,"routeLength":0,"state":"후반 활동","safeRadius":32,"preferredDistance":100,"behavior":"별도 큰 굴에서 후반에 활동을 시작합니다.","badge":"★6","color":"#ff9a89"}].map(plan => ({ ...CREATURES.concat(UNIQUE_CREATURES).find(creature => creature.key === plan.key), ...plan, ...ENCOUNTER_RULES[plan.key] }));
function hash(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, scale, seed) {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +
    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;
}
export function generateMapWorld(seed, onProgress, version) {
  let progress = 0;
  onProgress?.(0);
  const reportProgress = value => {
    if (value <= progress) return;
    progress = value;
    onProgress?.(value);
  };
  for (let revision = 0; revision < 8; revision++) {
    try { return generateWorldCandidate(seed, revision, reportProgress, version); }
    catch (error) { if (!error.encounterPlacement || revision === 7) throw error; }
  }
}
function generateWorldCandidate(seed, revision, onProgress, version) {
  const ecological = version === undefined || version >= 10;
  const terrain = new Uint8Array(SIZE * SIZE), hazards = new Uint8Array(SIZE * SIZE);
  const moistureField = new Float32Array(SIZE * SIZE), heightField = new Float32Array(SIZE * SIZE);
  const waterDistance = new Uint8Array(SIZE * SIZE);
  const mountainDistance = new Uint8Array(SIZE * SIZE).fill(255);
  const clearance = new Uint8Array(SIZE * SIZE), region = new Int32Array(SIZE * SIZE);
  const queue = new Int32Array(SIZE * SIZE), visited = new Uint32Array(SIZE * SIZE), distance = new Uint8Array(SIZE * SIZE);
  let stamp = 0, camps = [], starts = [], foodSites = new Map();
  const walkable = index => terrain[index] >= 2 && terrain[index] <= 8 || terrain[index] === 9;
  const safe = index => walkable(index) && !hazards[index];
  const abundance = index => hazards[index] ? 1.3 + Math.max(0, moistureField[index]) * 1.2 : 1;
  const adjacent = index => {
    const x = index % SIZE, y = Math.floor(index / SIZE), result = [];
    if (x > 0) result.push(index - 1);
    if (x < SIZE - 1) result.push(index + 1);
    if (y > 0) result.push(index - SIZE);
    if (y < SIZE - 1) result.push(index + SIZE);
    return result;
  };
  function neighborhood(site) {
    stamp++;
    const points = [];
    let end = 0;
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const index = (site.y + dy) * SIZE + site.x + dx;
      queue[end++] = index; visited[index] = stamp; distance[index] = 0;
    }
    for (let cursor = 0; cursor < end; cursor++) {
      const index = queue[cursor]; points.push(index);
      if (distance[index] === RESOURCE_RADIUS) continue;
      for (const next of adjacent(index)) {
        const dx = Math.abs(next % SIZE - site.x), dy = Math.abs(Math.floor(next / SIZE) - site.y);
        if (visited[next] === stamp || !safe(next) || dx <= 2 && dy <= 2 && !(dx === 2 && dy === 2)) continue;
        visited[next] = stamp; distance[next] = distance[index] + 1; queue[end++] = next;
      }
    }
    return points;
  }
  function tribeHabitat(site, tribe) {
    const index = site.y * SIZE + site.x;
    if (tribe.key === 'pebble') return [2, 3, 6].includes(terrain[index]) && (waterDistance[index] <= 8 || mountainDistance[index] <= 6);
    if (tribe.key === 'sprout') return [2, 4, 9].includes(terrain[index]);
    const type = tribe.key === 'spore' ? 5 : 4;
    if (terrain[index] !== type || tribe.key === 'spring' && waterDistance[index] <= 8) return false;
    let matching = 0, total = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      if (dx * dx + dy * dy > 36) continue;
      const next = (site.y + dy) * SIZE + site.x + dx;
      if (hazards[next] || Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && terrain[next] !== type) return false;
      matching += terrain[next] === type ? 1 : 0; total++;
    }
    return matching >= total * .75;
  }
  function allocate(site, tribe) {
    const points = neighborhood(site).filter(index => Math.max(Math.abs(index % SIZE - site.x), Math.abs(Math.floor(index / SIZE) - site.y)) > 3);
    const initialFood = ecological && tribe.key === 'sprout' ? points.filter(index => distance[index] <= 12 &&
      habitatFits(RESOURCE_HABITATS.find(habitat => habitat.key === 'clay'), index % SIZE, Math.floor(index / SIZE), true))
      .sort((left, right) => distance[left] - distance[right] || left - right).slice(0, 3) :
      points.filter(index => distance[index] <= 12 && foodSites.has(index));
    if (initialFood.length < 2) return null;
    points.sort((a, b) => hash(a % SIZE, Math.floor(a / SIZE), seed + site.x * 17 + site.y * 31) -
      hash(b % SIZE, Math.floor(b / SIZE), seed + site.x * 17 + site.y * 31));
    const resources = [], used = new Set(ecological && tribe.key === 'sprout' ? initialFood : []);
    const common = RESOURCE_HABITATS.filter(habitat => habitat.rarity === 'common');
    common.sort((a, b) => ecological && tribe.key === 'pebble' && (a.key === 'pebbles' || b.key === 'pebbles') ?
      (b.key === 'pebbles' ? 1 : 0) - (a.key === 'pebbles' ? 1 : 0) :
      hash(a.nodes, a.separation, seed + site.x) - hash(b.nodes, b.separation, seed + site.x));
    for (const habitat of common) {
      const placed = [];
      for (const index of points) {
        const x = index % SIZE, y = Math.floor(index / SIZE);
        if (used.has(index) || foodSites.has(index) || distance[index] < habitat.minDistance || !habitatFits(habitat, x, y, true) ||
          placed.some(point => Math.hypot(point[0] - x, point[1] - y) < habitat.separation)) continue;
        placed.push([x, y, 50, habitat.key]);
        if (placed.length === 2) break;
      }
      if (placed.length < 2) continue;
      for (const point of placed) { resources.push(point); used.add(point[1] * SIZE + point[0]); }
      if (resources.length === 6) break;
    }
    if (ecological && tribe.key === 'pebble' && !resources.some(point => point[3] === 'pebbles')) return null;
    return resources.length >= (ecological ? 2 : 4) ? { resources, initialFood } : null;
  }
  function placeSwamps(landscapeSeed) {
    const candidates = [];
    for (let y = 4; y < SIZE - 4; y += 4) for (let x = 4; x < SIZE - 4; x += 4) {
      const index = y * SIZE + x;
      if (terrain[index] !== 5 || waterDistance[index] < 2 || waterDistance[index] > 12 || heightField[index] >= 0.3) continue;
      candidates.push({ x, y, index, priority: hash(x, y, landscapeSeed + 349) });
    }
    candidates.sort((a, b) => a.priority - b.priority);
    const basins = [], basinCount = 3 + Math.floor(hash(0, 0, landscapeSeed + 353) * 3);
    for (const candidate of candidates) {
      if (basins.some(basin => Math.hypot(basin.x - candidate.x, basin.y - candidate.y) < 64)) continue;
      basins.push(candidate);
      if (basins.length === basinCount) break;
    }
    if (basins.length < 3) return 0;
    const scores = new Float32Array(terrain.length);
    let heapSize = 0;
    stamp++;
    function offer(index) {
      if (visited[index] === stamp || terrain[index] < 2 || terrain[index] > 5 || heightField[index] >= 0.4) return;
      visited[index] = stamp;
      const x = index % SIZE, y = Math.floor(index / SIZE);
      let radius = Infinity;
      for (const basin of basins) radius = Math.min(radius, Math.hypot(x - basin.x, y - basin.y));
      scores[index] = radius + noise(x, y, 19, landscapeSeed + 359) * 3 + heightField[index] * 4 - moistureField[index] * 3;
      let position = heapSize++;
      while (position > 0) {
        const parent = (position - 1) >>> 1;
        if (scores[queue[parent]] <= scores[index]) break;
        queue[position] = queue[parent]; position = parent;
      }
      queue[position] = index;
    }
    for (const basin of basins) offer(basin.index);
    const target = Math.round(terrain.length * (0.07 + hash(0, 0, landscapeSeed + 367) * 0.02));
    let swampCount = 0;
    while (heapSize && swampCount < target) {
      const index = queue[0], last = queue[--heapSize];
      if (heapSize) {
        let position = 0;
        while (position * 2 + 1 < heapSize) {
          let child = position * 2 + 1;
          if (child + 1 < heapSize && scores[queue[child + 1]] < scores[queue[child]]) child++;
          if (scores[last] <= scores[queue[child]]) break;
          queue[position] = queue[child]; position = child;
        }
        queue[position] = last;
      }
      terrain[index] = 9; swampCount++;
      for (const next of adjacent(index)) offer(next);
    }
    if (swampCount < target) return 0;
    const swampDepth = new Uint8Array(terrain.length);
    for (let index = 0; index < terrain.length; index++) {
      const x = index % SIZE, y = Math.floor(index / SIZE);
      swampDepth[index] = terrain[index] === 9 && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;
    }
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
      const index = y * SIZE + x;
      swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index - 1], swampDepth[index - SIZE - 1], swampDepth[index - SIZE], swampDepth[index - SIZE + 1]));
    }
    for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {
      const index = y * SIZE + x;
      swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index + 1], swampDepth[index + SIZE - 1], swampDepth[index + SIZE], swampDepth[index + SIZE + 1]));
    }
    const spores = [];
    for (let index = 0; index < terrain.length; index++) {
      const x = index % SIZE, y = Math.floor(index / SIZE);
      hazards[index] = terrain[index] === 5 && moistureField[index] > 0.3 && adjacent(index).filter(next => terrain[next] === 5).length >= 3 &&
        noise(x, y, 13, landscapeSeed + 373) > 0.25 ? 2 : 0;
      if (swampDepth[index] >= 5) spores.push({ index,
        priority: swampDepth[index] + noise(x, y, 17, landscapeSeed + 379) * 2 + moistureField[index] });
    }
    const sporeTarget = Math.round(swampCount * 0.27);
    if (spores.length < sporeTarget) return 0;
    spores.sort((a, b) => b.priority - a.priority);
    for (let index = 0; index < sporeTarget; index++) hazards[spores[index].index] = 1;
    return swampCount;
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    let swampCount = 0;
    const landscapeSeed = (seed + Math.imul(attempt + revision * 12, 2654435761)) >>> 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const index = y * SIZE + x;
      const moisture = noise(x, y, 25, landscapeSeed + 31) * 0.68 + noise(x, y, 9, landscapeSeed + 73) * 0.32;
      const height = noise(x, y, 55, landscapeSeed + 127) * 0.8 + noise(x, y, 17, landscapeSeed + 151) * 0.2;
      const water = noise(x, y, 67, landscapeSeed + 251) * 0.75 + noise(x, y, 19, landscapeSeed + 307) * 0.25;
      let type = moisture > 0.1 ? 5 : moisture < -0.18 ? 3 : 4;
      if (height > 0.4) type = 6;
      if (height > 0.68) type = 7;
      if (height > 0.83) type = 8;
      if (water < -0.34) type = water < -0.51 ? 0 : 1;
      terrain[index] = type;
      moistureField[index] = moisture; heightField[index] = height;
      if (x === SIZE - 1 && y % 8 === 7) onProgress(.25 * (y + 1) / SIZE);
    }
    const inland = terrain.slice();
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
      const index = y * SIZE + x;
      if (inland[index] < 2) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inland[(y + dy) * SIZE + x + dx] < 2) terrain[index] = 2;
      }
    }
    waterDistance.fill(255);
    let waterEnd = 0;
    for (let index = 0; index < terrain.length; index++) if (terrain[index] < 2) {
      waterDistance[index] = 0; queue[waterEnd++] = index;
    }
    for (let cursor = 0; cursor < waterEnd; cursor++) {
      const index = queue[cursor];
      if (waterDistance[index] === (version === 6 ? 6 : 26)) continue;
      for (const next of adjacent(index)) if (waterDistance[next] > waterDistance[index] + 1) {
        waterDistance[next] = waterDistance[index] + 1; queue[waterEnd++] = next;
      }
    }
    if (ecological) {
      mountainDistance.fill(255);
      let end = 0;
      for (let index = 0; index < terrain.length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) {
        mountainDistance[index] = 0; queue[end++] = index;
      }
      for (let cursor = 0; cursor < end; cursor++) {
        const index = queue[cursor];
        if (mountainDistance[index] >= 6) continue;
        for (const next of adjacent(index)) if (mountainDistance[next] > mountainDistance[index] + 1) {
          mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;
        }
      }
    }
    if (version === 6) {
      for (let index = 0; index < terrain.length; index++) {
        if (terrain[index] >= 2 && terrain[index] <= 5 && waterDistance[index] <= 5 &&
            moistureField[index] > 0.1 && heightField[index] < 0.18) terrain[index] = 9;
      }
      for (let index = 0; index < terrain.length; index++) {
        hazards[index] = terrain[index] === 9 && waterDistance[index] <= 3 && moistureField[index] > 0.2 ? 1 :
          terrain[index] === 5 && moistureField[index] > 0.3 && adjacent(index).filter(next => terrain[next] === 5).length >= 3 ? 2 : 0;
      }
    } else if (version === 7) {
      const swampCandidates = new Uint8Array(terrain.length);
      let swampEnd = 0;
      for (let index = 0; index < terrain.length; index++) {
        const x = index % SIZE, y = Math.floor(index / SIZE);
        const reach = 10 + Math.max(0, noise(x, y, 43, landscapeSeed + 347)) * 16;
        if (terrain[index] < 2 || terrain[index] > 5 || waterDistance[index] > reach ||
            moistureField[index] <= 0.08 || heightField[index] >= 0.18) continue;
        swampCandidates[index] = 1;
        if (inland[index] === 5 && waterDistance[index] <= 2) {
          terrain[index] = 9; queue[swampEnd++] = index;
        }
      }
      for (let cursor = 0; cursor < swampEnd; cursor++) for (const next of adjacent(queue[cursor])) {
        if (!swampCandidates[next] || terrain[next] === 9) continue;
        terrain[next] = 9; queue[swampEnd++] = next;
      }
      const swampDepth = new Uint8Array(terrain.length);
      for (let index = 0; index < terrain.length; index++) {
        const x = index % SIZE, y = Math.floor(index / SIZE);
        swampDepth[index] = terrain[index] === 9 && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;
      }
      for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
        const index = y * SIZE + x;
        swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index - 1], swampDepth[index - SIZE - 1], swampDepth[index - SIZE], swampDepth[index - SIZE + 1]));
      }
      for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {
        const index = y * SIZE + x;
        swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index + 1], swampDepth[index + SIZE - 1], swampDepth[index + SIZE], swampDepth[index + SIZE + 1]));
      }
      for (let index = 0; index < terrain.length; index++) {
        const x = index % SIZE, y = Math.floor(index / SIZE);
        hazards[index] = terrain[index] === 9 && swampDepth[index] >= 5 && moistureField[index] > 0.2 ? 1 :
          terrain[index] === 5 && moistureField[index] > 0.3 && adjacent(index).filter(next => terrain[next] === 5).length >= 3 &&
          noise(x, y, 13, landscapeSeed + 373) > 0.25 ? 2 : 0;
      }
    } else {
      swampCount = placeSwamps(landscapeSeed);
      if (!swampCount) { camps = []; starts = []; continue; }
    }
    for (let index = 0; index < terrain.length; index++) {
      const x = index % SIZE, y = Math.floor(index / SIZE);
      clearance[index] = safe(index) && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;
    }
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
      const index = y * SIZE + x;
      clearance[index] = Math.min(clearance[index], 1 + Math.min(clearance[index - 1], clearance[index - SIZE - 1], clearance[index - SIZE], clearance[index - SIZE + 1]));
    }
    for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {
      const index = y * SIZE + x;
      clearance[index] = Math.min(clearance[index], 1 + Math.min(clearance[index + 1], clearance[index + SIZE - 1], clearance[index + SIZE], clearance[index + SIZE + 1]));
    }
    region.fill(0);
    let label = 0, mainRegion = 0, largest = 0;
    for (let first = 0; first < terrain.length; first++) {
      if (clearance[first] < 2 || region[first]) continue;
      label++;
      let end = 1; queue[0] = first; region[first] = label;
      for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {
        if (clearance[next] < 2 || region[next]) continue;
        region[next] = label; queue[end++] = next;
      }
      if (end > largest) { largest = end; mainRegion = label; }
    }
    foodSites = new Map();
    for (let y = 4; y < SIZE - 4; y += 4) for (let x = 4; x < SIZE - 4; x += 4) {
      const coarse = (x - 4) % 8 === 0 && (y - 4) % 8 === 0;
      const span = coarse ? 7 : 3, offset = coarse ? 3 : 1;
      const px = x + Math.floor(hash(x, y, seed + 601) * span) - offset, py = y + Math.floor(hash(x, y, seed + 603) * span) - offset;
      const index = py * SIZE + px;
      if (!walkable(index) || !coarse && !hazards[index] || hash(px, py, seed + 607) > (coarse ? 0.48 : 0.2)) continue;
      const available = FOOD_HABITATS.filter(habitat =>
        (version <= 8 || habitat.key === "honey-mushrooms") && habitatFits(habitat, px, py, false));
      if (!available.length) continue;
      foodSites.set(index, available[Math.floor(hash(px, py, seed + 619) * available.length)].key);
    }

    const sites = [];
    for (let y = 32; y < SIZE - 32; y += 8) for (let x = 32; x < SIZE - 32; x += 8) {
      const sx = x + Math.floor(hash(x, y, seed + 433) * 7), sy = y + Math.floor(hash(x, y, seed + 449) * 7);
      const index = sy * SIZE + sx;
      if (clearance[index] >= 4 && region[index] === mainRegion) sites.push({ x: sx, y: sy });
    }
    sites.sort((a, b) => hash(a.x, a.y, seed + 457) - hash(b.x, b.y, seed + 457));
    camps = []; starts = [];
    let siteCursor = 0;
    while (camps.length < 4 && siteCursor < sites.length) {
      const site = sites[siteCursor++];
      if (camps.some(camp => Math.hypot(site.x - camp.x, site.y - camp.y) < CAMP_MIN_DISTANCE)) continue;
      const tribe = TRIBE_STARTS[camps.length];
      if (ecological && !tribeHabitat(site, tribe)) continue;
      const start = allocate(site, tribe);
      if (!start) continue;
      const id = camps.length + 1;
      camps.push({ id, tribe: tribe.key, name: tribe.name, x: site.x, y: site.y, playable: true, controller: id === 1 ? 'player' : 'ai' }); starts.push(tribe.resourceRule ? tribe.resourceRule(site, start) : start);
      if (ecological) siteCursor = 0;
    }
    if (version === 6 || version === 7) {
      if (camps.length === 4) break;
    } else {
      if (camps.length === 4) {
        let spores = 0;
        for (let index = 0; index < hazards.length; index++) {
          if (hazards[index] !== 1) continue;
          const x = index % SIZE, y = Math.floor(index / SIZE);
          if (camps.every(camp => (x - camp.x) ** 2 + (y - camp.y) ** 2 > NEST_SAFE_RADIUS ** 2)) spores++;
        }
        if (spores >= Math.ceil(swampCount * 0.2)) break;
        camps = []; starts = [];
      }
    }
  }
  if (camps.length !== 4) throw new Error('시작 먹이·자원을 확보할 네 부족의 자리가 없습니다.');
  onProgress(.35);
  for (const camp of camps) for (let dy = -NEST_SAFE_RADIUS; dy <= NEST_SAFE_RADIUS; dy++) for (let dx = -NEST_SAFE_RADIUS; dx <= NEST_SAFE_RADIUS; dx++) {
    if (dx * dx + dy * dy <= NEST_SAFE_RADIUS * NEST_SAFE_RADIUS) hazards[(camp.y + dy) * SIZE + camp.x + dx] = 0;
  }
  const reachable = new Uint8Array(SIZE * SIZE), resourceReachable = new Uint8Array(SIZE * SIZE);
  const first = camps[0].y * SIZE + camps[0].x;
  function flood(cells, canEnter) {
    let end = 1; queue[0] = first; cells[first] = 1;
    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {
      if (cells[next] || !canEnter(next)) continue;
      cells[next] = 1; queue[end++] = next;
    }
  }
  flood(reachable, safe); flood(resourceReachable, walkable);
  const food = [], resources = starts.flatMap(start => start.resources);
  if (ecological) for (const index of starts[0].initialFood) foodSites.set(index, 'clay');
  const occupied = new Set([...food, ...resources].map(([x, y]) => y * SIZE + x));
  const outsideStarts = (x, y, minimum) => camps.every(camp => Math.hypot(x - camp.x, y - camp.y) > Math.max(RESOURCE_RADIUS, minimum));
  function habitatFits(habitat, x, y, diagonal) {
    if (!habitat.terrains.includes(TERRAIN[terrain[y * SIZE + x]])) return false;
    if (ecological && habitat.key === 'pebbles') return waterDistance[y * SIZE + x] <= 6 || mountainDistance[y * SIZE + x] <= 6;
    if (!habitat.neighbors.length) return true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (!diagonal && Math.abs(dx) + Math.abs(dy) !== 1)) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && habitat.neighbors.includes(TERRAIN[terrain[ny * SIZE + nx]])) return true;
    }
    return false;
  }
  const initialFood = new Set(starts.flatMap(start => start.initialFood));
  for (const [index, type] of foodSites) {
    const x = index % SIZE, y = Math.floor(index / SIZE);
    if (!resourceReachable[index] || occupied.has(index) || camps.some(camp => Math.max(Math.abs(x - camp.x), Math.abs(y - camp.y)) <= 3)) continue;
    food.push([x, y, 0, type, null, null, initialFood.has(index)]); occupied.add(index);
  }
  for (const habitat of RESOURCE_HABITATS) {
    const candidates = [], placed = resources.filter(point => point[3] === habitat.key);
    for (let y = 2; y < SIZE - 2; y++) for (let x = 2; x < SIZE - 2; x++) {
      const index = y * SIZE + x;
      if (resourceReachable[index] && !occupied.has(index) && outsideStarts(x, y, habitat.minDistance) && habitatFits(habitat, x, y, true)) candidates.push(index);
    }
    const target = habitat.nodes + Math.ceil(candidates.filter(index => hazards[index]).length * 0.1 / (habitat.separation ** 2));
    const gravelWeight = index => ecological && habitat.key === 'pebbles' && waterDistance[index] <= 6 && mountainDistance[index] <= 6 ? 4 : 1;
    candidates.sort((a, b) => hash(a % SIZE, Math.floor(a / SIZE), seed + 719) / abundance(a) / gravelWeight(a) - hash(b % SIZE, Math.floor(b / SIZE), seed + 719) / abundance(b) / gravelWeight(b));
    for (const index of candidates) {
      if (placed.length >= target) break;
      const x = index % SIZE, y = Math.floor(index / SIZE), separation = habitat.separation / Math.sqrt(abundance(index));
      if (occupied.has(index) || placed.some(point => Math.hypot(point[0] - x, point[1] - y) < separation)) continue;
      const node = [x, y, Math.round(50 * abundance(index)), habitat.key]; resources.push(node); placed.push(node); occupied.add(index);
    }
    onProgress(.35 + .15 * (RESOURCE_HABITATS.indexOf(habitat) + 1) / RESOURCE_HABITATS.length);
  }
  const burrows = [];
  const burrowTargets = [{ type: 'large', count: 24, width: 3, separation: 22 }, { type: 'small', count: 64, width: 1, separation: 12 }];
  for (const definition of burrowTargets) {
    const candidates = [];
    for (let y = 2; y < SIZE - 2; y++) for (let x = 2; x < SIZE - definition.width - 1; x++) {
      if (camps.some(camp => {
        const dx = Math.max(x - camp.x, camp.x - x - definition.width + 1, 0), dy = Math.abs(y - camp.y);
        return dx * dx + dy * dy < NEST_SAFE_RADIUS * NEST_SAFE_RADIUS;
      })) continue;
      let valid = true;
      for (let dy = -1; dy <= 1 && valid; dy++) for (let dx = -1; dx <= definition.width; dx++) {
        const index = (y + dy) * SIZE + x + dx;
        if (!safe(index) || !reachable[index] || occupied.has(index) || (dy === 0 && dx >= 0 && dx < definition.width && terrain[index] < 3)) {
          valid = false; break;
        }
      }
      if (valid) candidates.push({ x, y, priority: hash(x, y, seed + (definition.type === 'small' ? 811 : 823)) });
    }
    candidates.sort((a, b) => a.priority - b.priority);
    let count = 0;
    for (const candidate of candidates) {
      if (count === definition.count) break;
      if (burrows.some(other => {
        const gap = Math.max(definition.separation, other.type === 'large' ? 22 : 12);
        const dx = Math.max(candidate.x - other.x - other.width + 1, other.x - candidate.x - definition.width + 1, 0);
        const dy = Math.abs(candidate.y - other.y);
        return dx * dx + dy * dy < gap * gap;
      })) continue;
      const entrance = { x: candidate.x + Math.floor(definition.width / 2), y: candidate.y + 1 };
      if (camps.some(camp => Math.hypot(entrance.x - camp.x, entrance.y - camp.y) < NEST_SAFE_RADIUS)) continue;
      burrows.push({ id: 'burrow:' + definition.type + ':' + (candidate.y * SIZE + candidate.x), type: definition.type,
        x: candidate.x, y: candidate.y, width: definition.width, height: 1, entrance });
      count++;
    }
  }

  onProgress(.6);
  for (const burrow of burrows) burrow.creature = { key:'spiny-back-beetle', name:'가시등 딱정벌레', group:'영역', unique:false };

  const travelBlocked = new Uint8Array(SIZE * SIZE);
  for (const camp of camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) travelBlocked[(camp.y + dy) * SIZE + camp.x + dx] = 1;
  }
  for (const burrow of burrows) for (let dx = 0; dx < burrow.width; dx++) travelBlocked[burrow.y * SIZE + burrow.x + dx] = 1;
  const paths = camps.map(camp => {
    const times = new Int16Array(SIZE * SIZE); times.fill(-1);
    let end = 0;
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const index = (camp.y + dy) * SIZE + camp.x + dx;
      queue[end++] = index; times[index] = 0;
    }
    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {
      if (times[next] >= 0 || !safe(next) || travelBlocked[next]) continue;
      times[next] = times[queue[cursor]] + 1; queue[end++] = next;
    }
    return times;
  });
  onProgress(.65);
  let encounters = [];
  const nestDistance = new Float32Array(SIZE * SIZE);
  for (let index = 0; index < terrain.length; index++) {
    const x = index % SIZE, y = Math.floor(index / SIZE);
    nestDistance[index] = Math.min(...camps.map(camp => Math.hypot(x - camp.x, y - camp.y)));
  }
  function distributeUniques() {
    const groups = ENCOUNTER_PLANS.filter(plan => plan.unique).map((plan, order) => {
      const choices = new Array(6).fill(null);
      const candidates = plan.key === 'spiny-back-leader' ? burrows.filter(burrow => burrow.type === 'large').map(burrow => burrow.entrance.y * SIZE + burrow.entrance.x) : null;
      for (let candidate = 0; candidate < (candidates ? candidates.length : terrain.length); candidate++) {
        const index = candidates ? candidates[candidate] : candidate;
        if (!safe(index) || paths[0][index] < 0 || travelBlocked[index] || nestDistance[index] < plan.safeRadius ||
            !plan.terrains.includes(terrain[index]) || plan.nearWater && waterDistance[index] > 6 || !candidates && occupied.has(index)) continue;
        const x = index % SIZE, y = Math.floor(index / SIZE);
        if (encounters.some(other => Math.hypot(x - other.x, y - other.y) < 14)) continue;
        const column = Math.min(2, Math.floor(x * 3 / SIZE)), row = Math.min(1, Math.floor(y * 2 / SIZE)), sector = row * 3 + column;
        const centerX = (column + .5) * SIZE / 3, centerY = (row + .5) * SIZE / 2;
        const score = Math.hypot(x - centerX, y - centerY) + Math.abs(nestDistance[index] - plan.preferredDistance) * .05 + hash(x, y, seed + 1709 + order * 41) * 8;
        if (!choices[sector] || score < choices[sector].score) choices[sector] = { index, x, y, sector, score };
      }
      return { key:plan.key, choices:choices.filter(Boolean) };
    });
    groups.sort((left, right) => left.choices.length - right.choices.length || left.key.localeCompare(right.key));
    const sectorCounts = new Uint8Array(6), chosen = [];
    let best = null, bestScore = Infinity;
    function assign(depth, score) {
      if (score >= bestScore) return;
      if (depth === groups.length) { best = chosen.slice(); bestScore = score; return; }
      for (const choice of groups[depth].choices) {
        let separation = Infinity;
        for (const other of chosen) separation = Math.min(separation, Math.hypot(choice.x - other.x, choice.y - other.y));
        if (separation < 14) continue;
        const penalty = sectorCounts[choice.sector] * SIZE * SIZE + Math.max(0, 80 - separation) * 4;
        chosen.push(choice); sectorCounts[choice.sector]++;
        assign(depth + 1, score + choice.score + penalty);
        sectorCounts[choice.sector]--; chosen.pop();
      }
    }
    assign(0, 0);
    if (!best) { const error = new Error('지형에 맞는 유니크 6종의 분산 위치를 확보하지 못했습니다.'); error.encounterPlacement = true; throw error; }
    return new Map(groups.map((group, index) => [group.key, best[index].index]));
  }
  let uniqueOrigins = null;
  const parent = new Int32Array(SIZE * SIZE);
  for (let order = 0; !ecological && order < ENCOUNTER_PLANS.length; order++) {
    const plan = ENCOUNTER_PLANS[order];
    const allowed = index => safe(index) && paths[0][index] >= 0 && !travelBlocked[index] && nestDistance[index] >= plan.safeRadius;
    const fits = index => allowed(index) && plan.terrains.includes(terrain[index]) && (!plan.nearWater || waterDistance[index] <= 6);
    let origin = -1, priority = Infinity, home = null;
    const normalEncounters = encounters.filter(other => !other.unique), normalSectorCounts = new Uint8Array(9);
    for (const other of normalEncounters) normalSectorCounts[Math.min(2, Math.floor(other.y * 3 / SIZE)) * 3 + Math.min(2, Math.floor(other.x * 3 / SIZE))]++;
    const burrowType = plan.key === 'spiny-back-leader' ? 'large' : plan.key === 'spiny-back-beetle' ? 'small' : '';
    const candidates = burrowType ? burrows.filter(burrow => burrow.type === burrowType).map(burrow => burrow.entrance.y * SIZE + burrow.entrance.x) : null;
    if (plan.unique) {
      if (!uniqueOrigins) uniqueOrigins = distributeUniques();
      origin = uniqueOrigins.get(plan.key);
    }
    for (let candidate = 0; !plan.unique && candidate < (candidates ? candidates.length : terrain.length); candidate++) {
      const index = candidates ? candidates[candidate] : candidate;
      if (!fits(index) || !candidates && occupied.has(index)) continue;
      const x = index % SIZE, y = Math.floor(index / SIZE);
      if (x < 12 || y < 12 || x >= SIZE - 12 || y >= SIZE - 12) continue;
      if (encounters.some(other => Math.hypot(x - other.x, y - other.y) < 14)) continue;
      const column = Math.min(2, Math.floor(x * 3 / SIZE)), row = Math.min(2, Math.floor(y * 3 / SIZE)), sector = row * 3 + column;
      let separation = SIZE;
      for (const other of normalEncounters) separation = Math.min(separation, Math.hypot(x - other.x, y - other.y));
      const centerDistance = Math.hypot(x - (column + .5) * SIZE / 3, y - (row + .5) * SIZE / 3);
      const score = normalSectorCounts[sector] * SIZE * SIZE + Math.max(0, 64 - separation) * 4 + centerDistance * .2 +
        Math.abs(nestDistance[index] - plan.preferredDistance) * .05 + hash(x, y, seed + 1103 + order * 37) * 8;
      if (score < priority) { origin = index; priority = score; }
    }
    if (origin < 0) { const error = new Error(plan.name + '의 등장 위치를 확보하지 못했습니다.'); error.encounterPlacement = true; throw error; }
    const x = origin % SIZE, y = Math.floor(origin / SIZE);
    if (burrowType) home = burrows.find(burrow => burrow.entrance.x === x && burrow.entrance.y === y);
    if (home && plan.unique) home.creature = { key:plan.key, name:plan.name, group:plan.group, unique:true };
    stamp++;
    let end = 1; queue[0] = origin; visited[origin] = stamp; distance[origin] = 0; parent[origin] = -1;
    let destination = origin;
    const limit = plan.routeLength || plan.radius;
    for (let cursor = 0; cursor < end; cursor++) {
      const index = queue[cursor];
      if (plan.routeLength && plan.terrains.includes(terrain[index]) && distance[index] > distance[destination]) destination = index;
      if (distance[index] === limit) continue;
      for (const next of adjacent(index)) {
        if (visited[next] === stamp || !allowed(next)) continue;
        visited[next] = stamp; distance[next] = distance[index] + 1; parent[next] = index; queue[end++] = next;
      }
    }
    const route = [];
    if (plan.routeLength) {
      for (let index = destination; index >= 0; index = parent[index]) route.push(index);
      route.reverse(); stamp++; end = route.length;
      for (let index = 0; index < route.length; index++) { queue[index] = route[index]; visited[route[index]] = stamp; distance[route[index]] = 0; }
      for (let cursor = 0; cursor < end; cursor++) {
        const index = queue[cursor];
        if (distance[index] === plan.radius) continue;
        for (const next of adjacent(index)) {
          if (visited[next] === stamp || !allowed(next)) continue;
          visited[next] = stamp; distance[next] = distance[index] + 1; queue[end++] = next;
        }
      }
    }
    const cells = Array.from(queue.subarray(0, end)), membership = new Set(cells), boundary = [];
    for (const index of cells) {
      const cx = index % SIZE, cy = Math.floor(index / SIZE);
      if (cy === 0 || !membership.has(index - SIZE)) boundary.push([cx, cy, cx + 1, cy]);
      if (cy === SIZE - 1 || !membership.has(index + SIZE)) boundary.push([cx, cy + 1, cx + 1, cy + 1]);
      if (cx === 0 || !membership.has(index - 1)) boundary.push([cx, cy, cx, cy + 1]);
      if (cx === SIZE - 1 || !membership.has(index + 1)) boundary.push([cx + 1, cy, cx + 1, cy + 1]);
    }
    encounters.push({ ...plan, x, y, cells, boundary, route, homeId:home?.id || null });
    onProgress(.65 + .25 * (order + 1) / ENCOUNTER_PLANS.length);
  }
  if (ecological) encounters = generateWildlife({ seed, terrain, hazards, blocked: travelBlocked, reachable: paths[0],
    nestDistance, waterDistance, resourceCells: occupied }, ENCOUNTER_PLANS);
  const resourcePaths = camps.map(camp => {
    const times = new Int16Array(SIZE * SIZE).fill(-1);
    let end = 0;
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const index = (camp.y + dy) * SIZE + camp.x + dx;
      queue[end++] = index; times[index] = 0;
    }
    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {
      if (times[next] >= 0 || !walkable(next) || travelBlocked[next]) continue;
      times[next] = times[queue[cursor]] + 1; queue[end++] = next;
    }
    return times;
  });
  for (const point of food) {
    const index = point[1] * SIZE + point[0];
    let owner = 0, distance = Infinity;
    for (let camp = 0; camp < camps.length; camp++) {
      const steps = paths[camp][index] >= 0 ? paths[camp][index] : resourcePaths[camp][index];
      if (steps >= 0 && steps < distance) { owner = camp; distance = steps; }
    }
    point[4] = distance; point[5] = camps[owner].id;
  }
  const quantityGrowth = distance => 1 + distance / FORAGING.nearDistance + (distance / (FORAGING.nearDistance * 2)) ** 2;
  const quantity = (point, scale) => Math.max(1, Math.round(scale * quantityGrowth(point[4])));
  function forageSeconds(points, scale) {
    return points.reduce((seconds, point) => {
      const amount = quantity(point, scale), trips = Math.ceil(amount / FORAGING.capacity);
      return seconds + trips * (2 * point[4] / FORAGING.speed + FORAGING.prepareSeconds + FORAGING.unloadSeconds) + amount * FORAGING.harvestSeconds;
    }, 0) / FORAGING.workers;
  }
  const foraging = camps.map(camp => {
    const points = food.filter(point => point[5] === camp.id && point[4] <= FORAGING.nearDistance && point[6]);
    if (points.length < 2) throw new Error('초기 두 개체가 채집할 자연 먹이 지점이 부족합니다.');
    let low = 0, high = 512;
    for (let step = 0; step < 22; step++) {
      const middle = (low + high) / 2;
      if (forageSeconds(points, middle) < FORAGING.seconds) low = middle; else high = middle;
    }
    onProgress(.9 + .05 * camp.id / camps.length);
    return { campId: camp.id, scale: high, points: points.length, amount: points.reduce((sum, point) => sum + quantity(point, high), 0), seconds: forageSeconds(points, high), workers: FORAGING.workers };
  });
  const outerScale = Math.max(...foraging.map(plan => plan.scale));
  for (const point of food) {
    const localScale = foraging[point[5] - 1].scale;
    const blend = Math.min(1, Math.max(0, (point[4] - FORAGING.nearDistance) / 36));
    point[2] = Math.max(1, Math.round(quantity(point, localScale + (outerScale - localScale) * blend) * abundance(point[1] * SIZE + point[0])));
  }

  onProgress(1);
  const world = { seed, size: SIZE, terrain, hazards, food, resources, camps, burrows, encounters, foraging, tribeStarts: TRIBE_STARTS };
  if (version === undefined || version >= 11) populateWorldEconomy(world, { moisture: moistureField, waterDistance, mountainDistance,
    reachable: paths[0], paths, correctStarts: version === undefined || version >= 12, minimumSites: version === undefined || version >= 13 ? 16 : 0,
    minimumTravel: version === undefined || version >= 14 ? 5 : 6, currentHarvest: version === undefined || version >= 15,
    sparseDew: version === undefined || version >= 16 });
  if (ecological) {
    world.resourceAreas = generateResourceAreas(world);
    world.tribeStarts = TRIBE_STARTS.map(tribe => ({ ...tribe, terrainRule: true, resourceRule: true }));
  }
  return world;
}
