import { createServer } from "node:http";
import { createServer as createControlServer } from "node:net";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname, extname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const instanceId = createHash("sha256").update(root.replace(/[\\/]+$/, "").toLowerCase()).digest("hex");
const revision = createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).digest("hex");
const modules = new Set(["client/client.mjs", "client/worker.mjs", "client/room.mjs", "client/storage.mjs",
  "server/game.mjs", "server/world.mjs", "server/attributes.mjs", "server/creatures.mjs", "server/utility.mjs", "server/nests.mjs"]);
const mime = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
let stopping = false;

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("Cache-Control", "no-cache");
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/api/health") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      return response.end(JSON.stringify({ app: "SpawnerClient", instanceId, revision, ready: !stopping, shutdownProtocol: "pipe-v1" }));
    }
    const name = decodeURIComponent(url.pathname === "/" ? "Spawner.html" : url.pathname.slice(1));
    const asset = /^DesignAssets\/[a-zA-Z0-9_./-]+\.(png|webp|gif)$/.test(name);
    const path = resolve(root, name);
    if (stopping || !["GET", "HEAD"].includes(request.method) || !path.startsWith(root + "\\") && !path.startsWith(root + "/") ||
        !(modules.has(name) || asset || ["Spawner.html", "MapDesign.html"].includes(name))) {
      response.writeHead(404);
      return response.end();
    }
    const bytes = await readFile(path);
    response.setHeader("Content-Type", mime[extname(name)]);
    response.setHeader("Content-Length", bytes.length);
    response.writeHead(200);
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof URIError)) console.error(error);
    response.writeHead(404);
    response.end();
  }
});
server.requestTimeout = 10000;
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => console.log(`SYSTEM> STATIC HOST START : http://${host}:${server.address().port}`));

function stop() {
  stopping = true;
  server.close();
  server.closeIdleConnections();
  if (control.listening) control.close();
}
const control = createControlServer(socket => {
  socket.on("error", () => {});
  socket.setTimeout(5000, () => socket.destroy());
  let command = "";
  socket.on("data", chunk => {
    command += chunk.toString("utf8");
    if (command.length > 128) return socket.destroy();
    if (!command.includes("\n")) return;
    socket.removeAllListeners("data");
    if (command.trim() !== "stop") return socket.end("invalid\n");
    socket.end("saved\n");
    stop();
  });
});
if (process.platform === "win32") control.listen(String.raw`\\.\pipe\Spawner-${instanceId}-${port}`);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
