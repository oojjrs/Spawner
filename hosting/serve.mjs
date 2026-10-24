import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const instance = createHash("sha256").update(root.toLowerCase()).digest("hex");
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("INVALID PORT");
const mime = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", png: "image/png", webp: "image/webp", gif: "image/gif",
  jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", mp3: "audio/mpeg",
  wav: "audio/wav", ogg: "audio/ogg", frames: "application/octet-stream", json: "application/json" };

function openBrowser(url) {
  if (!process.argv.includes("--open")) return;
  const command = process.platform === "win32" ? ["cmd.exe", ["/d", "/c", "start", "", url]] :
    process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  const browser = spawn(command[0], command[1], { windowsHide: true, stdio: "ignore" });
  browser.on("error", error => console.error(error));
  browser.unref();
}

function gameFile(path) {
  const name = relative(root, path).replaceAll("\\", "/");
  return !isAbsolute(name) && !name.startsWith("../") &&
    (name === "Spawner.html" || name.startsWith("client/") || name.startsWith("DesignAssets/"));
}

async function route(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (pathname === "/api/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify({ app: "Spawner", instance, mode: "static" }));
    return;
  }
  const name = ["/", "/index.html"].includes(pathname) ? "/Spawner.html" : pathname;
  const path = resolve(root, "." + name);
  if (!gameFile(path) || !gameFile(await realpath(path))) {
    response.writeHead(404);
    response.end();
    return;
  }
  const info = await stat(path);
  if (!info.isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { "Content-Type": mime[path.split(".").at(-1)] || "application/octet-stream",
    "Content-Length": info.size, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
  if (request.method === "HEAD") response.end();
  else createReadStream(path).on("error", error => response.destroy(error)).pipe(response);
}

const server = createServer((request, response) => {
  route(request, response).catch(error => {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR" && !(error instanceof URIError)) console.error(error);
    if (!response.headersSent) response.writeHead(error instanceof URIError ? 400 : 404);
    response.end();
  });
});
server.on("error", async error => {
  if (error.code === "EADDRINUSE") {
    const url = "http://127.0.0.1:" + port + "/";
    try {
      const response = await fetch(url + "api/health", { signal: AbortSignal.timeout(1500) });
      const health = await response.json();
      if (health.instance === instance && health.mode === "static") {
        console.log("SYSTEM> SERVER RUNNING : " + url);
        openBrowser(url);
        return;
      }
    } catch {}
  }
  console.error(error);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  const url = "http://127.0.0.1:" + server.address().port + "/";
  console.log("SYSTEM> SERVER START : " + url);
  openBrowser(url);
});
