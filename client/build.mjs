import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";
import { AGENT_ATTACK_ASSET } from "../server/attack.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { AGENT_SPIRIT } from "./agent-spirit.mjs";
import { TALON_OWL_IDLE } from "./talon-owl-idle.mjs";
import { SPRING_BIRTH_ANIMATION, PEBBLE_BIRTH_ANIMATION } from "./birth.mjs";
import { RESOURCE_TYPES } from "../server/resources.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "./harvest-assets.mjs";
import { PLAYER_TRIBE_ASSETS } from "../server/player-tribes.mjs";
import { PLAYER_COMBAT_ASSETS } from "./combat.mjs";
import { TERRAIN_CODEX, HAZARD_CODEX, terrainCodexResources } from "./terrain-codex.mjs";
import { WORLD_GENERATION_VERSION } from "../server/world.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
    for (const dependency of dependencies) transformed = transformed.replace(dependency.text, `const {${dependency.names}} = modules[${JSON.stringify(dependency.name)}];`);
    transformed = transformed.replace(/^export\s+/gm, "");
    if (/^(import|export)\s/m.test(transformed)) throw new Error(`UNSUPPORTED CLIENT MODULE : ${name}`);
    chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${transformed}\nreturn { ${names.join(", ")} };\n})();`);
    visiting.delete(name);
    completed.add(name);
  }
  for (const entry of entries) visit(entry);
  return chunks.join("\n");
}

const worker = `(() => {\n${bundle(["client/worker.mjs"])}\n})();`;
const assets = Object.fromEntries([...PLAYER_TRIBE_ASSETS, ...PLAYER_COMBAT_ASSETS, ...RESOURCE_TYPES.flatMap(item => [item.image, item.carryImage]), ...RESOURCE_HARVEST_ANIMATIONS.map(item => item.image), ...CREATURE_ASSETS, TALON_OWL_IDLE.image, AGENT_ATTACK_ASSET, AGENT_DEATH_ANIMATION.image, AGENT_SPIRIT.image, SPRING_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.foreground, "DesignAssets/Foods/food-berry-bush.png", "DesignAssets/Terrain/standing-tree-smooth-atlas.png", "DesignAssets/Terrain/poison-spore-ground.png", "DesignAssets/Terrain/thorn-root-ground.png"].map(name => [name, name]));
const browser = bundle(["client/terrain-codex.mjs", "server/combat.mjs", "client/combat.mjs", "server/encounter-types.mjs", "server/player-tribes.mjs", "client/tribe-art.mjs", "server/lifespan.mjs", "server/growth.mjs", "server/resources.mjs", "server/attributes.mjs", "server/nests.mjs", "server/food.mjs", "server/birth.mjs", "server/attack.mjs", "client/agent-death.mjs", "client/agent-spirit.mjs", "server/beetle-animation.mjs", "client/talon-owl-idle.mjs", "client/birth.mjs", "client/harvest-assets.mjs", "client/harvest.mjs", "client/client.mjs"]);
const content = `(() => {\n${browser}\nconst workerSource = ${JSON.stringify(worker)};\nglobalThis.Spawner = Object.freeze({ ...modules["client/terrain-codex.mjs"], ...modules["server/combat.mjs"], ...modules["client/combat.mjs"], ...modules["server/encounter-types.mjs"], ...modules["server/player-tribes.mjs"], ...modules["client/tribe-art.mjs"], ...modules["server/lifespan.mjs"], ...modules["server/growth.mjs"], ...modules["server/resources.mjs"], ...modules["server/attributes.mjs"], ...modules["server/food.mjs"], ...modules["server/birth.mjs"], ...modules["server/attack.mjs"], ...modules["client/agent-death.mjs"], ...modules["client/agent-spirit.mjs"], ...modules["server/beetle-animation.mjs"], ...modules["client/talon-owl-idle.mjs"], ...modules["client/birth.mjs"], ...modules["client/harvest-assets.mjs"], ...modules["client/harvest.mjs"], NEST_LEVELS: modules["server/nests.mjs"].NEST_LEVELS, createClient: (onState, onError, onSaved) => modules["client/client.mjs"].createClient(onState, onError, onSaved, workerSource), assets: ${JSON.stringify(assets)} });\n})();\n`;
writeFileSync(resolve(root, "client/runtime.js"), content.replace(/\r?\n/g, "\r\n"), "utf8");
const designPath = resolve(root, "Design.html");
let design = readFileSync(designPath, "utf8");
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
if (design !== readFileSync(designPath, "utf8")) writeFileSync(designPath, design.replace(/\r?\n/g, "\r\n"), "utf8");
if (design.includes('<script id="design-world-model">')) {
  const model = `(() => {\n${bundle(["server/map.mjs"])}\nconst map = modules["server/map.mjs"];\nglobalThis.SpawnerDesignWorld = { ...map, generateWorld: seed => map.generateMapWorld(seed) };\n})();`;
  const updated = design.replace(/(<script id="design-world-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== design) writeFileSync(designPath, updated, "utf8");
}
if (design.includes('<script id="world-model">')) {
  const model = `(() => {\n${bundle(["server/world.mjs"])}\nglobalThis.SpawnerWorld = { ...modules["server/world.mjs"], ...modules["server/burrows.mjs"] };\n})();`;
  const updated = design.replace(/(<script id="world-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== design) writeFileSync(designPath, updated, "utf8");
}
const localAssets = new Set(Object.values(assets));
for (const name of ["client/game.js", "client/audio.js", "client/combat-audio.js"]) {
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
  writeFileSync(path, "globalThis.SpawnerLocalAssetSources[" + JSON.stringify(name) + "] = " + JSON.stringify(source) + ";\r\n", "utf8");
  localAssetFiles.push("./" + file);
}
writeFileSync(resolve(root, "client/local-assets.js"),
  ("globalThis.SpawnerLocalAssetFiles = Object.freeze(" + JSON.stringify(localAssetFiles, null, 2) + ");\n").replace(/\r?\n/g, "\r\n"), "utf8");
console.log(`ENV> CLIENT BUNDLE : ${Buffer.byteLength(content)} BYTES`);
