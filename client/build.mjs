import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";
import { AGENT_ATTACK_ASSET } from "../server/attack.mjs";
import { AGENT_DEATH_ANIMATION } from "./agent-death.mjs";
import { TALON_OWL_IDLE } from "./talon-owl-idle.mjs";
import { SPRING_BIRTH_ANIMATION, PEBBLE_BIRTH_ANIMATION } from "./birth.mjs";
import { RESOURCE_TYPES } from "../server/resources.mjs";
import { RESOURCE_HARVEST_ANIMATIONS } from "./harvest-assets.mjs";
import { PLAYER_TRIBE_ASSETS } from "../server/player-tribes.mjs";

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
const assets = Object.fromEntries([...PLAYER_TRIBE_ASSETS, ...RESOURCE_TYPES.map(item => item.image), ...RESOURCE_HARVEST_ANIMATIONS.map(item => item.image), ...CREATURE_ASSETS, TALON_OWL_IDLE.image, AGENT_ATTACK_ASSET, AGENT_DEATH_ANIMATION.image, SPRING_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.image, PEBBLE_BIRTH_ANIMATION.nest, "DesignAssets/Foods/food-berry-bush.png", "DesignAssets/Terrain/standing-tree-smooth-atlas.png", "DesignAssets/Terrain/poison-spore-atlas.png", "DesignAssets/Terrain/thorn-root-atlas.png"].map(name => [name, name]));
const browser = bundle(["server/player-tribes.mjs", "client/tribe-art.mjs", "server/lifespan.mjs", "server/growth.mjs", "server/resources.mjs", "server/attributes.mjs", "server/nests.mjs", "server/food.mjs", "server/birth.mjs", "server/attack.mjs", "client/agent-death.mjs", "server/beetle-animation.mjs", "client/talon-owl-idle.mjs", "client/birth.mjs", "client/harvest-assets.mjs", "client/harvest.mjs", "client/client.mjs"]);
const content = `(() => {\n${browser}\nconst workerSource = ${JSON.stringify(worker)};\nglobalThis.Spawner = Object.freeze({ ...modules["server/player-tribes.mjs"], ...modules["client/tribe-art.mjs"], ...modules["server/lifespan.mjs"], ...modules["server/growth.mjs"], ...modules["server/resources.mjs"], ...modules["server/attributes.mjs"], ...modules["server/food.mjs"], ...modules["server/birth.mjs"], ...modules["server/attack.mjs"], ...modules["client/agent-death.mjs"], ...modules["server/beetle-animation.mjs"], ...modules["client/talon-owl-idle.mjs"], ...modules["client/birth.mjs"], ...modules["client/harvest-assets.mjs"], ...modules["client/harvest.mjs"], NEST_LEVELS: modules["server/nests.mjs"].NEST_LEVELS, createClient: (onState, onError, onSaved) => modules["client/client.mjs"].createClient(onState, onError, onSaved, workerSource), assets: ${JSON.stringify(assets)} });\n})();\n`;
writeFileSync(resolve(root, "client/runtime.js"), content.replace(/\r?\n/g, "\r\n"), "utf8");
const designPath = resolve(root, "Design.html");
const design = readFileSync(designPath, "utf8");
if (design.includes('<script id="world-model">')) {
  const model = `(() => {\n${bundle(["server/world.mjs"])}\nglobalThis.SpawnerWorld = { ...modules["server/world.mjs"], ...modules["server/burrows.mjs"] };\n})();`;
  const updated = design.replace(/(<script id="world-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== design) writeFileSync(designPath, updated, "utf8");
}
const localAssets = new Set(Object.values(assets));
for (const name of ["client/game.js", "client/audio.js"]) {
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
