import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";

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
const assets = Object.fromEntries(CREATURE_ASSETS.map(name => [name, `data:${name.endsWith(".png") ? "image/png" : "image/webp"};base64,${readFileSync(resolve(root, name)).toString("base64")}`]));
const browser = bundle(["server/attributes.mjs", "server/nests.mjs", "client/client.mjs"]);
const content = `(() => {\n${browser}\nconst workerSource = ${JSON.stringify(worker)};\nglobalThis.Spawner = Object.freeze({ ...modules["server/attributes.mjs"], NEST_LEVELS: modules["server/nests.mjs"].NEST_LEVELS, createClient: (onState, onError, onSaved) => modules["client/client.mjs"].createClient(onState, onError, onSaved, workerSource), assets: ${JSON.stringify(assets)} });\n})();\n`;
writeFileSync(resolve(root, "client/runtime.js"), content.replace(/\r?\n/g, "\r\n"), "utf8");
console.log(`ENV> CLIENT BUNDLE : ${Buffer.byteLength(content)} BYTES`);
