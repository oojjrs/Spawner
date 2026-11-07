document.write(
"<div id=\"world-map-preview\">\n" +
"  \n" +
"  <figure class=\"map-figure\">\n" +
"    <div class=\"map-canvas-wrap\"><canvas class=\"map-canvas\" id=\"map-canvas\" role=\"img\" aria-label=\"네 플레이 진영과 자원·굴·지형\"></canvas><progress id=\"map-progress\" max=\"1\" aria-labelledby=\"world-nav\" hidden></progress></div>\n" +
"    <figcaption class=\"map-legend\">\n" +
"      <div class=\"viz-controls\" id=\"map-controls\">\n" +
"        <label class=\"form-label\" for=\"map-seed\">시드<input id=\"map-seed\" type=\"number\" min=\"0\" max=\"4294967295\" step=\"1\" value=\"1\" required></label>\n" +
"        <button class=\"btn-primary\" id=\"map-apply\" type=\"button\">적용</button>\n" +
"        <button id=\"map-prev\" type=\"button\">이전</button>\n" +
"        <button id=\"map-next\" type=\"button\">다음</button>\n" +
"      </div>\n" +
"      <div class=\"map-side-controls\"><button id=\"map-grid\" type=\"button\" aria-pressed=\"false\">80칸 선</button></div>\n" +
"      <table class=\"map-legend-table\" aria-label=\"맵 범례\"><tbody>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"camps\" aria-pressed=\"false\"><span aria-hidden=\"true\">◆</span><span>종족</span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"camps\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"종족 배치 로직\">로직</button></div><div class=\"map-resource-submenu\"><select id=\"map-camp-type\" aria-label=\"종족 종류\"><option value=\"\">전체 종족</option><option value=\"camp-1\">새싹콩</option><option value=\"camp-2\">포자버섯</option><option value=\"camp-3\">몽돌</option><option value=\"camp-4\">샘방울</option></select></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"resources\" aria-pressed=\"false\"><span aria-hidden=\"true\"><i class=\"map-swatch\" style=\"--swatch:#d4bc7d\"></i></span><span>자원</span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"resources\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"자원 배치 로직\">로직</button></div><div class=\"map-resource-submenu\"><select id=\"map-resource-type\" aria-label=\"자원 종류\"><option value=\"\">전체 자원</option></select><div class=\"map-color-key\" id=\"map-resource-key\"></div></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"water\" aria-pressed=\"false\"><span aria-hidden=\"true\"><i class=\"map-swatch\" style=\"--swatch:#263f50\"></i></span><span>물</span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"water\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"물 배치 로직\">로직</button></div><div class=\"map-resource-submenu\"><select id=\"map-water-type\" aria-label=\"강·호수·여울\"><option value=\"\">물</option><option value=\"river\">강</option><option value=\"lake\">호수</option><option value=\"ford\">여울</option></select><div class=\"map-color-key\" id=\"map-water-key\"><span><i class=\"map-swatch\" style=\"--swatch:#4cacc0\"></i>강</span><span><i class=\"map-swatch\" style=\"--swatch:#416d9a\"></i>호수</span><span><i class=\"map-swatch\" style=\"--swatch:#edce8c\"></i>여울</span></div></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"swamp\" aria-pressed=\"false\"><span aria-hidden=\"true\"><i class=\"map-swatch\" style=\"--swatch:#56562b\"></i></span><span>늪</span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"swamp\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"늪 배치 로직\">로직</button></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"forest\" aria-pressed=\"false\"><span aria-hidden=\"true\"><i class=\"map-swatch\" style=\"--swatch:#34271e\"></i></span><span>숲</span></button></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"mountains\" aria-pressed=\"false\"><span aria-hidden=\"true\"><i class=\"map-swatch\" style=\"--swatch:#263029\"></i></span><span>산지</span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"mountains\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"산지 배치 로직\">로직</button></div></td></tr>\n" +
"        <tr><td><div class=\"map-legend-entry\"><button class=\"map-legend-button\" type=\"button\" data-layer=\"units\" aria-pressed=\"false\"><span aria-hidden=\"true\">◎</span><span>유닛 등장 <span id=\"map-unit-count\"></span></span></button><button class=\"map-logic-button\" type=\"button\" data-logic=\"units\" aria-expanded=\"false\" aria-controls=\"map-logic\" aria-label=\"유닛 등장 배치 로직\">로직</button></div><div class=\"map-resource-submenu\"><select id=\"map-unit-type\" aria-label=\"유닛 종류\"><option value=\"\">전체 유닛</option><option value=\"burrow-small\">작은 굴</option><option value=\"burrow-large\">큰 굴</option></select></div></td></tr>\n" +
"      </tbody></table>\n" +
"    </figcaption>\n" +
"    <aside class=\"map-logic\" id=\"map-logic\" aria-label=\"배치 로직 설명\" hidden><span class=\"map-logic-current\">현재 미리보기</span><h3 id=\"map-logic-title\"></h3><div id=\"map-logic-body\"></div></aside>\n" +
"  </figure>\n" +
"  <table class=\"map-legend-table\" id=\"conquest-rules\" style=\"word-break:keep-all\"><colgroup><col style=\"width:92px\"><col></colgroup><tbody><tr><th>새싹콩</th><td>0–120초 · 중립 ≈300초 · 종족 420초+ · 정찰 &lt;420초</td></tr><tr><th>둥지</th><td>Lv.2 80P · Lv.3 200P · Lv.4 500P · AI ≥1200초</td></tr><tr><th>일꾼:군사</th><td>80:20 → 30:70 · 30–40 · 60–70</td></tr></tbody></table>\n" +
"\n" +
"  <template id=\"map-mountain-textures\"><div class=\"map-mountain-textures\">\n" +
"    <figure><a href=\"DesignAssets/Terrain/low-mountain-ground.png\" style=\"--terrain-color:#263029\"><img alt=\"낮은 산 바닥\" width=\"1024\" height=\"1024\" data-original-src=\"DesignAssets/Terrain/low-mountain-ground.png\" data-src=\"DesignAssets/Planning/Thumbnails/Terrain/low-mountain-ground.png.webp\" decoding=\"async\"></a><figcaption>낮은 산<small>low-mountain-ground.png</small></figcaption></figure>\n" +
"    <figure><a href=\"DesignAssets/Terrain/high-mountain-ground.png\" style=\"--terrain-color:#374139\"><img alt=\"높은 산 바닥\" width=\"1024\" height=\"1024\" data-original-src=\"DesignAssets/Terrain/high-mountain-ground.png\" data-src=\"DesignAssets/Planning/Thumbnails/Terrain/high-mountain-ground.png.webp\" decoding=\"async\"></a><figcaption>높은 산<small>high-mountain-ground.png</small></figcaption></figure>\n" +
"    <figure><a href=\"DesignAssets/Terrain/ridge-ground.png\" style=\"--terrain-color:#4b554c\"><img alt=\"능선 바닥\" width=\"1024\" height=\"1024\" data-original-src=\"DesignAssets/Terrain/ridge-ground.png\" data-src=\"DesignAssets/Planning/Thumbnails/Terrain/ridge-ground.png.webp\" decoding=\"async\"></a><figcaption>능선<small>ridge-ground.png</small></figcaption></figure>\n" +
"  </div></template>\n" +
"  <script id=\"design-world-model\" type=\"text/plain\">\n" +
"(() => {\n" +
"const modules = Object.create(null);\n" +
"modules[\"server/resource-legacy.mjs\"] = (() => {\n" +
"const LEGACY_FOOD_HABITATS = Object.freeze([\n" +
"  [\"honey-mushrooms\", [\"forest\"], []],\n" +
"  [\"tree-fruit\", [\"forest\"], []],\n" +
"  [\"berry-bush\", [\"grassland\"], [\"forest\"]],\n" +
"  [\"seed-pods\", [\"land\", \"grassland\"], []],\n" +
"  [\"root-bulbs\", [\"grassland\"], []],\n" +
"  [\"nutrient-moss\", [\"forest\"], []]\n" +
"].map(([key, terrains, neighbors]) => Object.freeze({\n" +
"  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)\n" +
"})));\n" +
"\n" +
"const LEGACY_RESOURCE_HABITATS = Object.freeze([\n" +
"  {\"key\":\"twigs\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"common\",\"minDistance\":4,\"nodes\":48,\"separation\":6},\n" +
"  {\"key\":\"bark\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"uncommon\",\"minDistance\":24,\"nodes\":20,\"separation\":8},\n" +
"  {\"key\":\"pebbles\",\"terrains\":[\"coast\",\"land\",\"lowMountain\"],\"neighbors\":[],\"rarity\":\"common\",\"minDistance\":4,\"nodes\":36,\"separation\":7},\n" +
"  {\"key\":\"clay\",\"terrains\":[\"coast\",\"grassland\"],\"neighbors\":[\"deep\",\"shallow\",\"coast\"],\"rarity\":\"uncommon\",\"minDistance\":24,\"nodes\":20,\"separation\":8},\n" +
"  {\"key\":\"spider-silk\",\"terrains\":[\"forest\",\"lowMountain\"],\"neighbors\":[],\"rarity\":\"uncommon\",\"minDistance\":30,\"nodes\":12,\"separation\":10},\n" +
"  {\"key\":\"water\",\"terrains\":[\"coast\"],\"neighbors\":[\"deep\",\"shallow\"],\"rarity\":\"common\",\"minDistance\":4,\"nodes\":24,\"separation\":8},\n" +
"  {\"key\":\"tree-sap\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"uncommon\",\"minDistance\":28,\"nodes\":16,\"separation\":10},\n" +
"  {\"key\":\"leaf-mold\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"uncommon\",\"minDistance\":24,\"nodes\":20,\"separation\":8},\n" +
"  {\"key\":\"resin\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"rare\",\"minDistance\":42,\"nodes\":10,\"separation\":8},\n" +
"  {\"key\":\"beeswax\",\"terrains\":[\"forest\"],\"neighbors\":[],\"rarity\":\"rare\",\"minDistance\":42,\"nodes\":6,\"separation\":10},\n" +
"  {\"key\":\"carapace\",\"terrains\":[\"grassland\",\"forest\",\"lowMountain\"],\"neighbors\":[],\"rarity\":\"uncommon\",\"minDistance\":30,\"nodes\":12,\"separation\":11},\n" +
"]);\n" +
"\n" +
"return { LEGACY_FOOD_HABITATS, LEGACY_RESOURCE_HABITATS };\n" +
"})();\n" +
"modules[\"server/world-size.mjs\"] = (() => {\n" +
"const WORLD_SIZE = 160;\n" +
"\n" +
"function worldSize(world) {\n" +
"  return world?.size || Math.sqrt(world?.terrain?.length || world?.hazards?.length || 320 * 320);\n" +
"}\n" +
"\n" +
"return { WORLD_SIZE, worldSize };\n" +
"})();\n" +
"modules[\"server/placement-maps.mjs\"] = (() => {\n" +
"function initializePlacementMaps(owner, enabled) {\n" +
"  if (enabled) Object.defineProperty(owner, \"placementMaps\", { value: [] });\n" +
"}\n" +
"\n" +
"function recordPlacementMap(owner, id, layers, values, details) {\n" +
"  if (!owner?.placementMaps) return;\n" +
"  const stage = details?.stage || (/noise|roughness|:draw$|:priority$|sector-priority/.test(id) ? \"original\" :\n" +
"    /-mask$|:amount$|^camp:starts$|:spawn$|^burrow:(small|large)$|^terrain:mountains$|^hydrology:(shore|water|river|lake|ford)$/.test(id) ? \"final\" : \"intermediate\");\n" +
"  const field = { id, layers, values, stage, ...details };\n" +
"  const index = owner.placementMaps.findIndex(item => item.id === id);\n" +
"  if (index < 0) owner.placementMaps.push(field);\n" +
"  else owner.placementMaps[index] = field;\n" +
"}\n" +
"\n" +
"function placementNoise(owner, id, layers, sample, details) {\n" +
"  recordPlacementMap(owner, id, layers, null, { sample, minimum: -1, maximum: 1, ...details });\n" +
"  return sample;\n" +
"}\n" +
"\n" +
"return { initializePlacementMaps, recordPlacementMap, placementNoise };\n" +
"})();\n" +
"modules[\"server/ecology.mjs\"] = (() => {\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"const HABITATS = {\n" +
"  \"flower-tail-bird\": [[4, 5], 768, false],\n" +
"  \"dew-rabbit\": [[5], 768, false],\n" +
"  \"soil-mole\": [[3, 4], 1024, false],\n" +
"  \"bundle-snail\": [[5, 9], 1024, false],\n" +
"  \"cotton-sheep\": [[4], 768, false],\n" +
"  \"rolling-acorn\": [[5], 768, false],\n" +
"  \"soil-boar\": [[4, 5], 1536, false],\n" +
"  \"bubble-toad\": [[2, 4, 9], 1024, true],\n" +
"  \"vine-turtle\": [[4, 5, 9], 1536, false],\n" +
"  \"shadow-weasel\": [[5], 1536, false],\n" +
"  \"snare-vine\": [[5], 1536, false],\n" +
"  \"talon-owl\": [[5, 6], 1536, false],\n" +
"  \"spiny-back-beetle\": [[3, 4, 5, 6], 768, false],\n" +
"  \"spring-keeper\": [[4, 5], 4096, false],\n" +
"  \"lantern-keeper\": [[5], 4096, false],\n" +
"  \"old-garden-snail\": [[5, 9], 4096, false],\n" +
"  \"walking-forest\": [[5], 4096, false],\n" +
"  \"white-paw\": [[5], 4096, false],\n" +
"  \"spiny-back-leader\": [[3, 4, 5, 6], 4096, false]\n" +
"};\n" +
"\n" +
"function generateWildlife(world, plans) {\n" +
"  const SIZE = Math.sqrt(world.terrain.length);\n" +
"  const occupied = new Set();\n" +
"  return plans.map((plan, order) => {\n" +
"    const [terrains, tilesPerUnit, nearWater] = HABITATS[plan.key];\n" +
"    const cells = [], sectors = new Map();\n" +
"    for (let index = 0; index < world.terrain.length; index++) {\n" +
"      const forest = world.hydrology?.forestMask?.[index];\n" +
"      if (!(terrains.includes(world.terrain[index]) || forest && terrains.includes(5)) || world.hazards[index] || world.blocked[index] ||\n" +
"          world.reachable[index] < 0 || world.nestDistance[index] < plan.safeRadius ||\n" +
"          nearWater && world.waterDistance[index] > 6) continue;\n" +
"      cells.push(index);\n" +
"      if (world.resourceCells.has(index) && !(world.generationVersion >= 23 && (world.terrain[index] === 5 || forest)) || occupied.has(index)) continue;\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE), sector = Math.floor(y / 16) * Math.ceil(SIZE / 16) + Math.floor(x / 16);\n" +
"      const priority = wildlifeHash(index, world.seed + order * 7919);\n" +
"      if (!sectors.has(sector) || priority < sectors.get(sector).priority) sectors.set(sector, { index, priority });\n" +
"    }\n" +
"    const candidates = [...sectors.values()].sort((left, right) =>\n" +
"      wildlifeHash(left.index, world.seed + order * 3571 + 17) - wildlifeHash(right.index, world.seed + order * 3571 + 17));\n" +
"    const target = plan.unique && world.generationVersion >= 34 ? 1 : Math.floor(cells.length / tilesPerUnit), spawnPoints = [];\n" +
"    for (const candidate of candidates) {\n" +
"      if (spawnPoints.length >= target) break;\n" +
"      const index = candidate.index;\n" +
"      if (spawnPoints.some(other => Math.hypot(index % SIZE - other % SIZE, Math.floor(index / SIZE) - Math.floor(other / SIZE)) < Math.sqrt(tilesPerUnit) / 3)) continue;\n" +
"      spawnPoints.push(index); occupied.add(index);\n" +
"    }\n" +
"    if (world.hydrology?.placementMaps) {\n" +
"      const habitat = new Uint8Array(world.terrain.length), placement = new Uint8Array(world.terrain.length);\n" +
"      for (const index of cells) habitat[index] = 1;\n" +
"      for (const index of spawnPoints) placement[index] = 1;\n" +
"      recordPlacementMap(world.hydrology, \"unit:\" + plan.key + \":sector-priority\", [\"units\"], null,\n" +
"        { unit: plan.key, minimum: 0, maximum: 4294967295, sample: (x, y) => wildlifeHash(y * SIZE + x, world.seed + order * 7919) });\n" +
"      recordPlacementMap(world.hydrology, \"unit:\" + plan.key + \":priority\", [\"units\"], null,\n" +
"        { unit: plan.key, minimum: 0, maximum: 4294967295, sample: (x, y) => wildlifeHash(y * SIZE + x, world.seed + order * 3571 + 17) });\n" +
"      recordPlacementMap(world.hydrology, \"unit:\" + plan.key + \":habitat\", [\"units\"], habitat, { unit: plan.key, minimum: 0, maximum: 1 });\n" +
"      recordPlacementMap(world.hydrology, \"unit:\" + plan.key + \":spawn\", [\"units\"], placement, { unit: plan.key, minimum: 0, maximum: 1 });\n" +
"    }\n" +
"    const origin = spawnPoints[0] ?? cells[0] ?? 0;\n" +
"    return { ...plan, terrains, nearWater, x: origin % SIZE, y: Math.floor(origin / SIZE), cells,\n" +
"      boundary: [], route: [], homeId: null, spawnPoints, tilesPerUnit, populationLimit: spawnPoints.length,\n" +
"      density: cells.length ? spawnPoints.length / cells.length : 0 };\n" +
"  });\n" +
"}\n" +
"\n" +
"function wildlifeHash(index, seed) {\n" +
"  let value = Math.imul(index ^ seed, 374761393);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return (value ^ (value >>> 16)) >>> 0;\n" +
"}\n" +
"\n" +
"function generateResourceAreas(world) {\n" +
"  const SIZE = Math.sqrt(world.terrain.length);\n" +
"  if (world.economy) {\n" +
"    const areas = { wood: [], dew: [], clay: [], pebbles: [] };\n" +
"    for (const [x, y, amount, key] of world.resources) if (amount > 0 && Object.hasOwn(areas, key === \"tree\" ? \"wood\" : key)) areas[key === \"tree\" ? \"wood\" : key].push(y * world.size + x);\n" +
"    return areas;\n" +
"  }\n" +
"  const wood = [], dew = [], blocked = new Set();\n" +
"  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add((camp.y + dy) * SIZE + camp.x + dx);\n" +
"  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * SIZE + burrow.x + dx);\n" +
"  for (const [x, y] of [...world.food, ...world.resources]) blocked.add(y * SIZE + x);\n" +
"  for (let index = 0; index < world.terrain.length; index++) {\n" +
"    if (world.hazards[index] || blocked.has(index)) continue;\n" +
"    if (world.terrain[index] === 5) wood.push(index);\n" +
"    if (world.terrain[index] === 4) dew.push(index);\n" +
"  }\n" +
"  return { wood, dew };\n" +
"}\n" +
"\n" +
"return { generateWildlife, generateResourceAreas };\n" +
"})();\n" +
"modules[\"server/start-economy.mjs\"] = (() => {\n" +
"function startingTravel(world, camp) {\n" +
"  const size = world.size, limit = 72, costs = new Int16Array(size * size).fill(-1), blocked = new Set();\n" +
"  for (const nest of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) blocked.add((nest.y + dy) * size + nest.x + dx);\n" +
"  }\n" +
"  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * size + burrow.x + dx);\n" +
"  const buckets = Array.from({ length: limit + 1 }, () => []);\n" +
"  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {\n" +
"    const index = (camp.y + dy) * size + camp.x + dx;\n" +
"    costs[index] = 0; buckets[0].push(index);\n" +
"  }\n" +
"  for (let cost = 0; cost <= limit; cost++) for (const index of buckets[cost]) {\n" +
"    if (costs[index] !== cost) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {\n" +
"      const next = ny * size + nx;\n" +
"      if (nx < 0 || ny < 0 || nx >= size || ny >= size || world.terrain[next] < 2 || world.hazards[next] || blocked.has(next)) continue;\n" +
"      const candidate = cost + (world.terrain[next] === 10 ? 6 : world.terrain[next] >= 6 && world.terrain[next] <= 8 ? 5 : 3);\n" +
"      if (candidate > limit || costs[next] >= 0 && costs[next] <= candidate) continue;\n" +
"      costs[next] = candidate; buckets[candidate].push(next);\n" +
"    }\n" +
"  }\n" +
"  return costs;\n" +
"}\n" +
"\n" +
"function measureStartingEconomy(world, policies) {\n" +
"  return world.camps.map((camp, order) => {\n" +
"    const policy = policies[order], travel = startingTravel(world, camp);\n" +
"    const points = world.resources.filter(([x, y, amount, key]) => key === policy.key && amount > 0 && travel[y * world.size + x] >= 0);\n" +
"    const weight = point => Math.exp(-travel[point[1] * world.size + point[0]] / 18);\n" +
"    const near = points.filter(point => travel[point[1] * world.size + point[0]] <= 36);\n" +
"    return { tribe: policy.tribe, key: policy.key, nearestSeconds: points.length ? Math.min(...points.map(point => travel[point[1] * world.size + point[0]])) * 2 / 3 : null,\n" +
"      cells: near.length, amount: near.reduce((sum, point) => sum + point[2], 0),\n" +
"      weightedAmount: points.reduce((sum, point) => sum + point[2] * weight(point), 0),\n" +
"      weightedCells: points.reduce((sum, point) => sum + weight(point), 0) };\n" +
"  });\n" +
"}\n" +
"\n" +
"function correctStartingEconomy(world, policies, points, available, habitat, minimumSites, minimumTravel) {\n" +
"  const size = world.size, targets = [120, 3900, 120, 95], referenceCoverage = [.035, .2, .045, .17];\n" +
"  const before = measureStartingEconomy({ ...world, resources: [...points.values()] }, policies);\n" +
"  const corrections = [];\n" +
"  for (const [order, camp] of world.camps.entries()) {\n" +
"    const policy = policies[order], travel = startingTravel(world, camp), cluster = policy.coverage !== null;\n" +
"    const coverage = [...points.values()].filter(point => point[3] === policy.key).length / (size * size);\n" +
"    const target = targets[order] * Math.max(.95, Math.min(1.05, (referenceCoverage[order] / coverage) ** .25));\n" +
"    const weight = index => travel[index] < 0 ? 0 : Math.exp(-travel[index] / 18);\n" +
"    let moved = 0, changed = 0;\n" +
"    const remote = index => world.camps.every(nest => Math.hypot(index % size - nest.x, Math.floor(index / size) - nest.y) > 32);\n" +
"    function exchange(first, second) {\n" +
"      const left = points.get(first), right = points.get(second);\n" +
"      points.delete(first); points.delete(second);\n" +
"      if (left) points.set(second, [second % size, Math.floor(second / size), left[2], left[3]]);\n" +
"      if (right) points.set(first, [first % size, Math.floor(first / size), right[2], right[3]]);\n" +
"      moved++;\n" +
"    }\n" +
"    function relocate(index) {\n" +
"      const point = points.get(index);\n" +
"      if (!point) return false;\n" +
"      const first = (Math.imul(world.seed ^ index, 2654435761) >>> 0) % (size * size);\n" +
"      for (let offset = 0; offset < size * size; offset++) {\n" +
"        const next = (first + offset) % (size * size), other = points.get(next);\n" +
"        if (!available(next) || !remote(next) || !habitat(point[3], world.terrain[next]) ||\n" +
"            other && (other[3] === point[3] || !habitat(other[3], world.terrain[index]))) continue;\n" +
"        exchange(index, next); return true;\n" +
"      }\n" +
"      return false;\n" +
"    }\n" +
"    function claim(index) {\n" +
"      if (points.get(index)?.[3] === policy.key) return true;\n" +
"      const other = points.get(index);\n" +
"      for (const [source, point] of points) {\n" +
"        if (point[3] !== policy.key || !remote(source) || other && !habitat(other[3], world.terrain[source])) continue;\n" +
"        exchange(source, index); return true;\n" +
"      }\n" +
"      return false;\n" +
"    }\n" +
"    if (cluster) {\n" +
"      const quadrants = Array.from({ length: 4 }, () => []), chosen = new Set();\n" +
"      for (let index = 0; index < travel.length; index++) {\n" +
"        if (travel[index] < minimumTravel || travel[index] > 18 || !available(index) || !habitat(policy.key, world.terrain[index])) continue;\n" +
"        const x = index % size, y = Math.floor(index / size), quadrant = (y >= camp.y ? 2 : 0) + (x >= camp.x ? 1 : 0);\n" +
"        quadrants[quadrant].push(index);\n" +
"      }\n" +
"      for (const quadrant of quadrants) {\n" +
"        quadrant.sort((left, right) => travel[left] - travel[right] || left - right);\n" +
"        for (const index of quadrant.slice(0, 2)) if (claim(index)) chosen.add(index);\n" +
"      }\n" +
"      for (const [index, point] of [...points]) if (point[3] === policy.key && travel[index] >= 0 && travel[index] <= 18 && !chosen.has(index)) relocate(index);\n" +
"      if (minimumSites > 0) {\n" +
"        let count = [...points].filter(([index, point]) => point[3] === policy.key && travel[index] >= 0 && travel[index] <= 36).length;\n" +
"        const approaches = Array.from({ length: 4 }, () => []);\n" +
"        for (let index = 0; index < travel.length; index++) {\n" +
"          if (travel[index] <= 18 || travel[index] > 36 || !available(index) || !habitat(policy.key, world.terrain[index]) || points.get(index)?.[3] === policy.key) continue;\n" +
"          const quadrant = (Math.floor(index / size) >= camp.y ? 2 : 0) + (index % size >= camp.x ? 1 : 0);\n" +
"          approaches[quadrant].push(index);\n" +
"        }\n" +
"        for (const approach of approaches) approach.sort((left, right) => travel[left] - travel[right] || left - right);\n" +
"        for (let round = 0; count < minimumSites; round++) {\n" +
"          let found = false;\n" +
"          for (const approach of approaches) {\n" +
"            const index = approach[round];\n" +
"            if (index === undefined) continue;\n" +
"            found = true;\n" +
"            if (claim(index)) count++;\n" +
"            if (count >= minimumSites) break;\n" +
"          }\n" +
"          if (!found) break;\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"    const local = [...points.entries()].filter(([index, point]) => point[3] === policy.key && travel[index] >= 0 && travel[index] <= 36);\n" +
"    const outer = [...points.entries()].filter(([index, point]) => point[3] === policy.key && travel[index] > 36)\n" +
"      .reduce((sum, [index, point]) => sum + point[2] * weight(index), 0);\n" +
"    const inner = local.reduce((sum, [index, point]) => sum + point[2] * weight(index), 0);\n" +
"    const ratio = (inner + outer) / target;\n" +
"    if (cluster && inner > 0) {\n" +
"      const factor = Math.max(.3, Math.min(3, (target - outer) / inner));\n" +
"      for (const [index, point] of local) {\n" +
"        const expected = Math.max(1, Math.min(30, point[2] * factor));\n" +
"        const fraction = ((Math.imul(index ^ world.seed, 1103515245) >>> 0) % 1000) / 1000;\n" +
"        const amount = Math.floor(expected) + (fraction < expected % 1 ? 1 : 0);\n" +
"        changed += Math.abs(amount - point[2]); point[2] = amount;\n" +
"      }\n" +
"    } else if (!cluster && ratio < (policy.key === \"tree\" ? .6 : .8)) {\n" +
"      let remaining = target * .9 - inner - outer;\n" +
"      local.sort((left, right) => travel[left[0]] - travel[right[0]] || left[0] - right[0]);\n" +
"      for (const [index, point] of local) {\n" +
"        if (remaining <= 0) break;\n" +
"        if (point[2] >= policy.amount * 2) continue;\n" +
"        point[2]++; changed++; remaining -= weight(index);\n" +
"      }\n" +
"    } else if (!cluster && ratio > (policy.key === \"tree\" ? 1.6 : 1.2)) {\n" +
"      let excess = inner + outer - target * 1.1;\n" +
"      local.sort((left, right) => travel[left[0]] - travel[right[0]] || left[0] - right[0]);\n" +
"      for (const [index, point] of local) {\n" +
"        if (excess <= 0) break;\n" +
"        if (travel[index] <= 12) continue;\n" +
"        if (relocate(index)) excess -= point[2] * weight(index);\n" +
"      }\n" +
"    }\n" +
"    corrections.push({ tribe: policy.tribe, targetWeightedAmount: target, movedCells: moved, adjustedAmount: changed });\n" +
"  }\n" +
"  const after = measureStartingEconomy({ ...world, resources: [...points.values()] }, policies);\n" +
"  return after.map((metric, order) => ({ ...metric, before: before[order], ...corrections[order] }));\n" +
"}\n" +
"\n" +
"return { startingTravel, measureStartingEconomy, correctStartingEconomy };\n" +
"})();\n" +
"modules[\"server/economy.mjs\"] = (() => {\n" +
"const { correctStartingEconomy, measureStartingEconomy } = modules[\"server/start-economy.mjs\"];\n" +
"\n" +
"const RESOURCE_ECONOMY = Object.freeze([\n" +
"  { tribe: \"bean\", key: \"clay\", coverage: .035, amount: 12, harvestSeconds: 4 },\n" +
"  { tribe: \"spore\", key: \"tree\", coverage: null, amount: 30, harvestSeconds: 6 },\n" +
"  { tribe: \"pebble\", key: \"pebbles\", coverage: .045, amount: 12, harvestSeconds: 6 },\n" +
"  { tribe: \"spring\", key: \"dew\", coverage: null, amount: 1, harvestSeconds: 2 }\n" +
"].map(entry => Object.freeze(entry)));\n" +
"\n" +
"function populateWorldEconomy(world, fields) {\n" +
"  const size = world.size, primary = new Set(RESOURCE_ECONOMY.map(entry => entry.key));\n" +
"  world.food = world.food.filter(point => !primary.has(point[3]));\n" +
"  world.resources = world.resources.filter(point => !primary.has(point[3]));\n" +
"  const blocked = new Set([...world.food, ...world.resources].map(([x, y]) => y * size + x));\n" +
"  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked.add((camp.y + dy) * size + camp.x + dx);\n" +
"  for (const burrow of world.burrows) for (let dy = -1; dy <= burrow.height; dy++) for (let dx = -1; dx <= burrow.width; dx++) blocked.add((burrow.y + dy) * size + burrow.x + dx);\n" +
"  for (const plan of world.encounters) for (const index of plan.spawnPoints || []) blocked.add(index);\n" +
"  const available = index => !blocked.has(index) && !world.hazards[index];\n" +
"  const added = new Map();\n" +
"  function place(index, policy) {\n" +
"    if (!available(index) || added.has(index)) return;\n" +
"    const amount = policy.amount;\n" +
"    added.set(index, [index % size, Math.floor(index / size), amount, policy.key]);\n" +
"  }\n" +
"  for (const policy of RESOURCE_ECONOMY.filter(entry => entry.coverage !== null)) {\n" +
"    const sectors = new Map();\n" +
"    let candidates = 0;\n" +
"    for (let index = 0; index < world.terrain.length; index++) {\n" +
"      const terrain = world.terrain[index];\n" +
"      if (!available(index) || added.has(index) || !isEconomyHabitat(policy.key, terrain)) continue;\n" +
"      const x = index % size, y = Math.floor(index / size), sector = Math.floor(y / 32) * 10 + Math.floor(x / 32);\n" +
"      const water = fields.waterDistance[index] <= 6, mountain = fields.mountainDistance[index] <= 6;\n" +
"      const weight = policy.key === \"clay\" ? 1 + Math.max(0, fields.moisture[index]) * 3 + (water || terrain === 9 ? 2 : 0) :\n" +
"        1 + (water ? 2 : 0) + (mountain ? 2 : 0) + (water && mountain ? 3 : 0);\n" +
"      const patch = economyHash(Math.floor(x / 4), Math.floor(y / 4), world.seed + 701) * .8 + economyHash(x, y, world.seed + 709) * .2;\n" +
"      if (!sectors.has(sector)) sectors.set(sector, []);\n" +
"      sectors.get(sector).push({ index, priority: patch / weight }); candidates++;\n" +
"    }\n" +
"    const target = Math.min(candidates, Math.round(size * size * policy.coverage));\n" +
"    let allocated = 0, cumulative = 0;\n" +
"    for (const points of sectors.values()) {\n" +
"      cumulative += points.length;\n" +
"      const quota = Math.round(target * cumulative / candidates) - allocated;\n" +
"      allocated += quota;\n" +
"      points.sort((left, right) => left.priority - right.priority || left.index - right.index);\n" +
"      for (const point of points.slice(0, quota)) place(point.index, policy);\n" +
"    }\n" +
"  }\n" +
"  for (const policy of RESOURCE_ECONOMY.filter(entry => entry.coverage === null)) {\n" +
"    const terrain = policy.key === \"tree\" ? 5 : 4;\n" +
"    for (let index = 0; index < world.terrain.length; index++) if (world.terrain[index] === terrain) place(index, policy);\n" +
"  }\n" +
"  for (const [order, camp] of world.camps.entries()) {\n" +
"    const policy = RESOURCE_ECONOMY[order], candidates = [];\n" +
"    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {\n" +
"      const index = (camp.y + dy) * size + camp.x + dx, terrain = world.terrain[index];\n" +
"      if (Math.max(Math.abs(dx), Math.abs(dy)) < 4 || !available(index) ||\n" +
"          !(policy.key === \"clay\" ? [3, 4, 5, 9].includes(terrain) : policy.key === \"pebbles\" ? [2, 3, 4, 6].includes(terrain) : terrain === (policy.key === \"tree\" ? 5 : 4))) continue;\n" +
"      candidates.push({ index, distance: fields.paths[order][index] });\n" +
"    }\n" +
"    candidates.sort((left, right) => left.distance - right.distance || left.index - right.index);\n" +
"    for (const point of candidates.filter(point => point.distance >= 0).slice(0, 4)) {\n" +
"      added.delete(point.index); place(point.index, policy);\n" +
"    }\n" +
"  }\n" +
"  const starts = fields.correctStarts ? correctStartingEconomy(world, RESOURCE_ECONOMY, added, available, isEconomyHabitat, fields.minimumSites, fields.minimumTravel) : null;\n" +
"  if (fields.sparseDew) thinStartingDew(world, added);\n" +
"  world.resources.push(...added.values());\n" +
"  world.foraging = [];\n" +
"  world.economy = { seconds: 300, workers: 2, resources: RESOURCE_ECONOMY.map(policy => {\n" +
"    const points = [...added.values()].filter(point => point[3] === policy.key);\n" +
"    return { ...policy,\n" +
"      cells: points.length, coverage: points.length / (size * size),\n" +
"      amount: points.reduce((sum, point) => sum + point[2], 0), sectors: new Set(points.map(([x, y]) => Math.floor(y / 32) * 10 + Math.floor(x / 32))).size };\n" +
"  }), starts: starts || measureStartingEconomy(world, RESOURCE_ECONOMY) };\n" +
"}\n" +
"\n" +
"function thinStartingDew(world, points) {\n" +
"  for (const camp of world.camps) {\n" +
"    if (camp.tribe === \"spring\") continue;\n" +
"    const local = [...points.entries()].filter(([, point]) => point[3] === \"dew\" && Math.hypot(point[0] - camp.x, point[1] - camp.y) < 32);\n" +
"    const priority = point => economyHash(point[0], point[1], world.seed + 733);\n" +
"    local.sort((left, right) => priority(left[1]) - priority(right[1]) || left[0] - right[0]);\n" +
"    let retained = false;\n" +
"    for (const [index, point] of local) {\n" +
"      const distance = Math.hypot(point[0] - camp.x, point[1] - camp.y);\n" +
"      if (distance <= 22 && !retained) { retained = true; continue; }\n" +
"      const density = .2 + .8 * Math.max(0, (distance - 22) / 10);\n" +
"      if (priority(point) >= density) points.delete(index);\n" +
"    }\n" +
"  }\n" +
"}\n" +
"\n" +
"function economyHash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function isEconomyHabitat(key, terrain) {\n" +
"  if (key === \"clay\") return [3, 4, 5, 9].includes(terrain);\n" +
"  if (key === \"pebbles\") return [2, 3, 4, 6].includes(terrain);\n" +
"  return terrain === (key === \"tree\" ? 5 : 4);\n" +
"}\n" +
"\n" +
"return { RESOURCE_ECONOMY, populateWorldEconomy, isEconomyHabitat };\n" +
"})();\n" +
"modules[\"server/landscape-processes.mjs\"] = (() => {\n" +
"const { initializePlacementMaps, recordPlacementMap, placementNoise } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"function quantizeLandscapeValue(value) { return Math.round(value * 1000000) / 1000000; }\n" +
"\n" +
"function landscapeHash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function latticeNoise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((landscapeHash(ix, iy, seed) * (1 - tx) + landscapeHash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (landscapeHash(ix, iy + 1, seed) * (1 - tx) + landscapeHash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function landscapeNoise(x, y, scale, seed) {\n" +
"  return latticeNoise(x, y, scale, seed) * .5 + latticeNoise(x, y, scale * .43, seed + 997) * .27 +\n" +
"    latticeNoise(x, y, scale * .18, seed + 1999) * .16 + latticeNoise(x, y, scale * .075, seed + 2999) * .07;\n" +
"}\n" +
"\n" +
"function createContinentalFoundation(size, seed, enabled) {\n" +
"  const result = { basement: new Float32Array(size * size), bedrock: new Float32Array(size * size) }; initializePlacementMaps(result, enabled);\n" +
"  const roughness = placementNoise(result, \"terrain:roughness\", [\"mountains\", \"water\", \"forest\", \"swamp\", \"resources\"],\n" +
"    (x, y) => landscapeNoise(x, y, size * .4, seed + 4001), { stage: \"original\" });\n" +
"  const geology = placementNoise(result, \"geology:bedrock-noise\", [\"mountains\", \"water\", \"forest\", \"swamp\", \"resources\"],\n" +
"    (x, y) => landscapeNoise(x, y, 95, seed + 17011), { stage: \"original\" });\n" +
"  const direction = landscapeHash(0, 0, seed + 2707) * Math.PI * 2, cosine = Math.cos(direction), sine = Math.sin(direction);\n" +
"  const center = { x: size * (.46 + landscapeHash(0, 0, seed + 4013) * .08), y: size * (.46 + landscapeHash(0, 0, seed + 4019) * .08) };\n" +
"  const blocks = [{ x: center.x, y: center.y, along: size * .37, across: size * .30, angle: direction, height: .55 }];\n" +
"  for (let order = 0; order < 3; order++) {\n" +
"    const along = (order - 1) * size * (.17 + landscapeHash(order, 0, seed + 4021) * .05);\n" +
"    const across = (landscapeHash(order, 0, seed + 4027) - .5) * size * .3;\n" +
"    blocks.push({ x: center.x + cosine * along - sine * across, y: center.y + sine * along + cosine * across,\n" +
"      along: size * (.18 + landscapeHash(order, 0, seed + 4049) * .12), across: size * (.16 + landscapeHash(order, 0, seed + 4051) * .12),\n" +
"      angle: direction + (landscapeHash(order, 0, seed + 4057) - .5) * 1.8, height: .29 + landscapeHash(order, 0, seed + 4073) * .08 });\n" +
"  }\n" +
"  const depressions = Array.from({ length: 3 }, (_, order) => ({ x: size * (.2 + landscapeHash(order, 0, seed + 4079) * .6),\n" +
"    y: size * (.2 + landscapeHash(order, 0, seed + 4091) * .6), radius: 12 + landscapeHash(order, 0, seed + 4093) * 20,\n" +
"    depth: .045 + landscapeHash(order, 0, seed + 4099) * .075 }));\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    let base = 0, secondary = 0;\n" +
"    for (const [order, block] of blocks.entries()) {\n" +
"      const dx = x - block.x, dy = y - block.y, a = dx * Math.cos(block.angle) + dy * Math.sin(block.angle), b = -dx * Math.sin(block.angle) + dy * Math.cos(block.angle);\n" +
"      const elevation = block.height * Math.exp(-(a * a / (block.along * block.along) + b * b / (block.across * block.across)) * .9);\n" +
"      if (!order) base = elevation; else secondary = Math.max(secondary, elevation);\n" +
"    }\n" +
"    let depression = 0;\n" +
"    for (const basin of depressions) depression += basin.depth * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));\n" +
"    const edge = Math.min(x, y, size - 1 - x, size - 1 - y);\n" +
"    result.bedrock[y * size + x] = .5 + geology(x, y) * .5;\n" +
"    result.basement[y * size + x] = quantizeLandscapeValue(-.20 + base + secondary * .8 + roughness(x, y) * .09 - depression - 1.4 * Math.exp(-edge / 8));\n" +
"  }\n" +
"  result.roughness = roughness; result.direction = direction; result.seaLevel = .07;\n" +
"  recordPlacementMap(result, \"terrain:basement\", [\"mountains\", \"water\"], result.basement, { stage: \"intermediate\" });\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function createTerrainRainfall(height, size, seaLevel, angle) {\n" +
"  const rainfall = new Float64Array(height.length), humidity = new Float32Array(height.length);\n" +
"  const sx = Math.cos(angle) >= 0 ? 1 : -1, sy = Math.sin(angle) >= 0 ? 1 : -1;\n" +
"  const weightX = Math.abs(Math.cos(angle)) / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));\n" +
"  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {\n" +
"    const x = sx > 0 ? column : size - 1 - column, y = sy > 0 ? row : size - 1 - row, index = y * size + x;\n" +
"    if (height[index] <= seaLevel) { humidity[index] = 1; rainfall[index] = .7; continue; }\n" +
"    const previousX = column ? index - sx : -1, previousY = row ? index - sy * size : -1;\n" +
"    const incoming = (previousX >= 0 ? humidity[previousX] : 1) * weightX + (previousY >= 0 ? humidity[previousY] : 1) * (1 - weightX);\n" +
"    const previousHeight = (previousX >= 0 ? height[previousX] : seaLevel) * weightX + (previousY >= 0 ? height[previousY] : seaLevel) * (1 - weightX);\n" +
"    const rise = height[index] - previousHeight;\n" +
"    rainfall[index] = quantizeLandscapeValue(Math.max(.2, Math.min(1.7, .4 + incoming * .48 + Math.max(0, rise) * 5 + Math.min(0, rise) * 1.1)));\n" +
"    humidity[index] = quantizeLandscapeValue(Math.max(.08, incoming - Math.max(0, rise) * .7 - .0015));\n" +
"  }\n" +
"  return { rainfall, humidity };\n" +
"}\n" +
"\n" +
"function createHillslopeFlow(height, rainfall, size, seaLevel, water) {\n" +
"  const flow = new Float64Array(rainfall);\n" +
"  const order = Array.from({ length: flow.length }, (_, index) => index).sort((left, right) => height[right] - height[left] || left - right);\n" +
"  const receivers = new Int32Array(8), weights = new Float64Array(8);\n" +
"  for (const index of order) {\n" +
"    if (height[index] <= seaLevel || water?.[index]) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    let count = 0, total = 0;\n" +
"    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;\n" +
"      const next = (y + dy) * size + x + dx, drop = height[index] - height[next];\n" +
"      if (drop <= 0) continue;\n" +
"      const weight = Math.pow(drop / Math.hypot(dx, dy), 1.1);\n" +
"      receivers[count] = next; weights[count++] = weight; total += weight;\n" +
"    }\n" +
"    for (let receiver = 0; receiver < count; receiver++) flow[receivers[receiver]] += flow[index] * weights[receiver] / total;\n" +
"  }\n" +
"  return flow;\n" +
"}\n" +
"\n" +
"function erodeLandscapeHeight(height, rainfall, size, foundation) {\n" +
"  const flow = createHillslopeFlow(height, rainfall, size, foundation.seaLevel, undefined), result = new Float64Array(height);\n" +
"  for (let index = 0; index < height.length; index++) {\n" +
"    if (height[index] <= foundation.seaLevel) continue;\n" +
"    const x = index % size, y = Math.floor(index / size), raised = height[index] + foundation.uplift[index] * .0008;\n" +
"    let total = 0, base = 0, distanceSum = 0;\n" +
"    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;\n" +
"      const next = (y + dy) * size + x + dx, drop = height[index] - height[next];\n" +
"      if (drop <= 0) continue;\n" +
"      const distance = Math.hypot(dx, dy), weight = Math.pow(drop / distance, 1.1);\n" +
"      total += weight; base += Math.max(foundation.seaLevel, height[next]) * weight; distanceSum += distance * weight;\n" +
"    }\n" +
"    const incision = total ? .02 * Math.sqrt(flow[index]) / (distanceSum / total) * (1.35 - foundation.bedrock[index] * .7) : 0;\n" +
"    result[index] = quantizeLandscapeValue((raised + incision * (total ? base / total : raised)) / (1 + incision));\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"return { quantizeLandscapeValue, landscapeHash, landscapeNoise, createContinentalFoundation, createTerrainRainfall, createHillslopeFlow, erodeLandscapeHeight };\n" +
"})();\n" +
"modules[\"server/river-channels.mjs\"] = (() => {\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"function spline(before, start, end, after, t) {\n" +
"  const t2 = t * t, t3 = t2 * t;\n" +
"  const coordinate = key => .5 * (2 * start[key] + (-before[key] + end[key]) * t +\n" +
"    (2 * before[key] - 5 * start[key] + 4 * end[key] - after[key]) * t2 +\n" +
"    (-before[key] + 3 * start[key] - 3 * end[key] + after[key]) * t3);\n" +
"  return { x: coordinate(\"x\"), y: coordinate(\"y\") };\n" +
"}\n" +
"\n" +
"function curve(path, drainage, basin, size, seed) {\n" +
"  const controls = [], last = path.length - 1, distance = new Float32Array(path.length);\n" +
"  for (let step = 1; step < path.length; step++) distance[step] = distance[step - 1] +\n" +
"    Math.hypot(path[step] % size - path[step - 1] % size, Math.floor(path[step] / size) - Math.floor(path[step - 1] / size));\n" +
"  const phase = (Math.imul(path[0] ^ seed, 2654435761) >>> 0) / 4294967296 * Math.PI * 2;\n" +
"  for (let step = 0; step <= last; step = Math.min(last, step + 5)) {\n" +
"    const index = path[step], previous = path[Math.max(0, step - 3)], next = path[Math.min(last, step + 3)];\n" +
"    const dx = next % size - previous % size, dy = Math.floor(next / size) - Math.floor(previous / size), reach = Math.hypot(dx, dy) || 1;\n" +
"    const slope = Math.max(0, drainage.level[previous] - drainage.level[next]) / reach;\n" +
"    const wavelength = 18 + Math.log1p(drainage.flow[index]) * 1.4;\n" +
"    const amplitude = Math.min(5, 1.6 + Math.log1p(drainage.flow[index] / 80)) / (1 + slope * 65);\n" +
"    const taper = Math.min(1, distance[step] / 8, (distance[last] - distance[step]) / 8);\n" +
"    const sway = (Math.sin(distance[step] * Math.PI * 2 / wavelength + phase) * .7 +\n" +
"      Math.sin(distance[step] * Math.PI * 2 / (wavelength * 1.83) + phase * 1.37) * .3) * amplitude * taper;\n" +
"    const origin = { x: index % size + .5, y: Math.floor(index / size) + .5 };\n" +
"    let offset = sway, point;\n" +
"    for (let attempt = 0; attempt < 7; attempt++) {\n" +
"      point = { x: origin.x - dy / reach * offset, y: origin.y + dx / reach * offset, step };\n" +
"      const cell = Math.floor(point.y) * size + Math.floor(point.x);\n" +
"      if (point.x >= .5 && point.y >= .5 && point.x <= size - .5 && point.y <= size - .5 &&\n" +
"          basin[cell] === basin[index] && drainage.level[cell] <= drainage.level[index] + .035) break;\n" +
"      offset *= .5;\n" +
"    }\n" +
"    controls.push(point);\n" +
"    if (step === last) break;\n" +
"  }\n" +
"  const points = [];\n" +
"  for (let segment = 0; segment < controls.length - 1; segment++) {\n" +
"    const before = controls[Math.max(0, segment - 1)], start = controls[segment], end = controls[segment + 1];\n" +
"    let downstream = drainage.parent[path[last]];\n" +
"    for (let step = 0; step < 2 && downstream >= 0 && drainage.parent[downstream] >= 0; step++) downstream = drainage.parent[downstream];\n" +
"    const tail = downstream >= 0 ? {x: downstream % size + .5, y: Math.floor(downstream / size) + .5} : end;\n" +
"    const after = segment + 2 < controls.length ? controls[segment + 2] : tail;\n" +
"    const samples = Math.max(2, Math.ceil(Math.max(Math.hypot(end.x - start.x, end.y - start.y), distance[end.step] - distance[start.step]) * 4));\n" +
"    for (let sample = segment ? 1 : 0; sample <= samples; sample++) {\n" +
"      const t = sample / samples, step = start.step + (end.step - start.step) * t, first = Math.floor(step), fraction = step - first;\n" +
"      const a = path[first], b = path[Math.min(last, first + 1)];\n" +
"      const origin = { x: (a % size) * (1 - fraction) + (b % size) * fraction + .5,\n" +
"        y: Math.floor(a / size) * (1 - fraction) + Math.floor(b / size) * fraction + .5 };\n" +
"      const surface = drainage.level[a] * (1 - fraction) + drainage.level[b] * fraction;\n" +
"      let point = spline(before, start, end, after, t), blend = 1;\n" +
"      for (let attempt = 0; attempt < 8; attempt++) {\n" +
"        const index = Math.floor(point.y) * size + Math.floor(point.x);\n" +
"        if (point.x >= .5 && point.y >= .5 && point.x <= size - .5 && point.y <= size - .5 &&\n" +
"            basin[index] === basin[a] && drainage.level[index] <= surface + .04) break;\n" +
"        blend *= .5;\n" +
"        const proposed = spline(before, start, end, after, t);\n" +
"        point = { x: origin.x + (proposed.x - origin.x) * blend, y: origin.y + (proposed.y - origin.y) * blend };\n" +
"      }\n" +
"      const current = { x: point.x, y: point.y, surface,\n" +
"        flow: drainage.flow[a] * (1 - fraction) + drainage.flow[b] * fraction,\n" +
"        sediment: drainage.sediment[a] * (1 - fraction) + drainage.sediment[b] * fraction, radius: 0 };\n" +
"      const previous = points.at(-1);\n" +
"      const intervals = previous ? Math.max(1, Math.ceil(Math.hypot(current.x - previous.x, current.y - previous.y) / .3)) : 1;\n" +
"      for (let interval = 1; interval <= intervals; interval++) {\n" +
"        const blend = interval / intervals;\n" +
"        points.push(previous ? {x: previous.x + (current.x - previous.x) * blend, y: previous.y + (current.y - previous.y) * blend,\n" +
"          surface: previous.surface + (current.surface - previous.surface) * blend, flow: previous.flow + (current.flow - previous.flow) * blend,\n" +
"          sediment: previous.sediment + (current.sediment - previous.sediment) * blend, radius: 0} : current);\n" +
"      }\n" +
"    }\n" +
"  }\n" +
"  return points;\n" +
"}\n" +
"\n" +
"function createRiverChannels(drainage, size, seed, waterBudget, terrainDriven, landscape) {\n" +
"  const mature = terrainDriven >= 27;\n" +
"  const sparse = terrainDriven >= 28;\n" +
"  const mountainFed = terrainDriven >= 29;\n" +
"  const coastalBasins = terrainDriven >= 30;\n" +
"  const length = drainage.level.length, basin = new Int32Array(length), distance = new Float32Array(length), childFlow = new Float64Array(length);\n" +
"  const sources = new Int32Array(length).fill(-1), sourceScore = new Float32Array(length).fill(-Infinity);\n" +
"  if (mountainFed) for (let cursor = drainage.order.length - 1; cursor >= 0; cursor--) {\n" +
"    const index = drainage.order[cursor], next = drainage.parent[index];\n" +
"    const relief = Math.max(0, landscape.height[index] - landscape.basement[index]);\n" +
"    if (drainage.flow[index] >= (terrainDriven >= 31 ? 8 : 24) && drainage.flow[index] <= 300 && relief >= .065 && drainage.level[index] > landscape.seaLevel + .04 &&\n" +
"        drainage.level[index] - landscape.height[index] < .002) {\n" +
"      const score = drainage.level[index] * .7 + Math.min(.4, relief) * .3;\n" +
"      if (score > sourceScore[index]) { sources[index] = index; sourceScore[index] = score; }\n" +
"    }\n" +
"    if (next >= 0 && sourceScore[index] > sourceScore[next]) { sources[next] = sources[index]; sourceScore[next] = sourceScore[index]; }\n" +
"  }\n" +
"  for (const index of drainage.order) {\n" +
"    const next = drainage.parent[index];\n" +
"    if (coastalBasins && drainage.level[index] <= landscape.seaLevel) basin[index] = -1;\n" +
"    else if (next < 0 || coastalBasins && drainage.level[next] <= landscape.seaLevel) basin[index] = index;\n" +
"    else {\n" +
"      basin[index] = basin[next];\n" +
"      distance[index] = distance[next] + Math.hypot(index % size - next % size, Math.floor(index / size) - Math.floor(next / size));\n" +
"    }\n" +
"    if (next >= 0) childFlow[next] = Math.max(childFlow[next], drainage.flow[index]);\n" +
"  }\n" +
"  let roots = [...drainage.order].filter(index => (coastalBasins ? basin[index] === index && sources[index] >= 0 && distance[sources[index]] >= (terrainDriven >= 31 ? 18 : 28) : drainage.parent[index] < 0) && drainage.flow[index] >= (terrainDriven >= 31 ? 100 : coastalBasins ? 350 : sparse ? 3000 : mature ? 1800 : terrainDriven ? 500 : 180))\n" +
"    .sort((left, right) => drainage.flow[right] - drainage.flow[left] || left - right)\n" +
"    .slice(0, terrainDriven >= 31 ? length : terrainDriven ? 16 : Math.min(8, Math.max(2, Math.floor(waterBudget / 900))));\n" +
"  if (coastalBasins) {\n" +
"    const selected = [];\n" +
"    for (const root of roots) {\n" +
"      if (selected.some(other => Math.hypot(root % size - other % size, Math.floor(root / size) - Math.floor(other / size)) < (terrainDriven >= 31 ? 16 : 22))) continue;\n" +
"      selected.push(root);\n" +
"      if (selected.length >= 4) break;\n" +
"    }\n" +
"    roots = selected;\n" +
"  }\n" +
"  recordPlacementMap(landscape, \"river:basins\", [\"water\"], basin, { categorical: true, excluded: -1, water: \"river\",\n" +
"    roots: roots.map(index => ({ index, source: sources[index], flow: drainage.flow[index], distance: distance[sources[index]] })) });\n" +
"  recordPlacementMap(landscape, \"river:source-score\", [\"water\"], sourceScore, { water: \"river\" });\n" +
"  const groups = new Map(roots.map(index => [index, []]));\n" +
"  const threshold = sparse ? 900 : mature ? 450 : terrainDriven ? 110 : 45;\n" +
"  const initiation = coastalBasins ? 160 : mountainFed ? 300 : threshold;\n" +
"  for (const index of drainage.order) {\n" +
"    if (!groups.has(basin[index]) || drainage.flow[index] < initiation || childFlow[index] >= initiation || distance[index] < (coastalBasins ? 0 : 28)) continue;\n" +
"    const head = mountainFed ? sources[index] : index;\n" +
"    if (head >= 0 && !groups.get(basin[index]).includes(head)) groups.get(basin[index]).push(head);\n" +
"  }\n" +
"  if (coastalBasins) for (const root of roots) if (!groups.get(root).includes(sources[root])) groups.get(root).unshift(sources[root]);\n" +
"  const weights = roots.filter(index => !mountainFed || groups.get(index).length).reduce((sum, index) => sum + Math.sqrt(drainage.flow[index]), 0);\n" +
"  let targetHeads = terrainDriven ? Math.min(mountainFed ? 8 : sparse ? 16 : mature ? 32 : 96, [...groups.values()].reduce((sum, entries) => sum + entries.length, 0)) :\n" +
"    Math.min(36, Math.max(6, Math.floor(waterBudget / 480))), channels = [], heads = [], junctions = [];\n" +
"  const water = new Uint8Array(length), flow = new Float32Array(length), sediment = new Float32Array(length), surface = new Float64Array(length);\n" +
"  const directionX = new Float32Array(length), directionY = new Float32Array(length), centerX = new Float32Array(length), centerY = new Float32Array(length), bend = new Float32Array(length);\n" +
"  let count = 0;\n" +
"  for (let network = 0; network < 5; network++) {\n" +
"    const marked = new Uint8Array(length), upstream = new Uint8Array(length);\n" +
"    heads = [];\n" +
"    for (let round = 0; round < (coastalBasins ? 2 : 1); round++) for (const root of roots) {\n" +
"      const candidates = groups.get(root).slice(), share = Math.max(1, Math.round(targetHeads * Math.sqrt(drainage.flow[root]) / weights));\n" +
"      const quota = coastalBasins ? round === 0 ? 1 : Math.max(0, share - 1) : share;\n" +
"      for (let choice = 0; choice < quota && candidates.length;) {\n" +
"        if (mountainFed && heads.length >= targetHeads) break;\n" +
"        let best = -1, score = -Infinity;\n" +
"        for (let order = 0; order < candidates.length; order++) {\n" +
"          const index = candidates[order], x = index % size, y = Math.floor(index / size);\n" +
"          const separation = heads.length ? Math.min(...heads.map(other => Math.hypot(x - other % size, y - Math.floor(other / size)))) : 50;\n" +
"          if (coastalBasins ? heads.some(other => Math.hypot(x - other % size, y - Math.floor(other / size)) < (basin[other] === root ? 14 : 3)) : separation < (sparse ? 36 : mature ? 24 : terrainDriven ? 8 : 18)) continue;\n" +
"          const priority = Math.min(70, separation) * (.5 + Math.max(0, drainage.level[index] - drainage.level[root])) * Math.log1p(distance[index]);\n" +
"          if (priority > score) { score = priority; best = order; }\n" +
"        }\n" +
"        if (best < 0) break;\n" +
"        const head = candidates.splice(best, 1)[0], path = [];\n" +
"        for (let index = head; index >= 0 && !marked[index] && (!coastalBasins || basin[index] === root); index = drainage.parent[index]) path.push(index);\n" +
"        if (coastalBasins && path.at(-1) === root && drainage.parent[root] >= 0) path.push(drainage.parent[root]);\n" +
"        if (path.length < (terrainDriven >= 31 && round === 0 ? 12 : coastalBasins ? 18 : sparse ? 36 : mature ? 24 : 12)) continue;\n" +
"        for (const index of path) marked[index] = 1;\n" +
"        heads.push(head); choice++;\n" +
"      }\n" +
"    }\n" +
"    for (let index = 0; index < length; index++) if (marked[index] && drainage.parent[index] >= 0) upstream[drainage.parent[index]]++;\n" +
"    channels = []; junctions = [];\n" +
"    for (let index = 0; index < length; index++) {\n" +
"      if (!marked[index]) continue;\n" +
"      if (upstream[index] > 1) junctions.push(index);\n" +
"      if (upstream[index] === 1 || drainage.parent[index] < 0) continue;\n" +
"      const path = [index];\n" +
"      for (let next = drainage.parent[index]; next >= 0 && marked[next]; next = drainage.parent[next]) {\n" +
"        path.push(next);\n" +
"        if (upstream[next] !== 1) break;\n" +
"      }\n" +
"      if (path.length > 1) channels.push({ basin: basin[index], start: index, end: path.at(-1), points: curve(path, drainage, basin, size, seed) });\n" +
"    }\n" +
"    let scale = 1;\n" +
"    for (let attempt = 0; attempt < 7; attempt++) {\n" +
"      water.fill(0); flow.fill(0); sediment.fill(0); count = 0;\n" +
"      for (const channel of channels) {\n" +
"        const share = Math.max(.65, Math.min(1.25, Math.sqrt(drainage.flow[roots[0]] / drainage.flow[channel.basin]) * .7));\n" +
"        for (let order = 0; order < channel.points.length; order++) {\n" +
"          const point = channel.points[order], previous = channel.points[Math.max(0, order - 1)], next = channel.points[Math.min(channel.points.length - 1, order + 1)];\n" +
"          const dx = next.x - previous.x, dy = next.y - previous.y, reach = Math.hypot(dx, dy) || 1;\n" +
"          const turn = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);\n" +
"          point.radius = terrainDriven ? Math.max(.72, Math.min(3.4, .45 + Math.sqrt(point.flow / 800) * .45)) :\n" +
"            Math.max(.74, Math.min(2.4, .6 + Math.log1p(point.flow / 150) * .42) * share * scale);\n" +
"          const radius = Math.ceil(point.radius + 1);\n" +
"          for (let y = Math.max(0, Math.floor(point.y) - radius); y <= Math.min(size - 1, Math.floor(point.y) + radius); y++) {\n" +
"            for (let x = Math.max(0, Math.floor(point.x) - radius); x <= Math.min(size - 1, Math.floor(point.x) + radius); x++) {\n" +
"              const index = y * size + x, offset = Math.hypot(x + .5 - point.x, y + .5 - point.y);\n" +
"              if (offset > point.radius || offset > .75 && drainage.level[index] > point.surface + .045) continue;\n" +
"              if (!water[index]) { water[index] = 1; count++; }\n" +
"              if (point.flow < flow[index]) continue;\n" +
"              flow[index] = point.flow; sediment[index] = point.sediment; surface[index] = point.surface;\n" +
"              directionX[index] = dx / reach; directionY[index] = dy / reach;\n" +
"              centerX[index] = point.x; centerY[index] = point.y; bend[index] = turn;\n" +
"            }\n" +
"          }\n" +
"        }\n" +
"      }\n" +
"      if (terrainDriven || count <= waterBudget * .55) break;\n" +
"      scale *= .8;\n" +
"    }\n" +
"    if (terrainDriven || count <= waterBudget * .7 || targetHeads <= roots.length) break;\n" +
"    targetHeads = Math.max(roots.length, Math.floor(targetHeads * .75));\n" +
"  }\n" +
"  if (count > waterBudget) throw new Error(\"물 면적 안에 강줄기를 확보하지 못했습니다.\");\n" +
"  return { water, flow, sediment, surface, directionX, directionY, centerX, centerY, bend, channels, heads, junctions, count, threshold };\n" +
"}\n" +
"\n" +
"return { createRiverChannels };\n" +
"})();\n" +
"modules[\"server/landscape-ecology.mjs\"] = (() => {\n" +
"const { createHillslopeFlow } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"function bounded(value) { return Math.max(0, Math.min(1, value)); }\n" +
"\n" +
"\n" +
"\n" +
"function createLandscapeHabitats(world) {\n" +
"  const { size, terrain, hydrology: h } = world, length = terrain.length;\n" +
"  const hillslopeFlow = createHillslopeFlow(h.ground, h.rainfall, size, h.seaLevel, h.water);\n" +
"  const fields = Object.fromEntries([\"rainfall\", \"soilMoisture\", \"soilDepth\", \"soilFertility\", \"forestCover\", \"exposure\", \"parentRock\", \"sandySoil\", \"shelter\", \"terrainPosition\", \"topographicWetness\"].map(key => [key, new Float32Array(length)]));\n" +
"  const mountainDistance = new Uint8Array(length).fill(255), queue = new Int32Array(length);\n" +
"  let end = 0;\n" +
"  for (let index = 0; index < length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) { mountainDistance[index] = 0; queue[end++] = index; }\n" +
"  for (let cursor = 0; cursor < end; cursor++) {\n" +
"    const index = queue[cursor], x = index % size, y = Math.floor(index / size);\n" +
"    if (mountainDistance[index] >= 12) continue;\n" +
"    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {\n" +
"      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;\n" +
"      const next = ny * size + nx;\n" +
"      if (mountainDistance[next] <= mountainDistance[index] + 1) continue;\n" +
"      mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;\n" +
"    }\n" +
"  }\n" +
"  for (let index = 0; index < length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size), ground = h.ground[index];\n" +
"    let neighbors = 0, samples = 0, canopy = 0, mean = 0;\n" +
"    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"      if (x+dx < 0 || y+dy < 0 || x+dx >= size || y+dy >= size) continue;\n" +
"      canopy += h.forestMask?.[(y+dy)*size+x+dx] ? 1 : 0; samples++;\n" +
"    }\n" +
"    for (const radius of [6, 18]) for (const [dx,dy] of [[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius,-radius],[radius,radius],[-radius,radius],[radius,-radius]]) {\n" +
"      const nx = Math.max(0,Math.min(size-1,x+dx)),ny = Math.max(0,Math.min(size-1,y+dy));\n" +
"      mean += h.ground[ny*size+nx]; neighbors++;\n" +
"    }\n" +
"    const position = mean/neighbors-ground, slope = bounded(h.slope[index]*14), mountain = terrain[index]>=6&&terrain[index]<=8?1:0;\n" +
"    fields.parentRock[index] = h.bedrock[index];\n" +
"    fields.terrainPosition[index] = position;\n" +
"    fields.rainfall[index] = bounded((h.rainfall[index]-.25)/1.3);\n" +
"    fields.shelter[index] = bounded(.5+position*5-slope*.15);\n" +
"    fields.exposure[index] = bounded(.15+slope*.5+bounded(h.uplift[index]*.7)*.2-fields.shelter[index]*.1);\n" +
"    const convergence = bounded((Math.log1p(hillslopeFlow[index])-Math.log(.002+h.slope[index])-4)/6);\n" +
"    fields.topographicWetness[index] = convergence;\n" +
"    fields.soilMoisture[index] = bounded(.16+fields.rainfall[index]*.6+fields.shelter[index]*.15+h.wetness[index]*.25+\n" +
"      convergence*.18-fields.exposure[index]*.18-fields.parentRock[index]*.04);\n" +
"    fields.soilDepth[index] = bounded(.14+fields.rainfall[index]*.4+fields.shelter[index]*.32+(1-fields.exposure[index])*.2+\n" +
"      Math.min(.15,h.fertility[index]*.3)-bounded(h.uplift[index])*.15);\n" +
"    fields.sandySoil[index] = bounded((1-fields.parentRock[index])*.65+h.sand[index]*1.2-fields.soilDepth[index]*.2);\n" +
"    fields.forestCover[index] = canopy/samples;\n" +
"    fields.soilFertility[index] = bounded(fields.soilDepth[index]*(.35+fields.parentRock[index]*.35+fields.forestCover[index]*.3)+h.fertility[index]*.3);\n" +
"  }\n" +
"  for (const [key,values] of Object.entries(fields)) recordPlacementMap(h,\"habitat:\"+key,[\"forest\",\"swamp\",\"resources\"],values,\n" +
"    {stage:\"intermediate\",...(key==='terrainPosition'?{}:{minimum:0,maximum:1})});\n" +
"  recordPlacementMap(h,\"habitat:mountain-distance\",[\"mountains\",\"resources\"],mountainDistance,{minimum:0,maximum:12,excluded:255,stage:\"intermediate\"});\n" +
"  recordPlacementMap(h,\"habitat:hillslope-flow\",[\"forest\",\"swamp\",\"resources\"],hillslopeFlow,{minimum:0,logarithmic:true,stage:\"intermediate\"});\n" +
"  return {...fields,mountainDistance,hillslopeFlow};\n" +
"}\n" +
"\n" +
"function distributeLandscapeBiomes(world, fields) {\n" +
"  const { terrain, hydrology: h } = world;\n" +
"  const land = terrain.reduce((count, type) => count + (type >= 2 && type !== 10 ? 1 : 0), 0), forest = [], wetlands = [];\n" +
"  h.forestMask = new Uint8Array(terrain.length);\n" +
"  const swampScore = new Float32Array(terrain.length).fill(NaN), forestScore = new Float32Array(terrain.length).fill(NaN);\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const type = terrain[index];\n" +
"    if (type < 3 || type > 7) continue;\n" +
"    if (type <= 5) terrain[index] = 4;\n" +
"    const flatness = 1 / (1 + h.slope[index] * 100), convergence = bounded(Math.log1p(fields.hillslopeFlow[index]) / 8);\n" +
"    const wet = fields.soilMoisture[index] * .4 + flatness * .25 + h.wetness[index] * .15 + fields.shelter[index] * .15 + convergence * .05;\n" +
"    if (type <= 5 && h.slope[index] < .025 && fields.soilMoisture[index] > .5 &&\n" +
"        (h.wetness[index] > .28 || fields.terrainPosition[index] > .015 || fields.topographicWetness[index] > .65) && wet > .55) {\n" +
"      swampScore[index] = wet; wetlands.push({ index, score: wet });\n" +
"    }\n" +
"    const score = fields.soilMoisture[index] * .5 + fields.soilDepth[index] * .15 + fields.rainfall[index] * .2 +\n" +
"      fields.shelter[index] * .15 - fields.exposure[index] * .05;\n" +
"    if (h.slope[index] < .1 && h.ground[index] < h.seaLevel + .7 && fields.soilMoisture[index] > .48 &&\n" +
"        fields.soilDepth[index] > .38 && fields.rainfall[index] > .28) {\n" +
"      forestScore[index] = score;\n" +
"      if (score > .49) forest.push({ index, score });\n" +
"    }\n" +
"  }\n" +
"  wetlands.sort((left, right) => right.score - left.score || left.index - right.index);\n" +
"  for (const { index } of wetlands.slice(0, Math.round(land * .085))) terrain[index] = 9;\n" +
"  forest.sort((left, right) => right.score - left.score || left.index - right.index);\n" +
"  const trees = forest.filter(item => terrain[item.index] !== 9).slice(0, Math.round(land * .28));\n" +
"  for (const { index } of trees) {\n" +
"    h.forestMask[index] = 1;\n" +
"    if (terrain[index] <= 5) terrain[index] = 5;\n" +
"  }\n" +
"  for (let index = 0; index < terrain.length; index++) if (terrain[index] === 4 &&\n" +
"      (1 - fields.soilMoisture[index]) * .75 + fields.exposure[index] * .15 + fields.sandySoil[index] * .1 > .58) terrain[index] = 3;\n" +
"  for (const [id, layer, values] of [[\"swamp\", \"swamp\", swampScore], [\"forest\", \"forest\", forestScore]])\n" +
"    recordPlacementMap(h, \"biome:\" + id + \"-score\", [layer], values, { stage: \"intermediate\" });\n" +
"}\n" +
"\n" +
"function landscapeResourceSuitability(key,index,terrain,h) {\n" +
"  const type=terrain[index],f=h.resourceHabitats;if(type<2||type===10)return 0;\n" +
"  const moisture=f.soilMoisture[index],depth=f.soilDepth[index],canopy=f.forestCover[index];\n" +
"  if(key==='tree')return h.forestMask[index]?depth*(.35+moisture*.65):0;\n" +
"  if(key==='dew')return type===4||type===9?(.2+moisture*.6+f.shelter[index]*.2)*(.6+canopy*.4):0;\n" +
"  if(key==='clay')return [3,4,5,9].includes(type)?f.soilFertility[index]*(.5+depth*.5):0;\n" +
"  if(key==='pebbles'){\n" +
"    if(![2,3,4,6].includes(type))return 0;\n" +
"    const distance=f.mountainDistance[index],talus=distance<=3?Math.exp(-distance/2)*f.exposure[index]*f.parentRock[index]*.25:0;\n" +
"    const fan=distance<=10&&h.flow[index]>35&&h.slope[index]<.03?Math.min(1,Math.log1p(h.flow[index])/6)*.1:0;\n" +
"    return h.gravel[index]*18+talus+fan;\n" +
"  }\n" +
"  return 0;\n" +
"}\n" +
"\n" +
"return { createLandscapeHabitats, distributeLandscapeBiomes, landscapeResourceSuitability };\n" +
"})();\n" +
"modules[\"server/landscape-fields.mjs\"] = (() => {\n" +
"const { landscapeHash } = modules[\"server/landscape-processes.mjs\"];\n" +
"\n" +
"function normalProbability(value) {\n" +
"  const x = Math.abs(value), t = 1 / (1 + .2316419 * x);\n" +
"  const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t *\n" +
"    (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));\n" +
"  return value < 0 ? tail : 1 - tail;\n" +
"}\n" +
"\n" +
"function transform(real, imaginary, size, inverse) {\n" +
"  for (let row = 0; row < size; row++) {\n" +
"    const offset = row * size;\n" +
"    for (let i = 1, j = 0; i < size; i++) {\n" +
"      let bit = size >> 1;\n" +
"      for (; j & bit; bit >>= 1) j ^= bit;\n" +
"      j ^= bit;\n" +
"      if (i < j) {\n" +
"        [real[offset+i], real[offset+j]] = [real[offset+j], real[offset+i]];\n" +
"        [imaginary[offset+i], imaginary[offset+j]] = [imaginary[offset+j], imaginary[offset+i]];\n" +
"      }\n" +
"    }\n" +
"    for (let span = 2; span <= size; span *= 2) {\n" +
"      const angle = (inverse ? 2 : -2) * Math.PI / span, cosine = Math.cos(angle), sine = Math.sin(angle);\n" +
"      for (let start = 0; start < size; start += span) {\n" +
"        let wr = 1, wi = 0;\n" +
"        for (let k = 0; k < span / 2; k++) {\n" +
"          const a = offset+start+k, b = a+span/2, br = real[b]*wr-imaginary[b]*wi, bi = real[b]*wi+imaginary[b]*wr;\n" +
"          real[b] = real[a]-br; imaginary[b] = imaginary[a]-bi;\n" +
"          real[a] += br; imaginary[a] += bi;\n" +
"          const next = wr*cosine-wi*sine; wi = wr*sine+wi*cosine; wr = next;\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"    if (inverse) for (let i = offset; i < offset+size; i++) { real[i] /= size; imaginary[i] /= size; }\n" +
"  }\n" +
"}\n" +
"\n" +
"function transpose(values, size) {\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < y; x++) {\n" +
"    const a = y*size+x, b = x*size+y, value = values[a]; values[a] = values[b]; values[b] = value;\n" +
"  }\n" +
"}\n" +
"\n" +
"function transform2D(real, imaginary, size, inverse) {\n" +
"  transform(real, imaginary, size, inverse); transpose(real, size); transpose(imaginary, size);\n" +
"  transform(real, imaginary, size, inverse); transpose(real, size); transpose(imaginary, size);\n" +
"}\n" +
"\n" +
"function createLandscapeField(size, seed, correlation, smoothness) {\n" +
"  let width = 1; while (width < size + 128) width *= 2;\n" +
"  const real = new Float64Array(width*width), imaginary = new Float64Array(real.length);\n" +
"  for (let index = 0; index < real.length; index += 2) {\n" +
"    const radius = Math.sqrt(-2*Math.log(Math.max(1e-12,landscapeHash(index,1,seed))));\n" +
"    const angle = landscapeHash(index,2,seed)*Math.PI*2;\n" +
"    real[index] = radius*Math.cos(angle); real[index+1] = radius*Math.sin(angle);\n" +
"  }\n" +
"  transform2D(real, imaginary, width, false);\n" +
"  const kappa = Math.sqrt(2*smoothness)/correlation;\n" +
"  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {\n" +
"    const kx = Math.min(x,width-x)*2*Math.PI/width, ky = Math.min(y,width-y)*2*Math.PI/width;\n" +
"    const factor = Math.pow(kappa*kappa/(kappa*kappa+kx*kx+ky*ky),(smoothness+1)/2), index = y*width+x;\n" +
"    real[index] *= factor; imaginary[index] *= factor;\n" +
"  }\n" +
"  transform2D(real, imaginary, width, true);\n" +
"  const values = new Float32Array(size*size), offset = Math.floor((width-size)/2);\n" +
"  let sum = 0, square = 0;\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const value = real[(y+offset)*width+x+offset]; values[y*size+x] = value; sum += value; square += value*value;\n" +
"  }\n" +
"  const mean = sum/values.length, deviation = Math.sqrt(Math.max(1e-20,square/values.length-mean*mean));\n" +
"  for (let index = 0; index < values.length; index++) values[index] = Math.round((values[index]-mean)/deviation*1e6)/1e6;\n" +
"  return values;\n" +
"}\n" +
"\n" +
"function routeLandscape(height, sea, size) {\n" +
"  const length = height.length, level = new Float64Array(height), parent = new Int32Array(length).fill(-1);\n" +
"  const order = new Int32Array(length), seen = new Uint8Array(length), heap = new Int32Array(length);\n" +
"  let count = 0, used = 0;\n" +
"  function less(a,b) { return level[a] < level[b] || level[a] === level[b] && a < b; }\n" +
"  function push(index) {\n" +
"    let position = used++;\n" +
"    while (position) { const next = (position-1)>>1; if (!less(index,heap[next])) break; heap[position] = heap[next]; position = next; }\n" +
"    heap[position] = index;\n" +
"  }\n" +
"  function pop() {\n" +
"    const first = heap[0], last = heap[--used]; let position = 0;\n" +
"    while (position*2+1 < used) {\n" +
"      let child = position*2+1; if (child+1 < used && less(heap[child+1],heap[child])) child++;\n" +
"      if (!less(heap[child],last)) break; heap[position] = heap[child]; position = child;\n" +
"    }\n" +
"    heap[position] = last; return first;\n" +
"  }\n" +
"  for (let index = 0; index < length; index++) if (sea[index]) { seen[index] = 1; push(index); }\n" +
"  while (used) {\n" +
"    const index = pop(), x = index%size, y = Math.floor(index/size); order[count++] = index;\n" +
"    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      const nx = x+dx, ny = y+dy;\n" +
"      if ((!dx&&!dy)||nx<0||ny<0||nx>=size||ny>=size) continue;\n" +
"      const next = ny*size+nx; if (seen[next]) continue;\n" +
"      seen[next] = 1; parent[next] = index; level[next] = Math.max(height[next],level[index]+1e-5); push(next);\n" +
"    }\n" +
"  }\n" +
"  const area = new Float64Array(length), slope = new Float32Array(length);\n" +
"  for (const index of order) {\n" +
"    if (sea[index]) continue;\n" +
"    const x = index%size, y = Math.floor(index/size); let best = 0, receiver = parent[index];\n" +
"    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      const nx = x+dx, ny = y+dy;\n" +
"      if ((!dx&&!dy)||nx<0||ny<0||nx>=size||ny>=size) continue;\n" +
"      const next = ny*size+nx, descent = (level[index]-level[next])/Math.hypot(dx,dy);\n" +
"      if (descent > best) { best = descent; receiver = next; }\n" +
"    }\n" +
"    parent[index] = receiver; slope[index] = best/80; area[index] = 6400;\n" +
"  }\n" +
"  for (let cursor = count-1; cursor >= 0; cursor--) {\n" +
"    const index = order[cursor], next = parent[index]; if (next >= 0) area[next] += area[index];\n" +
"  }\n" +
"  return { level, parent, order, area, slope };\n" +
"}\n" +
"\n" +
"function selectContinentalSea(values, size) {\n" +
"  const sorted = Array.from(values).sort((a,b)=>a-b), sea = new Uint8Array(values.length), queue = new Int32Array(values.length);\n" +
"  let lower = sorted[0]-1, upper = sorted.at(-1)+1, threshold = lower, best = Infinity, bestSea = sea.slice();\n" +
"  for (let pass = 0; pass < 26; pass++) {\n" +
"    const candidate = (lower+upper)/2; sea.fill(0); let end = 0;\n" +
"    for (let index = 0; index < values.length; index++) {\n" +
"      const x = index%size, y = Math.floor(index/size);\n" +
"      if (!x||!y||x===size-1||y===size-1) { sea[index] = 1; queue[end++] = index; }\n" +
"    }\n" +
"    for (let cursor = 0; cursor < end; cursor++) {\n" +
"      const index = queue[cursor], x = index%size, y = Math.floor(index/size);\n" +
"      for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {\n" +
"        if (nx<0||ny<0||nx>=size||ny>=size) continue;\n" +
"        const next = ny*size+nx; if (sea[next]||values[next]>candidate) continue;\n" +
"        sea[next] = 1; queue[end++] = next;\n" +
"      }\n" +
"    }\n" +
"    const difference = Math.abs(end/values.length-.2);\n" +
"    if (difference < best) { best = difference; threshold = candidate; bestSea.set(sea); }\n" +
"    if (end/values.length < .2) lower = candidate; else upper = candidate;\n" +
"  }\n" +
"  return { sea:bestSea, threshold, landFraction:1-bestSea.reduce((sum,value)=>sum+value,0)/values.length };\n" +
"}\n" +
"\n" +
"return { normalProbability, createLandscapeField, routeLandscape, selectContinentalSea };\n" +
"})();\n" +
"modules[\"server/terrain-resources.mjs\"] = (() => {\n" +
"const { createLandscapeField } = modules[\"server/landscape-fields.mjs\"];\n" +
"const { createHillslopeFlow, landscapeHash, quantizeLandscapeValue } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"function bounded(value) { return Math.max(0,Math.min(1,value)); }\n" +
"\n" +
"function ranks(values,water) {\n" +
"  const sorted=[];for(let index=0;index<values.length;index++)if(!water[index])sorted.push(index);\n" +
"  sorted.sort((a,b)=>values[a]-values[b]||a-b);const result=new Float32Array(values.length);\n" +
"  for(let rank=0;rank<sorted.length;rank++)result[sorted[rank]]=rank/Math.max(1,sorted.length-1);\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function record(h,id,layers,values,details) {\n" +
"  recordPlacementMap(h,id,layers,values,{schemaVersion:33,...details});\n" +
"}\n" +
"\n" +
"function createFormedHabitats(world) {\n" +
"  const {size,seed,terrain,hydrology:h}=world,length=terrain.length;\n" +
"  const vegetation=createLandscapeField(size,seed+3001,h.profile.vegetationCorrelation,1.5);\n" +
"  const hillslopeFlow=createHillslopeFlow(h.ground,h.rainfall,size,h.seaLevel,h.water);\n" +
"  const wetness=new Float32Array(length),drainageHeight=new Float32Array(length),referenceHeight=new Float64Array(length);\n" +
"  const fields=Object.fromEntries([\"rainfall\",\"soilMoisture\",\"soilDepth\",\"soilFertility\",\"forestCover\",\"exposure\",\"parentRock\",\"sandySoil\",\"shelter\",\"terrainPosition\",\"topographicWetness\"].map(key=>[key,new Float32Array(length)]));\n" +
"  for(let cursor=0;cursor<h.ground.length;cursor++){\n" +
"    const index=h.downstreamOrder[cursor],parent=h.downstream[index];\n" +
"    referenceHeight[index]=h.water[index]?h.waterSurface[index]:parent<0?0:referenceHeight[parent];\n" +
"    drainageHeight[index]=Math.max(0,h.ground[index]-referenceHeight[index]);\n" +
"  }\n" +
"  for(let index=0;index<length;index++)wetness[index]=Math.log((hillslopeFlow[index]*h.profile.cellMeters)/Math.max(.001,h.slope[index]));\n" +
"  const wetnessRank=ranks(wetness,h.water),mountainDistance=new Uint8Array(length).fill(255),queue=new Int32Array(length);let end=0;\n" +
"  for(let index=0;index<length;index++)if(terrain[index]>=6&&terrain[index]<=8){mountainDistance[index]=0;queue[end++]=index;}\n" +
"  for(let cursor=0;cursor<end;cursor++){\n" +
"    const index=queue[cursor],x=index%size,y=Math.floor(index/size);if(mountainDistance[index]>=12)continue;\n" +
"    for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){\n" +
"      if(nx<0||ny<0||nx>=size||ny>=size)continue;const next=ny*size+nx;\n" +
"      if(mountainDistance[next]<=mountainDistance[index]+1)continue;mountainDistance[next]=mountainDistance[index]+1;queue[end++]=next;\n" +
"    }\n" +
"  }\n" +
"  for(let index=0;index<length;index++){\n" +
"    const x=index%size,y=Math.floor(index/size),slope=h.slope[index];let surrounding=0;\n" +
"    for(const[dx,dy]of[[-8,0],[8,0],[0,-8],[0,8]])surrounding+=h.ground[Math.max(0,Math.min(size-1,y+dy))*size+Math.max(0,Math.min(size-1,x+dx))];\n" +
"    const position=surrounding/4-h.ground[index],shelter=bounded(.5+position/160);\n" +
"    fields.terrainPosition[index]=position;fields.shelter[index]=shelter;\n" +
"    fields.rainfall[index]=1;fields.parentRock[index]=h.bedrock[index];\n" +
"    fields.topographicWetness[index]=wetnessRank[index];\n" +
"    fields.soilMoisture[index]=bounded(.35+.35*wetnessRank[index]+.2*Math.exp(-drainageHeight[index]/4)-slope*.1);\n" +
"    fields.soilDepth[index]=bounded((.35+.35*(1-h.bedrock[index])+.3*shelter)/(1+slope*4));\n" +
"    fields.exposure[index]=bounded(slope*1.4+(1-shelter)*.3);\n" +
"    fields.sandySoil[index]=1-Math.exp(-h.sand[index]/.02);\n" +
"    fields.soilFertility[index]=bounded(.5*fields.soilDepth[index]+.35*(1-Math.exp(-h.fines[index]/.01))+.15*fields.soilMoisture[index]);\n" +
"  }\n" +
"  for(const[key,values]of Object.entries(fields))if(![\"soilFertility\",\"parentRock\"].includes(key))record(h,\"habitat:\"+key,[\"forest\",\"swamp\",\"resources\"],values,{stage:\"intermediate\",...(key===\"terrainPosition\"?{}:{minimum:0,maximum:1})});\n" +
"  record(h,\"habitat:drainage-height\",[\"forest\",\"swamp\",\"resources\"],drainageHeight,{stage:\"intermediate\",minimum:0});\n" +
"  record(h,\"habitat:hillslope-flow\",[\"forest\",\"swamp\",\"resources\"],hillslopeFlow,{stage:\"intermediate\",minimum:0,logarithmic:true});\n" +
"  record(h,\"habitat:mountain-distance\",[\"mountains\",\"resources\"],mountainDistance,{stage:\"intermediate\",minimum:0,maximum:12,excluded:255});\n" +
"  record(h,\"resource:tree:suitability\",[\"forest\",\"resources\"],vegetation,{resource:\"tree\",stage:\"original\"});\n" +
"  return {...fields,mountainDistance,hillslopeFlow,vegetation,drainageHeight,wetness,\n" +
"    fieldSemantics:{soilDepth:\"relative-rooting-suitability\",soilFertility:\"relative-resource-suitability\",soilMoisture:\"relative-moisture-index\",topographicWetness:\"land-percentile\"}};\n" +
"}\n" +
"\n" +
"function formedResourceSuitability(key,index,terrain,h) {\n" +
"  if(h.water[index]||terrain[index]===10)return 0;\n" +
"  const f=h.resourceHabitats,slope=h.slope[index],type=terrain[index],moisture=f.soilMoisture[index];\n" +
"  const flat=1/(1+slope*8),open=1-f.forestCover[index];\n" +
"  if(key===\"tree\")return h.forestMask?.[index]?1:0;\n" +
"  if(key===\"clay\")return type<=5||type===9?flat*(.35+.45*(1-h.bedrock[index])+.2*(1-Math.exp(-h.fines[index]/.005))):0;\n" +
"  if(key===\"dew\")return type===4||type===9?moisture*(.6+.4*open)*(type===9?2.5:1):0;\n" +
"  if(key===\"pebbles\"){\n" +
"    if(type===9||type>=7)return 0;\n" +
"    const alluvium=h.bankGravel[index]*16;\n" +
"    const talus=type===6?.005*f.exposure[index]*h.bedrock[index]:0;\n" +
"    return alluvium+talus;\n" +
"  }\n" +
"  return 0;\n" +
"}\n" +
"\n" +
"function populateFormedResources(world) {\n" +
"  const {terrain,hydrology:h,seed,size}=world,length=terrain.length;\n" +
"  const fields=createFormedHabitats(world);h.resourceHabitats=fields;h.forestMask=new Uint8Array(length);\n" +
"  const forestScore=new Float32Array(length).fill(NaN),swampScore=new Float32Array(length).fill(NaN);\n" +
"  for(let index=0;index<length;index++){\n" +
"    if(h.water[index]||terrain[index]===2||terrain[index]===10)continue;\n" +
"    const slope=h.slope[index],wetness=fields.topographicWetness[index],hand=fields.drainageHeight[index];\n" +
"    const swamp=wetness*Math.exp(-hand/12)/(1+slope*30);swampScore[index]=swamp;\n" +
"    if(!h.profile.swampFraction&&terrain[index]===4&&wetness>.78&&slope<.035&&hand<8&&swamp>.54&&h.bankGravel[index]<.08){terrain[index]=9;continue;}\n" +
"    const score=1/(1+Math.exp(-(-1.1+fields.vegetation[index]*1.1+fields.soilMoisture[index]*.7+fields.shelter[index]*.5-slope*2-Math.max(0,h.ground[index]-700)*.0008)));\n" +
"    forestScore[index]=score;\n" +
"    if(!h.profile.forestFraction&&slope<.8&&terrain[index]!==8&&score>.62&&h.bankGravel[index]<.08){h.forestMask[index]=1;if(terrain[index]===4)terrain[index]=5;}\n" +
"    else if(!h.profile.dryLandFraction&&terrain[index]===4&&fields.soilMoisture[index]<.47)terrain[index]=3;\n" +
"  }\n" +
"  if(h.profile.forestFraction) {\n" +
"    const lowlands=[],wetlands=[];let land=0;\n" +
"    for(let index=0;index<length;index++) {\n" +
"      if(h.water[index])continue;land++;\n" +
"      if(terrain[index]!==4)continue;\n" +
"      lowlands.push(index);\n" +
"      if(fields.topographicWetness[index]>.78&&h.slope[index]<.035&&fields.drainageHeight[index]<8&&swampScore[index]>.54&&h.bankGravel[index]<.08)wetlands.push(index);\n" +
"    }\n" +
"    wetlands.sort((a,b)=>swampScore[b]-swampScore[a]||a-b);\n" +
"    for(const index of wetlands.slice(0,Math.round(land*h.profile.swampFraction)))terrain[index]=9;\n" +
"    const forests=lowlands.filter(index=>terrain[index]===4&&h.slope[index]<.8&&h.bankGravel[index]<.08);\n" +
"    forests.sort((a,b)=>forestScore[b]-forestScore[a]||a-b);\n" +
"    for(const index of forests.slice(0,Math.round(land*h.profile.forestFraction))){h.forestMask[index]=1;terrain[index]=5;}\n" +
"    const dry=lowlands.filter(index=>terrain[index]===4);\n" +
"    const dryness=index=>1-fields.soilMoisture[index]+fields.sandySoil[index]*.2+fields.exposure[index]*.1;\n" +
"    dry.sort((a,b)=>dryness(b)-dryness(a)||a-b);\n" +
"    for(const index of dry.slice(0,Math.round(land*h.profile.dryLandFraction)))terrain[index]=3;\n" +
"  }\n" +
"  for(let index=0;index<length;index++){\n" +
"    const x=index%size,y=Math.floor(index/size);let canopy=0,count=0;\n" +
"    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<size&&y+dy<size){canopy+=h.forestMask[(y+dy)*size+x+dx];count++;}\n" +
"    fields.forestCover[index]=canopy/count;\n" +
"  }\n" +
"  for(const[id,layer,values]of[[\"forest-score\",\"forest\",forestScore],[\"swamp-score\",\"swamp\",swampScore]])record(h,\"biome:\"+id,[layer],values,{stage:\"intermediate\",minimum:0,maximum:1});\n" +
"  world.resources=[];world.food=[];\n" +
"  const occupied=new Uint8Array(length);\n" +
"  for(let index=0;index<length;index++)if(h.forestMask[index]){\n" +
"    const amount=Math.round(30+fields.soilMoisture[index]*35+fields.soilDepth[index]*20);\n" +
"    world.resources.push([index%size,Math.floor(index/size),amount*20,\"tree\"]);occupied[index]=1;\n" +
"  }\n" +
"  const definitions=[[\"clay\",.11,12,28],[\"pebbles\",1.1,12,42],[\"dew\",.11,3,10]];\n" +
"  for(const[order,[key,intensity,base,richness]]of definitions.entries()){\n" +
"    const suitability=new Float32Array(length),probability=new Float32Array(length);\n" +
"    const draw=(x,y)=>landscapeHash(x,y,seed+3083+order*41);\n" +
"    for(let index=0;index<length;index++){\n" +
"      suitability[index]=formedResourceSuitability(key,index,terrain,h);\n" +
"      if(occupied[index]||world.hazards[index])continue;\n" +
"      const chance=quantizeLandscapeValue(1-Math.exp(-intensity*suitability[index]));probability[index]=chance;\n" +
"      const x=index%size,y=Math.floor(index/size);if(draw(x,y)>=chance)continue;\n" +
"      let amount=Math.round(base+richness*suitability[index]*(.5+landscapeHash(x,y,seed+3089+order*43)));\n" +
"      if(terrain[index]===9){if(key===\"dew\")amount=Math.round(24+36*fields.soilMoisture[index]+20*landscapeHash(x,y,seed+3359));if(key===\"clay\")amount*=2;}\n" +
"      world.resources.push([x,y,amount*20,key]);occupied[index]=1;\n" +
"    }\n" +
"    record(h,\"resource:\"+key+\":suitability\",[\"resources\"],suitability,{resource:key,stage:\"intermediate\",minimum:0});\n" +
"    record(h,\"resource:\"+key+\":draw\",[\"resources\"],null,{resource:key,stage:\"original\",sample:draw,minimum:0,maximum:1});\n" +
"    record(h,\"resource:\"+key+\":probability\",[\"resources\"],probability,{resource:key,stage:\"intermediate\",minimum:0,maximum:1});\n" +
"  }\n" +
"  if(h.placementMaps){\n" +
"    const total=new Float32Array(length);for(const[x,y,amount]of world.resources)total[y*size+x]=amount;\n" +
"    record(h,\"resource:amount\",[\"resources\"],total,{minimum:0,scope:\"all\",stage:\"final\"});\n" +
"    for(const key of[\"tree\",...definitions.map(item=>item[0])]){\n" +
"      const amounts=new Float32Array(length);for(const[x,y,amount,type]of world.resources)if(type===key)amounts[y*size+x]=amount;\n" +
"      record(h,\"resource:\"+key+\":amount\",[\"resources\"],amounts,{resource:key,minimum:0,stage:\"final\"});\n" +
"    }\n" +
"  }\n" +
"  for(const[id,layer,values]of[[\"forest\",\"forest\",h.forestMask],[\"swamp\",\"swamp\",Uint8Array.from(terrain,type=>type===9?1:0)]])record(h,\"biome:\"+id+\"-mask\",[layer],values,{stage:\"final\",minimum:0,maximum:1});\n" +
"  h.resourceProfile={model:\"conditional-intensity\",selected:{forestThreshold:.62,swampWetness:.78,swampSlope:.035,swampDrainageHeight:8,activeBarExclusion:.08,definitions}};\n" +
"}\n" +
"\n" +
"return { createFormedHabitats, formedResourceSuitability, populateFormedResources };\n" +
"})();\n" +
"modules[\"server/resource-habitats.mjs\"] = (() => {\n" +
"const { quantizeLandscapeValue } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { createLandscapeHabitats, landscapeResourceSuitability } = modules[\"server/landscape-ecology.mjs\"];\n" +
"const { recordPlacementMap, placementNoise } = modules[\"server/placement-maps.mjs\"];\n" +
"const { createFormedHabitats, formedResourceSuitability } = modules[\"server/terrain-resources.mjs\"];\n" +
"\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function bounded(value) { return Math.max(0, Math.min(1, value)); }\n" +
"\n" +
"function createResourceHabitats(world) {\n" +
"  if(world.hydrology?.generationVersion>=33)return world.hydrology.resourceHabitats||createFormedHabitats(world);\n" +
"  if (world.hydrology?.generationVersion >= 32) return createLandscapeHabitats(world);\n" +
"  const { size, terrain, hydrology: h } = world, length = terrain.length, seed = h.seed;\n" +
"  const rainfall = new Float32Array(length), soilMoisture = new Float32Array(length), soilDepth = new Float32Array(length);\n" +
"  const soilFertility = new Float32Array(length), forestCover = new Float32Array(length), exposure = new Float32Array(length);\n" +
"  const parentRock = new Float32Array(length), sandySoil = new Float32Array(length), shelter = new Float32Array(length);\n" +
"  const sources = {\n" +
"    bedrock: placementNoise(h, \"soil:bedrock-noise\", [\"resources\"], (x, y) => noise(x, y, 47, seed + 2003)),\n" +
"    detail: placementNoise(h, \"soil:bedrock-detail\", [\"resources\"], (x, y) => noise(x, y, 17, seed + 2011)),\n" +
"    sand: placementNoise(h, \"soil:sand-noise\", [\"resources\"], (x, y) => noise(x, y, 31, seed + 2017))\n" +
"  };\n" +
"  const mountainDistance = new Uint8Array(length).fill(255), queue = new Int32Array(length);\n" +
"  let end = 0;\n" +
"  for (let index = 0; index < length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) {\n" +
"    mountainDistance[index] = 0; queue[end++] = index;\n" +
"  }\n" +
"  for (let cursor = 0; cursor < end; cursor++) {\n" +
"    const index = queue[cursor], x = index % size, y = Math.floor(index / size);\n" +
"    if (mountainDistance[index] >= 12) continue;\n" +
"    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {\n" +
"      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;\n" +
"      const next = ny * size + nx;\n" +
"      if (mountainDistance[next] <= mountainDistance[index] + 1) continue;\n" +
"      mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;\n" +
"    }\n" +
"  }\n" +
"  for (let index = 0; index < length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    let trees = 0, samples = 0, surroundingHeight = 0;\n" +
"    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"      if (x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;\n" +
"      const next = (y + dy) * size + x + dx;\n" +
"      trees += terrain[next] === 5 ? 1 : 0; samples++;\n" +
"    }\n" +
"    for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {\n" +
"      surroundingHeight += h.height[Math.max(0, Math.min(size - 1, y + dy)) * size + Math.max(0, Math.min(size - 1, x + dx))];\n" +
"    }\n" +
"    const climate = noise(x, y, 25, seed + 31) * .68 + noise(x, y, 9, seed + 73) * .32;\n" +
"    const slope = bounded(h.slope[index] * 14), mountain = terrain[index] >= 6 && terrain[index] <= 8 ? 1 : 0;\n" +
"    forestCover[index] = trees / samples;\n" +
"    rainfall[index] = h.island || h.continent ? bounded((h.rainfall[index] - .25) / 1.3) : bounded(.5 + climate * .65);\n" +
"    shelter[index] = bounded(.5 + (surroundingHeight / 4 - h.height[index]) * 5 - slope * .2);\n" +
"    exposure[index] = bounded(.2 + slope * .5 + mountain * .3 - shelter[index] * .15);\n" +
"    soilMoisture[index] = bounded(.12 + rainfall[index] * .62 + shelter[index] * .16 + h.wetness[index] * .18 - exposure[index] * .1);\n" +
"    soilDepth[index] = bounded(.15 + rainfall[index] * .35 + shelter[index] * .35 + (1 - exposure[index]) * .2 - mountain * .35);\n" +
"    parentRock[index] = bounded(.5 + sources.bedrock(x, y) * .4 + sources.detail(x, y) * .15);\n" +
"    sandySoil[index] = bounded(.55 - parentRock[index] * .45 + sources.sand(x, y) * .3);\n" +
"    soilFertility[index] = bounded(soilDepth[index] * (.25 + parentRock[index] * .4 + forestCover[index] * .35) + h.fertility[index] * .28);\n" +
"  }\n" +
"  for (const [key, values] of Object.entries({ rainfall, soilMoisture, soilDepth, soilFertility, forestCover, exposure, parentRock, sandySoil, shelter })) {\n" +
"    recordPlacementMap(h, \"habitat:\" + key, [\"forest\", \"swamp\", \"resources\"], values, { minimum: 0, maximum: 1 });\n" +
"  }\n" +
"  recordPlacementMap(h, \"habitat:mountain-distance\", [\"mountains\", \"resources\"], mountainDistance, { minimum: 0, maximum: 12, excluded: 255 });\n" +
"  const result = { rainfall, soilMoisture, soilDepth, soilFertility, forestCover, exposure, parentRock, sandySoil, shelter, mountainDistance };\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function resourceHabitatSuitability(key, index, terrain, h) {\n" +
"  if(h.generationVersion>=33)return quantizeLandscapeValue(formedResourceSuitability(key,index,terrain,h));\n" +
"  if (h.generationVersion >= 32) return quantizeLandscapeValue(landscapeResourceSuitability(key, index, terrain, h));\n" +
"  const type = terrain[index], fields = h.resourceHabitats;\n" +
"  if (type < 2 || type === 10) return 0;\n" +
"  const moisture = fields.soilMoisture[index], depth = fields.soilDepth[index], canopy = fields.forestCover[index];\n" +
"  if (key === \"tree\") return type === 5 ? depth * (.35 + moisture * .65) : 0;\n" +
"  if (key === \"honey-mushrooms\") return (h.island || h.continent ? type === 4 && canopy > 0 : type === 5) ? depth * canopy * (.2 + moisture * .8) : 0;\n" +
"  if (key === \"dew\") return type === 4 || h.generationVersion >= 30 && type === 9 ? (.2 + moisture * .6 + fields.shelter[index] * .2) * (.6 + canopy * .4) : 0;\n" +
"  if (key === \"clay\") return [3, 4, 5, 9].includes(type) ? fields.soilFertility[index] * (.5 + depth * .5) : 0;\n" +
"  if (key === \"pebbles\" && h.generationVersion >= 29) {\n" +
"    if (![2, 3, 4, 6].includes(type)) return 0;\n" +
"    const distance = fields.mountainDistance[index];\n" +
"    const talus = distance <= 3 ? Math.exp(-distance / 2) * fields.exposure[index] * fields.parentRock[index] * .25 : 0;\n" +
"    const fan = distance <= 10 && h.flow[index] > 35 && h.slope[index] < .03 ? Math.min(1, Math.log1p(h.flow[index]) / 6) * .1 : 0;\n" +
"    return h.gravel[index] * 18 + talus + fan;\n" +
"  }\n" +
"  if (key === \"pebbles\") return [2, 3, 4, 6].includes(type) ? h.gravel[index] * .5 +\n" +
"    Math.exp(-fields.mountainDistance[index] / 4) * (.3 + fields.exposure[index]) + fields.exposure[index] * fields.parentRock[index] * .2 : 0;\n" +
"  return 0;\n" +
"}\n" +
"\n" +
"return { createResourceHabitats, resourceHabitatSuitability };\n" +
"})();\n" +
"modules[\"server/island-coast.mjs\"] = (() => {\n" +
"function hash(x, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function createIslandCoast(size, seed, waterBudget) {\n" +
"  const profiles = Array.from({ length: 4 }, () => new Float32Array(size));\n" +
"  const cornerRadius = size * (.075 + hash(0, seed + 2459) * .025);\n" +
"  let total = 0;\n" +
"  for (let side = 0; side < profiles.length; side++) {\n" +
"    const phase = hash(side, seed + 2401) * Math.PI * 2;\n" +
"    const center = size * (.24 + hash(side, seed + 2411) * .5);\n" +
"    const width = size * (.035 + hash(side, seed + 2417) * .02);\n" +
"    const depth = 28 + hash(side, seed + 2423) * 20;\n" +
"    const companion = center > size * .5 ? center - size * .27 : center + size * .27;\n" +
"    for (let position = 0; position < size; position++) {\n" +
"      const t = position / (size - 1), along = Math.sin(t * Math.PI * 3 + phase) * .65 + Math.sin(t * Math.PI * 9 + phase * 1.7) * .35;\n" +
"      const inlet = depth * Math.exp(-(((position - center) / width) ** 2));\n" +
"      const cove = depth * .4 * Math.exp(-(((position - companion) / (width * .65)) ** 2));\n" +
"      const taper = Math.sin(t * Math.PI) ** .4;\n" +
"      const value = Math.max(.05, (.6 + Math.max(0, along) ** 2 * 6 + inlet + cove) * taper);\n" +
"      profiles[side][position] = value; total += value;\n" +
"    }\n" +
"  }\n" +
"  const cornerArea = cornerRadius * cornerRadius * (4 - Math.PI);\n" +
"  const scale = Math.max(0, waterBudget * .48 - (size * 4 - 4) - cornerArea) / total;\n" +
"  for (const profile of profiles) for (let index = 0; index < size; index++) profile[index] = 1 + profile[index] * scale;\n" +
"  const distance = new Float32Array(size * size);\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const qx = Math.abs(x - (size - 1) / 2) - ((size - 3) / 2 - cornerRadius);\n" +
"    const qy = Math.abs(y - (size - 1) / 2) - ((size - 3) / 2 - cornerRadius);\n" +
"    const rounded = cornerRadius - Math.hypot(Math.max(0, qx), Math.max(0, qy)) - Math.min(Math.max(qx, qy), 0);\n" +
"    distance[y * size + x] = Math.min(rounded, y - profiles[0][x], size - 1 - y - profiles[1][x], x - profiles[2][y], size - 1 - x - profiles[3][y]);\n" +
"  }\n" +
"  return { distance, profiles };\n" +
"}\n" +
"\n" +
"return { createIslandCoast };\n" +
"})();\n" +
"modules[\"server/continent-landscape.mjs\"] = (() => {\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function createContinentLandscape(size, seed) {\n" +
"  const length = size * size, height = new Float64Array(length), basement = new Float32Array(length);\n" +
"  const uplift = new Float32Array(length), offsetX = new Float32Array(length), offsetY = new Float32Array(length);\n" +
"  const direction = hash(0, 0, seed + 2503) * Math.PI * 2, ranges = [];\n" +
"  for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {\n" +
"    const order = row * 5 + column;\n" +
"    ranges.push({ x: (column + .25 + hash(order, 0, seed + 2521) * .5) * size / 5,\n" +
"      y: (row + .25 + hash(order, 0, seed + 2531) * .5) * size / 5,\n" +
"      angle: direction + hash(order, 0, seed + 2539) * 2.6 - 1.3,\n" +
"      along: 9 + hash(order, 0, seed + 2543) * 22, across: 3.5 + hash(order, 0, seed + 2549) * 5.5,\n" +
"      bend: 1 + hash(order, 0, seed + 2553) * 5, height: .36 + hash(order, 0, seed + 2551) * .12 });\n" +
"  }\n" +
"  const basins = Array.from({ length: 3 }, (_, order) => ({ x: size * (.15 + hash(order, 0, seed + 2557) * .7),\n" +
"    y: size * (.15 + hash(order, 0, seed + 2579) * .7), radius: 13 + hash(order, 0, seed + 2591) * 10 }));\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const index = y * size + x;\n" +
"    let relief = 0, depression = 0;\n" +
"    const warp = noise(x, y, 19, seed + 2593) * 4;\n" +
"    for (const range of ranges) {\n" +
"      const dx = x - range.x, dy = y - range.y, along = dx * Math.cos(range.angle) + dy * Math.sin(range.angle);\n" +
"      const across = -dx * Math.sin(range.angle) + dy * Math.cos(range.angle) + warp + Math.sin(along / 11) * range.bend;\n" +
"      const ridge = Math.exp(-(along * along / (range.along * range.along) + across * across / (range.across * range.across)));\n" +
"      const spur = .6 * Math.exp(-((along + range.along * .25) ** 2 / ((range.along * .55) ** 2) +\n" +
"        (across - along * .45) ** 2 / ((range.across * .7) ** 2)));\n" +
"      relief = Math.max(relief, range.height * Math.max(ridge, spur));\n" +
"    }\n" +
"    for (const basin of basins) depression += .09 * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));\n" +
"    basement[index] = .18 + ((x / size - .5) * Math.cos(direction) + (y / size - .5) * Math.sin(direction)) * .3 +\n" +
"      noise(x, y, 93, seed + 2609) * .065 + noise(x, y, 31, seed + 2617) * .018 - depression;\n" +
"    uplift[index] = relief;\n" +
"    height[index] = basement[index] + relief + noise(x, y, 7, seed + 2621) * .006;\n" +
"    offsetX[index] = hash(x, y, seed + 2633) * .4 - .2;\n" +
"    offsetY[index] = hash(x, y, seed + 2647) * .4 - .2;\n" +
"  }\n" +
"  return { height, basement, uplift, offsetX, offsetY, ranges, direction, erosionPasses: 18 };\n" +
"}\n" +
"\n" +
"return { createContinentLandscape };\n" +
"})();\n" +
"modules[\"server/continental-relief.mjs\"] = (() => {\n" +
"const { createContinentalFoundation, quantizeLandscapeValue } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { initializePlacementMaps, recordPlacementMap, placementNoise } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function ridge(points, width, height, type) { return { points, width, height, type }; }\n" +
"\n" +
"function distanceToRidge(point, feature) {\n" +
"  let nearest = Infinity;\n" +
"  for (let index = 1; index < feature.points.length; index++) {\n" +
"    const a = feature.points[index - 1], b = feature.points[index], dx = b.x - a.x, dy = b.y - a.y;\n" +
"    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));\n" +
"    nearest = Math.min(nearest, Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t));\n" +
"  }\n" +
"  return nearest;\n" +
"}\n" +
"\n" +
"function mountainSystems(size, seed, direction, capture, foundation) {\n" +
"  const systems = [], features = [], count = 3 + Math.floor(hash(0, 0, seed + 3109) * 2);\n" +
"  const onLand = point => foundation ? point.x >= 8 && point.y >= 8 && point.x < size - 8 && point.y < size - 8 &&\n" +
"    foundation.basement[Math.floor(point.y) * size + Math.floor(point.x)] > foundation.seaLevel + .025 : .2 + ((point.x / size - .5) * Math.cos(direction) + (point.y / size - .5) * Math.sin(direction)) * .45 +\n" +
"    noise(point.x, point.y, 113, seed + 2939) * .08 + noise(point.x, point.y, 39, seed + 2953) * .025 > .15;\n" +
"  if (!foundation) recordPlacementMap(capture, \"relief:range-eligibility\", [\"mountains\"], null,\n" +
"    { sample: (x, y) => onLand({ x, y }) ? 1 : 0, minimum: 0, maximum: 1 });\n" +
"  for (let order = 0; order < count; order++) {\n" +
"    const width = order === 0 ? 6 + hash(order, 0, seed + 3119) * 5 : 3.5 + hash(order, 0, seed + 3121) * 4;\n" +
"    const amplitude = order === 0 ? .65 + hash(order, 0, seed + 3137) * .3 : .36 + hash(order, 0, seed + 3163) * .32;\n" +
"    const desired = size * (order === 0 ? .43 + hash(order, 0, seed + 3167) * .2 : .2 + hash(order, 0, seed + 3169) * .2);\n" +
"    let chosen = null, best = -Infinity;\n" +
"    for (let attempt = 0; attempt < 96; attempt++) {\n" +
"      const center = { x: size * (.1 + hash(order, attempt, seed + 3181) * .8), y: size * (.1 + hash(order, attempt, seed + 3187) * .8) };\n" +
"      if (!onLand(center)) continue;\n" +
"      const angle = direction + (hash(order, attempt, seed + 3191) - .5) * 2.8, span = desired * (1 - attempt * .003);\n" +
"      const points = [];\n" +
"      for (let step = 0; step <= 8; step++) {\n" +
"        const along = (step / 8 - .5) * span, bend = noise(step * 19, order * 67 + attempt * 13, 35, seed + 3203) * size * .075;\n" +
"        points.push({ x: center.x + Math.cos(angle) * along - Math.sin(angle) * bend,\n" +
"          y: center.y + Math.sin(angle) * along + Math.cos(angle) * bend });\n" +
"      }\n" +
"      let separation = Infinity;\n" +
"      for (const other of systems) for (const point of points) separation = Math.min(separation, distanceToRidge(point, other) - width - other.width - 15);\n" +
"      if (separation > best) { chosen = ridge(points, width, amplitude, \"range\"); chosen.system = order; best = separation; }\n" +
"      if (separation >= 0) break;\n" +
"    }\n" +
"    if (chosen) { systems.push(chosen); features.push(chosen); }\n" +
"  }\n" +
"  for (const [order, system] of systems.entries()) {\n" +
"    const a = system.points[2], b = system.points[6], angle = Math.atan2(b.y - a.y, b.x - a.x);\n" +
"    const count = 2 + Math.floor(hash(order, 0, seed + 3209) * 2);\n" +
"    for (let branch = 0; branch < count; branch++) {\n" +
"      const origin = system.points[2 + Math.floor(hash(order, branch, seed + 3217) * 4)], side = branch % 2 ? -1 : 1;\n" +
"      const bearing = angle + side * (.65 + hash(order, branch, seed + 3221) * .7);\n" +
"      const width = system.width * (.3 + hash(order, branch, seed + 3229) * .25);\n" +
"      let reach = 15 + hash(order, branch, seed + 3251) * 35;\n" +
"      for (let attempt = 0; attempt < 5; attempt++) {\n" +
"        const points = [origin];\n" +
"        for (let step = 1; step <= 3; step++) points.push({ x: origin.x + Math.cos(bearing + step * .13 * side) * reach * step / 3,\n" +
"          y: origin.y + Math.sin(bearing + step * .13 * side) * reach * step / 3 });\n" +
"        const clear = systems.every(other => other === system || points.every(point => distanceToRidge(point, other) > width + other.width + 12));\n" +
"        if (clear) {\n" +
"          const feature = ridge(points, width, system.height * (.32 + hash(order, branch, seed + 3253) * .25), \"branch\");\n" +
"          feature.system = system.system; features.push(feature); break;\n" +
"        }\n" +
"        reach *= .6;\n" +
"      }\n" +
"    }\n" +
"  }\n" +
"  for (let order = 0; order < 5; order++) for (let attempt = 0; attempt < 48; attempt++) {\n" +
"    const center = { x: size * (.08 + hash(order, attempt, seed + 3257) * .84), y: size * (.08 + hash(order, attempt, seed + 3259) * .84) };\n" +
"    if (!onLand(center) || features.some(other => distanceToRidge(center, other) < other.width + 22)) continue;\n" +
"    const angle = hash(order, attempt, seed + 3271) * Math.PI * 2, span = 18 + hash(order, attempt, seed + 3299) * 30;\n" +
"    const points = [{x: center.x - Math.cos(angle) * span / 2, y: center.y - Math.sin(angle) * span / 2}, center,\n" +
"      {x: center.x + Math.cos(angle + .4) * span / 2, y: center.y + Math.sin(angle + .4) * span / 2}];\n" +
"    features.push(ridge(points, 3 + hash(order, attempt, seed + 3301) * 3, .21 + hash(order, attempt, seed + 3307) * .18, \"massif\")); break;\n" +
"  }\n" +
"  return features;\n" +
"}\n" +
"\n" +
"function createContinentalRelief(size, seed, version, capturePlacementMaps) {\n" +
"  if (version >= 32) return createSharedRelief(size, seed, capturePlacementMaps);\n" +
"  const capture = {}; initializePlacementMaps(capture, capturePlacementMaps);\n" +
"  const sources = {\n" +
"    warpX: placementNoise(capture, \"relief:warpX\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 27, seed + 2909)),\n" +
"    warpY: placementNoise(capture, \"relief:warpY\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 27, seed + 2917)),\n" +
"    width: placementNoise(capture, \"relief:width\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 18, seed + 2927)),\n" +
"    broad: placementNoise(capture, \"relief:broad\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 113, seed + 2939)),\n" +
"    detail: placementNoise(capture, \"relief:detail\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 39, seed + 2953)),\n" +
"    regional: placementNoise(capture, \"relief:regional\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 67, seed + 3343)),\n" +
"    coastBroad: placementNoise(capture, \"relief:coastBroad\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 61, seed + 3323)),\n" +
"    coastDetail: placementNoise(capture, \"relief:coastDetail\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 23, seed + 3329)),\n" +
"    surface: placementNoise(capture, \"relief:surface\", [\"mountains\", \"water\"], (x, y) => noise(x, y, 7, seed + 2957)),\n" +
"  };\n" +
"  const length = size * size, height = new Float64Array(length), basement = new Float32Array(length);\n" +
"  const coastShelf = capturePlacementMaps ? new Float32Array(length) : null;\n" +
"  const uplift = new Float32Array(length), offsetX = new Float32Array(length), offsetY = new Float32Array(length);\n" +
"  const direction = hash(0, 0, seed + 2707) * Math.PI * 2, ranges = version >= 27 ? mountainSystems(size, seed, direction, capture) : [];\n" +
"  const mainCount = 2 + Math.floor(hash(0, 0, seed + 2711) * 2);\n" +
"  if (!(version >= 27)) for (let order = 0; order < mainCount; order++) {\n" +
"    const angle = direction + (hash(order, 0, seed + 2713) - .5) * 2;\n" +
"    const centerX = size * (.16 + hash(order, 0, seed + 2719) * .68), centerY = size * (.16 + hash(order, 0, seed + 2729) * .68);\n" +
"    const span = size * (.45 + hash(order, 0, seed + 2731) * .5), points = [];\n" +
"    const width = 5 + hash(order, 0, seed + 2741) * 11, amplitude = .45 + hash(order, 0, seed + 2749) * .5;\n" +
"    for (let step = 0; step <= 8; step++) {\n" +
"      const along = (step / 8 - .5) * span, bend = noise(step * 19, order * 67, 35, seed + 2753) * size * .12;\n" +
"      points.push({ x: centerX + Math.cos(angle) * along - Math.sin(angle) * bend,\n" +
"        y: centerY + Math.sin(angle) * along + Math.cos(angle) * bend });\n" +
"    }\n" +
"    ranges.push(ridge(points, width, amplitude, \"range\"));\n" +
"    const branches = 2 + Math.floor(hash(order, 0, seed + 2767) * 4);\n" +
"    for (let branch = 0; branch < branches; branch++) {\n" +
"      const origin = points[1 + Math.floor(hash(order, branch, seed + 2777) * 6)], side = branch % 2 ? -1 : 1;\n" +
"      const bearing = angle + side * (.55 + hash(order, branch, seed + 2789) * .7), reach = 20 + hash(order, branch, seed + 2791) * 70;\n" +
"      const branchPoints = [origin];\n" +
"      for (let step = 1; step <= 3; step++) branchPoints.push({ x: origin.x + Math.cos(bearing + step * .12 * side) * reach * step / 3,\n" +
"        y: origin.y + Math.sin(bearing + step * .12 * side) * reach * step / 3 });\n" +
"      ranges.push(ridge(branchPoints, width * (.25 + hash(order, branch, seed + 2797) * .45), amplitude * (.3 + hash(order, branch, seed + 2801) * .35), \"branch\"));\n" +
"    }\n" +
"  }\n" +
"  const hillCount = (version >= 27 ? 18 : 12) + Math.floor(hash(0, 0, seed + 2803) * 17);\n" +
"  for (let order = 0; order < hillCount; order++) {\n" +
"    const x = hash(order, 0, seed + 2819) * size, y = hash(order, 0, seed + 2833) * size;\n" +
"    const angle = hash(order, 0, seed + 2837) * Math.PI * 2, reach = 3 + hash(order, 0, seed + 2843) * 15;\n" +
"    ranges.push(ridge([{ x, y }, { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach }],\n" +
"      2 + hash(order, 0, seed + 2851) * 6, (version >= 27 ? .11 : .07) + hash(order, 0, seed + 2857) * .17, \"hill\"));\n" +
"  }\n" +
"  const basins = Array.from({ length: 2 + Math.floor(hash(0, 0, seed + 2861) * 3) }, (_, order) => ({\n" +
"    x: size * (.1 + hash(order, 0, seed + 2879) * .8), y: size * (.1 + hash(order, 0, seed + 2887) * .8),\n" +
"    radius: 11 + hash(order, 0, seed + 2897) * 22, depth: .04 + hash(order, 0, seed + 2903) * .09 }));\n" +
"  const segments = [];\n" +
"  for (const range of ranges) for (let order = 1; order < range.points.length; order++) {\n" +
"    const a = range.points[order - 1], b = range.points[order], dx = b.x - a.x, dy = b.y - a.y;\n" +
"    segments.push({ a, dx, dy, lengthSquared: dx * dx + dy * dy, width: range.width, height: range.height,\n" +
"      taperStart: (order - 1) / (range.points.length - 1), taperEnd: order / (range.points.length - 1) });\n" +
"  }\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const index = y * size + x, wx = x + sources.warpX(x, y) * 4, wy = y + sources.warpY(x, y) * 4;\n" +
"    let relief = 0, depression = 0;\n" +
"    for (const segment of segments) {\n" +
"      const t = Math.max(0, Math.min(1, ((wx - segment.a.x) * segment.dx + (wy - segment.a.y) * segment.dy) / segment.lengthSquared));\n" +
"      const distance = Math.hypot(wx - segment.a.x - segment.dx * t, wy - segment.a.y - segment.dy * t);\n" +
"      if (distance > segment.width * 3) continue;\n" +
"      const along = segment.taperStart + (segment.taperEnd - segment.taperStart) * t;\n" +
"      const taper = .25 + .75 * Math.sin(along * Math.PI) ** .6;\n" +
"      const width = segment.width * (.7 + sources.width(wx, wy) * .3);\n" +
"      const feature = segment.height * taper * Math.exp(-(distance * distance) / (width * width));\n" +
"      relief = Math.max(relief, feature) + Math.min(relief, feature) * .08;\n" +
"    }\n" +
"    for (const basin of basins) depression += basin.depth * Math.exp(-((x - basin.x) ** 2 + (y - basin.y) ** 2) / (basin.radius * basin.radius));\n" +
"    basement[index] = .2 + ((x / size - .5) * Math.cos(direction) + (y / size - .5) * Math.sin(direction)) * (version >= 30 ? .26 : .45) +\n" +
"      sources.broad(x, y) * .08 + sources.detail(x, y) * .025 + (version >= 30 ? sources.regional(x, y) * .04 : 0) - depression;\n" +
"    if (version >= 28) {\n" +
"      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);\n" +
"      const cx = size * (.48 + hash(0, 0, seed + 3313) * .04), cy = size * (.48 + hash(0, 0, seed + 3319) * .04);\n" +
"      const radius = Math.hypot((x - cx) / (size * .53), (y - cy) / (size * .53));\n" +
"      const coast = (1 + sources.coastBroad(x, y) * .14 + sources.coastDetail(x, y) * .045 - radius) * size * .5;\n" +
"      const inland = Math.max(0, Math.min(1, coast / 24, (edge - 2) / 12));\n" +
"      const shelf = inland * inland * (3 - 2 * inland);\n" +
"      if (coastShelf) coastShelf[index] = shelf;\n" +
"      basement[index] = -.2 + (basement[index] + .2) * shelf;\n" +
"      relief *= shelf;\n" +
"    }\n" +
"    uplift[index] = relief;\n" +
"    height[index] = basement[index] + relief + sources.surface(x, y) * .009;\n" +
"    offsetX[index] = hash(x, y, seed + 2963) * .4 - .2;\n" +
"    offsetY[index] = hash(x, y, seed + 2969) * .4 - .2;\n" +
"  }\n" +
"  const result = { height, basement, uplift, offsetX, offsetY, ranges, direction, erosionPasses: 18,\n" +
"    natural: true, seaLevel: .065 + hash(0, 0, seed + 2971) * .025 };\n" +
"  if (capture.placementMaps) {\n" +
"    initializePlacementMaps(result, true); result.placementMaps.push(...capture.placementMaps);\n" +
"    recordPlacementMap(result, \"relief:coast-shelf\", [\"mountains\", \"water\"], coastShelf, { minimum: 0, maximum: 1 });\n" +
"    recordPlacementMap(result, \"relief:basement\", [\"mountains\", \"water\"], basement, {});\n" +
"    recordPlacementMap(result, \"relief:uplift\", [\"mountains\", \"water\"], uplift, { minimum: 0 });\n" +
"    recordPlacementMap(result, \"relief:height\", [\"mountains\", \"water\", \"forest\", \"swamp\"], height, {});\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function createSharedRelief(size, seed, enabled) {\n" +
"  const foundation = createContinentalFoundation(size, seed, enabled), { basement, direction, seaLevel, roughness } = foundation;\n" +
"  const ranges = mountainSystems(size, seed, direction, foundation, foundation);\n" +
"  const count = 18 + Math.floor(hash(0, 0, seed + 2803) * 17);\n" +
"  for (let order = 0; order < count; order++) {\n" +
"    const x = hash(order, 0, seed + 2819) * size, y = hash(order, 0, seed + 2833) * size;\n" +
"    if (basement[Math.floor(y) * size + Math.floor(x)] < seaLevel - .08) continue;\n" +
"    const angle = hash(order, 0, seed + 2837) * Math.PI * 2, reach = 3 + hash(order, 0, seed + 2843) * 15;\n" +
"    ranges.push(ridge([{ x, y }, { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach }],\n" +
"      2 + hash(order, 0, seed + 2851) * 6, .11 + hash(order, 0, seed + 2857) * .17, \"hill\"));\n" +
"  }\n" +
"  const segments = [];\n" +
"  for (const range of ranges) for (let order = 1; order < range.points.length; order++) {\n" +
"    const a = range.points[order - 1], b = range.points[order], dx = b.x - a.x, dy = b.y - a.y;\n" +
"    segments.push({ a, dx, dy, lengthSquared: dx * dx + dy * dy, width: range.width, height: range.height,\n" +
"      start: (order - 1) / (range.points.length - 1), end: order / (range.points.length - 1) });\n" +
"  }\n" +
"  const height = new Float64Array(size * size), uplift = new Float32Array(height.length), offsetX = new Float32Array(height.length), offsetY = new Float32Array(height.length);\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const index = y * size + x, wx = x + roughness(x + 23, y - 17) * 3, wy = y + roughness(x - 11, y + 37) * 3;\n" +
"    let relief = 0;\n" +
"    for (const segment of segments) {\n" +
"      const t = Math.max(0, Math.min(1, ((wx - segment.a.x) * segment.dx + (wy - segment.a.y) * segment.dy) / segment.lengthSquared));\n" +
"      const distance = Math.hypot(wx - segment.a.x - segment.dx * t, wy - segment.a.y - segment.dy * t);\n" +
"      if (distance > segment.width * 3) continue;\n" +
"      const along = segment.start + (segment.end - segment.start) * t, width = segment.width * (.85 + roughness(x, y) * .2);\n" +
"      const value = segment.height * (.25 + .75 * Math.sin(along * Math.PI) ** .6) * Math.exp(-distance * distance / (width * width));\n" +
"      relief = Math.max(relief, value) + Math.min(relief, value) * .08;\n" +
"    }\n" +
"    uplift[index] = quantizeLandscapeValue(relief); height[index] = quantizeLandscapeValue(basement[index] + uplift[index]);\n" +
"    offsetX[index] = hash(x, y, seed + 2963) * .4 - .2; offsetY[index] = hash(x, y, seed + 2969) * .4 - .2;\n" +
"  }\n" +
"  const result = { height, basement, bedrock: foundation.bedrock, uplift, offsetX, offsetY, ranges, direction, seaLevel, erosionPasses: 18, natural: true };\n" +
"  if (enabled) {\n" +
"    initializePlacementMaps(result, true); result.placementMaps.push(...foundation.placementMaps);\n" +
"    recordPlacementMap(result, \"relief:uplift\", [\"mountains\", \"water\"], uplift, { minimum: 0, stage: \"intermediate\" });\n" +
"    recordPlacementMap(result, \"relief:height\", [\"mountains\", \"water\", \"forest\", \"swamp\"], height, { stage: \"intermediate\" });\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"return { createContinentalRelief };\n" +
"})();\n" +
"modules[\"server/terrain-sediment.mjs\"] = (() => {\n" +
"function routeTerrainSediment(formed, water, river, discharge, normalDepth) {\n" +
"  const {size,height,drainage,profile,erosion}=formed,length=height.length,dx=profile.cellMeters;\n" +
"  const diameters=[.032,.001,.00002],fractions=[.35,.5,.15];\n" +
"  const load=diameters.map(()=>new Float64Array(length)),deposit=diameters.map(()=>new Float64Array(length)),bankGravel=new Float32Array(length);\n" +
"  const exported=[0,0,0],produced=[0,0,0],stored=[0,0,0],annualSeconds=31557600,eventFraction=.05;\n" +
"  for(let index=0;index<length;index++)if(!formed.sea[index])for(let grain=0;grain<3;grain++){\n" +
"    const source=erosion[index]*dx*dx*fractions[grain];load[grain][index]=source;produced[grain]+=source;\n" +
"  }\n" +
"  for(let cursor=drainage.order.length-1;cursor>=0;cursor--){\n" +
"    const index=drainage.order[cursor],parent=drainage.parent[index];\n" +
"    if(formed.sea[index]||parent<0){for(let grain=0;grain<3;grain++)exported[grain]+=load[grain][index];continue;}\n" +
"    const x=index%size,y=Math.floor(index/size),nx=parent%size,ny=Math.floor(parent/size);\n" +
"    const distance=dx*Math.hypot(nx-x,ny-y),tx=-(ny-y)*dx/distance,ty=(nx-x)*dx/distance;\n" +
"    const bedSlope=Math.max(.00001,(drainage.level[index]-(formed.sea[parent]?0:drainage.level[parent]))/distance);\n" +
"    const left=Math.round(y+ty)*size+Math.round(x+tx),right=Math.round(y-ty)*size+Math.round(x-tx);\n" +
"    const a=Math.max(.0001,(height[left]-height[index])/dx),b=Math.max(.0001,(height[right]-height[index])/dx);\n" +
"    const cross=normalDepth(discharge[index]*6,bedSlope,a,b,profile.manning),stress=1000*9.81*cross.depth*bedSlope;\n" +
"    const coarse=load[0][index]+load[1][index],sandFraction=coarse?load[1][index]/coarse:fractions[1]/(fractions[0]+fractions[1]);\n" +
"    const mean=Math.exp((1-sandFraction)*Math.log(diameters[0])+sandFraction*Math.log(diameters[1]));\n" +
"    const reference=(.021+.015*Math.exp(-20*sandFraction))*1650*9.81*mean;\n" +
"    const targets=[];\n" +
"    if(river[index]){\n" +
"      const reach=Math.max(1,Math.ceil(cross.width/(2*dx)));\n" +
"      for(let offset=-reach;offset<=reach;offset++){\n" +
"        const px=Math.round(x+tx*offset),py=Math.round(y+ty*offset);if(px<0||py<0||px>=size||py>=size)continue;\n" +
"        const target=py*size+px;\n" +
"        if(!water[target]&&Math.abs(height[target]-height[index])<=Math.max(2,cross.depth*2))targets.push([target,Math.exp(-Math.abs(offset))]);\n" +
"      }\n" +
"    }\n" +
"    if(!targets.length)targets.push([index,1]);\n" +
"    const totalWeight=targets.reduce((sum,item)=>sum+item[1],0);\n" +
"    const mixture=load[0][index]+load[1][index]+load[2][index];\n" +
"    if(river[index]&&mixture>0)for(const side of[-1,1]){\n" +
"      const px=Math.round(x+tx*side),py=Math.round(y+ty*side);if(px<0||py<0||px>=size||py>=size)continue;\n" +
"      const target=py*size+px;if(water[target])continue;\n" +
"      const bedGravel=fractions[0]/(fractions[0]+fractions[1]);\n" +
"      bankGravel[target]=Math.max(bankGravel[target],.5*Math.max(bedGravel,load[0][index]/mixture));\n" +
"    }\n" +
"    for(let grain=0;grain<3;grain++){\n" +
"      const incoming=load[grain][index],diameter=diameters[grain];let outgoing;\n" +
"      if(water[index]===2){\n" +
"        const settling=1.65*9.81*diameter*diameter/(18*.000001+Math.sqrt(.75*1.65*9.81*diameter**3));\n" +
"        outgoing=incoming*Math.exp(-settling*distance/Math.max(.000001,cross.velocity*Math.max(.5,drainage.level[index]-height[index])));\n" +
"      }else if(grain===2){\n" +
"        const settling=1.65*9.81*diameter*diameter/(18*.000001+Math.sqrt(.75*1.65*9.81*diameter**3));\n" +
"        outgoing=incoming*Math.exp(-settling*distance/Math.max(.000001,cross.velocity*cross.depth));\n" +
"      }else{\n" +
"        const proportion=grain===0?1-sandFraction:sandFraction;\n" +
"        const exponent=.67/(1+Math.exp(1.5-diameter/mean)),phi=stress/(reference*(diameter/mean)**exponent);\n" +
"        const transport=phi<1.35?.002*phi**7.5:14*(1-.894/Math.sqrt(phi))**4.5;\n" +
"        const capacity=transport*proportion*Math.pow(stress/1000,1.5)*cross.width/(1.65*9.81)*annualSeconds*eventFraction;\n" +
"        outgoing=Math.min(incoming,Math.max(0,capacity));\n" +
"      }\n" +
"      const retained=incoming-outgoing;stored[grain]+=retained;\n" +
"      for(const [target,weight]of targets){\n" +
"        deposit[grain][target]+=retained*weight/totalWeight;\n" +
"        if(grain===0&&river[index]&&!water[target]&&mixture>0)bankGravel[target]=Math.max(bankGravel[target],(incoming/mixture)*(.25+.75*retained/Math.max(.000000001,incoming))*weight);\n" +
"      }\n" +
"      load[grain][parent]+=outgoing;\n" +
"    }\n" +
"  }\n" +
"  const exposureYears=1000,gravel=new Float32Array(length),sand=new Float32Array(length),fines=new Float32Array(length),cover=new Float32Array(length),flux=new Float64Array(length);\n" +
"  for(let index=0;index<length;index++){\n" +
"    gravel[index]=deposit[0][index]*exposureYears/(dx*dx);sand[index]=deposit[1][index]*exposureYears/(dx*dx);fines[index]=deposit[2][index]*exposureYears/(dx*dx);\n" +
"    cover[index]=gravel[index]+sand[index]+fines[index];flux[index]=load[0][index]+load[1][index]+load[2][index];\n" +
"  }\n" +
"  return {gravel,sand,fines,cover,bankGravel,flux,budget:{produced,stored,exported},diameters,fractions,exposureYears,eventFraction};\n" +
"}\n" +
"\n" +
"return { routeTerrainSediment };\n" +
"})();\n" +
"modules[\"server/terrain-formation.mjs\"] = (() => {\n" +
"const { createLandscapeField, normalProbability, routeLandscape, selectContinentalSea } = modules[\"server/landscape-fields.mjs\"];\n" +
"const { landscapeHash, quantizeLandscapeValue } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { initializePlacementMaps, recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"const { routeTerrainSediment } = modules[\"server/terrain-sediment.mjs\"];\n" +
"\n" +
"const TERRAIN_FORMATION_PROFILE = Object.freeze({\n" +
"  version:33, size:320, cellMeters:80, landTarget:.8, landMinimum:.7, landMaximum:.85,\n" +
"  continentCorrelation:80, continentSmoothness:.75, upliftCorrelation:64, resistanceCorrelation:32,\n" +
"  vegetationCorrelation:5,\n" +
"  upliftRate:.001, erodibility:.00002, drainageExponent:.4, slopeExponent:1,\n" +
"  diffusion:.1, criticalSlope:.57, durationYears:1600000, stepYears:10000,\n" +
"  precipitation:1, runoff:.35, riverArea:12000000, headwaterArea:320000, manning:.035,\n" +
"  sources:{ terrain:\"https://doi.org/10.1111/cgf.15033\", wetness:\"https://doi.org/10.5194/hess-10-101-2006\",\n" +
"    drainageHeight:\"https://doi.org/10.1016/j.jhydrol.2011.03.051\", sediment:\"https://doi.org/10.1061/(ASCE)0733-9429(2003)129:2(120)\",\n" +
"    settling:\"https://doi.org/10.1306/051204740933\" },\n" +
"  adopted:{upliftRate:.001,erodibility:.00002,drainageExponent:.4,slopeExponent:1,diffusion:.1,criticalSlope:.57},\n" +
"  selected:{cellMeters:80,landTarget:.8,continentCorrelation:80,upliftCorrelation:64,resistanceCorrelation:32,\n" +
"    upliftLow:.005,upliftHigh:2,upliftActivation:.45,continentContrast:1,continentSmoothness:.75,edgeFalloff:.03,durationYears:1600000,stepYears:10000,\n" +
"    runoff:.35,riverArea:12000000,headwaterArea:320000,manning:.035,eventMultiplier:6,eventFraction:.05,\n" +
"    sedimentExposureYears:1000,grainDiameters:[.032,.001,.00002],grainFractions:[.35,.5,.15]},\n" +
"  assumptions:[\"spatial-input-priors\",\"80-metre-grid\",\"fixed-coast\",\"uniform-annual-runoff\",\"finite-time-implicit-stream-power\",\"terrain-conditioned-resource-occurrence\"]\n" +
"});\n" +
"\n" +
"function record(owner,id,layers,values,details) {\n" +
"  recordPlacementMap(owner,id,layers,values,{schemaVersion:33,...details});\n" +
"}\n" +
"\n" +
"function formContinentalTerrain(size, seed, capture, version) {\n" +
"  const base = TERRAIN_FORMATION_PROFILE, scale = version !== undefined && version < 36 ? 1 : Math.min(1,size/base.size);\n" +
"  let profile = scale === 1 ? base : { ...base, version:36, size,\n" +
"    continentCorrelation:base.continentCorrelation*scale, upliftCorrelation:base.upliftCorrelation*scale,\n" +
"    resistanceCorrelation:base.resistanceCorrelation*scale, vegetationCorrelation:Math.max(3,base.vegetationCorrelation*scale),\n" +
"    upliftRate:base.upliftRate*scale, reliefScale:scale, riverArea:base.riverArea*scale*scale, headwaterArea:base.headwaterArea*scale*scale,\n" +
"    mountainFraction:.2, forestFraction:.22, swampFraction:.07, dryLandFraction:.12, riverWidthMaximum:base.cellMeters*size/64,\n" +
"    adopted:{...base.adopted,upliftRate:base.upliftRate*scale},\n" +
"    selected:{...base.selected,continentCorrelation:base.continentCorrelation*scale,upliftCorrelation:base.upliftCorrelation*scale,\n" +
"      resistanceCorrelation:base.resistanceCorrelation*scale,riverArea:base.riverArea*scale*scale,headwaterArea:base.headwaterArea*scale*scale} };\n" +
"  if (version === undefined || version >= 37) profile = { ...profile, version:37,\n" +
"    upliftCorrelation:24*scale, mountainFraction:.16,\n" +
"    selected:{...profile.selected,upliftCorrelation:24*scale,upliftActivation:.6} };\n" +
"  const length = size*size, owner = {};\n" +
"  initializePlacementMaps(owner,capture);\n" +
"  const continentField = createLandscapeField(size,seed+4001,profile.continentCorrelation,profile.continentSmoothness);\n" +
"  const upliftField = createLandscapeField(size,seed+4127,profile.upliftCorrelation,1.5);\n" +
"  const resistanceField = createLandscapeField(size,seed+17011,profile.resistanceCorrelation,1.5);\n" +
"  const continentality = new Float32Array(length), uplift = new Float32Array(length), resistance = new Float32Array(length);\n" +
"  for (let index = 0; index < length; index++) {\n" +
"    const x=index%size,y=Math.floor(index/size);\n" +
"    continentality[index] = normalProbability(continentField[index])-Math.exp(-x/(size*.03))-Math.exp(-(size-1-x)/(size*.03))-Math.exp(-y/(size*.03))-Math.exp(-(size-1-y)/(size*.03));\n" +
"    const rise = Math.max(0,(normalProbability(upliftField[index])-profile.selected.upliftActivation)/(1-profile.selected.upliftActivation));\n" +
"    uplift[index] = profile.upliftRate*(.005+1.995*rise*rise);\n" +
"    resistance[index] = normalProbability(resistanceField[index]);\n" +
"  }\n" +
"  let selected = selectContinentalSea(continentality,size);\n" +
"  if (scale < 1) for (let strength=2; strength<=64 && (selected.landFraction<profile.landMinimum || selected.landFraction>profile.landMaximum); strength*=2) {\n" +
"    for (let index=0;index<length;index++) {\n" +
"      const x=index%size,y=Math.floor(index/size);\n" +
"      continentality[index]=normalProbability(continentField[index])-strength*(Math.exp(-x/(size*.03))+Math.exp(-(size-1-x)/(size*.03))+Math.exp(-y/(size*.03))+Math.exp(-(size-1-y)/(size*.03)));\n" +
"    }\n" +
"    selected=selectContinentalSea(continentality,size);\n" +
"  }\n" +
"  const {sea,threshold,landFraction}=selected;\n" +
"  if (landFraction<profile.landMinimum||landFraction>profile.landMaximum) throw new Error(\"대륙 면적 비율을 만족하는 해수면 기준을 찾지 못했습니다.\");\n" +
"  let height = new Float64Array(length), nextHeight = new Float64Array(length);\n" +
"  for (let index = 0; index < length; index++) height[index] = sea[index] ? -2-80*Math.max(0,threshold-continentality[index]) :\n" +
"    Math.max(.01,80*(continentality[index]-threshold)+landscapeHash(index,0,seed+5119)*.5);\n" +
"  const initialHeight = new Float64Array(height), erosion = new Float32Array(length), delta = new Float64Array(length);\n" +
"  const dt=profile.stepYears, dx=profile.cellMeters, diffusion=profile.diffusion*dt/(dx*dx);\n" +
"  const years = profile.durationYears/profile.stepYears;\n" +
"  let drainage;\n" +
"  for (let step=0;step<years;step++) {\n" +
"    drainage=routeLandscape(height,sea,size);\n" +
"    nextHeight.set(height);\n" +
"    for (const index of drainage.order) {\n" +
"      if(sea[index])continue;\n" +
"      const parent=drainage.parent[index]; if(parent<0)continue;\n" +
"      const distance=dx*Math.hypot(index%size-parent%size,Math.floor(index/size)-Math.floor(parent/size));\n" +
"      const erodibility=profile.erodibility*(2-1.5*resistance[index]);\n" +
"      const rate=erodibility*Math.pow(profile.runoff*drainage.area[index],profile.drainageExponent)*dt/distance;\n" +
"      const base=sea[parent]?0:Math.max(0,nextHeight[parent]);\n" +
"      const raised=Math.max(0,height[index])+uplift[index]*dt;\n" +
"      nextHeight[index]=raised>base?(raised+rate*base)/(1+rate):raised;\n" +
"      if(step===years-1)erosion[index]=Math.max(0,(raised-nextHeight[index])/dt);\n" +
"    }\n" +
"    delta.fill(0);\n" +
"    for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){\n" +
"      const index=y*size+x;if(sea[index])continue;\n" +
"      for(const other of [index+1,index+size]){\n" +
"        const transfer=diffusion*(nextHeight[index]-(sea[other]?0:nextHeight[other]));\n" +
"        delta[index]-=transfer;if(!sea[other])delta[other]+=transfer;\n" +
"      }\n" +
"    }\n" +
"    for(let index=0;index<length;index++)if(!sea[index])height[index]=Math.max(.0001,nextHeight[index]+delta[index]);\n" +
"    for(let relaxation=0;relaxation<2;relaxation++){\n" +
"      delta.fill(0);\n" +
"      for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){\n" +
"        const index=y*size+x;if(sea[index])continue;\n" +
"        for(const other of [index+1,index+size]){\n" +
"          const difference=height[index]-(sea[other]?0:height[other]),excess=Math.abs(difference)-profile.criticalSlope*dx;\n" +
"          if(excess<=0)continue;\n" +
"          const transfer=Math.sign(difference)*excess*.12;delta[index]-=transfer;if(!sea[other])delta[other]+=transfer;\n" +
"        }\n" +
"      }\n" +
"      for(let index=0;index<length;index++)if(!sea[index])height[index]=Math.max(.0001,height[index]+delta[index]);\n" +
"    }\n" +
"    for(let index=0;index<length;index++)height[index]=quantizeLandscapeValue(height[index]);\n" +
"  }\n" +
"  drainage=routeLandscape(height,sea,size);\n" +
"  const layers=[\"mountains\",\"water\",\"forest\",\"swamp\",\"resources\",\"camps\",\"units\"];\n" +
"  record(owner,\"terrain:roughness\",layers,continentField,{stage:\"original\"});\n" +
"  record(owner,\"relief:uplift\",layers,upliftField,{stage:\"original\"});\n" +
"  record(owner,\"geology:bedrock-noise\",layers,resistanceField,{stage:\"original\"});\n" +
"  record(owner,\"relief:uplift-rate\",layers,uplift,{stage:\"intermediate\",minimum:0,maximum:.002});\n" +
"  record(owner,\"geology:resistance\",layers,resistance,{stage:\"intermediate\",minimum:0,maximum:1});\n" +
"  record(owner,\"terrain:basement\",[\"mountains\",\"water\"],initialHeight,{stage:\"intermediate\"});\n" +
"  return {size,seed,profile,sea,landFraction,threshold,continentality,uplift,resistance,height,initialHeight,erosion,drainage,owner};\n" +
"}\n" +
"\n" +
"function normalDepth(discharge,slope,leftSlope,rightSlope,roughness) {\n" +
"  const gradient=Math.max(.00001,slope),left=Math.max(.0001,leftSlope),right=Math.max(.0001,rightSlope);\n" +
"  function section(depth){\n" +
"    const width=depth/left+depth/right,area=depth*width*.5,perimeter=depth*Math.sqrt(1+1/(left*left))+depth*Math.sqrt(1+1/(right*right));\n" +
"    const velocity=Math.pow(area/Math.max(1e-9,perimeter),2/3)*Math.sqrt(gradient)/roughness;\n" +
"    return {width,velocity,flow:area*velocity};\n" +
"  }\n" +
"  let lower=0,upper=.05;while(section(upper).flow<discharge&&upper<1000)upper*=2;\n" +
"  for(let step=0;step<30;step++){const middle=(lower+upper)/2;if(section(middle).flow<discharge)lower=middle;else upper=middle;}\n" +
"  return {depth:upper,...section(upper)};\n" +
"}\n" +
"\n" +
"function generateFormedLandscape(terrain,moisture,heightField,size,seed,capture,version) {\n" +
"  const formed=formContinentalTerrain(size,seed,capture,version),{height,sea,drainage,profile}=formed,length=height.length,dx=profile.cellMeters;\n" +
"  const water=new Uint8Array(length),river=new Uint8Array(length),lake=new Uint8Array(length),slope=new Float32Array(length);\n" +
"  const waterSurface=new Float64Array(length),waterDistance=new Uint8Array(length).fill(255),queue=new Int32Array(length);\n" +
"  const gravel=new Float32Array(length),sand=new Float32Array(length),fines=new Float32Array(length),cover=new Float32Array(length);\n" +
"  const discharge=new Float32Array(length),depth=new Float32Array(length),velocity=new Float32Array(length),width=new Float32Array(length);\n" +
"  const basin=new Int32Array(length).fill(-1),childCount=new Uint8Array(length),headwaters=[],confluences=[],fordCandidates=[];\n" +
"  const channels=[],riverMouths=[],basinSizes=new Map(),pondDepth=new Float32Array(length),rainfall=new Float32Array(length).fill(1);\n" +
"  const ground=new Float64Array(height),flow=new Float64Array(length),sediment=new Float64Array(length),wetness=new Float32Array(length),rock=new Float32Array(length);\n" +
"  for(const index of drainage.order){\n" +
"    const parent=drainage.parent[index];\n" +
"    flow[index]=drainage.area[index]/(dx*dx);discharge[index]=drainage.area[index]*profile.precipitation*profile.runoff/31557600;\n" +
"    if(sea[index]){water[index]=3;waterSurface[index]=0;terrain[index]=0;continue;}\n" +
"    const x=index%size,y=Math.floor(index/size);let maximum=0;\n" +
"    for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<size&&ny<size)maximum=Math.max(maximum,Math.abs(height[index]-Math.max(0,height[ny*size+nx]))/dx);\n" +
"    slope[index]=maximum;pondDepth[index]=Math.max(0,drainage.level[index]-height[index]);\n" +
"    basin[index]=parent<0||sea[parent]?index:basin[parent];\n" +
"    sediment[index]=formed.erosion[index]*dx*dx;\n" +
"    const radius=Math.max(3,Math.round((profile.version>=37?6:10)*(profile.reliefScale||1))),west=y*size+Math.max(0,x-radius),east=y*size+Math.min(size-1,x+radius);\n" +
"    const north=Math.max(0,y-radius)*size+x,south=Math.min(size-1,y+radius)*size+x;\n" +
"    const neighborhood=(height[west]+height[east]+height[north]+height[south])/4;\n" +
"    const relief=height[index]-neighborhood,range=Math.max(height[west],height[east],height[north],height[south])-Math.min(height[west],height[east],height[north],height[south]);\n" +
"    terrain[index]=relief>250*(profile.reliefScale||1)&&maximum>.35?8:relief>120*(profile.reliefScale||1)&&maximum>.22?7:(range>=120*(profile.reliefScale||1)&&maximum>=.12||relief>=40*(profile.reliefScale||1)&&maximum>=.08)?6:4;\n" +
"    if(pondDepth[index]>.5){water[index]=2;lake[index]=1;waterSurface[index]=drainage.level[index];terrain[index]=1;}\n" +
"  }\n" +
"  const marked=new Uint8Array(length);\n" +
"  for(let index=0;index<length;index++)if(!sea[index]&&!lake[index]&&drainage.area[index]>=profile.riverArea)marked[index]=1;\n" +
"  const mainTributary=new Int32Array(length).fill(-1),trunkHeads=[];\n" +
"  for(let index=0;index<length;index++){\n" +
"    if(sea[index])continue;const parent=drainage.parent[index];if(parent<0)continue;\n" +
"    if(mainTributary[parent]<0||drainage.area[index]>drainage.area[mainTributary[parent]])mainTributary[parent]=index;\n" +
"  }\n" +
"  for(let index=0;index<length;index++)if(marked[index]&&(mainTributary[index]<0||!marked[mainTributary[index]]))trunkHeads.push(index);\n" +
"  for(const head of trunkHeads){\n" +
"    let next=mainTributary[head];\n" +
"    while(next>=0&&!sea[next]&&!lake[next]&&drainage.area[next]>=profile.headwaterArea){marked[next]=1;next=mainTributary[next];}\n" +
"  }\n" +
"  for(let index=0;index<length;index++)if(marked[index]){\n" +
"    const parent=drainage.parent[index];if(parent>=0&&marked[parent])childCount[parent]++;\n" +
"  }\n" +
"  for(const index of drainage.order){\n" +
"    if(!marked[index])continue;\n" +
"    const parent=drainage.parent[index],x=index%size,y=Math.floor(index/size);\n" +
"    if(!childCount[index])headwaters.push(index);if(childCount[index]>1)confluences.push(index);\n" +
"    const nx=parent>=0?parent%size:x,ny=parent>=0?Math.floor(parent/size):y,along=Math.max(1,Math.hypot(nx-x,ny-y));\n" +
"    const tx=-(ny-y)/along,ty=(nx-x)/along;\n" +
"    const leftIndex=Math.max(0,Math.min(size-1,Math.round(y+ty)))*size+Math.max(0,Math.min(size-1,Math.round(x+tx)));\n" +
"    const rightIndex=Math.max(0,Math.min(size-1,Math.round(y-ty)))*size+Math.max(0,Math.min(size-1,Math.round(x-tx)));\n" +
"    const bedSlope=parent>=0?Math.max(.00001,(drainage.level[index]-(sea[parent]?0:drainage.level[parent]))/(dx*along)):.00001;\n" +
"    const leftSlope=Math.max(.0001,(height[leftIndex]-height[index])/dx),rightSlope=Math.max(.0001,(height[rightIndex]-height[index])/dx);\n" +
"    const cross=normalDepth(discharge[index]*4/9,bedSlope,leftSlope,rightSlope,profile.manning);\n" +
"    cross.depth=Math.max(cross.depth,parent>=0?waterSurface[parent]-height[index]+.00001:0);\n" +
"    cross.width=cross.depth*(1/leftSlope+1/rightSlope);\n" +
"    if (profile.reliefScale) cross.width=Math.min(profile.riverWidthMaximum,Math.max(cross.width,dx*size/160*(.35+.65*Math.min(1,Math.sqrt(drainage.area[index]/(profile.riverArea*6))))));\n" +
"    cross.velocity=(discharge[index]*4/9)/Math.max(.000000001,cross.depth*cross.width/2);\n" +
"    width[index]=cross.width;depth[index]=cross.depth;velocity[index]=cross.velocity;\n" +
"    water[index]=1;river[index]=1;terrain[index]=cross.depth>.7?0:1;waterSurface[index]=height[index]+cross.depth;\n" +
"    basinSizes.set(basin[index],(basinSizes.get(basin[index])||0)+1);\n" +
"    const point={x:x+.5,y:y+.5,surface:waterSurface[index],bed:height[index],flow:flow[index],discharge:discharge[index],width:cross.width,radius:cross.width/(2*dx),sediment:sediment[index]};\n" +
"    const tail=parent>=0?{...point,x:nx+.5,y:ny+.5,surface:sea[parent]?0:Math.min(point.surface,height[parent]+cross.depth),bed:height[parent]}:point;\n" +
"    channels.push({basin:basin[index],points:[point,tail]});\n" +
"    if(parent>=0&&sea[parent])riverMouths.push({...tail,surface:0});\n" +
"    if(cross.depth<=.3&&cross.velocity<=.6&&bedSlope<=.01)fordCandidates.push({index,x,y,cross,tx,ty});\n" +
"  }\n" +
"  for(const channel of channels){\n" +
"    const point=channel.points[0],tail=channel.points[1],radius=point.radius;\n" +
"    if(radius<=.5)continue;\n" +
"    for(let y=Math.max(0,Math.floor(point.y-radius-1));y<=Math.min(size-1,Math.ceil(point.y+radius+1));y++)for(let x=Math.max(0,Math.floor(point.x-radius-1));x<=Math.min(size-1,Math.ceil(point.x+radius+1));x++){\n" +
"      const index=y*size+x;if(sea[index]||lake[index]||height[index]>=point.surface)continue;\n" +
"      const sx=tail.x-point.x,sy=tail.y-point.y,t=Math.max(0,Math.min(1,((x+.5-point.x)*sx+(y+.5-point.y)*sy)/(sx*sx+sy*sy)));\n" +
"      if(Math.hypot(x+.5-point.x-t*sx,y+.5-point.y-t*sy)>radius)continue;\n" +
"      water[index]=1;river[index]=1;waterSurface[index]=Math.max(waterSurface[index],point.surface);terrain[index]=point.surface-height[index]>.7?0:1;\n" +
"    }\n" +
"  }\n" +
"  const sedimentTransport=routeTerrainSediment(formed,water,river,discharge,normalDepth);\n" +
"  gravel.set(sedimentTransport.gravel);sand.set(sedimentTransport.sand);fines.set(sedimentTransport.fines);cover.set(sedimentTransport.cover);sediment.set(sedimentTransport.flux);\n" +
"  for(const channel of channels)for(const point of channel.points)point.sediment=sediment[Math.floor(point.y)*size+Math.floor(point.x)];\n" +
"  let end=0;\n" +
"  for(let index=0;index<length;index++)if(water[index]){waterDistance[index]=0;queue[end++]=index;}\n" +
"  for(let cursor=0;cursor<end;cursor++){\n" +
"    const index=queue[cursor],x=index%size,y=Math.floor(index/size);\n" +
"    for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<size&&ny<size){const next=ny*size+nx;if(waterDistance[next]<=waterDistance[index]+1)continue;waterDistance[next]=waterDistance[index]+1;queue[end++]=next;}\n" +
"  }\n" +
"  const fords=[];\n" +
"  for(const candidate of fordCandidates){\n" +
"    if(fords.some(other=>Math.hypot(other.x-candidate.x,other.y-candidate.y)<10))continue;\n" +
"    const a=Math.round(candidate.y+candidate.ty)*size+Math.round(candidate.x+candidate.tx),b=Math.round(candidate.y-candidate.ty)*size+Math.round(candidate.x-candidate.tx);\n" +
"    if(a<0||b<0||a>=length||b>=length||water[a]||water[b])continue;\n" +
"    terrain[candidate.index]=10;fords.push({x:candidate.x,y:candidate.y,cells:[candidate.index],width:width[candidate.index],depth:depth[candidate.index],velocity:velocity[candidate.index]});\n" +
"  }\n" +
"  for(let index=0;index<length;index++){\n" +
"    heightField[index]=height[index];wetness[index]=Math.exp(-waterDistance[index]/8);moisture[index]=wetness[index]-.5;\n" +
"    rock[index]=formed.resistance[index];\n" +
"    if(!water[index]&&waterDistance[index]<=2&&slope[index]<.1&&(sand[index]>.02||Array.from([index-1,index+1,index-size,index+size]).some(next=>next>=0&&next<length&&sea[next])))terrain[index]=2;\n" +
"  }\n" +
"  if (profile.mountainFraction) {\n" +
"    const mountains=[];let land=0;\n" +
"    for(let index=0;index<length;index++) {\n" +
"      if(water[index])continue;land++;\n" +
"      if(terrain[index]<6||terrain[index]>8)continue;\n" +
"      const x=index%size,y=Math.floor(index/size),radius=Math.max(3,Math.round(size/32));\n" +
"      const neighbors=[height[y*size+Math.max(0,x-radius)],height[y*size+Math.min(size-1,x+radius)],height[Math.max(0,y-radius)*size+x],height[Math.min(size-1,y+radius)*size+x]];\n" +
"      const prominence=Math.max(0,height[index]-neighbors.reduce((sum,value)=>sum+value,0)/4);\n" +
"      mountains.push({index,score:prominence+slope[index]*80+height[index]*.05});\n" +
"    }\n" +
"    mountains.sort((a,b)=>b.score-a.score||a.index-b.index);\n" +
"    for(const {index} of mountains.slice(Math.round(land*profile.mountainFraction)))terrain[index]=4;\n" +
"  }\n" +
"  const result={size,seed,generationVersion:profile.version,profile,height:ground,ground,surface:drainage.level,waterSurface,\n" +
"    downstream:drainage.parent,downstreamOrder:drainage.order,flow,drainageArea:drainage.area,sediment,water,river,lake,slope,gravel,sand,fines,cover,rock,wetness,\n" +
"    fertility:fines,waterDistance,fordCandidates,fords,lakeCount:0,waterBudget:water.reduce((sum,v)=>sum+(v?1:0),0),\n" +
"    riverThreshold:profile.riverArea/6400,island:false,uplifts:[],uplift:formed.uplift,basement:formed.initialHeight,bedrock:formed.resistance,\n" +
"    rainfall,seaLevel:0,seaMask:sea,continent:{natural:true,direction:0,erosionPasses:160,landFraction:formed.landFraction,threshold:formed.threshold},\n" +
"    channels,headwaters,confluences,riverMouths,riverBasins:[...basinSizes].map(([outlet,cells])=>({outlet,cells})),\n" +
"    riverWidth:width,riverDepth:depth,riverVelocity:velocity,discharge,bankGravel:sedimentTransport.bankGravel,sedimentBudget:sedimentTransport.budget};\n" +
"  const visited=new Uint8Array(length);\n" +
"  for(let index=0;index<length;index++)if(lake[index]&&!visited[index]){result.lakeCount++;const items=[index];visited[index]=1;for(let c=0;c<items.length;c++){const n=items[c];for(const next of [n-1,n+1,n-size,n+size])if(next>=0&&next<length&&Math.abs(next%size-n%size)<=1&&lake[next]&&!visited[next]){visited[next]=1;items.push(next);}}}\n" +
"  if(capture){initializePlacementMaps(result,true);result.placementMaps.push(...formed.owner.placementMaps);\n" +
"    for(const [id,values,layers,details]of [\n" +
"      [\"hydrology:ground\",ground,[\"mountains\",\"water\",\"forest\",\"resources\"],{}],\n" +
"      [\"hydrology:surface\",drainage.level,[\"water\"],{}],[\"hydrology:pond-depth\",pondDepth,[\"water\",\"swamp\"],{minimum:0}],\n" +
"      [\"hydrology:sea-depth\",Float32Array.from(height,value=>-value),[\"water\"],{}],\n" +
"      [\"hydrology:flow\",discharge,[\"water\",\"resources\"],{minimum:0,logarithmic:true}],\n" +
"      [\"hydrology:sediment\",sediment,[\"water\",\"resources\"],{minimum:0,logarithmic:true}],\n" +
"      [\"hydrology:slope\",slope,[\"mountains\",\"forest\",\"swamp\",\"resources\"],{minimum:0}],\n" +
"      [\"hydrology:gravel\",gravel,[\"water\",\"resources\"],{minimum:0,resource:\"pebbles\"}],\n" +
"      [\"hydrology:sand\",sand,[\"water\",\"resources\"],{minimum:0}],\n" +
"      [\"hydrology:fines\",fines,[\"water\",\"resources\"],{minimum:0,resource:\"clay\"}],\n" +
"      [\"hydrology:cover\",cover,[\"water\",\"resources\"],{minimum:0}],\n" +
"      [\"hydrology:bank-gravel\",sedimentTransport.bankGravel,[\"water\",\"resources\",\"forest\",\"swamp\"],{minimum:0,maximum:1}],\n" +
"      [\"hydrology:river-width\",width,[\"water\"],{minimum:0}],\n" +
"      [\"hydrology:river-depth\",depth,[\"water\"],{minimum:0}],\n" +
"      [\"hydrology:river-velocity\",velocity,[\"water\"],{minimum:0}],\n" +
"      [\"hydrology:ford-candidates\",Uint8Array.from({length},(_,index)=>fordCandidates.some(candidate=>candidate.index===index)?1:0),[\"water\"],{minimum:0,maximum:1,water:\"ford\"}],\n" +
"      [\"hydrology:water\",water,[\"water\"],{categorical:true,stage:\"final\"}],\n" +
"      [\"hydrology:river\",river,[\"water\"],{minimum:0,maximum:1,water:\"river\",stage:\"final\"}],\n" +
"      [\"hydrology:lake\",lake,[\"water\"],{minimum:0,maximum:1,water:\"lake\",stage:\"final\"}],\n" +
"      [\"hydrology:ford\",Uint8Array.from(terrain,type=>type===10?1:0),[\"water\"],{minimum:0,maximum:1,water:\"ford\",stage:\"final\"}],\n" +
"      [\"hydrology:shore\",Uint8Array.from(terrain,type=>type===2?1:0),[\"water\"],{minimum:0,maximum:1,stage:\"final\"}],\n" +
"      [\"terrain:mountains\",Uint8Array.from(terrain,type=>type>=6&&type<=8?1:0),[\"mountains\"],{minimum:0,maximum:1,stage:\"final\"}],\n" +
"      [\"river:basins\",basin,[\"water\"],{categorical:true,excluded:-1,water:\"river\"}]\n" +
"    ])record(result,id,layers,values,details);\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"return { TERRAIN_FORMATION_PROFILE, formContinentalTerrain, generateFormedLandscape };\n" +
"})();\n" +
"modules[\"server/hydrology.mjs\"] = (() => {\n" +
"const { createTerrainRainfall, quantizeLandscapeValue, erodeLandscapeHeight } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { initializePlacementMaps, recordPlacementMap, placementNoise } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"const { measureStartingEconomy, startingTravel } = modules[\"server/start-economy.mjs\"];\n" +
"const { createRiverChannels } = modules[\"server/river-channels.mjs\"];\n" +
"const { resourceHabitatSuitability } = modules[\"server/resource-habitats.mjs\"];\n" +
"const { createIslandCoast } = modules[\"server/island-coast.mjs\"];\n" +
"const { createContinentLandscape } = modules[\"server/continent-landscape.mjs\"];\n" +
"const { createContinentalRelief } = modules[\"server/continental-relief.mjs\"];\n" +
"const { generateFormedLandscape } = modules[\"server/terrain-formation.mjs\"];\n" +
"\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function neighbors(index, size, diagonal) {\n" +
"  const x = index % size, y = Math.floor(index / size), result = [];\n" +
"  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"    if ((!dx && !dy) || (!diagonal && dx && dy) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;\n" +
"    result.push((y + dy) * size + x + dx);\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function flood(height, rainfall, size, landscape) {\n" +
"  const level = new Float64Array(height), parent = new Int32Array(height.length).fill(-1);\n" +
"  const order = new Int32Array(height.length), seen = new Uint8Array(height.length), heap = [];\n" +
"  function less(left, right) { return level[left] < level[right] || level[left] === level[right] && left < right; }\n" +
"  function push(index) {\n" +
"    let position = heap.length; heap.push(index);\n" +
"    while (position > 0) {\n" +
"      const previous = (position - 1) >>> 1;\n" +
"      if (!less(index, heap[previous])) break;\n" +
"      heap[position] = heap[previous]; position = previous;\n" +
"    }\n" +
"    heap[position] = index;\n" +
"  }\n" +
"  function pop() {\n" +
"    const first = heap[0], last = heap.pop();\n" +
"    if (heap.length) {\n" +
"      let position = 0;\n" +
"      while (position * 2 + 1 < heap.length) {\n" +
"        let child = position * 2 + 1;\n" +
"        if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;\n" +
"        if (!less(heap[child], last)) break;\n" +
"        heap[position] = heap[child]; position = child;\n" +
"      }\n" +
"      heap[position] = last;\n" +
"    }\n" +
"    return first;\n" +
"  }\n" +
"  for (let index = 0; index < height.length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    if (x && y && x < size - 1 && y < size - 1) continue;\n" +
"    seen[index] = 1; push(index);\n" +
"  }\n" +
"  let count = 0;\n" +
"  while (heap.length) {\n" +
"    const index = pop(); order[count++] = index;\n" +
"    for (const next of neighbors(index, size, true)) {\n" +
"      if (seen[next]) continue;\n" +
"      seen[next] = 1; parent[next] = index;\n" +
"      level[next] = Math.max(height[next], level[index] + 0.0000001); push(next);\n" +
"    }\n" +
"  }\n" +
"  if (landscape) for (const index of order) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    if (!x || !y || x === size - 1 || y === size - 1) continue;\n" +
"    let steepest = 0;\n" +
"    for (const next of neighbors(index, size, true)) {\n" +
"      const distance = Math.hypot(x - next % size + landscape.offsetX[index] - landscape.offsetX[next],\n" +
"        y - Math.floor(next / size) + landscape.offsetY[index] - landscape.offsetY[next]);\n" +
"      const slope = (level[index] - level[next]) / distance;\n" +
"      if (slope > steepest) { steepest = slope; parent[index] = next; }\n" +
"    }\n" +
"  }\n" +
"  const flow = new Float64Array(rainfall), sediment = new Float64Array(height.length);\n" +
"  for (let cursor = order.length - 1; cursor >= 0; cursor--) {\n" +
"    const index = order[cursor], next = parent[index];\n" +
"    if (next < 0) continue;\n" +
"    const slope = Math.max(0, level[index] - level[next]);\n" +
"    sediment[index] += Math.sqrt(flow[index]) * slope;\n" +
"    flow[next] += flow[index]; sediment[next] += sediment[index];\n" +
"  }\n" +
"  return { level, parent, order, flow, sediment };\n" +
"}\n" +
"\n" +
"function generateHydrology(terrain, moisture, heightField, size, seed, baseline, version, capturePlacementMaps) {\n" +
"  if(version>=33)return generateFormedLandscape(terrain,moisture,heightField,size,seed,capturePlacementMaps,version);\n" +
"  const natural = version === undefined || version >= 21;\n" +
"  const length = terrain.length, height = new Float64Array(length), rainfall = new Float64Array(length);\n" +
"  const water = new Uint8Array(length), river = new Uint8Array(length), lake = new Uint8Array(length);\n" +
"  const counts = new Uint32Array(11), oldWater = baseline ? baseline.terrain.reduce((sum, type) => sum + (type < 2 ? 1 : 0), 0) : 0;\n" +
"  if (baseline) for (const type of baseline.terrain) counts[type]++;\n" +
"  const angle = hash(0, 0, seed + 1801) * Math.PI * 2;\n" +
"  const coast = version === 24 ? createIslandCoast(size, seed, oldWater) : null;\n" +
"  const continent = version >= 26 ? createContinentalRelief(size, seed, version, capturePlacementMaps) : version >= 25 ? createContinentLandscape(size, seed) : null;\n" +
"  const naturalLandscape = Boolean(continent?.natural);\n" +
"  const capture = {}; initializePlacementMaps(capture, capturePlacementMaps);\n" +
"  const climateBroad = placementNoise(version >= 32 ? null : capture, \"climate:broad\", [\"water\", \"forest\", \"swamp\", \"resources\"], (x, y) => noise(x, y, 25, seed + 31));\n" +
"  const climateDetail = placementNoise(version >= 32 ? null : capture, \"climate:detail\", [\"water\", \"forest\", \"swamp\", \"resources\"], (x, y) => noise(x, y, 9, seed + 73));\n" +
"  const uplifts = continent ? continent.ranges : version >= 23 ? Array.from({ length: 3 + Math.floor(hash(0, 0, seed + 2201) * 3) }, (_, order) => ({\n" +
"    x: size * (.18 + hash(order, 0, seed + 2203) * .64), y: size * (.18 + hash(order, 0, seed + 2207) * .64),\n" +
"    radius: size * (.1 + hash(order, 0, seed + 2213) * .08), height: .35 + hash(order, 0, seed + 2221) * .4\n" +
"  })) : [];\n" +
"  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {\n" +
"    const index = y * size + x;\n" +
"    if (continent) height[index] = continent.height[index];\n" +
"    else if (version >= 23) {\n" +
"      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);\n" +
"      const shore = coast ? coast.distance[index] + noise(x, y, 11, seed + 2437) * 1.1 + noise(x, y, 4, seed + 2441) * .3 :\n" +
"        Math.max(0, edge + noise(x, y, 31, seed + 2237) * 4);\n" +
"      const corner = (Math.abs(x / (size - 1) * 2 - 1) * Math.abs(y / (size - 1) * 2 - 1)) ** 8;\n" +
"      let uplift = 0;\n" +
"      for (const peak of uplifts) {\n" +
"        const dx = x - peak.x + noise(x, y, 23, seed + 2243) * 5, dy = y - peak.y + noise(x, y, 23, seed + 2251) * 5;\n" +
"        uplift = Math.max(uplift, peak.height * Math.exp(-(dx * dx + dy * dy) / (peak.radius * peak.radius)));\n" +
"      }\n" +
"      const shoreHeight = shore < 0 ? -1.15 + shore * .05 : .15 - Math.exp(-shore / 7) * 1.3;\n" +
"      height[index] = edge === 0 ? -2 : shoreHeight - corner * .2 + uplift +\n" +
"        noise(x, y, 49, seed + 2267) * .06 + noise(x, y, 13, seed + 2273) * .025;\n" +
"    } else if (natural) {\n" +
"      const wx = x + noise(x, y, 39, seed + 1823) * 7, wy = y + noise(x, y, 39, seed + 1831) * 7;\n" +
"      height[index] = noise(wx, wy, 18, seed + 127) * .44 + noise(wx, wy, 7, seed + 151) * .1 +\n" +
"        noise(wx, wy, 74, seed + 1811) * .22 + noise(wx, wy, 43, seed + 1837) * .12 +\n" +
"        ((x / size - .5) * Math.cos(angle) + (y / size - .5) * Math.sin(angle)) * .1;\n" +
"    } else height[index] = noise(x, y, 18, seed + 127) * .46 + noise(x, y, 7, seed + 151) * .14 +\n" +
"      noise(x, y, 74, seed + 1811) * .28 + ((x / size - .5) * Math.cos(angle) + (y / size - .5) * Math.sin(angle)) * .32;\n" +
"    moisture[index] = climateBroad(x, y) * .68 + climateDetail(x, y) * .32;\n" +
"    rainfall[index] = .65 + Math.max(0, moisture[index]) * .5 + Math.max(0, height[index]) * .4;\n" +
"  }\n" +
"  if (version >= 32) {\n" +
"    const atmosphere = createTerrainRainfall(height, size, continent.seaLevel, angle); rainfall.set(atmosphere.rainfall);\n" +
"    for (let index = 0; index < length; index++) moisture[index] = Math.max(-1, Math.min(1, (rainfall[index] - .75) * 1.5));\n" +
"  }\n" +
"  if (version >= 23 && version < 32) for (let index = 0; index < length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    const nx = Math.max(0, Math.min(size - 1, Math.round(x - Math.cos(angle) * 8)));\n" +
"    const ny = Math.max(0, Math.min(size - 1, Math.round(y - Math.sin(angle) * 8)));\n" +
"    const rise = height[index] - height[ny * size + nx];\n" +
"    rainfall[index] = Math.max(.2, rainfall[index] + Math.max(0, rise) * 1.5 + Math.min(0, rise) * .9);\n" +
"  }\n" +
"  let drainage;\n" +
"  for (let pass = 0; pass < (continent ? continent.erosionPasses : 3); pass++) {\n" +
"    if (version >= 32) { height.set(erodeLandscapeHeight(height, rainfall, size, continent)); continue; }\n" +
"    drainage = flood(height, rainfall, size, continent);\n" +
"    if (continent) {\n" +
"      for (const index of drainage.order) {\n" +
"        const next = drainage.parent[index];\n" +
"        if (next < 0) continue;\n" +
"        const raised = height[index] + continent.uplift[index] * .0008;\n" +
"        if (version >= 29 && raised <= continent.seaLevel) continue;\n" +
"        if (raised <= height[next]) continue;\n" +
"        const distance = Math.hypot(index % size - next % size + continent.offsetX[index] - continent.offsetX[next],\n" +
"          Math.floor(index / size) - Math.floor(next / size) + continent.offsetY[index] - continent.offsetY[next]);\n" +
"        const incision = .02 * Math.sqrt(drainage.flow[index]) / distance * (version >= 32 ? 1.35 - continent.bedrock[index] * .7 : 1);\n" +
"        const baseLevel = version >= 29 ? Math.max(continent.seaLevel, height[next]) : height[next];\n" +
"        height[index] = (raised + incision * baseLevel) / (1 + incision);\n" +
"        if (version >= 32) height[index] = quantizeLandscapeValue(height[index]);\n" +
"      }\n" +
"      continue;\n" +
"    }\n" +
"    const change = new Float64Array(length);\n" +
"    for (const index of drainage.order) {\n" +
"      const next = drainage.parent[index];\n" +
"      if (next < 0) continue;\n" +
"      const slope = Math.max(0, height[index] - height[next]);\n" +
"      const eroded = Math.min(slope * .22, Math.sqrt(drainage.flow[index]) * slope * .008);\n" +
"      change[index] -= eroded;\n" +
"      change[next] += eroded * .45;\n" +
"    }\n" +
"    for (let index = 0; index < length; index++) height[index] += change[index];\n" +
"  }\n" +
"  if (version >= 32) rainfall.set(createTerrainRainfall(height, size, continent.seaLevel, angle).rainfall);\n" +
"  drainage = flood(height, rainfall, size, continent);\n" +
"  const riverData = natural ? createRiverChannels(drainage, size, seed, naturalLandscape ? length : oldWater, version >= 27 ? version : naturalLandscape, continent ? { ...continent, height, placementMaps: capture.placementMaps } : null) : null;\n" +
"  let threshold = riverData?.threshold ?? 190, riverCount = riverData?.count ?? 0;\n" +
"  if (riverData) { water.set(riverData.water); river.set(riverData.water); }\n" +
"  else for (let attempt = 0; attempt < 14; attempt++) {\n" +
"    water.fill(0); river.fill(0); riverCount = 0;\n" +
"    for (let index = 0; index < length; index++) {\n" +
"      if (drainage.flow[index] < threshold || drainage.parent[index] < 0) continue;\n" +
"      const radius = Math.min(2.5, 1.05 + Math.log2(drainage.flow[index] / threshold) * .35);\n" +
"      const x = index % size, y = Math.floor(index / size), reach = Math.ceil(radius);\n" +
"      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {\n" +
"        if (dx * dx + dy * dy > radius * radius || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;\n" +
"        const next = (y + dy) * size + x + dx;\n" +
"        if (!water[next]) { water[next] = 1; river[next] = 1; riverCount++; }\n" +
"      }\n" +
"    }\n" +
"    if (riverCount <= oldWater * .38) break;\n" +
"    threshold *= 1.45;\n" +
"  }\n" +
"  let remaining = naturalLandscape ? Infinity : oldWater - riverCount;\n" +
"  const seaTarget = naturalLandscape ? 0 : Math.floor(remaining * (version >= 23 ? .8 : .48));\n" +
"  let seaCount = 0, seaLevel = naturalLandscape ? continent.seaLevel : -Infinity;\n" +
"  for (const index of drainage.order) {\n" +
"    if (seaCount >= seaTarget) break;\n" +
"    if (water[index]) continue;\n" +
"    water[index] = 3; seaCount++; remaining--; seaLevel = drainage.level[index];\n" +
"  }\n" +
"  if (naturalLandscape) for (let index = 0; index < length; index++) if (drainage.level[index] <= seaLevel) water[index] = 3;\n" +
"  const seen = new Uint8Array(length), basins = [];\n" +
"  const basinDepth = version >= 29 ? .003 : .012;\n" +
"  for (let first = 0; first < length; first++) {\n" +
"    if (seen[first] || water[first] === 3 || drainage.level[first] - height[first] < basinDepth) continue;\n" +
"    const cells = [first], surface = drainage.level[first]; seen[first] = 1;\n" +
"    for (let cursor = 0; cursor < cells.length; cursor++) for (const next of neighbors(cells[cursor], size, true)) {\n" +
"      if (seen[next] || water[next] === 3 || drainage.level[next] - height[next] < basinDepth || Math.abs(drainage.level[next] - surface) > .0002) continue;\n" +
"      seen[next] = 1; cells.push(next);\n" +
"    }\n" +
"    if (cells.length >= 20) basins.push({ cells, volume: cells.reduce((sum, index) => sum + drainage.level[index] - height[index], 0) });\n" +
"  }\n" +
"  basins.sort((left, right) => right.volume - left.volume || left.cells[0] - right.cells[0]);\n" +
"  let lakeCount = 0;\n" +
"  for (const basin of basins) {\n" +
"    if (remaining <= 0) break;\n" +
"    basin.cells.sort((left, right) => height[left] - height[right] || left - right);\n" +
"    let count = 0;\n" +
"    for (const index of basin.cells) {\n" +
"      if (remaining <= 0) break;\n" +
"      if (!water[index]) remaining--;\n" +
"      water[index] = 2; lake[index] = 1; count++;\n" +
"    }\n" +
"    if (count) lakeCount++;\n" +
"  }\n" +
"  if (!naturalLandscape) for (const index of drainage.order) {\n" +
"    if (remaining <= 0) break;\n" +
"    if (water[index]) continue;\n" +
"    water[index] = 3; remaining--; seaLevel = Math.max(seaLevel, drainage.level[index]);\n" +
"  }\n" +
"  if (riverData) for (let index = 0; index < length; index++) {\n" +
"    if (water[index] !== 1 || riverData.surface[index] > seaLevel) continue;\n" +
"    if (version >= 29 && drainage.level[index] > seaLevel) riverData.surface[index] = seaLevel + .0000001;\n" +
"    else water[index] = 3;\n" +
"  }\n" +
"  if (continent && riverData) for (const channel of riverData.channels.slice().sort((left, right) => left.points.at(-1).surface - right.points.at(-1).surface)) {\n" +
"    let estuary = false;\n" +
"    for (const point of channel.points) {\n" +
"      const index = Math.floor(point.y) * size + Math.floor(point.x);\n" +
"      if (version >= 29) {\n" +
"        if (water[index] === 3) { point.surface = seaLevel; riverData.surface[index] = seaLevel; }\n" +
"        else if (water[index] === 1) point.surface = Math.max(point.surface, seaLevel + .0000001);\n" +
"        continue;\n" +
"      }\n" +
"      if (water[index] === 3) estuary = true;\n" +
"      if (estuary) { water[index] = 3; lake[index] = 0; riverData.surface[index] = seaLevel; point.surface = seaLevel; }\n" +
"      else point.surface = Math.max(point.surface, seaLevel);\n" +
"    }\n" +
"  }\n" +
"  if (coast || continent) {\n" +
"    const connected = new Uint8Array(length), cells = new Int32Array(length);\n" +
"    let end = 0;\n" +
"    for (let index = 0; index < length; index++) if (water[index] === 3 &&\n" +
"        (index < size || index >= length - size || index % size === 0 || index % size === size - 1)) { connected[index] = 1; cells[end++] = index; }\n" +
"    for (let cursor = 0; cursor < end; cursor++) for (const next of neighbors(cells[cursor], size, false)) {\n" +
"      if (water[next] !== 3 || connected[next]) continue;\n" +
"      connected[next] = 1; cells[end++] = next;\n" +
"    }\n" +
"    for (let index = 0; index < length; index++) if (water[index] === 3 && !connected[index]) { water[index] = 2; lake[index] = 1; }\n" +
"    connected.fill(0); lakeCount = 0;\n" +
"    for (let first = 0; first < length; first++) {\n" +
"      if (water[first] !== 2 || connected[first]) continue;\n" +
"      lakeCount++; end = 1; cells[0] = first; connected[first] = 1;\n" +
"      for (let cursor = 0; cursor < end; cursor++) for (const next of neighbors(cells[cursor], size, false)) {\n" +
"        if (water[next] !== 2 || connected[next]) continue;\n" +
"        connected[next] = 1; cells[end++] = next;\n" +
"      }\n" +
"    }\n" +
"  }\n" +
"  if (version >= 29) for (let index = 0; index < length; index++) { river[index] = water[index] === 1 ? 1 : 0; lake[index] = water[index] === 2 ? 1 : 0; }\n" +
"  const ground = version >= 32 ? new Float64Array(height) : height;\n" +
"  const waterSurface = version >= 32 ? new Float64Array(length) : null;\n" +
"  if (version >= 32) for (let index = 0; index < length; index++) {\n" +
"    waterSurface[index] = quantizeLandscapeValue(water[index] === 3 ? seaLevel : water[index] === 1 ? riverData.surface[index] : drainage.level[index]);\n" +
"    if (water[index] === 1) ground[index] = quantizeLandscapeValue(Math.min(ground[index], waterSurface[index] - .003 - Math.min(.012, Math.sqrt(riverData.flow[index]) / 18000)));\n" +
"  }\n" +
"  const waterDistance = new Uint8Array(length).fill(255), nearestWater = new Int32Array(length).fill(-1), queue = new Int32Array(length);\n" +
"  let end = 0;\n" +
"  for (let index = 0; index < length; index++) if (water[index]) {\n" +
"    waterDistance[index] = 0; nearestWater[index] = index; queue[end++] = index;\n" +
"  }\n" +
"  for (let cursor = 0; cursor < end; cursor++) {\n" +
"    const index = queue[cursor];\n" +
"    if (waterDistance[index] >= 30) continue;\n" +
"    for (const next of neighbors(index, size, false)) if (waterDistance[next] > waterDistance[index] + 1) {\n" +
"      waterDistance[next] = waterDistance[index] + 1; nearestWater[next] = nearestWater[index]; queue[end++] = next;\n" +
"    }\n" +
"  }\n" +
"  const slope = new Float32Array(length), fertility = new Float32Array(length), gravel = new Float32Array(length);\n" +
"  const sand = new Float32Array(length), rock = new Float32Array(length), wetness = new Float32Array(length);\n" +
"  const candidates = [];\n" +
"  for (let index = 0; index < length; index++) {\n" +
"    const source = nearestWater[index], distance = waterDistance[index];\n" +
"    const sourceSurface = source < 0 ? drainage.level[index] : version >= 32 ? waterSurface[source] : riverData && water[source] === 1 ? riverData.surface[source] : drainage.level[source];\n" +
"    const relief = Math.max(0, (version >= 32 ? ground[index] : drainage.level[index]) - sourceSurface);\n" +
"    const nearbyFlow = source < 0 ? 0 : riverData && water[source] === 1 ? riverData.flow[source] : drainage.flow[source];\n" +
"    const nearbySediment = source < 0 ? 0 : riverData && water[source] === 1 ? riverData.sediment[source] : drainage.sediment[source];\n" +
"    for (const next of neighbors(index, size, true)) slope[index] = Math.max(slope[index], Math.abs((version >= 32 ? ground[index] : drainage.level[index]) - (version >= 32 ? ground[next] : drainage.level[next])));\n" +
"    const damp = Math.exp(-distance / 8) * Math.exp(-relief * 16);\n" +
"    const bank = riverData && source >= 0 && water[source] === 1 ?\n" +
"      Math.sign(riverData.bend[source] * (riverData.directionX[source] * (Math.floor(index / size) + .5 - riverData.centerY[source]) -\n" +
"        riverData.directionY[source] * (index % size + .5 - riverData.centerX[source]))) : 0;\n" +
"    const deposit = Math.min(1, Math.log1p(nearbySediment) / 7) / (1 + slope[index] * 24) * (1 + bank * .25);\n" +
"    wetness[index] = damp;\n" +
"    fertility[index] = damp * (.35 + deposit) / (1 + slope[index] * 18);\n" +
"    gravel[index] = distance <= 5 && source >= 0 && water[source] === 1 ?\n" +
"      Math.exp(-distance / 3) * Math.min(1, .15 + nearbySediment / Math.max(1, nearbyFlow) * 12 + slope[index] * 8) : 0;\n" +
"    sand[index] = distance <= 2 ? Math.exp(-distance) * (.3 + deposit) / (1 + slope[index] * 30) : 0;\n" +
"    rock[index] = Math.max(0, drainage.level[index] + .1) * .7 + slope[index] * 3;\n" +
"    moisture[index] = Math.max(-1, Math.min(1, moisture[index] * .7 + damp * .32 - .12));\n" +
"    heightField[index] = version >= 32 ? ground[index] : riverData && water[index] === 1 ? riverData.surface[index] : drainage.level[index];\n" +
"    if (water[index]) {\n" +
"      const deep = water[index] === 2 ? drainage.level[index] - height[index] > .07 :\n" +
"        water[index] === 3 ? seaLevel - drainage.level[index] > .06 : nearbyFlow > threshold * 6;\n" +
"      terrain[index] = deep ? 0 : 1;\n" +
"    } else {\n" +
"      terrain[index] = moisture[index] > .1 ? 5 : moisture[index] < -.18 ? 3 : 4;\n" +
"      candidates.push(index);\n" +
"    }\n" +
"  }\n" +
"  const prominence = index => continent ? continent.uplift[index] * .7 + Math.max(0, height[index] - continent.basement[index]) * .3 + slope[index] * .15 : drainage.level[index];\n" +
"  if (naturalLandscape) for (const index of candidates) {\n" +
"    const relief = Math.max(0, height[index] - continent.basement[index]);\n" +
"    if (relief > .085) terrain[index] = relief > .57 ? 8 : relief > .31 ? 7 : 6;\n" +
"  } else {\n" +
"    candidates.sort((left, right) => prominence(right) - prominence(left) || left - right);\n" +
"    const high = counts[7] + counts[8], total = Math.min(candidates.length, counts[6] + high);\n" +
"    for (let order = 0; order < total; order++) terrain[candidates[order]] = order < counts[8] ? 8 : order < high ? 7 : 6;\n" +
"  }\n" +
"  for (const index of candidates) {\n" +
"    if (terrain[index] >= 6) continue;\n" +
"    if (version >= 32) {\n" +
"      const source = nearestWater[index];\n" +
"      if (source < 0 || waterDistance[index] > 3 || slope[index] > .04) continue;\n" +
"      if (water[source] === 3 ? ground[index] - seaLevel > .07 || sand[index] < .075 : gravel[index] < .075 && sand[index] < .14) continue;\n" +
"    } else if (waterDistance[index] !== 1) continue;\n" +
"    terrain[index] = 2;\n" +
"  }\n" +
"  const fordChoices = [];\n" +
"  for (let index = 0; index < length; index++) {\n" +
"    const downstream = drainage.parent[index], discharge = riverData ? riverData.flow[index] : drainage.flow[index];\n" +
"    if (water[index] !== 1 || downstream < 0 || discharge < (version >= 30 ? 80 : threshold) || discharge > (riverData ? Math.max(4000, threshold * 14) : threshold * 14) ||\n" +
"        slope[index] > .08 || lake[index] || (drainage.level[index] - height[index]) > .025) continue;\n" +
"    const dx = riverData ? riverData.directionX[index] : downstream % size - index % size;\n" +
"    const dy = riverData ? riverData.directionY[index] : Math.floor(downstream / size) - Math.floor(index / size);\n" +
"    const acrossX = Math.abs(dy) >= Math.abs(dx) ? 1 : 0, acrossY = acrossX ? 0 : 1, cells = [];\n" +
"    let valid = true;\n" +
"    for (const direction of [-1, 1]) {\n" +
"      let reached = false;\n" +
"      for (let step = 0; step <= 7; step++) {\n" +
"        const x = index % size + acrossX * direction * step, y = Math.floor(index / size) + acrossY * direction * step;\n" +
"        if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) break;\n" +
"        const next = y * size + x;\n" +
"        if (!water[next]) { reached = terrain[next] <= 6; break; }\n" +
"        if (water[next] !== 1) break;\n" +
"        cells.push(next);\n" +
"      }\n" +
"      if (!reached) valid = false;\n" +
"    }\n" +
"    if (valid) fordChoices.push({ index, cells, acrossX, acrossY, priority: slope[index] * 3 + Math.log1p(drainage.flow[index]) * .02 });\n" +
"  }\n" +
"  fordChoices.sort((left, right) => left.priority - right.priority || left.index - right.index);\n" +
"  const fords = [];\n" +
"  for (const choice of fordChoices) {\n" +
"    const x = choice.index % size, y = Math.floor(choice.index / size);\n" +
"    if (fords.some(other => Math.hypot(x - other.x, y - other.y) < 26)) continue;\n" +
"    const cells = new Set();\n" +
"    for (const index of choice.cells) for (let offset = -1; offset <= 1; offset++) {\n" +
"      const next = index + offset * (choice.acrossX ? size : 1);\n" +
"      if (water[next] === 1) { terrain[next] = 10; cells.add(next); }\n" +
"    }\n" +
"    fords.push({ x, y, cells: [...cells] });\n" +
"  }\n" +
"  const riverBasins = new Map();\n" +
"  const riverMouths = [];\n" +
"  if (riverData) for (const channel of riverData.channels) {\n" +
"    if (!riverBasins.has(channel.basin)) riverBasins.set(channel.basin, new Set());\n" +
"    let previousWater = 0;\n" +
"    for (const point of channel.points) {\n" +
"      const index = Math.floor(point.y) * size + Math.floor(point.x);\n" +
"      if (water[index] === 3 && previousWater === 1) riverMouths.push({ x: point.x, y: point.y, flow: point.flow, surface: point.surface });\n" +
"      previousWater = water[index];\n" +
"      if (water[index] === 1) riverBasins.get(channel.basin).add(index);\n" +
"    }\n" +
"  }\n" +
"  const result = { size, seed, ...(version >= 29 ? { generationVersion: version } : {}), height: heightField, surface: drainage.level, downstream: drainage.parent, flow: drainage.flow,\n" +
"    sediment: drainage.sediment, ...(version >= 32 ? { ground, waterSurface, basement: continent.basement, bedrock: continent.bedrock } : {}), water, river, lake, slope, fertility, gravel, sand, rock, wetness, waterDistance,\n" +
"    fords, lakeCount, waterBudget: naturalLandscape ? water.filter(Boolean).length : oldWater, riverThreshold: threshold,\n" +
"    ...(version >= 23 ? { island: !continent, uplifts, rainfall } : {}),\n" +
"    ...(continent ? { continent: { direction: continent.direction, erosionPasses: continent.erosionPasses, ...(naturalLandscape ? { natural: true } : {}) }, uplift: continent.uplift, seaLevel, riverMouths } : {}),\n" +
"    ...(coast ? { coastProfiles: coast.profiles } : {}),\n" +
"    ...(riverData ? { channels: riverData.channels,\n" +
"      headwaters: riverData.heads.filter(index => water[index] === 1), confluences: riverData.junctions.filter(index => water[index] === 1),\n" +
"      riverBasins: [...riverBasins].filter(([, cells]) => cells.size >= 16).map(([outlet, cells]) => ({outlet, cells: cells.size})) } : {}) };\n" +
"  if (capturePlacementMaps) {\n" +
"    initializePlacementMaps(result, true); result.placementMaps.push(...(continent?.placementMaps || []), ...capture.placementMaps);\n" +
"    const fordScores = new Float32Array(length).fill(NaN);\n" +
"    for (const choice of fordChoices) fordScores[choice.index] = choice.priority;\n" +
"    recordPlacementMap(result, \"hydrology:ford-candidates\", [\"water\"], fordScores, { water: \"ford\" });\n" +
"    for (const [id, values, layers, details] of [\n" +
"      [\"hydrology:ground\", ground, [\"mountains\", \"water\", \"forest\", \"swamp\"], {}],\n" +
"      [\"hydrology:surface\", drainage.level, [\"water\"], {}],\n" +
"      [\"hydrology:pond-depth\", Float32Array.from(height, (value, index) => drainage.level[index] - value), [\"water\", \"swamp\"], { minimum: 0 }],\n" +
"      [\"hydrology:sea-depth\", Float32Array.from(height, value => seaLevel - value), [\"water\"], {}],\n" +
"      [\"hydrology:rainfall\", rainfall, [\"water\", \"forest\", \"swamp\", \"resources\"], { minimum: 0 }],\n" +
"      [\"hydrology:flow\", drainage.flow, [\"water\", \"resources\"], { minimum: 0, logarithmic: true }],\n" +
"      [\"hydrology:sediment\", drainage.sediment, [\"water\", \"resources\"], { minimum: 0, logarithmic: true }],\n" +
"      [\"hydrology:slope\", slope, [\"mountains\", \"water\", \"forest\", \"swamp\"], { minimum: 0 }],\n" +
"      [\"hydrology:wetness\", wetness, [\"water\", \"forest\", \"swamp\", \"resources\"], { minimum: 0, maximum: 1 }],\n" +
"      [\"hydrology:fertility\", fertility, [\"resources\"], { minimum: 0 }],\n" +
"      [\"hydrology:gravel\", gravel, [\"water\", \"resources\"], { minimum: 0, resource: \"pebbles\" }],\n" +
"      [\"hydrology:sand\", sand, [\"water\", \"resources\"], { minimum: 0 }],\n" +
"      [\"hydrology:water\", water, [\"water\"], { categorical: true }],\n" +
"      [\"hydrology:river\", river, [\"water\"], { minimum: 0, maximum: 1, water: \"river\" }],\n" +
"      [\"hydrology:lake\", lake, [\"water\"], { minimum: 0, maximum: 1, water: \"lake\" }],\n" +
"      [\"hydrology:ford\", Uint8Array.from(terrain, type => type === 10 ? 1 : 0), [\"water\"], { minimum: 0, maximum: 1, water: \"ford\" }]\n" +
"    ]) recordPlacementMap(result, id, layers, values, details);\n" +
"  }\n" +
"  if (version >= 32 && capturePlacementMaps) {\n" +
"    recordPlacementMap(result, \"hydrology:shore\", [\"water\"], Uint8Array.from(terrain, type => type === 2 ? 1 : 0), { minimum: 0, maximum: 1, stage: \"final\" });\n" +
"    recordPlacementMap(result, \"terrain:mountains\", [\"mountains\"], Uint8Array.from(terrain, type => type >= 6 && type <= 8 ? type - 5 : 0), { minimum: 0, maximum: 3, stage: \"final\" });\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function hydrologyResourceSuitability(key, index, terrain, fields) {\n" +
"  const type = terrain[index];\n" +
"  const h = fields.hydrology || fields;\n" +
"  if (h.resourceHabitats) return resourceHabitatSuitability(key, index, terrain, h);\n" +
"  if (type < 2 || type === 10) return 0;\n" +
"  if (key === \"honey-mushrooms\") return type === 5 ? 1 : 0;\n" +
"  if (key === \"tree\") return type === 5 ? .15 + h.wetness[index] : 0;\n" +
"  if (key === \"dew\") return type === 4 && (h.wetness[index] > .12 || h.fertility[index] > .08) ? .1 + h.wetness[index] : 0;\n" +
"  if (key === \"clay\") return [3, 4, 5, 9].includes(type) && h.fertility[index] > .08 ? h.fertility[index] : 0;\n" +
"  if (key === \"pebbles\") return [2, 3, 4, 6].includes(type) ? h.gravel[index] + (type === 6 ? h.rock[index] * .5 : 0) : 0;\n" +
"  return 0;\n" +
"}\n" +
"\n" +
"function allocateAmounts(points, budget) {\n" +
"  if (!points.length && budget) throw new Error(\"자원 총량을 보존할 서식지가 부족합니다.\");\n" +
"  if (points.length > budget) throw new Error(\"자원량보다 자원 지점이 많습니다.\");\n" +
"  const weight = points.reduce((sum, point) => sum + point[2], 0);\n" +
"  let total = 0;\n" +
"  const fractions = [];\n" +
"  for (const point of points) {\n" +
"    const expected = weight ? budget * point[2] / weight : 0;\n" +
"    point[2] = Math.max(1, Math.floor(expected)); total += point[2];\n" +
"    fractions.push({ point, fraction: expected % 1 });\n" +
"  }\n" +
"  fractions.sort((left, right) => right.fraction - left.fraction || left.point[1] - right.point[1] || left.point[0] - right.point[0]);\n" +
"  for (let cursor = 0; total < budget; cursor++, total++) fractions[cursor % fractions.length].point[2]++;\n" +
"  for (let cursor = fractions.length - 1; total > budget; cursor = cursor ? cursor - 1 : fractions.length - 1) {\n" +
"    if (fractions[cursor].point[2] <= 1) continue;\n" +
"    fractions[cursor].point[2]--; total--;\n" +
"  }\n" +
"}\n" +
"\n" +
"function populateWatershedResources(world, baseline, paths) {\n" +
"  const size = world.size, h = world.hydrology, budgets = new Map(), blocked = new Set(), occupied = new Set();\n" +
"  for (const point of [...baseline.food, ...baseline.resources]) budgets.set(point[3], (budgets.get(point[3]) || 0) + point[2]);\n" +
"  for (const camp of world.camps) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) blocked.add((camp.y + dy) * size + camp.x + dx);\n" +
"  for (const burrow of world.burrows) for (let dy = -1; dy <= burrow.height; dy++) for (let dx = -1; dx <= burrow.width; dx++) blocked.add((burrow.y + dy) * size + burrow.x + dx);\n" +
"  for (const encounter of world.encounters) for (const index of encounter.spawnPoints || []) blocked.add(index);\n" +
"  const primary = [\"clay\", \"tree\", \"pebbles\", \"dew\"], travel = world.camps.map(camp => startingTravel(world, camp));\n" +
"  const points = new Map(), retained = new Set();\n" +
"  for (const [order, camp] of world.camps.entries()) {\n" +
"    const key = primary[order], local = world.resources.filter(point => point[3] === key && travel[order][point[1] * size + point[0]] >= 0 &&\n" +
"      !blocked.has(point[1] * size + point[0]) && !occupied.has(point[1] * size + point[0]) && !world.hazards[point[1] * size + point[0]] &&\n" +
"      travel[order][point[1] * size + point[0]] <= 36 && hydrologyResourceSuitability(key, point[1] * size + point[0], world.terrain, world) > 0);\n" +
"    if (h.resourceHabitats) {\n" +
"      local.sort((left, right) => travel[order][left[1] * size + left[0]] - travel[order][right[1] * size + right[0]] || left[1] - right[1] || left[0] - right[0]);\n" +
"      local.splice(16);\n" +
"    }\n" +
"    const near = [];\n" +
"    for (let index = 0; index < world.terrain.length; index++) {\n" +
"      if (travel[order][index] < 0 || travel[order][index] > 36 || blocked.has(index) || occupied.has(index) || world.hazards[index] ||\n" +
"          !hydrologyResourceSuitability(key, index, world.terrain, world)) continue;\n" +
"      near.push(index);\n" +
"    }\n" +
"    near.sort((left, right) => travel[order][left] - travel[order][right] || left - right);\n" +
"    const existing = new Set(local.map(point => point[1] * size + point[0]));\n" +
"    for (const index of near) {\n" +
"      if (local.length >= 16) break;\n" +
"      if (existing.has(index)) continue;\n" +
"      local.push([index % size, Math.floor(index / size), key === \"tree\" ? 30 : key === \"dew\" ? 1 : 12, key]); existing.add(index);\n" +
"    }\n" +
"    for (const point of local) {\n" +
"      const index = point[1] * size + point[0];\n" +
"      if (blocked.has(index) || occupied.has(index) || world.hazards[index]) continue;\n" +
"      if (!points.has(key)) points.set(key, []);\n" +
"      points.get(key).push(point); occupied.add(index); retained.add(point);\n" +
"    }\n" +
"  }\n" +
"  const hotspots = [];\n" +
"  if (!h.resourceHabitats) for (let index = 0; index < world.terrain.length; index++) {\n" +
"    if (h.water[index] || h.waterDistance[index] > 9 || h.slope[index] > .035 || h.fertility[index] < .1) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    if (world.camps.some(camp => Math.hypot(x - camp.x, y - camp.y) < 28)) continue;\n" +
"    const approaches = paths.map(path => path[index]).filter(distance => distance >= 0).sort((left, right) => left - right);\n" +
"    if (approaches.length < 2) continue;\n" +
"    const shared = Math.exp(-approaches[1] / 180) * (.25 + .75 * approaches[0] / Math.max(1, approaches[1]));\n" +
"    hotspots.push({ x, y, index, priority: h.fertility[index] * (1 + Math.log1p(h.flow[index]) * .1) * shared });\n" +
"  }\n" +
"  hotspots.sort((left, right) => right.priority - left.priority || left.index - right.index);\n" +
"  const sites = [];\n" +
"  for (const point of hotspots) {\n" +
"    if (sites.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 48)) continue;\n" +
"    sites.push(point);\n" +
"    if (sites.length >= 7) break;\n" +
"  }\n" +
"  const cluster = index => {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    let value = .025;\n" +
"    for (const site of sites) value = Math.max(value, Math.exp(-((x - site.x) ** 2 + (y - site.y) ** 2) / 290));\n" +
"    return value;\n" +
"  };\n" +
"  const nodeAmounts = { tree: 120, dew: 12, clay: 60, pebbles: 55, \"honey-mushrooms\": 15 };\n" +
"  for (const [key, budget] of budgets) {\n" +
"    if ([\"nutrients\", \"grass-fiber\", \"sand\", \"iron-ore\", \"copper-ore\", \"quartz\"].includes(key)) continue;\n" +
"    const selected = points.get(key) || [], candidates = [];\n" +
"    const patchSeed = world.seed + 2111 + [...budgets.keys()].indexOf(key) * 37;\n" +
"    const initialCount = selected.length;\n" +
"    for (let index = 0; index < world.terrain.length; index++) {\n" +
"      if (blocked.has(index) || occupied.has(index) || world.hazards[index]) continue;\n" +
"      const suitability = hydrologyResourceSuitability(key, index, world.terrain, world);\n" +
"      if (!suitability) continue;\n" +
"      const x = index % size, y = Math.floor(index / size);\n" +
"      const patch = h.resourceHabitats ? .2 + Math.max(0, noise(x, y, 14, patchSeed)) ** 2 * 3 :\n" +
"        .15 + Math.max(0, noise(x, y, 12, world.seed + 1931));\n" +
"      const attraction = h.resourceHabitats ? 1 : cluster(index);\n" +
"      candidates.push({ index, priority: suitability * patch * attraction });\n" +
"    }\n" +
"    candidates.sort((left, right) => right.priority - left.priority || left.index - right.index);\n" +
"    const count = Math.min(budget, Math.max(initialCount, Math.ceil(budget / (nodeAmounts[key] || 100))));\n" +
"    for (const candidate of candidates) {\n" +
"      if (selected.length >= count) break;\n" +
"      const index = candidate.index;\n" +
"      selected.push([index % size, Math.floor(index / size), nodeAmounts[key] || 100, key]); occupied.add(index);\n" +
"    }\n" +
"    const protectedAmount = selected.filter(point => retained.has(point)).reduce((sum, point) => sum + point[2], 0);\n" +
"    const outer = selected.filter(point => !retained.has(point));\n" +
"    if (protectedAmount + outer.length <= budget && outer.length) allocateAmounts(outer, budget - protectedAmount);\n" +
"    else allocateAmounts(selected, budget);\n" +
"    points.set(key, selected);\n" +
"  }\n" +
"  for (const [order, key] of primary.entries()) {\n" +
"    const entries = points.get(key) || [], near = [], remote = [];\n" +
"    const weight = point => Math.exp(-travel[order][point[1] * size + point[0]] / 18);\n" +
"    for (const point of entries) (travel[order][point[1] * size + point[0]] >= 0 ? near : remote).push(point);\n" +
"    const target = baseline.economy.starts[order].weightedAmount;\n" +
"    let current = near.reduce((sum, point) => sum + point[2] * weight(point), 0);\n" +
"    let cursor = 0, remoteCursor = 0, idle = 0;\n" +
"    while (near.length && remote.length && Math.abs(current - target) > 1 && idle < near.length) {\n" +
"      const point = near[cursor++ % near.length], amount = weight(point);\n" +
"      if (current < target) {\n" +
"        let donor = null;\n" +
"        for (let attempt = 0; attempt < remote.length; attempt++) {\n" +
"          const candidate = remote[remoteCursor++ % remote.length];\n" +
"          if (candidate[2] > 1) { donor = candidate; break; }\n" +
"        }\n" +
"        if (!donor) break;\n" +
"        donor[2]--; point[2]++; current += amount; idle = 0;\n" +
"      } else if (point[2] > 1) {\n" +
"        point[2]--; remote[remoteCursor++ % remote.length][2]++; current -= amount; idle = 0;\n" +
"      } else idle++;\n" +
"    }\n" +
"  }\n" +
"  world.food = points.get(\"honey-mushrooms\") || [];\n" +
"  world.resources = [...points].filter(([key]) => key !== \"honey-mushrooms\").flatMap(([, entries]) => entries);\n" +
"  world.resourceHotspots = sites.map(({ x, y }) => ({ x, y }));\n" +
"  world.economy.starts = measureStartingEconomy(world, [\"clay\", \"tree\", \"pebbles\", \"dew\"].map((key, index) => ({ key, tribe: world.camps[index].tribe === \"sprout\" ? \"bean\" : world.camps[index].tribe })));\n" +
"  for (const policy of world.economy.resources) {\n" +
"    const entries = points.get(policy.key) || [];\n" +
"    policy.cells = entries.length; policy.coverage = entries.length / world.terrain.length;\n" +
"    policy.amount = entries.reduce((sum, point) => sum + point[2], 0);\n" +
"    policy.sectors = new Set(entries.map(point => Math.floor(point[0] / 32) + \",\" + Math.floor(point[1] / 32))).size;\n" +
"  }\n" +
"}\n" +
"\n" +
"return { generateHydrology, hydrologyResourceSuitability, populateWatershedResources };\n" +
"})();\n" +
"modules[\"server/conquest-pacing.mjs\"] = (() => {\n" +
"const CONQUEST_PACING = Object.freeze({ quietUntil:120, guidanceAt:160, neutralConflictAt:300, tribeContactAt:420,\n" +
"  expertLevelFourAt:600, aiLevelFourAt:1200, activePopulation:36, inefficientPopulation:70,\n" +
"  workerShare:Object.freeze([.8,.65,.45,.3]), nestCosts:Object.freeze([80,200,500,null]),\n" +
"  attributeCosts:Object.freeze([0,0,8,16,24]), aiUpgradeAt:Object.freeze([0,270,690,1200]),\n" +
"  productionInterval:3, frontierSamples:48 });\n" +
"\n" +
"const TRIBE_PACING = Object.freeze({\n" +
"  bean:Object.freeze({tempo:1,population:36,native:null,army:Object.freeze([\"blade\",\"carapace\",\"feet\"])}),\n" +
"  spore:Object.freeze({tempo:.95,population:40,native:\"blade\",army:Object.freeze([\"blade\",\"feet\"])}),\n" +
"  pebble:Object.freeze({tempo:1.1,population:32,native:\"piercing\",army:Object.freeze([\"piercing\",\"carapace\",\"blade\"])}),\n" +
"  spring:Object.freeze({tempo:.9,population:36,native:null,army:Object.freeze([\"blade\",\"feet\",\"piercing\"])})\n" +
"});\n" +
"\n" +
"function colonyWorkerShare(nestLevel,simSeconds,tribe) {\n" +
"  if(Number.isFinite(simSeconds)&&simSeconds<CONQUEST_PACING.tribeContactAt*(TRIBE_PACING[tribe]?.tempo||1))return .8;\n" +
"  return CONQUEST_PACING.workerShare[Math.max(0,Math.min(3,nestLevel-1))];\n" +
"}\n" +
"\n" +
"function aiUpgradeReadyAt(nestLevel,tribe) {\n" +
"  return CONQUEST_PACING.aiUpgradeAt[nestLevel] === undefined ? Infinity : CONQUEST_PACING.aiUpgradeAt[nestLevel]*(TRIBE_PACING[tribe]?.tempo||1);\n" +
"}\n" +
"\n" +
"function conquestEncounterPlan(plan) {\n" +
"  const passive=[\"flower-tail-bird\",\"dew-rabbit\",\"soil-mole\",\"bundle-snail\",\"cotton-sheep\",\"rolling-acorn\"].includes(plan.key);\n" +
"  if(plan.unique)return {...plan,safeRadius:Math.max(24,plan.safeRadius),preferredDistance:Math.min(64,plan.preferredDistance),spawn:\"≥120초 ∧ \"+plan.spawn};\n" +
"  if(passive)return {...plan,safeRadius:12,preferredDistance:Math.min(26,plan.preferredDistance)};\n" +
"  return {...plan,spawn:plan.key===\"spiny-back-beetle\" ? \"0초 · 습격 ≥300초\" : \"≥240초\",safeRadius:28,preferredDistance:Math.min(48,plan.preferredDistance),radius:Math.min(10,plan.radius)};\n" +
"}\n" +
"\n" +
"function militaryAgent(agent,tribe) {\n" +
" if(agent.productionRole===\"military\")return true;\n" +
" if(agent.dna)return agent.dna.pieces.some(piece=>(piece.gene===\"blade\"||piece.gene===\"secretion\"))&&!agent.dna.pieces.some(piece=>piece.gene===\"gather\");\n" +
" const slots=agent.slots||[],native=TRIBE_PACING[tribe||agent.tribe]?.native;\n" +
" return !slots.includes(\"strength\")&&\n" +
"  slots.some(key=>[\"blade\",\"piercing\",\"carapace\"].includes(key))&&!(slots.length===1&&slots[0]===native);\n" +
"}\n" +
"\n" +
"return { CONQUEST_PACING, TRIBE_PACING, colonyWorkerShare, aiUpgradeReadyAt, conquestEncounterPlan, militaryAgent };\n" +
"})();\n" +
"modules[\"server/tribe-environment.mjs\"] = (() => {\n" +
"function tribeHazardKind(tribe, hazard) {\n" +
"  if (hazard === 1 || hazard === 2) return 0;\n" +
"  return hazard || 0;\n" +
"}\n" +
"\n" +
"function tribeTerrainWalkable(tribe, terrain) {\n" +
"  return terrain >= 2 && terrain <= 10 && !(tribe === \"pebble\" && terrain === 9);\n" +
"}\n" +
"\n" +
"function tribeTerrainSpeedMultiplier(tribe, terrain) {\n" +
"  if (terrain === 1) return 0;\n" +
"  if (terrain === 9) return tribe === \"pebble\" ? 0 : tribe === \"spring\" ? .8 : tribe === \"spore\" ? .6 : .2;\n" +
"  if (tribe === \"spring\" && (terrain === 2 || terrain === 10)) return 1;\n" +
"  if (tribe === \"pebble\") {\n" +
"    if (terrain === 6) return .8;\n" +
"    if (terrain === 7) return .6;\n" +
"    if (terrain === 8) return 1;\n" +
"  }\n" +
"  return terrain === 2 ? .8 : terrain === 6 ? .6 : terrain === 7 ? .4 : terrain === 8 ? .9 : terrain === 10 ? .5 : 1;\n" +
"}\n" +
"\n" +
"function tribeSafeTerrain(tribe, terrain, hazard) {\n" +
"  return tribeTerrainWalkable(tribe, terrain) && !tribeHazardKind(tribe, hazard);\n" +
"}\n" +
"\n" +
"return { tribeHazardKind, tribeTerrainWalkable, tribeTerrainSpeedMultiplier, tribeSafeTerrain };\n" +
"})();\n" +
"modules[\"server/resource-camps.mjs\"] = (() => {\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"\n" +
"const { tribeSafeTerrain, tribeTerrainSpeedMultiplier } = modules[\"server/tribe-environment.mjs\"];\n" +
"\n" +
"const PRIMARY = [\"clay\", \"tree\", \"pebbles\", \"dew\"];\n" +
"const LIMITS = [36, 72, 120, 180, 240];\n" +
"const MINIMUM = [6, 48, 6, 10];\n" +
"\n" +
"function integral(values, size) {\n" +
"  const stride = size + 1, result = new Float64Array(stride * stride);\n" +
"  for (let y = 0; y < size; y++) {\n" +
"    let row = 0;\n" +
"    for (let x = 0; x < size; x++) {\n" +
"      row += values[y * size + x];\n" +
"      result[(y + 1) * stride + x + 1] = result[y * stride + x + 1] + row;\n" +
"    }\n" +
"  }\n" +
"  return result;\n" +
"}\n" +
"\n" +
"function area(table, x, y, radius, size) {\n" +
"  const stride = size + 1, left = Math.max(0, x - radius), right = Math.min(size, x + radius + 1);\n" +
"  const top = Math.max(0, y - radius), bottom = Math.min(size, y + radius + 1);\n" +
"  return table[bottom * stride + right] - table[top * stride + right] - table[bottom * stride + left] + table[top * stride + left];\n" +
"}\n" +
"\n" +
"function campResourceTravel(world, camp, limit) {\n" +
"  const { size, terrain, hazards } = world, costs = new Int16Array(terrain.length).fill(-1);\n" +
"  const blocked = new Set();\n" +
"  for (const nest of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) blocked.add((nest.y + dy) * size + nest.x + dx);\n" +
"  }\n" +
"  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked.add(burrow.y * size + burrow.x + dx);\n" +
"  const buckets = Array.from({ length: limit + 1 }, () => []);\n" +
"  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {\n" +
"    const index = (camp.y + dy) * size + camp.x + dx;\n" +
"    if (world.hydrology?.generationVersion >= 30 && !tribeSafeTerrain(camp.tribe, terrain[index], hazards[index])) continue;\n" +
"    costs[index] = 0; buckets[0].push(index);\n" +
"  }\n" +
"  for (let cost = 0; cost <= limit; cost++) for (const index of buckets[cost]) {\n" +
"    if (costs[index] !== cost) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {\n" +
"      if (nx < 0 || ny < 0 || nx >= size || ny >= size || Math.abs(nx - camp.x) <= 2 && Math.abs(ny - camp.y) <= 2 &&\n" +
"          !(Math.abs(nx - camp.x) === 2 && Math.abs(ny - camp.y) === 2)) continue;\n" +
"      const next = ny * size + nx, type = terrain[next];\n" +
"      const current = world.hydrology?.generationVersion >= 30;\n" +
"      if ((current ? !tribeSafeTerrain(camp.tribe, type, hazards[next]) : type < 2 || hazards[next]) || blocked.has(next)) continue;\n" +
"      const distance = cost + (current ? Math.ceil(3 / tribeTerrainSpeedMultiplier(camp.tribe, type)) : type === 10 ? 6 : type >= 6 && type <= 8 ? 5 : 3);\n" +
"      if (distance > limit || costs[next] >= 0 && costs[next] <= distance) continue;\n" +
"      costs[next] = distance; buckets[distance].push(next);\n" +
"    }\n" +
"  }\n" +
"  return costs;\n" +
"}\n" +
"\n" +
"function measureCampExpansion(world, camp, key) {\n" +
"  const travel = campResourceTravel(world, camp, LIMITS.at(-1)), bands = LIMITS.map(() => ({ nodes: 0, amount: 0 }));\n" +
"  const directions = new Set();\n" +
"  let weightedAmount = 0;\n" +
"  for (const [x, y, amount, type] of world.resources) {\n" +
"    if (type !== key) continue;\n" +
"    if (world.hydrology?.generationVersion >= 32 && Math.abs(x - camp.x) <= 2 && Math.abs(y - camp.y) <= 2) continue;\n" +
"    const distance = travel[y * world.size + x];\n" +
"    if (distance < 0) continue;\n" +
"    const band = LIMITS.findIndex(limit => distance <= limit);\n" +
"    bands[band].nodes++; bands[band].amount += amount;\n" +
"    if (distance <= 72) weightedAmount += amount * Math.exp(-distance / 18);\n" +
"    if (distance > 36) directions.add((x >= camp.x ? 1 : 0) + (y >= camp.y ? 2 : 0));\n" +
"  }\n" +
"  return { key, limits: LIMITS, bands, directions: directions.size, weightedAmount };\n" +
"}\n" +
"\n" +
"function starterResourceIndex(world) {\n" +
"  const index = new Map();\n" +
"  for (const cell of world.resources) {\n" +
"    const position = cell[1] * world.size + cell[0];\n" +
"    if (!index.has(position)) index.set(position, []);\n" +
"    index.get(position).push(cell);\n" +
"  }\n" +
"  return index;\n" +
"}\n" +
"\n" +
"// Level-one DNA workers cannot leave the three-cell nest boundary range.\n" +
"// Count only natural food that survives footprint/tree clearing and has a\n" +
"// safe path inside that range. Do not manufacture resources or move old maps.\n" +
"function starterFoodCells(world, camp, key, resourceIndex) {\n" +
"  const {size, terrain, hazards} = world, boundary = [];\n" +
"  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {\n" +
"    if(Math.abs(dx)===2 && Math.abs(dy)===2)continue;\n" +
"    if(Math.abs(dx)===2 || Math.abs(dy)===2)boundary.push([camp.x+dx,camp.y+dy]);\n" +
"  }\n" +
"  const inside=(x,y)=>boundary.some(([bx,by])=>(x-bx)**2+(y-by)**2<=9);\n" +
"  const plot=(x,y)=>Math.abs(x-camp.x)<=2&&Math.abs(y-camp.y)<=2;\n" +
"  const seen=new Set(), queue=[];\n" +
"  for(const [dx,dy] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {\n" +
"    const x=camp.x+dx,y=camp.y+dy,i=y*size+x;\n" +
"    if(tribeSafeTerrain(camp.tribe,terrain[i],hazards[i])){seen.add(i);queue.push([x,y]);}\n" +
"  }\n" +
"  for(let j=0;j<queue.length;j++)for(const [x,y] of [[queue[j][0]-1,queue[j][1]],[queue[j][0]+1,queue[j][1]],[queue[j][0],queue[j][1]-1],[queue[j][0],queue[j][1]+1]]) {\n" +
"    const i=y*size+x;\n" +
"    if(x<0||y<0||x>=size||y>=size||plot(x,y)||!inside(x,y)||seen.has(i)||!tribeSafeTerrain(camp.tribe,terrain[i],hazards[i]))continue;\n" +
"    seen.add(i);queue.push([x,y]);\n" +
"  }\n" +
"  const treeClearRadius=(world.generationVersion??world.hydrology?.generationVersion??40)>=41?3:4;\n" +
"  return [...seen].flatMap(i=>resourceIndex.get(i)||[]).filter(([x,y,amount,type])=>type===key&&amount>0&&!plot(x,y)&&\n" +
"    !(key==='tree'&&camp.tribe==='spore'&&(x-camp.x)**2+(y-camp.y)**2<=treeClearRadius**2));\n" +
"}\n" +
"\n" +
"function starterFoodAccess(world, camp, key, resourceIndex = starterResourceIndex(world)) {\n" +
"  const cells=starterFoodCells(world,camp,key,resourceIndex);\n" +
"  return {nodes:cells.length,amount:cells.reduce((sum,cell)=>sum+cell[2],0)};\n" +
"}\n" +
"\n" +
"function increaseStarterFood(world) {\n" +
"  const resourceIndex=starterResourceIndex(world), increased=new Set();\n" +
"  const foods={sprout:'clay',bean:'clay',spore:'tree',pebble:'pebbles',spring:'dew'};\n" +
"  for(const camp of world.camps) {\n" +
"    for(const cell of starterFoodCells(world,camp,foods[camp.tribe],resourceIndex)) {\n" +
"      if(increased.has(cell))continue;\n" +
"      cell[2]*=2000;increased.add(cell);\n" +
"    }\n" +
"  }\n" +
"  for(const field of world.hydrology?.placementMaps||[]) {\n" +
"    if(!field.values)continue;\n" +
"    for(const [x,y,amount,key] of increased) {\n" +
"      if(field.id==='resource:amount'||field.id==='resource:'+key+':amount')field.values[y*world.size+x]=amount;\n" +
"    }\n" +
"  }\n" +
"}\n" +
"\n" +
"function placeResourceCamps(world, tribes, version = world.hydrology?.generationVersion) {\n" +
"  const { size, terrain, hazards } = world, occupied = new Uint8Array(terrain.length), labels = new Int32Array(terrain.length);\n" +
"  const queue = new Int32Array(terrain.length), populations = [0];\n" +
"  for (const [x, y] of [...world.food, ...world.resources]) occupied[y * size + x] = 1;\n" +
"  for (let first = 0; first < terrain.length; first++) {\n" +
"    if (labels[first] || terrain[first] < 2 || hazards[first]) continue;\n" +
"    const label = populations.length;\n" +
"    let end = 1; queue[0] = first; labels[first] = label;\n" +
"    for (let cursor = 0; cursor < end; cursor++) {\n" +
"      const index = queue[cursor], x = index % size, y = Math.floor(index / size);\n" +
"      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {\n" +
"        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;\n" +
"        const next = ny * size + nx;\n" +
"        if (labels[next] || terrain[next] < 2 || hazards[next]) continue;\n" +
"        labels[next] = label; queue[end++] = next;\n" +
"      }\n" +
"    }\n" +
"    populations.push(end);\n" +
"  }\n" +
"  const main = populations.indexOf(Math.max(...populations)), available = [];\n" +
"  const frontierFields = new Map();\n" +
"  for (const tribe of tribes) frontierFields.set(tribe.key, (world.frontierSites || []).map(site => ({ site,\n" +
"    costs: campResourceTravel(world, { ...site, tribe: tribe.key }, 420) })));\n" +
"  const spacing = world.hydrology?.generationVersion >= 32 ? 1 : 3;\n" +
"  for (let y = 16; y < size - 16; y += spacing) for (let x = 16; x < size - 16; x += spacing) {\n" +
"    if (labels[y * size + x] !== main) continue;\n" +
"    let valid = true;\n" +
"    for (let dy = -3; dy <= 3 && valid; dy++) for (let dx = -3; dx <= 3; dx++) {\n" +
"      const index = (y + dy) * size + x + dx;\n" +
"      if (terrain[index] < 2 || terrain[index] >= 6 || hazards[index] || Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && !(world.hydrology?.generationVersion >= 32) && occupied[index]) { valid = false; break; }\n" +
"    }\n" +
"    if (valid) available.push({ x, y });\n" +
"  }\n" +
"  if (world.hydrology?.placementMaps) {\n" +
"    const values = new Uint8Array(terrain.length);\n" +
"    for (const site of available) values[site.y * size + site.x] = 1;\n" +
"    recordPlacementMap(world.hydrology, \"camp:available\", [\"camps\"], values, { minimum: 0, maximum: 1 });\n" +
"  }\n" +
"  const starterResources = version >= 40 ? starterResourceIndex(world) : null;\n" +
"  const choices = PRIMARY.map((key, order) => {\n" +
"    const values = new Float64Array(terrain.length);\n" +
"    for (const [x, y, amount, type] of world.resources) if (type === key) values[y * size + x] = amount;\n" +
"    const table = integral(values, size);\n" +
"    const nodeCounts = world.hydrology?.generationVersion >= 32 ? integral(Uint8Array.from(values, value => value > 0 ? 1 : 0), size) : null;\n" +
"    const ranked = available.map(site => {\n" +
"      const frontiers = frontierFields.get(tribes[order].key).map(({site: frontier, costs}) => ({ id: frontier.id, cost: costs[site.y * size + site.x] }))\n" +
"        .filter(entry => entry.cost >= 0 && entry.cost <= (world.hydrology?.generationVersion >= 31 ? 390 : 420));\n" +
"      const plotAmount = world.hydrology?.generationVersion >= 32 ? area(table, site.x, site.y, 2, size) : 0;\n" +
"      return { ...site, frontiers, score: (area(table, site.x, site.y, 12, size) * 2 +\n" +
"        area(table, site.x, site.y, 28, size) * .5 + area(table, site.x, site.y, 56, size) * .08 - plotAmount * 2.58) * (1 + Math.min(3, frontiers.length) * .12) };\n" +
"    });\n" +
"    if (world.hydrology?.placementMaps) {\n" +
"      const scores = new Float32Array(terrain.length).fill(NaN);\n" +
"      for (const site of ranked) scores[site.y * size + site.x] = site.score;\n" +
"      recordPlacementMap(world.hydrology, \"camp-score:\" + (order + 1), [\"camps\"], scores, { camp: order + 1, minimum: 0 });\n" +
"    }\n" +
"    ranked.sort((left, right) => right.score - left.score || left.y - right.y || left.x - right.x);\n" +
"    const result = [], sampled = [];\n" +
"    for (const site of ranked) {\n" +
"      if (sampled.some(other => Math.hypot(site.x - other.x, site.y - other.y) < 14)) continue;\n" +
"      if (nodeCounts && area(nodeCounts, site.x, site.y, 14, size) < MINIMUM[order]) continue;\n" +
"      if (version >= 40 && starterFoodAccess(world, { ...site, tribe: tribes[order].key }, key, starterResources).nodes < 2) continue;\n" +
"      if (!nodeCounts) sampled.push(site);\n" +
"      const expansion = measureCampExpansion(world, { ...site, tribe: tribes[order].key }, key);\n" +
"      if (expansion.bands.some(band => band.nodes < MINIMUM[order]) || expansion.directions < 2) continue;\n" +
"      if (nodeCounts) sampled.push(site);\n" +
"      result.push({ ...site, expansion });\n" +
"      if (result.length >= 20) break;\n" +
"    }\n" +
"    return result;\n" +
"  });\n" +
"  const order = [0, 1, 2, 3].sort((left, right) => choices[left].length - choices[right].length), selected = [];\n" +
"  let best = null, bestScore = -Infinity;\n" +
"  function assign(depth) {\n" +
"    if (depth === order.length) {\n" +
"      if (!world.frontierSites?.length) { best = selected.slice(); return true; }\n" +
"      const shared = new Map(), covered = new Set();\n" +
"      for (const [tribe, candidate] of selected.entries()) for (const frontier of candidate.frontiers) {\n" +
"        if (!shared.has(frontier.id)) shared.set(frontier.id, []);\n" +
"        shared.get(frontier.id).push({ tribe, cost: frontier.cost });\n" +
"      }\n" +
"      let score = 0, contested = 0;\n" +
"      for (const entries of shared.values()) if (entries.length >= 2) {\n" +
"        contested++; score += 150 - Math.max(...entries.map(entry => entry.cost)) * .1;\n" +
"        for (const entry of entries) covered.add(entry.tribe);\n" +
"      }\n" +
"      score += covered.size * 1000;\n" +
"      if (score > bestScore) { best = selected.slice(); bestScore = score; }\n" +
"      return covered.size === 4 && contested >= 2;\n" +
"    }\n" +
"    const tribe = order[depth];\n" +
"    for (const candidate of choices[tribe]) {\n" +
"      if (selected.some(other => other && Math.hypot(candidate.x - other.x, candidate.y - other.y) < Math.min(80, size / 4))) continue;\n" +
"      selected[tribe] = candidate;\n" +
"      if (assign(depth + 1)) return true;\n" +
"      selected[tribe] = null;\n" +
"    }\n" +
"    return false;\n" +
"  }\n" +
"  assign(0);\n" +
"  if (!best) throw new Error(\"자연 자원과 안전한 확장 경로를 갖춘 네 종족의 시작 위치가 부족합니다.\");\n" +
"  if (world.frontierSites) for (const site of world.frontierSites) site.contenders = best.flatMap((candidate, order) => {\n" +
"    const reach = candidate.frontiers.find(frontier => frontier.id === site.id);\n" +
"    return reach ? [{ tribe: tribes[order].key === \"sprout\" ? \"bean\" : tribes[order].key, cost: reach.cost }] : [];\n" +
"  });\n" +
"  return tribes.map((tribe, order) => ({ id: order + 1, tribe: tribe.key, name: tribe.name, x: best[order].x,\n" +
"    y: best[order].y, playable: true, controller: order === 0 ? \"player\" : \"ai\", expansion: best[order].expansion }));\n" +
"}\n" +
"\n" +
"return { campResourceTravel, measureCampExpansion, starterFoodAccess, increaseStarterFood, placeResourceCamps };\n" +
"})();\n" +
"modules[\"server/natural-resources.mjs\"] = (() => {\n" +
"const { quantizeLandscapeValue } = modules[\"server/landscape-processes.mjs\"];\n" +
"const { distributeLandscapeBiomes } = modules[\"server/landscape-ecology.mjs\"];\n" +
"const { recordPlacementMap, placementNoise } = modules[\"server/placement-maps.mjs\"];\n" +
"const { populateFormedResources } = modules[\"server/terrain-resources.mjs\"];\n" +
"\n" +
"const { createResourceHabitats, resourceHabitatSuitability } = modules[\"server/resource-habitats.mjs\"];\n" +
"\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"const TERRAIN_DISTRIBUTION = { swamp: .07, forest: .22, dryLand: .12, poisonSpore: .025 };\n" +
"\n" +
"function distributeNaturalBiomes(world, fields, version) {\n" +
"  const { size, seed, terrain, hydrology: h } = world;\n" +
"  const sources = {\n" +
"    wetland: placementNoise(h, \"biome:wetland-noise\", [\"swamp\"], (x, y) => noise(x, y, 21, seed + 3023)),\n" +
"    forestBroad: placementNoise(h, \"biome:forest-broad\", [\"forest\"], (x, y) => noise(x, y, 37, seed + 3001)),\n" +
"    forestDetail: placementNoise(h, \"biome:forest-detail\", [\"forest\"], (x, y) => noise(x, y, 13, seed + 3011)),\n" +
"    glades: placementNoise(h, \"biome:glades\", [\"forest\"], (x, y) => noise(x, y, 7, seed + 3019)),\n" +
"    dry: placementNoise(h, \"biome:dry-noise\", [\"forest\", \"resources\"], (x, y) => noise(x, y, 29, seed + 3331))\n" +
"  };\n" +
"  const land = terrain.filter(type => type >= 2 && type !== 10).length, lowlands = [];\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    if (terrain[index] < 3 || terrain[index] > 5) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    const flatness = 1 / (1 + h.slope[index] * 100), convergence = Math.min(1, Math.log1p(h.flow[index]) / 8);\n" +
"    lowlands.push({ index,\n" +
"      swamp: fields.soilMoisture[index] * .28 + flatness * .28 + h.wetness[index] * .2 + convergence * .12 +\n" +
"        sources.wetland(x, y) * .12,\n" +
"      forest: fields.rainfall[index] * .55 + fields.soilDepth[index] * .25 +\n" +
"        sources.forestBroad(x, y) * .13 + sources.forestDetail(x, y) * .06,\n" +
"      dry: (1 - fields.soilMoisture[index]) * .65 + fields.sandySoil[index] * .2 + sources.dry(x, y) * .15 });\n" +
"    terrain[index] = 4;\n" +
"  }\n" +
"  if (h.placementMaps) for (const [key, layer] of [[\"swamp\", \"swamp\"], [\"forest\", \"forest\"], [\"dry\", \"forest\"]]) {\n" +
"    const values = new Float32Array(terrain.length).fill(NaN);\n" +
"    for (const item of lowlands) values[item.index] = item[key];\n" +
"    recordPlacementMap(h, \"biome:\" + key + \"-score\", [layer], values, {});\n" +
"  }\n" +
"  const wetlands = lowlands.filter(item => h.slope[item.index] < .025 && fields.soilMoisture[item.index] > .42)\n" +
"    .sort((left, right) => right.swamp - left.swamp || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.swamp));\n" +
"  for (const { index } of wetlands) terrain[index] = 9;\n" +
"  const forests = lowlands.filter(item => terrain[item.index] === 4 && sources.glades(item.index % size, Math.floor(item.index / size)) < .3)\n" +
"    .sort((left, right) => right.forest - left.forest || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.forest));\n" +
"  for (const { index } of forests) terrain[index] = 5;\n" +
"  const drylands = lowlands.filter(item => terrain[item.index] === 4)\n" +
"    .sort((left, right) => right.dry - left.dry || left.index - right.index).slice(0, Math.round(land * TERRAIN_DISTRIBUTION.dryLand));\n" +
"  for (const { index } of drylands) terrain[index] = 3;\n" +
"  const colonies = wetlands.slice().sort((left, right) => {\n" +
"    const score = item => noise(item.index % size, Math.floor(item.index / size), 15, seed + 3037) * .7 + item.swamp * .3;\n" +
"    return score(right) - score(left) || left.index - right.index;\n" +
"  });\n" +
"  if (version < 30) for (const { index } of colonies.slice(0, Math.round(land * TERRAIN_DISTRIBUTION.poisonSpore))) world.hazards[index] = 1;\n" +
"\n" +
"}\n" +
"\n" +
"function populateNaturalResources(world, version) {\n" +
"  if(version>=33)return populateFormedResources(world);\n" +
"  const { size, seed, terrain, hydrology: h } = world, occupied = new Uint8Array(terrain.length);\n" +
"  const fields = createResourceHabitats(world);\n" +
"  if (version >= 32) distributeLandscapeBiomes(world, fields);\n" +
"  else if (version >= 28) distributeNaturalBiomes(world, fields, version);\n" +
"  else for (let index = 0; index < terrain.length; index++) {\n" +
"    if (terrain[index] < 3 || terrain[index] > 5) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    const forest = fields.rainfall[index] * .55 + fields.soilDepth[index] * .25 +\n" +
"      noise(x, y, 37, seed + 3001) * .13 + noise(x, y, 13, seed + 3011) * .06;\n" +
"    terrain[index] = forest > .43 && noise(x, y, 7, seed + 3019) < .3 ? 5 : fields.rainfall[index] < .34 ? 3 : 4;\n" +
"  }\n" +
"  h.resourceHabitats = createResourceHabitats(world);\n" +
"  const habitat = h.resourceHabitats;\n" +
"  world.resources = []; world.food = [];\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    if (!(version >= 28) && terrain[index] === 4 && h.wetness[index] > .65 && h.slope[index] < .012 && noise(x, y, 17, seed + 3023) > .1) {\n" +
"      terrain[index] = 9;\n" +
"      if (h.wetness[index] > .7 && noise(x, y, 11, seed + 3037) > .15) world.hazards[index] = 1;\n" +
"    }\n" +
"    if (h.forestMask ? !h.forestMask[index] : terrain[index] !== 5) continue;\n" +
"    const amount = Math.round(20 + habitat.soilDepth[index] * 35 + habitat.soilMoisture[index] * 25);\n" +
"    world.resources.push([x, y, amount, \"tree\"]); occupied[index] = 1;\n" +
"  }\n" +
"  const definitions = [\n" +
"    [\"clay\", .025, .065, 12, 28], [\"pebbles\", ...(version >= 29 ? [0, .4, 12, 42] : [.02, .085, 10, 30])], [\"dew\", .025, .06, 3, 10],\n" +
"    [\"honey-mushrooms\", .04, .15, 10, 35]\n" +
"  ];\n" +
"  for (const [order, [key, minimum, density, baseAmount, richness]] of definitions.entries()) {\n" +
"    if (version >= 30 && key === \"honey-mushrooms\") continue;\n" +
"    const patchNoise = placementNoise(version >= 32 ? null : h, \"resource:\" + key + \":patch\", [\"resources\"],\n" +
"      (x, y) => noise(x, y, 23, seed + 3067 + order * 37), { resource: key });\n" +
"    const draw = (x, y) => hash(x, y, seed + 3083 + order * 41);\n" +
"    const probability = h.placementMaps ? new Float32Array(terrain.length) : null;\n" +
"    recordPlacementMap(h, \"resource:\" + key + \":suitability\", [\"resources\"], null,\n" +
"      { sample: (x, y) => resourceHabitatSuitability(key, y * size + x, terrain, h), resource: key, minimum: 0 });\n" +
"    recordPlacementMap(h, \"resource:\" + key + \":draw\", [\"resources\"], null,\n" +
"      { sample: draw, resource: key, minimum: 0, maximum: 1 });\n" +
"    for (let index = 0; index < terrain.length; index++) {\n" +
"      if (occupied[index] || world.hazards[index]) continue;\n" +
"      const suitability = resourceHabitatSuitability(key, index, terrain, h);\n" +
"      if (!suitability) continue;\n" +
"      const x = index % size, y = Math.floor(index / size);\n" +
"      const patch = version >= 32 ? 1 : .7 + Math.max(0, patchNoise(x, y)) * .7;\n" +
"      const abundance = suitability / (1 + suitability);\n" +
"      const chance = version >= 32 ? quantizeLandscapeValue((minimum + density * abundance) * patch) : (minimum + density * abundance) * patch;\n" +
"      if (probability) probability[index] = chance;\n" +
"      if (draw(x, y) > chance) continue;\n" +
"      let amount = Math.max(1, Math.round(baseAmount + richness * abundance * (.5 + hash(x, y, seed + 3089 + order * 43))));\n" +
"      if (version >= 30 && terrain[index] === 9) {\n" +
"        if (key === \"dew\") amount = Math.round(24 + 36 * habitat.soilMoisture[index] + 20 * hash(x, y, seed + 3359));\n" +
"        if (key === \"clay\") amount = Math.round(amount * 2);\n" +
"      }\n" +
"      const point = [x, y, amount, key]; occupied[index] = 1;\n" +
"      if (key === \"honey-mushrooms\") world.food.push(point);\n" +
"      else world.resources.push(point);\n" +
"    }\n" +
"    recordPlacementMap(h, \"resource:\" + key + \":probability\", [\"resources\"], probability, { resource: key, minimum: 0 });\n" +
"  }\n" +
"  if (h.placementMaps) {\n" +
"    recordPlacementMap(h, \"resource:tree:suitability\", [\"resources\"], null,\n" +
"      { resource: \"tree\", minimum: 0, sample: (x, y) => resourceHabitatSuitability(\"tree\", y * size + x, terrain, h) });\n" +
"    const total = new Float32Array(terrain.length);\n" +
"    for (const [x, y, amount] of world.resources) total[y * size + x] = amount;\n" +
"    recordPlacementMap(h, \"resource:amount\", [\"resources\"], total, { minimum: 0, scope: \"all\" });\n" +
"    for (const key of [\"tree\", ...definitions.map(item => item[0]).filter(key => key !== \"honey-mushrooms\")]) {\n" +
"      const amounts = new Float32Array(terrain.length);\n" +
"      for (const [x, y, amount, type] of world.resources) if (type === key) amounts[y * size + x] = amount;\n" +
"      recordPlacementMap(h, \"resource:\" + key + \":amount\", [\"resources\"], amounts, { resource: key, minimum: 0 });\n" +
"    }\n" +
"    for (const [id, layer, values] of [[\"forest\", \"forest\", h.forestMask || Uint8Array.from(terrain, type => type === 5 ? 1 : 0)],\n" +
"      [\"swamp\", \"swamp\", Uint8Array.from(terrain, type => type === 9 ? 1 : 0)]])\n" +
"      recordPlacementMap(h, \"biome:\" + id + \"-mask\", [layer], values, { minimum: 0, maximum: 1 });\n" +
"  }\n" +
"}\n" +
"\n" +
"return { TERRAIN_DISTRIBUTION, populateNaturalResources };\n" +
"})();\n" +
"modules[\"server/frontier-sites.mjs\"] = (() => {\n" +
"function integral(values, size) {\n" +
"  const stride = size + 1, table = new Float64Array(stride * stride);\n" +
"  for (let y = 0; y < size; y++) {\n" +
"    let row = 0;\n" +
"    for (let x = 0; x < size; x++) {\n" +
"      row += values[y * size + x];\n" +
"      table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row;\n" +
"    }\n" +
"  }\n" +
"  return table;\n" +
"}\n" +
"\n" +
"function area(table, x, y, radius, size) {\n" +
"  const stride = size + 1, left = Math.max(0, x - radius), right = Math.min(size, x + radius + 1);\n" +
"  const top = Math.max(0, y - radius), bottom = Math.min(size, y + radius + 1);\n" +
"  return table[bottom * stride + right] - table[top * stride + right] - table[bottom * stride + left] + table[top * stride + left];\n" +
"}\n" +
"\n" +
"function identifyFrontierSites(world) {\n" +
"  const { size, terrain, hazards } = world, occupied = new Uint8Array(terrain.length), fields = {};\n" +
"  for (const key of [\"clay\", \"tree\", \"pebbles\", \"dew\"]) fields[key] = new Float64Array(terrain.length);\n" +
"  for (const [x, y, amount, key] of [...world.food, ...world.resources]) {\n" +
"    occupied[y * size + x] = 1;\n" +
"    if (fields[key]) fields[key][y * size + x] = amount;\n" +
"  }\n" +
"  fields.swamp = Float64Array.from(terrain, type => type === 9 ? 1 : 0);\n" +
"  const tables = Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, integral(values, size)]));\n" +
"  const candidates = { wetland: [], forest: [], crossing: [] };\n" +
"  for (let y = 8; y < size - 8; y += 4) for (let x = 8; x < size - 8; x += 4) {\n" +
"    let clear = true;\n" +
"    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      const index = (y + dy) * size + x + dx;\n" +
"      if (terrain[index] < 2 || terrain[index] > 4 || hazards[index] || occupied[index]) { clear = false; break; }\n" +
"    }\n" +
"    if (!clear) continue;\n" +
"    const resources = Object.fromEntries([\"clay\", \"tree\", \"pebbles\", \"dew\"].map(key => [key, area(tables[key], x, y, 16, size)]));\n" +
"    const swamp = area(tables.swamp, x, y, 16, size);\n" +
"    if (swamp >= 30 && resources.dew >= 100 && resources.clay >= 80) candidates.wetland.push({ x, y, resources,\n" +
"      score: Math.sqrt(resources.dew * resources.clay) + swamp * .25 });\n" +
"    if (resources.tree >= 1800) candidates.forest.push({ x, y, resources,\n" +
"      score: Math.sqrt(resources.tree) + resources.clay * .02 + resources.dew * .05 });\n" +
"    if (world.hydrology.fords.some(ford => Math.hypot(x - ford.x, y - ford.y) <= 12)) candidates.crossing.push({ x, y, resources,\n" +
"      score: Math.sqrt(resources.pebbles) * 3 + Math.sqrt(resources.tree) + Math.sqrt(resources.clay + resources.dew) });\n" +
"  }\n" +
"  const selected = [];\n" +
"  for (const [kind, entries] of Object.entries(candidates)) {\n" +
"    entries.sort((left, right) => right.score - left.score || left.y - right.y || left.x - right.x);\n" +
"    let count = 0;\n" +
"    for (const entry of entries) {\n" +
"      if (selected.some(site => Math.hypot(entry.x - site.x, entry.y - site.y) < 32)) continue;\n" +
"      selected.push({ ...entry, kind, id: entry.y * size + entry.x });\n" +
"      if (++count >= 2) break;\n" +
"    }\n" +
"  }\n" +
"  return selected;\n" +
"}\n" +
"\n" +
"return { identifyFrontierSites };\n" +
"})();\n" +
"modules[\"server/island-world.mjs\"] = (() => {\n" +
"const { conquestEncounterPlan } = modules[\"server/conquest-pacing.mjs\"];\n" +
"const { WORLD_SIZE } = modules[\"server/world-size.mjs\"];\n" +
"const { recordPlacementMap } = modules[\"server/placement-maps.mjs\"];\n" +
"const { campResourceTravel } = modules[\"server/resource-camps.mjs\"];\n" +
"const { generateHydrology } = modules[\"server/hydrology.mjs\"];\n" +
"const { createResourceHabitats, resourceHabitatSuitability } = modules[\"server/resource-habitats.mjs\"];\n" +
"const { placeResourceCamps, increaseStarterFood } = modules[\"server/resource-camps.mjs\"];\n" +
"const { generateWildlife, generateResourceAreas } = modules[\"server/ecology.mjs\"];\n" +
"const { RESOURCE_ECONOMY } = modules[\"server/economy.mjs\"];\n" +
"const { measureStartingEconomy } = modules[\"server/start-economy.mjs\"];\n" +
"const { populateNaturalResources } = modules[\"server/natural-resources.mjs\"];\n" +
"const { identifyFrontierSites } = modules[\"server/frontier-sites.mjs\"];\n" +
"\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  const tx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), ty = (fy - iy) ** 2 * (3 - 2 * (fy - iy));\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"\n" +
"function allocate(points, budget) {\n" +
"  if (!points.length || points.length > budget) throw new Error(\"자연 서식지의 자원 총량을 배분할 수 없습니다.\");\n" +
"  const sum = points.reduce((value, point) => value + point[2], 0), fractions = [];\n" +
"  let total = 0;\n" +
"  for (const point of points) {\n" +
"    const value = 1 + (budget - points.length) * point[2] / sum;\n" +
"    point[2] = Math.floor(value); total += point[2]; fractions.push({ point, fraction: value % 1 });\n" +
"  }\n" +
"  fractions.sort((left, right) => right.fraction - left.fraction || left.point[1] - right.point[1] || left.point[0] - right.point[0]);\n" +
"  for (let order = 0; total < budget; order++, total++) fractions[order].point[2]++;\n" +
"}\n" +
"\n" +
"function populateLandscapeResources(world, baseline) {\n" +
"  const { size, terrain, hydrology: h } = world, budgets = new Map(), occupied = new Uint8Array(terrain.length);\n" +
"  for (const [, , amount, key] of [...baseline.food, ...baseline.resources]) budgets.set(key, (budgets.get(key) || 0) + amount);\n" +
"  const forest = [], fields = createResourceHabitats(world);\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    if (terrain[index] < 3 || terrain[index] > 5) continue;\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    terrain[index] = fields.rainfall[index] < .35 ? 3 : 4;\n" +
"    if (noise(x, y, 7, world.seed + 2309) > .28) continue;\n" +
"    forest.push({ index, score: fields.rainfall[index] * .7 + fields.soilDepth[index] * .2 +\n" +
"      noise(x, y, 27, world.seed + 2311) * .16 + noise(x, y, 9, world.seed + 2317) * .07 - h.slope[index] * .8 });\n" +
"  }\n" +
"  forest.sort((left, right) => right.score - left.score || left.index - right.index);\n" +
"  const treeCount = Math.min(forest.length, Math.floor(budgets.get(\"tree\") / 30));\n" +
"  for (const { index } of forest.slice(0, treeCount)) terrain[index] = 5;\n" +
"  h.resourceHabitats = createResourceHabitats(world);\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    if (terrain[index] === 4 && h.wetness[index] > .65 && h.slope[index] < .012 && noise(x, y, 17, world.seed + 2333) > .1) {\n" +
"      terrain[index] = 9;\n" +
"      if (h.wetness[index] > .7 && noise(x, y, 11, world.seed + 2339) > .1) world.hazards[index] = 1;\n" +
"    }\n" +
"  }\n" +
"  const trees = [];\n" +
"  for (let index = 0; index < terrain.length; index++) if (terrain[index] === 5) {\n" +
"    trees.push([index % size, Math.floor(index / size), .75 + h.resourceHabitats.soilMoisture[index] * .5, \"tree\"]); occupied[index] = 1;\n" +
"  }\n" +
"  allocate(trees, budgets.get(\"tree\"));\n" +
"  world.resources = trees; world.food = [];\n" +
"  const nodeAmounts = { dew: 6, clay: 24, pebbles: 24, \"honey-mushrooms\": 30 };\n" +
"  let order = 0;\n" +
"  for (const [key, budget] of budgets) {\n" +
"    if ([\"nutrients\", \"grass-fiber\", \"sand\", \"iron-ore\", \"copper-ore\", \"quartz\"].includes(key)) continue;\n" +
"    if (key === \"tree\") continue;\n" +
"    const sectors = new Map();\n" +
"    let weight = 0, candidates = 0;\n" +
"    for (let index = 0; index < terrain.length; index++) {\n" +
"      if (occupied[index] || world.hazards[index]) continue;\n" +
"      const suitability = resourceHabitatSuitability(key, index, terrain, h);\n" +
"      if (!suitability) continue;\n" +
"      const x = index % size, y = Math.floor(index / size), sector = Math.floor(y / 16) * Math.ceil(size / 16) + Math.floor(x / 16);\n" +
"      const abundance = suitability * (.6 + Math.max(0, noise(x, y, 21, world.seed + 2351 + order * 31)) * .8);\n" +
"      if (!sectors.has(sector)) sectors.set(sector, { candidates: [], weight: 0, quota: 0, fraction: 0 });\n" +
"      const group = sectors.get(sector);\n" +
"      group.candidates.push({ index, abundance, priority: -Math.log(Math.max(.000001, hash(x, y, world.seed + 2371 + order * 37))) / abundance });\n" +
"      group.weight += abundance; weight += abundance; candidates++;\n" +
"    }\n" +
"    const target = Math.min(candidates, budget, Math.ceil(budget / nodeAmounts[key])), groups = [...sectors.values()];\n" +
"    let remaining = target;\n" +
"    for (const group of groups) {\n" +
"      const expected = target * group.weight / weight;\n" +
"      group.quota = Math.min(group.candidates.length, Math.floor(expected)); group.fraction = expected - group.quota; remaining -= group.quota;\n" +
"    }\n" +
"    groups.sort((left, right) => right.fraction - left.fraction);\n" +
"    while (remaining > 0) for (const group of groups) {\n" +
"      if (!remaining) break;\n" +
"      if (group.quota >= group.candidates.length) continue;\n" +
"      group.quota++; remaining--;\n" +
"    }\n" +
"    const selected = [];\n" +
"    for (const group of groups) {\n" +
"      group.candidates.sort((left, right) => left.priority - right.priority || left.index - right.index);\n" +
"      for (const candidate of group.candidates.slice(0, group.quota)) {\n" +
"        const index = candidate.index;\n" +
"        selected.push([index % size, Math.floor(index / size), .7 + Math.min(1, candidate.abundance), key]); occupied[index] = 1;\n" +
"      }\n" +
"    }\n" +
"    allocate(selected, budget);\n" +
"    if (key === \"honey-mushrooms\") world.food = selected;\n" +
"    else world.resources.push(...selected);\n" +
"    order++;\n" +
"  }\n" +
"}\n" +
"\n" +
"function populateBurrows(world, occupied) {\n" +
"  const { size, terrain, camps } = world, candidates = [];\n" +
"  for (let y = 3; y < size - 3; y++) for (let x = 3; x < size - 5; x++) {\n" +
"    if (camps.some(camp => Math.hypot(x - camp.x, y - camp.y) < 14)) continue;\n" +
"    if (world.frontierSites?.some(site => Math.hypot(x - site.x, y - site.y) < 5)) continue;\n" +
"    candidates.push({ x, y, score: hash(x, y, world.seed + 2381) });\n" +
"  }\n" +
"  candidates.sort((left, right) => left.score - right.score);\n" +
"  for (const [type, width, target, separation] of [[\"large\", 3, 24, 22], [\"small\", 1, 64, 12]]) {\n" +
"    let count = 0;\n" +
"    for (const { x, y } of candidates) {\n" +
"      if (count >= target) break;\n" +
"      if (world.burrows.some(other => Math.hypot(x - other.x, y - other.y) < Math.max(separation, other.type === \"large\" ? 22 : 12))) continue;\n" +
"      let valid = true;\n" +
"      for (let dy = -1; dy <= 1 && valid; dy++) for (let dx = -1; dx <= width; dx++) {\n" +
"        const index = (y + dy) * size + x + dx;\n" +
"        if (terrain[index] < 3 || terrain[index] > 5 || world.hazards[index] || occupied.has(index)) { valid = false; break; }\n" +
"      }\n" +
"      if (!valid) continue;\n" +
"      world.burrows.push({ id: \"burrow:\" + type + \":\" + (y * size + x), type, x, y, width, height: 1,\n" +
"        entrance: { x: x + Math.floor(width / 2), y: y + 1 },\n" +
"        creature: { key: \"spiny-back-beetle\", name: \"가시등 딱정벌레\", group: \"영역\", unique: false } });\n" +
"      count++;\n" +
"    }\n" +
"  }\n" +
"}\n" +
"\n" +
"\n" +
"function clearCampFootprints(world, version) {\n" +
"  const { size, terrain, hydrology: h } = world, plots = new Uint8Array(terrain.length);\n" +
"  const clearedTrees = new Uint8Array(terrain.length);\n" +
"  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"    const index = (camp.y + dy) * size + camp.x + dx;\n" +
"    plots[index] = 1; h.forestMask[index] = 0;\n" +
"    if (terrain[index] === 5) terrain[index] = 4;\n" +
"  }\n" +
"  if (version >= 39) for (const camp of world.camps.filter(camp => camp.tribe === \"spore\")) {\n" +
"    const radius = version >= 41 ? 3 : 4;\n" +
"    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {\n" +
"      if (dx * dx + dy * dy > radius * radius) continue;\n" +
"      const index = (camp.y + dy) * size + camp.x + dx;\n" +
"      clearedTrees[index] = 1; h.forestMask[index] = 0;\n" +
"      if (terrain[index] === 5) terrain[index] = 4;\n" +
"    }\n" +
"  }\n" +
"  world.resources = world.resources.filter(([x, y, , key]) => !plots[y * size + x] && (key !== \"tree\" || !clearedTrees[y * size + x]));\n" +
"  world.food = world.food.filter(([x, y, , key]) => !plots[y * size + x] && (key !== \"tree\" || !clearedTrees[y * size + x]));\n" +
"  if (h.placementMaps) for (const field of h.placementMaps) if (field.id.startsWith(\"resource:\") && field.id.endsWith(\":amount\")) {\n" +
"    for (let index = 0; index < terrain.length; index++) if (plots[index] || field.id === \"resource:tree:amount\" && clearedTrees[index]) field.values[index] = 0;\n" +
"  }\n" +
"  recordPlacementMap(h, \"camp:footprint-mask\", [\"camps\", \"forest\", \"resources\"], plots, { minimum: 0, maximum: 1, stage: \"final\" });\n" +
"}\n" +
"\n" +
"function generateLandscapeWorld(seed, baseline, onProgress, tribes, encounterPlans, version, capturePlacementMaps) {\n" +
"  const generationVersion = version === undefined ? 41 : version;\n" +
"  const size = generationVersion >= 35 ? WORLD_SIZE : 320;\n" +
"  const terrain = new Uint8Array(size * size), moisture = new Float32Array(terrain.length), height = new Float32Array(terrain.length);\n" +
"  const hydrology = generateHydrology(terrain, moisture, height, size, seed, baseline, generationVersion, capturePlacementMaps);\n" +
"  const world = { seed, size, terrain, hydrology, hazards: new Uint8Array(terrain.length), camps: [], burrows: [], encounters: [], food: [], resources: [], foraging: [] };\n" +
"  onProgress?.(.3);\n" +
"  if (hydrology.continent?.natural) populateNaturalResources(world, generationVersion);\n" +
"  else populateLandscapeResources(world, baseline);\n" +
"  if (generationVersion >= 30) world.frontierSites = identifyFrontierSites(world);\n" +
"  onProgress?.(.5);\n" +
"  world.camps = placeResourceCamps(world, tribes, generationVersion);\n" +
"  if (generationVersion >= 32) clearCampFootprints(world, generationVersion);\n" +
"  if (generationVersion >= 41) increaseStarterFood(world);\n" +
"  const occupied = new Set([...world.food, ...world.resources].map(([x, y]) => y * size + x));\n" +
"  populateBurrows(world, occupied);\n" +
"  if (generationVersion >= 31) for (const site of world.frontierSites) site.contenders = [];\n" +
"  if (generationVersion >= 31) for (const camp of world.camps) {\n" +
"    const travel = campResourceTravel(world, camp, 420);\n" +
"    for (const site of world.frontierSites) {\n" +
"      let cost = Infinity;\n" +
"      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"        const distance = travel[(site.y + dy) * size + site.x + dx];\n" +
"        if (distance >= 0) cost = Math.min(cost, distance);\n" +
"      }\n" +
"      if (cost <= 420) site.contenders.push({ tribe: camp.tribe === \"sprout\" ? \"bean\" : camp.tribe, cost });\n" +
"    }\n" +
"  }\n" +
"  const blocked = new Uint8Array(terrain.length), nestDistance = new Float32Array(terrain.length), reachable = new Int16Array(terrain.length).fill(0);\n" +
"  for (const camp of world.camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) blocked[(camp.y + dy) * size + camp.x + dx] = 1;\n" +
"  for (const burrow of world.burrows) for (let dx = 0; dx < burrow.width; dx++) blocked[burrow.y * size + burrow.x + dx] = 1;\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const x = index % size, y = Math.floor(index / size);\n" +
"    nestDistance[index] = Math.min(...world.camps.map(camp => Math.hypot(x - camp.x, y - camp.y)));\n" +
"  }\n" +
"  world.encounters = generateWildlife({ seed, terrain, hazards: world.hazards, blocked, reachable, nestDistance,\n" +
"    waterDistance: hydrology.waterDistance, resourceCells: occupied, generationVersion: generationVersion >= 34 ? generationVersion : 23, hydrology }, generationVersion >= 38 ? encounterPlans.map(conquestEncounterPlan) : encounterPlans);\n" +
"  if (hydrology.placementMaps) {\n" +
"    const habitat = new Uint8Array(terrain.length), appearances = new Uint8Array(terrain.length), nests = new Uint8Array(terrain.length);\n" +
"    for (const [order, encounter] of world.encounters.entries()) {\n" +
"      for (const index of encounter.cells) habitat[index] = 1;\n" +
"      for (const index of encounter.spawnPoints) appearances[index] = order + 1;\n" +
"    }\n" +
"    for (const camp of world.camps) nests[camp.y * size + camp.x] = camp.id;\n" +
"    recordPlacementMap(hydrology, \"unit:habitat\", [\"units\"], habitat, { minimum: 0, maximum: 1, scope: \"all\" });\n" +
"    recordPlacementMap(hydrology, \"unit:spawn\", [\"units\"], appearances, { categorical: true, excluded: 0, scope: \"all\" });\n" +
"    recordPlacementMap(hydrology, \"camp:starts\", [\"camps\"], nests, { categorical: true, excluded: 0 });\n" +
"    for (const type of [\"small\", \"large\"]) {\n" +
"      const values = new Uint8Array(terrain.length);\n" +
"      for (const burrow of world.burrows) if (burrow.type === type) for (let dx = 0; dx < burrow.width; dx++) values[burrow.y * size + burrow.x + dx] = 1;\n" +
"      recordPlacementMap(hydrology, \"burrow:\" + type, [\"units\"], values, { unit: \"burrow-\" + type, minimum: 0, maximum: 1 });\n" +
"      recordPlacementMap(hydrology, \"burrow:\" + type + \":priority\", [\"units\"], null,\n" +
"        { unit: \"burrow-\" + type, minimum: 0, maximum: 1, sample: (x, y) => hash(x, y, seed + 2381) });\n" +
"    }\n" +
"  }\n" +
"  world.economy = { seconds: 300, workers: 2, resources: RESOURCE_ECONOMY.map(policy => {\n" +
"    const points = world.resources.filter(point => point[3] === policy.key);\n" +
"    return { ...policy, cells: points.length, amount: points.reduce((sum, point) => sum + point[2], 0),\n" +
"      coverage: points.length / terrain.length, sectors: new Set(points.map(([x, y]) => Math.floor(x / 32) + \",\" + Math.floor(y / 32))).size };\n" +
"  }) };\n" +
"  world.economy.starts = measureStartingEconomy(world, RESOURCE_ECONOMY);\n" +
"  world.resourceAreas = generateResourceAreas(world);\n" +
"  world.tribeStarts = tribes.map(tribe => ({ ...tribe, terrainRule: true, resourceRule: true }));\n" +
"  if (hydrology.placementMaps) for (const camp of world.camps) recordPlacementMap(hydrology, \"camp-travel:\" + camp.id, [\"camps\"], null,\n" +
"    { camp: camp.id, minimum: 0, maximum: 420, createValues: () => campResourceTravel(world, camp, 420), excluded: -1 });\n" +
"  onProgress?.(1);\n" +
"  return world;\n" +
"}\n" +
"\n" +
"return { populateLandscapeResources, generateLandscapeWorld };\n" +
"})();\n" +
"modules[\"server/map.mjs\"] = (() => {\n" +
"const { LEGACY_RESOURCE_HABITATS } = modules[\"server/resource-legacy.mjs\"];\n" +
"const { WORLD_SIZE } = modules[\"server/world-size.mjs\"];\n" +
"const { generateWildlife, generateResourceAreas } = modules[\"server/ecology.mjs\"];\n" +
"const { populateWorldEconomy } = modules[\"server/economy.mjs\"];\n" +
"const { generateHydrology, hydrologyResourceSuitability, populateWatershedResources } = modules[\"server/hydrology.mjs\"];\n" +
"const { createResourceHabitats } = modules[\"server/resource-habitats.mjs\"];\n" +
"const { generateLandscapeWorld } = modules[\"server/island-world.mjs\"];\n" +
"\n" +
"const SIZE = WORLD_SIZE;\n" +
"const RESOURCE_RADIUS = 22, CAMP_MIN_DISTANCE = 80;\n" +
"const SPORE_NEST_CLEAR_RADIUS = 4;\n" +
"const NEST_SAFE_RADIUS = 10;\n" +
"const TRIBE_STARTS = [{\"key\":\"sprout\",\"name\":\"새싹콩\",\"terrainRule\":null,\"resourceRule\":null},{\"key\":\"spore\",\"name\":\"포자버섯\",\"terrainRule\":null,\"resourceRule\":null},{\"key\":\"pebble\",\"name\":\"몽돌\",\"terrainRule\":null,\"resourceRule\":null},{\"key\":\"spring\",\"name\":\"샘방울\",\"terrainRule\":null,\"resourceRule\":null}];\n" +
"const FORAGING = { workers: 2, seconds: 300, capacity: 2, speed: 0.5, harvestSeconds: 1.5, prepareSeconds: 1, unloadSeconds: 1, nearDistance: 16 };\n" +
"const CREATURES = [{\"key\":\"flower-tail-bird\",\"name\":\"꽃꼬리새\",\"group\":\"공생\",\"terrains\":[4,5],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":0},{\"key\":\"dew-rabbit\",\"name\":\"이슬토끼\",\"group\":\"공생\",\"terrains\":[4,5],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":1},{\"key\":\"soil-mole\",\"name\":\"흙두더지\",\"group\":\"공생\",\"terrains\":[3,4],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":2},{\"key\":\"bundle-snail\",\"name\":\"보따리달팽이\",\"group\":\"생활 중립\",\"terrains\":[2,4,5],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":3},{\"key\":\"cotton-sheep\",\"name\":\"솜양\",\"group\":\"생활 중립\",\"terrains\":[3,4],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":4},{\"key\":\"rolling-acorn\",\"name\":\"굴림도토리\",\"group\":\"생활 중립\",\"terrains\":[3,5],\"nearWater\":false,\"small\":true,\"large\":false,\"order\":5},{\"key\":\"soil-boar\",\"name\":\"흙멧돼지\",\"group\":\"영역\",\"terrains\":[3,4,5],\"nearWater\":false,\"small\":false,\"large\":true,\"order\":6},{\"key\":\"bubble-toad\",\"name\":\"방울두꺼비\",\"group\":\"영역\",\"terrains\":[2,4,5],\"nearWater\":true,\"small\":false,\"large\":true,\"order\":7},{\"key\":\"vine-turtle\",\"name\":\"넝쿨거북\",\"group\":\"영역\",\"terrains\":[4,5],\"nearWater\":false,\"small\":false,\"large\":true,\"order\":8},{\"key\":\"shadow-weasel\",\"name\":\"그늘족제비\",\"group\":\"상위 포식자\",\"terrains\":[5],\"nearWater\":false,\"small\":false,\"large\":true,\"order\":9},{\"key\":\"snare-vine\",\"name\":\"올가미덩굴\",\"group\":\"상위 포식자\",\"terrains\":[5],\"nearWater\":false,\"small\":false,\"large\":true,\"order\":10},{\"key\":\"talon-owl\",\"name\":\"갈퀴부엉이\",\"group\":\"상위 포식자\",\"terrains\":[5,6],\"nearWater\":false,\"small\":false,\"large\":true,\"order\":11},{\"key\":\"spiny-back-beetle\",\"name\":\"가시등 딱정벌레\",\"group\":\"영역\",\"terrains\":[3,4,5,6],\"small\":true,\"large\":true,\"order\":12}];\n" +
"const UNIQUE_CREATURES = [{\"key\":\"spring-keeper\",\"name\":\"봄지기\",\"group\":\"유니크 · 꽃꼬리새\",\"terrains\":[4,5],\"unique\":true},{\"key\":\"lantern-keeper\",\"name\":\"등불지기\",\"group\":\"유니크 · 이슬토끼\",\"terrains\":[4,5],\"unique\":true},{\"key\":\"old-garden-snail\",\"name\":\"오래된 등짐\",\"group\":\"유니크 · 보따리달팽이\",\"terrains\":[2,4,5],\"unique\":true},{\"key\":\"walking-forest\",\"name\":\"걸어가는 산\",\"group\":\"유니크 · 넝쿨거북\",\"terrains\":[4,5],\"unique\":true},{\"key\":\"white-paw\",\"name\":\"흰발\",\"group\":\"유니크 · 그늘족제비\",\"terrains\":[5],\"unique\":true},{\"key\":\"spiny-back-leader\",\"name\":\"가시등 우두머리\",\"group\":\"유니크 · 가시등 딱정벌레\",\"terrains\":[3,4,5,6],\"unique\":true}];\n" +
"const FOOD_HABITATS = [{\"key\":\"honey-mushrooms\",\"terrains\":[\"forest\"],\"neighbors\":[]},{\"key\":\"tree-fruit\",\"terrains\":[\"forest\"],\"neighbors\":[]},{\"key\":\"berry-bush\",\"terrains\":[\"grassland\"],\"neighbors\":[\"forest\"]},{\"key\":\"seed-pods\",\"terrains\":[\"land\",\"grassland\"],\"neighbors\":[]},{\"key\":\"root-bulbs\",\"terrains\":[\"grassland\",\"forest\"],\"neighbors\":[]},{\"key\":\"nutrient-moss\",\"terrains\":[\"forest\",\"swamp\"],\"neighbors\":[]}];\n" +
"const RESOURCE_HABITATS = [{\"key\":\"pebbles\",\"terrains\":[\"coast\",\"land\",\"lowMountain\"],\"neighbors\":[],\"rarity\":\"common\",\"minDistance\":4,\"nodes\":36,\"separation\":7},{\"key\":\"clay\",\"terrains\":[\"coast\",\"grassland\",\"swamp\"],\"neighbors\":[\"deep\",\"shallow\",\"coast\",\"swamp\"],\"rarity\":\"uncommon\",\"minDistance\":24,\"nodes\":20,\"separation\":8}];\n" +
"const TERRAIN = ['deep', 'shallow', 'coast', 'land', 'grassland', 'forest', 'lowMountain', 'highMountain', 'ridge', 'swamp', 'ford'];\n" +
"const ENCOUNTER_RULES = {\n" +
"\"flower-tail-bird\": {\n" +
"  \"spawn\": \"시작부터 먹이터에서 활동한다.\",\n" +
"  \"population\": \"서식지당 초기 3마리 · 생존 상한 3마리\",\n" +
"  \"respawn\": \"3분마다 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"dew-rabbit\": {\n" +
"  \"spawn\": \"시작부터 서식하며 접근하면 숨거나 도주한다.\",\n" +
"  \"population\": \"서식지당 초기 3마리 · 생존 상한 3마리\",\n" +
"  \"respawn\": \"4분마다 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"soil-mole\": {\n" +
"  \"spawn\": \"시작부터 땅속에 잠복하고 주변 채집에 반응해 지상으로 나온다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 5분 후 땅속에서 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"bundle-snail\": {\n" +
"  \"spawn\": \"시작부터 정해진 노선을 순회한다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 8분 후 노선 시작점에서 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"cotton-sheep\": {\n" +
"  \"spawn\": \"시작부터 먹이터에 무리로 배치한다.\",\n" +
"  \"population\": \"서식지당 초기 4마리 · 생존 상한 4마리\",\n" +
"  \"respawn\": \"5분마다 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"rolling-acorn\": {\n" +
"  \"spawn\": \"시작부터 정지 상태로 배치하고 접근하면 구르기 시작한다.\",\n" +
"  \"population\": \"서식지당 초기 3마리 · 생존 상한 3마리\",\n" +
"  \"respawn\": \"3분마다 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"soil-boar\": {\n" +
"  \"spawn\": \"시작부터 영역을 지키며 침범에 반응한다.\",\n" +
"  \"population\": \"서식지당 초기 2마리 · 생존 상한 2마리\",\n" +
"  \"respawn\": \"6분마다 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"bubble-toad\": {\n" +
"  \"spawn\": \"시작부터 물가에 잠복하고 접근하면 육지로 나온다.\",\n" +
"  \"population\": \"서식지당 초기 2마리 · 생존 상한 2마리\",\n" +
"  \"respawn\": \"5분마다 물가에 1마리 보충한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"vine-turtle\": {\n" +
"  \"spawn\": \"시작부터 긴 구간을 천천히 순회한다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 10분 후 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"shadow-weasel\": {\n" +
"  \"spawn\": \"게임 5분부터 사냥터에서 활동한다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 8분 후 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"snare-vine\": {\n" +
"  \"spawn\": \"시작부터 고정 위치에 잠복하고 사거리 안의 대상에 반응한다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 6분 후 새 덩굴로 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"talon-owl\": {\n" +
"  \"spawn\": \"시작부터 횃대에서 대기하고 대상이 들어오면 출격한다.\",\n" +
"  \"population\": \"서식지당 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망 10분 후 횃대에서 재등장한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"spiny-back-beetle\": {\n" +
"  \"spawn\": \"시작부터 굴에서 생성한다.\",\n" +
"  \"population\": \"굴당 작은 굴 초기 1·상한 3마리, 큰 굴 초기 3·상한 6마리\",\n" +
"  \"respawn\": \"작은 굴 120초·큰 굴 60초마다 1마리 증식하며, 굴 파괴 시 중단한다.\",\n" +
"  \"guaranteedAt\": \"\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"spring-keeper\": {\n" +
"  \"spawn\": \"꽃꼬리새 발견 후 자원 10개를 둥지로 운반하면 등장한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"5분\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"lantern-keeper\": {\n" +
"  \"spawn\": \"정찰이 등장지 주변에 접근하면 빛으로 30초간 예고한 뒤 등장한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"숨어도 같은 개체가 복귀하며, 사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"6분\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"old-garden-snail\": {\n" +
"  \"spawn\": \"게임 6분부터 순회 노선 방문을 시작한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"생존 중 계속 순회하며, 사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"6분\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"walking-forest\": {\n" +
"  \"spawn\": \"넝쿨거북을 발견했고 게임 시간이 8분 이상이면 등장한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"이동·정지를 반복하며, 사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"10분\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"white-paw\": {\n" +
"  \"spawn\": \"그늘족제비 1마리를 처치했고 게임 시간이 8분 이상이면 등장한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"퇴각 후에도 같은 개체이며, 사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"12분\",\n" +
"  \"implemented\": true\n" +
"},\n" +
"\"spiny-back-leader\": {\n" +
"  \"spawn\": \"큰 굴의 습격이 한 번 발생했고 게임 시간이 10분 이상이면 등장한다.\",\n" +
"  \"population\": \"맵 전체 초기 1마리 · 생존 상한 1마리\",\n" +
"  \"respawn\": \"사망하면 재등장하지 않는다.\",\n" +
"  \"guaranteedAt\": \"12분\",\n" +
"  \"implemented\": true\n" +
"}\n" +
"};\n" +
"const ENCOUNTER_PLANS = [{\"key\":\"flower-tail-bird\",\"kind\":\"먹이터\",\"radius\":10,\"routeLength\":0,\"state\":\"상주\",\"safeRadius\":10,\"preferredDistance\":30,\"behavior\":\"초원·숲 경계의 먹이터를 오갑니다.\",\"badge\":\"1\",\"color\":\"#92d7ab\"},{\"key\":\"dew-rabbit\",\"kind\":\"서식지\",\"radius\":8,\"routeLength\":0,\"state\":\"상주\",\"safeRadius\":10,\"preferredDistance\":35,\"behavior\":\"접근하면 주변 서식 범위 안에서 숨거나 달아납니다.\",\"badge\":\"2\",\"color\":\"#a4d6ef\"},{\"key\":\"soil-mole\",\"kind\":\"땅굴\",\"radius\":6,\"routeLength\":0,\"state\":\"잠복\",\"safeRadius\":10,\"preferredDistance\":40,\"behavior\":\"흙더미로 위치를 예고하고 주변 채집에 반응합니다.\",\"badge\":\"3\",\"color\":\"#d4ae86\"},{\"key\":\"bundle-snail\",\"kind\":\"순회\",\"radius\":3,\"routeLength\":32,\"state\":\"상주\",\"safeRadius\":10,\"preferredDistance\":50,\"behavior\":\"해안·초원·숲을 잇는 구간을 천천히 순회합니다.\",\"badge\":\"4\",\"color\":\"#d9b1ea\"},{\"key\":\"cotton-sheep\",\"kind\":\"무리\",\"radius\":12,\"routeLength\":0,\"state\":\"상주\",\"safeRadius\":10,\"preferredDistance\":36,\"behavior\":\"초원 먹이터 안에서 무리로 움직입니다.\",\"badge\":\"5\",\"color\":\"#f2d995\"},{\"key\":\"rolling-acorn\",\"kind\":\"반응\",\"radius\":10,\"routeLength\":0,\"state\":\"잠복\",\"safeRadius\":10,\"preferredDistance\":42,\"behavior\":\"숲 바닥과 평지 경계에서 접근에 반응해 구릅니다.\",\"badge\":\"6\",\"color\":\"#dcab77\"},{\"key\":\"soil-boar\",\"kind\":\"영역\",\"radius\":14,\"routeLength\":0,\"state\":\"경계\",\"safeRadius\":32,\"preferredDistance\":60,\"behavior\":\"영역 침범에 경고한 뒤 공격합니다.\",\"badge\":\"7\",\"color\":\"#ed9979\"},{\"key\":\"bubble-toad\",\"kind\":\"물가\",\"radius\":10,\"routeLength\":0,\"state\":\"상주\",\"safeRadius\":32,\"preferredDistance\":64,\"behavior\":\"물가에 흔적을 남기고 접근하면 육지로 나옵니다.\",\"badge\":\"8\",\"color\":\"#85d9d4\"},{\"key\":\"vine-turtle\",\"kind\":\"순회\",\"radius\":4,\"routeLength\":40,\"state\":\"상주\",\"safeRadius\":32,\"preferredDistance\":70,\"behavior\":\"숲과 초원을 잇는 구간을 느리게 순회합니다.\",\"badge\":\"9\",\"color\":\"#90c997\"},{\"key\":\"shadow-weasel\",\"kind\":\"사냥터\",\"radius\":18,\"routeLength\":0,\"state\":\"중반 활동\",\"safeRadius\":32,\"preferredDistance\":90,\"behavior\":\"숲의 이동 통로에 흔적을 먼저 드러냅니다.\",\"badge\":\"10\",\"color\":\"#bcace5\"},{\"key\":\"snare-vine\",\"kind\":\"잠복지\",\"radius\":4,\"routeLength\":0,\"state\":\"잠복\",\"safeRadius\":32,\"preferredDistance\":86,\"behavior\":\"숲속 고정 위치에서 가까운 대상에 반응합니다.\",\"badge\":\"11\",\"color\":\"#cf94b9\"},{\"key\":\"talon-owl\",\"kind\":\"출격\",\"radius\":22,\"routeLength\":0,\"state\":\"횃대 대기\",\"safeRadius\":32,\"preferredDistance\":100,\"behavior\":\"횃대에서 주변 사냥 구간으로 출격합니다.\",\"badge\":\"12\",\"color\":\"#8dbcf0\"},{\"key\":\"spiny-back-beetle\",\"kind\":\"굴\",\"radius\":9,\"routeLength\":0,\"state\":\"상주\",\"safeRadius\":32,\"preferredDistance\":60,\"behavior\":\"굴 주변을 지키며 큰 굴에서 습격합니다.\",\"badge\":\"13\",\"color\":\"#e2bf7c\"},{\"key\":\"spring-keeper\",\"kind\":\"특수 먹이터\",\"radius\":12,\"routeLength\":0,\"state\":\"등장 대기\",\"safeRadius\":22,\"preferredDistance\":72,\"behavior\":\"꽃꼬리새의 특별한 먹이터가 활성화되면 등장합니다.\",\"badge\":\"★1\",\"color\":\"#c4ed8a\"},{\"key\":\"lantern-keeper\",\"kind\":\"탐색\",\"radius\":10,\"routeLength\":0,\"state\":\"등장 대기\",\"safeRadius\":22,\"preferredDistance\":80,\"behavior\":\"숲 안쪽의 빛 흔적을 따라 발견합니다.\",\"badge\":\"★2\",\"color\":\"#e6d996\"},{\"key\":\"old-garden-snail\",\"kind\":\"순회\",\"radius\":4,\"routeLength\":48,\"state\":\"방문 대기\",\"safeRadius\":22,\"preferredDistance\":90,\"behavior\":\"외곽의 긴 순회 구간을 따라 방문합니다.\",\"badge\":\"★3\",\"color\":\"#f2c8ac\"},{\"key\":\"walking-forest\",\"kind\":\"순회\",\"radius\":5,\"routeLength\":56,\"state\":\"후반 활동\",\"safeRadius\":32,\"preferredDistance\":100,\"behavior\":\"넓은 숲과 초원 사이를 길게 이동합니다.\",\"badge\":\"★4\",\"color\":\"#74ddb1\"},{\"key\":\"white-paw\",\"kind\":\"사냥터\",\"radius\":24,\"routeLength\":0,\"state\":\"후반 활동\",\"safeRadius\":32,\"preferredDistance\":110,\"behavior\":\"깊은 숲에서 흔적을 단계적으로 드러냅니다.\",\"badge\":\"★5\",\"color\":\"#efbedb\"},{\"key\":\"spiny-back-leader\",\"kind\":\"우두머리 굴\",\"radius\":16,\"routeLength\":0,\"state\":\"후반 활동\",\"safeRadius\":32,\"preferredDistance\":100,\"behavior\":\"별도 큰 굴에서 후반에 활동을 시작합니다.\",\"badge\":\"★6\",\"color\":\"#ff9a89\"}].map(plan => ({ ...CREATURES.concat(UNIQUE_CREATURES).find(creature => creature.key === plan.key), ...plan, ...ENCOUNTER_RULES[plan.key] }));\n" +
"function hash(x, y, seed) {\n" +
"  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);\n" +
"  value = Math.imul(value ^ (value >>> 13), 1274126177);\n" +
"  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;\n" +
"}\n" +
"function noise(x, y, scale, seed) {\n" +
"  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);\n" +
"  let tx = fx - ix, ty = fy - iy;\n" +
"  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);\n" +
"  return ((hash(ix, iy, seed) * (1 - tx) + hash(ix + 1, iy, seed) * tx) * (1 - ty) +\n" +
"    (hash(ix, iy + 1, seed) * (1 - tx) + hash(ix + 1, iy + 1, seed) * tx) * ty) * 2 - 1;\n" +
"}\n" +
"function distributeMountains(terrain, moisture, seed) {\n" +
"  const SIZE = 320;\n" +
"  const counts = new Uint32Array(9), candidates = [], scores = new Float32Array(terrain.length);\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const type = terrain[index];\n" +
"    if (type < 3 || type > 8) continue;\n" +
"    counts[type]++;\n" +
"    candidates.push(index);\n" +
"    const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"    scores[index] = noise(x, y, 18, seed + 127) * .72 + noise(x, y, 7, seed + 151) * .28;\n" +
"    if (type >= 6) terrain[index] = moisture[index] > 0.1 ? 5 : moisture[index] < -0.18 ? 3 : 4;\n" +
"  }\n" +
"  candidates.sort((left, right) => scores[right] - scores[left] || left - right);\n" +
"  const high = counts[7] + counts[8], total = counts[6] + high;\n" +
"  for (let order = 0; order < total; order++) {\n" +
"    terrain[candidates[order]] = order < counts[8] ? 8 : order < high ? 7 : 6;\n" +
"  }\n" +
"}\n" +
"function generateMapWorld(seed, onProgress, version, capturePlacementMaps) {\n" +
"  if (version === undefined || version >= 26) return generateLandscapeWorld(seed, null, onProgress, TRIBE_STARTS, ENCOUNTER_PLANS, version, capturePlacementMaps);\n" +
"  if (version === undefined || version >= 23) return generateLandscapeWorld(seed, generateMapWorld(seed, undefined, 19), onProgress, TRIBE_STARTS, ENCOUNTER_PLANS, version);\n" +
"  const baseline = version === undefined || version >= 20 ? generateMapWorld(seed, undefined, 19) : null;\n" +
"  let progress = 0;\n" +
"  onProgress?.(0);\n" +
"  const reportProgress = value => {\n" +
"    if (value <= progress) return;\n" +
"    progress = value;\n" +
"    onProgress?.(value);\n" +
"  };\n" +
"  for (let revision = 0; revision < 8; revision++) {\n" +
"    try { return generateWorldCandidate(seed, revision, reportProgress, version, baseline); }\n" +
"    catch (error) { if (!error.encounterPlacement || revision === 7) throw error; }\n" +
"  }\n" +
"}\n" +
"function generateWorldCandidate(seed, revision, onProgress, version, baseline) {\n" +
"  const SIZE = 320;\n" +
"  const ecological = version === undefined || version >= 10;\n" +
"  // Old seed-only saves need their original resource catalog to reproduce camp placement.\n" +
"  const resourceHabitats = version <= 9 ? LEGACY_RESOURCE_HABITATS : RESOURCE_HABITATS;\n" +
"  const terrain = new Uint8Array(SIZE * SIZE), hazards = new Uint8Array(SIZE * SIZE);\n" +
"  const moistureField = new Float32Array(SIZE * SIZE), heightField = new Float32Array(SIZE * SIZE);\n" +
"  const waterDistance = new Uint8Array(SIZE * SIZE);\n" +
"  const mountainDistance = new Uint8Array(SIZE * SIZE).fill(255);\n" +
"  const clearance = new Uint8Array(SIZE * SIZE), region = new Int32Array(SIZE * SIZE);\n" +
"  const queue = new Int32Array(SIZE * SIZE), visited = new Uint32Array(SIZE * SIZE), distance = new Uint8Array(SIZE * SIZE);\n" +
"  let stamp = 0, camps = [], starts = [], foodSites = new Map(), hydrology = null;\n" +
"  const walkable = index => terrain[index] >= 2 && terrain[index] <= 10;\n" +
"  const safe = index => walkable(index) && !hazards[index];\n" +
"  const abundance = index => hazards[index] ? 1.3 + Math.max(0, moistureField[index]) * 1.2 : 1;\n" +
"  const adjacent = index => {\n" +
"    const x = index % SIZE, y = Math.floor(index / SIZE), result = [];\n" +
"    if (x > 0) result.push(index - 1);\n" +
"    if (x < SIZE - 1) result.push(index + 1);\n" +
"    if (y > 0) result.push(index - SIZE);\n" +
"    if (y < SIZE - 1) result.push(index + SIZE);\n" +
"    return result;\n" +
"  };\n" +
"  function neighborhood(site) {\n" +
"    stamp++;\n" +
"    const points = [];\n" +
"    let end = 0;\n" +
"    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {\n" +
"      const index = (site.y + dy) * SIZE + site.x + dx;\n" +
"      queue[end++] = index; visited[index] = stamp; distance[index] = 0;\n" +
"    }\n" +
"    for (let cursor = 0; cursor < end; cursor++) {\n" +
"      const index = queue[cursor]; points.push(index);\n" +
"      if (distance[index] === RESOURCE_RADIUS) continue;\n" +
"      for (const next of adjacent(index)) {\n" +
"        const dx = Math.abs(next % SIZE - site.x), dy = Math.abs(Math.floor(next / SIZE) - site.y);\n" +
"        if (visited[next] === stamp || !safe(next) || dx <= 2 && dy <= 2 && !(dx === 2 && dy === 2)) continue;\n" +
"        visited[next] = stamp; distance[next] = distance[index] + 1; queue[end++] = next;\n" +
"      }\n" +
"    }\n" +
"    return points;\n" +
"  }\n" +
"  function tribeHabitat(site, tribe) {\n" +
"    const index = site.y * SIZE + site.x;\n" +
"    if (tribe.key === 'pebble') return [2, 3, 6].includes(terrain[index]) && (waterDistance[index] <= 8 || mountainDistance[index] <= 6);\n" +
"    if (tribe.key === 'sprout') return [2, 4, 9].includes(terrain[index]);\n" +
"    const type = tribe.key === 'spore' ? 5 : 4;\n" +
"    if (terrain[index] !== type || tribe.key === 'spring' && waterDistance[index] <= 8) return false;\n" +
"    let matching = 0, total = 0;\n" +
"    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {\n" +
"      if (dx * dx + dy * dy > 36) continue;\n" +
"      const next = (site.y + dy) * SIZE + site.x + dx;\n" +
"      if (hazards[next] || Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && terrain[next] !== type) return false;\n" +
"      matching += terrain[next] === type ? 1 : 0; total++;\n" +
"    }\n" +
"    return matching >= total * .75;\n" +
"  }\n" +
"  function allocate(site, tribe) {\n" +
"    const points = neighborhood(site).filter(index => Math.max(Math.abs(index % SIZE - site.x), Math.abs(Math.floor(index / SIZE) - site.y)) > 3);\n" +
"    if (hydrology) {\n" +
"      const key = { sprout: \"clay\", spore: \"tree\", pebble: \"pebbles\", spring: \"dew\" }[tribe.key];\n" +
"      const suitable = points.filter(index => distance[index] <= 12 && hydrologyResourceSuitability(key, index, terrain, hydrology) > 0);\n" +
"      if (suitable.length < 16 || suitable.filter(index => distance[index] <= 4).length < 2) return null;\n" +
"    }\n" +
"    const initialFood = ecological && tribe.key === 'sprout' ? points.filter(index => distance[index] <= 12 &&\n" +
"      habitatFits(resourceHabitats.find(habitat => habitat.key === 'clay'), index % SIZE, Math.floor(index / SIZE), true))\n" +
"      .sort((left, right) => distance[left] - distance[right] || left - right).slice(0, 3) :\n" +
"      points.filter(index => distance[index] <= 12 && foodSites.has(index));\n" +
"    if (initialFood.length < 2) return null;\n" +
"    points.sort((a, b) => hash(a % SIZE, Math.floor(a / SIZE), seed + site.x * 17 + site.y * 31) -\n" +
"      hash(b % SIZE, Math.floor(b / SIZE), seed + site.x * 17 + site.y * 31));\n" +
"    const resources = [], used = new Set(ecological && tribe.key === 'sprout' ? initialFood : []);\n" +
"    const common = resourceHabitats.filter(habitat => habitat.rarity === 'common');\n" +
"    common.sort((a, b) => ecological && tribe.key === 'pebble' && (a.key === 'pebbles' || b.key === 'pebbles') ?\n" +
"      (b.key === 'pebbles' ? 1 : 0) - (a.key === 'pebbles' ? 1 : 0) :\n" +
"      hash(a.nodes, a.separation, seed + site.x) - hash(b.nodes, b.separation, seed + site.x));\n" +
"    for (const habitat of common) {\n" +
"      const placed = [];\n" +
"      for (const index of points) {\n" +
"        const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"        if (used.has(index) || foodSites.has(index) || distance[index] < habitat.minDistance || !habitatFits(habitat, x, y, true) ||\n" +
"          placed.some(point => Math.hypot(point[0] - x, point[1] - y) < habitat.separation)) continue;\n" +
"        placed.push([x, y, 50, habitat.key]);\n" +
"        if (placed.length === 2) break;\n" +
"      }\n" +
"      if (placed.length < 2) continue;\n" +
"      for (const point of placed) { resources.push(point); used.add(point[1] * SIZE + point[0]); }\n" +
"      if (resources.length === 6) break;\n" +
"    }\n" +
"    if (ecological && tribe.key === 'pebble' && !resources.some(point => point[3] === 'pebbles')) return null;\n" +
"    return resources.length >= (ecological ? 2 : 4) ? { resources, initialFood } : null;\n" +
"  }\n" +
"  function placeSwamps(landscapeSeed) {\n" +
"    const candidates = [];\n" +
"    for (let y = 4; y < SIZE - 4; y += 4) for (let x = 4; x < SIZE - 4; x += 4) {\n" +
"      const index = y * SIZE + x;\n" +
"      if (terrain[index] !== 5 || waterDistance[index] < 2 || waterDistance[index] > 12 || heightField[index] >= 0.3) continue;\n" +
"      candidates.push({ x, y, index, priority: hash(x, y, landscapeSeed + 349) });\n" +
"    }\n" +
"    candidates.sort((a, b) => a.priority - b.priority);\n" +
"    const basins = [], basinCount = 3 + Math.floor(hash(0, 0, landscapeSeed + 353) * 3);\n" +
"    for (const candidate of candidates) {\n" +
"      if (basins.some(basin => Math.hypot(basin.x - candidate.x, basin.y - candidate.y) < 64)) continue;\n" +
"      basins.push(candidate);\n" +
"      if (basins.length === basinCount) break;\n" +
"    }\n" +
"    if (basins.length < 3) return 0;\n" +
"    const scores = new Float32Array(terrain.length);\n" +
"    let heapSize = 0;\n" +
"    stamp++;\n" +
"    function offer(index) {\n" +
"      if (visited[index] === stamp || terrain[index] < 2 || terrain[index] > 5 || heightField[index] >= 0.4) return;\n" +
"      visited[index] = stamp;\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"      let radius = Infinity;\n" +
"      for (const basin of basins) radius = Math.min(radius, Math.hypot(x - basin.x, y - basin.y));\n" +
"      scores[index] = radius + noise(x, y, 19, landscapeSeed + 359) * 3 + heightField[index] * 4 - moistureField[index] * 3;\n" +
"      let position = heapSize++;\n" +
"      while (position > 0) {\n" +
"        const parent = (position - 1) >>> 1;\n" +
"        if (scores[queue[parent]] <= scores[index]) break;\n" +
"        queue[position] = queue[parent]; position = parent;\n" +
"      }\n" +
"      queue[position] = index;\n" +
"    }\n" +
"    for (const basin of basins) offer(basin.index);\n" +
"    const target = Math.round(terrain.length * (0.07 + hash(0, 0, landscapeSeed + 367) * 0.02));\n" +
"    let swampCount = 0;\n" +
"    while (heapSize && swampCount < target) {\n" +
"      const index = queue[0], last = queue[--heapSize];\n" +
"      if (heapSize) {\n" +
"        let position = 0;\n" +
"        while (position * 2 + 1 < heapSize) {\n" +
"          let child = position * 2 + 1;\n" +
"          if (child + 1 < heapSize && scores[queue[child + 1]] < scores[queue[child]]) child++;\n" +
"          if (scores[last] <= scores[queue[child]]) break;\n" +
"          queue[position] = queue[child]; position = child;\n" +
"        }\n" +
"        queue[position] = last;\n" +
"      }\n" +
"      terrain[index] = 9; swampCount++;\n" +
"      for (const next of adjacent(index)) offer(next);\n" +
"    }\n" +
"    if (swampCount < target) return 0;\n" +
"    const swampDepth = new Uint8Array(terrain.length);\n" +
"    for (let index = 0; index < terrain.length; index++) {\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"      swampDepth[index] = terrain[index] === 9 && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;\n" +
"    }\n" +
"    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index - 1], swampDepth[index - SIZE - 1], swampDepth[index - SIZE], swampDepth[index - SIZE + 1]));\n" +
"    }\n" +
"    for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {\n" +
"      const index = y * SIZE + x;\n" +
"      swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index + 1], swampDepth[index + SIZE - 1], swampDepth[index + SIZE], swampDepth[index + SIZE + 1]));\n" +
"    }\n" +
"    const spores = [];\n" +
"    for (let index = 0; index < terrain.length; index++) {\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"      hazards[index] = 0;\n" +
"      if (swampDepth[index] >= 5) spores.push({ index,\n" +
"        priority: swampDepth[index] + noise(x, y, 17, landscapeSeed + 379) * 2 + moistureField[index] });\n" +
"    }\n" +
"    const sporeTarget = Math.round(swampCount * 0.27);\n" +
"    if (spores.length < sporeTarget) return 0;\n" +
"    spores.sort((a, b) => b.priority - a.priority);\n" +
"    for (let index = 0; index < sporeTarget; index++) hazards[spores[index].index] = 1;\n" +
"    return swampCount;\n" +
"  }\n" +
"  for (let attempt = 0; attempt < 12; attempt++) {\n" +
"    let swampCount = 0;\n" +
"    const landscapeSeed = (seed + Math.imul(attempt + revision * 12, 2654435761)) >>> 0;\n" +
"    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      const moisture = noise(x, y, 25, landscapeSeed + 31) * 0.68 + noise(x, y, 9, landscapeSeed + 73) * 0.32;\n" +
"      const height = noise(x, y, 55, landscapeSeed + 127) * 0.8 + noise(x, y, 17, landscapeSeed + 151) * 0.2;\n" +
"      const water = noise(x, y, 67, landscapeSeed + 251) * 0.75 + noise(x, y, 19, landscapeSeed + 307) * 0.25;\n" +
"      let type = moisture > 0.1 ? 5 : moisture < -0.18 ? 3 : 4;\n" +
"      if (height > 0.4) type = 6;\n" +
"      if (height > 0.68) type = 7;\n" +
"      if (height > 0.83) type = 8;\n" +
"      if (water < -0.34) type = water < -0.51 ? 0 : 1;\n" +
"      terrain[index] = type;\n" +
"      moistureField[index] = moisture; heightField[index] = height;\n" +
"      if (x === SIZE - 1 && y % 8 === 7) onProgress(.25 * (y + 1) / SIZE);\n" +
"    }\n" +
"    const inland = terrain.slice();\n" +
"    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      if (inland[index] < 2) continue;\n" +
"      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"        if (inland[(y + dy) * SIZE + x + dx] < 2) terrain[index] = 2;\n" +
"      }\n" +
"    }\n" +
"    if (baseline) hydrology = generateHydrology(terrain, moistureField, heightField, SIZE, landscapeSeed, baseline, version);\n" +
"    else if (version === undefined || version >= 18) distributeMountains(terrain, moistureField, landscapeSeed);\n" +
"    waterDistance.fill(255);\n" +
"    let waterEnd = 0;\n" +
"    for (let index = 0; index < terrain.length; index++) if (terrain[index] < 2 || terrain[index] === 10) {\n" +
"      waterDistance[index] = 0; queue[waterEnd++] = index;\n" +
"    }\n" +
"    for (let cursor = 0; cursor < waterEnd; cursor++) {\n" +
"      const index = queue[cursor];\n" +
"      if (waterDistance[index] === (version === 6 ? 6 : 26)) continue;\n" +
"      for (const next of adjacent(index)) if (waterDistance[next] > waterDistance[index] + 1) {\n" +
"        waterDistance[next] = waterDistance[index] + 1; queue[waterEnd++] = next;\n" +
"      }\n" +
"    }\n" +
"    if (ecological) {\n" +
"      mountainDistance.fill(255);\n" +
"      let end = 0;\n" +
"      for (let index = 0; index < terrain.length; index++) if (terrain[index] >= 6 && terrain[index] <= 8) {\n" +
"        mountainDistance[index] = 0; queue[end++] = index;\n" +
"      }\n" +
"      for (let cursor = 0; cursor < end; cursor++) {\n" +
"        const index = queue[cursor];\n" +
"        if (mountainDistance[index] >= 6) continue;\n" +
"        for (const next of adjacent(index)) if (mountainDistance[next] > mountainDistance[index] + 1) {\n" +
"          mountainDistance[next] = mountainDistance[index] + 1; queue[end++] = next;\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"    if (version === 6) {\n" +
"      for (let index = 0; index < terrain.length; index++) {\n" +
"        if (terrain[index] >= 2 && terrain[index] <= 5 && waterDistance[index] <= 5 &&\n" +
"            moistureField[index] > 0.1 && heightField[index] < 0.18) terrain[index] = 9;\n" +
"      }\n" +
"      for (let index = 0; index < terrain.length; index++) {\n" +
"        hazards[index] = terrain[index] === 9 && waterDistance[index] <= 3 && moistureField[index] > 0.2 ? 1 : 0;\n" +
"      }\n" +
"    } else if (version === 7) {\n" +
"      const swampCandidates = new Uint8Array(terrain.length);\n" +
"      let swampEnd = 0;\n" +
"      for (let index = 0; index < terrain.length; index++) {\n" +
"        const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"        const reach = 10 + Math.max(0, noise(x, y, 43, landscapeSeed + 347)) * 16;\n" +
"        if (terrain[index] < 2 || terrain[index] > 5 || waterDistance[index] > reach ||\n" +
"            moistureField[index] <= 0.08 || heightField[index] >= 0.18) continue;\n" +
"        swampCandidates[index] = 1;\n" +
"        if (inland[index] === 5 && waterDistance[index] <= 2) {\n" +
"          terrain[index] = 9; queue[swampEnd++] = index;\n" +
"        }\n" +
"      }\n" +
"      for (let cursor = 0; cursor < swampEnd; cursor++) for (const next of adjacent(queue[cursor])) {\n" +
"        if (!swampCandidates[next] || terrain[next] === 9) continue;\n" +
"        terrain[next] = 9; queue[swampEnd++] = next;\n" +
"      }\n" +
"      const swampDepth = new Uint8Array(terrain.length);\n" +
"      for (let index = 0; index < terrain.length; index++) {\n" +
"        const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"        swampDepth[index] = terrain[index] === 9 && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;\n" +
"      }\n" +
"      for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {\n" +
"        const index = y * SIZE + x;\n" +
"        swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index - 1], swampDepth[index - SIZE - 1], swampDepth[index - SIZE], swampDepth[index - SIZE + 1]));\n" +
"      }\n" +
"      for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {\n" +
"        const index = y * SIZE + x;\n" +
"        swampDepth[index] = Math.min(swampDepth[index], 1 + Math.min(swampDepth[index + 1], swampDepth[index + SIZE - 1], swampDepth[index + SIZE], swampDepth[index + SIZE + 1]));\n" +
"      }\n" +
"      for (let index = 0; index < terrain.length; index++) {\n" +
"        hazards[index] = terrain[index] === 9 && swampDepth[index] >= 5 && moistureField[index] > 0.2 ? 1 : 0;\n" +
"      }\n" +
"    } else {\n" +
"      swampCount = placeSwamps(landscapeSeed);\n" +
"      if (!swampCount) { camps = []; starts = []; continue; }\n" +
"    }\n" +
"    for (let index = 0; index < terrain.length; index++) {\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"      clearance[index] = safe(index) && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 ? 255 : 0;\n" +
"    }\n" +
"    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      clearance[index] = Math.min(clearance[index], 1 + Math.min(clearance[index - 1], clearance[index - SIZE - 1], clearance[index - SIZE], clearance[index - SIZE + 1]));\n" +
"    }\n" +
"    for (let y = SIZE - 2; y > 0; y--) for (let x = SIZE - 2; x > 0; x--) {\n" +
"      const index = y * SIZE + x;\n" +
"      clearance[index] = Math.min(clearance[index], 1 + Math.min(clearance[index + 1], clearance[index + SIZE - 1], clearance[index + SIZE], clearance[index + SIZE + 1]));\n" +
"    }\n" +
"    region.fill(0);\n" +
"    let label = 0, mainRegion = 0, largest = 0;\n" +
"    for (let first = 0; first < terrain.length; first++) {\n" +
"      if (clearance[first] < 2 || region[first]) continue;\n" +
"      label++;\n" +
"      let end = 1; queue[0] = first; region[first] = label;\n" +
"      for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {\n" +
"        if (clearance[next] < 2 || region[next]) continue;\n" +
"        region[next] = label; queue[end++] = next;\n" +
"      }\n" +
"      if (end > largest) { largest = end; mainRegion = label; }\n" +
"    }\n" +
"    foodSites = new Map();\n" +
"    for (let y = 4; y < SIZE - 4; y += 4) for (let x = 4; x < SIZE - 4; x += 4) {\n" +
"      const coarse = (x - 4) % 8 === 0 && (y - 4) % 8 === 0;\n" +
"      const span = coarse ? 7 : 3, offset = coarse ? 3 : 1;\n" +
"      const px = x + Math.floor(hash(x, y, seed + 601) * span) - offset, py = y + Math.floor(hash(x, y, seed + 603) * span) - offset;\n" +
"      const index = py * SIZE + px;\n" +
"      if (!walkable(index) || !coarse && !hazards[index] || hash(px, py, seed + 607) > (coarse ? 0.48 : 0.2)) continue;\n" +
"      const available = FOOD_HABITATS.filter(habitat =>\n" +
"        (version <= 8 || habitat.key === \"honey-mushrooms\") && habitatFits(habitat, px, py, false));\n" +
"      if (!available.length) continue;\n" +
"      foodSites.set(index, available[Math.floor(hash(px, py, seed + 619) * available.length)].key);\n" +
"    }\n" +
"\n" +
"    const sites = [];\n" +
"    for (let y = 32; y < SIZE - 32; y += 8) for (let x = 32; x < SIZE - 32; x += 8) {\n" +
"      const sx = x + Math.floor(hash(x, y, seed + 433) * 7), sy = y + Math.floor(hash(x, y, seed + 449) * 7);\n" +
"      const index = sy * SIZE + sx;\n" +
"      if (clearance[index] >= 4 && region[index] === mainRegion) sites.push({ x: sx, y: sy });\n" +
"    }\n" +
"    sites.sort((a, b) => hash(a.x, a.y, seed + 457) - hash(b.x, b.y, seed + 457));\n" +
"    camps = []; starts = [];\n" +
"    let siteCursor = 0;\n" +
"    while (camps.length < 4 && siteCursor < sites.length) {\n" +
"      const site = sites[siteCursor++];\n" +
"      if (camps.some(camp => Math.hypot(site.x - camp.x, site.y - camp.y) < CAMP_MIN_DISTANCE)) continue;\n" +
"      const tribe = TRIBE_STARTS[camps.length];\n" +
"      if (ecological && !tribeHabitat(site, tribe)) continue;\n" +
"      const start = allocate(site, tribe);\n" +
"      if (!start) continue;\n" +
"      const id = camps.length + 1;\n" +
"      camps.push({ id, tribe: tribe.key, name: tribe.name, x: site.x, y: site.y, playable: true, controller: id === 1 ? 'player' : 'ai' }); starts.push(tribe.resourceRule ? tribe.resourceRule(site, start) : start);\n" +
"      if (ecological) siteCursor = 0;\n" +
"    }\n" +
"    if (version === 6 || version === 7) {\n" +
"      if (camps.length === 4) break;\n" +
"    } else {\n" +
"      if (camps.length === 4) {\n" +
"        let spores = 0;\n" +
"        for (let index = 0; index < hazards.length; index++) {\n" +
"          if (hazards[index] !== 1) continue;\n" +
"          const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"          if (camps.every(camp => (x - camp.x) ** 2 + (y - camp.y) ** 2 > NEST_SAFE_RADIUS ** 2)) spores++;\n" +
"        }\n" +
"        if (spores >= Math.ceil(swampCount * 0.2)) break;\n" +
"        camps = []; starts = [];\n" +
"      }\n" +
"    }\n" +
"  }\n" +
"  if (camps.length !== 4) throw new Error('시작 자원을 확보할 네 부족의 자리가 없습니다.');\n" +
"  onProgress(.35);\n" +
"  for (const camp of camps) for (let dy = -NEST_SAFE_RADIUS; dy <= NEST_SAFE_RADIUS; dy++) for (let dx = -NEST_SAFE_RADIUS; dx <= NEST_SAFE_RADIUS; dx++) {\n" +
"    if (dx * dx + dy * dy <= NEST_SAFE_RADIUS * NEST_SAFE_RADIUS) hazards[(camp.y + dy) * SIZE + camp.x + dx] = 0;\n" +
"  }\n" +
"  const reachable = new Uint8Array(SIZE * SIZE), resourceReachable = new Uint8Array(SIZE * SIZE);\n" +
"  const first = camps[0].y * SIZE + camps[0].x;\n" +
"  function flood(cells, canEnter) {\n" +
"    let end = 1; queue[0] = first; cells[first] = 1;\n" +
"    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {\n" +
"      if (cells[next] || !canEnter(next)) continue;\n" +
"      cells[next] = 1; queue[end++] = next;\n" +
"    }\n" +
"  }\n" +
"  flood(reachable, safe); flood(resourceReachable, walkable);\n" +
"  const food = [], resources = starts.flatMap(start => start.resources);\n" +
"  if (ecological) for (const index of starts[0].initialFood) foodSites.set(index, 'clay');\n" +
"  const occupied = new Set([...food, ...resources].map(([x, y]) => y * SIZE + x));\n" +
"  const outsideStarts = (x, y, minimum) => camps.every(camp => Math.hypot(x - camp.x, y - camp.y) > Math.max(RESOURCE_RADIUS, minimum));\n" +
"  function habitatFits(habitat, x, y, diagonal) {\n" +
"    if (hydrology) return hydrologyResourceSuitability(habitat.key, y * SIZE + x, terrain, hydrology) > 0;\n" +
"    if (!habitat.terrains.includes(TERRAIN[terrain[y * SIZE + x]])) return false;\n" +
"    if (ecological && habitat.key === 'pebbles') return waterDistance[y * SIZE + x] <= 6 || mountainDistance[y * SIZE + x] <= 6;\n" +
"    if (!habitat.neighbors.length) return true;\n" +
"    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"      if ((!dx && !dy) || (!diagonal && Math.abs(dx) + Math.abs(dy) !== 1)) continue;\n" +
"      const nx = x + dx, ny = y + dy;\n" +
"      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && habitat.neighbors.includes(TERRAIN[terrain[ny * SIZE + nx]])) return true;\n" +
"    }\n" +
"    return false;\n" +
"  }\n" +
"  const initialFood = new Set(starts.flatMap(start => start.initialFood));\n" +
"  for (const [index, type] of foodSites) {\n" +
"    const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"    if (!resourceReachable[index] || occupied.has(index) || camps.some(camp => Math.max(Math.abs(x - camp.x), Math.abs(y - camp.y)) <= 3)) continue;\n" +
"    food.push([x, y, 0, type, null, null, initialFood.has(index)]); occupied.add(index);\n" +
"  }\n" +
"  for (const habitat of resourceHabitats) {\n" +
"    const candidates = [], placed = resources.filter(point => point[3] === habitat.key);\n" +
"    for (let y = 2; y < SIZE - 2; y++) for (let x = 2; x < SIZE - 2; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      if (resourceReachable[index] && !occupied.has(index) && outsideStarts(x, y, habitat.minDistance) && habitatFits(habitat, x, y, true)) candidates.push(index);\n" +
"    }\n" +
"    const spacing = habitat.separation;\n" +
"    const target = habitat.nodes +\n" +
"      Math.ceil(candidates.filter(index => hazards[index]).length * 0.1 / (spacing ** 2));\n" +
"    const gravelWeight = index => ecological && habitat.key === 'pebbles' && waterDistance[index] <= 6 && mountainDistance[index] <= 6 ? 4 : 1;\n" +
"    candidates.sort((a, b) => hash(a % SIZE, Math.floor(a / SIZE), seed + 719) / abundance(a) / gravelWeight(a) - hash(b % SIZE, Math.floor(b / SIZE), seed + 719) / abundance(b) / gravelWeight(b));\n" +
"    for (const index of candidates) {\n" +
"      if (placed.length >= target) break;\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE), separation = spacing / Math.sqrt(abundance(index));\n" +
"      if (occupied.has(index) || placed.some(point => Math.hypot(point[0] - x, point[1] - y) < separation)) continue;\n" +
"      const node = [x, y, Math.round(50 * abundance(index)), habitat.key]; resources.push(node); placed.push(node); occupied.add(index);\n" +
"    }\n" +
"    onProgress(.35 + .15 * (resourceHabitats.indexOf(habitat) + 1) / resourceHabitats.length);\n" +
"  }\n" +
"  const burrows = [];\n" +
"  const burrowTargets = [{ type: 'large', count: 24, width: 3, separation: 22 }, { type: 'small', count: 64, width: 1, separation: 12 }];\n" +
"  for (const definition of burrowTargets) {\n" +
"    const candidates = [];\n" +
"    for (let y = 2; y < SIZE - 2; y++) for (let x = 2; x < SIZE - definition.width - 1; x++) {\n" +
"      if (camps.some(camp => {\n" +
"        const dx = Math.max(x - camp.x, camp.x - x - definition.width + 1, 0), dy = Math.abs(y - camp.y);\n" +
"        return dx * dx + dy * dy < NEST_SAFE_RADIUS * NEST_SAFE_RADIUS;\n" +
"      })) continue;\n" +
"      let valid = true;\n" +
"      for (let dy = -1; dy <= 1 && valid; dy++) for (let dx = -1; dx <= definition.width; dx++) {\n" +
"        const index = (y + dy) * SIZE + x + dx;\n" +
"        if (!safe(index) || !reachable[index] || occupied.has(index) || (dy === 0 && dx >= 0 && dx < definition.width && terrain[index] < 3)) {\n" +
"          valid = false; break;\n" +
"        }\n" +
"      }\n" +
"      if (valid) candidates.push({ x, y, priority: hash(x, y, seed + (definition.type === 'small' ? 811 : 823)) });\n" +
"    }\n" +
"    candidates.sort((a, b) => a.priority - b.priority);\n" +
"    let count = 0;\n" +
"    for (const candidate of candidates) {\n" +
"      if (count === definition.count) break;\n" +
"      if (burrows.some(other => {\n" +
"        const gap = Math.max(definition.separation, other.type === 'large' ? 22 : 12);\n" +
"        const dx = Math.max(candidate.x - other.x - other.width + 1, other.x - candidate.x - definition.width + 1, 0);\n" +
"        const dy = Math.abs(candidate.y - other.y);\n" +
"        return dx * dx + dy * dy < gap * gap;\n" +
"      })) continue;\n" +
"      const entrance = { x: candidate.x + Math.floor(definition.width / 2), y: candidate.y + 1 };\n" +
"      if (camps.some(camp => Math.hypot(entrance.x - camp.x, entrance.y - camp.y) < NEST_SAFE_RADIUS)) continue;\n" +
"      burrows.push({ id: 'burrow:' + definition.type + ':' + (candidate.y * SIZE + candidate.x), type: definition.type,\n" +
"        x: candidate.x, y: candidate.y, width: definition.width, height: 1, entrance });\n" +
"      count++;\n" +
"    }\n" +
"  }\n" +
"\n" +
"  onProgress(.6);\n" +
"  for (const burrow of burrows) burrow.creature = { key:'spiny-back-beetle', name:'가시등 딱정벌레', group:'영역', unique:false };\n" +
"\n" +
"  const travelBlocked = new Uint8Array(SIZE * SIZE);\n" +
"  for (const camp of camps) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {\n" +
"    if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) travelBlocked[(camp.y + dy) * SIZE + camp.x + dx] = 1;\n" +
"  }\n" +
"  for (const burrow of burrows) for (let dx = 0; dx < burrow.width; dx++) travelBlocked[burrow.y * SIZE + burrow.x + dx] = 1;\n" +
"  const paths = camps.map(camp => {\n" +
"    const times = new Int16Array(SIZE * SIZE); times.fill(-1);\n" +
"    let end = 0;\n" +
"    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {\n" +
"      const index = (camp.y + dy) * SIZE + camp.x + dx;\n" +
"      queue[end++] = index; times[index] = 0;\n" +
"    }\n" +
"    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {\n" +
"      if (times[next] >= 0 || !safe(next) || travelBlocked[next]) continue;\n" +
"      times[next] = times[queue[cursor]] + 1; queue[end++] = next;\n" +
"    }\n" +
"    return times;\n" +
"  });\n" +
"  onProgress(.65);\n" +
"  let encounters = [];\n" +
"  const nestDistance = new Float32Array(SIZE * SIZE);\n" +
"  for (let index = 0; index < terrain.length; index++) {\n" +
"    const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"    nestDistance[index] = Math.min(...camps.map(camp => Math.hypot(x - camp.x, y - camp.y)));\n" +
"  }\n" +
"  function distributeUniques() {\n" +
"    const groups = ENCOUNTER_PLANS.filter(plan => plan.unique).map((plan, order) => {\n" +
"      const choices = new Array(6).fill(null);\n" +
"      const candidates = plan.key === 'spiny-back-leader' ? burrows.filter(burrow => burrow.type === 'large').map(burrow => burrow.entrance.y * SIZE + burrow.entrance.x) : null;\n" +
"      for (let candidate = 0; candidate < (candidates ? candidates.length : terrain.length); candidate++) {\n" +
"        const index = candidates ? candidates[candidate] : candidate;\n" +
"        if (!safe(index) || paths[0][index] < 0 || travelBlocked[index] || nestDistance[index] < plan.safeRadius ||\n" +
"            !plan.terrains.includes(terrain[index]) || plan.nearWater && waterDistance[index] > 6 || !candidates && occupied.has(index)) continue;\n" +
"        const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"        if (encounters.some(other => Math.hypot(x - other.x, y - other.y) < 14)) continue;\n" +
"        const column = Math.min(2, Math.floor(x * 3 / SIZE)), row = Math.min(1, Math.floor(y * 2 / SIZE)), sector = row * 3 + column;\n" +
"        const centerX = (column + .5) * SIZE / 3, centerY = (row + .5) * SIZE / 2;\n" +
"        const score = Math.hypot(x - centerX, y - centerY) + Math.abs(nestDistance[index] - plan.preferredDistance) * .05 + hash(x, y, seed + 1709 + order * 41) * 8;\n" +
"        if (!choices[sector] || score < choices[sector].score) choices[sector] = { index, x, y, sector, score };\n" +
"      }\n" +
"      return { key:plan.key, choices:choices.filter(Boolean) };\n" +
"    });\n" +
"    groups.sort((left, right) => left.choices.length - right.choices.length || left.key.localeCompare(right.key));\n" +
"    const sectorCounts = new Uint8Array(6), chosen = [];\n" +
"    let best = null, bestScore = Infinity;\n" +
"    function assign(depth, score) {\n" +
"      if (score >= bestScore) return;\n" +
"      if (depth === groups.length) { best = chosen.slice(); bestScore = score; return; }\n" +
"      for (const choice of groups[depth].choices) {\n" +
"        let separation = Infinity;\n" +
"        for (const other of chosen) separation = Math.min(separation, Math.hypot(choice.x - other.x, choice.y - other.y));\n" +
"        if (separation < 14) continue;\n" +
"        const penalty = sectorCounts[choice.sector] * SIZE * SIZE + Math.max(0, 80 - separation) * 4;\n" +
"        chosen.push(choice); sectorCounts[choice.sector]++;\n" +
"        assign(depth + 1, score + choice.score + penalty);\n" +
"        sectorCounts[choice.sector]--; chosen.pop();\n" +
"      }\n" +
"    }\n" +
"    assign(0, 0);\n" +
"    if (!best) { const error = new Error('지형에 맞는 유니크 6종의 분산 위치를 확보하지 못했습니다.'); error.encounterPlacement = true; throw error; }\n" +
"    return new Map(groups.map((group, index) => [group.key, best[index].index]));\n" +
"  }\n" +
"  let uniqueOrigins = null;\n" +
"  const parent = new Int32Array(SIZE * SIZE);\n" +
"  for (let order = 0; !ecological && order < ENCOUNTER_PLANS.length; order++) {\n" +
"    const plan = ENCOUNTER_PLANS[order];\n" +
"    const allowed = index => safe(index) && paths[0][index] >= 0 && !travelBlocked[index] && nestDistance[index] >= plan.safeRadius;\n" +
"    const fits = index => allowed(index) && plan.terrains.includes(terrain[index]) && (!plan.nearWater || waterDistance[index] <= 6);\n" +
"    let origin = -1, priority = Infinity, home = null;\n" +
"    const normalEncounters = encounters.filter(other => !other.unique), normalSectorCounts = new Uint8Array(9);\n" +
"    for (const other of normalEncounters) normalSectorCounts[Math.min(2, Math.floor(other.y * 3 / SIZE)) * 3 + Math.min(2, Math.floor(other.x * 3 / SIZE))]++;\n" +
"    const burrowType = plan.key === 'spiny-back-leader' ? 'large' : plan.key === 'spiny-back-beetle' ? 'small' : '';\n" +
"    const candidates = burrowType ? burrows.filter(burrow => burrow.type === burrowType).map(burrow => burrow.entrance.y * SIZE + burrow.entrance.x) : null;\n" +
"    if (plan.unique) {\n" +
"      if (!uniqueOrigins) uniqueOrigins = distributeUniques();\n" +
"      origin = uniqueOrigins.get(plan.key);\n" +
"    }\n" +
"    for (let candidate = 0; !plan.unique && candidate < (candidates ? candidates.length : terrain.length); candidate++) {\n" +
"      const index = candidates ? candidates[candidate] : candidate;\n" +
"      if (!fits(index) || !candidates && occupied.has(index)) continue;\n" +
"      const x = index % SIZE, y = Math.floor(index / SIZE);\n" +
"      if (x < 12 || y < 12 || x >= SIZE - 12 || y >= SIZE - 12) continue;\n" +
"      if (encounters.some(other => Math.hypot(x - other.x, y - other.y) < 14)) continue;\n" +
"      const column = Math.min(2, Math.floor(x * 3 / SIZE)), row = Math.min(2, Math.floor(y * 3 / SIZE)), sector = row * 3 + column;\n" +
"      let separation = SIZE;\n" +
"      for (const other of normalEncounters) separation = Math.min(separation, Math.hypot(x - other.x, y - other.y));\n" +
"      const centerDistance = Math.hypot(x - (column + .5) * SIZE / 3, y - (row + .5) * SIZE / 3);\n" +
"      const score = normalSectorCounts[sector] * SIZE * SIZE + Math.max(0, 64 - separation) * 4 + centerDistance * .2 +\n" +
"        Math.abs(nestDistance[index] - plan.preferredDistance) * .05 + hash(x, y, seed + 1103 + order * 37) * 8;\n" +
"      if (score < priority) { origin = index; priority = score; }\n" +
"    }\n" +
"    if (origin < 0) { const error = new Error(plan.name + '의 등장 위치를 확보하지 못했습니다.'); error.encounterPlacement = true; throw error; }\n" +
"    const x = origin % SIZE, y = Math.floor(origin / SIZE);\n" +
"    if (burrowType) home = burrows.find(burrow => burrow.entrance.x === x && burrow.entrance.y === y);\n" +
"    if (home && plan.unique) home.creature = { key:plan.key, name:plan.name, group:plan.group, unique:true };\n" +
"    stamp++;\n" +
"    let end = 1; queue[0] = origin; visited[origin] = stamp; distance[origin] = 0; parent[origin] = -1;\n" +
"    let destination = origin;\n" +
"    const limit = plan.routeLength || plan.radius;\n" +
"    for (let cursor = 0; cursor < end; cursor++) {\n" +
"      const index = queue[cursor];\n" +
"      if (plan.routeLength && plan.terrains.includes(terrain[index]) && distance[index] > distance[destination]) destination = index;\n" +
"      if (distance[index] === limit) continue;\n" +
"      for (const next of adjacent(index)) {\n" +
"        if (visited[next] === stamp || !allowed(next)) continue;\n" +
"        visited[next] = stamp; distance[next] = distance[index] + 1; parent[next] = index; queue[end++] = next;\n" +
"      }\n" +
"    }\n" +
"    const route = [];\n" +
"    if (plan.routeLength) {\n" +
"      for (let index = destination; index >= 0; index = parent[index]) route.push(index);\n" +
"      route.reverse(); stamp++; end = route.length;\n" +
"      for (let index = 0; index < route.length; index++) { queue[index] = route[index]; visited[route[index]] = stamp; distance[route[index]] = 0; }\n" +
"      for (let cursor = 0; cursor < end; cursor++) {\n" +
"        const index = queue[cursor];\n" +
"        if (distance[index] === plan.radius) continue;\n" +
"        for (const next of adjacent(index)) {\n" +
"          if (visited[next] === stamp || !allowed(next)) continue;\n" +
"          visited[next] = stamp; distance[next] = distance[index] + 1; queue[end++] = next;\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"    const cells = Array.from(queue.subarray(0, end)), membership = new Set(cells), boundary = [];\n" +
"    for (const index of cells) {\n" +
"      const cx = index % SIZE, cy = Math.floor(index / SIZE);\n" +
"      if (cy === 0 || !membership.has(index - SIZE)) boundary.push([cx, cy, cx + 1, cy]);\n" +
"      if (cy === SIZE - 1 || !membership.has(index + SIZE)) boundary.push([cx, cy + 1, cx + 1, cy + 1]);\n" +
"      if (cx === 0 || !membership.has(index - 1)) boundary.push([cx, cy, cx, cy + 1]);\n" +
"      if (cx === SIZE - 1 || !membership.has(index + 1)) boundary.push([cx + 1, cy, cx + 1, cy + 1]);\n" +
"    }\n" +
"    encounters.push({ ...plan, x, y, cells, boundary, route, homeId:home?.id || null });\n" +
"    onProgress(.65 + .25 * (order + 1) / ENCOUNTER_PLANS.length);\n" +
"  }\n" +
"  if (ecological) encounters = generateWildlife({ seed, terrain, hazards, blocked: travelBlocked, reachable: paths[0],\n" +
"    nestDistance, waterDistance, resourceCells: occupied }, ENCOUNTER_PLANS);\n" +
"  const resourcePaths = camps.map(camp => {\n" +
"    const times = new Int16Array(SIZE * SIZE).fill(-1);\n" +
"    let end = 0;\n" +
"    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {\n" +
"      const index = (camp.y + dy) * SIZE + camp.x + dx;\n" +
"      queue[end++] = index; times[index] = 0;\n" +
"    }\n" +
"    for (let cursor = 0; cursor < end; cursor++) for (const next of adjacent(queue[cursor])) {\n" +
"      if (times[next] >= 0 || !walkable(next) || travelBlocked[next]) continue;\n" +
"      times[next] = times[queue[cursor]] + 1; queue[end++] = next;\n" +
"    }\n" +
"    return times;\n" +
"  });\n" +
"  for (const point of food) {\n" +
"    const index = point[1] * SIZE + point[0];\n" +
"    let owner = 0, distance = Infinity;\n" +
"    for (let camp = 0; camp < camps.length; camp++) {\n" +
"      const steps = paths[camp][index] >= 0 ? paths[camp][index] : resourcePaths[camp][index];\n" +
"      if (steps >= 0 && steps < distance) { owner = camp; distance = steps; }\n" +
"    }\n" +
"    point[4] = distance; point[5] = camps[owner].id;\n" +
"  }\n" +
"  const quantityGrowth = distance => 1 + distance / FORAGING.nearDistance + (distance / (FORAGING.nearDistance * 2)) ** 2;\n" +
"  const quantity = (point, scale) => Math.max(1, Math.round(scale * quantityGrowth(point[4])));\n" +
"  function forageSeconds(points, scale) {\n" +
"    return points.reduce((seconds, point) => {\n" +
"      const amount = quantity(point, scale), trips = Math.ceil(amount / FORAGING.capacity);\n" +
"      return seconds + trips * (2 * point[4] / FORAGING.speed + FORAGING.prepareSeconds + FORAGING.unloadSeconds) + amount * FORAGING.harvestSeconds;\n" +
"    }, 0) / FORAGING.workers;\n" +
"  }\n" +
"  const foraging = camps.map(camp => {\n" +
"    const points = food.filter(point => point[5] === camp.id && point[4] <= FORAGING.nearDistance && point[6]);\n" +
"    if (points.length < 2) throw new Error('초기 두 개체가 채집할 자연 자원 지점이 부족합니다.');\n" +
"    let low = 0, high = 512;\n" +
"    for (let step = 0; step < 22; step++) {\n" +
"      const middle = (low + high) / 2;\n" +
"      if (forageSeconds(points, middle) < FORAGING.seconds) low = middle; else high = middle;\n" +
"    }\n" +
"    onProgress(.9 + .05 * camp.id / camps.length);\n" +
"    return { campId: camp.id, scale: high, points: points.length, amount: points.reduce((sum, point) => sum + quantity(point, high), 0), seconds: forageSeconds(points, high), workers: FORAGING.workers };\n" +
"  });\n" +
"  const outerScale = Math.max(...foraging.map(plan => plan.scale));\n" +
"  for (const point of food) {\n" +
"    const localScale = foraging[point[5] - 1].scale;\n" +
"    const blend = Math.min(1, Math.max(0, (point[4] - FORAGING.nearDistance) / 36));\n" +
"    point[2] = Math.max(1, Math.round(quantity(point, localScale + (outerScale - localScale) * blend) * abundance(point[1] * SIZE + point[0])));\n" +
"  }\n" +
"\n" +
"  onProgress(1);\n" +
"  const world = { seed, size: SIZE, terrain, hazards, food, resources, camps, burrows, encounters, foraging, tribeStarts: TRIBE_STARTS };\n" +
"  if (version === undefined || version >= 17) {\n" +
"    const camp = camps.find(camp => camp.tribe === \"spore\");\n" +
"    for (let dy = -SPORE_NEST_CLEAR_RADIUS; dy <= SPORE_NEST_CLEAR_RADIUS; dy++) {\n" +
"      for (let dx = -SPORE_NEST_CLEAR_RADIUS; dx <= SPORE_NEST_CLEAR_RADIUS; dx++) {\n" +
"        const index = (camp.y + dy) * SIZE + camp.x + dx;\n" +
"        if (dx * dx + dy * dy <= SPORE_NEST_CLEAR_RADIUS ** 2 && terrain[index] === 5) terrain[index] = 4;\n" +
"      }\n" +
"    }\n" +
"    world.food = world.food.filter(([x, y, , type]) => type !== \"honey-mushrooms\" || terrain[y * SIZE + x] === 5);\n" +
"  }\n" +
"  if (version === undefined || version >= 11) populateWorldEconomy(world, { moisture: moistureField, waterDistance, mountainDistance,\n" +
"    reachable: paths[0], paths, correctStarts: version === undefined || version >= 12, minimumSites: version === undefined || version >= 13 ? 16 : 0,\n" +
"    minimumTravel: version === undefined || version >= 14 ? 5 : 6, currentHarvest: version === undefined || version >= 15,\n" +
"    sparseDew: version === undefined || version >= 16 });\n" +
"  if (hydrology) {\n" +
"    world.hydrology = hydrology;\n" +
"    if (version === undefined || version >= 22) hydrology.resourceHabitats = createResourceHabitats(world);\n" +
"    populateWatershedResources(world, baseline, paths);\n" +
"  }\n" +
"  if (ecological) {\n" +
"    world.resourceAreas = generateResourceAreas(world);\n" +
"    world.tribeStarts = TRIBE_STARTS.map(tribe => ({ ...tribe, terrainRule: true, resourceRule: true }));\n" +
"  }\n" +
"  return world;\n" +
"}\n" +
"\n" +
"return { SIZE, NEST_SAFE_RADIUS, FORAGING, ENCOUNTER_PLANS, generateMapWorld };\n" +
"})();\n" +
"modules[\"server/nests.mjs\"] = (() => {\n" +
"const { CONQUEST_PACING } = modules[\"server/conquest-pacing.mjs\"];\n" +
"\n" +
"const NEST_LEVELS = [\n" +
"  { health: 100, unitCapacity: 10, slotCapacity: 1, pointCapacity: 100, upgradeCost: CONQUEST_PACING.nestCosts[0] },\n" +
"  { health: 200, unitCapacity: 20, slotCapacity: 2, pointCapacity: 500, upgradeCost: CONQUEST_PACING.nestCosts[1] },\n" +
"  { health: 400, unitCapacity: 30, slotCapacity: 3, pointCapacity: 2500, upgradeCost: CONQUEST_PACING.nestCosts[2] },\n" +
"  { health: 800, unitCapacity: 40, slotCapacity: 4, pointCapacity: 12500, upgradeCost: null }\n" +
"];\n" +
"\n" +
"function nestUpgradeCost(level, tribe) {\n" +
"  const cost = NEST_LEVELS[level - 1].upgradeCost;\n" +
"  return cost !== null && tribe === \"pebble\" ? cost * .75 : cost;\n" +
"}\n" +
"\n" +
"function materialCapacity(nestLevel) {\n" +
"  return [30, 40, 50, 60][Math.max(0, Math.min(3, (nestLevel || 1) - 1))];\n" +
"}\n" +
"\n" +
"return { NEST_LEVELS, nestUpgradeCost, materialCapacity };\n" +
"})();\n" +
"modules[\"server/dna-board.mjs\"] = (() => {\n" +
"const DNA_BOARD_SHAPES = Object.freeze({\"capacity\":[[0,0],[1,0],[2,0]],\"health\":[[0,0],[1,0],[1,-1]],\"movement\":[[0,0],[1,0],[0,1]],\"harvestSpeed\":[[0,0],[1,0],[2,-1]],\"gather\":[[0,0],[1,0],[1,1]],\"blade\":[[0,0],[0,1],[1,-1],[1,0]],\"power\":[[0,0],[0,1],[0,2],[1,2]],\"speed\":[[0,0],[0,1],[0,2],[1,-1],[1,1]],\"secretion\":[[0,0],[0,1],[1,-2],[1,-1],[2,-3]],\"rangedPower\":[[0,0],[0,1],[0,2],[1,1],[1,2]],\"rangedSpeed\":[[0,0],[0,1],[0,2],[1,2],[1,3]],\"antenna\":[[0,0],[0,1],[0,2],[1,1]],\"carapace\":[[0,0],[0,1],[0,2],[1,-1],[2,-1]],\"harvest\":[[0,0],[0,1],[0,2],[1,0],[1,2]],\"loadSpeed\":[[0,0],[0,1],[0,3],[1,1],[1,2]],\"combo\":[[0,0],[0,1],[0,2],[1,-1],[1,0]],\"critical\":[[0,0],[0,1],[1,-2],[1,-1],[2,-2]],\"counter\":[[0,0],[0,1],[0,2],[0,3],[1,-1]],\"stun\":[[0,0],[0,1],[0,2],[0,3],[1,3]],\"bleed\":[[0,0],[0,1],[0,2],[0,3]],\"area\":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,0]],\"accuracy\":[[0,0],[0,1],[1,-2],[1,-1],[1,1],[2,0]],\"tenacity\":[[0,0],[0,1],[0,2],[1,-2],[1,-1]],\"block\":[[0,0],[0,1],[1,-1],[2,-3],[2,-2]],\"evasion\":[[0,0],[0,1],[1,1],[2,1],[2,2]],\"vision\":[[0,0],[0,1],[1,-1],[1,0],[1,1],[2,-1]],\"legs\":[[0,0],[1,-2],[1,-1],[1,0],[1,1],[2,-1]],\"armor\":[[0,0],[0,1],[1,-1],[1,1],[2,-1],[2,0]],\"parry\":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[1,0]],\"criticalPower\":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[2,-1]],\"penetration\":[[0,0],[0,1],[0,2],[1,-1],[1,1],[2,0]],\"comboPower\":[[0,0],[0,1],[1,-1],[1,0],[2,0],[2,1]],\"blockPower\":[[0,0],[0,1],[1,0],[1,1],[1,2],[2,-1]],\"counterPower\":[[0,0],[0,1],[0,2],[1,-1],[2,-1],[3,-2]],\"reduction\":[[0,0],[0,1],[1,-2],[1,-1],[2,-3],[2,-2]],\"stunTime\":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,-2]],\"bleedPower\":[[0,0],[0,1],[0,2],[1,-2],[1,-1],[2,-2]],\"areaPower\":[[0,0],[0,1],[0,2],[1,-1],[1,0],[1,2]],\"lifesteal\":[[0,0],[0,1],[0,2],[0,3],[1,-1],[1,0]],\"reflection\":[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],\"regeneration\":[[0,0],[0,1],[1,0],[2,-2],[2,-1],[3,-1]],\"comboSpeed\":[[0,0],[0,1],[0,2],[1,-1],[1,0],[2,-1]],\"focus\":[[0,0],[0,1],[1,-2],[1,-1],[2,-2],[2,-1]]});\n" +
"\n" +
"function dnaBoardCells(radius) {\n" +
"  const cells = [];\n" +
"  for (let r = -radius; r <= radius; r++) for (let q = -radius; q <= radius; q++) {\n" +
"    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius) cells.push({ q, r });\n" +
"  }\n" +
"  return cells;\n" +
"}\n" +
"\n" +
"function dnaPieceCells(piece) {\n" +
"  const shape = DNA_BOARD_SHAPES[piece.gene];\n" +
"  if (!shape) return [];\n" +
"  return shape.map(cell => {\n" +
"    let [q, r] = cell;\n" +
"    for (let turn = 0; turn < piece.rotation; turn++) [q, r] = [-r, q + r];\n" +
"    return { q: q + piece.q, r: r + piece.r };\n" +
"  });\n" +
"}\n" +
"\n" +
"function dnaBoardTrace(pieces, level, lookup, radius) {\n" +
"  const paths = [], occupied = new Map(), outside = [], nodes = [];\n" +
"  let reason = '', at = -1;\n" +
"  const limit = radius(level), total = Number.isFinite(limit) ? 1 + 3 * limit * (limit + 1) : 0;\n" +
"  for (let index = 0; index < pieces.length; index++) {\n" +
"    const piece = pieces[index], gene = lookup.get(piece?.gene);\n" +
"    if (!gene || !Number.isInteger(piece.q) || !Number.isInteger(piece.r) || Math.abs(piece.q) > 1000 || Math.abs(piece.r) > 1000 ||\n" +
"        !Number.isInteger(piece.rotation) || piece.rotation < 0 || piece.rotation > 5 || !Number.isInteger(piece.grade) || piece.grade < 1 || piece.grade > 4) {\n" +
"      return { valid: false, reason: 'invalid', paths, nodes, occupied, outside, filled: occupied.size, total, complete: false, at: index };\n" +
"    }\n" +
"    if (Number.isInteger(level) && Math.max(piece.grade, gene.grade) > level && !reason) { reason = 'level'; at = index; }\n" +
"    const points = dnaPieceCells(piece), start = { q: piece.q, r: piece.r };\n" +
"    for (const point of points) {\n" +
"      const key = point.q + ',' + point.r;\n" +
"      if (occupied.has(key) && !reason) { reason = 'collision'; at = index; }\n" +
"      if (Math.max(Math.abs(point.q), Math.abs(point.r), Math.abs(point.q + point.r)) > limit) {\n" +
"        outside.push(point);\n" +
"        if (!reason) { reason = 'boundary'; at = index; }\n" +
"      }\n" +
"      occupied.set(key, { kind: 'cell', index });\n" +
"    }\n" +
"    paths.push({ ...piece, start, points, end: points[points.length - 1] });\n" +
"    nodes.push(start);\n" +
"  }\n" +
"  return { valid: !reason, reason, paths, nodes, occupied, outside, filled: occupied.size, total, complete: !reason && total > 0 && occupied.size === total, at };\n" +
"}\n" +
"\n" +
"function dnaBoardPack(pieces, level, radius) {\n" +
"  const cells = dnaBoardCells(radius(level)), positions = cells.slice().sort((a, b) =>\n" +
"    Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r)) - Math.max(Math.abs(b.q), Math.abs(b.r), Math.abs(b.q + b.r)) || a.r - b.r || a.q - b.q);\n" +
"  const keys = new Set(cells.map(cell => cell.q + ',' + cell.r));\n" +
"  if (pieces.reduce((sum, piece) => sum + (DNA_BOARD_SHAPES[piece.gene]?.length || cells.length + 1), 0) > cells.length) return null;\n" +
"  const ordered = pieces.map((piece, index) => ({ piece, index })).sort((a, b) => DNA_BOARD_SHAPES[b.piece.gene].length - DNA_BOARD_SHAPES[a.piece.gene].length);\n" +
"  const occupied = new Set(), result = new Array(pieces.length);\n" +
"  let remaining = 40000;\n" +
"  function place(index) {\n" +
"    if (index === ordered.length) return true;\n" +
"    const { piece, index: original } = ordered[index];\n" +
"    for (const point of positions) for (let turn = 0; turn < 6; turn++) {\n" +
"      if (--remaining < 0) return false;\n" +
"      const next = { gene: piece.gene, grade: piece.grade, rotation: (piece.rotation + turn) % 6, q: point.q, r: point.r };\n" +
"      const footprint = dnaPieceCells(next).map(cell => cell.q + ',' + cell.r);\n" +
"      if (footprint.some(key => !keys.has(key) || occupied.has(key))) continue;\n" +
"      footprint.forEach(key => occupied.add(key));\n" +
"      result[original] = next;\n" +
"      if (place(index + 1)) return true;\n" +
"      footprint.forEach(key => occupied.delete(key));\n" +
"    }\n" +
"    return false;\n" +
"  }\n" +
"  return place(0) ? result : null;\n" +
"}\n" +
"\n" +
"return { DNA_BOARD_SHAPES, dnaBoardCells, dnaPieceCells, dnaBoardTrace, dnaBoardPack };\n" +
"})();\n" +
"modules[\"server/dna-combat-stats.mjs\"] = (() => {\n" +
"const DNA_COMBAT_RULES = Object.freeze({\n" +
"  basicPower: 1,\n" +
"  powerCurve: \"linear\", powerBase: 2, powerGain: 2, powerKnee: 2,\n" +
"  rangedPowerBase: 1.4, rangedPowerGain: 1.4, rangedPowerKnee: 2,\n" +
"  rangedAttackRateBase: .5, rangedHasteCap: 7, rangedHasteKnee: 70,\n" +
"  healthBase: 10, healthPerPoint: 10, armorPerPoint: 1, armorCap: 1, armorKnee: 100,\n" +
"  flatPenPerPoint: 1, percentPenCap: .8, percentPenKnee: 4,\n" +
"  attackRateBase: .5, hasteCap: 7, hasteKnee: 70, maxActionRate: 4,\n" +
"  windupBase: .3, focusPerPoint: .02, windupMinimum: .08,\n" +
"  hitGapBase: .12, hitSpeedPerPoint: .005, hitGapMinimum: .06, recovery: 0,\n" +
"  defensePreparation: 0, reactionCooldown: 0, counterCooldown: 0,\n" +
"  followupBase: .5, comboPerPoint: .05, followupCap: 1,\n" +
"  critCap: .75, critKnee: 18.75, critMultiplierBase: 1.5, critMultiplierCap: 4, critPowerKnee: 25,\n" +
"  accuracyCap: .6, accuracyKnee: 20, dodgeCap: .6, dodgeKnee: 20,\n" +
"  parryCap: .6, parryKnee: 15, blockCap: .75, blockKnee: 15,\n" +
"  blockReductionBase: .5, blockReductionCap: .5, blockPowerKnee: 10,\n" +
"  counterCap: 1, counterKnee: 10, counterMultiplierBase: 1, counterMultiplierCap: 2,\n" +
"  counterPowerKnee: 10, counterWindup: .12,\n" +
"  tenacityCap: .75, tenacityKnee: 15, stunCap: .3, stunKnee: 10,\n" +
"  stunDurationBase: .25, stunDurationPerPoint: .05, stunDurationCap: 1, stunImmunity: 2,\n" +
"  drainCap: .2, drainKnee: 20, jitter: .2\n" +
"});\n" +
"\n" +
"function dnaCombatStats(counts, weights, inputRules) {\n" +
"  const rules = inputRules || DNA_COMBAT_RULES, n = weights, c = counts;\n" +
"  const capped = (count, cap, knee) => count ? Math.min(cap, cap * count / (knee || 1)) : 0;\n" +
"  const powerGain = (count, gain, knee) => rules.powerCurve === \"log\" ?\n" +
"    gain * Math.log1p(count / knee) / Math.log1p(1 / knee) : gain * count;\n" +
"  const melee = !!c.blade, ranged = !!c.secretion, attack = melee || ranged, defensiveMelee = !attack;\n" +
"  // A basic body can defend itself without gaining an offensive organ or its upgrades.\n" +
"  const meleePower = melee ? rules.powerBase * c.blade + powerGain(n.power || 0, rules.powerGain, rules.powerKnee) : defensiveMelee ? rules.basicPower : 0;\n" +
"  const rangedPower = ranged ? rules.rangedPowerBase * c.secretion + powerGain(n.rangedPower || 0, rules.rangedPowerGain, rules.rangedPowerKnee) : 0;\n" +
"  const meleeSpeed = melee ? Math.min(rules.maxActionRate, rules.attackRateBase * (1 + capped(n.speed || 0, rules.hasteCap, rules.hasteKnee))) : defensiveMelee ? Math.min(rules.maxActionRate, rules.attackRateBase) : 0;\n" +
"  const rangedSpeed = ranged ? Math.min(rules.maxActionRate, rules.rangedAttackRateBase * (1 + capped(n.rangedSpeed || 0, rules.rangedHasteCap, rules.rangedHasteKnee))) : 0;\n" +
"  return { bladeCount: c.blade || 0, secretionCount: c.secretion || 0,\n" +
"    melee, ranged, defensiveMelee, meleePower, meleeSpeed, rangedPower, rangedSpeed,\n" +
"    ...(rules.recovery ? { recovery: rules.recovery } : {}),\n" +
"    health: rules.healthBase + rules.healthPerPoint * (n.health || 0),\n" +
"    power: melee || defensiveMelee ? meleePower : rangedPower, hits: attack ? 1 + (n.combo || 0) : 1, speed: melee || defensiveMelee ? meleeSpeed : rangedSpeed,\n" +
"    armor: rules.armorPerPoint * ((n.armor || 0) + (n.carapace || 0)),\n" +
"    parry: 100 * capped(n.parry || 0, rules.parryCap, rules.parryKnee),\n" +
"    block: 100 * capped(n.block || 0, rules.blockCap, rules.blockKnee),\n" +
"    evasion: 100 * capped((n.evasion || 0) + (n.legs || 0), rules.dodgeCap, rules.dodgeKnee),\n" +
"    comboPower: attack ? 100 * Math.min(rules.followupCap, rules.followupBase + rules.comboPerPoint * (n.comboPower || 0)) : 0,\n" +
"    critical: attack ? 100 * capped(n.critical || 0, rules.critCap, rules.critKnee) : 0,\n" +
"    criticalPower: attack ? 100 * (rules.critMultiplierBase + capped(n.criticalPower || 0, rules.critMultiplierCap - rules.critMultiplierBase, rules.critPowerKnee)) : 0,\n" +
"    accuracy: attack ? 100 * capped(n.accuracy || 0, rules.accuracyCap, rules.accuracyKnee) : 0,\n" +
"    penetration: attack ? rules.flatPenPerPoint * (n.penetration || 0) : 0,\n" +
"    ...(n.percentPen ? { armorPenetration: capped(n.percentPen, rules.percentPenCap, rules.percentPenKnee) } : {}),\n" +
"    blockPower: 100 * DNA_COMBAT_RULES.blockReductionBase,\n" +
"    counter: attack ? 100 * capped(n.counter || 0, rules.counterCap, rules.counterKnee) : 0,\n" +
"    counterPower: attack ? 100 * (rules.counterMultiplierBase + capped(n.counterPower || 0, rules.counterMultiplierCap - rules.counterMultiplierBase, rules.counterPowerKnee)) : 0,\n" +
"    tenacity: 100 * capped(n.tenacity || 0, rules.tenacityCap, rules.tenacityKnee), reduction: Math.min(40, 2 * (n.reduction || 0)),\n" +
"    stun: attack ? 100 * capped(n.stun || 0, rules.stunCap, rules.stunKnee) : 0,\n" +
"    stunTime: attack && n.stun ? Math.min(rules.stunDurationCap, rules.stunDurationBase + rules.stunDurationPerPoint * (n.stunTime || 0)) : 0,\n" +
"    bleed: attack ? Math.min(75, 5 * (n.bleed || 0)) : 0, bleedPower: attack && n.bleed ? 1 + (n.bleedPower || 0) : 0,\n" +
"    area: attack ? Math.min(5, n.area || 0) : 0, areaPower: attack && n.area ? Math.min(75, 35 + 5 * (n.areaPower || 0)) : 0,\n" +
"    lifesteal: attack ? 100 * capped(n.lifesteal || 0, rules.drainCap, rules.drainKnee) : 0,\n" +
"    reflection: Math.min(30, 3 * (n.reflection || 0)), regeneration: .1 * (n.regeneration || 0),\n" +
"    comboSpeed: attack ? Math.max(rules.hitGapMinimum, rules.hitGapBase - rules.hitSpeedPerPoint * (n.comboSpeed || 0)) : rules.hitGapBase,\n" +
"    focus: attack ? Math.max(rules.windupMinimum, rules.windupBase - rules.focusPerPoint * (n.focus || 0)) : rules.windupBase };\n" +
"}\n" +
"\n" +
"return { DNA_COMBAT_RULES, dnaCombatStats };\n" +
"})();\n" +
"modules[\"server/dna.mjs\"] = (() => {\n" +
"const { DNA_BOARD_SHAPES, dnaBoardCells, dnaPieceCells, dnaBoardTrace, dnaBoardPack } = modules[\"server/dna-board.mjs\"];\n" +
"const { dnaCombatStats } = modules[\"server/dna-combat-stats.mjs\"];\n" +
"\n" +
"const ATTRIBUTE_DNA = (() => {\n" +
"  const colors = {organ:'#edba87',action:'#8fbbed',stat:'#87d7b8'};\n" +
"  const definitions = [[\"blade\",\"organ\",20],[\"carapace\",\"stat\",10],[\"antenna\",\"organ\",20],[\"gather\",\"organ\",20],[\"legs\",\"stat\",20],[\"power\",\"stat\",10],[\"combo\",\"action\",14],[\"speed\",\"stat\",12],[\"comboPower\",\"stat\",12],[\"critical\",\"stat\",12],[\"criticalPower\",\"stat\",10],[\"accuracy\",\"stat\",10],[\"penetration\",\"stat\",12],[\"health\",\"stat\",10],[\"armor\",\"stat\",10],[\"evasion\",\"stat\",14],[\"parry\",\"action\",14],[\"block\",\"action\",12],[\"blockPower\",\"stat\",10],[\"counter\",\"action\",14],[\"counterPower\",\"stat\",10],[\"tenacity\",\"stat\",10],[\"reduction\",\"stat\",12],[\"movement\",\"stat\",10],[\"capacity\",\"stat\",10],[\"harvest\",\"stat\",10],[\"harvestSpeed\",\"stat\",10],[\"vision\",\"stat\",10],[\"loadSpeed\",\"stat\",10],null,[\"stun\",\"action\",16],[\"stunTime\",\"stat\",12],[\"bleed\",\"action\",16],[\"bleedPower\",\"stat\",12],[\"area\",\"action\",18],[\"areaPower\",\"stat\",12],[\"lifesteal\",\"action\",16],[\"reflection\",\"action\",16],[\"regeneration\",\"action\",14],[\"comboSpeed\",\"stat\",12],[\"focus\",\"stat\",12],null,[\"secretion\",\"organ\",20],[\"rangedPower\",\"stat\",12],[\"rangedSpeed\",\"stat\",12],null];\n" +
"  const alphabet = 'ATGC';\n" +
"  const genes = definitions.map((entry,index) => entry && ({id:entry[0],category:entry[1],price:entry[2]/2,code:alphabet[Math.floor(index/16)]+alphabet[Math.floor(index/4)%4]+alphabet[index%4],color:colors[entry[1]]})).filter(Boolean);\n" +
"  const lookup = new Map(genes.map(gene=>[gene.id,gene]));\n" +
"  const specification=[{\"gene\":\"gather\",\"grade\":1,\"order\":1},{\"gene\":\"health\",\"grade\":1,\"order\":3},{\"gene\":\"blade\",\"grade\":2,\"order\":0},{\"gene\":\"power\",\"grade\":2,\"order\":1},{\"gene\":\"speed\",\"grade\":2,\"order\":2},{\"gene\":\"capacity\",\"grade\":1,\"order\":0},{\"gene\":\"movement\",\"grade\":1,\"order\":4},{\"gene\":\"antenna\",\"grade\":2,\"order\":8},{\"gene\":\"carapace\",\"grade\":2,\"order\":9},{\"gene\":\"combo\",\"grade\":3,\"order\":0},{\"gene\":\"legs\",\"grade\":3,\"order\":10,\"retired\":true},{\"gene\":\"armor\",\"grade\":3,\"order\":11,\"retired\":true},{\"gene\":\"vision\",\"grade\":3,\"order\":10},{\"gene\":\"harvest\",\"grade\":2,\"order\":10},{\"gene\":\"harvestSpeed\",\"grade\":1,\"order\":2},{\"gene\":\"loadSpeed\",\"grade\":2,\"order\":11},{\"gene\":\"accuracy\",\"grade\":3,\"order\":6},{\"gene\":\"tenacity\",\"grade\":3,\"order\":7},{\"gene\":\"block\",\"grade\":3,\"order\":8},{\"gene\":\"evasion\",\"grade\":3,\"order\":9},{\"gene\":\"parry\",\"grade\":4,\"order\":21},{\"gene\":\"counter\",\"grade\":3,\"order\":2},{\"gene\":\"critical\",\"grade\":3,\"order\":1},{\"gene\":\"criticalPower\",\"grade\":4,\"order\":24},{\"gene\":\"penetration\",\"grade\":4,\"order\":25},{\"gene\":\"comboPower\",\"grade\":4,\"order\":26},{\"gene\":\"blockPower\",\"grade\":4,\"order\":27},{\"gene\":\"counterPower\",\"grade\":4,\"order\":28},{\"gene\":\"reduction\",\"grade\":4,\"order\":29},{\"gene\":\"stun\",\"grade\":3,\"order\":3},{\"gene\":\"stunTime\",\"grade\":4,\"order\":31},{\"gene\":\"bleed\",\"grade\":3,\"order\":4},{\"gene\":\"bleedPower\",\"grade\":4,\"order\":33},{\"gene\":\"area\",\"grade\":3,\"order\":5},{\"gene\":\"areaPower\",\"grade\":4,\"order\":35},{\"gene\":\"lifesteal\",\"grade\":4,\"order\":36},{\"gene\":\"reflection\",\"grade\":4,\"order\":37},{\"gene\":\"regeneration\",\"grade\":4,\"order\":38},{\"gene\":\"comboSpeed\",\"grade\":4,\"order\":39},{\"gene\":\"focus\",\"grade\":4,\"order\":40},{\"gene\":\"secretion\",\"grade\":2,\"order\":3},{\"gene\":\"rangedPower\",\"grade\":2,\"order\":4},{\"gene\":\"rangedSpeed\",\"grade\":2,\"order\":5}];\n" +
"  for(const entry of specification){const gene=lookup.get(entry.gene);gene.grade=entry.grade;gene.order=entry.order;if(entry.retired)gene.retired=true;if(gene.grade<=2)gene.price/=2;}\n" +
"  const catalog=genes.filter(gene=>!gene.retired).sort((a,b)=>a.grade-b.grade||a.order-b.order);\n" +
"\n" +
"  for (const [index, gene] of genes.entries()) { gene.cells = DNA_BOARD_SHAPES[gene.id]; gene.fillColor = `hsl(${(index * 137.508 + 24) % 360} 48% 64%)`; }\n" +
"\n" +
"  for(const [id,color] of Object.entries({capacity:'#71cdb9',gather:'#d8ba77',harvestSpeed:'#df8d96',health:'#db9d7e',movement:'#a6a1dd'}))lookup.get(id).fillColor=color;\n" +
"\n" +
"  const boardRadii=[2,3,4,5];\n" +
"  function boardRadius(level){return Number.isInteger(level)&&level>=1&&level<=4?boardRadii[level-1]:Infinity;}\n" +
"  function inside(point,level){return Math.max(Math.abs(point.q),Math.abs(point.r),Math.abs(point.q+point.r))<=boardRadius(level);}\n" +
"  function key(point){return point.q+','+point.r;}\n" +
"  function trace(pieces,level){return dnaBoardTrace(pieces,level,lookup,boardRadius);}\n" +
"  function boardCells(level){return dnaBoardCells(boardRadius(level));}\n" +
"  function pack(pieces,level){return dnaBoardPack(pieces,level,boardRadius);}\n" +
"  function price(pieces){return pieces.reduce((sum,piece)=>{const gene=lookup.get(piece.gene),grade=piece.grade===undefined?1:piece.grade;return sum+Math.ceil((gene?.price||0)*(grade+2)/3);},0);}\n" +
"  function cost(pieces){return 3+price(pieces);}\n" +
"  function counts(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+1;return result;}\n" +
"  function weights(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+(piece.grade===undefined?1:piece.grade);return result;}\n" +
"  function stats(pieces){\n" +
"    const n=weights(pieces),c=counts(pieces),gather=!!c.gather;\n" +
"    return {...dnaCombatStats(c,n),gatherCount:c.gather||0,antennaCount:c.antenna||0,\n" +
"      capacity:gather?c.gather+(n.capacity||0):0,harvest:gather?Math.min(2*c.gather+(n.harvest||0),c.gather+(n.capacity||0)):0,\n" +
"      harvestTime:gather?4/(1+.1*(n.harvestSpeed||0)):0,movement:.25+.04*(n.movement||0),\n" +
"      vision:Math.min(12,1+(c.antenna||0)+.5*(n.vision||0)),scale:1+.01*pieces.length,roaming:!!n.antenna,\n" +
"      loadSpeed:gather?Math.min(100,75+5*(n.loadSpeed||0)):0};\n" +
"  }\n" +
"  function clonePiece(piece){return {gene:piece.gene,rotation:piece.rotation,grade:piece.grade,q:piece.q,r:piece.r};}\n" +
"  function validate(value){\n" +
"    if(!value||![1,2,3,4].includes(value.version)||!Array.isArray(value.pieces)||value.pieces.length>2048||!Number.isFinite(value.budget)||value.budget<0||value.budget>999999999)return null;\n" +
"    let level=value.level===undefined?1:value.level;\n" +
"    if(!Number.isInteger(level)||level<1||level>4)return null;\n" +
"    let pieces=[];\n" +
"    for(const input of value.pieces){\n" +
"      const gene=lookup.get(input?.gene),grade=input?.grade===undefined?(value.version>=3?gene?.grade:1):input.grade;\n" +
"      if(!gene||!Number.isInteger(grade)||grade<1||grade>4||!Number.isInteger(input.rotation)||input.rotation<0||input.rotation>5)return null;\n" +
"      if(value.version===4){\n" +
"        if(input.shape!==undefined||input.cells!==undefined)return null;\n" +
"        pieces.push({gene:gene.id,grade,rotation:input.rotation,q:input.q,r:input.r});\n" +
"      }else pieces.push({gene:gene.id,grade,rotation:input.rotation});\n" +
"    }\n" +
"    if(value.version<4){\n" +
"      const source=pieces;\n" +
"      pieces=pack(source,level);\n" +
"      while(!pieces&&level<4&&value.level===undefined)pieces=pack(source,++level);\n" +
"      if(!pieces){\n" +
"        const occupied=new Set(),positions=boardCells(level);let overflow=0;\n" +
"        pieces=source.map(input=>{\n" +
"          for(const position of positions)for(let rotation=0;rotation<6;rotation++){\n" +
"            const piece={...input,rotation,q:position.q,r:position.r},cells=dnaPieceCells(piece);\n" +
"            if(cells.some(cell=>!inside(cell,level)||occupied.has(key(cell))))continue;\n" +
"            for(const cell of cells)occupied.add(key(cell));return piece;\n" +
"          }\n" +
"          const index=overflow++;return {...input,q:boardRadius(level)+4+(index%Math.ceil(Math.sqrt(source.length)))*6,r:-boardRadius(level)+Math.floor(index/Math.ceil(Math.sqrt(source.length)))*6};\n" +
"        });\n" +
"      }\n" +
"    }\n" +
"    if(!trace(pieces).valid)return null;\n" +
"    return {version:4,pieces,budget:Math.floor(value.budget),level};\n" +
"  }\n" +
"\n" +
"  return {genes,catalog,lookup,trace,boardCells,pieceCells:dnaPieceCells,pack,price,cost,counts,weights,stats,validate,clonePiece,key,boardRadius,inside};\n" +
"})();\n" +
"\n" +
"return { ATTRIBUTE_DNA };\n" +
"})();\n" +
"modules[\"server/unit-stats.mjs\"] = (() => {\n" +
"const TRIBE_UNIT_STATS = Object.freeze({\n" +
"  bean: Object.freeze({ speed: .5, loadedSpeed: .4 }),\n" +
"  spore: Object.freeze({ speed: .5, loadedSpeed: .4 }),\n" +
"  pebble: Object.freeze({ speed: .35, loadedSpeed: .3 }),\n" +
"  spring: Object.freeze({ speed: .9, loadedSpeed: .275 })\n" +
"});\n" +
"\n" +
"const ATTRIBUTE_STAT_VALUES = Object.freeze({\n" +
"  movementBonus: .3,\n" +
"  capacity: 2,\n" +
"  vision: 6,\n" +
"  attackBonus: 12,\n" +
"  armorPenetration: .5,\n" +
"  damageReduction: .45\n" +
"});\n" +
"\n" +
"return { TRIBE_UNIT_STATS, ATTRIBUTE_STAT_VALUES };\n" +
"})();\n" +
"modules[\"server/neutral-unit-stats.mjs\"] = (() => {\n" +
"const NEUTRAL_UNIT_STATS = Object.freeze(Object.fromEntries([\n" +
"  [\"flower-tail-bird\", {\"health\":30,\"power\":3,\"armor\":2,\"speed\":1,\"movement\":0.947,\"vision\":7.525,\"combo\":1.069,\"comboPower\":51.138,\"critical\":5.831,\"criticalPower\":139.311,\"accuracy\":13,\"penetration\":1.201,\"comboSpeed\":0.113,\"focus\":0.223,\"evasion\":13.147,\"parry\":5.195,\"block\":0,\"blockPower\":50,\"counter\":2.232,\"counterPower\":85.37,\"tenacity\":0,\"reduction\":0,\"stun\":0,\"stunTime\":0.2,\"bleed\":2.006,\"bleedPower\":2.303,\"area\":0.004,\"areaPower\":16.08,\"lifesteal\":0.152,\"reflection\":0.365,\"regeneration\":0.9,\"capacity\":1,\"harvestSpeed\":1.9}],\n" +
"  [\"dew-rabbit\", {\"health\":57,\"power\":2.51,\"armor\":4,\"speed\":0.88,\"movement\":1.011,\"vision\":6.517,\"combo\":0.941,\"comboPower\":48.686,\"critical\":4.863,\"criticalPower\":136.751,\"accuracy\":9,\"penetration\":0.099,\"comboSpeed\":0.136,\"focus\":0.238,\"evasion\":11.984,\"parry\":4.418,\"block\":0.42,\"blockPower\":50,\"counter\":0.074,\"counterPower\":82.337,\"tenacity\":2.311,\"reduction\":0.028,\"stun\":0.043,\"stunTime\":0.251,\"bleed\":0.204,\"bleedPower\":1.24,\"area\":0,\"areaPower\":15,\"lifesteal\":0.066,\"reflection\":0,\"regeneration\":1,\"capacity\":2,\"harvestSpeed\":1.839}],\n" +
"  [\"soil-mole\", {\"health\":102,\"power\":6,\"armor\":14,\"speed\":0.68,\"movement\":0.648,\"vision\":2,\"combo\":0.397,\"comboPower\":55.846,\"critical\":9.102,\"criticalPower\":156.97,\"accuracy\":11,\"penetration\":6.249,\"comboSpeed\":0.176,\"focus\":0.254,\"evasion\":4.559,\"parry\":3.693,\"block\":10.54,\"blockPower\":50,\"counter\":2.992,\"counterPower\":104.146,\"tenacity\":18.635,\"reduction\":2.25,\"stun\":3.619,\"stunTime\":0.445,\"bleed\":10.649,\"bleedPower\":3.697,\"area\":0.248,\"areaPower\":25.126,\"lifesteal\":2.186,\"reflection\":1.409,\"regeneration\":0.8,\"capacity\":9,\"harvestSpeed\":1.807}],\n" +
"  [\"bundle-snail\", {\"health\":126,\"power\":5,\"armor\":30,\"speed\":0.52,\"movement\":0.55,\"vision\":3.289,\"combo\":0.102,\"comboPower\":40.732,\"critical\":1.287,\"criticalPower\":149.186,\"accuracy\":1,\"penetration\":0.345,\"comboSpeed\":0.21,\"focus\":0.394,\"evasion\":1.155,\"parry\":0.088,\"block\":16.881,\"blockPower\":50,\"counter\":0.277,\"counterPower\":100.069,\"tenacity\":22.548,\"reduction\":5.444,\"stun\":0.842,\"stunTime\":0.317,\"bleed\":0.639,\"bleedPower\":1.498,\"area\":0.328,\"areaPower\":21.877,\"lifesteal\":0.631,\"reflection\":5.443,\"regeneration\":1.4,\"capacity\":17,\"harvestSpeed\":1.307}],\n" +
"  [\"cotton-sheep\", {\"health\":214,\"power\":1.97,\"armor\":10,\"speed\":0.6,\"movement\":0.692,\"vision\":5.693,\"combo\":0.232,\"comboPower\":43.51,\"critical\":1,\"criticalPower\":135,\"accuracy\":2,\"penetration\":0,\"comboSpeed\":0.201,\"focus\":0.319,\"evasion\":5.528,\"parry\":0.571,\"block\":5.155,\"blockPower\":50,\"counter\":0,\"counterPower\":80,\"tenacity\":16.662,\"reduction\":4.694,\"stun\":0.557,\"stunTime\":0.287,\"bleed\":0,\"bleedPower\":1,\"area\":0.64,\"areaPower\":20.32,\"lifesteal\":0.016,\"reflection\":4.593,\"regeneration\":1.2,\"capacity\":12,\"harvestSpeed\":1.74}],\n" +
"  [\"rolling-acorn\", {\"health\":65,\"power\":4,\"armor\":24,\"speed\":0.76,\"movement\":0.81,\"vision\":2.793,\"combo\":0.594,\"comboPower\":46.15,\"critical\":3.966,\"criticalPower\":152.981,\"accuracy\":0,\"penetration\":2.491,\"comboSpeed\":0.16,\"focus\":0.42,\"evasion\":8.633,\"parry\":2.409,\"block\":13.605,\"blockPower\":50,\"counter\":1.579,\"counterPower\":96.125,\"tenacity\":6.562,\"reduction\":0.25,\"stun\":2.497,\"stunTime\":0.346,\"bleed\":2.899,\"bleedPower\":2.578,\"area\":0.179,\"areaPower\":23.481,\"lifesteal\":0,\"reflection\":3.814,\"regeneration\":0.1,\"capacity\":6,\"harvestSpeed\":1.67}],\n" +
"  [\"bubble-toad\", {\"health\":114,\"power\":7,\"armor\":12,\"speed\":0.8,\"movement\":0.772,\"vision\":5.098,\"combo\":0.703,\"comboPower\":53.522,\"critical\":7.954,\"criticalPower\":161.135,\"accuracy\":6,\"penetration\":3.288,\"comboSpeed\":0.152,\"focus\":0.302,\"evasion\":9.726,\"parry\":1.854,\"block\":6.397,\"blockPower\":50,\"counter\":5.892,\"counterPower\":108.343,\"tenacity\":14.677,\"reduction\":1.361,\"stun\":7.238,\"stunTime\":0.65,\"bleed\":3.917,\"bleedPower\":2.855,\"area\":1.596,\"areaPower\":39.326,\"lifesteal\":3.584,\"reflection\":1.903,\"regeneration\":1.1,\"capacity\":8,\"harvestSpeed\":1.553}],\n" +
"  [\"snare-vine\", {\"health\":166,\"power\":12.54,\"armor\":22,\"speed\":0.56,\"movement\":0.3,\"vision\":6.25,\"combo\":0.162,\"comboPower\":58.119,\"critical\":12.853,\"criticalPower\":179.273,\"accuracy\":12,\"penetration\":10.02,\"comboSpeed\":0.193,\"focus\":0.207,\"evasion\":2.746,\"parry\":0,\"block\":9.094,\"blockPower\":50,\"counter\":7.062,\"counterPower\":121.534,\"tenacity\":20.597,\"reduction\":1.778,\"stun\":2.008,\"stunTime\":0.631,\"bleed\":15.853,\"bleedPower\":4.553,\"area\":1.406,\"areaPower\":33.82,\"lifesteal\":6,\"reflection\":7.351,\"regeneration\":1.8,\"capacity\":13,\"harvestSpeed\":1.365}],\n" +
"  [\"spiny-back-beetle\", {\"health\":120,\"power\":8,\"armor\":28,\"speed\":0.72,\"movement\":0.733,\"vision\":3.712,\"combo\":0.492,\"comboPower\":60.347,\"critical\":10.303,\"criticalPower\":174.538,\"accuracy\":8,\"penetration\":11.45,\"comboSpeed\":0.168,\"focus\":0.269,\"evasion\":6.532,\"parry\":8.802,\"block\":15.218,\"blockPower\":50,\"counter\":16.148,\"counterPower\":140.262,\"tenacity\":26.427,\"reduction\":3.361,\"stun\":3.034,\"stunTime\":0.422,\"bleed\":14.029,\"bleedPower\":4.266,\"area\":0.524,\"areaPower\":30.26,\"lifesteal\":1.798,\"reflection\":10.734,\"regeneration\":0.2,\"capacity\":11,\"harvestSpeed\":1.511}],\n" +
"  [\"soil-boar\", {\"health\":150,\"power\":25,\"armor\":26,\"speed\":0.64,\"movement\":0.846,\"vision\":4.448,\"combo\":0.31,\"comboPower\":68.893,\"critical\":15.586,\"criticalPower\":194.173,\"accuracy\":7,\"penetration\":8.676,\"comboSpeed\":0.184,\"focus\":0.286,\"evasion\":3.63,\"parry\":3.023,\"block\":12.044,\"blockPower\":50,\"counter\":8.331,\"counterPower\":135.474,\"tenacity\":28.354,\"reduction\":4,\"stun\":8.097,\"stunTime\":0.49,\"bleed\":12.293,\"bleedPower\":4.84,\"area\":0.768,\"areaPower\":41.2,\"lifesteal\":2.613,\"reflection\":3.106,\"regeneration\":0.5,\"capacity\":14,\"harvestSpeed\":1.417}],\n" +
"  [\"vine-turtle\", {\"health\":465,\"power\":19.9,\"armor\":32,\"speed\":0.48,\"movement\":0.601,\"vision\":4.094,\"combo\":0.054,\"comboPower\":37.759,\"critical\":1.785,\"criticalPower\":165.459,\"accuracy\":5,\"penetration\":5.169,\"comboSpeed\":0.219,\"focus\":0.336,\"evasion\":1.917,\"parry\":1.36,\"block\":24,\"blockPower\":50,\"counter\":11.166,\"counterPower\":126.105,\"tenacity\":30.275,\"reduction\":7.111,\"stun\":5.654,\"stunTime\":0.511,\"bleed\":6.297,\"bleedPower\":3.415,\"area\":1.227,\"areaPower\":37.47,\"lifesteal\":0.866,\"reflection\":9.537,\"regeneration\":1.5,\"capacity\":16,\"harvestSpeed\":1.159}],\n" +
"  [\"shadow-weasel\", {\"health\":96,\"power\":26,\"armor\":8,\"speed\":1.12,\"movement\":1.071,\"vision\":6.778,\"combo\":1.643,\"comboPower\":72.989,\"critical\":18.489,\"criticalPower\":184.128,\"accuracy\":15,\"penetration\":16.24,\"comboSpeed\":0.098,\"focus\":0.149,\"evasion\":14.332,\"parry\":9.822,\"block\":1.953,\"blockPower\":50,\"counter\":14.391,\"counterPower\":117.045,\"tenacity\":8.625,\"reduction\":0.444,\"stun\":1.568,\"stunTime\":0.397,\"bleed\":21.84,\"bleedPower\":5.418,\"area\":0.076,\"areaPower\":28.519,\"lifesteal\":4.713,\"reflection\":0.043,\"regeneration\":0.7,\"capacity\":7,\"harvestSpeed\":1.706}],\n" +
"  [\"talon-owl\", {\"health\":127,\"power\":37.93,\"armor\":6,\"speed\":0.96,\"movement\":0.915,\"vision\":8,\"combo\":1.345,\"comboPower\":64.686,\"critical\":17.017,\"criticalPower\":189.097,\"accuracy\":18,\"penetration\":14.561,\"comboSpeed\":0.12,\"focus\":0.192,\"evasion\":10.843,\"parry\":7.828,\"block\":1.107,\"blockPower\":50,\"counter\":9.699,\"counterPower\":112.646,\"tenacity\":4.464,\"reduction\":0.111,\"stun\":1.179,\"stunTime\":0.372,\"bleed\":19.761,\"bleedPower\":5.129,\"area\":0.122,\"areaPower\":26.806,\"lifesteal\":4.129,\"reflection\":0.165,\"regeneration\":0.4,\"capacity\":3,\"harvestSpeed\":1.594}],\n" +
"  [\"spring-keeper\", {\"health\":342,\"power\":29.71,\"armor\":16,\"speed\":1.04,\"movement\":0.979,\"vision\":7.765,\"combo\":1.491,\"comboPower\":66.804,\"critical\":11.554,\"criticalPower\":145.614,\"accuracy\":16,\"penetration\":4.182,\"comboSpeed\":0.105,\"focus\":0.134,\"evasion\":16.759,\"parry\":6.901,\"block\":2.922,\"blockPower\":50,\"counter\":3.856,\"counterPower\":92.337,\"tenacity\":10.661,\"reduction\":0.694,\"stun\":0.154,\"stunTime\":0.468,\"bleed\":7.647,\"bleedPower\":3.134,\"area\":0.042,\"areaPower\":18.822,\"lifesteal\":0.434,\"reflection\":2.468,\"regeneration\":1.3,\"capacity\":4,\"harvestSpeed\":1.87}],\n" +
"  [\"lantern-keeper\", {\"health\":319,\"power\":24.32,\"armor\":18,\"speed\":0.92,\"movement\":1.041,\"vision\":7.032,\"combo\":1.204,\"comboPower\":62.534,\"critical\":6.863,\"criticalPower\":142.302,\"accuracy\":14,\"penetration\":0.715,\"comboSpeed\":0.128,\"focus\":0.163,\"evasion\":15.536,\"parry\":6.023,\"block\":3.994,\"blockPower\":50,\"counter\":0.598,\"counterPower\":88.735,\"tenacity\":12.678,\"reduction\":1,\"stun\":0.327,\"stunTime\":0.532,\"bleed\":1.248,\"bleedPower\":1.762,\"area\":0.018,\"areaPower\":17.397,\"lifesteal\":0.275,\"reflection\":0.639,\"regeneration\":1.6,\"capacity\":5,\"harvestSpeed\":1.774}],\n" +
"  [\"old-garden-snail\", {\"health\":652,\"power\":47.37,\"armor\":36,\"speed\":0.44,\"movement\":0.422,\"vision\":4.781,\"combo\":0.018,\"comboPower\":34.457,\"critical\":2.414,\"criticalPower\":169.931,\"accuracy\":3,\"penetration\":1.794,\"comboSpeed\":0.229,\"focus\":0.374,\"evasion\":0,\"parry\":0.286,\"block\":20.352,\"blockPower\":50,\"counter\":1.033,\"counterPower\":130.754,\"tenacity\":32.189,\"reduction\":8.028,\"stun\":4.251,\"stunTime\":0.553,\"bleed\":5.052,\"bleedPower\":2.031,\"area\":0.909,\"areaPower\":32.028,\"lifesteal\":1.138,\"reflection\":6.362,\"regeneration\":1.7,\"capacity\":19,\"harvestSpeed\":1.241}],\n" +
"  [\"walking-forest\", {\"health\":941,\"power\":81.71,\"armor\":44,\"speed\":0.4,\"movement\":0.492,\"vision\":5.976,\"combo\":0,\"comboPower\":30,\"critical\":3.146,\"criticalPower\":199.352,\"accuracy\":4,\"penetration\":7.418,\"comboSpeed\":0.24,\"focus\":0.355,\"evasion\":0.485,\"parry\":0.931,\"block\":22.154,\"blockPower\":50,\"counter\":4.823,\"counterPower\":150.028,\"tenacity\":36,\"reduction\":9,\"stun\":9,\"stunTime\":0.612,\"bleed\":9.099,\"bleedPower\":3.981,\"area\":1.8,\"areaPower\":45,\"lifesteal\":1.449,\"reflection\":8.41,\"regeneration\":1.9,\"capacity\":18,\"harvestSpeed\":1}],\n" +
"  [\"white-paw\", {\"health\":220,\"power\":74.46,\"armor\":20,\"speed\":1.08,\"movement\":1.1,\"vision\":7.281,\"combo\":1.8,\"comboPower\":75,\"critical\":20,\"criticalPower\":210,\"accuracy\":17,\"penetration\":18,\"comboSpeed\":0.09,\"focus\":0.12,\"evasion\":18,\"parry\":12,\"block\":7.712,\"blockPower\":50,\"counter\":12.73,\"counterPower\":145.115,\"tenacity\":24.492,\"reduction\":2.778,\"stun\":4.929,\"stunTime\":0.573,\"bleed\":24,\"bleedPower\":6,\"area\":0.42,\"areaPower\":35.634,\"lifesteal\":5.337,\"reflection\":0.987,\"regeneration\":0.6,\"capacity\":10,\"harvestSpeed\":1.633}],\n" +
"  [\"spiny-back-leader\", {\"health\":339,\"power\":35.12,\"armor\":34,\"speed\":0.84,\"movement\":0.881,\"vision\":5.401,\"combo\":0.819,\"comboPower\":70.953,\"critical\":14.198,\"criticalPower\":204.629,\"accuracy\":10,\"penetration\":12.964,\"comboSpeed\":0.144,\"focus\":0.178,\"evasion\":7.568,\"parry\":10.889,\"block\":18.593,\"blockPower\":50,\"counter\":18,\"counterPower\":155,\"tenacity\":34.097,\"reduction\":6.25,\"stun\":6.423,\"stunTime\":0.592,\"bleed\":17.765,\"bleedPower\":5.709,\"area\":1.062,\"areaPower\":43.091,\"lifesteal\":3.079,\"reflection\":12,\"regeneration\":0.3,\"capacity\":15,\"harvestSpeed\":1.466}]\n" +
"].map(([key, stats]) => [key, Object.freeze(stats)])));\n" +
"\n" +
"return { NEUTRAL_UNIT_STATS };\n" +
"})();\n" +
"modules[\"server/dna-actions.mjs\"] = (() => {\n" +
"const DNA_ACTION_RULES = Object.freeze({ meleeRange: 1, rangedRange: 3, projectileSpeed: 6, rangedPowerBase: 1.4 });\n" +
"\n" +
"function dnaDefensiveMelee(stats) {\n" +
"  return !!stats?.defensiveMelee && !stats.melee && !stats.ranged;\n" +
"}\n" +
"\n" +
"function dnaAttackMode(stats, distance, defending = false) {\n" +
"  if ((stats.melee || defending && dnaDefensiveMelee(stats)) && distance <= DNA_ACTION_RULES.meleeRange) return \"melee\";\n" +
"  if (stats.ranged && distance <= DNA_ACTION_RULES.rangedRange) return \"ranged\";\n" +
"  return null;\n" +
"}\n" +
"\n" +
"function dnaProjectileDuration(distance) {\n" +
"  return Math.max(0, distance) / DNA_ACTION_RULES.projectileSpeed;\n" +
"}\n" +
"\n" +
"function dnaProjectileValid(source, target) {\n" +
"  return !!source && !!target && source.health > 0 && target.health > 0 && !source.hidden && !target.hidden && !source.retreat && !target.retreat;\n" +
"}\n" +
"\n" +
"function dnaAttackStats(stats, mode) {\n" +
"  return { power: mode === \"ranged\" ? stats.rangedPower : stats.meleePower, speed: mode === \"ranged\" ? stats.rangedSpeed : stats.meleeSpeed };\n" +
"}\n" +
"\n" +
"return { DNA_ACTION_RULES, dnaDefensiveMelee, dnaAttackMode, dnaProjectileDuration, dnaProjectileValid, dnaAttackStats };\n" +
"})();\n" +
"modules[\"server/creature-attack-role.mjs\"] = (() => {\n" +
"const { DNA_ACTION_RULES } = modules[\"server/dna-actions.mjs\"];\n" +
"\n" +
"const melee = { role: \"melee\", melee: true, ranged: false };\n" +
"const hybrid = { role: \"hybrid\", melee: true, ranged: true };\n" +
"const CREATURE_ATTACK_ROLES = Object.freeze(Object.fromEntries([\n" +
"  [\"flower-tail-bird\", { role: \"ranged\", melee: true, ranged: true }],\n" +
"  [\"dew-rabbit\", melee], [\"soil-mole\", hybrid], [\"bundle-snail\", melee],\n" +
"  [\"cotton-sheep\", melee], [\"rolling-acorn\", melee], [\"bubble-toad\", hybrid],\n" +
"  [\"snare-vine\", melee], [\"spiny-back-beetle\", hybrid], [\"soil-boar\", melee],\n" +
"  [\"vine-turtle\", hybrid], [\"shadow-weasel\", melee], [\"talon-owl\", melee],\n" +
"  [\"spring-keeper\", melee], [\"lantern-keeper\", { role: \"ranged\", melee: false, ranged: true }],\n" +
"  [\"old-garden-snail\", melee], [\"walking-forest\", melee], [\"white-paw\", melee],\n" +
"  [\"spiny-back-leader\", hybrid]\n" +
"].map(([key, value]) => [key, Object.freeze({ ...value,\n" +
"  position: [\"bundle-snail\", \"rolling-acorn\", \"spiny-back-beetle\", \"soil-boar\", \"vine-turtle\", \"old-garden-snail\", \"walking-forest\", \"spiny-back-leader\"].includes(key) ? \"front\" :\n" +
"    [\"flower-tail-bird\", \"soil-mole\", \"bubble-toad\", \"lantern-keeper\"].includes(key) ? \"back\" : \"middle\" })])));\n" +
"\n" +
"function creatureAttackRole(species) {\n" +
"  return CREATURE_ATTACK_ROLES[species] || null;\n" +
"}\n" +
"\n" +
"function creatureAttackMode(agent, separation) {\n" +
"  const role = creatureAttackRole(agent.species);\n" +
"  if (!role || !Number.isFinite(separation) || separation < 0) return null;\n" +
"  if (role.melee && separation <= DNA_ACTION_RULES.meleeRange) return \"melee\";\n" +
"  if (role.ranged && separation <= DNA_ACTION_RULES.rangedRange) return \"ranged\";\n" +
"  return null;\n" +
"}\n" +
"\n" +
"return { CREATURE_ATTACK_ROLES, creatureAttackRole, creatureAttackMode };\n" +
"})();\n" +
"modules[\"server/combat-stats.mjs\"] = (() => {\n" +
"const { NEUTRAL_UNIT_STATS } = modules[\"server/neutral-unit-stats.mjs\"];\n" +
"const { creatureAttackRole } = modules[\"server/creature-attack-role.mjs\"];\n" +
"const { dnaAttackStats, dnaDefensiveMelee } = modules[\"server/dna-actions.mjs\"];\n" +
"const COMBAT_BASE_DAMAGE = 15;\n" +
"const COMBAT_STRENGTH_SCALE = 25;\n" +
"const COMBAT_MAX_INJURY_PENALTY = 10;\n" +
"const UNIT_MAX_HEALTH = 100;\n" +
"\n" +
"const ATTRIBUTE_COMBAT_STRENGTH_BONUSES = Object.freeze({\n" +
"  blade: 10, piercing: 16, carapace: 8\n" +
"});\n" +
"\n" +
"function attributeCombatStrengthBonus(attributes) {\n" +
"  return Object.entries(ATTRIBUTE_COMBAT_STRENGTH_BONUSES).reduce((sum, [key, bonus]) =>\n" +
"    sum + (attributes?.[key] > 0 ? bonus : 0), 0);\n" +
"}\n" +
"\n" +
"const UNIT_COMBAT_STATS = Object.freeze(Object.fromEntries([\n" +
"  [\"bean\", 20],\n" +
"  [\"spore\", 18],\n" +
"  [\"pebble\", 22],\n" +
"  [\"spring\", 19],\n" +
"  [\"flower-tail-bird\", 8, 18, 3, 4, 50, 10],\n" +
"  [\"dew-rabbit\", 10, 22, 3, 4, 50, 8],\n" +
"  [\"soil-mole\", 14, 10, 6, 10, 50, 12],\n" +
"  [\"bundle-snail\", 16, 3, 2, 24, 50, 5],\n" +
"  [\"cotton-sheep\", 12, 7, 3, 14, 50, 5],\n" +
"  [\"rolling-acorn\", 16, 12, 4, 18, 50, 8],\n" +
"  [\"bubble-toad\", 28, 10, 5, 12, 50, 10],\n" +
"  [\"snare-vine\", 34, 3, 12, 14, 50, 8],\n" +
"  [\"spiny-back-beetle\", 32, 6, 6, 22, 50, 8],\n" +
"  [\"soil-boar\", 36, 5, 6, 18, 50, 12],\n" +
"  [\"vine-turtle\", 28, 2, 4, 28, 50, 5],\n" +
"  [\"shadow-weasel\", 40, 22, 12, 5, 50, 20],\n" +
"  [\"talon-owl\", 44, 18, 14, 6, 50, 18],\n" +
"  [\"spring-keeper\", 36, 18, 18, 10, 50, 15],\n" +
"  [\"lantern-keeper\", 38, 16, 10, 14, 50, 15],\n" +
"  [\"old-garden-snail\", 42, 2, 3, 30, 50, 5],\n" +
"  [\"walking-forest\", 48, 2, 6, 28, 50, 8],\n" +
"  [\"white-paw\", 64, 20, 16, 12, 50, 20],\n" +
"  [\"spiny-back-leader\", 54, 10, 10, 28, 50, 12]\n" +
"].map(([key, combatStrength, evasion, parry, block, blockReduction, criticalChance]) => [key, Object.freeze({\n" +
"  health: UNIT_MAX_HEALTH, combatStrength, evasion: (evasion || 0) / 100, parry: (parry || 0) / 100,\n" +
"  block: (block || 0) / 100, blockReduction: (blockReduction || 50) / 100,\n" +
"  criticalChance: (criticalChance || 0) / 100, criticalMultiplier: 1.5, ...neutralCombatStats(key)\n" +
"})])));\n" +
"\n" +
"function neutralCombatStats(key) {\n" +
"  const stats = NEUTRAL_UNIT_STATS[key];\n" +
"  if (!stats) return {};\n" +
"  const role = creatureAttackRole(key);\n" +
"  const combat = Object.freeze({ ...stats, melee: role.melee, ranged: role.ranged,\n" +
"    meleePower: role.melee ? stats.power : 0, rangedPower: role.ranged ? stats.power : 0,\n" +
"    meleeSpeed: role.melee ? stats.speed : 0, rangedSpeed: role.ranged ? stats.speed : 0,\n" +
"    hits: 1 + stats.combo, recovery: 0, blockPower: 50 });\n" +
"  return { health: stats.health, attack: stats.power, attackPower: stats.power, defense: stats.armor,\n" +
"    attackSpeed: stats.speed, speed: stats.movement, vision: stats.vision, capacity: stats.capacity,\n" +
"    harvestSpeed: stats.harvestSpeed, criticalChance: stats.critical / 100, criticalMultiplier: stats.criticalPower / 100,\n" +
"    evasion: stats.evasion / 100, parry: stats.parry / 100, block: stats.block / 100, blockReduction: .5, combat };\n" +
"}\n" +
"\n" +
"function combatAbilityStats(agent) {\n" +
"  return agent.stats?.dna || agent.stats?.combat || null;\n" +
"}\n" +
"\n" +
"function unitCombatStats(key) {\n" +
"  return UNIT_COMBAT_STATS[key] || UNIT_COMBAT_STATS.bean;\n" +
"}\n" +
"\n" +
"function combatInjuryPenalty(agent) {\n" +
"  const maximum = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : UNIT_MAX_HEALTH;\n" +
"  const health = Number.isFinite(agent.health) ? Math.max(0, Math.min(maximum, agent.health)) : maximum;\n" +
"  return Math.round(COMBAT_MAX_INJURY_PENALTY * (maximum - health) / maximum);\n" +
"}\n" +
"\n" +
"function combatStrength(agent) {\n" +
"  const base = Number.isFinite(agent.stats?.combatStrength) ? agent.stats.combatStrength :\n" +
"    unitCombatStats(agent.species || agent.tribe).combatStrength;\n" +
"  return base - combatInjuryPenalty(agent);\n" +
"}\n" +
"\n" +
"function combatPrimary(agent) {\n" +
"  const keys = [\"blade\", \"piercing\", \"carapace\"];\n" +
"  const equipped = key => Array.isArray(agent.slots) ? agent.slots.includes(key) : agent.attributes?.[key] > 0;\n" +
"  if (agent.combatPrimary === null) return null;\n" +
"  if (keys.includes(agent.combatPrimary) && equipped(agent.combatPrimary)) return agent.combatPrimary;\n" +
"  return keys.find(equipped) || null;\n" +
"}\n" +
"\n" +
"function combatProfile(agent) {\n" +
"  const base = unitCombatStats(agent.species || agent.tribe);\n" +
"  if (agent.species && !agent.stats?.dna && !agent.stats?.combat && base.combat) agent = { ...agent, stats: { ...base, ...agent.stats } };\n" +
"  const dna = agent.stats?.dna, abilities = combatAbilityStats(agent);\n" +
"  const chance = dna ? dna.critical / 100 : Number.isFinite(agent.stats?.criticalChance) ? agent.stats.criticalChance : base.criticalChance;\n" +
"  const multiplier = dna ? dna.criticalPower / 100 : Number.isFinite(agent.stats?.criticalMultiplier) ? agent.stats.criticalMultiplier : base.criticalMultiplier;\n" +
"  const criticalChance = dna ? (Number.isFinite(chance) ? chance : 0) : Math.max(0, Math.min(.75, chance));\n" +
"  const criticalMultiplier = dna ? (Number.isFinite(multiplier) ? multiplier : 1.5) : Math.max(1, Math.min(4, multiplier));\n" +
"  if (abilities) {\n" +
"    const selected = dnaAttackStats(abilities, agent.attack?.attackMode || (abilities.melee || dnaDefensiveMelee(dna) ? \"melee\" : \"ranged\"));\n" +
"    if (!dna && Number.isFinite(agent.stats.attackPower)) selected.power = agent.stats.attackPower;\n" +
"    if (!dna && Number.isFinite(agent.stats.attackSpeed)) selected.speed = agent.stats.attackSpeed;\n" +
"    const attackInterval = selected.speed > 0 ? 1 / selected.speed : Infinity;\n" +
"    return { primary: selected.power > 0 ? \"blade\" : null, attackPower: selected.power, defense: dna ? abilities.armor : agent.stats.defense,\n" +
"      armorPenetration: 0, attackSpeed: selected.speed, attackInterval, windup: abilities.focus,\n" +
"      evasion: dna ? abilities.evasion / 100 : agent.stats.evasion,\n" +
"      parry: dna ? abilities.parry / 100 : agent.stats.parry, block: dna ? abilities.block / 100 : agent.stats.block,\n" +
"      recovery: abilities.recovery || 0, blockReduction: .5, criticalChance, criticalMultiplier };\n" +
"  }\n" +
"  const equipped = key => Array.isArray(agent.slots) ? agent.slots.includes(key) : agent.attributes?.[key] > 0;\n" +
"  const primary = combatPrimary(agent);\n" +
"  const defaultInterval = primary === \"blade\" ? .95 : primary === \"piercing\" ? 1.65 : primary === \"carapace\" ? 1.4 : 1.25;\n" +
"  const attackSpeed = Number.isFinite(agent.stats?.attackSpeed) && agent.stats.attackSpeed > 0 ?\n" +
"    Math.max(.2, Math.min(4, agent.stats.attackSpeed)) : 1 / defaultInterval;\n" +
"  const attackInterval = 1 / attackSpeed;\n" +
"  const strength = Number.isFinite(agent.stats?.combatStrength) ?\n" +
"    agent.stats.combatStrength - (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes)) : base.combatStrength;\n" +
"  const attackPower = Number.isFinite(agent.stats?.attackPower) ? agent.stats.attackPower :\n" +
"    12 + strength * .35 + (equipped(\"blade\") ? 12 : 0);\n" +
"  const reduction = equipped(\"carapace\") ? .45 : Math.max(0, Math.min(.8, agent.stats?.damageReduction || 0));\n" +
"  const defense = Number.isFinite(agent.stats?.defense) ? agent.stats.defense : 8 + strength * .4 + 100 * reduction / (1 - reduction);\n" +
"  const armorPenetration = equipped(\"piercing\") ? .5 : Math.max(0, Math.min(1, agent.stats?.armorPenetration || 0));\n" +
"  const protection = Object.fromEntries([\"evasion\", \"parry\", \"block\"].map(key => [key,\n" +
"    Math.max(0, Math.min(1, Number.isFinite(agent.stats?.[key]) ? agent.stats[key] : agent.species ? base[key] : 0))]));\n" +
"  return { primary, attackPower: Math.max(1, attackPower), defense: Math.max(0, defense), armorPenetration, ...protection, blockReduction: .5, criticalChance, criticalMultiplier,\n" +
"    attackSpeed, attackInterval, windup: (primary === \"piercing\" ? .65 : primary === \"blade\" ? .24 : .4),\n" +
"    recovery: (primary === \"blade\" ? .3 : .45) };\n" +
"}\n" +
"\n" +
"function combatDamage(attacker, target, variation, rules) {\n" +
"  const source = combatProfile(attacker), defense = combatProfile(target);\n" +
"  const multiplier = Number.isFinite(variation) ? .8 + .4 * Math.max(0, Math.min(1, variation)) : 1;\n" +
"  if (combatAbilityStats(attacker) || combatAbilityStats(target)) {\n" +
"    const dna = combatAbilityStats(attacker), heavy = !dna && attacker.attack?.heavy === true;\n" +
"    const armor = Math.max(0, defense.defense - (dna?.penetration || 0)) * (dna ? 1 - (dna.armorPenetration || 0) : 1 - Math.min(.9, source.armorPenetration + (heavy ? .3 : 0)));\n" +
"    const power = source.attackPower * (dna ? attacker.attack?.counter ? dna.counterPower / 100 : 1 :\n" +
"      (source.primary === \"piercing\" ? 1.25 : 1) * (heavy ? 1.5 : 1));\n" +
"    const reduction = (rules?.armorCap ?? 1) * armor / ((rules?.armorKnee ?? 100) + armor);\n" +
"    return Math.max(0, power * multiplier * (1 - reduction) * (1 - (combatAbilityStats(target)?.reduction || 0) / 100));\n" +
"  }\n" +
"  const heavy = attacker.attack?.heavy === true;\n" +
"  const penetration = Math.min(.9, source.armorPenetration + (heavy ? .3 : 0));\n" +
"  const power = source.attackPower * (source.primary === \"piercing\" ? 1.25 : 1) * (heavy ? 1.5 : 1);\n" +
"  return Math.max(1, Math.round(power * multiplier * 100 / (100 + defense.defense * (1 - penetration))));\n" +
"}\n" +
"\n" +
"function migrateCombatStats(agent) {\n" +
"  if (agent.dna || agent.stats?.dna) return;\n" +
"  const profile = unitCombatStats(agent.species || agent.tribe);\n" +
"  if (agent.species && profile.combat) {\n" +
"    const previous = Number.isFinite(agent.stats?.health) && agent.stats.health > 0 ? agent.stats.health : profile.health;\n" +
"    const ratio = Math.max(0, Math.min(1, agent.health / previous));\n" +
"    agent.stats = { ...agent.stats, ...profile };\n" +
"    agent.health = profile.health * ratio;\n" +
"    return;\n" +
"  }\n" +
"  const combatStrength = profile.combatStrength + (agent.species ? 0 : attributeCombatStrengthBonus(agent.attributes));\n" +
"  if (agent.species) agent.stats.blockReduction = profile.blockReduction;\n" +
"  if (agent.species) for (const key of [\"evasion\", \"parry\", \"block\", \"criticalChance\", \"criticalMultiplier\"])\n" +
"    if (!Number.isFinite(agent.stats[key])) agent.stats[key] = profile[key];\n" +
"  if (agent.stats.combatStrength === combatStrength && agent.stats.health === UNIT_MAX_HEALTH) return;\n" +
"  const health = UNIT_MAX_HEALTH;\n" +
"  const ratio = Math.max(0, Math.min(1, agent.health / agent.stats.health));\n" +
"  agent.stats = { ...agent.stats, health, combatStrength };\n" +
"  agent.health = health * ratio;\n" +
"}\n" +
"\n" +
"return { COMBAT_BASE_DAMAGE, COMBAT_STRENGTH_SCALE, COMBAT_MAX_INJURY_PENALTY, UNIT_MAX_HEALTH, ATTRIBUTE_COMBAT_STRENGTH_BONUSES, attributeCombatStrengthBonus, UNIT_COMBAT_STATS, combatAbilityStats, unitCombatStats, combatInjuryPenalty, combatStrength, combatPrimary, combatProfile, combatDamage, migrateCombatStats };\n" +
"})();\n" +
"modules[\"server/attributes.mjs\"] = (() => {\n" +
"const { ATTRIBUTE_DNA } = modules[\"server/dna.mjs\"];\n" +
"const { CONQUEST_PACING } = modules[\"server/conquest-pacing.mjs\"];\n" +
"const { TRIBE_UNIT_STATS, ATTRIBUTE_STAT_VALUES } = modules[\"server/unit-stats.mjs\"];\n" +
"const { tribeTerrainSpeedMultiplier } = modules[\"server/tribe-environment.mjs\"];\n" +
"const { unitCombatStats, attributeCombatStrengthBonus } = modules[\"server/combat-stats.mjs\"];\n" +
"\n" +
"const ATTRIBUTES = [\n" +
"  { key: \"antenna\", minNestLevel: 1, name: \"감지\", color: \"#b2bffa\", effect: \"시야 반경 +3칸\", description: \"유닛의 시야 반경이 늘어납니다.\", bonus: 3, bonuses: [0, 3, 4, 6, 8], stat: \"시야 반경\", unit: \"칸\" },\n" +
"  { key: \"strength\", minNestLevel: 1, name: \"채집량 증가\", color: \"#e6a79c\", effect: \"채집량 +1개\", description: \"한 번에 채집해 운반하는 자원의 양이 1개 늘어납니다.\", bonus: 1, stat: \"채집량\", unit: \"개\" },\n" +
"  { key: \"feet\", minNestLevel: 1, name: \"이속 증가\", color: \"#8cd2bb\", effect: \"이동 속도 +0.3칸/초\", description: \"탐색과 왕복 이동을 빠르게 합니다.\", bonus: 0.3, stat: \"이동 속도\", unit: \"칸/초\" },\n" +
"  { key: \"blade\", minNestLevel: 2, nativeTribe: \"spore\", name: \"칼날\", color: \"#d5d88e\", effect: \"공격력 +12\", description: \"장착하면 공격력이 12 증가합니다. 주력으로 선택하면 빠르게 베고 짧은 패링으로 공격을 막아 반격합니다.\", kind: \"combat\", bonus: 12, bonuses: [0, 12], stat: \"공격력\", unit: \"\", harvests: [\"tree\"] },\n" +
"  { key: \"piercing\", minNestLevel: 2, nativeTribe: \"pebble\", name: \"관통\", color: \"#b9dca1\", effect: \"방어 관통 +50%\", description: \"장착하면 상대 방어력의 50%를 무시합니다. 주력으로 선택하면 세 번째 공격마다 모아찌르기로 적을 잠시 기절시킵니다.\", kind: \"combat\", bonus: 50, bonuses: [0, 50], stat: \"방어 관통\", unit: \"%\", harvests: [\"pebbles\"] },\n" +
"  { key: \"carapace\", minNestLevel: 3, name: \"갑피\", color: \"#c8bd8c\", effect: \"방어력 약 +82\", description: \"장착하면 방어력이 약 82 증가합니다. 주력으로 선택하면 준비된 블록으로 공격 피해를 줄이고 반격합니다.\", kind: \"combat\", bonus: 100 * .45 / (1 - .45), bonuses: [0, 100 * .45 / (1 - .45)], stat: \"방어력\", unit: \"\" },\n" +
"];\n" +
"\n" +
"const attributeKeys = new Set(ATTRIBUTES.map(attribute => attribute.key));\n" +
"\n" +
"function attributeUnlockLevel(attributeKey, tribe) {\n" +
"  const attribute = ATTRIBUTES.find(candidate => candidate.key === attributeKey);\n" +
"  return attribute ? attribute.nativeTribe && attribute.nativeTribe === tribe ? 1 : attribute.minNestLevel : null;\n" +
"}\n" +
"\n" +
"function isAttributeUnlocked(attributeKey, nestLevel, tribe) {\n" +
"  const level = attributeUnlockLevel(attributeKey, tribe);\n" +
"  return level !== null && Number.isInteger(nestLevel) && nestLevel >= level;\n" +
"}\n" +
"\n" +
"const HARVEST_ATTRIBUTE_KEYS = Object.freeze(ATTRIBUTES.filter(attribute => attribute.harvests?.length).map(attribute => attribute.key));\n" +
"\n" +
"const COMBAT_ATTRIBUTE_KEYS = Object.freeze(ATTRIBUTES.filter(attribute => attribute.kind === \"combat\").map(attribute => attribute.key));\n" +
"\n" +
"const ATTRIBUTE_SYNERGIES_ENABLED = false;\n" +
"\n" +
"const ATTRIBUTE_COMBINATIONS = ATTRIBUTE_SYNERGIES_ENABLED ? [\n" +
"  { keys: [\"strength\", \"strength\"], attributeLevels: { strength: 2 }, kind: \"upgrade\", requirement: \"채집량 증가 Lv.2\", name: \"과적\", description: \"기본 운반량을 넘겨 자원 4개를 추가로 적재합니다. 초과 적재 중 이동 속도는 20% 감소합니다.\" },\n" +
"  { keys: [\"strength\", \"feet\"], name: \"적재 가속\", description: \"적재율에 비례해 이동 속도가 최대 50% 증가합니다.\" },\n" +
"  { keys: [\"strength\", \"antenna\"], name: \"맥 짚기\", description: \"현장 준비 후 자원 2개를 즉시 담습니다. 같은 자원 지점에 개체별 30초 간격으로 발동합니다.\" },\n" +
"  { keys: [\"feet\", \"feet\"], attributeLevels: { feet: 2 }, kind: \"upgrade\", requirement: \"이속 증가 Lv.2\", name: \"질주\", description: \"직선으로 4칸 이동하면 이동 속도가 75% 증가합니다. 정지하거나 방향을 바꾸면 해제됩니다.\" },\n" +
"  { keys: [\"feet\", \"antenna\"], name: \"탐색 파동\", description: \"8칸 이동할 때마다 1초간 시야 반경이 4칸 넓어집니다.\" },\n" +
"  { keys: [\"antenna\", \"antenna\"], attributeLevels: { antenna: 2 }, kind: \"upgrade\", requirement: \"감지 Lv.2\", name: \"미지 감지\", description: \"반경 18칸 안개 속 미확인 대상에 느낌표를 표시합니다. 정체와 수량은 실제 시야로 확인합니다.\" }\n" +
"] : [];\n" +
"\n" +
"const ATTRIBUTE_MIGRATIONS = Object.freeze({ arms: \"strength\", botany: \"blade\", mining: \"piercing\" });\n" +
"\n" +
"function migrateAttributeSlots(slots) {\n" +
"  return [...new Set((Array.isArray(slots) ? slots : []).map(key => Object.hasOwn(ATTRIBUTE_MIGRATIONS, key) ? ATTRIBUTE_MIGRATIONS[key] : key)\n" +
"    .filter(key => ATTRIBUTES.some(attribute => attribute.key === key)))];\n" +
"}\n" +
"\n" +
"function attributeLevelLimit(nestLevel) {\n" +
"  return 1;\n" +
"}\n" +
"\n" +
"function migrateAttributeLevels(slots, levels, nestLevel) {\n" +
"  const limit = attributeLevelLimit(nestLevel);\n" +
"  const existing = levels && typeof levels === \"object\" && !Array.isArray(levels) ? levels : null;\n" +
"  const legacy = Object.create(null);\n" +
"  for (const slot of Array.isArray(slots) ? slots : []) {\n" +
"    const key = slot === \"arms\" ? \"strength\" : slot;\n" +
"    legacy[key] = (legacy[key] || 0) + 1;\n" +
"  }\n" +
"  return Object.fromEntries(migrateAttributeSlots(slots).map(key => {\n" +
"    const sources = [key, ...Object.keys(ATTRIBUTE_MIGRATIONS).filter(source => ATTRIBUTE_MIGRATIONS[source] === key)];\n" +
"    const explicit = sources.filter(source => existing && Object.hasOwn(existing, source));\n" +
"    const values = explicit.length ? explicit.map(source => Number.isInteger(existing[source]) ? existing[source] : 1) :\n" +
"      sources.map(source => legacy[source] || 1);\n" +
"    return [key, Math.max(1, Math.min(limit, Math.max(...values)))];\n" +
"  }));\n" +
"}\n" +
"\n" +
"function attributeCounts(slots, levels) {\n" +
"  const counts = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute.key, 0]));\n" +
"  const migrated = migrateAttributeLevels(migrateAttributeSlots(slots), levels);\n" +
"  for (const key of migrateAttributeSlots(slots)) {\n" +
"    const value = migrated[key];\n" +
"    counts[key] = Number.isInteger(value) ? Math.max(1, Math.min(4, value)) : 1;\n" +
"  }\n" +
"  return counts;\n" +
"}\n" +
"\n" +
"function hasSynergy(counts, keys) {\n" +
"  if (!ATTRIBUTE_SYNERGIES_ENABLED) return false;\n" +
"  for (let index = 0; index < keys.length; index++) {\n" +
"    const key = keys[index];\n" +
"    if (!attributeKeys.has(key)) return false;\n" +
"    let level = 1;\n" +
"    for (let previous = 0; previous < index; previous++) if (keys[previous] === key) level++;\n" +
"    if (!((counts[key] || 0) >= level)) return false;\n" +
"  }\n" +
"  return true;\n" +
"}\n" +
"\n" +
"const attributeUpgradeMaterials = {\n" +
"  antenna: { dew: 6 },\n" +
"  strength: { tree: 6, pebbles: 4 },\n" +
"  feet: { tree: 4 },\n" +
"  blade: { tree: 6 },\n" +
"  piercing: { tree: 6, pebbles: 6 },\n" +
"  carapace: { pebbles: 8, clay: 6 },\n" +
"};\n" +
"\n" +
"function attributeUpgradeCost(attributeKey, targetLevel) {\n" +
"  const base = Object.hasOwn(attributeUpgradeMaterials, attributeKey) ? attributeUpgradeMaterials[attributeKey] : null;\n" +
"  if (!base || !Number.isInteger(targetLevel) || targetLevel < 2 || targetLevel > attributeLevelLimit()) return null;\n" +
"  const materials = Object.fromEntries(Object.entries(base).map(([key, amount]) => [key, targetLevel === 2 ? Math.ceil(amount / 2) : 1]));\n" +
"  return { evolutionPoints: CONQUEST_PACING.attributeCosts[targetLevel], materials };\n" +
"}\n" +
"\n" +
"function attributeUpgradeIssue(template, attributeKey, nestLevel, evolutionPoints, inventory) {\n" +
"  if (!template?.slots?.includes(attributeKey)) return \"장착한 속성만 강화할 수 있습니다.\";\n" +
"  const targetLevel = attributeCounts(template.slots, template.attributeLevels)[attributeKey] + 1;\n" +
"  const cost = attributeUpgradeCost(attributeKey, targetLevel);\n" +
"  if (!cost) return \"최대 단계에 도달한 속성입니다.\";\n" +
"  if (targetLevel > attributeLevelLimit(nestLevel)) return \"둥지를 성장시킨 뒤 속성을 강화해 주세요.\";\n" +
"  if (!Number.isFinite(evolutionPoints) || evolutionPoints < cost.evolutionPoints) return \"강화에 필요한 진화 포인트가 부족합니다.\";\n" +
"  if (Object.entries(cost.materials).some(([key, amount]) => !Number.isFinite(inventory?.[key]) || inventory[key] < amount)) {\n" +
"    return \"강화에 필요한 자원 재료가 부족합니다.\";\n" +
"  }\n" +
"  return null;\n" +
"}\n" +
"\n" +
"function unitStats(attributes, tribe) {\n" +
"  const combat = unitCombatStats(tribe);\n" +
"  const base = TRIBE_UNIT_STATS[tribe] || TRIBE_UNIT_STATS.bean;\n" +
"  const equipped = key => attributes[key] > 0;\n" +
"  return {\n" +
"    speed: base.speed + (equipped(\"feet\") ? ATTRIBUTE_STAT_VALUES.movementBonus : 0),\n" +
"    capacity: equipped(\"strength\") ? ATTRIBUTE_STAT_VALUES.capacity : 1,\n" +
"    vision: equipped(\"antenna\") ? ATTRIBUTE_STAT_VALUES.vision : 3,\n" +
"    attack: 1,\n" +
"    attackBonus: equipped(\"blade\") ? ATTRIBUTE_STAT_VALUES.attackBonus : 0,\n" +
"    armorPenetration: equipped(\"piercing\") ? ATTRIBUTE_STAT_VALUES.armorPenetration : 0,\n" +
"    damageReduction: equipped(\"carapace\") ? ATTRIBUTE_STAT_VALUES.damageReduction : 0,\n" +
"    health: combat.health,\n" +
"    combatStrength: combat.combatStrength + attributeCombatStrengthBonus(attributes),\n" +
"    resistance: 1\n" +
"  };\n" +
"}\n" +
"\n" +
"function unitMovementSpeed(stats) {\n" +
"  return stats.speed * (stats.movementMultiplier ?? 1);\n" +
"}\n" +
"\n" +
"function unitCarryCapacity(agent, resourceType) {\n" +
"  return agent.stats.capacity;\n" +
"}\n" +
"\n" +
"function unitTravelSpeed(agent, carrying, resourceType) {\n" +
"  const base = agent.dna ? agent.stats : TRIBE_UNIT_STATS[agent.tribe] || TRIBE_UNIT_STATS.bean;\n" +
"  const load = Math.min(1, Math.max(0, carrying || 0) / Math.max(1, unitCarryCapacity(agent, resourceType) || 1));\n" +
"  return (agent.stats.speed + (base.loadedSpeed - base.speed) * load) * (agent.stats.movementMultiplier ?? 1);\n" +
"}\n" +
"\n" +
"function unitTerrainSpeedMultiplier(agent, terrain) {\n" +
"  if (agent.movementType === \"flying\" || agent.species === \"flower-tail-bird\" || agent.species === \"talon-owl\") {\n" +
"    return terrain === 5 || terrain === 7 ? 0.8 : 1;\n" +
"  }\n" +
"  return tribeTerrainSpeedMultiplier(agent.tribe, terrain);\n" +
"}\n" +
"\n" +
"const tribeBirthCosts = Object.freeze({\n" +
"  bean: Object.freeze([3, 5, 8, 12, 17]),\n" +
"  spring: Object.freeze([3, 5, 7, 10, 14]),\n" +
"  pebble: Object.freeze([4, 7, 11, 16, 22]),\n" +
"  spore: Object.freeze([2, 3, 5, 8, 12])\n" +
"});\n" +
"\n" +
"function birthCost(template, tribe) {\n" +
"  const costs = tribeBirthCosts[tribe || template.tribe] || tribeBirthCosts.bean;\n" +
"  if (template.dna) return ATTRIBUTE_DNA.cost(template.dna.pieces);\n" +
"  return costs[template.slots.length] ?? Infinity;\n" +
"}\n" +
"\n" +
"return { ATTRIBUTES, attributeUnlockLevel, isAttributeUnlocked, HARVEST_ATTRIBUTE_KEYS, COMBAT_ATTRIBUTE_KEYS, ATTRIBUTE_SYNERGIES_ENABLED, ATTRIBUTE_COMBINATIONS, migrateAttributeSlots, attributeLevelLimit, migrateAttributeLevels, attributeCounts, hasSynergy, attributeUpgradeCost, attributeUpgradeIssue, unitStats, unitMovementSpeed, unitCarryCapacity, unitTravelSpeed, unitTerrainSpeedMultiplier, birthCost };\n" +
"})();\n" +
"modules[\"server/unit-template-names.mjs\"] = (() => {\n" +
"const UNIT_TEMPLATE_ROLES = [\n" +
"  [[\"blade\", \"piercing\"], \"돌격병\"],\n" +
"  [[\"blade\", \"strength\"], \"벌목꾼\"],\n" +
"  [[\"piercing\", \"strength\"], \"광부\"],\n" +
"  [[\"blade\"], \"전사\"],\n" +
"  [[\"piercing\"], \"관통병\"],\n" +
"  [[\"strength\"], \"수송꾼\"],\n" +
"  [[\"carapace\"], \"파수꾼\"],\n" +
"  [[], \"일꾼\"]\n" +
"];\n" +
"\n" +
"const UNIT_TEMPLATE_MODIFIERS = [[\"feet\", \"날쌘\"], [\"antenna\", \"눈밝은\"], [\"carapace\", \"튼튼한\"]];\n" +
"\n" +
"function isDefaultTemplateName(name, base) {\n" +
"  return name === base || name.startsWith(base + \" \") && /^(?:[2-9]|[1-9]\\d+)$/.test(name.slice(base.length + 1));\n" +
"}\n" +
"\n" +
"function isTemplateNameEdited(template) {\n" +
"  if (typeof template?.nameEdited === \"boolean\") return template.nameEdited;\n" +
"  return !!template?.name && !isDefaultTemplateName(template.name, suggestTemplateName(template.slots, []));\n" +
"}\n" +
"\n" +
"function suggestTemplateName(slots, templates, templateId) {\n" +
"  const [required, role] = UNIT_TEMPLATE_ROLES.find(([keys]) => keys.every(key => slots.includes(key)));\n" +
"  const modifier = UNIT_TEMPLATE_MODIFIERS.find(([key]) => slots.includes(key) && !required.includes(key));\n" +
"  const base = (modifier ? modifier[1] + \" \" : \"\") + role;\n" +
"  const previous = templateId == null ? null : templates.find(template => template.id === templateId);\n" +
"  if (previous && isDefaultTemplateName(previous.name, base)) return previous.name;\n" +
"  const names = new Set(templates.filter(template => !previous || template.id !== previous.id).map(template => template.name));\n" +
"  let name = base, number = 2;\n" +
"  while (names.has(name)) name = base + \" \" + number++;\n" +
"  return name;\n" +
"}\n" +
"\n" +
"return { isTemplateNameEdited, suggestTemplateName };\n" +
"})();\n" +
"modules[\"server/colony-supply.mjs\"] = (() => {\n" +
"const { militaryAgent } = modules[\"server/conquest-pacing.mjs\"];\n" +
"const { HARVEST_ATTRIBUTE_KEYS, birthCost, unitCarryCapacity, unitTravelSpeed } = modules[\"server/attributes.mjs\"];\n" +
"\n" +
"function recordColonyIncome(state, amount) {\n" +
"  if (!(amount > 0) || !Number.isFinite(amount)) return;\n" +
"  const bucket = Math.floor(state.simSeconds / 5) * 5;\n" +
"  const history = (state.foodIncome || []).filter(entry => entry[0] > state.simSeconds - 60);\n" +
"  if (history.at(-1)?.[0] === bucket) history.at(-1)[1] += amount;\n" +
"  else history.push([bucket, amount]);\n" +
"  state.foodIncome = history;\n" +
"}\n" +
"\n" +
"function restoreColonyIncome(state, saved) {\n" +
"  state.foodIncomeStartedAt = Number.isFinite(saved.foodIncomeStartedAt) && saved.foodIncomeStartedAt >= 0 &&\n" +
"    saved.foodIncomeStartedAt <= state.simSeconds ? saved.foodIncomeStartedAt : state.simSeconds;\n" +
"  state.foodIncome = (Array.isArray(saved.foodIncome) ? saved.foodIncome : []).filter(entry => Array.isArray(entry) &&\n" +
"    Number.isFinite(entry[0]) && entry[0] >= 0 && entry[0] <= state.simSeconds && entry[0] > state.simSeconds - 60 &&\n" +
"    Number.isFinite(entry[1]) && entry[1] > 0).sort((first, second) => first[0] - second[0]).slice(-13).map(entry => [entry[0], entry[1]]);\n" +
"}\n" +
"\n" +
"function colonySupply(state, tribe) {\n" +
"  const living = state.agents.filter(agent => agent.health > 0);\n" +
"  const reserve = birthCost({ slots:[\"strength\"] }, tribe);\n" +
"  const gap = Number.isFinite(state.lastFoodAt) ? Math.max(0, state.simSeconds - state.lastFoodAt) : 0;\n" +
"  if (state.evolutionPoints >= reserve * 3 || !living.length) state.supplyInterrupted = false;\n" +
"  else if (gap > 30) state.supplyInterrupted = true;\n" +
"  const interruption = state.supplyInterrupted ? Math.max(.5, Math.min(1, (gap - 30) / 60)) : 0;\n" +
"  const urgency = Math.max(interruption, living.length <= 2 ? Math.max(0, 1 - state.evolutionPoints / reserve) : 0);\n" +
"  const observedSeconds = Number.isFinite(state.foodIncomeStartedAt) ? Math.max(0, state.simSeconds - state.foodIncomeStartedAt) : 0;\n" +
"  const income = (state.foodIncome || []).filter(entry => entry[0] > state.simSeconds - 60 && entry[0] <= state.simSeconds)\n" +
"    .reduce((sum, entry) => sum + entry[1], 0);\n" +
"  const incomeRate = income / Math.max(1, Math.min(60, observedSeconds));\n" +
"  return { living:living.length, reserve, urgency, interruption, incomeRate, maintenanceRate:0, rateDeficit:0,\n" +
"    incomeObserved:observedSeconds >= 30, forecastBalance:state.evolutionPoints + incomeRate * 120 - reserve };\n" +
"}\n" +
"\n" +
"function colonyForagers(state, foods, homes) {\n" +
"  let workers = state.agents.filter(agent => !militaryAgent(agent,agent.tribe) && agent.health >= agent.stats.health * .6 && !agent.retreat && !agent.combat &&\n" +
"    !(agent.birth?.readyAt > state.simSeconds));\n" +
"  const ordinary = workers.filter(agent => !HARVEST_ATTRIBUTE_KEYS.some(key => agent.attributes?.[key] > 0));\n" +
"  if (ordinary.length >= 2) workers = ordinary;\n" +
"  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);\n" +
"  const ranked = workers.map(agent => {\n" +
"    const outward = foods.reduce((best, food) => Math.min(best, distance(agent, food)), Infinity);\n" +
"    const speed = unitTravelSpeed(agent, agent.carrying);\n" +
"    let efficiency = Infinity;\n" +
"    const travel = foods.reduce((best, food) => {\n" +
"      const capacity = unitCarryCapacity(agent, food.resourceType);\n" +
"      const returnSpeed = unitTravelSpeed(agent, capacity, food.resourceType);\n" +
"      const seconds = distance(agent, food) / speed + homes.reduce((home, cell) => Math.min(home, distance(food, cell) / returnSpeed), Infinity);\n" +
"      efficiency = Math.min(efficiency, seconds / Math.max(.01, capacity));\n" +
"      return Math.min(best, seconds);\n" +
"    }, Infinity);\n" +
"    return { agent, feasible:Number.isFinite(travel), reachable:Number.isFinite(outward / speed), efficiency };\n" +
"  }).sort((a,b) => a.efficiency - b.efficiency || String(a.agent.id).localeCompare(String(b.agent.id)));\n" +
"  const feasible = ranked.filter(entry=>entry.feasible), assigned = feasible.length ? feasible : ranked.filter(entry=>entry.reachable);\n" +
"  return new Set(assigned.slice(0, Math.max(1, Math.ceil(workers.length / 2))).map(entry => entry.agent.id));\n" +
"}\n" +
"\n" +
"return { recordColonyIncome, restoreColonyIncome, colonySupply, colonyForagers };\n" +
"})();\n" +
"modules[\"server/tribe-start.mjs\"] = (() => {\n" +
"const { ATTRIBUTE_DNA } = modules[\"server/dna.mjs\"];\n" +
"\n" +
"// Worker production is affordable immediately; gathering funds nest growth.\n" +
"const PLAYER_STARTING_POINTS = 30;\n" +
"\n" +
"const TRIBE_STARTING_UNITS = Object.freeze({\n" +
"  bean: Object.freeze([[\"antenna\"], [\"strength\"], [], []].map(slots => Object.freeze(slots))),\n" +
"  spore: Object.freeze([[\"strength\"], [\"blade\"], [], []].map(slots => Object.freeze(slots))),\n" +
"  pebble: Object.freeze([[\"strength\"], [\"strength\"], [\"antenna\"], []].map(slots => Object.freeze(slots))),\n" +
"  spring: Object.freeze([[\"feet\"], [\"feet\"], [\"antenna\"], []].map(slots => Object.freeze(slots)))\n" +
"});\n" +
"\n" +
"// Each tribe gets a modest legal level-one worker, priced through the same\n" +
"// DNA catalog as user designs (currently 17P each, including birth cost).\n" +
"const STARTING_WORKER_GENES = Object.freeze({\n" +
"  bean: Object.freeze([\"gather\", \"capacity\", \"capacity\", \"capacity\"]),\n" +
"  spore: Object.freeze([\"gather\", \"harvestSpeed\", \"capacity\", \"capacity\"]),\n" +
"  pebble: Object.freeze([\"gather\", \"health\", \"capacity\", \"capacity\"]),\n" +
"  spring: Object.freeze([\"gather\", \"movement\", \"capacity\", \"capacity\"])\n" +
"});\n" +
"\n" +
"function startingWorkerDna(tribe = \"bean\") {\n" +
"  const genes = STARTING_WORKER_GENES[tribe] || STARTING_WORKER_GENES.bean;\n" +
"  const pieces = ATTRIBUTE_DNA.pack(genes.map(id => {\n" +
"    const gene = ATTRIBUTE_DNA.lookup.get(id);\n" +
"    return { gene: gene.id, grade: gene.grade, rotation: 0 };\n" +
"  }), 1);\n" +
"  if (!pieces) throw new Error(\"시작 일꾼 DNA가 1레벨 보드에 맞지 않습니다.\");\n" +
"  return { version: 4, level: 1, budget: 30, pieces };\n" +
"}\n" +
"\n" +
"return { PLAYER_STARTING_POINTS, TRIBE_STARTING_UNITS, STARTING_WORKER_GENES, startingWorkerDna };\n" +
"})();\n" +
"modules[\"server/tribe-production.mjs\"] = (() => {\n" +
"const { birthCost, isAttributeUnlocked } = modules[\"server/attributes.mjs\"];\n" +
"const { suggestTemplateName } = modules[\"server/unit-template-names.mjs\"];\n" +
"const { colonySupply } = modules[\"server/colony-supply.mjs\"];\n" +
"const { NEST_LEVELS } = modules[\"server/nests.mjs\"];\n" +
"const { TRIBE_STARTING_UNITS } = modules[\"server/tribe-start.mjs\"];\n" +
"const { CONQUEST_PACING, TRIBE_PACING, colonyWorkerShare, militaryAgent } = modules[\"server/conquest-pacing.mjs\"];\n" +
"\n" +
"function productionTemplate(slots,role,state) {\n" +
" const previous=state.templates.find(template=>template.productionRole===role&&template.slots.length===slots.length&&slots.every(key=>template.slots.includes(key)));\n" +
" if(previous)return previous;\n" +
" return {id:null,name:suggestTemplateName(slots,state.templates),slots:[...slots],attributeLevels:Object.fromEntries(slots.map(key=>[key,1])),revision:1,productionRole:role};\n" +
"}\n" +
"\n" +
"function tribeProductionTemplate(state,tribe) {\n" +
" const profile=TRIBE_PACING[tribe],initial=TRIBE_STARTING_UNITS[tribe];if(!profile||!initial)return null;\n" +
" if(state.agents.filter(agent=>agent.health>0).length>=NEST_LEVELS[state.nestLevel-1].unitCapacity)return null;\n" +
" const living=state.agents.filter(agent=>agent.health>0);\n" +
" if(!living.length){const worker=productionTemplate([profile.native].filter(Boolean),\"worker\",state);if(state.evolutionPoints>=birthCost(worker,tribe))return worker;\n" +
"  const basic=productionTemplate([],\"worker\",state);return state.evolutionPoints>=birthCost(basic,tribe)?basic:null;}\n" +
" const young=living;\n" +
" const target=NEST_LEVELS[state.nestLevel-1].unitCapacity;\n" +
" const militaryAllowed=state.simSeconds>=CONQUEST_PACING.neutralConflictAt*profile.tempo;\n" +
" const workerTarget=militaryAllowed?Math.floor(target*colonyWorkerShare(state.nestLevel,state.simSeconds,tribe)):target;\n" +
" const workers=young.filter(agent=>!militaryAgent(agent,tribe)),soldiers=young.filter(agent=>militaryAgent(agent,tribe));\n" +
" let role=null;\n" +
" if(workers.length<workerTarget)role=\"worker\";\n" +
" else if(militaryAllowed&&soldiers.length<target-workerTarget)role=\"military\";\n" +
" if(!role)return null;\n" +
" const supply=colonySupply(state,tribe),replacing=living.length<initial.length;\n" +
" if(!replacing&&young.length>=initial.length&&(!supply.incomeObserved||supply.rateDeficit>0))return null;\n" +
" const armies=[profile.army,[\"piercing\",\"blade\",\"feet\",\"carapace\"],[\"feet\",profile.army[0]],\n" +
"  [\"carapace\",profile.army[0]]].map(slots=>[...new Set(slots.filter(key=>isAttributeUnlocked(key,state.nestLevel,tribe)))].slice(0,state.nestLevel));\n" +
" const count=slots=>soldiers.filter(agent=>slots.every(key=>agent.slots.includes(key))).length;\n" +
" const army=armies.filter(slots=>slots.length).sort((first,second)=>count(first)-count(second))[0];\n" +
" const slots=role===\"worker\"?[profile.native,\"strength\",\"feet\"]:army;\n" +
" const allowed=[...new Set(slots.filter(key=>isAttributeUnlocked(key,state.nestLevel,tribe)))].slice(0,state.nestLevel);\n" +
" const template=productionTemplate(allowed,role,state);\n" +
" const reserve=replacing?0:supply.reserve;\n" +
" return state.evolutionPoints+1e-8>=birthCost(template,tribe)+reserve?template:null;\n" +
"}\n" +
"\n" +
"return { tribeProductionTemplate };\n" +
"})();\n" +
"modules[\"server/food.mjs\"] = (() => {\n" +
"const { worldSize } = modules[\"server/world-size.mjs\"];\n" +
"function isTreeFood(food, world) {\n" +
"  return Boolean(food && (!food.resourceType || food.resourceType === \"tree-fruit\") &&\n" +
"    ![\"corpse\", \"food\", \"resource\"].includes(food.kind) && food.terrain === \"forest\" &&\n" +
"    !world.hazards?.[food.y * worldSize(world) + food.x]);\n" +
"}\n" +
"\n" +
"return { isTreeFood };\n" +
"})();\n" +
"modules[\"server/resources.mjs\"] = (() => {\n" +
"const { worldSize } = modules[\"server/world-size.mjs\"];\n" +
"const { isTreeFood } = modules[\"server/food.mjs\"];\n" +
"const { attributeCounts } = modules[\"server/attributes.mjs\"];\n" +
"const { LEGACY_RESOURCE_HABITATS } = modules[\"server/resource-legacy.mjs\"];\n" +
"const { RESOURCE_ECONOMY, isEconomyHabitat } = modules[\"server/economy.mjs\"];\n" +
"const { resourceHabitatSuitability } = modules[\"server/resource-habitats.mjs\"];\n" +
"\n" +
"const REMOVED_RESOURCE_TYPES = Object.freeze([\"honey-mushrooms\",\"twigs\",\"bark\",\"root-fiber\",\"spider-silk\",\"water\",\"tree-sap\",\"leaf-mold\",\"resin\",\"beeswax\",\"dry-leaves\",\"tree-fruit\",\"berry-bush\",\"seed-pods\",\"root-bulbs\",\"nutrient-moss\",\"meat\",\"carapace\",\"nutrients\",\"sand\",\"grass-fiber\",\"iron-ore\",\"copper-ore\",\"quartz\"]);\n" +
"\n" +
"function migrateResourceType(key) {\n" +
"  if (key === \"wood\") return \"tree\";\n" +
"  return REMOVED_RESOURCE_TYPES.includes(key) ? null : key;\n" +
"}\n" +
"\n" +
"const resourceImages = {\n" +
"  tree: \"DesignAssets/Terrain/standing-tree-smooth-atlas.png\",\n" +
"  dew: \"DesignAssets/Resources/dew-grass.png\",\n" +
"  pebbles: \"DesignAssets/Resources/pebbles.png\",\n" +
"  clay: \"DesignAssets/Resources/clay.png\",\n" +
"};\n" +
"const resourceCarryImages = {\n" +
"  tree: \"DesignAssets/Resources/wood-carry.png\",\n" +
"  dew: \"DesignAssets/Resources/dew-carry.png\",\n" +
"  pebbles: \"DesignAssets/Resources/pebbles-carry.png\",\n" +
"  clay: \"DesignAssets/Resources/clay-carry.png\",\n" +
"};\n" +
"\n" +
"const RESOURCE_TYPES = Object.freeze([\n" +
"  [\"tree\", \"목재\", \"material\", 6, [\"blade\"]],\n" +
"  [\"dew\", \"이슬방울\", \"material\", 2, []],\n" +
"  [\"pebbles\", \"자갈\", \"material\", 6, [\"piercing\"]],\n" +
"  [\"clay\", \"비옥토\", \"material\", 4, []],\n" +
"].map(([key, name, category, harvestSeconds, requirements]) => Object.freeze({\n" +
"  key, name, category, harvestSeconds: RESOURCE_ECONOMY.find(entry => entry.key === key)?.harvestSeconds ?? harvestSeconds,\n" +
"  harvestLocked: key === \"honey-mushrooms\", requirements: Object.freeze(requirements),\n" +
"  image: resourceImages[key], carryImage: resourceCarryImages[key] || resourceImages[key]\n" +
"})));\n" +
"\n" +
"const FOOD_HABITATS = Object.freeze([\n" +
"].map(([key, terrains, neighbors]) => Object.freeze({\n" +
"  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors)\n" +
"})));\n" +
"\n" +
"const RESOURCE_PLACEMENT = Object.freeze({ nearRadius: 22, nearTypes: 3, nearNodes: 2 });\n" +
"\n" +
"const RESOURCE_HABITATS = Object.freeze([\n" +
"  [\"pebbles\", [\"coast\", \"land\", \"lowMountain\"], [], \"common\", 4, 36, 7],\n" +
"  [\"clay\", [\"coast\", \"grassland\", \"swamp\"], [\"deep\", \"shallow\", \"coast\", \"swamp\"], \"uncommon\", 24, 20, 8],\n" +
"].map(([key, terrains, neighbors, rarity, minDistance, nodes, separation]) => Object.freeze({\n" +
"  key, terrains: Object.freeze(terrains), neighbors: Object.freeze(neighbors), rarity, minDistance, nodes, separation\n" +
"})));\n" +
"\n" +
"const definitions = new Map(RESOURCE_TYPES.map(definition => [definition.key, definition]));\n" +
"const resourceHabitats = new Map(RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));\n" +
"const legacyResourceHabitats = new Map(LEGACY_RESOURCE_HABITATS.map(habitat => [habitat.key, habitat]));\n" +
"const foodHabitats = new Map(FOOD_HABITATS.map(habitat => [habitat.key, habitat]));\n" +
"const terrainTypes = [\"deep\", \"shallow\", \"coast\", \"land\", \"grassland\", \"forest\", \"lowMountain\", \"highMountain\", \"ridge\", \"swamp\", \"ford\"];\n" +
"\n" +
"function resourceDefinition(key) {\n" +
"  return definitions.get(key);\n" +
"}\n" +
"\n" +
"function isTribeFood(resourceType, tribe, version) {\n" +
"  return RESOURCE_ECONOMY.find(entry => entry.tribe === (tribe || \"bean\"))?.key === resourceType;\n" +
"}\n" +
"\n" +
"function isColonyFood(resourceType, tribe, version) {\n" +
"  return isTribeFood(resourceType, tribe, version);\n" +
"}\n" +
"\n" +
"function populateColonyFood(room) {\n" +
"  if (room.world?.generationVersion >= 10) return;\n" +
"  for (const colony of room.colonies) {\n" +
"    if (colony.tribe && colony.tribe !== \"bean\") continue;\n" +
"    if (colony.tribe === null) continue;\n" +
"    for (const cell of room.food.values()) {\n" +
"      if (cell.kind === \"corpse\" || cell.resourceType !== \"honey-mushrooms\" ||\n" +
"          Math.hypot(cell.x - colony.x - 2, cell.y - colony.y - 2) > RESOURCE_PLACEMENT.nearRadius) continue;\n" +
"      cell.resourceType = \"clay\";\n" +
"      cell.kind = \"resource\";\n" +
"    }\n" +
"  }\n" +
"}\n" +
"\n" +
"function isFoodHabitat(resourceType, world, x, y) {\n" +
"  const size = worldSize(world);\n" +
"  if (resourceType === \"tree-fruit\" && world.hazards?.[y * size + x]) return false;\n" +
"  const habitat = foodHabitats.get(resourceType);\n" +
"  if (world.generationVersion >= 23 && resourceType === \"honey-mushrooms\" && x >= 0 && y >= 0 && x < size && y < size) {\n" +
"    return Boolean(world.hydrology?.resourceHabitats && resourceHabitatSuitability(resourceType, y * size + x, world.terrain, world.hydrology));\n" +
"  }\n" +
"  if (!habitat || x < 0 || y < 0 || x >= size || y >= size ||\n" +
"    !habitat.terrains.includes(terrainTypes[world.terrain[y * size + x]])) return false;\n" +
"  return !habitat.neighbors.length || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {\n" +
"    const nx = x + dx, ny = y + dy;\n" +
"    return nx >= 0 && ny >= 0 && nx < size && ny < size &&\n" +
"      habitat.neighbors.includes(terrainTypes[world.terrain[ny * size + nx]]);\n" +
"  });\n" +
"}\n" +
"\n" +
"function isResourceHabitat(resourceType, world, x, y) {\n" +
"  const size = worldSize(world);\n" +
"  if (world.generationVersion >= 11 && RESOURCE_ECONOMY.some(entry => entry.key === resourceType)) return x >= 0 && y >= 0 && x < size && y < size && isEconomyHabitat(resourceType, world.terrain[y * size + x]);\n" +
"  const habitat = (world.generationVersion >= 1 && world.generationVersion <= 4 ? legacyResourceHabitats : resourceHabitats).get(resourceType);\n" +
"  if (!habitat || x < 0 || y < 0 || x >= size || y >= size ||\n" +
"    !habitat.terrains.includes(terrainTypes[world.terrain[y * size + x]])) return false;\n" +
"  if (resourceType === \"pebbles\" && world.generationVersion >= 10) {\n" +
"    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {\n" +
"      const nx = x + dx, ny = y + dy;\n" +
"      if (Math.abs(dx) + Math.abs(dy) > 6 || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;\n" +
"      const terrain = world.terrain[ny * size + nx];\n" +
"      if (terrain < 2 || terrain >= 6 && terrain <= 8) return true;\n" +
"    }\n" +
"    return false;\n" +
"  }\n" +
"  if (!habitat.neighbors.length) return true;\n" +
"  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {\n" +
"    const nx = x + dx, ny = y + dy;\n" +
"    if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;\n" +
"    if (habitat.neighbors.includes(terrainTypes[world.terrain[ny * size + nx]])) return true;\n" +
"  }\n" +
"  return false;\n" +
"}\n" +
"\n" +
"function resourceTypeForCell(cell, world) {\n" +
"  if (cell?.kind === \"corpse\") return null;\n" +
"  if (cell?.resourceType) return migrateResourceType(cell.resourceType);\n" +
"  if (isTreeFood(cell, world)) return \"berry-bush\";\n" +
"  return \"honey-mushrooms\";\n" +
"}\n" +
"\n" +
"function resourceHarvestSeconds(resourceType, world) {\n" +
"  return resourceDefinition(resourceType).harvestSeconds;\n" +
"}\n" +
"\n" +
"function resourceHarvestMultiplier(resourceType, attributes, tribe) {\n" +
"  if (!tribe || !isTribeFood(resourceType, tribe)) return 1;\n" +
"  const definition = resourceDefinition(resourceType);\n" +
"  return definition.requirements.some(key => attributes?.[key] > 0) ? .75 : 1;\n" +
"}\n" +
"\n" +
"function resourceHarvestRequirements(cell, world, tribe) {\n" +
"  if (!cell || cell.kind === \"corpse\") return null;\n" +
"  if (cell.dropped && resourceDefinition(cell.resourceType)) return {};\n" +
"  if (isTribeFood(cell.resourceType, tribe, world.generationVersion)) return {};\n" +
"  const definition = resourceDefinition(cell.resourceType || resourceTypeForCell(cell, world));\n" +
"  if (!definition || definition.harvestLocked) return null;\n" +
"  const slots = [...definition.requirements];\n" +
"  return attributeCounts(slots);\n" +
"}\n" +
"\n" +
"function canHarvestResource(cell, world, attributes, tribe) {\n" +
"  if (typeof attributes?.dnaGather === \"boolean\") return attributes.dnaGather && !!cell && cell.kind !== \"corpse\" && !resourceDefinition(resourceTypeForCell(cell, world))?.harvestLocked;\n" +
"  const required = resourceHarvestRequirements(cell, world, tribe);\n" +
"  return required !== null && Object.entries(required).every(([key, count]) => (attributes?.[key] || 0) >= count);\n" +
"}\n" +
"\n" +
"function dropCarriedResources(room, agent) {\n" +
"  if (!(agent.carrying > 0) || !resourceDefinition(agent.carryingType)) return;\n" +
"  const resourceType = agent.carryingType;\n" +
"  const key = \"drop:\" + resourceType + \":\" + agent.x + \",\" + agent.y;\n" +
"  let cell = room.food.get(key);\n" +
"  if (!cell) {\n" +
"    cell = { key, x: agent.x, y: agent.y, resourceType, kind: \"resource\", dropped: true, amount: 0 };\n" +
"    room.food.set(key, cell);\n" +
"    const regionKey = Math.floor(agent.x / 18) + \",\" + Math.floor(agent.y / 18);\n" +
"    if (!room.foodSpots.has(regionKey)) room.foodSpots.set(regionKey, { cells: [] });\n" +
"    room.foodSpots.get(regionKey).cells.push(cell);\n" +
"  }\n" +
"  cell.amount = Math.round((cell.amount + agent.carrying) * 10) / 10;\n" +
"  cell.initialAmount = cell.amount;\n" +
"  agent.carrying = 0;\n" +
"  agent.carryingType = null;\n" +
"  for (const key of [\"transportCargo\", \"transport\", \"transportReadyAt\"]) delete agent[key];\n" +
"}\n" +
"\n" +
"function clearResourceHazards(room) {\n" +
"  const size = worldSize(room.world);\n" +
"  if (room.world.generationVersion >= 6) return;\n" +
"  const hazards = room.world.hazards;\n" +
"  if (!hazards) return;\n" +
"  for (const cell of room.food.values()) {\n" +
"    const index = cell.y * size + cell.x;\n" +
"    if (cell.kind === \"corpse\" || !hazards[index]) continue;\n" +
"    if (!cell.resourceType) cell.resourceType = resourceTypeForCell(cell, room.world);\n" +
"    hazards[index] = 0;\n" +
"  }\n" +
"}\n" +
"\n" +
"function populateResourceNodes(room) {\n" +
"  const size = worldSize(room.world);\n" +
"  for (const [key, cell] of room.food) {\n" +
"    if (cell.kind === \"corpse\") continue;\n" +
"    const type = migrateResourceType(cell.resourceType);\n" +
"    if (type === null) room.food.delete(key);\n" +
"    else if (cell.resourceType) cell.resourceType = type;\n" +
"  }\n" +
"  room.world.resources = (room.world.resources || []).flatMap(([x, y, amount, key]) => {\n" +
"    const type = migrateResourceType(key);\n" +
"    return type === null ? [] : [[x, y, amount, type]];\n" +
"  });\n" +
"  if (room.resourceVersion < 1 || room.resourceVersion === undefined) for (const [x, y, amount, resourceType] of room.world.resources || []) {\n" +
"    const key = x + \",\" + y;\n" +
"    if (room.food.has(key)) continue;\n" +
"    room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: \"resource\",\n" +
"      terrain: terrainTypes[room.world.terrain[y * size + x]] });\n" +
"  }\n" +
"  if (!(room.resourceVersion >= 2) && room.world.generationVersion < 11) {\n" +
"    const blocked = new Set();\n" +
"    for (const colony of room.colonies || []) for (let y = colony.y; y < colony.y + 5; y++) {\n" +
"      for (let x = colony.x; x < colony.x + 5; x++) blocked.add(y * size + x);\n" +
"    }\n" +
"    for (const burrow of room.world.burrows || []) for (let y = burrow.y; y < burrow.y + burrow.height; y++) {\n" +
"      for (let x = burrow.x; x < burrow.x + burrow.width; x++) blocked.add(y * size + x);\n" +
"    }\n" +
"    for (let index = 0; index < room.world.terrain.length; index++) {\n" +
"      const terrain = room.world.terrain[index];\n" +
"      if (![4, 5].includes(terrain) || blocked.has(index) || room.world.hazards?.[index] ||\n" +
"        room.world.depletedTrees?.has(index)) continue;\n" +
"      const x = index % size, y = Math.floor(index / size), key = x + \",\" + y;\n" +
"      if (room.food.has(key)) continue;\n" +
"      const resourceType = terrain === 5 ? \"tree\" : \"dew\";\n" +
"      const amount = RESOURCE_ECONOMY.find(entry => entry.key === resourceType).amount;\n" +
"      room.food.set(key, { x, y, amount, initialAmount: amount, resourceType, kind: \"resource\", terrain: terrainTypes[terrain] });\n" +
"    }\n" +
"  }\n" +
"  if (!(room.resourceVersion >= 3) && !(room.world.generationVersion >= 20)) {\n" +
"    const amount = RESOURCE_ECONOMY.find(entry => entry.key === \"tree\").amount;\n" +
"    for (const point of room.world.resources) {\n" +
"      if (point[3] === \"tree\" && point[2] > 0) point[2] = Math.max(amount, point[2]);\n" +
"    }\n" +
"    for (const cell of room.food.values()) {\n" +
"      if (cell.dropped || cell.resourceType !== \"tree\" || cell.kind !== \"resource\" || cell.amount <= 0 ||\n" +
"          !Number.isFinite(cell.initialAmount)) continue;\n" +
"      const initialAmount = cell.initialAmount;\n" +
"      cell.initialAmount = Math.max(amount, initialAmount);\n" +
"      cell.amount += cell.initialAmount - initialAmount;\n" +
"    }\n" +
"  }\n" +
"  room.resourceVersion = 3;\n" +
"}\n" +
"\n" +
"\n" +
"function populateForestResources(room) {\n" +
"  const size = worldSize(room.world);\n" +
"  const cells = new Uint8Array(size * size);\n" +
"  for (let index = 0; index < cells.length; index++) {\n" +
"    if (!(room.world.generationVersion >= 20) && room.world.terrain[index] === 5 && !room.world.hazards?.[index]) cells[index] = 1;\n" +
"  }\n" +
"  for (const burrow of room.world.burrows || []) {\n" +
"    for (let y = burrow.y; y < burrow.y + burrow.height; y++) for (let x = burrow.x; x < burrow.x + burrow.width; x++) {\n" +
"      if (x >= 0 && y >= 0 && x < size && y < size) cells[y * size + x] = 0;\n" +
"    }\n" +
"  }\n" +
"  for (const cell of room.food.values()) {\n" +
"    if ((!cell.key || cell.key === cell.x + \",\" + cell.y) && cell.kind !== \"corpse\" &&\n" +
"      !isTreeFood(cell, room.world) && !(cell.resourceType === \"tree\" && cell.amount > 0)) cells[cell.y * size + cell.x] = 0;\n" +
"  }\n" +
"  if (room.world.generationVersion >= 20) for (const cell of room.food.values()) {\n" +
"    if (!cell.dropped && cell.resourceType === \"tree\" && cell.amount > 0) cells[cell.y * size + cell.x] = 1;\n" +
"  }\n" +
"  room.world.treeCells = cells;\n" +
"  if (!room.world.depletedTrees) room.world.depletedTrees = new Set();\n" +
"  for (const cell of room.food.values()) if (!cell.dropped && cell.resourceType === \"tree\" && cell.amount <= 0) room.world.depletedTrees.add(cell.y * size + cell.x);\n" +
"  for (const index of room.world.depletedTrees) cells[index] = 0;\n" +
"}\n" +
"\n" +
"return { REMOVED_RESOURCE_TYPES, migrateResourceType, RESOURCE_TYPES, FOOD_HABITATS, RESOURCE_PLACEMENT, RESOURCE_HABITATS, resourceDefinition, isTribeFood, isColonyFood, populateColonyFood, isFoodHabitat, isResourceHabitat, resourceTypeForCell, resourceHarvestSeconds, resourceHarvestMultiplier, resourceHarvestRequirements, canHarvestResource, dropCarriedResources, clearResourceHazards, populateResourceNodes, populateForestResources };\n" +
"})();\n" +
"modules[\"server/conquest-economy.mjs\"] = (() => {\n" +
"const { CONQUEST_PACING, TRIBE_PACING, colonyWorkerShare, aiUpgradeReadyAt } = modules[\"server/conquest-pacing.mjs\"];\n" +
"const { NEST_LEVELS, nestUpgradeCost } = modules[\"server/nests.mjs\"];\n" +
"const { birthCost, attributeUpgradeCost, attributeLevelLimit } = modules[\"server/attributes.mjs\"];\n" +
"const { TRIBE_STARTING_UNITS } = modules[\"server/tribe-start.mjs\"];\n" +
"const { attributeCounts, unitStats, unitCarryCapacity, unitTravelSpeed } = modules[\"server/attributes.mjs\"];\n" +
"const { RESOURCE_ECONOMY } = modules[\"server/economy.mjs\"];\n" +
"const { resourceHarvestMultiplier } = modules[\"server/resources.mjs\"];\n" +
"\n" +
"function colonyWorkerRate(tribe,slots,levels,distance) {\n" +
" const resource=RESOURCE_ECONOMY.find(entry=>entry.tribe===tribe),attributes=attributeCounts(slots,levels),stats=unitStats(attributes,tribe);\n" +
" const agent={tribe,attributes,stats,carryingType:resource.key};\n" +
" const capacity=unitCarryCapacity(agent,resource.key),outward=distance/unitTravelSpeed(agent,0,resource.key),inward=distance/unitTravelSpeed(agent,capacity,resource.key);\n" +
" const harvest=capacity*resource.harvestSeconds*resourceHarvestMultiplier(resource.key,attributes,tribe);\n" +
" return {capacity,seconds:outward+inward+harvest+2,perSecond:capacity/(outward+inward+harvest+2)};\n" +
"}\n" +
"\n" +
"function simulateConquestBuild(tribe,policy,distance) {\n" +
" const profile=TRIBE_PACING[tribe],expert=policy===\"expert\",basic=policy===\"basic\",tempo=profile.tempo;\n" +
" const units=[],milestones=[{level:1,seconds:0}],history=[],purchases=new Set();let points=0,level=1,spent=0,delivered=0,nextBirth=0;\n" +
" const make=(slots,attributeLevels,role,now)=>{\n" +
"  const unit={slots,attributeLevels,role,bornAt:now};\n" +
"  const rate=colonyWorkerRate(tribe,slots,attributeLevels,distance);unit.nextDeliveryAt=now+rate.seconds;units.push(unit);\n" +
" };\n" +
" for(const slots of TRIBE_STARTING_UNITS[tribe])make(slots,{},\"worker\",0);\n" +
" for(let now=1;now<=2400;now++){\n" +
"  const carryDistance=distance*(level>=3?(expert?.55:.7):1);\n" +
"  for(const unit of units){if(unit.role!==\"worker\"||now<unit.nextDeliveryAt)continue;\n" +
"   const rate=colonyWorkerRate(tribe,unit.slots,unit.attributeLevels,carryDistance);\n" +
"   points=Math.min(NEST_LEVELS[level-1].pointCapacity,points+rate.capacity);delivered+=rate.capacity;\n" +
"   unit.nextDeliveryAt=now+rate.seconds/(basic?.45:expert?.9:.75);\n" +
"  }\n" +
"  const young=units,workers=young.filter(unit=>unit.role===\"worker\");\n" +
"  const goal=NEST_LEVELS[level-1].unitCapacity,share=now<CONQUEST_PACING.neutralConflictAt*tempo?1:colonyWorkerShare(level,now,tribe),workerGoal=Math.floor(goal*share);\n" +
"  const reserve=birthCost({slots:[profile.native].filter(Boolean)},tribe)*2,cost=nestUpgradeCost(level,tribe),gate=policy===\"ai\"?aiUpgradeReadyAt(level,tribe):0;\n" +
"  if(cost!==null&&now>=gate&&workers.length>=4&&points>=cost+reserve){points-=cost;spent+=cost;level++;milestones.push({level,seconds:now});}\n" +
"  let researchSaving=false;\n" +
"  if(level>=2){const target=attributeLevelLimit(level);\n" +
"   for(const key of (expert?[profile.native,\"feet\",\"strength\"].filter(Boolean).slice(0,level):[profile.native].filter(Boolean))){for(let rank=2;rank<=target;rank++){\n" +
"    const token=(expert?\"worker\":level)+\":\"+key+\":\"+rank,upgrade=attributeUpgradeCost(key,rank).evolutionPoints;\n" +
"    if(expert&&!purchases.has(token)&&workers.length>=4)researchSaving=true;\n" +
"    if(!purchases.has(token)&&points>=upgrade+reserve+(expert?0:12)){points-=upgrade;spent+=upgrade;purchases.add(token);}\n" +
"   }}\n" +
"  }\n" +
"  if(now>=nextBirth&&units.length<NEST_LEVELS[level-1].unitCapacity&&(!researchSaving||workers.length<4)){\n" +
"   const army=now>=CONQUEST_PACING.neutralConflictAt*tempo&&workers.length>=workerGoal;\n" +
"   const count=army?young.length-workers.length:workers.length,target=army?goal-workerGoal:workerGoal;\n" +
"   if(count<target){const slots=(army?profile.army:expert?[profile.native,\"feet\",\"strength\"]:[profile.native,\"strength\",\"feet\"]).filter(Boolean).filter(key=>key!==\"carapace\"||level>=3).slice(0,level);\n" +
"    const levels=Object.fromEntries(slots.map(key=>[key,[...purchases].filter(token=>token.startsWith((expert?\"worker\":level)+\":\"+key+\":\")).length+1]));\n" +
"    const charge=birthCost({slots,attributeLevels:levels},tribe);\n" +
"    if(points>=charge&&(workers.length<4||points>=charge+reserve)){points-=charge;spent+=charge;make(slots,levels,army?\"military\":\"worker\",now);nextBirth=now+(expert?2:basic?6:CONQUEST_PACING.productionInterval);}\n" +
"   }\n" +
"  }\n" +
"  if(now%60===0)history.push({seconds:now,level,points:Math.round(points),workers:units.filter(unit=>unit.role===\"worker\").length,military:units.filter(unit=>unit.role===\"military\").length});\n" +
"  if(level===4&&now>=CONQUEST_PACING.aiLevelFourAt&&!basic)break;\n" +
" }\n" +
" return {tribe,policy,distance,milestones,history,delivered,spent,points,workers:units.filter(unit=>unit.role===\"worker\").length,military:units.filter(unit=>unit.role===\"military\").length,\n" +
"  conditions:{materialAccess:1,lateDistanceMultiplier:expert?.55:.7}};\n" +
"}\n" +
"\n" +
"return { colonyWorkerRate, simulateConquestBuild };\n" +
"})();\n" +
"const map = modules[\"server/map.mjs\"];\n" +
"globalThis.SpawnerDesignWorld = { ...map, ...modules[\"server/conquest-pacing.mjs\"], ...modules[\"server/nests.mjs\"], ...modules[\"server/attributes.mjs\"], ...modules[\"server/tribe-production.mjs\"], ...modules[\"server/conquest-economy.mjs\"], ENCOUNTER_PLANS:map.ENCOUNTER_PLANS.map(modules[\"server/conquest-pacing.mjs\"].conquestEncounterPlan), generateWorld: (seed, onProgress) => map.generateMapWorld(seed, onProgress, undefined, true) };\n" +
"})();\n" +
"</script>\n" +
"  <script id=\"design-world-view\" type=\"text/plain\">\n" +
"(() => {\n" +
"  const { SIZE, NEST_SAFE_RADIUS, ENCOUNTER_PLANS, generateWorld } = globalThis.SpawnerDesignWorld;\n" +
"  const root = document.getElementById('world-map-preview');\n" +
"  const seedInput = root.querySelector('#map-seed'), canvas = root.querySelector('#map-canvas');\n" +
"  const campColors = ['#b3dcca', '#d7a7e2', '#f0c06e', '#8ac8e5'];\n" +
"  let world = null, drawing = false, generating = false, selectedLayer = '', selectedResource = '', selectedUnit = '', logicLayer = '', showGrid = false, showWater = false, showResources = false, selectedWater = '';\n" +
"  const mountainGrounds = new Map([['low-mountain', 6], ['high-mountain', 7], ['ridge', 8]].map(([name, type]) => {\n" +
"    const image = new Image(); image.addEventListener('load', scheduleDraw); image.src = globalThis.SpawnerDesignPreviews['DesignAssets/Terrain/' + name + '-ground.png']; return [type, image];\n" +
"  }));\n" +
"  let selectedPlacementMap = '';\n" +
"  const placementImages = new WeakMap();\n" +
"  const forestLayer = root.querySelector('button[data-layer=\"forest\"]');\n" +
"  const forestLogic = root.querySelector('button[data-logic=\"swamp\"]').cloneNode(true);\n" +
"  forestLogic.dataset.logic = 'forest'; forestLogic.removeAttribute('aria-label');\n" +
"  forestLayer.id = 'map-forest-layer'; forestLogic.id = 'map-forest-logic'; forestLogic.setAttribute('aria-labelledby', forestLayer.id + ' ' + forestLogic.id);\n" +
"  forestLayer.parentElement.appendChild(forestLogic);\n" +
"  const campSelect = root.querySelector('#map-camp-type');\n" +
"  const resourceSelect = root.querySelector('#map-resource-type');\n" +
"  const waterSelect = root.querySelector('#map-water-type'), resourceLegend = root.querySelector('#map-resource-key');\n" +
"  const waterColors = { river: '#4cacc0', lake: '#416d9a', ford: '#edce8c', water: '#28465c' };\n" +
"  const waterNames = { river: '강', lake: '호수', ford: '여울', water: '물' };\n" +
"  const resourceColors = { tree: '#8fb86d', dew: '#bce7f1', clay: '#d99d66', pebbles: '#d7d9d2', 'honey-mushrooms': '#d6a0b3' };\n" +
"  function waterKind(index) {\n" +
"    if (world.terrain[index] === 10) return 'ford';\n" +
"    if (world.hydrology?.water[index] === 1) return 'river';\n" +
"    if (world.hydrology?.water[index] === 2) return 'lake';\n" +
"    return world.terrain[index] < 2 ? 'water' : '';\n" +
"  }\n" +
"  const resourceAliases = { 'basic-mushroom': 'honey-mushrooms', wood: 'tree' };\n" +
"  const resourceNames = new Map();\n" +
"  function resourceNodes() { return world ? [...world.food, ...world.resources] : []; }\n" +
"  function resourceVisible(point) {\n" +
"    return showResources && (!selectedResource || point[3] === resourceKey(selectedResource));\n" +
"  }\n" +
"  function resourceKey(key) { return resourceAliases[key] || key; }\n" +
"  function resourceArea(key) { return world?.resourceAreas?.[key === 'tree' ? 'wood' : key]; }\n" +
"  function updateResourceMenu() {\n" +
"    const counts = new Map();\n" +
"    for (const point of resourceNodes()) counts.set(point[3], (counts.get(point[3]) || 0) + 1);\n" +
"    resourceLegend.replaceChildren();\n" +
"    for (const [key, count] of counts) {\n" +
"      if (selectedResource && key !== resourceKey(selectedResource)) continue;\n" +
"      const entry = document.createElement('span'), swatch = document.createElement('i');\n" +
"      swatch.className = 'map-swatch'; swatch.style.setProperty('--swatch', resourceColors[key] || '#d4bc7d');\n" +
"      entry.append(swatch, document.createTextNode(resourceNames.get(key) || key));\n" +
"      entry.title = (resourceNames.get(key) || key) + ' · ' + count.toLocaleString() + '곳'; resourceLegend.appendChild(entry);\n" +
"    }\n" +
"    resourceLegend.hidden = !showResources;\n" +
"    for (const option of resourceSelect.options) {\n" +
"      if (!option.value) continue;\n" +
"      const area = resourceArea(resourceKey(option.value));\n" +
"      option.textContent = resourceNames.get(resourceKey(option.value)) + ' (' +\n" +
"        (area ? area.length.toLocaleString() + '칸 · ' + (100 * area.length / (SIZE * SIZE)).toFixed(2) + '%' : (counts.get(resourceKey(option.value)) || 0) + '곳') + ')';\n" +
"    }\n" +
"  }\n" +
"  function initializeResourceMenu() {\n" +
"    document.querySelectorAll('#art-food tbody > tr').forEach(row => {\n" +
"      const option = document.createElement('option'), title = row.querySelector('th[scope=\"row\"]').cloneNode(true);\n" +
"      title.querySelectorAll('small,br').forEach(item => item.remove());\n" +
"      option.textContent = title.textContent.trim();\n" +
"      option.value = row.dataset.resource || option.textContent;\n" +
"      resourceNames.set(resourceKey(option.value), option.textContent);\n" +
"      resourceSelect.appendChild(option);\n" +
"    });\n" +
"    updateResourceMenu();\n" +
"  }\n" +
"  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeResourceMenu, { once: true });\n" +
"  else initializeResourceMenu();\n" +
"  const unitSelect = root.querySelector('#map-unit-type');\n" +
"  for (const plan of ENCOUNTER_PLANS) {\n" +
"    const option = document.createElement('option');\n" +
"    option.value = plan.key; option.textContent = plan.badge + ' ' + plan.name; unitSelect.appendChild(option);\n" +
"  }\n" +
"  const ruleRows = document.getElementById('map-encounter-rule-rows');\n" +
"  for (const plan of ENCOUNTER_PLANS) {\n" +
"    const row = document.createElement('tr'); row.dataset.unitRule = plan.key;\n" +
"    for (const [index, value] of [plan.badge + ' ' + plan.name, plan.spawn + (plan.guaranteedAt ? ' 늦어도 게임 ' + plan.guaranteedAt + '에 등장한다.' : ''), plan.population, plan.respawn].entries()) {\n" +
"      const cell = document.createElement(index ? 'td' : 'th');\n" +
"      if (!index) cell.scope = 'row'; cell.textContent = value; row.appendChild(cell);\n" +
"    }\n" +
"    ruleRows.appendChild(row);\n" +
"  }\n" +
"  function visibleEncounters() { return world.encounters.filter(item => !selectedUnit || item.key === selectedUnit); }\n" +
"  const probe = document.createElement('span'); probe.hidden = true; root.appendChild(probe);\n" +
"  function color(value) { probe.style.color = value; return getComputedStyle(probe).color; }\n" +
"  function placementCaption(field) {\n" +
"    if(field.schemaVersion>=33&&field.id==='terrain:roughness')return '대륙 노이즈맵';\n" +
"    if(field.schemaVersion>=33){\n" +
"      const names={'relief:uplift':'융기 노이즈맵','relief:uplift-rate':'융기량','geology:bedrock-noise':'침식 저항 노이즈맵','geology:resistance':'침식 저항값',\n" +
"        'habitat:soilDepth':'뿌리 정착 적합도','habitat:drainage-height':'배수로 대비 고도','hydrology:fines':'가는 퇴적물','hydrology:cover':'퇴적물 두께',\n" +
"        'hydrology:bank-gravel':'강변 자갈 노출도','hydrology:river-width':'강폭','hydrology:river-depth':'수로 수심','hydrology:river-velocity':'유속'};\n" +
"      if(names[field.id])return names[field.id];\n" +
"      if(field.resource&&field.stage==='original'&&field.id.endsWith(':suitability'))return resourceNames.get(field.resource)+' · 노이즈맵';\n" +
"    }\n" +
"    const names = {\n" +
"      'terrain:roughness': '지형 요철', 'geology:bedrock-noise': '암질 변이', 'terrain:basement': '기반 고도',\n" +
"      'relief:uplift': '융기량', 'relief:height': '초기 고도', 'hydrology:ground': '침식 후 고도',\n" +
"      'hydrology:surface': '배수 보정 고도', 'hydrology:pond-depth': '저류 깊이', 'hydrology:sea-depth': '해수면 대비 깊이',\n" +
"      'hydrology:rainfall': '강수량', 'hydrology:flow': '유량', 'hydrology:sediment': '퇴적물', 'hydrology:slope': '경사',\n" +
"      'hydrology:wetness': '수변 습윤도', 'hydrology:fertility': '퇴적 비옥도', 'hydrology:gravel': '자갈 퇴적', 'hydrology:sand': '모래 퇴적',\n" +
"      'river:basins': '유역', 'river:source-score': '수원 점수', 'hydrology:ford-candidates': '여울 후보 점수',\n" +
"      'habitat:rainfall': '정규화 강수량', 'habitat:soilMoisture': '토양 수분', 'habitat:soilDepth': '토심',\n" +
"      'habitat:soilFertility': '토양 비옥도', 'habitat:forestCover': '수관 밀도', 'habitat:exposure': '노출도',\n" +
"      'habitat:parentRock': '암질', 'habitat:sandySoil': '사질도', 'habitat:shelter': '지형 보호',\n" +
"      'habitat:terrainPosition': '주변 대비 고도', 'habitat:topographicWetness': '집수 습윤도', 'habitat:hillslope-flow': '사면 유량', 'habitat:mountain-distance': '산지 거리',\n" +
"      'biome:forest-score': '숲 적합도', 'biome:swamp-score': '늪 적합도',\n" +
"      'terrain:mountains': '산지', 'hydrology:shore': '해안', 'hydrology:water': '물', 'hydrology:river': '강',\n" +
"      'hydrology:lake': '호수', 'hydrology:ford': '여울', 'biome:forest-mask': '숲', 'biome:swamp-mask': '늪',\n" +
"      'camp:available': '둥지 후보', 'camp:footprint-mask': '둥지 부지', 'camp:starts': '초기 둥지', 'resource:amount': '자원량', 'unit:habitat': '서식지', 'unit:spawn': '등장 위치'\n" +
"    };\n" +
"    let name = names[field.id];\n" +
"    if (!name && field.id.startsWith('resource:')) name = field.id.endsWith(':suitability') ? '자원 적합도' :\n" +
"      field.id.endsWith(':probability') ? '배치 확률' : field.id.endsWith(':amount') ? '자원량' : '개별 위치 추첨';\n" +
"    if (!name && field.id.startsWith('camp-score:')) name = '자원 접근 점수';\n" +
"    if (!name && field.id.startsWith('camp-travel:')) name = '이동 비용';\n" +
"    if (!name && field.id.startsWith('unit:')) name = field.id.endsWith(':habitat') ? '서식지' :\n" +
"      field.id.endsWith(':spawn') ? '등장 위치' : field.id.endsWith(':sector-priority') ? '구역별 추첨' : '개별 위치 추첨';\n" +
"    if (!name && field.id.startsWith('burrow:')) name = field.id.endsWith(':priority') ? '개별 위치 추첨' : '굴 위치';\n" +
"    const target = field.resource ? resourceNames.get(field.resource) : field.camp ? world.camps.find(camp => camp.id === field.camp)?.name :\n" +
"      field.unit ? world.encounters.find(unit => unit.key === field.unit)?.name || unitSelect.querySelector('option[value=\"' + field.unit + '\"]')?.textContent.replace(/ \\(.*/, '') : '';\n" +
"    return (target ? target + ' · ' : '') + (name || field.id);\n" +
"  }\n" +
"  function placementReason(field) {\n" +
"    if(field.schemaVersion>=33)return '';\n" +
"    if (field.id === 'terrain:roughness') return '지형 요철은 같은 고도 지형의 굴곡에만 쓰인다.';\n" +
"    if (field.id === 'geology:bedrock-noise') return '암질 변이는 침식 저항·토양·광맥의 차이에 쓰인다.';\n" +
"    if (field.stage === 'original' && /:draw$|:priority$|sector-priority/.test(field.id)) return '추첨은 적합한 칸 안에서만 위치를 고른다.';\n" +
"    return '';\n" +
"  }\n" +
"  function placementMaps() {\n" +
"    if (!world || logic.hidden || !logicLayer) return [];\n" +
"    const resource = resourceKey(selectedResource), camp = Number(campSelect.value.replace('camp-', ''));\n" +
"    const unit = selectedLayer.startsWith('burrow-') ? selectedLayer : selectedUnit;\n" +
"    const maps = (world.hydrology?.placementMaps || []).filter(field => field.layers.includes(logicLayer) &&\n" +
"      (logicLayer !== 'resources' || (!field.resource || field.resource === resource || field.appliesTo?.includes(resource)) && (!resource || field.scope !== 'all')) &&\n" +
"      (logicLayer !== 'camps' || !camp || !field.camp || field.camp === camp) &&\n" +
"      (logicLayer !== 'units' || (unit ? field.unit === unit : !field.unit)) &&\n" +
"      (logicLayer !== 'water' || !selectedWater || !field.water || field.water === selectedWater));\n" +
"    for (const field of maps) { field.caption = placementCaption(field); field.reason = placementReason(field); }\n" +
"    return maps;\n" +
"  }\n" +
"  function activePlacementMap() {\n" +
"    const maps = placementMaps();\n" +
"    let field = maps.find(item => item.id === selectedPlacementMap);\n" +
"    if (!field && maps.length) {\n" +
"      const preferred = { mountains: world.hydrology?.generationVersion>=33?'hydrology:ground':'relief:height', forest: 'biome:forest-score', swamp: 'biome:swamp-score',\n" +
"        water: selectedWater ? 'hydrology:' + selectedWater : 'hydrology:flow',\n" +
"        resources: selectedResource ? 'resource:' + resourceKey(selectedResource) + ':suitability' : 'habitat:soilFertility',\n" +
"        camps: campSelect.value ? 'camp-score:' + Number(campSelect.value.replace('camp-', '')) : 'camp:available',\n" +
"        units: selectedLayer.startsWith('burrow-') ? 'burrow:' + selectedLayer.replace('burrow-', '') : selectedUnit ? 'unit:' + selectedUnit + ':habitat' : 'unit:habitat' };\n" +
"      field = maps.find(item => item.id === preferred[logicLayer]) || maps[0]; selectedPlacementMap = field.id;\n" +
"    }\n" +
"    return field;\n" +
"  }\n" +
"  function placementImage(field) {\n" +
"    if (placementImages.has(field)) return placementImages.get(field);\n" +
"    if (!field.values) {\n" +
"      const image = document.createElement('canvas'); image.width = SIZE; image.height = SIZE;\n" +
"      const result = { image, minimum: field.minimum ?? 0, maximum: field.maximum ?? 1 };\n" +
"      placementImages.set(field, result);\n" +
"      const current = world;\n" +
"      globalThis.SpawnerDesignWorld.loadValues(current.seed, field.id).then(values => {\n" +
"        field.values = values; placementImages.delete(field);\n" +
"        if (world === current) { logic.dataset.context = ''; scheduleDraw(); }\n" +
"      }).catch(() => placementImages.delete(field));\n" +
"      return result;\n" +
"    }\n" +
"    let minimum = Infinity, maximum = -Infinity;\n" +
"    for (const value of field.values) if (Number.isFinite(value) && value !== field.excluded) {\n" +
"      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);\n" +
"    }\n" +
"    minimum = field.minimum ?? minimum; maximum = field.maximum ?? maximum;\n" +
"    if (!Number.isFinite(minimum)) minimum = 0;\n" +
"    if (!Number.isFinite(maximum)) maximum = minimum;\n" +
"    const image = document.createElement('canvas'); image.width = SIZE; image.height = SIZE;\n" +
"    const context = image.getContext('2d'), pixels = context.createImageData(SIZE, SIZE);\n" +
"    const transform = value => field.logarithmic ? Math.log1p(Math.max(0, value)) : value;\n" +
"    const low = transform(minimum), span = transform(maximum) - low;\n" +
"    for (let index = 0; index < field.values.length; index++) {\n" +
"      const value = field.values[index], pixel = index * 4;\n" +
"      const valid = Number.isFinite(value) && value !== field.excluded;\n" +
"      let rgb = [22, 26, 34];\n" +
"      if (valid) {\n" +
"        if (field.categorical) {\n" +
"          if (field.id === 'hydrology:water') rgb = [[22,26,34],[76,172,192],[65,109,154],[38,63,80]][value] || rgb;\n" +
"          else { const tint = (Math.imul(value + 1, 2654435761) >>> 0); rgb = [72 + (tint & 127), 72 + (tint >>> 8 & 127), 72 + (tint >>> 16 & 127)]; }\n" +
"        } else { const tone = Math.round(255 * Math.max(0, Math.min(1, span ? (transform(value) - low) / span : 0))); rgb = [tone, tone, tone]; }\n" +
"      }\n" +
"      pixels.data[pixel] = rgb[0]; pixels.data[pixel + 1] = rgb[1]; pixels.data[pixel + 2] = rgb[2]; pixels.data[pixel + 3] = 255;\n" +
"    }\n" +
"    context.putImageData(pixels, 0, 0);\n" +
"    const result = { image, minimum, maximum }; placementImages.set(field, result); return result;\n" +
"  }\n" +
"  function placementChoices() {\n" +
"    const maps = placementMaps(), active = activePlacementMap();\n" +
"    if (!active) return;\n" +
"    const list = document.createElement('div');\n" +
"    for (const [stage, title] of [['original', '원본'], ['intermediate', '중간'], ['final', '최종']]) {\n" +
"      const members = maps.filter(field => field.stage === stage); if (!members.length) continue;\n" +
"      const group = document.createElement('section'), heading = document.createElement('h4'), gallery = document.createElement('div');\n" +
"      group.className = 'map-placement-group'; group.dataset.stage = stage; heading.textContent = title; gallery.className = 'map-placement-list';\n" +
"      for (const field of members) {\n" +
"        const index = maps.indexOf(field), button = document.createElement('button'), thumbnail = document.createElement('canvas'), number = document.createElement('span');\n" +
"        const preview = placementImage(field); thumbnail.width = 96; thumbnail.height = 96;\n" +
"        thumbnail.getContext('2d').drawImage(preview.image, 0, 0, 96, 96); thumbnail.setAttribute('aria-hidden', 'true');\n" +
"        number.textContent = String(index + 1); number.className = 'map-placement-number'; button.type = 'button'; button.className = 'map-placement-choice'; button.dataset.placement = field.id;\n" +
"        button.setAttribute('aria-pressed', String(field === active)); button.append(thumbnail);\n" +
"        if (field.caption) { const caption = document.createElement('span'); caption.className = 'map-placement-caption'; caption.textContent = field.caption; button.appendChild(caption); }\n" +
"        button.addEventListener('click', () => { const top = logic.scrollTop; selectedPlacementMap = field.id; logic.dataset.context = ''; updateLogic(); logic.scrollTop = top; logic.querySelector('[data-placement=\"' + field.id + '\"]').focus({ preventScroll: true }); scheduleDraw(); }); gallery.appendChild(button);\n" +
"      }\n" +
"      group.append(heading, gallery); list.appendChild(group);\n" +
"    }\n" +
"    if (active.reason) { const reason = document.createElement('p'); reason.textContent = active.reason; list.prepend(reason); }\n" +
"    if (active.caption) { const heading = document.createElement('h4'); heading.textContent = active.caption; list.prepend(heading); }\n" +
"    const scale = document.createElement('div'), low = document.createElement('span'), high = document.createElement('span');\n" +
"    const preview = placementImage(active); scale.className = 'map-placement-scale';\n" +
"    if (active.categorical) scale.style.background = 'none';\n" +
"    low.textContent = Number(preview.minimum.toPrecision(6)).toLocaleString(); high.textContent = Number(preview.maximum.toPrecision(6)).toLocaleString();\n" +
"    scale.append(low, high); list.insertBefore(scale, list.querySelector('.map-placement-group')); logicBody.prepend(list);\n" +
"  }\n" +
"  function draw() {\n" +
"    drawing = false;\n" +
"    if (!world || !document.getElementById('world').classList.contains('is-page-active')) return;\n" +
"    const headerHeight = document.querySelector('header').getBoundingClientRect().height + 'px';\n" +
"    if (document.documentElement.style.getPropertyValue('--map-header-height') !== headerHeight) document.documentElement.style.setProperty('--map-header-height', headerHeight);\n" +
"    root.style.setProperty('--map-room', Math.max(1, innerHeight - root.getBoundingClientRect().top - 16) + 'px');\n" +
"    const width = Math.max(160, canvas.getBoundingClientRect().width), ratio = Math.min(2, devicePixelRatio || 1);\n" +
"    canvas.width = Math.round(width * ratio); canvas.height = Math.round(width * ratio);\n" +
"    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);\n" +
"    logic.style.maxHeight = width + 'px';\n" +
"    const gutter = 24, cell = (width - gutter * 2) / SIZE;\n" +
"    const px = x => gutter + (x + 0.5) * cell, py = y => gutter + (y + 0.5) * cell;\n" +
"    const ink = color('var(--ink)'), paper = color('var(--paper)'), line = color('var(--line)');\n" +
"    const palette = ['#263f50', '#345667', '#77724e', '#504b37', '#3d5447', '#34271e', '#263029', '#374139', '#4b554c', '#56562b', '#73918a'];\n" +
"    const resourceColor = '#d4bc7d', hazardColors = ['', '#b7c928'];\n" +
"    function drawTerrainCell(x, y, type) {\n" +
"      const left = gutter + x * cell, top = gutter + y * cell;\n" +
"      const water = world.hydrology?.water[y * SIZE + x];\n" +
"      ctx.fillStyle = type < 2 && water === 1 ? '#386e80' : type < 2 && water === 2 ? '#3c5d7d' : palette[type]; ctx.fillRect(left, top, cell + 0.5, cell + 0.5);\n" +
"      const ground = mountainGrounds.get(type);\n" +
"      if (!ground?.complete || !ground.naturalWidth) return;\n" +
"      const sourceCell = ground.naturalWidth / 4;\n" +
"      ctx.save(); ctx.globalAlpha = 0.72;\n" +
"      ctx.drawImage(ground, x % 4 * sourceCell, y % 4 * sourceCell, sourceCell, sourceCell, left, top, cell + 0.5, cell + 0.5); ctx.restore();\n" +
"    }\n" +
"    ctx.save(); ctx.beginPath(); ctx.rect(gutter, gutter, width - gutter * 2, width - gutter * 2); ctx.clip();\n" +
"    const placement = activePlacementMap(); root.dataset.placementMap = placement?.id || '';\n" +
"    if (placement) {\n" +
"      ctx.imageSmoothingEnabled = false;\n" +
"      ctx.drawImage(placementImage(placement).image, gutter, gutter, width - gutter * 2, width - gutter * 2);\n" +
"    } else {\n" +
"    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {\n" +
"      const index = y * SIZE + x;\n" +
"      drawTerrainCell(x, y, world.terrain[index]);\n" +
"      if (world.hydrology?.forestMask?.[index] && world.terrain[index] !== 5) { ctx.fillStyle = palette[5]; ctx.globalAlpha = .65; ctx.fillRect(gutter + x * cell, gutter + y * cell, cell + .5, cell + .5); ctx.globalAlpha = 1; }\n" +
"      if (world.hazards[index] === 1) { ctx.fillStyle = hazardColors[world.hazards[index]]; ctx.globalAlpha = 0.65; ctx.fillRect(gutter + x * cell, gutter + y * cell, cell + 0.5, cell + 0.5); ctx.globalAlpha = 1; }\n" +
"    }\n" +
"    ctx.strokeStyle = line; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.5;\n" +
"    for (let value = 0; value <= SIZE; value += 16) {\n" +
"      ctx.beginPath(); ctx.moveTo(gutter + value * cell, gutter); ctx.lineTo(gutter + value * cell, width - gutter); ctx.stroke();\n" +
"      ctx.beginPath(); ctx.moveTo(gutter, gutter + value * cell); ctx.lineTo(width - gutter, gutter + value * cell); ctx.stroke();\n" +
"    }\n" +
"    ctx.strokeStyle = ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;\n" +
"    if (showGrid) for (const value of [80, 160, 240]) {\n" +
"      ctx.beginPath(); ctx.moveTo(px(value), gutter); ctx.lineTo(px(value), width - gutter); ctx.stroke();\n" +
"      ctx.beginPath(); ctx.moveTo(gutter, py(value)); ctx.lineTo(width - gutter, py(value)); ctx.stroke();\n" +
"    }\n" +
"    ctx.globalAlpha = 1;\n" +
"    function points(entries, emphasis) {\n" +
"      ctx.strokeStyle = paper; ctx.lineWidth = .7;\n" +
"      for (const point of entries) {\n" +
"        const [x, y] = point;\n" +
"        ctx.fillStyle = resourceColors[point[3]] || resourceColor;\n" +
"        const size = emphasis ? Math.max(1, cell * .65) : Math.max(.5, cell * .42);\n" +
"        ctx.fillRect(px(x) - size, py(y) - size, size * 2, size * 2);\n" +
"        if (emphasis) ctx.strokeRect(px(x) - size - 1, py(y) - size - 1, size * 2 + 2, size * 2 + 2);\n" +
"      }\n" +
"    }\n" +
"    function burrows(type, emphasis) {\n" +
"      ctx.save();\n" +
"      for (const item of world.burrows) {\n" +
"        if (type && item.type !== type) continue;\n" +
"        const large = item.type === 'large', x = px(item.x + (item.width - 1) / 2), y = py(item.y);\n" +
"        const w = Math.max(item.width * cell, large ? 12 : 6) + (emphasis ? 4 : 0), h = (large ? 7 : 5) + (emphasis ? 3 : 0);\n" +
"        ctx.fillStyle = large ? '#e28b71' : '#d6b478'; ctx.strokeStyle = paper; ctx.lineWidth = emphasis ? 2 : 1;\n" +
"        ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y);\n" +
"        ctx.quadraticCurveTo(x, y - h, x + w / 2, y); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();\n" +
"        ctx.fillStyle = paper; ctx.beginPath(); ctx.ellipse(x, y + h * 0.12, w * 0.17, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();\n" +
"        if (emphasis) {\n" +
"          ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, w / 2 + 3, h + 2, 0, 0, Math.PI * 2); ctx.stroke();\n" +
"        }\n" +
"      }\n" +
"      ctx.restore();\n" +
"    }\n" +
"\n" +
"    function encounters(emphasis) {\n" +
"      const entries = emphasis ? visibleEncounters() : world.encounters;\n" +
"      for (const item of entries) {\n" +
"        ctx.save(); ctx.fillStyle = item.color; ctx.globalAlpha = emphasis ? .2 : .08;\n" +
"        for (const index of item.cells) ctx.fillRect(gutter + index % SIZE * cell, gutter + Math.floor(index / SIZE) * cell, cell + .3, cell + .3);\n" +
"        ctx.globalAlpha = emphasis ? .9 : .3; ctx.strokeStyle = item.color; ctx.lineWidth = emphasis ? 1.5 : .7;\n" +
"        ctx.beginPath();\n" +
"        for (const [x1, y1, x2, y2] of item.boundary) { ctx.moveTo(gutter + x1 * cell, gutter + y1 * cell); ctx.lineTo(gutter + x2 * cell, gutter + y2 * cell); }\n" +
"        ctx.stroke(); ctx.globalAlpha = emphasis ? 1 : .65;\n" +
"        if (item.route.length) {\n" +
"          ctx.lineWidth = emphasis ? 2.5 : 1.2; ctx.setLineDash([5, 3]); ctx.beginPath();\n" +
"          item.route.forEach((index, step) => { const x = px(index % SIZE), y = py(Math.floor(index / SIZE)); if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y); });\n" +
"          ctx.stroke(); ctx.setLineDash([]);\n" +
"        }\n" +
"        ctx.restore();\n" +
"      }\n" +
"      for (const item of entries) for (const index of item.spawnPoints || [item.y * SIZE + item.x]) {\n" +
"        const x = px(index % SIZE), y = py(Math.floor(index / SIZE)), radius = item.spawnPoints ? (emphasis && selectedUnit ? 6 : 3) : item.unique ? 11 : 9;\n" +
"        ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = paper; ctx.strokeStyle = item.color; ctx.lineWidth = item.unique ? 2 : 1.5;\n" +
"        ctx.beginPath();\n" +
"        if (item.unique) for (let step = 0; step < 10; step++) {\n" +
"          const angle = step * Math.PI / 5 - Math.PI / 2, reach = step % 2 ? radius * .65 : radius + 3;\n" +
"          const sx = x + Math.cos(angle) * reach, sy = y + Math.sin(angle) * reach;\n" +
"          if (step) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);\n" +
"        }\n" +
"        else ctx.arc(x, y, radius, 0, Math.PI * 2);\n" +
"        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = item.color;\n" +
"        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 10px sans-serif';\n" +
"        if (!item.spawnPoints || emphasis && selectedUnit) ctx.fillText(item.unique ? item.badge.slice(1) : item.badge, x, y + .5);\n" +
"        if (emphasis && selectedUnit && !item.spawnPoints) {\n" +
"          const label = item.name + ' · ' + item.kind, right = x < width / 2;\n" +
"          ctx.textAlign = right ? 'left' : 'right'; ctx.font = '700 12px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = paper;\n" +
"          ctx.strokeText(label, x + (right ? 17 : -17), y - 17); ctx.fillText(label, x + (right ? 17 : -17), y - 17);\n" +
"        }\n" +
"        ctx.restore();\n" +
"      }\n" +
"    }\n" +
"    function camp(camp, emphasis) {\n" +
"      const x = px(camp.x), y = py(camp.y), size = emphasis ? Math.min(15, NEST_SAFE_RADIUS * cell * 0.6) : 11, tone = campColors[camp.id - 1];\n" +
"      ctx.save(); ctx.fillStyle = paper; ctx.beginPath(); ctx.arc(x, y, size + 4, 0, Math.PI * 2); ctx.fill();\n" +
"      if (emphasis) ranges([camp], true);\n" +
"      ctx.fillStyle = tone; ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); ctx.fill();\n" +
"      ctx.fillStyle = paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 12px sans-serif'; \n" +
"      const right = x < width - gutter - 75;\n" +
"      ctx.textAlign = right ? 'left' : 'right'; ctx.fillStyle = tone; ctx.strokeStyle = paper; ctx.lineWidth = 3;\n" +
"      ctx.strokeText(camp.name, x + (right ? size + 7 : -size - 7), y);\n" +
"      ctx.fillText(camp.name, x + (right ? size + 7 : -size - 7), y); ctx.restore();\n" +
"    }\n" +
"    function ranges(camps, emphasis) {\n" +
"      ctx.save(); ctx.globalAlpha = emphasis ? 1 : 0.5; ctx.lineWidth = emphasis ? 2 : 1; ctx.setLineDash([4, 5]);\n" +
"      for (const camp of camps) { ctx.strokeStyle = campColors[camp.id - 1]; ctx.beginPath(); ctx.arc(px(camp.x), py(camp.y), NEST_SAFE_RADIUS * cell, 0, Math.PI * 2); ctx.stroke(); }\n" +
"      ctx.restore();\n" +
"    }\n" +
"    ranges(world.camps, false);\n" +
"    if (selectedLayer) {\n" +
"      ctx.fillStyle = paper; ctx.globalAlpha = 0.76; ctx.fillRect(gutter, gutter, width - gutter * 2, width - gutter * 2); ctx.globalAlpha = 1;\n" +
"      if (selectedLayer === 'camps') for (const item of world.camps) camp(item, true);\n" +
"      else if (selectedLayer.startsWith('camp-')) { const item = world.camps.find(camp => selectedLayer === 'camp-' + camp.id); if (item) camp(item, true); }\n" +
"      else if (selectedLayer === 'burrow-small') burrows('small', true);\n" +
"      else if (selectedLayer === 'burrow-large') burrows('large', true);\n" +
"      else if (selectedLayer === 'units') { burrows('', true); encounters(true); }\n" +
"      else for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {\n" +
"        const index = y * SIZE + x, terrain = world.terrain[index];\n" +
"        if (selectedLayer === 'forest' ? !(world.hydrology?.forestMask?.[index] || terrain === 5) :\n" +
"            selectedLayer === 'swamp' ? terrain !== 9 : selectedLayer === 'mountains' ? terrain < 6 || terrain > 8 :\n" +
"            selectedLayer !== 'poison-spore' || world.hazards[index] !== 1) continue;\n" +
"        if (selectedLayer === 'mountains') drawTerrainCell(x, y, terrain);\n" +
"        else { ctx.fillStyle = selectedLayer === 'forest' ? palette[5] : selectedLayer === 'poison-spore' ? hazardColors[world.hazards[index]] : palette[terrain]; ctx.fillRect(gutter + x * cell, gutter + y * cell, cell + 0.5, cell + 0.5); }\n" +
"        ctx.fillStyle = ink; ctx.globalAlpha = 0.14; ctx.fillRect(gutter + x * cell, gutter + y * cell, cell + 0.5, cell + 0.5); ctx.globalAlpha = 1;\n" +
"      }\n" +
"      if (['swamp', 'poison-spore'].includes(selectedLayer)) {\n" +
"        if (selectedLayer === 'swamp') {\n" +
"          const kind = 1;\n" +
"          ctx.fillStyle = hazardColors[kind]; ctx.globalAlpha = 0.65;\n" +
"          for (let index = 0; index < world.hazards.length; index++) if (world.hazards[index] === kind) {\n" +
"            ctx.fillRect(gutter + index % SIZE * cell, gutter + Math.floor(index / SIZE) * cell, cell + 0.5, cell + 0.5);\n" +
"          }\n" +
"          ctx.globalAlpha = 1;\n" +
"        }\n" +
"\n" +
"      }\n" +
"    }\n" +
"    if (showWater) {\n" +
"      for (let index = 0; index < world.terrain.length; index++) {\n" +
"        const kind = waterKind(index);\n" +
"        if (!kind || selectedWater && kind !== selectedWater || kind === 'river' && world.hydrology?.channels) continue;\n" +
"        ctx.fillStyle = waterColors[kind];\n" +
"        ctx.fillRect(gutter + index % SIZE * cell, gutter + Math.floor(index / SIZE) * cell, cell + .5, cell + .5);\n" +
"      }\n" +
"      if ((!selectedWater || selectedWater === 'river') && world.hydrology?.channels) {\n" +
"        ctx.save(); ctx.strokeStyle = waterColors.river; ctx.lineCap = 'round'; ctx.lineJoin = 'round';\n" +
"        for (const channel of world.hydrology.channels) {\n" +
"          let previous = null;\n" +
"          for (const point of channel.points) {\n" +
"            const index = Math.floor(point.y) * SIZE + Math.floor(point.x);\n" +
"            if (waterKind(index) !== 'river') { previous = null; continue; }\n" +
"            if (previous) {\n" +
"              ctx.lineWidth = (previous.radius + point.radius) * cell;\n" +
"              ctx.beginPath(); ctx.moveTo(gutter + previous.x * cell, gutter + previous.y * cell);\n" +
"              ctx.lineTo(gutter + point.x * cell, gutter + point.y * cell); ctx.stroke();\n" +
"            }\n" +
"            previous = point;\n" +
"          }\n" +
"        }\n" +
"        ctx.restore();\n" +
"      }\n" +
"      if (!selectedWater || selectedWater === 'ford') {\n" +
"        ctx.strokeStyle = waterColors.ford; ctx.lineWidth = 1.3;\n" +
"        for (const ford of world.hydrology?.fords || []) {\n" +
"          ctx.beginPath(); ctx.arc(px(ford.x), py(ford.y), Math.max(3.5, cell * 2), 0, Math.PI * 2); ctx.stroke();\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"    if (showResources) points(resourceNodes().filter(resourceVisible), Boolean(selectedResource));\n" +
"    for (const item of world.camps) camp(item, false);\n" +
"    }\n" +
"    ctx.restore(); ctx.fillStyle = ink; ctx.font = '400 12px sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';\n" +
"    for (const value of [0, SIZE / 4, SIZE / 2, SIZE * 3 / 4, SIZE - 1]) ctx.fillText(String(value), px(value), 15);\n" +
"    for (const value of [0, SIZE / 4, SIZE / 2, SIZE * 3 / 4, SIZE - 1]) { ctx.save(); ctx.translate(12, py(value)); ctx.rotate(-Math.PI / 2); ctx.fillText(String(value), 0, 0); ctx.restore(); }\n" +
"    for (const type of ['small', 'large']) unitSelect.querySelector('option[value=\"burrow-' + type + '\"]').textContent = (type === 'small' ? '작은 굴' : '큰 굴') + ' (' + world.burrows.filter(item => item.type === type).length + ')';\n" +
"    root.querySelector('#map-unit-count').textContent = '(' + new Set(world.encounters.map(item => item.key)).size + '/19)';\n" +
"    for (const item of world.encounters) {\n" +
"      unitSelect.querySelector('option[value=\"' + item.key + '\"]').textContent = item.badge + ' ' + item.name + ' (' + item.populationLimit + '마리)';\n" +
"      const row = ruleRows.querySelector('[data-unit-rule=\"' + item.key + '\"]');\n" +
"      row.children[2].textContent = item.populationLimit + '마리 · ' + item.cells.length.toLocaleString() + '칸 · ' + item.tilesPerUnit.toLocaleString() + '칸당 1마리';\n" +
"    }\n" +
"    const selectedName = selectedUnit ? ENCOUNTER_PLANS.find(item => item.key === selectedUnit).name : selectedResource ? resourceNames.get(resourceKey(selectedResource)) : selectedLayer.startsWith('camp-') ? world.camps.find(item => selectedLayer === 'camp-' + item.id).name : '';\n" +
"    canvas.setAttribute('aria-label', '시드 ' + world.seed + '의 플레이 진영 네 곳과 자원·굴·19종 등장 위치·활동 범위·지형' + (selectedName ? ' · ' + selectedName + ' 강조' : ''));\n" +
"    updateResourceMenu();\n" +
"    root.dataset.seed = String(world.seed); root.dataset.rendered = 'true';\n" +
"    root.mapPreview = world; updateLogic();\n" +
"  }\n" +
"  const logic = root.querySelector('#map-logic'), logicBody = root.querySelector('#map-logic-body');\n" +
"  function updateLogic() {\n" +
"    if (!world || logic.hidden || !logicLayer) return;\n" +
"    activePlacementMap();\n" +
"    const key = world.seed + ':' + logicLayer + ':' + selectedUnit + ':' + selectedLayer + ':' + selectedResource + ':' + selectedWater + ':' + selectedPlacementMap;\n" +
"    if (logic.dataset.context === key) return;\n" +
"    logic.dataset.context = key;\n" +
"    const count = type => world.burrows.filter(item => item.type === type).length;\n" +
"    const entries = {\n" +
"      resources: { title: '자원 배치', lines: [\n" +
"        ...world.economy.resources.map(item => resourceNames.get(item.key) + ': ' + item.cells.toLocaleString() + '칸 · 전체의 ' + (item.coverage * 100).toFixed(2) + '% · 총 ' + item.amount.toLocaleString() + '개'),\n" +
"        '전체 자원: ' + resourceNodes().length.toLocaleString() + '곳 · 총 ' + resourceNodes().reduce((sum, point) => sum + point[2], 0).toLocaleString() + '개'\n" +
"      ] },\n" +
"      'burrow-small': { title: '작은 굴 배치', lines: [\n" +
"        '현재 ' + count('small') + '개이며 작은 굴끼리는 최소 12칸을 띄웁니다.',\n" +
"        '등장 조건: 시작부터 굴에서 생성합니다.',\n" +
"        '개체 수: 굴당 초기 1마리 · 생존 상한 3마리',\n" +
"        '재등장 규칙: 120초마다 1마리 증식하며 굴 파괴 시 중단합니다.'\n" +
"      ] },\n" +
"      'burrow-large': { title: '큰 굴 배치', lines: [\n" +
"        '현재 ' + count('large') + '개이며 큰 굴이 포함되면 최소 22칸을 띄웁니다.',\n" +
"        '등장 조건: 시작부터 굴에서 생성하며, 우두머리는 별도 등장 기획을 따릅니다.',\n" +
"        '개체 수: 일반 딱정벌레 굴당 초기 3마리 · 생존 상한 6마리',\n" +
"        '재등장 규칙: 60초마다 1마리 증식하며 굴 파괴 시 중단합니다.'\n" +
"      ] },\n" +
"      water: { title: '강·호수·여울', lines: [\n" +
"        '강: ' + (world.hydrology?.water.filter(type => type === 1).length || 0).toLocaleString() + '칸',\n" +
"        '호수: ' + (world.hydrology?.water.filter(type => type === 2).length || 0).toLocaleString() + '칸',\n" +
"        '여울: ' + (world.hydrology?.fords.length || 0) + '곳',\n" +
"        '강: ' + (world.hydrology?.riverBasins?.length || 0) + ' · 지류: ' + Math.max(0, (world.hydrology?.headwaters?.length || 0) - (world.hydrology?.riverBasins?.length || 0)) + ' · 합류: ' + (world.hydrology?.confluences?.length || 0),\n" +
"        '물: ' + world.terrain.filter(type => type < 2 || type === 10).length.toLocaleString() + '칸'\n" +
"      ] },\n" +
"      forest: { title: '숲 배치', lines: [\n" +
"      ] },\n" +
"      mountains: { title: '산지 배치', lines: [\n" +
"        ...['낮은 산', '높은 산', '능선'].map((name, index) => name + ': ' + world.terrain.filter(type => type === index + 6).length.toLocaleString() + '칸'),\n" +
"        '산지 이동 속도는 일반 개체 60%, 비행 개체 100%입니다.',\n" +
"        '인게임은 아래 전용 바닥 텍스처를 지형색 위에 겹칩니다.'\n" +
"      ] },\n" +
"      swamp: { title: '늪', lines: [\n" +
"      ] },\n" +
"    };\n" +
"    for (const camp of world.camps) {\n" +
"      entries['camp-' + camp.id] = {\n" +
"        title: camp.name + ' 배치', lines: [\n" +
"          '가까운 자원까지 편도 ' + (world.economy?.starts?.[camp.id - 1]?.nearestSeconds ?? 0).toFixed(1) + '초',\n" +
"          '시작 자원권 ' + (world.economy?.starts?.[camp.id - 1]?.cells ?? 0) + '칸 · ' + (world.economy?.starts?.[camp.id - 1]?.amount ?? 0) + '개',\n" +
"        ]\n" +
"      };\n" +
"    }\n" +
"    entries.camps = entries[campSelect.value] || { title: '종족 배치', lines: entries['camp-1'].lines.slice(2) };\n" +
"    const encounter = world.encounters.find(item => item.key === selectedUnit);\n" +
"    entries.units = { title: encounter ? encounter.name + (encounter.implemented ? ' · 현행 규칙' : ' · 등장 기획') : '유닛 등장', lines: encounter ? [\n" +
"      encounter.badge + ' · 서식 가능 ' + encounter.cells.length.toLocaleString() + '칸',\n" +
"      '등장 조건: ' + encounter.spawn + (encounter.guaranteedAt ? ' 늦어도 게임 ' + encounter.guaranteedAt + '에 등장한다.' : ''),\n" +
"      '개체 수: ' + encounter.populationLimit + '마리 · 기준 ' + encounter.tilesPerUnit.toLocaleString() + '칸당 1마리',\n" +
"      '재등장 규칙: ' + encounter.respawn,\n" +
"      '실제 밀도: ' + (encounter.density * 1000).toFixed(2) + '마리 / 1,000칸'\n" +
"    ] : [\n" +
"      '일반 13종과 유니크 6종을 각 종의 서식 지형 전체에 분산합니다.',\n" +
"      '하위 종을 선택하면 해당 종의 위치·활동 범위만 강조합니다.',\n" +
"      '점은 일반 개체, 별은 유니크 개체입니다.',\n" +
"      '서식 가능 칸 수를 기준으로 개체 수를 계산합니다.',\n" +
"      '유니크는 일반 생물보다 낮은 밀도로 여러 마리 분산합니다.'\n" +
"    ] };\n" +
"    if (logicLayer === 'units' && selectedLayer.startsWith('burrow-')) entries.units = entries[selectedLayer];\n" +
"    const entry = entries[logicLayer] || { title: '배치 로직', lines: ['아직 정해진 배치 로직이 없습니다.'] };\n" +
"    root.querySelector('#map-logic-title').textContent = entry.title;\n" +
"    logicBody.replaceChildren(...entry.lines.map(line => { const paragraph = document.createElement('p'); paragraph.textContent = line; return paragraph; }));\n" +
"    placementChoices();\n" +
"    if (logicLayer === 'mountains') logicBody.appendChild(root.querySelector('#map-mountain-textures').content.cloneNode(true));\n" +
"  }\n" +
"\n" +
"  root.querySelector('#map-grid').addEventListener('click', event => {\n" +
"    showGrid = !showGrid; event.currentTarget.setAttribute('aria-pressed', String(showGrid)); scheduleDraw();\n" +
"  });\n" +
"  root.querySelectorAll('button[data-logic]').forEach(button => button.addEventListener('click', () => {\n" +
"    const open = logic.hidden || logicLayer !== button.dataset.logic;\n" +
"    logicLayer = button.dataset.logic; logic.hidden = !open; selectedPlacementMap = ''; \n" +
"    root.classList.toggle('show-logic', open);\n" +
"    root.querySelectorAll('button[data-logic]').forEach(item => item.setAttribute('aria-expanded', String(open && item.dataset.logic === logicLayer)));\n" +
"    updateLogic(); scheduleDraw();\n" +
"  }));\n" +
"  const foodNames = { 'honey-mushrooms': '버섯', 'tree-fruit': '나무 열매', 'berry-bush': '열매 덤불', 'seed-pods': '씨앗 꼬투리', 'root-bulbs': '뿌리 구근', 'nutrient-moss': '영양 이끼' };\n" +
"  function encounterAt(event) {\n" +
"    if (!world || selectedLayer !== 'units') return null;\n" +
"    const bounds = canvas.getBoundingClientRect(), cell = (bounds.width - 48) / SIZE;\n" +
"    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;\n" +
"    let nearest = null, minimum = 14;\n" +
"    for (const item of visibleEncounters()) for (const index of item.spawnPoints || [item.y * SIZE + item.x]) {\n" +
"      const distance = Math.hypot(x - 24 - (index % SIZE + .5) * cell, y - 24 - (Math.floor(index / SIZE) + .5) * cell);\n" +
"      if (distance < minimum) { minimum = distance; nearest = item; }\n" +
"    }\n" +
"    return nearest;\n" +
"  }\n" +
"  canvas.addEventListener('pointermove', event => {\n" +
"    if (!world) return;\n" +
"    const bounds = canvas.getBoundingClientRect(), cell = (bounds.width - 48) / SIZE;\n" +
"    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;\n" +
"    const placement = activePlacementMap();\n" +
"    if (placement) {\n" +
"      const column = Math.floor((x - 24) / cell), row = Math.floor((y - 24) / cell);\n" +
"      const value = column >= 0 && row >= 0 && column < SIZE && row < SIZE ? placement.values[row * SIZE + column] : NaN;\n" +
"      canvas.title = Number.isFinite(value) && value !== placement.excluded ? '(' + column + ', ' + row + ') · ' + Number(value.toPrecision(8)) : ''; return;\n" +
"    }\n" +
"    if (selectedLayer === 'mountains') {\n" +
"      const wx = Math.floor((x - 24) / cell), wy = Math.floor((y - 24) / cell);\n" +
"      const terrain = wx >= 0 && wy >= 0 && wx < SIZE && wy < SIZE ? world.terrain[wy * SIZE + wx] : 0;\n" +
"      canvas.title = terrain >= 6 && terrain <= 8 ? ['낮은 산', '높은 산', '능선'][terrain - 6] + ' · 일반 개체 60% · 비행 개체 100%' : ''; return;\n" +
"    }\n" +
"    const distance = (wx, wy) => Math.hypot(x - 24 - (wx + 0.5) * cell, y - 24 - (wy + 0.5) * cell);\n" +
"    if (selectedLayer === 'units') {\n" +
"      const encounter = encounterAt(event);\n" +
"      if (encounter) { canvas.title = encounter.badge + ' ' + encounter.name + ' · ' + encounter.kind + ' · ' + encounter.state + ' · 활동 범위 ' + encounter.cells.length + '칸 · 배치 초안'; return; }\n" +
"      if (selectedLayer === 'units') { canvas.title = ''; return; }\n" +
"    }\n" +
"    const burrow = (selectedLayer === 'units' || selectedLayer.startsWith('burrow-')) && world.burrows.find(item => distance(item.x + (item.width - 1) / 2, item.y) < (item.type === 'large' ? 11 : 7));\n" +
"    if (burrow) { canvas.title = (burrow.type === 'small' ? '작은 굴' : '큰 굴') + ' · ' + burrow.creature.name + ' · ' + burrow.creature.group; return; }\n" +
"    const waterColumn = Math.floor((x - 24) / cell), waterRow = Math.floor((y - 24) / cell);\n" +
"    if (waterColumn >= 0 && waterRow >= 0 && waterColumn < SIZE && waterRow < SIZE) {\n" +
"      const kind = waterKind(waterRow * SIZE + waterColumn);\n" +
"      if (kind && showWater && (!selectedWater || selectedWater === kind)) {\n" +
"        canvas.title = waterNames[kind] + ' · (' + waterColumn + ', ' + waterRow + ')'; return;\n" +
"      }\n" +
"    }\n" +
"    let resource = null, nearest = 5;\n" +
"    for (const point of resourceNodes()) if (resourceVisible(point)) {\n" +
"      const reach = distance(point[0], point[1]);\n" +
"      if (reach < nearest) { nearest = reach; resource = point; }\n" +
"    }\n" +
"    const name = resource && (resourceNames.get(resource[3]) || foodNames[resource[3]] || '자원');\n" +
"    if (resource) {\n" +
"      canvas.title = name + ' · ' + resource[2] + '개' +\n" +
"        (resource[4] !== undefined ? ' · 가까운 둥지까지 경로 ' + resource[4] + '칸' : '');\n" +
"      return;\n" +
"    }\n" +
"    const column = Math.floor((x - 24) / cell), row = Math.floor((y - 24) / cell);\n" +
"    const index = row * SIZE + column;\n" +
"    if (selectedLayer === 'resources' && resourceArea(resourceKey(selectedResource))?.includes(index)) {\n" +
"      canvas.title = resourceNames.get(resourceKey(selectedResource)) + ' · (' + column + ', ' + row + ')'; return;\n" +
"    }\n" +
"    const terrainNames = ['깊은 물', '얕은 물', '해안', '평지', '초원', '숲', '낮은 산', '높은 산', '능선', '늪', '여울'];\n" +
"    canvas.title = column >= 0 && row >= 0 && column < SIZE && row < SIZE ? terrainNames[world.terrain[index]] +\n" +
"      (world.hazards[index] === 1 ? ' · 독 포자' : '') + ' · (' + column + ', ' + row + ')' : '';\n" +
"  });\n" +
"  canvas.addEventListener('pointerleave', () => { canvas.title = ''; });\n" +
"\n" +
"  function scheduleDraw() { if (!drawing) { drawing = true; requestAnimationFrame(draw); } }\n" +
"  function controls(busy) {\n" +
"    root.querySelectorAll('input,button,select').forEach(item => { item.disabled = busy; });\n" +
"    if (!busy && world) { root.querySelector('#map-prev').disabled = world.seed === 0; root.querySelector('#map-next').disabled = world.seed === 4294967295; }\n" +
"  }\n" +
"  async function regenerate(seed) {\n" +
"    if (generating) return;\n" +
"    seedInput.setCustomValidity('');\n" +
"    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) { seedInput.setCustomValidity('시드는 0–4294967295 사이의 정수로 입력해 주세요.'); seedInput.reportValidity(); return; }\n" +
"    generating = true; controls(true); root.dataset.rendered = 'false'; root.setAttribute('aria-busy', 'true');\n" +
"    const progress = root.querySelector('#map-progress'); progress.hidden = false; progress.removeAttribute('value');\n" +
"    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));\n" +
"    try {\n" +
"      world = await generateWorld(seed, value => { progress.value = value; });\n" +
"      seedInput.value = String(seed); draw();\n" +
"    } catch (error) { seedInput.setCustomValidity('지도를 만들지 못했습니다: ' + error.message); }\n" +
"    finally { generating = false; controls(false); progress.hidden = true; root.removeAttribute('aria-busy'); if (!seedInput.checkValidity() && document.getElementById('world').classList.contains('is-page-active')) seedInput.reportValidity(); }\n" +
"  }\n" +
"  function applySeed() { seedInput.setCustomValidity(''); if (seedInput.reportValidity()) regenerate(Number(seedInput.value)); }\n" +
"  seedInput.addEventListener('input', () => seedInput.setCustomValidity(''));\n" +
"  seedInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applySeed(); } });\n" +
"  root.querySelector('#map-apply').addEventListener('click', applySeed);\n" +
"  root.querySelector('#map-prev').addEventListener('click', () => regenerate(world.seed - 1));\n" +
"  root.querySelector('#map-next').addEventListener('click', () => regenerate(world.seed + 1));\n" +
"  function updateLayerSelection() {\n" +
"    campSelect.value = selectedLayer.startsWith('camp-') ? selectedLayer : '';\n" +
"    resourceSelect.value = selectedResource;\n" +
"    root.dataset.activeLayer = selectedLayer; root.dataset.activeResource = selectedResource; root.dataset.activeUnit = selectedUnit;\n" +
"    root.dataset.waterVisible = String(showWater); root.dataset.resourcesVisible = String(showResources); root.dataset.activeWater = selectedWater;\n" +
"    waterSelect.value = selectedWater; root.querySelector('#map-water-key').hidden = !showWater;\n" +
"    unitSelect.value = selectedUnit || (selectedLayer.startsWith('burrow-') ? selectedLayer : '');\n" +
"    root.querySelectorAll('button[data-layer]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.layer === 'water' ? showWater :\n" +
"      item.dataset.layer === 'resources' ? showResources : item.dataset.layer === (selectedLayer.startsWith('camp-') ? 'camps' : selectedLayer))));\n" +
"    scheduleDraw();\n" +
"  }\n" +
"  root.querySelectorAll('button[data-layer]').forEach(button => button.addEventListener('click', () => {\n" +
"    const layer = button.dataset.layer;\n" +
"    logic.hidden = true; selectedPlacementMap = ''; root.classList.remove('show-logic');\n" +
"    root.querySelectorAll('button[data-logic]').forEach(item => item.setAttribute('aria-expanded', 'false'));\n" +
"    if (layer === 'water') showWater = !showWater;\n" +
"    else if (layer === 'resources') showResources = !showResources;\n" +
"    else { selectedLayer = selectedLayer === layer && !selectedUnit ? '' : layer; selectedUnit = ''; }\n" +
"    updateLayerSelection();\n" +
"  }));\n" +
"  resourceSelect.addEventListener('change', () => {\n" +
"    selectedResource = resourceSelect.value; selectedUnit = ''; selectedLayer = ''; showResources = true; selectedPlacementMap = '';\n" +
"    if (logic.hidden) updateLayerSelection(); else showLayerRules('resources');\n" +
"  });\n" +
"  waterSelect.addEventListener('change', () => {\n" +
"    selectedWater = waterSelect.value; selectedUnit = ''; selectedLayer = ''; showWater = true; selectedPlacementMap = '';\n" +
"    if (logic.hidden) updateLayerSelection(); else showLayerRules('water');\n" +
"  });\n" +
"  function showLayerRules(layer) {\n" +
"    logicLayer = layer; logic.hidden = false; selectedPlacementMap = ''; root.classList.add('show-logic');\n" +
"    root.querySelectorAll('button[data-logic]').forEach(item => item.setAttribute('aria-expanded', String(item.dataset.logic === layer)));\n" +
"    updateLayerSelection(); updateLogic();\n" +
"  }\n" +
"  campSelect.addEventListener('change', () => {\n" +
"    selectedUnit = ''; selectedLayer = campSelect.value || 'camps';\n" +
"    showLayerRules('camps');\n" +
"  });\n" +
"  unitSelect.addEventListener('change', () => {\n" +
"    const key = unitSelect.value;\n" +
"    selectedUnit = key.startsWith('burrow-') ? '' : key;\n" +
"    selectedLayer = key.startsWith('burrow-') ? key : 'units';\n" +
"    showLayerRules('units');\n" +
"  });\n" +
"  addEventListener('resize', scheduleDraw);\n" +
"  new ResizeObserver(scheduleDraw).observe(canvas);\n" +
"  new MutationObserver(scheduleDraw).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });\n" +
"  document.addEventListener('spawner-page', event => { if (event.detail === 'world') scheduleDraw(); });\n" +
"  updateLayerSelection(); regenerate(Number(seedInput.value));\n" +
"})();\n" +
"\n" +
"  </script>\n" +
"</div>"
);
