import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imports = /^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];?\r?$/gm;
const exports = /^export\s+(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const completed = new Set(), chunks = ["const modules = Object.create(null);"];
function bundle(name) {
  if (completed.has(name)) return;
  const path = resolve(root, name), source = readFileSync(path, "utf8");
  const dependencies = [...source.matchAll(imports)].map(match => ({ text: match[0], names: match[1],
    name: relative(root, resolve(dirname(path), match[2])).replaceAll("\\", "/") }));
  for (const dependency of dependencies) bundle(dependency.name);
  let transformed = source;
  for (const dependency of dependencies) transformed = transformed.replace(dependency.text, `const {${dependency.names}} = modules[${JSON.stringify(dependency.name)}];`);
  const names = [...source.matchAll(exports)].map(match => match[1]);
  transformed = transformed.replace(/^export\s+/gm, "");
  if (/^(import|export)\s/m.test(transformed)) throw new Error("지원하지 않는 모듈: " + name);
  chunks.push(`modules[${JSON.stringify(name)}] = (() => {\n${transformed}\nreturn { ${names.join(", ")} };\n})();`);
  completed.add(name);
}
bundle("client/combat-lab.js");
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spawner · 전투 실험실</title><style>${readFileSync(resolve(root, "client/combat-lab.css"), "utf8")}</style></head>
<body><main></main><script src="./client/assets.js"></script><script src="./client/unit-appearance-lazy-assets.js"></script><script>(() => {\n${chunks.join("\n")}\n})();</script></body></html>`;
const previous = readFileSync(resolve(root, "Combat.html"), "utf8");
writeFileSync(resolve(root, "Combat.html"), html.replace(/\r?\n/g, previous.includes("\r\n") ? "\r\n" : "\n"), "utf8");
