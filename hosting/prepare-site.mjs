import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, rmdirSync, realpathSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productionRuntime } from "../client/production.mjs";
import { auditImages } from "../client/image-audit.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetBase = "https://oojjrs.github.io/spawner-assets/";

export function prepareSite(destination, readSource, revision, assetDirectory) {
  const manifest = JSON.parse(readFileSync(join(destination, ".openai/hosting.json"), "utf8"));
  const sourceManifest = JSON.parse(readFileSync(join(root, ".openai/hosting.json"), "utf8"));
  if (manifest.project_id !== sourceManifest.project_id || manifest.static?.directory !== "dist") throw new Error("Spawner Site를 확인해 주세요.");
  const html = readSource("Spawner.html").toString("utf8")
    .replace(/^  <script src="\.\/client\/local-assets\.js"><\/script>\r?\n/m, "");
  const pages = new Map([["Spawner.html", html]]);
  for (const name of ["Attribute.html", "NeutralStats.html", "DnaLayouts.html", "UnitPreview.html", "VfxPreview.html", "Combat.html", "BeanRigPreview.html"]) {
    if (existsSync(join(root, name))) {
      const page = readSource(name).toString("utf8");
      pages.set(name, name === "Attribute.html" ? page.replace(/(src|href)="(client\/[^\"]+)"/g, '$1="./$2"') : page);
    }
  }
  const clients = new Map([...pages.values()].flatMap(page => [...page.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="\.\/(client\/[^"]+)"/g)])
    .map(match => [match[1], readSource(match[1]).toString("utf8")]));
  if (clients.has("client/welcome-art.js")) {
    const welcomePath = "DesignAssets/Welcome/forest-clearing.webp";
    const welcomeSource = clients.get("client/welcome-art.js").match(/^globalThis\.SpawnerWelcomeBackground = ("data:image\/webp;base64,[A-Za-z0-9+/]*={0,2}");\r?\n?$/);
    if (!welcomeSource || !Buffer.from(JSON.parse(welcomeSource[1]).slice("data:image/webp;base64,".length), "base64").equals(readSource(welcomePath))) throw new Error("내장 자산을 DesignAssets 파일로 분리해 주세요.");
    clients.set("client/welcome-art.js", "globalThis.SpawnerWelcomeBackground = " + JSON.stringify(welcomePath) + ";\r\n");
  }
  const assets = new Map();
  for (const source of [...pages.values(), ...clients.values()]) {
    if (/data:[^;,\s]+;base64,/.test(source)) throw new Error("내장 자산을 DesignAssets 파일로 분리해 주세요.");
    const dependencies = source.replace(/modules\["client\/image-scales\.mjs"\] = \(\(\) => \{[\s\S]*?^\}\)\(\);/m, "")
      .replace(/\b[A-Za-z_$][\w$]*\.approvedSource\s*(?:===|!==)\s*["']DesignAssets\/[^"'\r\n]+["']/g, "");
    for (const match of dependencies.matchAll(/["'](DesignAssets\/[^"'?#\r\n]+)["']/g)) {
      const name = match[1];
      if (!/\.[a-z0-9]+$/i.test(name) || assets.has(name)) continue;
      if (name.split("/").some(part => part === ".." || part === "")) throw new Error("잘못된 자산 경로입니다.");
      assets.set(name, readSource(name));
    }
  }
  // Review pages have their own sprites. Validate the entire publication, not
  // only the assets found by the main game's runtime build.
  auditImages(root, [...assets.keys()].filter(name => /\.(?:png|webp|gif|jpe?g)$/i.test(name)));
  const output = join(destination, "dist");
  function write(name, value) {
    const path = join(output, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  }
  const assetFiles = new Map([...assets].map(([name, bytes]) => [name,
    createHash("sha256").update(bytes).digest("hex") + "." + name.split(".").at(-1)]));
  // Ship revised sprites with the Site so source updates reach production
  // together without requiring a separate asset CDN publication.
  const localAssets = new Set(["DesignAssets/Welcome/spore-jump.webp", "DesignAssets/Welcome/pebble-jump.webp", ...["charge", "muzzle", "projectile", "impact"].map(stage => "DesignAssets/Animations/CreatureRangedV1/lantern-keeper/" + stage + "-atlas.webp")]);
  const publishedAssets = execFileSync("git", ["show", "HEAD:dist/client/assets.js"], { cwd: destination, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  for (const [name, file] of assetFiles) if (!publishedAssets.includes(assetBase + file)) localAssets.add(name);
  const assetPaths = new Map([...assetFiles].map(([name, file]) => [name,
    localAssets.has(name) ? "./welcome-assets/" + file : assetBase + file]));
  const referencedLocalAssets = new Set([...assetPaths.values()].filter(value => value.startsWith("./welcome-assets/"))
    .map(value => value.slice("./welcome-assets/".length).toLowerCase()));
  const localAssetDirectory = resolve(output, "welcome-assets");
  if (existsSync(localAssetDirectory)) {
    const directory = realpathSync(localAssetDirectory), outputDirectory = realpathSync(output);
    if (directory !== resolve(outputDirectory, "welcome-assets")) throw new Error("잘못된 자산 경로입니다.");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.[a-z0-9]+$/i.test(entry.name) || referencedLocalAssets.has(entry.name.toLowerCase())) continue;
      const target = realpathSync(join(directory, entry.name));
      if (dirname(target) !== directory) throw new Error("잘못된 자산 경로입니다.");
      if (createHash("sha256").update(readFileSync(target)).digest("hex") !== entry.name.slice(0, 64).toLowerCase()) continue;
      unlinkSync(target);
    }
  }
  for (const name of localAssets) if (assets.has(name)) write("welcome-assets/" + assetFiles.get(name), assets.get(name));
  write("index.html", html);
  for (const [name, page] of pages) write(name, page);
  for (const [name, source] of clients) {
    if (name === "client/assets.js") {
      const marker = "const sources = Object.create(null);";
      if (source.split(marker).length !== 2) throw new Error("자산 경로 초기화를 확인해 주세요.");
      write(name, source.replace(marker, "const sources = Object.assign(Object.create(null), " + JSON.stringify(Object.fromEntries(assetPaths)) + ");"));
    } else if (name === "client/music-catalog.js" || name === "client/welcome-art.js") {
      let catalog = source;
      for (const [assetName, assetPath] of assetPaths) catalog = catalog.replaceAll(assetName, assetPath);
      write(name, catalog);
    } else {
      const script = name === "client/runtime.js" ? productionRuntime(source) : source;
      write(name, name.endsWith(".js") ? script.replaceAll("new Image()", "globalThis.SpawnerAssets.image()") : script);
    }
  }
  mkdirSync(assetDirectory, { recursive: true });
  const attributes = join(assetDirectory, ".gitattributes");
  if (!existsSync(attributes)) writeFileSync(attributes, "* -text\r\n.gitattributes text eol=crlf\r\n", "utf8");
  for (const [name, bytes] of assets) {
    const path = join(assetDirectory, assetFiles.get(name));
    if (existsSync(path)) {
      if (!readFileSync(path).equals(bytes)) throw new Error("기존 원본 자산의 해시가 다릅니다: " + path);
    } else writeFileSync(path, bytes);
  }
  const previousAssets = join(output, "game-assets");
  if (existsSync(previousAssets)) {
    for (const entry of readdirSync(previousAssets, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.[a-z0-9]+$/i.test(entry.name)) throw new Error("기존 Sites 자산 경로를 확인해 주세요.");
      unlinkSync(join(previousAssets, entry.name));
    }
    rmdirSync(previousAssets);
  }
  return { project_id: manifest.project_id, source_revision: revision, asset_base: assetBase, html_bytes: Buffer.byteLength(html), assets: assets.size,
    asset_bytes: [...assets.values()].reduce((sum, bytes) => sum + bytes.length, 0), largest_asset_bytes: Math.max(...[...assets.values()].map(bytes => bytes.length)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2] ? resolve(process.argv[2]) : null;
  const assetDirectory = process.argv[3] ? resolve(process.argv[3]) : null;
  if (!destination || !assetDirectory || process.argv.length !== 4) throw new Error("Sites 체크아웃과 공개 자산 폴더의 절대 경로가 필요합니다.");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  function tracked(name) { return execFileSync("git", ["show", revision + ":" + name], { cwd: root, maxBuffer: 128 * 1024 * 1024 }); }
  console.log("ENV> SITE PREPARED : " + JSON.stringify(prepareSite(destination, tracked, revision, assetDirectory)));
}
