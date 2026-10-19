import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CREATURE_ASSETS } from "../server/creatures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = process.argv[2] ? resolve(process.argv[2]) : null;
if (!destination || process.argv.length !== 3) throw new Error("Sites 체크아웃의 절대 경로가 필요합니다.");
const manifest = JSON.parse(readFileSync(join(destination, ".openai/hosting.json"), "utf8"));
if (manifest.project_id !== "appgprj_6ac621eeeac08191bc0b96446dec8f6c") throw new Error("Spawner Site를 확인해 주세요.");
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
function tracked(name) { return execFileSync("git", ["show", "HEAD:" + name], { cwd: root, maxBuffer: 128 * 1024 * 1024 }); }
function text(name, value) {
  const file = join(destination, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, value.replace(/\r?\n/g, "\r\n"), "utf8");
}
const assets = new Map();
const html = tracked("Spawner.html").toString("utf8").replace(/data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)/g, (url, mime, encoded) => {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Sites 단일 자산 크기를 초과했습니다: " + mime);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "bin";
  const name = hash + "." + extension;
  assets.set(name, bytes);
  return "/game-assets/" + name;
});
mkdirSync(join(destination, "public/game-assets"), { recursive: true });
for (const [name, bytes] of assets) writeFileSync(join(destination, "public/game-assets", name), bytes);
text("public/Spawner.html", html);
text("public/MapDesign.html", tracked("MapDesign.html").toString("utf8"));
for (const name of ["game.mjs", "world.mjs", "attributes.mjs", "creatures.mjs", "utility.mjs", "nests.mjs"]) text("public/server/" + name, tracked("server/" + name).toString("utf8"));
for (const name of ["client.mjs", "worker.mjs", "room.mjs", "storage.mjs"]) text("public/client/" + name, tracked("client/" + name).toString("utf8"));
for (const file of CREATURE_ASSETS) {
  const target = join(destination, "public", file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, tracked(file));
}
text("app/api/[...path]/route.ts", `export const dynamic = "force-dynamic";
export function GET() { return Response.json({ error: "브라우저의 내 월드에서 플레이해 주세요." }, { status: 410 }); }
export function POST() { return GET(); }
`);
console.log(`ENV> SITE PREPARED : ${JSON.stringify({ project_id: manifest.project_id, source_revision: revision, html_bytes: Buffer.byteLength(html), assets: assets.size, largest_asset_bytes: Math.max(...[...assets.values()].map((bytes) => bytes.length)) })}`);
