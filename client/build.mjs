import { SECRETION_COMBO_IMAGE_ASSETS } from "./secretion-combo-assets.mjs";
import { ANTENNA_COMBO_IMAGE_ASSETS } from "./antenna-combo-assets.mjs";
import { BLADE_CARAPACE_IMAGE_ASSETS } from "./blade-carapace-assets.mjs";
import { SPECIES_HELD_HURT_ASSETS } from "./species-held-hurt.mjs";
import { BEAN_HELD_HURT_ASSETS } from "./bean-held-hurt.mjs";
import { UNIT_RANGED_IMAGE_ASSETS } from "./unit-ranged.mjs";
import { DETAIL_COMBAT_VFX_ASSETS } from "./combat-detail-vfx.mjs";
import { CONQUEST_PACING } from "../server/conquest-pacing.mjs";
import { COMBAT_ATTRIBUTE_ASSETS } from "./combat-attribute-assets.mjs";
import { auditImages } from "./image-audit.mjs";
import { productionRuntime } from "./production.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";
import { AGENT_ATTACK_ASSET } from "../server/attack.mjs";
import { UNIT_ANIMATION_ASSETS } from "./unit-animation.mjs";
import { TRIBE_ATTRIBUTE_ASSETS } from "./attribute-animation.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { STRUCTURE_EFFECT_ASSETS } from "./structure-effects.mjs";
import { NEST_GROWTH_ASSETS } from "./nest-growth.mjs";
import { TALON_OWL_IDLE } from "./talon-owl-idle.mjs";
import { SPORE_BIRTH_ANIMATION, SPRING_BIRTH_ANIMATION, PEBBLE_BIRTH_ANIMATION } from "./birth.mjs";
import { RESOURCE_TYPES } from "../server/resources.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "./harvest-assets.mjs";
import { PLAYER_TRIBE_ASSETS } from "../server/player-tribes.mjs";
import { PLAYER_COMBAT_ASSETS } from "./combat.mjs";
import { TERRAIN_CODEX, HAZARD_CODEX, terrainCodexResources } from "./terrain-codex.mjs";
import { WORLD_GENERATION_VERSION } from "../server/world.mjs";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function writeGenerated(path, content) {
  const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
  const crlf = (previous.match(/\r\n/g) || []).length, lines = (previous.match(/\n/g) || []).length;
  const updated = content.replace(/\r?\n/g, crlf > lines / 2 ? "\r\n" : "\n");
  if (updated !== previous) writeFileSync(path, updated, "utf8");
}
function unchangedLocalJson(path, source) {
  if (!existsSync(path)) return false;
  try {
    const previous = readFileSync(path, "utf8").match(/ = ("[^\r\n]*");\s*$/)?.[1];
    const encoded = previous && JSON.parse(previous), marker = "data:application/octet-stream;base64,";
    return typeof encoded === "string" && encoded.startsWith(marker) &&
      JSON.stringify(JSON.parse(Buffer.from(encoded.slice(marker.length), "base64").toString("utf8"))) === JSON.stringify(JSON.parse(source));
  } catch { return false; }
}
const imports = /^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\r?$/gm;
const exports = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

function bundle(entries) {
  const completed = new Set();
  const visiting = new Set();
  const chunks = ["const modules = Object.create(null);"];
  function visit(name) {
    if (completed.has(name)) return;
    if (visiting.has(name)) throw new Error(`CIRCULAR CLIENT MODULE : ${name}`);
    visiting.add(name);
    const path = resolve(root, name);
    const source = readFileSync(path, "utf8");
    const dependencies = [...source.matchAll(imports)].map(match => ({ text: match[0], names: match[1], name: relative(root, resolve(dirname(path), match[2])).replaceAll("\\", "/") }));
    for (const dependency of dependencies) visit(dependency.name);
    const names = [...source.matchAll(exports)].map(match => match[1]);
    let transformed = source;
    for (const dependency of dependencies) transformed = transformed.replace(dependency.text, `const {${dependency.names.replace(/\b([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\b/g, "$1: $2")}} = modules[${JSON.stringify(dependency.name)}];`);
    transformed = transformed.replace(/^export\s+/gm, "");
    if (/^(import|export)\s/m.test(transformed)) throw new Error(`UNSUPPORTED CLIENT MODULE : ${name}`);
    chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${transformed}\nreturn { ${names.join(", ")} };\n})();`);
    visiting.delete(name);
    completed.add(name);
  }
  for (const entry of entries) visit(entry);
  return chunks.join("\n");
}

function readDesignSection(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(line => line.startsWith('"'))
    .map(line => JSON.parse(line.replace(/ \+$/, ""))).join("");
}

function writeDesignSection(path, content) {
  writeGenerated(path, "document.write(\n" + content.match(/[^\n]*\n|[^\n]+$/g)
    .map(line => JSON.stringify(line)).join(" +\n") + "\n);\n");
}

function writeDesignResources() {
  const path = resolve(root, "DesignAssets/codex-food.html");
  const original = readFileSync(path, "utf8");
  const model = `(() => {\n${bundle(["client/harvest-assets.mjs", "client/resource-art.mjs"])}\nglobalThis.SpawnerDesignResources = { RESOURCE_TYPES: ${JSON.stringify(RESOURCE_TYPES)}, ...modules["client/harvest-assets.mjs"], ...modules["client/resource-art.mjs"] };\n})();`;
  const updated = original.replace(/(<script id="design-resource-model"[^>]*>)[\s\S]*?(<\/script>)/,
    (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== original) writeGenerated(path, updated);
}

if (process.argv.includes("--design-resources-only")) {
  writeDesignResources();
  process.exit(0);
}

function writeDesignWorld() {
  const path = resolve(root, "DesignAssets/sections/world-map.js");
  const original = readDesignSection(path);
  let design = original;
  if (!design.includes('<script id="design-world-model"')) return;
  const model = `(() => {\n${bundle(["server/map.mjs","server/nests.mjs","server/attributes.mjs","server/tribe-production.mjs","server/conquest-economy.mjs"])}\nconst map = modules["server/map.mjs"];\nglobalThis.SpawnerDesignWorld = { ...map, ...modules["server/conquest-pacing.mjs"], ...modules["server/nests.mjs"], ...modules["server/attributes.mjs"], ...modules["server/tribe-production.mjs"], ...modules["server/conquest-economy.mjs"], ENCOUNTER_PLANS:map.ENCOUNTER_PLANS.map(modules["server/conquest-pacing.mjs"].conquestEncounterPlan), generateWorld: (seed, onProgress) => map.generateMapWorld(seed, onProgress, undefined, true) };\n})();`;
  const values = '<table class="map-legend-table" id="conquest-rules" style="word-break:keep-all"><colgroup><col style="width:92px"><col></colgroup><tbody>' +
    '<tr><th>새싹콩</th><td>0–' + CONQUEST_PACING.quietUntil + '초 · 중립 ≈' + CONQUEST_PACING.neutralConflictAt + '초 · 종족 ' + CONQUEST_PACING.tribeContactAt + '초+ · 정찰 &lt;' + CONQUEST_PACING.tribeContactAt + '초</td></tr>' +
    '<tr><th>둥지</th><td>Lv.2 ' + CONQUEST_PACING.nestCosts[0] + 'P · Lv.3 ' + CONQUEST_PACING.nestCosts[1] + 'P · Lv.4 ' + CONQUEST_PACING.nestCosts[2] + 'P · AI ≥' + CONQUEST_PACING.aiLevelFourAt + '초</td></tr>' +
    '<tr><th>일꾼:군사</th><td>80:20 → 30:70 · 30–40 · 60–70</td></tr>' +
    '</tbody></table>';
  if (design.includes('id="conquest-rules"')) design = design.replace(/<table[^>]*id="conquest-rules"[^>]*>[\s\S]*?<\/table>/,values);
  else design = design.replace('<details class="map-encounter-rules" id="world-encounter-rules">',values + '\n<details class="map-encounter-rules" id="world-encounter-rules">');
  const updated = design.replace(/(<script id="design-world-model"[^>]*>)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== original) writeDesignSection(path, updated);
}

if (process.argv.includes("--design-world-only")) {
  writeDesignWorld();
  process.exit(0);
}

function writeAttributeDna() {
  const path = resolve(root, "Attribute.html");
  const source = `(() => {
${bundle(["server/dna.mjs", "client/dna-editor.mjs", "client/dna-starter-designs.mjs"])}
window.AttributeDna = modules["server/dna.mjs"].ATTRIBUTE_DNA;
globalThis.AttributeDnaEditor = modules["client/dna-editor.mjs"];
globalThis.AttributeDnaTemplates = modules["client/dna-starter-designs.mjs"];
})();`;
  const original = readFileSync(path, "utf8");
  const updated = original.replace(/(<script id="dna-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\r\n" + source + end).replace(/\r?\n/g, "\r\n");
  if (updated !== original) writeGenerated(path, updated);
}

if (process.argv.includes("--attribute-editor-only")) {
  writeAttributeDna();
  process.exit(0);
}

if (!process.argv.includes("--runtime-only")) writeAttributeDna();

const decisionWorker = `(() => {\n${bundle(["client/decision-worker.mjs"])}\n})();`;
let worker = `globalThis.SpawnerDecisionWorkerSource = ${JSON.stringify(decisionWorker)};\n(() => {\n${bundle(["client/worker.mjs"])}\n})();`;
if (process.argv.includes("--production")) worker = productionRuntime(worker);
const assets = Object.fromEntries([...SECRETION_COMBO_IMAGE_ASSETS, ...ANTENNA_COMBO_IMAGE_ASSETS, ...BLADE_CARAPACE_IMAGE_ASSETS, ...SPECIES_HELD_HURT_ASSETS, ...BEAN_HELD_HURT_ASSETS, ...UNIT_RANGED_IMAGE_ASSETS, ...DETAIL_COMBAT_VFX_ASSETS, ...PLAYER_TRIBE_ASSETS, ...PLAYER_COMBAT_ASSETS, ...COMBAT_ATTRIBUTE_ASSETS, ...UNIT_ANIMATION_ASSETS, ...TRIBE_ATTRIBUTE_ASSETS, ...NEST_GROWTH_ASSETS, ...RESOURCE_TYPES.flatMap(item => [item.image, item.carryImage]), ...RESOURCE_HARVEST_ANIMATIONS.map(item => item.image), ...CREATURE_ASSETS, TALON_OWL_IDLE.image, AGENT_ATTACK_ASSET, AGENT_DEATH_ANIMATION.image, STRUCTURE_EFFECT_ASSETS.ring, STRUCTURE_EFFECT_ASSETS.sparkle, SPORE_BIRTH_ANIMATION.image, SPORE_BIRTH_ANIMATION.nest, SPRING_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.foreground, "DesignAssets/UI/hp-heart.png", "DesignAssets/Foods/food-berry-bush.png", "DesignAssets/Terrain/standing-tree-smooth-atlas.png", "DesignAssets/Terrain/poison-spore-ground.png"].map(name => [name, name]));
let browser = bundle(["client/unit-presentation.mjs", "client/creature-presentation.mjs", "client/unit-presentation-assets.mjs", "client/unit-health-ring.mjs", "client/unit-attack-ring.mjs", "client/species-held-hurt.mjs", "client/bean-held-hurt.mjs", "client/combat-dodge-vfx.mjs",  "client/spring-dominant-birth.mjs", "client/combat-detail-vfx.mjs", "client/combat-vfx-events.mjs", "client/welcome-presentation.mjs", "client/dna-editor.mjs", "server/dna-unit.mjs", "client/combat-attributes.mjs", "client/sprout-roots.mjs", "client/burrow-codex.mjs", "client/progression-ui.mjs", "client/cheats.mjs", "client/unit-animation.mjs", "client/unit-size.mjs", "client/terrain-codex.mjs", "server/combat.mjs", "client/combat.mjs", "server/encounter-types.mjs", "server/player-tribes.mjs", "client/tribe-art.mjs", "server/corpses.mjs", "server/resources.mjs", "server/attributes.mjs", "server/unit-template-names.mjs", "server/nests.mjs", "server/food.mjs", "server/birth.mjs", "server/attack.mjs", "client/agent-death.mjs", "client/nest-growth.mjs", "client/structure-effects.mjs", "server/beetle-animation.mjs", "client/talon-owl-idle.mjs", "client/birth.mjs", "client/creature-spawn.mjs", "client/harvest-assets.mjs", "client/harvest.mjs", "client/resource-art.mjs", "client/client.mjs", "client/codex-content.mjs", "client/base-resource-motion.mjs", "client/combat-stun-vfx.mjs", "client/combat-detail-death.mjs"]);
if (process.argv.includes("--production")) browser = productionRuntime(browser);
const gameSource = readFileSync(resolve(root, "client/game.js"), "utf8");
const gameImages = new Set(Object.keys(assets));
for (const file of ["client/game.js", "client/game.css", "Spawner.html"]) {
  for (const match of readFileSync(resolve(root, file), "utf8").matchAll(/["'](DesignAssets\/[^"'?\r\n]+\.(?:png|webp|gif|jpe?g))["']/g)) gameImages.add(match[1]);
}
auditImages(root, gameImages);
function renderingDigest(files, functions, constants) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(resolve(root, "DesignAssets/Terrain", file)));
  for (const name of functions) {
    const declaration = gameSource.match(new RegExp("^    (?:async )?function " + name + "\\([^]*?^    }", "m"));
    if (!declaration) throw new Error("RENDERING FUNCTION MISSING : " + name);
    hash.update(declaration[0]);
  }
  hash.update(constants);
  return hash.digest("hex");
}
const renderingAssets = {
  terrain: renderingDigest(["land-ground.png", "grassland-ground.png", "forest-ground.png", "swamp-ground.png", "low-mountain-ground.png", "high-mountain-ground.png", "ridge-ground.png", "coast-ground.png", "shallow-water-ground.png", "deep-water-ground.png", "ford-ground.png"],
    ["updateTerrainRendering", "terrainGroundPixels", "createTerrainSamples", "createTerrainPatch", "buildTerrainAtlas"], gameSource.match(/const TERRAIN_COLORS = \{[^]*?\n    };/)[0]),
  forest: renderingDigest(["standing-tree-smooth-atlas.png"], ["drawForestTree", "updateForest", "forestTreeRegions", "forestRegionKey"],
    gameSource.slice(gameSource.indexOf("const forest ="), gameSource.indexOf("const hazardCells ="))),
  hazards: renderingDigest(["poison-spore-ground.png"], ["updateHazards", "hazardGroundTile"], "")
};
const content = `(() => {\n${browser}\nconst workerSource = ${JSON.stringify(worker)};\nglobalThis.Spawner = Object.freeze({ ...modules["client/unit-action-art.mjs"], ...modules["client/unit-loading.mjs"], ...modules["client/unit-health-ring.mjs"], ...modules["client/unit-attack-ring.mjs"], ...modules["client/combat-detail-death.mjs"], ...modules["client/combat-stun-vfx.mjs"], ...modules["client/base-resource-motion.mjs"], ...modules["client/species-held-hurt.mjs"], ...modules["client/bean-held-hurt.mjs"], ...modules["client/combat-dodge-vfx.mjs"], ...modules["client/spring-dominant-birth.mjs"], ...modules["client/unit-ranged.mjs"], ...modules["client/creature-ranged.mjs"], ...modules["client/creature-ranged-vfx.mjs"], ...modules["client/unit-display-appearance.mjs"], ...modules["client/combat-detail-vfx.mjs"], ...modules["client/combat-vfx-events.mjs"], ...modules["client/welcome-presentation.mjs"], ...modules["client/dna-editor.mjs"], ...modules["server/dna.mjs"], ...modules["server/dna-unit.mjs"], ...modules["client/codex-content.mjs"], ...modules["client/combat-attributes.mjs"], ...modules["client/sprout-roots.mjs"], ...modules["client/unit-presentation.mjs"], ...modules["client/creature-presentation.mjs"], ...modules["client/unit-presentation-assets.mjs"], ...modules["client/image-geometry.mjs"], ...modules["client/cheats.mjs"], ...modules["client/unit-animation.mjs"], ...modules["client/unit-size.mjs"], ...modules["client/terrain-codex.mjs"], ...modules["client/burrow-codex.mjs"], ...modules["server/combat.mjs"], ...modules["server/combat-stats.mjs"], ...modules["client/combat.mjs"], ...modules["server/encounter-types.mjs"], ...modules["server/player-tribes.mjs"], ...modules["client/tribe-art.mjs"], ...modules["server/world-size.mjs"], ...modules["server/corpses.mjs"], ...modules["server/resources.mjs"], ...modules["server/attributes.mjs"], ...modules["server/unit-template-names.mjs"], ...modules["client/progression-ui.mjs"], ...modules["server/food.mjs"], ...modules["server/birth.mjs"], ...modules["server/attack.mjs"], ...modules["client/agent-death.mjs"], ...modules["client/nest-growth.mjs"], ...modules["client/structure-effects.mjs"], ...modules["server/beetle-animation.mjs"], ...modules["client/talon-owl-idle.mjs"], ...modules["client/birth.mjs"], ...modules["client/creature-spawn.mjs"], ...modules["client/harvest-assets.mjs"], ...modules["client/harvest.mjs"], ...modules["client/resource-art.mjs"], NEST_LEVELS: modules["server/nests.mjs"].NEST_LEVELS, nestUpgradeCost: modules["server/nests.mjs"].nestUpgradeCost, materialCapacity: modules["server/nests.mjs"].materialCapacity, createClient: (onState, onError, onSaved) => modules["client/client.mjs"].createClient(onState, onError, onSaved, workerSource), renderingAssets: ${JSON.stringify(renderingAssets)}, assets: ${JSON.stringify(assets)} });\n})();\n`;
writeGenerated(resolve(root, "client/runtime.js"), content);
if (process.argv.includes("--runtime-only")) process.exit(0);
if (!process.argv.includes("--preserve-design")) {
for (const designName of ["DesignAssets/sections/terrain-floors.js", "DesignAssets/sections/terrain-objects.js"]) {
const designPath = resolve(root, designName);
let design = readDesignSection(designPath);
const originalDesign = design;
const terrainTable = design.match(/<table[^>]*aria-label="지형 바닥"[^>]*>[\s\S]*?<\/table>/)?.[0];
if (terrainTable) {
  let table = terrainTable.replace(/<thead>[\s\S]*?<\/thead>/, '<thead><tr><th scope="col">지형</th><th scope="col">바닥</th><th scope="col">이동 효과</th><th scope="col">발견 가능한 자원</th></tr></thead>');
  table = table.replace('<table ', '<table class="terrain-codex-table" ').replace('class="terrain-codex-table" class="terrain-codex-table"', 'class="terrain-codex-table"');
  table = table.replace(/<tr>[\s\S]*?<\/tr>/g, row => {
    const name = row.match(/<th scope="row">([^<]+)<\/th>/)?.[1];
    const terrain = TERRAIN_CODEX.find(terrain => terrain.name === name);
    if (!terrain && name !== '군락 바닥') return row;
    const resources = terrain ? terrainCodexResources(terrain.type, WORLD_GENERATION_VERSION).map(resource => resource.name).join(' · ') || '없음' : '—';
    const effect = terrain ? terrain.effect : '군락 점유 영역';
    return row.replace(/(<\/figure><\/td>)[\s\S]*?<\/tr>$/, '$1<td>' + effect + '</td><td>' + resources + '</td></tr>');
  });
  design = design.replace(terrainTable, table);
}
const terrainObjects = design.match(/<table class="terrain-object-table"[^>]*>[\s\S]*?<\/table>/)?.[0];
if (terrainObjects) design = design.replace(terrainObjects, terrainObjects.replace(/<tr>[\s\S]*?<\/tr>/g, row => {
  const name = row.match(/<th scope="row">([^<]+)<\/th>/)?.[1];
  const hazard = HAZARD_CODEX.find(hazard => hazard.name === name);
  return hazard ? row.slice(0, row.lastIndexOf('<td>')) + '<td>' + hazard.description + '</td></tr>' : row;
}));
if (design !== originalDesign) writeDesignSection(designPath, design);
if (design.includes('<script id="world-model">')) {
  const model = `(() => {\n${bundle(["server/world.mjs"])}\nglobalThis.SpawnerWorld = { ...modules["server/world.mjs"], ...modules["server/burrows.mjs"] };\n})();`;
  const updated = design.replace(/(<script id="world-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== design) writeDesignSection(designPath, updated);
}
}
writeDesignWorld();
writeDesignResources();
}
const localAssets = new Set(Object.values(assets));
for (const name of ["client/game.js", "client/audio.js", "client/combat-audio.js", "client/movement-audio.js"]) {
  const source = readFileSync(resolve(root, name), "utf8");
  for (const match of source.matchAll(/["'](DesignAssets\/[^"'?\r\n]+)["']/g)) {
    if (/\.[a-z0-9]+$/i.test(match[1])) localAssets.add(match[1]);
  }
}
const localAssetFiles = [];
for (const name of [...localAssets].sort()) {
  const file = "client/local-assets/" + name.slice("DesignAssets/".length) + ".js";
  const path = resolve(root, file);
  const extension = name.split(".").at(-1);
  const mime = { png: "image/png", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav" }[extension] || "application/octet-stream";
  const source = "data:" + mime + ";base64," + readFileSync(resolve(root, name)).toString("base64");
  mkdirSync(dirname(path), { recursive: true });
  // JSON line endings do not change the asset's value. Keep an equivalent
  // embedded payload to avoid large, unrelated binary-wrapper changes.
  if (extension !== "json" || !unchangedLocalJson(path, readFileSync(resolve(root, name), "utf8")))
    writeGenerated(path, "globalThis.SpawnerLocalAssetSources[" + JSON.stringify(name) + "] = " + JSON.stringify(source) + ";\n");
  localAssetFiles.push("./" + file);
}
writeGenerated(resolve(root, "client/local-assets.js"),
  "globalThis.SpawnerLocalAssetFiles = Object.freeze(" + JSON.stringify(localAssetFiles, null, 2) + ");\n");
console.log(`ENV> CLIENT BUNDLE : ${Buffer.byteLength(content)} BYTES`);
