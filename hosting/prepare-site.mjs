import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function prepareSite(destination, readSource, revision) {
  const manifest = JSON.parse(readFileSync(join(destination, ".openai/hosting.json"), "utf8"));
  const sourceManifest = JSON.parse(readFileSync(join(root, ".openai/hosting.json"), "utf8"));
  if (manifest.project_id !== sourceManifest.project_id || manifest.static?.directory !== "dist") throw new Error("Spawner Site를 확인해 주세요.");
  const html = readSource("Spawner.html").toString("utf8")
    .replace(/^  <script src="\.\/client\/local-assets\.js"><\/script>\r?\n/m, "");
  const clients = new Map([...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="\.\/(client\/[^"]+)"/g)]
    .map(match => [match[1], readSource(match[1]).toString("utf8")]));
  const assets = new Map();
  for (const source of [html, ...clients.values()]) {
    if (/data:[^;,\s]+;base64,/.test(source)) throw new Error("내장 자산을 DesignAssets 파일로 분리해 주세요.");
    for (const match of source.matchAll(/["'](DesignAssets\/[^"'?#\r\n]+)["']/g)) {
      const name = match[1];
      if (!/\.[a-z0-9]+$/i.test(name) || assets.has(name)) continue;
      if (name.split("/").some(part => part === ".." || part === "")) throw new Error("잘못된 자산 경로입니다.");
      const bytes = readSource(name);
      if (bytes.length > 25 * 1024 * 1024) throw new Error("Sites 단일 자산 크기를 초과했습니다: " + name);
      assets.set(name, bytes);
    }
  }
  const output = join(destination, "dist");
  function write(name, value) {
    const path = join(output, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  }
  const assetPaths = new Map([...assets].map(([name, bytes]) => [name,
    "game-assets/" + createHash("sha256").update(bytes).digest("hex") + "." + name.split(".").at(-1)]));
  write("index.html", html);
  write("Spawner.html", html);
  for (const [name, source] of clients) {
    if (name === "client/assets.js") {
      const marker = "const sources = Object.create(null);";
      if (source.split(marker).length !== 2) throw new Error("자산 경로 초기화를 확인해 주세요.");
      write(name, source.replace(marker, "const sources = Object.assign(Object.create(null), " + JSON.stringify(Object.fromEntries(assetPaths)) + ");"));
    } else if (name === "client/music-catalog.js") {
      let catalog = source;
      for (const [assetName, assetPath] of assetPaths) catalog = catalog.replaceAll(assetName, assetPath);
      write(name, catalog);
    } else write(name, source);
  }
  for (const [name, bytes] of assets) write(assetPaths.get(name), bytes);
  const previousAssets = join(output, "game-assets");
  if (existsSync(previousAssets)) {
    for (const entry of readdirSync(previousAssets, { withFileTypes: true })) {
      const match = entry.name.match(/^([a-f0-9]{64})\.(?:png|webp|gif|bin)$/);
      if (!entry.isFile() || !match || [...assetPaths.values()].includes("game-assets/" + entry.name)) continue;
      const path = join(previousAssets, entry.name);
      if (createHash("sha256").update(readFileSync(path)).digest("hex") === match[1]) unlinkSync(path);
    }
    if (readdirSync(previousAssets).length === 0) rmdirSync(previousAssets);
  }
  return { project_id: manifest.project_id, source_revision: revision, html_bytes: Buffer.byteLength(html), assets: assets.size,
    largest_asset_bytes: Math.max(...[...assets.values()].map(bytes => bytes.length)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2] ? resolve(process.argv[2]) : null;
  if (!destination || process.argv.length !== 3) throw new Error("Sites 체크아웃의 절대 경로가 필요합니다.");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  function tracked(name) { return execFileSync("git", ["show", "HEAD:" + name], { cwd: root, maxBuffer: 128 * 1024 * 1024 }); }
  console.log("ENV> SITE PREPARED : " + JSON.stringify(prepareSite(destination, tracked, revision)));
}
