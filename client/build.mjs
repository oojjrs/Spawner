import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";
import { AGENT_ATTACK_ASSET } from "../server/attack.mjs";

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
const assets = Object.fromEntries([...CREATURE_ASSETS, AGENT_ATTACK_ASSET, "DesignAssets/Foods/food-berry-bush.png", "DesignAssets/Terrain/standing-tree-smooth-atlas.png", "DesignAssets/Terrain/poison-spore-atlas.png", "DesignAssets/Terrain/thorn-root-atlas.png"].map(name => [name, `data:${name.endsWith(".png") ? "image/png" : "image/webp"};base64,${readFileSync(resolve(root, name)).toString("base64")}`]));
const browser = bundle(["server/attributes.mjs", "server/nests.mjs", "server/food.mjs", "server/birth.mjs", "server/attack.mjs", "server/beetle-animation.mjs", "client/birth.mjs", "client/client.mjs"]);
const content = `(() => {\n${browser}\nconst workerSource = ${JSON.stringify(worker)};\nglobalThis.Spawner = Object.freeze({ ...modules["server/attributes.mjs"], ...modules["server/food.mjs"], ...modules["server/birth.mjs"], ...modules["server/attack.mjs"], ...modules["server/beetle-animation.mjs"], ...modules["client/birth.mjs"], NEST_LEVELS: modules["server/nests.mjs"].NEST_LEVELS, createClient: (onState, onError, onSaved) => modules["client/client.mjs"].createClient(onState, onError, onSaved, workerSource), assets: ${JSON.stringify(assets)} });\n})();\n`;
writeFileSync(resolve(root, "client/runtime.js"), content.replace(/\r?\n/g, "\r\n"), "utf8");
const designPath = resolve(root, "Design.html");
const design = readFileSync(designPath, "utf8");
if (design.includes('<script id="world-model">')) {
  const model = `(() => {\n${bundle(["server/world.mjs"])}\nglobalThis.SpawnerWorld = modules["server/world.mjs"];\n})();`;
  const updated = design.replace(/(<script id="world-model">)[\s\S]*?(<\/script>)/, (match, start, end) => start + "\n" + model + "\n" + end).replace(/\r?\n/g, "\r\n");
  if (updated !== design) writeFileSync(designPath, updated, "utf8");
}
console.log(`ENV> CLIENT BUNDLE : ${Buffer.byteLength(content)} BYTES`);
